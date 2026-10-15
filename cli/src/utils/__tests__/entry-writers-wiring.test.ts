import { readFileSync } from 'node:fs'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { reasoningLevelOf } from '../entry-writers'

/**
 * FID-2026-1006-003 WP5: the session entry classes must have real writers.
 * These tests assert the CALLER — the seams that write `model_change` /
 * `label` / `custom` entries, and the load path that keeps excluded rows out
 * of a resumed chat. Removing the wiring fails here instead of only leaving
 * the entry classes inert.
 */
const repoRoot = path.resolve(import.meta.dir, '..', '..', '..', '..')

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

describe('entry-class writers wiring (FID-2026-1006-003 WP5)', () => {
  test('the save path writes the model-change, label and override entries', () => {
    const dbStorage = source('cli/src/utils/db-storage.ts')

    // A mid-session model change is audited before the stored model moves on.
    expect(dbStorage).toContain('writeModelChangeEntries(session.id')
    expect(dbStorage).toContain('getSession(session.id)')
    // Every completed compaction boundary leaves a durable label bookmark.
    expect(dbStorage).toContain('writeCompactionLabel(')
    expect(dbStorage).toContain("getEntriesByKind(session.id, 'label')")
    // The override audit the tool executor parked on agentState is drained.
    expect(dbStorage).toContain('writeSteeringOverrideAudits(session.id')
    expect(dbStorage).toContain(
      'mainAgentState.pendingSteeringOverrideAudits =',
    )
    expect(dbStorage).not.toContain('pendingSteeringOverrideAudits = []')
  })

  test('the resumed-chat load sources only in-context rows', () => {
    const dbStorage = source('cli/src/utils/db-storage.ts')

    expect(dbStorage).toContain('getInContextMessages(session.id)')
    // Mapping every row would re-inject audit rows as conversation turns.
    expect(dbStorage).not.toContain('getMessagesBySessionId(')
  })

  test('the tool executor parks an override audit on agentState', () => {
    const native = source(
      'packages/agent-runtime/src/tools/tool-executor/native.ts',
    )

    expect(native).toContain('pendingSteeringOverrideAudits')
    expect(native).toContain('auditSteeringOverride')
  })

  test('an unknown model never reads as a reasoning-level change', () => {
    const unknown = reasoningLevelOf('vendor/not-in-the-catalog')

    expect(unknown).toBe('default')
    expect(reasoningLevelOf('vendor/not-in-the-catalog')).toBe(unknown)
  })
})
