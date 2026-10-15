# FID-2026-0804-004: Multi-Database Query Agent

## Metadata

- **ID:** FID-2026-0804-004
- **Severity:** Medium
- **Status:** closed
- **Created:** 2026-08-04
- **Author:** Spencer + Nova
- **Master FID:** FID-2026-0804-006 (MCP Feature Integration Master Plan)
- **Perfection Loop:** COMPLETE — implemented and verified (2026-08-04); archived

## Problem Statement

Savant Code cannot interact with databases directly. Users must copy-paste schemas and query results manually, breaking
  the autonomous coding workflow.

## Proposed Solution

Implement a Database agent that provides controlled, schema-aware database interaction across multiple database engines.

### Core Capabilities

1. **Schema Inspection** — Read table structures, columns, types, relationships
2. **Query Execution** — Run SELECT queries with safety guardrails
~~**Migration Generation** — Generate database migrations from schema changes~~ **> SUPERSEDED by Loop 2:** cut to a
3.   separate future FID (schema-diff across DDL dialects is a large subsystem)
**Multi-DB Support** — PostgreSQL, MySQL, SQLite ~~Supabase~~ **> SUPERSEDED by Loop 2:** Supabase claim was
4.   unevidenced; dropped
5. **Query Optimization** — Analyze query plans and suggest indexes
6. **RLS Policy Management** — Generate and verify Row Level Security policies

### Architecture

~~New `Database` agent in the ECHO roster~~ **> SUPERSEDED by Loop 2:** `database` is an infra helper agent (NOT a

-   roster member)
Tools: `list_tables`, `describe_table`, `execute_query`, `analyze_query` ~~`generate_migration`~~ **> SUPERSEDED by
-   Loop 2:** cut to future FID
- Connection via connection string (stored in credentials.json)
- Read-only by default; write operations require explicit user approval
- Query timeout and row limits prevent runaway operations

### ECHO Integration

- Database agent follows Perfection Loop for schema changes
- FID tracks migration quality and query performance
- Verifier validates migrations against test data

## RED Phase Analysis

### Missed Questions & Answers

1. **SQL injection prevention** — How do we prevent malicious SQL?
**Answer:** Use parameterized queries only. Never interpolate user input into SQL strings. Validate query structure
   -   before execution. Reject queries with suspicious patterns.

2. **Connection pooling** — Should we maintain a connection pool?
**Answer:** Maintain connection pool with 5 connections max. Reuse connections across queries. Close pool on session
   -   end. Never leak connections.

3. **Transaction support** — Should the agent support transactions?
**Answer:** Support BEGIN/COMMIT/ROLLBACK. Auto-rollback on error. Never leave transactions open. Timeout after 30
   -   seconds.

4. **Schema drift detection** — If schema changes outside Savant Code?
**Answer:** Compare database schema against last known state. Flag differences. Never auto-reconcile without user
   -   approval.

5. **Migration rollback** — If a migration fails, can we roll back?
**Answer:** Generate rollback scripts alongside migrations. Test rollback before applying. Never apply without rollback
   -   plan.

6. **Data exposure** — Should the agent read sensitive data?
**Answer:** Read-only by default. Write operations require user approval. Mask sensitive columns (PII, financial)
   -   unless explicitly requested.

7. **Query cost estimation** — Can we estimate query cost?
**Answer:** Run EXPLAIN ANALYZE before expensive queries. Warn if cost exceeds threshold. Never execute runaway queries.

8. **Multi-tenant isolation** — If connecting to a shared database?
**Answer:** Validate tenant ID before query execution. Never cross tenant boundaries. Log all cross-tenant attempts.

9. **Backup before write** — Should we backup before write operations?
   - **Answer:** Create backup before destructive operations. Store backup for 24 hours. Never delete without backup.

10. **Audit logging** — Should all database operations be logged?
**Answer:** Every database operation logged to FID. Query text, execution time, row count documented. Migration history
    -   tracked.

### Existing Code Analysis

- No existing database integration in Savant Code
- PostgreSQL mentioned in gateway research (ClickHouse for telemetry)
- Supabase mentioned as potential provider

### Call-Graph Reachability

- Database agent would be spawned by Orchestrator via `spawn_agents`
- Triggered by user request: "show me the schema" or "optimize this query"

## GREEN Phase (Pending)

### Proposed Solution Updates

(To be filled during GREEN phase implementation)

## AUDIT Phase (Pending)

- [ ] Verify SQL injection prevention with malicious input
- [ ] Test connection pooling under load
- [ ] Validate transaction support with mock failures
- [ ] Test schema drift detection with schema changes
- [ ] Confirm backup before write with destructive operations

## Acceptance Criteria

- [ ] Database agent can connect to PostgreSQL, MySQL, SQLite
- [ ] Schema inspection with column types, indexes, relationships
- [ ] Safe query execution with timeout and row limits
- [ ] ~~Migration generation from code changes~~ **> SUPERSEDED by Loop 2:** cut to future FID
- [ ] Query plan analysis for performance optimization
- [ ] Write operations require user approval
- [ ] SQL injection prevention
[ ] ~~Connection pooling~~ **> SUPERSEDED by Loop 2:** pooling applies only to Postgres/MySQL drivers (bun:sqlite is
-   file-based)
- [ ] Transaction support with rollback (Postgres/MySQL only)
- [ ] ~~Schema drift detection~~ **> SUPERSEDED by Loop 2:** cut to future FID
- [ ] ~~Backup before write~~ **> SUPERSEDED by Loop 2:** cut to future FID
- [ ] Audit logging for all operations
- [ ] All operations governed by ECHO Protocol

## Perfection Loop Re-Run (Loop 2 — Independent Savant Code Review)

### RED (Ground-Truth Verification)

Every claim re-verified against the working tree. Evidence:

**✗ "No existing database integration in Savant Code" is FALSE.** `packages/database/` is a full persistence layer

-   (bun:sqlite) — `sessions`, `agent_templates`, `fid_documents`, `message_history`, `cost_tracking` — consumed by
-   `cli/src/utils/db-storage.ts`; `packages/database/src/service.ts` exposes typed CRUD with prepared-statement
-   memoization. `sdk/src/impl/database.ts` is the SavantCode backend API client (agent runs, user info).
-   `common/README.md` cites analytics/billing/Postgres adapters.
**The REAL gap is valid:** no interactive querying of USER databases (schema inspection, safe SELECT execution against
-   a connection string) exists anywhere. The FID's problem statement must be corrected to say this.
**✗ "Supabase mentioned as potential provider" is unevidenced** — no Supabase mention found in the working tree. Either
-   cite the source doc or drop the claim.
**✗ Roster conflict:** "New Database agent in the ECHO roster" contradicts the 9-canonical + 4-helper boundary
-   (`ARCHITECTURE.md:214-236`, FID-2026-0803-013).

Additional gaps:

**GAP-1 (credential sensitivity):** Connection strings embed username+password and are MORE sensitive than PATs. The

-   plaintext-`0600` `credentials.json` pattern is the floor; v1 must at minimum warn the user and support env-var
-   connection strings (`DATABASE_URL`-style) without persisting.
**GAP-2 (engine-specific SQL semantics):** Placeholders differ (`$1` vs `?`); plan analysis differs (`EXPLAIN ANALYZE`
-   Postgres / `EXPLAIN` MySQL / `EXPLAIN QUERY PLAN` SQLite). A universal "EXPLAIN ANALYZE" contract is
-   unimplementable — per-engine adapters behind a common interface are required.
**GAP-3 (safety boundary):** read-only + write-approval must be enforced at the ADAPTER boundary (statement allowlist:
-   `SELECT`/`EXPLAIN` only unless write mode + explicit per-statement user approval), not just in the agent prompt.
- **GAP-4 (row caps):** engines without native caps need `LIMIT n` injection (default 1,000 rows) at the adapter layer.
**GAP-5 (pooling):** bun:sqlite is file-based (no pool needed); pooling (max 5) applies only to Postgres/MySQL drivers.
-   The FID's blanket pooling needs the engine split.
**GAP-6 (scope creep):** migration generation + RLS + backup are a large subsystem (schema-diff across DDL dialects).
-   Cut to a separate FID; this FID = schema inspection + safe queries only.
**GAP-7 (PII masking):** implement as column-name heuristics (`email`, `ssn`, `phone`, `card`, `password`) + explicit
-   user opt-in to reveal; never a silent default.

### GREEN (Converged Solution)

**Scope:** Add a `database` **infra helper agent** (NOT a roster member) with NATIVE tool handlers — deliberately NOT

-   an MCP-server route, because query-safety guardrails (parameterization, row caps, write approval) are deterministic
-   code, not prompt constraints. Helpers go 4 → 5 (basher, tmux-cli, browser-use, context-pruner, database); roster
-   stays 9 canonical.
**Tools:** `list_tables`, `describe_table`, `execute_query`, `analyze_query` — wired through `agents/types/tools.ts`
-   (`ToolName` + `ToolParamsMap`), zod schema at `common/src/tools/params/tool/database.ts`, handlers at
-   `packages/agent-runtime/src/tools/handlers/database/` + registry entry, param mapping in `tool-executor.ts`, signal
-   in `activity-tracking.ts`.
**Engines:** SQLite first via `bun:sqlite` (zero new deps, already in the tree). PostgreSQL and MySQL drivers are
-   PROPOSALS (`postgres.js`/`pg`, `mysql2`) subject to the dependency audit gate (bun compatibility, licenses per
-   FID-006 Q5, size budget per Q2) — the exact driver is decided at implementation, not committed here.
**Safety contract (adapter-enforced):** parameterized queries only (never string-interpolate user input); read-only
-   default; 1,000-row cap; 30s timeout; write mode requires explicit per-statement user approval;
-   `DROP`/`TRUNCATE`/destructive DDL blocked in v1.
**Auth:** connection string from env var (preferred, never logged — Law 12) or `credentials.json` (0600) with an
-   explicit warning. Encryption is deferred to the shared credential-encryption FID (see FID-003 Loop 2).
**Non-goals (cut to future FIDs):** migration generation, RLS policy management, backup/restore, multi-tenant isolation
-   logic.
**Testing:** unit tests on `:memory:` SQLite + mock drivers; SQL-injection attack corpus (tried via param values and
-   via string fragments — must all fail safe); timeout/row-cap tests; call-graph gate: `database` ∈ `spawnableAgents`.

### AUDIT (Double Audit)

**Method 1 (static):** `cli` + `packages/database` + `packages/agent-runtime` typechecks and ESLint 0-warnings at

-   implementation, per `protocol.config.yaml`.
**Method 2 (call-graph):** grep `'database'` in `agents/savant/savant.ts` spawnableAgents + `free-agents.ts` +
-   `ARCHITECTURE.md` helper table. Zero callers today (no implementation) = correctly NOT wired; acceptance gate is
-   reachability from the Orchestrator spawn list.
**Verdict:** Loop converged. Problem statement corrected (persistence exists; interactive user-DB querying does not).
-   RED citations spot-verified against the working tree during Loop 2 (evidence above). Ready for implementation after
-   approval.

## Perfection Loop Re-Run (Loop 3 — Reference-Grounded Retrofit)

**Operator directive (2026-08-04):** the reference repos are IDEA sources. `resources/mcp/mcp-toolbox-main/` (Google,
  Apache-2.0) is a production MCP server for databases whose source implements the EXACT safety contract this FID's
  Loop-2 GREEN described — the adapter-level algorithm is now evidenced and portable to TS native handlers.

### RED (Missed Questions Asked & Answered)

Reference evidence: `internal/sources/cockroachdb/cockroachdb.go` (`newConfig` read-only defaults, `CanExecuteWrite`,
  `ClassifySQL`, `ApplyQueryLimits`, `RedactSQL`, `StructuredError` codes, `limitClauseRegexp`,
  `stripSQLCommentsAndQuotedText`), `internal/sources/postgres/postgres.go` (`pgxpool` connection pool,
  `BuildPostgresURL`, `connectTimeout`), `internal/prebuiltconfigs/tools/sqlite.yaml` (copyable `list_tables`
  introspection SQL), `internal/prebuiltconfigs/tools/postgres.yaml`/`mysql.yaml` (prebuilt tool surface).

| # | Missed question | Answer (most robust default) |
|---|---|---|
| MQ-1 | Does the reference validate native-handlers over MCP? | mcp-toolbox proves the safety contract belongs in the ADAPTER layer (deterministic code in `Source.Query()`), but it is a Go server + tools.yaml config. FID-004's native TS handlers stand — we PORT the semantics, not the server (Law 11/13; no Go toolchain). |
| MQ-2 | What is the exact LIMIT-injection algorithm (GAP-4)? | Port `ApplyQueryLimits` (`cockroachdb.go:394-418`): SELECT-only; regex `\bLIMIT\b` on comment/quoted-text-stripped SQL; skip if already present; strip trailing semicolon; append `LIMIT n`; `MaxRowLimit=1000` default. Includes `stripSQLCommentsAndQuotedText` (handles `--`, `/* */`, quotes, `$...$` dollar-quoted). |
| MQ-3 | How is the read-only/write gate classified? | Port `ClassifySQL` (prefix-match after comment-strip: SELECT/INSERT/UPDATE/DELETE/TRUNCATE/DDL/EXPLAIN/SHOW/SET) + `IsWriteOperation` + `CanExecuteWrite` — enforced in the adapter (`Source.Query`), not the prompt. `ReadOnlyMode: true` default, `EnableWriteMode` explicit opt-in (GAP-3 resolved with exact algorithm). |
| MQ-4 | What error contract should the tool return? | `StructuredError {code, message, details}` with codes (`CRDB_READONLY_VIOLATION`, `CRDB_ROW_LIMIT_EXCEEDED`, `CRDB_WRITE_MODE_REQUIRED`, etc.) — actionable for the harness model. Adopt the code pattern in TS. |
| MQ-5 | What are the validated defaults? | `MaxRowLimit: 1000`, `QueryTimeoutSec: 30` (cockroachdb.go `newConfig` defaults, labeled "MCP compliance") — confirms FID-004's proposed numbers. |
| MQ-6 | Is there copyable SQLite introspection SQL? | YES — `sqlite.yaml` `list_tables` statement: full schema introspection (`sqlite_master` + `pragma_table_info`/`pragma_foreign_key_list`/`pragma_index_list` JSON aggregates) directly portable to bun:sqlite. This IS the FID's `list_tables`/`describe_table` implementation. |
| MQ-7 | Pooling (GAP-5) validated? | `postgres.go` uses `pgxpool` with `connectTimeout`; sqlite.go uses plain `database/sql` (no pool). Confirms: pool PG/MySQL only (max 5), bun:sqlite no pool. |
| MQ-8 | Connection-string handling (GAP-1)? | Reference uses structured config (host/port/user/password/db). Keep FID's env-var-first preference (never logged, Law 12) + credentials.json (0600) fallback with warning. |
| MQ-9 | Telemetry redaction (Law 12)? | Port `RedactSQL` (redacts string literals + 10+ digit numbers) for any logged query text — audit log carries redacted SQL + row count + duration. |
| MQ-10 | Toolbox as an MCP alternative? | Rejected for v1 (Go binary + tools.yaml + extra auth surface). Note as future option if 20+ engine coverage is ever needed (it supports postgres/mysql/sqlite/mongodb/clickhouse/...). |

### GREEN (Converged Retrofit)

- **Scope (unchanged):** `database` infra helper (NOT roster member), native TS handlers; helpers 4 → 5.
**Engine:** SQLite first via bun:sqlite (in-tree). PG/MySQL drivers remain PROPOSALS (`postgres.js`/`pg`, `mysql2`)
-   subject to the dependency audit gate (FID-006 Q5/Q2).
**Safety contract (now with exact reference algorithms to port):** `ClassifySQL` + `CanExecuteWrite` (read-only
-   default, write opt-in + per-statement approval) + `ApplyQueryLimits` (1000-row cap, existing-LIMIT skip) + 30s
-   timeout + `StructuredError` codes + `RedactSQL` telemetry. All enforced at the ADAPTER boundary in
-   `execute_query`/`analyze_query` handlers — never prompt-only.
**Introspection:** `list_tables`/`describe_table` implemented with the portable `sqlite.yaml` SQL (columns, PK/FK
-   constraints, indexes, triggers via pragma functions) — zero new deps.
**Auth:** connection string from env var (preferred, never logged) or `credentials.json` (0600) with explicit warning;
-   encryption deferred to the shared credential-encryption FID (FID-003 Loop 2).
- **Non-goals (unchanged):** migrations, RLS, backup/restore, multi-tenant isolation — future FIDs.
**Testing:** unit tests on `:memory:` SQLite + mock drivers; SQL-injection attack corpus; LIMIT-injection edge cases
-   (multiline, existing LIMIT, trailing comments — port `security_test.go` cases); timeout/row-cap tests; call-graph
-   gate: `database` ∈ `spawnableAgents`.

### AUDIT (Double Audit)

**Method 1 (static):** mcp-toolbox source read 0-EOF (`cockroachdb.go` full safety contract, `postgres.go` pooling,

-   `sqlite.yaml` introspection SQL); defaults verified (1000 rows / 30s / read-only). All algorithms confirmed
-   portable to TS with zod v4 + bun:sqlite.
**Method 2 (call-graph):** `database` zero production callers today (correctly NOT wired); acceptance gate = `database`
-   ∈ `agents/savant/savant.ts` spawnableAgents + `free-agents.ts` + `ARCHITECTURE.md` helper table.
**Verdict:** Loop converged. The Loop-2 GREEN's safety contract is now a fully-evidenced port specification (reference
-   file:line citations above). Ready for implementation after approval.

## Implementation (2026-08-04 — FID closed after verification)

**Delivered:** `database` infra helper agent (NOT a roster member) with four native tools whose
safety contract is adapter-enforced deterministic code (never prompt constraints), ported as ideas
from googleapis/mcp-toolbox.

- `common/src/tools/params/tool/database.ts` — zod v4 schemas for `list_tables`, `describe_table`,
  `execute_query`, `analyze_query` (shared `databaseUrl` param: explicit > `SAVANT_CODE_DATABASE_URL`
  > `DATABASE_URL`).
- `packages/agent-runtime/src/tools/handlers/tool/database/` — `sqlite-adapter.ts` (ported
  `ClassifySQL`, `ApplyQueryLimits` + comment/quote stripping, `RedactSQL`, `CanExecuteWrite`,
  structured error codes DB_*) + 4 handlers. SQLite first via `bun:sqlite` (zero new deps);
  PostgreSQL/MySQL drivers remain audited future work. Read-only default; writes need `allowWrite:
  true` + explicit approval; destructive DDL always blocked; 1000-row LIMIT injection; 30s timeout
  contract.
- Wiring: registry (`handlers/list.ts`), `constants.ts`/`list.ts`/`safety-registry.ts` (execute_query
  = mixed/prompt; others read/allow), `activity-tracking.ts`, `agents/database/database.ts`,
  `savant.ts` spawnableAgents + system prompt, `free-agents.ts` + test, bundled-agents regenerated.
- **Verification:** `sqlite-adapter.test.ts` 40 tests — 12 handler integration tests against a seeded
  temp-file DB + 28 adapter/safety tests incl. an 8-entry SQL-injection corpus (LIMIT never lands in
  quoted text; redaction hides single-quoted payloads; non-SELECT statements never LIMIT-ed) and
  BLOB/bigint → JSONValue coercion tests (BLOB arrives as base64 text, never a raw Uint8Array);
  agent-runtime suite 630 pass / 0 fail; typecheck ×5 + full ESLint 0/0 green. Call-graph: `database`
  ∈ `savant.ts` spawnableAgents + `free-agents.ts` + `ARCHITECTURE.md` helper table; 4 toolNames ∈
  handler registry (Law 4).

## FID History

- 2026-08-04: Created (Spencer + Nova)
- 2026-08-04: RED phase complete — 10 missed questions identified and answered
2026-08-04: Loop 2 (Savant) — ground-truth verification: "no database integration" claim corrected, unevidenced
-   Supabase claim flagged, GAP-1..7 cataloged, GREEN converged on `database` infra helper with native handlers +
-   adapter-enforced safety contract, scope cut (migrations/RLS/backup out), AUDIT passed. Awaiting approval.
2026-08-04: Loop 3 (Savant) — reference-grounded retrofit: mcp-toolbox read 0-EOF; safety contract now an exact port
-   spec (ClassifySQL/CanExecuteWrite/ApplyQueryLimits/StructuredError/RedactSQL + copyable SQLite introspection SQL),
-   defaults validated (1000/30s/read-only), pooling + GAP-4 resolved with reference algorithms. AUDIT passed. Awaiting
-   approval.
