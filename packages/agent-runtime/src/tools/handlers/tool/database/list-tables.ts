import { jsonToolResult } from '@savant-code/common/util/messages'

import {
  openSqliteDatabase,
  resolveDatabaseUrl,
  StructuredDbError,
} from './sqlite-adapter'

import type { SavantCodeToolHandlerFunction } from '../../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * list_tables — schema introspection with the SQL ported from
 * googleapis/mcp-toolbox `internal/prebuiltconfigs/tools/sqlite.yaml`
 * (list_tables statement; Apache-2.0, FID-2026-0804-004 MQ-6). 'simple'
 * returns table names; 'detailed' returns the full schema (columns,
 * constraints, indexes, triggers) via pragma table-valued functions.
 */
export const handleListTables = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'list_tables'>
}): Promise<{
  output: SavantCodeToolOutput<'list_tables'>
}> => {
  const { previousToolCallFinished, toolCall } = params
  await previousToolCallFinished

  const { databaseUrl, outputFormat = 'simple' } = toolCall.input

  let db: ReturnType<typeof openSqliteDatabase> | null = null
  try {
    const target = resolveDatabaseUrl(databaseUrl)
    db = openSqliteDatabase(target)

    if (outputFormat === 'simple') {
      const rows = db
        .query(
          `SELECT name AS table_name, type AS object_type
           FROM sqlite_master
           WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all() as Array<{ table_name: string; object_type: string }>
      return {
        output: jsonToolResult({ result: { tables: rows } }),
      }
    }

    if (outputFormat !== 'detailed') {
      return {
        output: jsonToolResult({
          errorMessage: `Unsupported outputFormat: ${outputFormat}`,
          code: 'DB_INVALID_SQL',
        }),
      }
    }

    // 'detailed': full schema via the portable sqlite.yaml SQL.
    const rows = db
      .query(
        `WITH table_columns AS (
           SELECT
             m.name AS table_name,
             json_group_array(json_object('column_name', ti.name, 'data_type', ti.type, 'ordinal_position', ti.cid, 'is_not_nullable', ti."notnull" = 1, 'column_default', ti.dflt_value, 'is_primary_key', ti.pk > 0)) AS details
           FROM sqlite_master AS m, pragma_table_info(m.name) AS ti
           WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'
           GROUP BY m.name
         ),
         table_constraints AS (
           SELECT
             table_name,
             json_group_array(json(details)) AS details
           FROM (
             SELECT m.name AS table_name, json_object('constraint_name', 'PRIMARY', 'constraint_type', 'PRIMARY KEY', 'constraint_columns', json_group_array(T.name)) AS details
             FROM sqlite_master AS m, pragma_table_info(m.name) AS T
             WHERE m.type = 'table' AND T.pk > 0
             GROUP BY m.name
             HAVING COUNT(T.name) > 0
             UNION ALL
             SELECT m.name, json_object('constraint_name', 'fk_' || m.name || '_' || F.id, 'constraint_type', 'FOREIGN KEY', 'constraint_columns', json_group_array(F."from"), 'foreign_key_referenced_table', F."table", 'foreign_key_referenced_columns', json_group_array(F."to"))
             FROM sqlite_master AS m, pragma_foreign_key_list(m.name) AS F
             WHERE m.type = 'table'
             GROUP BY m.name, F.id
             UNION ALL
             SELECT m.name, json_object('constraint_name', I.name, 'constraint_type', 'UNIQUE', 'constraint_columns', (SELECT json_group_array(C.name) FROM pragma_index_info(I.name) AS C ORDER BY C.seqno))
             FROM sqlite_master AS m, pragma_index_list(m.name) AS I
             WHERE m.type = 'table' AND I."unique" = 1 AND I.origin != 'pk'
           )
           GROUP BY table_name
         ),
         table_indexes AS (
           SELECT
             m.name AS table_name,
             json_group_array(json_object('index_name', il.name, 'is_unique', il."unique" = 1, 'is_primary', il.origin = 'pk', 'index_columns', (SELECT json_group_array(ii.name) FROM pragma_index_info(il.name) AS ii))) AS details
           FROM sqlite_master AS m, pragma_index_list(m.name) AS il
           WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'
           GROUP BY m.name
         ),
         table_triggers AS (
           SELECT
             tbl_name AS table_name,
             json_group_array(json_object('trigger_name', name, 'trigger_definition', sql)) AS details
           FROM sqlite_master
           WHERE type = 'trigger'
           GROUP BY tbl_name
         )
         SELECT
           json_object(
             'schema_name', 'main',
             'object_name', m.name,
             'object_type', m.type,
             'columns', json(COALESCE(tc.details, '[]')),
             'constraints', json(COALESCE(tcons.details, '[]')),
             'indexes', json(COALESCE(ti.details, '[]')),
             'triggers', json(COALESCE(tt.details, '[]'))
           ) AS object_details
         FROM
           sqlite_master AS m
         LEFT JOIN table_columns tc ON m.name = tc.table_name
         LEFT JOIN table_constraints tcons ON m.name = tcons.table_name
         LEFT JOIN table_indexes ti ON m.name = ti.table_name
         LEFT JOIN table_triggers tt ON m.name = tt.table_name
         WHERE
           m.type = 'table'
           AND m.name NOT LIKE 'sqlite_%'
         ORDER BY m.name`,
      )
      .all() as Array<{ object_details: string }>

    const tables = rows.map((row) => {
      try {
        return JSON.parse(row.object_details) as JSONValue
      } catch {
        return row.object_details
      }
    })
    return { output: jsonToolResult({ result: { tables } }) }
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
  } finally {
    db?.close()
  }
}) satisfies SavantCodeToolHandlerFunction<'list_tables'>
