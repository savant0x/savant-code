import {
  DbErrorCode,
  StructuredDbError,
  classifySql,
  isWriteOperation,
  redactSql,
} from './sql-safety'

// Re-export the SQL safety layer for backwards compatibility
export {
  MAX_ROW_LIMIT,
  QUERY_TIMEOUT_MS,
  DbErrorCode,
  StructuredDbError,
  applyQueryLimits,
  classifySql,
  isWriteOperation,
  redactSql,
  stripSqlCommentsAndQuotedText,
} from './sql-safety'
export type { SqlStatementType } from './sql-safety'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Database } from 'bun:sqlite'

// bun:sqlite is Bun-only and the database tools only ever execute under the
// Bun runtime. The SDK bundles these handlers through the tool executor, so a
// top-level value import would emit a hoisted `require("bun:sqlite")` into
// dist/index.cjs and break Node.js consumers of the SDK at load time (the
// published SDK ships `engines.node >= 18` and a Node dist smoke test). Resolve
// the constructor lazily on first database-tool use instead (precedent:
// sdk/src/run-state.ts:550).
let sqliteDatabaseCtor: typeof Database | undefined

/** The module-scope `require` when it exists; `undefined` under Node ESM. */
function getRuntimeRequire(): ((id: string) => unknown) | undefined {
  // `typeof` is safe even where `require` is undeclared (Node ESM) — it
  // evaluates to 'undefined' without throwing a ReferenceError.
  return typeof require === 'function' ? require : undefined
}

/**
 * Resolve the bun:sqlite Database constructor, or throw a clear
 * StructuredDbError when the runtime cannot provide it (Node.js CJS/ESM
 * consumers of the SDK dist). The require is deferred to call time so the
 * SDK dist stays loadable in Node; this guard turns what would otherwise be a
 * bare `ReferenceError: require is not defined` (Node ESM) or a raw
 * `Cannot find module 'bun:sqlite'` (Node CJS) into an actionable message.
 * `requireFn` is injectable for tests. Note the default-parameter semantics:
 * omitting it (or passing explicit `undefined`) injects the runtime `require`;
 * pass explicit `null` to simulate an environment without `require` (Node ESM).
 */
export function resolveBunSqliteDatabaseModule(
  requireFn: ((id: string) => unknown) | null | undefined = getRuntimeRequire(),
): { Database: typeof Database } {
  if (typeof requireFn !== 'function') {
    throw new StructuredDbError(
      DbErrorCode.CONNECTION_FAILED,
      'The database tools require the Bun runtime: bun:sqlite is only available under Bun. Run the CLI/agent with Bun (e.g. `bun run savant-code`) instead of Node.js.',
    )
  }
  try {
    return requireFn('bun:sqlite') as { Database: typeof Database }
  } catch (error) {
    throw new StructuredDbError(
      DbErrorCode.CONNECTION_FAILED,
      `The database tools require the Bun runtime: failed to load bun:sqlite (${
        error instanceof Error ? error.message : String(error)
      }). Run the CLI/agent with Bun instead of Node.js.`,
    )
  }
}

function getSqliteDatabaseCtor(): typeof Database {
  if (sqliteDatabaseCtor === undefined) {
    sqliteDatabaseCtor = resolveBunSqliteDatabaseModule().Database
  }
  return sqliteDatabaseCtor
}

// ============================================================================
// Connection resolution
// ============================================================================

/**
 * Resolve the connection target. Precedence: explicit `databaseUrl` param,
 * then SAVANT_CODE_DATABASE_URL, then DATABASE_URL. A missing target is a
 * connection failure (never silently defaults).
 */
export function resolveDatabaseUrl(databaseUrl: string | undefined): string {
  if (databaseUrl && databaseUrl.trim() !== '') return databaseUrl
  const envUrl =
    process.env.SAVANT_CODE_DATABASE_URL ?? process.env.DATABASE_URL
  if (envUrl && envUrl.trim() !== '') return envUrl
  throw new StructuredDbError(
    DbErrorCode.CONNECTION_FAILED,
    'No database connection configured. Pass databaseUrl, or set SAVANT_CODE_DATABASE_URL / DATABASE_URL.',
  )
}

/**
 * Coerce a raw bun:sqlite column value into a JSONValue. BLOB values arrive
 * as Uint8Array and integers can arrive as bigint — neither is JSONValue,
 * and blindly casting would surface at output validation/serialization.
 * BLOB → base64 text (portable); bigint → string.
 */
export function normalizeSqliteValue(value: unknown): JSONValue {
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  // Defensive catch-all: never let a non-JSON value escape the adapter.
  return String(value)
}

/** Map a raw SQLite row to a JSONValue record (BLOB/bigint coerced). */
export function normalizeSqliteRow(
  row: Record<string, unknown>,
): Record<string, JSONValue> {
  const out: Record<string, JSONValue> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = normalizeSqliteValue(value)
  }
  return out
}

/** Open a SQLite database (sync). ':memory:' or a file path. */
export function openSqliteDatabase(target: string): Database {
  try {
    const DatabaseCtor = getSqliteDatabaseCtor()
    return new DatabaseCtor(target)
  } catch (error) {
    throw new StructuredDbError(
      DbErrorCode.CONNECTION_FAILED,
      `Failed to open SQLite database: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { target: redactSql(target) },
    )
  }
}

/**
 * Enforce the write gate. Read-only by default; INSERT/UPDATE/DELETE require
 * allowWrite; DROP/TRUNCATE/ALTER/CREATE are always blocked in v1.
 */
export function enforceCanExecuteWrite(sql: string, allowWrite: boolean): void {
  const sqlType = classifySql(sql)

  if (sqlType === 'truncate' || sqlType === 'ddl') {
    throw new StructuredDbError(
      DbErrorCode.DESTRUCTIVE_DDL_BLOCKED,
      'Destructive DDL (DROP/TRUNCATE/ALTER/CREATE) is blocked in v1.',
      { sql_type: sqlType },
    )
  }

  if (isWriteOperation(sqlType) && !allowWrite) {
    throw new StructuredDbError(
      DbErrorCode.WRITE_MODE_REQUIRED,
      'Write statements require allowWrite: true AND explicit per-statement user approval.',
      { sql_type: sqlType, allow_write: allowWrite },
    )
  }

  if (sqlType === 'unknown') {
    throw new StructuredDbError(
      DbErrorCode.UNCLASSIFIED_SQL,
      'Could not classify the SQL statement. Only SELECT/SHOW/EXPLAIN/PRAGMA and explicitly approved writes are allowed.',
      { sql_type: sqlType },
    )
  }
}
