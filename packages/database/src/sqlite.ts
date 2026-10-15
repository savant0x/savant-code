import { getDb } from './index'

// FID-2026-0803-010 DB-C: bun:sqlite statements are reusable — prepare once
// per SQL string and memoize instead of re-preparing on every call. Lazy (not
// import-time) so the fail-open initDatabase and the ':memory:' test escape
// hatch are unaffected. Statements are prepared via getDb(), which resolves
// bun:sqlite on first actual use.
export type SqliteStatement = ReturnType<ReturnType<typeof getDb>['prepare']>

export const statementCache = new Map<string, SqliteStatement>()

// FID-2026-1006-002 WP2: a prepared statement is bound to the connection that
// prepared it, and `getDb()` can now return a different connection when the
// resolved path changes (the SAVANT_DB_PATH escape hatch is resolved per
// call). Track the bound connection so a switch rebuilds the cache instead of
// handing out a statement that would write to the previous database.
let boundConnection: ReturnType<typeof getDb> | undefined

export function prepare(sql: string): SqliteStatement {
  const connection = getDb()
  if (connection !== boundConnection) {
    statementCache.clear()
    boundConnection = connection
  }
  let stmt = statementCache.get(sql)
  if (!stmt) {
    stmt = connection.prepare(sql)
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

/** Test isolation: clears the memoized prepared statements and the connection
 *  they were bound to — process-lifetime state `bun test` shares across files
 *  (FID-2026-1007-002). Statements are dropped, never finalized. */
export function resetSqliteState(): void {
  statementCache.clear()
  boundConnection = undefined
}
