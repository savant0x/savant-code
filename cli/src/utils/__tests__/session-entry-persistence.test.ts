import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * FID-2026-1011-006 R15/R16 acceptance, exercised through the real save path
 * (`saveChatStateToDb`), not only the writers. The env var must be set before
 * the database module resolves its path, so the imports below are dynamic.
 */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-session-entries-'))
process.env.SAVANT_DB_PATH = path.join(tempDir, 'echo.db')

const {
  createLabelEntry,
  createSession,
  getSession,
  getEntriesByKind,
  getInContextMessages,
} = await import('@savant-code/database/service')
const { getDb } = await import('@savant-code/database')
const { saveChatStateToDb } = await import('../db-storage')
const { writeSteeringOverrideAudits } = await import('../entry-writers')

import type { SteeringOverrideAuditRecord } from '@savant-code/common/types/session-state'
import type { RunState } from '@savant-code/sdk'

afterAll(() => {
  process.env.SAVANT_DB_PATH = ':memory:'
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // The lazily-opened connection may still hold the file on Windows.
  }
})

let chatId = ''
let sessionId = ''
let overrides: SteeringOverrideAuditRecord[] = []

beforeEach(() => {
  chatId = `chat-${Math.random().toString(36).slice(2)}`
  sessionId = createSession(chatId, 'agent', { test: 'persistence' }).id
  overrides = [
    {
      id: 'audit-1',
      ruleId: 'r1',
      reason: 'why 1',
      toolName: 'read',
      agentId: 'a',
      at: 1,
    },
    {
      id: 'audit-2',
      ruleId: 'r2',
      reason: 'why 2',
      toolName: 'read',
      agentId: 'a',
      at: 2,
    },
    {
      id: 'audit-3',
      ruleId: 'r3',
      reason: 'why 3',
      toolName: 'read',
      agentId: 'a',
      at: 3,
    },
  ]
})

/** A run state carrying only the fields the save path reads. */
function makeRunState(mainAgentState: Record<string, unknown>): RunState {
  return { sessionState: { mainAgentState } } as unknown as RunState
}

function save(runState: RunState): void {
  saveChatStateToDb(chatId, 'agent', runState, [])
}

/** The durable entry id the writer mints for one audit (session-scoped). */
function entryIdFor(auditId: string): string {
  return `steering:${sessionId}:${auditId}`
}

describe('FID-2026-1011-006 R15 steering-override retention', () => {
  test('the save path drains every audit and a resave duplicates nothing', () => {
    const state = { pendingSteeringOverrideAudits: [...overrides] }
    const runState = makeRunState(state)
    save(runState)

    expect(state.pendingSteeringOverrideAudits).toEqual([])
    expect(
      getEntriesByKind(sessionId, 'custom')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([
      entryIdFor('audit-1'),
      entryIdFor('audit-2'),
      entryIdFor('audit-3'),
    ])
    // Audit rows are never conversation context.
    expect(getInContextMessages(sessionId)).toHaveLength(0)

    // A re-drain of the same identities is idempotent.
    save(makeRunState({ pendingSteeringOverrideAudits: [...overrides] }))
    expect(getEntriesByKind(sessionId, 'custom')).toHaveLength(3)
  })

  test('only the failing audit is retained, and its retry commits once', () => {
    // Failure injection at the writer seam: the DB layer stringifies entry
    // content, so a self-referential value makes exactly that one write throw.
    // (Injected here rather than through the save path because the save path
    // serializes the session state — which holds the same records — first.)
    const loop: Record<string, unknown> = {}
    loop.self = loop
    const broken = { ...overrides[1], reason: loop as unknown as string }

    const failed = writeSteeringOverrideAudits(sessionId, [
      overrides[0],
      broken,
      overrides[2],
    ])

    // Only the failing record comes back for retry; the other two are durable.
    expect(failed.map((audit) => audit.id)).toEqual(['audit-2'])
    expect(
      getEntriesByKind(sessionId, 'custom')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([entryIdFor('audit-1'), entryIdFor('audit-3')])

    // The retry keeps the same event identity: one more row, never a duplicate.
    expect(
      writeSteeringOverrideAudits(sessionId, [
        { ...overrides[1], reason: 'why 2' },
      ]),
    ).toEqual([])
    expect(
      getEntriesByKind(sessionId, 'custom')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([
      entryIdFor('audit-1'),
      entryIdFor('audit-2'),
      entryIdFor('audit-3'),
    ])
    expect(getInContextMessages(sessionId)).toHaveLength(0)
  })
})

describe('FID-2026-1011-006 R16 compaction boundary bookmarks', () => {
  function compactionLabels(): string[] {
    return getEntriesByKind(sessionId, 'label')
      .map((entry) => entry.id)
      .filter((id) => id.startsWith('compaction:'))
      .sort()
  }

  test('boundaries are identified by owner and ordinal, not by label count', () => {
    const unrelated = createLabelEntry(sessionId, 'before-refactor')
    const state: Record<string, unknown> = {
      compactionMetrics: { events: 3 },
      runId: 'run-a',
    }

    save(makeRunState(state))
    expect(compactionLabels()).toEqual([
      `compaction:${sessionId}:run-a:1`,
      `compaction:${sessionId}:run-a:2`,
      `compaction:${sessionId}:run-a:3`,
    ])
    // The unrelated label is untouched and never counted as a boundary.
    expect(getEntriesByKind(sessionId, 'label')).toHaveLength(4)
    expect(unrelated.entry_kind).toBe('label')

    // Resaving the same boundaries records nothing new.
    save(makeRunState(state))
    expect(compactionLabels()).toHaveLength(3)

    // A boundary whose write did not land is repaired on the next save —
    // the gap does not survive because the ordinal is recomputed.
    getDb().exec(
      `DELETE FROM message_history WHERE id = 'compaction:${sessionId}:run-a:2'`,
    )
    expect(compactionLabels()).toHaveLength(2)
    save(makeRunState(state))
    expect(compactionLabels()).toHaveLength(3)

    // A new agent counter lifecycle owns its own bookmark series.
    save(makeRunState({ compactionMetrics: { events: 3 }, runId: 'run-b' }))
    expect(compactionLabels()).toHaveLength(6)
    expect(getInContextMessages(sessionId)).toHaveLength(0)
  })
})

describe('LF-003 durable session recovery', () => {
  test('persists conversation messages when runtime state contains a cycle', () => {
    const mainAgentState: Record<string, unknown> = {
      messageHistory: [],
    }
    mainAgentState.runtime = { parent: mainAgentState }
    const runState = makeRunState(mainAgentState)

    const saved = saveChatStateToDb(chatId, 'agent', runState, [
      {
        id: 'cycle-recovery-message',
        variant: 'user',
        content: 'durable user content',
        timestamp: new Date(0).toISOString(),
      },
    ])

    expect(saved.sessionId).toBe(sessionId)
    expect(getSession(sessionId)?.session_state).toMatchObject({
      mainAgentState: { messageHistory: [] },
    })
    expect(getInContextMessages(sessionId)).toEqual([
      expect.objectContaining({
        id: 'cycle-recovery-message',
        content: 'durable user content',
      }),
    ])
  })
})
