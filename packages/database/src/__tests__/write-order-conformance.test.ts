/**
 * Tier B — writer conformance (FID-2026-1006-002 WP2, T149 idea 2).
 *
 * Wraps the single durable-write seam (`commit-journal.ts`) and asserts the
 * EXACT ordered write surface of every catalogued transaction against
 * `docs/durable-race-catalog.md`'s transaction tables. A change that adds,
 * drops, reorders or retargets a write fails here — that disagreement is the
 * point of the tier: "tests pass" becomes "every write is claimed and proven".
 */

import { beforeEach, describe, expect, it } from 'bun:test'

// Isolated in-memory DB. The resolved path is read per call and connections
// are cached per path (see `resolveDbPath`), so setting this before the dynamic
// imports below is what keeps every call in this file on the in-memory
// connection.
process.env.SAVANT_DB_PATH = ':memory:'

const {
  createSession,
  mutateSessionState,
  updateSession,
  updateSessionModel,
  updateSessionPinned,
} = await import('../service')
const { createMessage, createCostRecord } = await import('../history')
const { createAgentTemplate, updateAgentTemplate } = await import('../service')
const { createFidDocument, updateFidDocument } = await import('../service')
const { commitJournal, observeCommits, resetCommitJournal, runCommit } =
  await import('../commit-journal')

/** The ordered write surface of `fn`, as `kind table` strings. */
function surfaceOf(fn: () => unknown): string[] {
  resetCommitJournal()
  fn()
  return commitJournal().map((record) => `${record.kind} ${record.table}`)
}

/** The same, for a mutation that settles asynchronously (WP4's line). */
async function surfaceOfAsync(fn: () => Promise<unknown>): Promise<string[]> {
  resetCommitJournal()
  await fn()
  return commitJournal().map((record) => `${record.kind} ${record.table}`)
}

beforeEach(() => {
  resetCommitJournal()
})

describe('Tier B — transaction write-order conformance', () => {
  it('createSession writes exactly one insert into sessions', () => {
    expect(surfaceOf(() => createSession('chat-b1', 'agent-b1', {}))).toEqual([
      'insert sessions',
    ])
  })

  it('append message / record usage write exactly one insert each', () => {
    const session = createSession('chat-b2', 'agent-b2', {})
    expect(surfaceOf(() => createMessage(session.id, 'user', 'hi'))).toEqual([
      'insert message_history',
    ])
    expect(
      surfaceOf(() => createCostRecord(session.id, 'agent-b2', 1, 0)),
    ).toEqual(['insert cost_tracking'])
  })

  it('every session update targets sessions with exactly one write', () => {
    const session = createSession('chat-b3', 'agent-b3', {})
    expect(surfaceOf(() => updateSessionModel(session.id, 'model-x'))).toEqual([
      'update sessions',
    ])
    expect(surfaceOf(() => updateSessionPinned(session.id, true))).toEqual([
      'update sessions',
    ])
    expect(surfaceOf(() => updateSession(session.id, { step: 3 }))).toEqual([
      'update sessions',
    ])
  })

  it('a serialized session-state mutation is exactly one update to sessions', async () => {
    // WP2 promises that its conformance test asserts WP4's database half: the
    // read-modify-write line adds reads, and reads must not appear in the
    // durable write surface.
    const session = createSession('chat-b8', 'agent-b8', { step: 1 })
    const surface = await surfaceOfAsync(() =>
      mutateSessionState(session.id, (current) => ({ ...current, step: 2 })),
    )
    expect(surface).toEqual(['update sessions'])
  })

  it('one turn commits session, message and usage in that exact order', () => {
    const surface = surfaceOf(() => {
      const session = createSession('chat-b4', 'agent-b4', {})
      createMessage(session.id, 'assistant', 'done')
      createCostRecord(session.id, 'agent-b4', 2, 1)
    })
    expect(surface).toEqual([
      'insert sessions',
      'insert message_history',
      'insert cost_tracking',
    ])
  })

  it('agent template and FID document create+update orders', () => {
    const template = createAgentTemplate({ id: 'tpl-b5' })
    expect(
      surfaceOf(() => updateAgentTemplate(template.id, { id: 'tpl-b5' })),
    ).toEqual(['update agent_templates'])
    const session = createSession('chat-b5', 'agent-b5', {})
    const fid = createFidDocument(session.id, 'content', 'fid-b5')
    expect(surfaceOf(() => updateFidDocument(fid.id, 'c2', 's', 'p'))).toEqual([
      'update fid_documents',
    ])
  })

  it('a no-op update is still a recorded commit (changes 0, never invisible)', () => {
    resetCommitJournal()
    const changes = runCommit(
      'UPDATE sessions SET selected_model = ? WHERE id = ?',
      ['m', 'missing-id'],
    )
    expect(changes).toBe(0)
    const journal = commitJournal()
    expect(journal).toHaveLength(1)
    expect(journal[0]).toMatchObject({
      sequence: 1,
      kind: 'update',
      table: 'sessions',
      changes: 0,
    })
  })

  it('observers receive commits in order and unsubscribe cleanly', () => {
    const seen: string[] = []
    const unsubscribe = observeCommits((record) =>
      seen.push(`${record.sequence}:${record.table}`),
    )
    createSession('chat-b6', 'agent-b6', {})
    createAgentTemplate({ id: 'tpl-b6' })
    unsubscribe()
    createAgentTemplate({ id: 'tpl-b7' })

    expect(seen).toEqual(['1:sessions', '2:agent_templates'])
  })

  it('sequences are monotonic and contiguous within a connection', () => {
    resetCommitJournal()
    createSession('chat-b7', 'agent-b7', {})
    createAgentTemplate({ id: 'tpl-b8' })
    const sequences = commitJournal().map((record) => record.sequence)
    expect(sequences).toEqual([1, 2])
  })
})
