import { prepare } from './sqlite'

/**
 * The single durable-write seam (FID-2026-1006-002 WP2, Tier B).
 *
 * Adopted from the pi harness race-catalog discipline (`harness.md` Part 9):
 * every durable mutation of the domain tables flows through ONE function, so
 * the exact ordered write surface of a transaction is observable and can be
 * asserted against the race catalog's transaction tables
 * (`docs/durable-race-catalog.md`) instead of being inferred from source.
 *
 * Scope: the DOMAIN write surface (`sessions`, `message_history`,
 * `cost_tracking`, `agent_templates`, `fid_documents`). Bootstrap DDL and the
 * `schema_version` anchors in `index.ts` stay outside the seam — they run once
 * per connection, before any domain write can exist, and are pinned by the
 * schema-version tests instead.
 *
 * The journal is append-only for the life of the connection and cheap (one
 * record per write). `runCommit` is the ONLY executor: no caller-side
 * re-implementation, and the returned change count is the driver's own.
 */
export type CommitKind = 'insert' | 'update' | 'delete' | 'other'

export type CommitRecord = {
  /** 1-based position in this connection's journal. */
  sequence: number
  kind: CommitKind
  /** Target table, or `''` when the statement is not a plain DML write. */
  table: string
  sql: string
  changes: number
}

type SqlBinding = string | number | bigint | boolean | null | Uint8Array

export type CommitObserver = (record: CommitRecord) => void

const journal: CommitRecord[] = []
const observers = new Set<CommitObserver>()

/** Classify a DML statement into its kind + target table (best-effort). */
export function classifyCommit(sql: string): {
  kind: CommitKind
  table: string
} {
  const insert = sql.match(
    /INSERT\s+(?:OR\s+[A-Z]+[A-Z ]*?\s+)?INTO\s+([A-Za-z_]\w*)/i,
  )
  if (insert) return { kind: 'insert', table: insert[1] }
  const update = sql.match(/UPDATE\s+([A-Za-z_]\w*)/i)
  if (update) return { kind: 'update', table: update[1] }
  const remove = sql.match(/DELETE\s+FROM\s+([A-Za-z_]\w*)/i)
  if (remove) return { kind: 'delete', table: remove[1] }
  return { kind: 'other', table: '' }
}

/**
 * Execute one durable write and record it. Returns the driver's change count,
 * so a caller's `changes > 0` no-op detection is unchanged by the refactor.
 */
export function runCommit(
  sql: string,
  params: readonly SqlBinding[] = [],
): number {
  const result = prepare(sql).run(...(params as SqlBinding[]))
  const { kind, table } = classifyCommit(sql)
  const record: CommitRecord = {
    sequence: journal.length + 1,
    kind,
    table,
    sql,
    changes: Number(result.changes ?? 0),
  }
  journal.push(record)
  for (const observer of observers) observer(record)
  return record.changes
}

/** The ordered write surface observed so far (read-only view). */
export function commitJournal(): readonly CommitRecord[] {
  return journal
}

/**
 * Subscribe to commits. Returns an unsubscribe function — a test (or a future
 * MutationLine) must never be able to leak an observer into another test.
 */
export function observeCommits(observer: CommitObserver): () => void {
  observers.add(observer)
  return () => {
    observers.delete(observer)
  }
}

/** Clear the journal and drop every observer (test seam). */
export function resetCommitJournal(): void {
  journal.length = 0
  observers.clear()
}
