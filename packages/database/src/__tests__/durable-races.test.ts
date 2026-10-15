/**
 * Tier A (state → close → reopen → drive) and Tier C (deterministic
 * interleavings in both orders) for `docs/durable-race-catalog.md`
 * (FID-2026-1006-002 WP2, T149 idea 2).
 *
 * Tier A does not merely "invoke recovery twice from the initial prefix":
 * it WRITES through the seam, then opens a SECOND connection to the same file
 * and asserts what it can see — the only honest way to prove durability.
 *
 * R6 is the lost update on a shared JSON snapshot. WP4's `mutation-line.ts`
 * owns it: the test below drives the race through the serialized
 * read-modify-write line and asserts the required outcome, and it is a real
 * discriminator — delete the lane and writer B's field disappears (B would
 * read, write, and be overwritten during writer A's await).
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

// A real file (not :memory:) — durability across connections is the subject.
// The path is re-asserted per test and restored afterwards: `bun test` shares
// one module registry across files, so this file owns the env var only while
// its own tests run (see `resolveDbPath` for the per-path connection cache).
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-races-'))
const durableDbPath = path.join(tempDir, 'echo.db')
process.env.SAVANT_DB_PATH = durableDbPath

const {
  createSession,
  getSession,
  isSealed,
  mutateSessionState,
  MutationLineSealedError,
  releaseSeal,
  resetMutationLine,
  sessionMutationKey,
  updateSession,
  updateSessionModel,
  updateSessionUnread,
} = await import('../service')
const { createMessage, getMessagesBySessionId, getTotalCostBySessionId } =
  await import('../history')
const { createCostRecord } = await import('../history')
const { getSchemaVersion, resolveBunSqliteDatabaseModule } =
  await import('../index')

beforeEach(() => {
  process.env.SAVANT_DB_PATH = durableDbPath
  // A sealed lane survives until it is released, and a test must never inherit
  // one from a previous test.
  resetMutationLine()
})

afterAll(() => {
  // Hand the escape hatch back to the in-memory path the sibling suite uses,
  // so file order cannot leak this file's database into it.
  process.env.SAVANT_DB_PATH = ':memory:'
  // The opened connection stays alive for the process lifetime, and Windows
  // refuses to remove an open file — best-effort cleanup, never a failure.
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // ignored: the lazily-opened connection is still holding the file
  }
})

/** Open an independent connection to the same file (a "reopen"). */
function reopen(): InstanceType<
  ReturnType<typeof resolveBunSqliteDatabaseModule>['Database']
> {
  const DatabaseCtor = resolveBunSqliteDatabaseModule().Database
  return new DatabaseCtor(path.join(tempDir, 'echo.db'))
}

describe('Tier A — durable state survives a close/reopen', () => {
  it('R1/R2: a returned write is visible to a new connection (WAL)', () => {
    const session = createSession('chat-a1', 'agent-a1', { turn: 1 })
    createMessage(session.id, 'user', 'persisted')

    const second = reopen()
    try {
      const rows = second
        .prepare('SELECT id, session_state FROM sessions WHERE id = ?')
        .all(session.id) as Array<{ id: string }>
      expect(rows).toHaveLength(1)
      const messages = second
        .prepare('SELECT content FROM message_history WHERE session_id = ?')
        .all(session.id) as Array<{ content: string }>
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toContain('persisted')
    } finally {
      second.close()
    }
  })

  it('R9: the journal mode and schema are restored, not re-derived', () => {
    const second = reopen()
    try {
      const mode = second.prepare('PRAGMA journal_mode').get() as {
        journal_mode: string
      }
      expect(mode.journal_mode.toLowerCase()).toBe('wal')
      const version = second
        .prepare('SELECT MAX(version) AS version FROM schema_version')
        .get() as { version: number }
      expect(version.version).toBe(getSchemaVersion())
      expect(version.version).toBeGreaterThanOrEqual(3)
    } finally {
      second.close()
    }
  })

  it('R3: the usage aggregate is the committed sum after reopen', () => {
    const session = createSession('chat-a3', 'agent-a3', {})
    createCostRecord(session.id, 'agent-a3', 2.5, 1)
    createCostRecord(session.id, 'agent-a3', 0.5, 0)

    const second = reopen()
    try {
      const total = second
        .prepare(
          'SELECT COALESCE(SUM(credits_used), 0) AS total FROM cost_tracking WHERE session_id = ?',
        )
        .get(session.id) as { total: number }
      expect(total.total).toBe(3)
    } finally {
      second.close()
    }
    expect(getTotalCostBySessionId(session.id).total_credits).toBe(3)
  })
})

describe('Tier C — deterministic interleavings', () => {
  it('R4: the same message id lands exactly once, whichever order it arrives', () => {
    const session = createSession('chat-c4', 'agent-c4', {})
    createMessage(session.id, 'user', 'first', 'stable-id-c4')
    createMessage(session.id, 'user', 'second', 'stable-id-c4')

    const rows = getMessagesBySessionId(session.id)
    expect(rows).toHaveLength(1)
    // The first content wins — a re-sent id never rewrites history.
    expect(rows[0].content).toBe('first')
  })

  it('R5: two writers on distinct columns both survive', async () => {
    const session = createSession('chat-c5', 'agent-c5', {})
    await Promise.all([
      Promise.resolve().then(() => updateSessionModel(session.id, 'model-r5')),
      Promise.resolve().then(() => updateSessionUnread(session.id, true)),
    ])

    const stored = getSession(session.id)
    expect(stored?.selected_model).toBe('model-r5')
    expect(stored?.unread).toBe(true)
  })

  it('R6: serialized read-modify-write keeps both writers’ fields', async () => {
    const session = createSession('chat-c6', 'agent-c6', { base: 0 })
    // Two writers, each deriving its next state from the state stored when its
    // turn in the lane arrives. Writer A yields mid-transform: without the lane
    // B would read and commit inside that await, and A would then commit a
    // snapshot that predates B, dropping B's field.
    const [first, second] = await Promise.all([
      mutateSessionState(session.id, async (current) => {
        await Promise.resolve()
        return { ...current, fromA: true }
      }),
      mutateSessionState(session.id, (current) => ({
        ...current,
        fromB: true,
      })),
    ])
    expect(first).toBe(true)
    expect(second).toBe(true)

    const state = getSession(session.id)?.session_state as Record<
      string,
      unknown
    >
    expect(state.base).toBe(0)
    expect(state.fromA).toBe(true)
    expect(state.fromB).toBe(true)
  })

  it('R6: the committed state is exactly what a transform returned, never a blend', async () => {
    const session = createSession('chat-c6b', 'agent-c6b', { base: 0 })
    // A transform that returns a complete replacement is committed verbatim:
    // the line does not fold the previous blob back in, so a deliberate
    // deletion is a deletion.
    await mutateSessionState(session.id, () => ({ onlyThis: 'writer' }))

    expect(getSession(session.id)?.session_state).toEqual({
      onlyThis: 'writer',
    })
  })

  it('R6: a failed mutation seals its key and later mutations refuse (fail-closed)', async () => {
    const session = createSession('chat-c6c', 'agent-c6c', { base: 0 })
    const other = createSession('chat-c6d', 'agent-c6d', { base: 0 })
    const key = sessionMutationKey(session.id)

    await expect(
      mutateSessionState(session.id, () => {
        throw new Error('transform blew up')
      }),
    ).rejects.toThrow(/transform blew up/)
    expect(isSealed(key)).toBe(true)

    // The sealed key refuses to read an unvouched-for state...
    await expect(
      mutateSessionState(session.id, (current) => ({
        ...current,
        after: true,
      })),
    ).rejects.toThrow(MutationLineSealedError)
    // ...and the refusal is invisible in the store: nothing was half-written.
    expect(getSession(session.id)?.session_state).toEqual({ base: 0 })
    // Sealing is per key — a different session is unaffected.
    expect(
      await mutateSessionState(other.id, (current) => ({
        ...current,
        unaffected: true,
      })),
    ).toBe(true)

    releaseSeal(key)
    expect(isSealed(key)).toBe(false)
    expect(
      await mutateSessionState(session.id, (current) => ({
        ...current,
        recovered: true,
      })),
    ).toBe(true)
    expect(getSession(session.id)?.session_state).toEqual({
      base: 0,
      recovered: true,
    })
  })

  it('R6: a mutation for an unknown session is a no-op, not an insert', async () => {
    expect(
      await mutateSessionState('missing-session', () => ({ written: true })),
    ).toBe(false)
    expect(getSession('missing-session')).toBeNull()
  })

  it('R7: the stored snapshot is exactly one of the two, never a blend', () => {
    const session = createSession('chat-c7', 'agent-c7', { base: 0 })
    const first = { base: 0, writer: 'first' }
    const second = { base: 0, writer: 'second' }
    updateSession(session.id, first)
    updateSession(session.id, second)

    const state = getSession(session.id)?.session_state as Record<
      string,
      unknown
    >
    expect([JSON.stringify(first), JSON.stringify(second)]).toContain(
      JSON.stringify(state),
    )
  })

  it('R8: a foreign-key violation surfaces and writes no row', () => {
    // `INSERT OR IGNORE` does NOT swallow a foreign-key violation (SQLite
    // ignores UNIQUE/NOT NULL/CHECK, not FK), so the driver error reaches the
    // caller and no orphan row exists afterwards — the write is never a
    // silent skip.
    expect(() => createMessage('missing-session', 'user', 'orphan')).toThrow(
      /FOREIGN KEY constraint failed/,
    )
    expect(getMessagesBySessionId('missing-session')).toEqual([])
  })
})
