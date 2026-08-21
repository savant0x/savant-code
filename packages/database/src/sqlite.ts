import { getDb } from './index'

// FID-2026-0803-010 DB-C: bun:sqlite statements are reusable — prepare once
// per SQL string and memoize instead of re-preparing on every call. Lazy (not
// import-time) so the fail-open initDatabase and the ':memory:' test escape
// hatch are unaffected. Statements are prepared via getDb(), which resolves
// bun:sqlite on first actual use.
export type SqliteStatement = ReturnType<ReturnType<typeof getDb>['prepare']>

export const statementCache = new Map<string, SqliteStatement>()

export function prepare(sql: string): SqliteStatement {
  let stmt = statementCache.get(sql)
  if (!stmt) {
    stmt = getDb().prepare(sql)
    statementCache.set(sql, stmt)
  }
  return stmt
}

/**
 * Parses a stored JSON string, returning `fallback` for corrupt/missing data
 * instead of throwing (FID-006 DB5).
 */
export function parseStoredJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// FID-2026-0803-002 DB-5: get-after-create round trips must surface an
// explicit error instead of a confusing TypeError from a `!` assertion.
export function requireRow<T>(row: T | null, label: string): T {
  if (row == null) {
    throw new Error(`Failed to ${label}`)
  }
  return row
}
