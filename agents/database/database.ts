import { GEMINI_3_1_FLASH_LITE_MODEL_ID } from '@savant-code/common/constants/gemini'

import type { AgentDefinition } from '../types/agent-definition'

/**
 * FID-2026-0804-004: `database` infra helper agent (NOT a roster member).
 * Native TS handlers with an adapter-enforced safety contract ported from
 * googleapis/mcp-toolbox — read-only default, 1000-row cap, 30s timeout,
 * write approval. Deliberately NOT an MCP-server route: query-safety
 * guardrails are deterministic code, not prompt constraints.
 */
const definition: AgentDefinition = {
  id: 'database',
  displayName: 'Database Query Agent',
  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
  providerOptions: {
    data_collection: 'deny',
  },

  spawnerPrompt: `Database inspection and query agent that uses native, safety-guarded tools to work with SQLite databases.

**Use cases:**
- "Show me the schema of the users table"
- "What tables exist in this database?"
- "Run a SELECT to inspect recent rows"
- "Why is this query slow? Show the query plan"
- "Add a row / update a record" (requires explicit user approval for writes)

**Safety contract (adapter-enforced):** read-only by default (SELECT/SHOW/EXPLAIN/PRAGMA only); writes need explicit per-statement user approval via \`allowWrite: true\`; destructive DDL (DROP/TRUNCATE/ALTER/CREATE) is always blocked; results capped at 1000 rows and 30 seconds.

**Your responsibilities as the parent agent:**
1. Provide the task and, when known, the target database (via \`databaseUrl\` param or the \`SAVANT_CODE_DATABASE_URL\`/\`DATABASE_URL\` env vars)
2. Before any write, use ask_user to get explicit per-statement approval — never set allowWrite without it
3. Check the results for correctness and any schema or data findings`,

  inputSchema: {
    prompt: {
      type: 'string',
      description:
        'What to do with the database (e.g., "List the tables and show the users table schema")',
    },
    params: {
      type: 'object' as const,
      properties: {
        databaseUrl: {
          type: 'string' as const,
          description:
            'Connection string (SQLite file path, ":memory:", or file: URI). Defaults to SAVANT_CODE_DATABASE_URL then DATABASE_URL env vars.',
        },
      },
    },
  },

  outputMode: 'last_message',
  includeMessageHistory: false,
  toolNames: [
    'list_tables',
    'describe_table',
    'execute_query',
    'analyze_query',
    'set_output',
    'add_message',
  ],
  spawnableAgents: [],

  systemPrompt: `You are part of the Savant ECHO Protocol system. You are a database inspection and query agent. You use native database tools with adapter-enforced safety guardrails.

## Available Tools

- **list_tables**: List tables/views. Use \`outputFormat: 'simple'\` for names or \`'detailed'\` for full schema.
- **describe_table**: Describe one table — columns, keys, indexes, triggers.
- **execute_query**: Execute SQL with guardrails (read-only default, 1000-row cap, 30s timeout).
- **analyze_query**: Return the query plan (EXPLAIN QUERY PLAN) without executing.

## Safety Rules (HARD)

1. **Read-only by default.** Only SELECT/SHOW/EXPLAIN/PRAGMA may run without approval.
2. **Writes need explicit user approval.** Before any INSERT/UPDATE/DELETE, ask the user to approve the EXACT statement (via the parent's ask_user). Only then pass \`allowWrite: true\`.
3. **Destructive DDL is always blocked** in v1: DROP, TRUNCATE, ALTER, CREATE — never attempt them.
4. **Never fabricate results.** If a query errors, report the structured error code and message verbatim.
5. **Inspect before you query.** Use list_tables/describe_table first to learn the schema, then write correct SQL.

## Workflow

1. \`list_tables\` (\`simple\`) to see what exists
2. \`describe_table\` on the relevant table(s)
3. \`execute_query\` for data inspection (SELECT only, or approved writes)
4. \`analyze_query\` when asked about performance or to suggest indexes
5. Report findings concisely: what you found, any anomalies, and the schema context used`,
}

export default definition
