import { jsonToolResult } from '@savant-code/common/util/messages'

import {
  normalizeSqliteRow,
  openSqliteDatabase,
  resolveDatabaseUrl,
  StructuredDbError,
} from './sqlite-adapter'

import type { SavantCodeToolHandlerFunction } from '../../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/**
 * describe_table — single-table schema: columns (pragma_table_info), foreign
 * keys (pragma_foreign_key_list), indexes (pragma_index_list +
 * pragma_index_info), and triggers. Table name is bound as a parameter
 * (parameterized — never string-interpolated).
 */
export const handleDescribeTable = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'describe_table'>
}): Promise<{
  output: SavantCodeToolOutput<'describe_table'>
}> => {
  const { previousToolCallFinished, toolCall } = params
  await previousToolCallFinished

  const { databaseUrl, table } = toolCall.input

  try {
    const target = resolveDatabaseUrl(databaseUrl)
    const db = openSqliteDatabase(target)

    try {
      // Confirm the table exists (bound param, parameterized).
      const exists = db
        .query(
          `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?`,
        )
        .get(table) as { name: string } | null

      if (!exists) {
        return {
          output: jsonToolResult({
            errorMessage: `Table not found: ${table}`,
            code: 'DB_INVALID_SQL',
          }),
        }
      }

      const columns = (
        db
          .query(
            `SELECT cid, name, type, "notnull" AS not_null, dflt_value AS column_default, pk AS primary_key_position
           FROM pragma_table_info(?) ORDER BY cid`,
          )
          .all(table) as Array<Record<string, unknown>>
      ).map(normalizeSqliteRow)

      const foreignKeys = (
        db
          .query(
            `SELECT id, "seq", "table" AS referenced_table, "from" AS from_column, "to" AS to_column
           FROM pragma_foreign_key_list(?) ORDER BY id, "seq"`,
          )
          .all(table) as Array<Record<string, unknown>>
      ).map(normalizeSqliteRow)

      const indexes = db
        .query(
          `SELECT il.name AS index_name, il."unique" AS is_unique, il.origin,
                  (SELECT json_group_array(ii.name) FROM pragma_index_info(il.name) AS ii) AS index_columns
           FROM pragma_index_list(?) AS il ORDER BY il.seq`,
        )
        .all(table) as Array<{
        index_name: string
        is_unique: number
        origin: string
        index_columns: string | null
      }>

      const triggers = (
        db
          .query(
            `SELECT name AS trigger_name, sql AS trigger_definition
           FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? ORDER BY name`,
          )
          .all(table) as Array<Record<string, unknown>>
      ).map(normalizeSqliteRow)

      return {
        output: jsonToolResult({
          result: {
            table,
            columns,
            foreignKeys,
            indexes: indexes.map((idx) => {
              let indexColumns: string[] = []
              if (typeof idx.index_columns === 'string') {
                try {
                  indexColumns = JSON.parse(idx.index_columns) as string[]
                } catch {
                  indexColumns = []
                }
              }
              return {
                index_name: idx.index_name,
                is_unique: Boolean(idx.is_unique),
                origin: idx.origin,
                index_columns: indexColumns,
              }
            }),
            triggers,
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
    return {
      output: jsonToolResult({
        errorMessage: e.message,
        code: e.code,
      }),
    }
  }
}) satisfies SavantCodeToolHandlerFunction<'describe_table'>
