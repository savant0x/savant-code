import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

/**
 * Shared connection-string parameter. Precedence: explicit `databaseUrl`
 * param > `SAVANT_CODE_DATABASE_URL` env > `DATABASE_URL` env. Never logged
 * (Law 12) — the handler redacts connection details from any error/telemetry.
 */
const databaseUrlParam = z
  .string()
  .min(1)
  .optional()
  .describe(
    `Connection string for the target database (SQLite file path, \`:memory:\`, or \`file:...?...\` URI). When omitted, the handler falls back to the \`SAVANT_CODE_DATABASE_URL\` then \`DATABASE_URL\` environment variables.`,
  )

const listTablesInputSchema = z
  .object({
    databaseUrl: databaseUrlParam,
    outputFormat: z
      .enum(['simple', 'detailed'])
      .optional()
      .default('simple')
      .describe(
        `'simple' returns table names only; 'detailed' returns full schema (columns, constraints, indexes, triggers) for every user table. Default 'simple'.`,
      ),
  })
  .describe(`List the tables (and views) in the connected database.`)

const describeTableInputSchema = z
  .object({
    databaseUrl: databaseUrlParam,
    table: z
      .string()
      .min(1)
      .describe(
        `The table name to describe. Columns, primary/foreign keys, indexes, and triggers are returned.`,
      ),
  })
  .describe(
    `Describe a single table: columns with types/nullability/defaults, key constraints, indexes, and triggers.`,
  )

const executeQueryInputSchema = z
  .object({
    databaseUrl: databaseUrlParam,
    query: z
      .string()
      .min(1)
      .describe(
        `The SQL statement to execute. Read-only by default: SELECT/SHOW/EXPLAIN/PRAGMA only. Write statements (INSERT/UPDATE/DELETE) require \`allowWrite: true\` AND explicit user approval. Destructive DDL (DROP/TRUNCATE/ALTER/CREATE) is always blocked in v1. Results are capped at 1000 rows and 30 seconds.`,
      ),
    allowWrite: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        `Set to true ONLY when the user explicitly approved this exact write statement. Without it, write statements are rejected with a read-only violation.`,
      ),
  })
  .describe(
    `Execute a parameterized-safe SQL query with adapter-enforced guardrails: read-only default, 1000-row cap, 30s timeout, and write approval.`,
  )

const analyzeQueryInputSchema = z
  .object({
    databaseUrl: databaseUrlParam,
    query: z
      .string()
      .min(1)
      .describe(
        `The SQL statement to analyze. The handler returns the query plan (SQLite \`EXPLAIN QUERY PLAN\`).`,
      ),
  })
  .describe(
    `Return the query plan for a SQL statement so the model can suggest indexes or rewrites. Read-only; never executes the statement.`,
  )

const dbToolOutputSchema = jsonToolResultSchema(
  z.union([
    z.object({
      result: z.json(),
    }),
    z.object({
      errorMessage: z.string(),
      code: z.string().optional(),
    }),
  ]),
)

export const listTablesParams = {
  toolName: 'list_tables',
  endsAgentStep: true,
  description: `
Purpose: List the user-accessible tables (and views) in the connected SQLite database. Use this first to understand the schema before writing any query.

Use cases:
- Discover what tables exist before inspecting a specific table
- Orient a model new to the database (schema preview)
- Verify a migration or import produced the expected tables

The connection is resolved from \`databaseUrl\`, \`SAVANT_CODE_DATABASE_URL\`, or \`DATABASE_URL\` (in that order). Read-only; never modifies the database.

Example:
${$getNativeToolCallExampleString({
  toolName: 'list_tables',
  inputSchema: listTablesInputSchema,
  input: { outputFormat: 'simple' },
  endsAgentStep: true,
})}

${$getNativeToolCallExampleString({
  toolName: 'list_tables',
  inputSchema: listTablesInputSchema,
  input: { outputFormat: 'detailed' },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: listTablesInputSchema,
  outputSchema: dbToolOutputSchema,
} satisfies $ToolParams<'list_tables'>

export const describeTableParams = {
  toolName: 'describe_table',
  endsAgentStep: true,
  description: `
Purpose: Describe a single table's full schema — columns (name/type/nullable/default), primary and foreign keys, unique constraints, indexes, and triggers. This is the table-level counterpart of list_tables.

Use cases:
- Understand a table's shape before writing a query against it
- Check nullability and defaults before INSERT/UPDATE
- Locate indexes before suggesting query optimizations

Example:
${$getNativeToolCallExampleString({
  toolName: 'describe_table',
  inputSchema: describeTableInputSchema,
  input: { table: 'users' },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: describeTableInputSchema,
  outputSchema: dbToolOutputSchema,
} satisfies $ToolParams<'describe_table'>

export const executeQueryParams = {
  toolName: 'execute_query',
  endsAgentStep: true,
  description: `
Purpose: Execute a SQL query with adapter-enforced safety guardrails — the safety contract lives in the handler, never just the prompt (FID-2026-0804-004, ported from googleapis/mcp-toolbox cockroachdb.go):

- Read-only default: SELECT/SHOW/EXPLAIN/PRAGMA only
- Write statements (INSERT/UPDATE/DELETE) require \`allowWrite: true\` AND explicit per-statement user approval
- Destructive DDL (DROP/TRUNCATE/ALTER/CREATE) always blocked in v1
- Result cap: 1000 rows (LIMIT injected when absent)
- Timeout: 30 seconds
- Telemetry: query text is redacted (string literals + long numbers) before logging

Use cases:
- Inspect data with SELECT queries
- Aggregate/report on existing tables
- (with approval) small, explicit INSERT/UPDATE/DELETE

Example:
${$getNativeToolCallExampleString({
  toolName: 'execute_query',
  inputSchema: executeQueryInputSchema,
  input: { query: 'SELECT * FROM users WHERE email = ?', allowWrite: false },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: executeQueryInputSchema,
  outputSchema: dbToolOutputSchema,
} satisfies $ToolParams<'execute_query'>

export const analyzeQueryParams = {
  toolName: 'analyze_query',
  endsAgentStep: true,
  description: `
Purpose: Return the query plan for a SQL statement (SQLite \`EXPLAIN QUERY PLAN\`) without executing it. Use this to suggest indexes, verify a query uses existing indexes, or diagnose slow queries.

Use cases:
- Check whether a query uses an index (or does a full table scan)
- Validate that a suggested index would help before creating it
- Diagnose why a query is slow

Example:
${$getNativeToolCallExampleString({
  toolName: 'analyze_query',
  inputSchema: analyzeQueryInputSchema,
  input: { query: 'SELECT * FROM users WHERE email = ?' },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: analyzeQueryInputSchema,
  outputSchema: dbToolOutputSchema,
} satisfies $ToolParams<'analyze_query'>
