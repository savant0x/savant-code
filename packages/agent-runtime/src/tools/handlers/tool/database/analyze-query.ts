import { jsonToolResult } from '@savant-code/common/util/messages'

import {
  classifySql,
  enforceCanExecuteWrite,
  normalizeSqliteRow,
  openSqliteDatabase,
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

/**
 * analyze_query — returns the SQLite query plan without executing the
 * statement. The analyzed statement still passes the write gate (read-only
 * enforcement), and the EXPLAIN wrapper is applied by the adapter so the
 * underlying statement never runs.
 */
export const handleAnalyzeQuery = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'analyze_query'>
  logger: Logger
}): Promise<{
  output: SavantCodeToolOutput<'analyze_query'>
}> => {
  const { previousToolCallFinished, toolCall, logger } = params
  await previousToolCallFinished

  const { databaseUrl, query } = toolCall.input

  try {
    // The analyzed statement must itself be a legal, non-destructive query
    // (read-only default; writes rejected even for planning).
    enforceCanExecuteWrite(query, false)
    const sqlType = classifySql(query)

    const target = resolveDatabaseUrl(databaseUrl)
    const db = openSqliteDatabase(target)

    try {
      const start = Date.now()
      const plan = (
        db.query(`EXPLAIN QUERY PLAN ${query}`).all() as Array<
          Record<string, unknown>
        >
      ).map(normalizeSqliteRow)
      const durationMs = Date.now() - start

      logger.info(
        { sql: redactSql(query), sqlType, planRows: plan.length, durationMs },
        'analyze_query completed',
      )

      return {
        output: jsonToolResult({ result: { plan, durationMs } }),
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
      'analyze_query rejected',
    )
    return {
      output: jsonToolResult({
        errorMessage: e.message,
        code: e.code,
      }),
    }
  }
}) satisfies SavantCodeToolHandlerFunction<'analyze_query'>
