export const MAX_ROW_LIMIT = 1000
export const QUERY_TIMEOUT_MS = 30_000

/** Structured error codes (ported naming, DB_ prefix for TS space). */
export const DbErrorCode = {
  READONLY_VIOLATION: 'DB_READONLY_VIOLATION',
  WRITE_MODE_REQUIRED: 'DB_WRITE_MODE_REQUIRED',
  DESTRUCTIVE_DDL_BLOCKED: 'DB_DESTRUCTIVE_DDL_BLOCKED',
  QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  ROW_LIMIT_EXCEEDED: 'DB_ROW_LIMIT_EXCEEDED',
  INVALID_SQL: 'DB_INVALID_SQL',
  CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  QUERY_EXECUTION_FAILED: 'DB_QUERY_EXECUTION_FAILED',
  UNCLASSIFIED_SQL: 'DB_UNCLASSIFIED_SQL',
} as const

export type DbErrorCode = (typeof DbErrorCode)[keyof typeof DbErrorCode]

export class StructuredDbError extends Error {
  readonly code: DbErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: DbErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'StructuredDbError'
    this.code = code
    this.details = details
  }
}

// ============================================================================
// SQL classification (ported ClassifySQL)
// ============================================================================

export type SqlStatementType =
  | 'unknown'
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'ddl'
  | 'truncate'
  | 'explain'
  | 'show'
  | 'set'

/**
 * Classify a SQL statement by normalized prefix after stripping comments.
 * Ported from cockroachdb.go ClassifySQL.
 */
export function classifySql(sql: string): SqlStatementType {
  // Normalize: trim and uppercase for prefix analysis.
  let normalized = sql.trim().toUpperCase()

  if (normalized === '') return 'unknown'

  // Remove comments.
  normalized = normalized.replace(/--.*/g, '')
  normalized = normalized.replace(/\/\*.*?\*\//gs, '')
  normalized = normalized.trim()

  if (normalized.startsWith('SELECT')) return 'select'
  if (normalized.startsWith('INSERT')) return 'insert'
  if (normalized.startsWith('UPDATE')) return 'update'
  if (normalized.startsWith('DELETE')) return 'delete'
  if (normalized.startsWith('TRUNCATE')) return 'truncate'
  if (normalized.startsWith('CREATE')) return 'ddl'
  if (normalized.startsWith('ALTER')) return 'ddl'
  if (normalized.startsWith('DROP')) return 'ddl'
  if (normalized.startsWith('EXPLAIN')) return 'explain'
  if (normalized.startsWith('SHOW')) return 'show'
  if (normalized.startsWith('SET')) return 'set'
  return 'unknown'
}

const WRITE_TYPES: ReadonlySet<SqlStatementType> = new Set([
  'insert',
  'update',
  'delete',
  'truncate',
  'ddl',
])

export function isWriteOperation(sqlType: SqlStatementType): boolean {
  return WRITE_TYPES.has(sqlType)
}

// ============================================================================
// LIMIT injection (ported ApplyQueryLimits + stripSQLCommentsAndQuotedText)
// ============================================================================

const limitClauseRegexp = /\bLIMIT\b/i

/**
 * Strip SQL comments and quoted text, replacing them with whitespace so the
 * remaining text can be searched for structural keywords. Returns the
 * searchable text and whether a trailing line comment was present (which
 * forces a newline separator before appending LIMIT).
 * Ported from cockroachdb.go stripSQLCommentsAndQuotedText.
 */
export function stripSqlCommentsAndQuotedText(sql: string): {
  searchable: string
  trailingLineComment: boolean
} {
  let result = ''
  let trailingLineComment = false

  for (let i = 0; i < sql.length;) {
    const ch = sql[i]
    // -- line comment
    if (ch === '-' && sql[i + 1] === '-') {
      trailingLineComment = true
      while (i < sql.length && sql[i] !== '\n') {
        result += ' '
        i++
      }
      continue
    }
    // /* */ block comment (nested depth counted)
    if (ch === '/' && sql[i + 1] === '*') {
      let depth = 1
      result += '  '
      i += 2
      while (i < sql.length && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++
          result += '  '
          i += 2
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--
          result += '  '
          i += 2
        } else {
          result += ' '
          i++
        }
      }
      continue
    }
    // '...' or "..." quoted text (with '' / "" escaping and \ escapes)
    if (ch === "'" || ch === '"') {
      const quote = ch
      result += ' '
      i++
      while (i < sql.length) {
        result += ' '
        if (sql[i] === '\\' && i + 1 < sql.length) {
          result += ' '
          i += 2
          continue
        }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            result += ' '
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    // $tag$...$tag$ dollar-quoted
    if (ch === '$') {
      let end = i + 1
      while (
        end < sql.length &&
        (sql[end] === '_' ||
          (sql[end] >= 'a' && sql[end] <= 'z') ||
          (sql[end] >= 'A' && sql[end] <= 'Z') ||
          (end > i + 1 && sql[end] >= '0' && sql[end] <= '9'))
      ) {
        end++
      }
      if (end >= sql.length || sql[end] !== '$') {
        result += ch
        i++
        continue
      }
      const delimiter = sql.slice(i, end + 1)
      const closing = sql.indexOf(delimiter, end + 1)
      if (closing < 0) {
        result += ch
        i++
        continue
      }
      const quotedLength = end + 1 + closing + delimiter.length - i
      result += ' '.repeat(quotedLength)
      i += quotedLength
      continue
    }
    result += ch
    if (ch === '\n') trailingLineComment = false
    i++
  }

  return { searchable: result, trailingLineComment }
}

/**
 * Apply the row limit to a SELECT query: skip when a LIMIT clause already
 * exists (matching mcp-toolbox behavior), otherwise append `LIMIT n`.
 * Only SELECT queries are limited.
 * Ported from cockroachdb.go ApplyQueryLimits.
 */
export function applyQueryLimits(
  sql: string,
  maxRowLimit: number = MAX_ROW_LIMIT,
): { sql: string; limited: boolean } {
  const sqlType = classifySql(sql)
  if (sqlType !== 'select' || maxRowLimit <= 0) {
    return { sql, limited: false }
  }

  const { searchable, trailingLineComment } = stripSqlCommentsAndQuotedText(sql)
  if (limitClauseRegexp.test(searchable)) {
    return { sql, limited: false }
  }

  // Trim trailing whitespace/semicolon and append LIMIT.
  const trimmedSearchable = searchable.trimEnd()
  if (trimmedSearchable.endsWith(';')) {
    const semiColonIdx = trimmedSearchable.length - 1
    sql = sql.slice(0, semiColonIdx) + sql.slice(semiColonIdx + 1)
  }
  sql = sql.trim()
  const separator = trailingLineComment ? '\n' : ' '
  return { sql: `${sql}${separator}LIMIT ${maxRowLimit}`, limited: true }
}

// ============================================================================
// Telemetry redaction (ported RedactSQL)
// ============================================================================

/** Redact string literals and 10+ digit numbers from SQL for telemetry. */
export function redactSql(sql: string): string {
  return sql.replace(/'[^']*'/g, "'***'").replace(/\b\d{10,}\b/g, '***')
}
