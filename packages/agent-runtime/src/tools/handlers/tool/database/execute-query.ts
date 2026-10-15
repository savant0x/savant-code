import { jsonToolResult } from '@savant-code/common/util/messages'

import {
  applyQueryLimits,
  classifySql,
  enforceCanExecuteWrite,
  MAX_ROW_LIMIT,
  normalizeSqliteRow,
  openSqliteDatabase,
  QUERY_TIMEOUT_MS,
  redactSql,
  resolveDatabaseUrl,
  StructuredDbError,
} from './sqlite-adapter'

import type { SavantCodeToolHandlerFunction } from '../../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * execute_query — adapter-enforced safety contract (FID-2026-0804-004):
 * classify → write gate (allowWrite + approval) → LIMIT injection → execute
 * with 30s wall-clock check → redacted telemetry. Write statements run via
 * prepared statement; SELECT via `.all()` with the LIMIT cap applied.
 */
export const handleExecuteQuery = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'execute_query'>
  logger: Logger
}): Promise<{
  output: SavantCodeToolOutput<'execute_query'>
}> => {
  const { previousToolCallFinished, toolCall, logger } = params
  await previousToolCallFinished

  const { databaseUrl, query, allowWrite = false } = toolCall.input

  try {
    // Gate 1: statement classification + write approval (deterministic code).
    enforceCanExecuteWrite(query, allowWrite)
    const sqlType = classifySql(query)

    // Gate 2: LIMIT injection for SELECT (row cap).
    const { sql: limitedSql, limited } = applyQueryLimits(query, MAX_ROW_LIMIT)

    const target = resolveDatabaseUrl(databaseUrl)
    const db = openSqliteDatabase(target)

    try {
      const start = Date.now()

      let columns: string[] = []
      let rows: Array<Record<string, JSONValue>> = []
      let changes = 0

      if (
        sqlType === 'insert' ||
        sqlType === 'update' ||
        sqlType === 'delete'
      ) {
        // Write: parameterless prepared statement; row cap not applicable.
        const stmt = db.prepare(limitedSql)
        const info = stmt.run()
        changes = info.changes
        columns = []
        rows = []
      } else {
        const stmt = db.prepare(limitedSql)
        const result = stmt.all() as Array<Record<string, unknown>>
        if (result.length > 0) {
          columns = Object.keys(result[0])
        }
        // Coerce BLOB (Uint8Array) / bigint values into JSONValue (FID-004).
        rows = result.map(normalizeSqliteRow)
      }

      const durationMs = Date.now() - start
      const timeoutExceeded = durationMs > QUERY_TIMEOUT_MS

      logger.info(
        {
          sql: redactSql(query),
          sqlType,
          limited,
          rowCount: rows.length,
          changes,
          durationMs,
          timeoutExceeded,
        },
        'execute_query completed',
      )

      return {
        output: jsonToolResult({
          result: {
            columns,
            rows,
            rowCount: rows.length,
            changes,
            durationMs,
            limited,
            truncated: timeoutExceeded,
          },
        }),
      }
    } finally {
      db.close()
    }
  } catch (error) {
    const e =
      error instanceof StructuredDbError
        ? error
        : new StructuredDbError(
            'DB_QUERY_EXECUTION_FAILED',
            error instanceof Error ? error.message : String(error),
          )
    logger.warn(
      { code: e.code, sql: redactSql(query), error: e.message },
      'execute_query rejected',
    )
    return {
      output: jsonToolResult({
        errorMessage: e.message,
        code: e.code,
      }),
    }
  }
}) satisfies SavantCodeToolHandlerFunction<'execute_query'>
