// sqlite-adapter test family — handler integration against the seeded
// temp-file database. Sibling of the Loop 349 decomposition (shared fixtures
// in ./sqlite-adapter-test-harness).
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'

import { handleAnalyzeQuery } from '../analyze-query'
import { handleDescribeTable } from '../describe-table'
import { handleExecuteQuery } from '../execute-query'
import { handleListTables } from '../list-tables'
import { DbErrorCode } from '../sqlite-adapter'
import {
  DB_PATH,
  makeToolCall,
  registerSeededDbLifecycle,
} from './sqlite-adapter-test-harness'

registerSeededDbLifecycle()

// ============================================================================
// Handlers (integration against :memory: SQLite)
// ============================================================================

describe('database handlers', () => {
  test('list_tables simple returns table names', async () => {
    const res = await handleListTables(
      makeToolCall({ databaseUrl: DB_PATH, outputFormat: 'simple' }),
    )
    const value = res.output[0].value as { result: { tables: unknown[] } }
    const names = (value.result.tables as Array<{ table_name: string }>).map(
      (t) => t.table_name,
    )
    expect(names).toContain('users')
    expect(names).toContain('posts')
    expect(names).not.toContain('sqlite_sequence')
  })

  test('list_tables detailed returns schema rows', async () => {
    const res = await handleListTables(
      makeToolCall({ databaseUrl: DB_PATH, outputFormat: 'detailed' }),
    )
    const value = res.output[0].value as { result: { tables: unknown[] } }
    expect(Array.isArray(value.result.tables)).toBe(true)
    expect(value.result.tables.length).toBeGreaterThanOrEqual(2)
  })

  test('describe_table returns columns, fks, indexes, triggers', async () => {
    const res = await handleDescribeTable(
      makeToolCall({ databaseUrl: DB_PATH, table: 'users' }),
    )
    const value = res.output[0].value as {
      result: {
        columns: Array<{ name: string }>
        foreignKeys: unknown[]
        indexes: unknown[]
        triggers: unknown[]
      }
    }
    expect(value.result.columns.map((c) => c.name)).toEqual([
      'id',
      'email',
      'name',
      'created_at',
    ])
    expect(Array.isArray(value.result.foreignKeys)).toBe(true)
    expect(Array.isArray(value.result.indexes)).toBe(true)
  })

  test('describe_table errors on missing table', async () => {
    const res = await handleDescribeTable(
      makeToolCall({ databaseUrl: DB_PATH, table: 'nope' }),
    )
    const value = res.output[0].value as { errorMessage: string }
    expect(value.errorMessage).toContain('Table not found')
  })

  test('execute_query SELECT returns rows and columns', async () => {
    const res = await handleExecuteQuery(
      makeToolCall({
        databaseUrl: DB_PATH,
        query: 'SELECT id, email FROM users ORDER BY id',
      }),
    )
    const value = res.output[0].value as {
      result: { columns: string[]; rows: unknown[]; rowCount: number }
    }
    expect(value.result.columns).toEqual(['id', 'email'])
    expect(value.result.rowCount).toBe(2)
  })

  test('execute_query injects LIMIT into SELECT without one', async () => {
    const res = await handleExecuteQuery(
      makeToolCall({ databaseUrl: DB_PATH, query: 'SELECT * FROM users' }),
    )
    const value = res.output[0].value as {
      result: { rowCount: number; limited: boolean }
    }
    expect(value.result.limited).toBe(true)
    expect(value.result.rowCount).toBe(2)
  })

  test('execute_query rejects writes without approval', async () => {
    const res = await handleExecuteQuery(
      makeToolCall({
        databaseUrl: DB_PATH,
        query: 'DELETE FROM users',
        allowWrite: false,
      }),
    )
    const value = res.output[0].value as { errorMessage: string; code: string }
    expect(value.code).toBe(DbErrorCode.WRITE_MODE_REQUIRED)
  })

  test('execute_query rejects destructive DDL even with approval', async () => {
    const res = await handleExecuteQuery(
      makeToolCall({
        databaseUrl: DB_PATH,
        query: 'DROP TABLE users',
        allowWrite: true,
      }),
    )
    const value = res.output[0].value as { errorMessage: string; code: string }
    expect(value.code).toBe(DbErrorCode.DESTRUCTIVE_DDL_BLOCKED)
  })

  test('execute_query coerces BLOB columns to base64 (JSON-safe rows)', async () => {
    // Seed a blob-bearing table on the shared temp-file DB.
    const db = new Database(DB_PATH)
    db.exec(
      `CREATE TABLE IF NOT EXISTS blobs (id INTEGER PRIMARY KEY, payload BLOB);
       INSERT INTO blobs (id, payload) VALUES (1, x'DEADBEEF');`,
    )
    db.close()

    const res = await handleExecuteQuery(
      makeToolCall({
        databaseUrl: DB_PATH,
        query: 'SELECT id, payload FROM blobs',
      }),
    )
    const value = res.output[0].value as {
      result: { rows: Array<{ id: number; payload: unknown }> }
    }
    expect(value.result.rows[0].id).toBe(1)
    // BLOB must arrive as base64 text — never a raw Uint8Array.
    expect(value.result.rows[0].payload).toBe('3q2+7w==')
    expect(typeof value.result.rows[0].payload).toBe('string')

    // JSON round-trip proves the payload is serializable.
    expect(() => JSON.stringify(value)).not.toThrow()
  })

  test('execute_query allows an approved write', async () => {
    const res = await handleExecuteQuery(
      makeToolCall({
        databaseUrl: DB_PATH,
        query:
          "INSERT INTO users (id, email, name) VALUES (3, 'c@example.com', 'Carol')",
        allowWrite: true,
      }),
    )
    const value = res.output[0].value as {
      result: { changes: number; rowCount: number }
    }
    expect(value.result.changes).toBe(1)

    // Verify via a SELECT.
    const check = await handleExecuteQuery(
      makeToolCall({
        databaseUrl: DB_PATH,
        query: 'SELECT email FROM users WHERE id = 3',
      }),
    )
    const checkValue = check.output[0].value as {
      result: { rows: Array<{ email: string }> }
    }
    expect(checkValue.result.rows[0].email).toBe('c@example.com')
  })

  test('execute_query errors on invalid SQL', async () => {
    const res = await handleExecuteQuery(
      makeToolCall({ databaseUrl: DB_PATH, query: 'SELECT FROM WHERE' }),
    )
    const value = res.output[0].value as { errorMessage: string; code: string }
    expect(value.errorMessage).toBeTruthy()
  })

  test('analyze_query returns a query plan', async () => {
    const res = await handleAnalyzeQuery(
      makeToolCall({ databaseUrl: DB_PATH, query: 'SELECT * FROM users' }),
    )
    const value = res.output[0].value as { result: { plan: unknown[] } }
    expect(Array.isArray(value.result.plan)).toBe(true)
    expect(value.result.plan.length).toBeGreaterThan(0)
  })

  test('analyze_query rejects writes', async () => {
    const res = await handleAnalyzeQuery(
      makeToolCall({ databaseUrl: DB_PATH, query: 'DELETE FROM users' }),
    )
    const value = res.output[0].value as { errorMessage: string; code: string }
    expect(value.code).toBe(DbErrorCode.WRITE_MODE_REQUIRED)
  })
})
