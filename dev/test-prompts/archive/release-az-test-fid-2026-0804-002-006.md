<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->
# Current Release A–Z Audit — Savant-Code v0.0.19 (MCP Feature Integration)

**Version:** v0.0.19
**FIDs:** FID-2026-0804-002 (deep research), FID-2026-0804-003 (github),
FID-2026-0804-004 (multi-database), FID-2026-0804-005 (browser-use),
FID-2026-0804-006 (master plan) — all closed + Nova-signed-off + archived
**Purpose:** Fresh end-to-end evidence for the MCP Feature Integration master
plan. Tests the 4 delivered surfaces (deep_research tool, github infra helper,
database infra helper, browser-use params) plus the master gates and regression
baseline. Historical prompts/reports are not certification for this change set.

## Ground Rules

- Run from the repository root unless a command changes directory explicitly.
- Record exact exit codes and concise output for every check.
- Use `PASS`, `FAIL`, or `DEFERRED`; never convert unavailable interactive or
  credential-dependent checks into `PASS`.
- Do not publish, upload, promote, advertise, commit, or push.
- Do not modify source files; this is a read-only audit.
- The four reference repos in `resources/mcp/` are IDEA sources — verify no
  code was copied verbatim (the FIDs claim ideas-only retrofit).
- Write the report to `dev/scratchpad/az-test-0804-002-006-results.md` using
  the Report Contract at the end.

## Tier 1 — Build & Type Safety (baseline gates)

### T1.1 — Workspace typechecks ×5
Run each; all must exit 0:

```text
cd sdk && bun run typecheck
cd common && bun run typecheck
cd packages/agent-runtime && bun run typecheck
cd cli && bun run typecheck
cd agents && bun run typecheck
```

### T1.2 — Full-repo ESLint zero-warnings
`bun x eslint . --max-warnings 0` — must exit 0.

### T1.3 — Markdown lint (repo gate)
`bun run lint:md` — must exit 0 (all 7 docs in this change set lint clean;
`MCP Servers Operational Audit.md` and other research reports are
intentionally ignored via `.markdownlintignore`).

### T1.4 — Test suites
Run and record final counts (expected: no failures):

```text
cd common && bun test src/          # expected 523 pass
cd packages/agent-runtime && bun test src/   # expected 636 pass
bun test agents/github/github.test.ts        # expected 3 pass
cd sdk && bun test src/            # expected 439 pass
```

### T1.5 — Version metadata
`cat VERSION` + root `cli/package.json` version — expected `0.0.18`; sibling
`cli/bin/env.json` carries `SAVANT_CODE_CLI_VERSION: "0.0.18"` (if built).

## Tier 2 — FID-002: deep_research Mechanical Tool

### T2.1 — Params schema exists and is JSON-only
Read `common/src/tools/params/tool/deep-research.ts` 0–EOF. Verify:
- `toolName: 'deep_research'` declared (twice: input + output).
- Input params: `question` (required), `queries[]` (optional), `research_depth`,
  `max_sources` (default 10).
- Output: `summary?`, `findings[]`, `citations[]`, `gaps[]`, `truncated`,
  `incomplete` — JSON-only output (no raw text escapes).

### T2.2 — Handler is mechanical (no second LLM)
Read `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts` 0–EOF.
Verify:
- Exported mechanics: `runDeepResearch`, `domainScore`, `deriveQueries`,
  `extractOrganicHits`.
- Executes via the existing web-search facade (`callWebSearchAPI` from
  `packages/agent-runtime/src/llm-api/savant-code-web-api.ts`).
- **No-second-model gate:** grep the handler for `generateObject` /
  `from 'ai'` / `@ai-sdk` — the ONLY hit must be a comment on line 23
  referencing the reference repo's design. Zero production imports.
- Concurrency: max 3, ≥1s stagger, 30s timeout per query.
- Never hard-fails: sub-query failures set `incomplete` + `gaps` (Law 14).

### T2.3 — Full registration chain
Grep and confirm each:
- `common/src/tools/constants.ts` — `'deep_research'` present
- `common/src/tools/list.ts` — `deep_research: deepResearchParams`
- `common/src/tools/safety-registry.ts` — entry present
- `packages/agent-runtime/src/tools/handlers/list.ts` — `handleDeepResearch`
- `packages/agent-runtime/src/util/activity-tracking.ts` — signal present
- `agents/types/tools.ts` — `DeepResearchParams`
- `agents/researcher/researcher-web.ts` — `'deep_research'` in `toolNames`
  (`['web_search', 'read_url', 'deep_research']`)

### T2.4 — Unit tests
`bun test packages/agent-runtime/src/tools/handlers/tool/__tests__/deep-research.test.ts`
— expected 13 pass (decomposition counts, domain scoring, dedup,
cap/truncated, timeout + failure degradation, credits aggregation).

### T2.5 — [INTERACTIVE] Researcher can invoke deep_research
In the CLI, ask: "Use the researcher to compare Bun vs Node.js for CLI tools
with a deep research pass (max 3 sources)". Verify:
- Researcher spawns and calls `deep_research`.
- Response contains findings + citations, and (when budget hit) `truncated`.
- No second-model artifacts: response is authored by the harness model from
  tool output. Mark DEFERRED if no API key is configured.

## Tier 3 — FID-003: github Infra Helper

### T3.1 — Definition shape
Read `agents/github/github.ts` 0–EOF. Verify:
- NOT a roster member: `id: 'github'`, no `spawnableAgents`, `toolNames` =
  `['set_output', 'add_message']` only (loop primitives).
- `mcpServers.github` = `{ type: 'http', url: 'https://api.githubcopilot.com/mcp/',
  headers: { Authorization: 'Bearer $SAVANT_CODE_GITHUB_TOKEN' } }`.
- `$VAR` interpolation is supported by the harness MCP client
  (`common/src/mcp/client.ts` `substituteEnvInValue` — regex handles
  `Bearer $VAR` interpolation; unset vars stay literal → 401 → agent
  reports missing token, does not retry in a loop).

### T3.2 — Read-only contract in systemPrompt
Verify the systemPrompt encodes: changed-files review default, inline +
summary comments, never merge/approve/push, secret-scan via code_security
tools, audit trail, and the uniform-401 stop-and-report rule.

### T3.3 — Wiring
- `agents/savant/savant.ts` `spawnableAgents` contains `'github'`
- `common/src/constants/free-agents.ts` contains `github`
- `cli/src/agents/bundled-agents.generated.ts` contains `"github"`
  (regenerated via `bun run scripts/prebuild-agents.ts`)
- `ARCHITECTURE.md` helper table lists `github`; `ECHO.md` helper count = 6

### T3.4 — Unit tests
`bun test agents/github/github.test.ts` — expected 3 pass (definition shape,
remote-http MCP route + canonical token header, documented tool groups).

### T3.5 — [INTERACTIVE] github agent spawn (credential-dependent)
In the CLI with `SAVANT_CODE_GITHUB_TOKEN` set, ask: "Spawn the github agent
to show the open issues for savant0x/savant-code (read-only)". Verify the
agent spawns, tools resolve via `github/` prefix, and results are read-only.
Without a token: spawn must still work but report the auth error gracefully.
Mark DEFERRED if no token is configured.

## Tier 4 — FID-004: database Infra Helper + Safety Contract

### T4.1 — Four native tools registered
Read `common/src/tools/params/tool/database.ts` 0–EOF. Verify `toolName`
declarations for: `list_tables`, `describe_table`, `execute_query`,
`analyze_query`. Shared `databaseUrl` param precedence: explicit >
`SAVANT_CODE_DATABASE_URL` > `DATABASE_URL`.

### T4.2 — Adapter-enforced safety contract (deterministic code, not prompts)
Read `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`
0–EOF. Verify each ported mcp-toolbox algorithm:
- `classifySql` — prefix classification after comment stripping (SELECT/INSERT/
  UPDATE/DELETE/TRUNCATE/DDL/EXPLAIN/SHOW/SET/unknown).
- `stripSqlCommentsAndQuotedText` + `applyQueryLimits` — LIMIT injection that
  never lands inside quoted text; only SELECT limited; existing LIMIT skipped.
- `redactSql` — hides single-quoted literals + 10+ digit numbers.
- `enforceCanExecuteWrite` — read-only default; writes need `allowWrite: true`;
  destructive DDL (DROP/TRUNCATE/ALTER/CREATE) always blocked; unclassifiable
  SQL rejected with structured `DB_*` error codes.
- `normalizeSqliteValue`/`normalizeSqliteRow` — BLOB (`Uint8Array`) → base64
  text, `bigint` → string (JSON-safe rows).
- 30s timeout contract (`QUERY_TIMEOUT_MS`), 1000-row cap (`MAX_ROW_LIMIT`).

### T4.3 — Handlers apply the contract
Read the four handlers (all in `.../tool/database/`):
- `list-tables.ts` (simple + detailed schema via sqlite.yaml SQL)
- `describe-table.ts` (parameterized table name, never interpolated)
- `execute-query.ts` (write gate → LIMIT injection → execute → redacted telemetry)
- `analyze-query.ts` (EXPLAIN QUERY PLAN only; never executes the statement)

### T4.4 — Adapter tests (SQL-injection corpus + BLOB coercion)
`bun test packages/agent-runtime/src/tools/handlers/tool/database/__tests__/sqlite-adapter.test.ts`
— expected 40 pass: 12 handler integration tests against a seeded temp-file DB
+ 28 adapter/safety tests incl. an 8-entry SQL-injection corpus (LIMIT never
lands in quoted text; redaction hides payloads; non-SELECT never limited) and
BLOB/bigint → JSONValue coercion.

### T4.5 — [INTERACTIVE] live database round-trip
Using a scratch SQLite file (e.g. `dev/scratchpad/az-test.db`):
- Ask the database agent: "List tables in `<path>`" → `list_tables`.
- "Describe the <table>" → `describe_table`.
- "Run `SELECT * FROM <table>`" → `execute_query` returns rows, LIMIT 1000.
- "Delete a row" WITHOUT approval → must be rejected
  (`DB_WRITE_MODE_REQUIRED`).
- "Drop the table" with approval → must be rejected
  (`DB_DESTRUCTIVE_DDL_BLOCKED`).
- Mark DEFERRED if the CLI is not runnable in this environment.

## Tier 5 — FID-005: browser-use Param Upgrades

### T5.1 — Params in inputSchema
Read `agents/browser-use/browser-use.ts` 0–EOF. Verify `inputSchema.params`
has exactly three new params with honest prompt-level-contract descriptions:
- `viewport` — enum `mobile` (375x667) / `tablet` (768x1024) / `desktop`
  (1920x1080); applied via CDP device-metrics with `evaluate_script` fallback.
- `wcag` — boolean; offline axe-core-style DOM-walk via `evaluate_script`
  (NO claim of a bundled artifact; no axe-core ships).
- `persistSession` — boolean, default OFF; the `chrome-devtools-mcp` launch
  keeps `--isolated`; runtime per-run arg swap documented as future wiring.

### T5.2 — Harness tasks
`agents/browser-use/browser-use.test.ts` — verify `responsive-mobile` and
`wcag-scan` tasks exist in the task-index E2E harness (params plumbed through
`TaskDefinition.params` → `client.run`).

### T5.3 — Call-graph unchanged
`browser-use` still in `agents/savant/savant.ts` `spawnableAgents`,
`free-agents.ts`, and `ARCHITECTURE.md` helper table — the delta is
param-level only, no new agent, no roster change, no Playwright dependency.

### T5.4 — [INTERACTIVE] browser smoke (browser + API key required)
Ask: "Use the browser agent to load example.com, apply the mobile viewport,
and run a WCAG scan". Verify the agent honors `params.viewport` +
`params.wcag`, uses `take_snapshot`/`evaluate_script`, and reports structured
violations. Mark DEFERRED if Chrome/API key unavailable (expected in CI).

## Tier 6 — FID-006: Master Gates

### T6.1 — No-second-model gate (master-level)
Grep across ALL new handler code and agent defs for `generateObject` /
`from 'ai'` / `@ai-sdk`:

```text
grep -rn 'generateObject\|from .ai.\|@ai-sdk' \
  packages/agent-runtime/src/tools/handlers/tool/deep-research.ts \
  packages/agent-runtime/src/tools/handlers/tool/database/ agents/github/ \
  | grep -v '.test.'
```

Expected: exactly ONE hit — the comment at `deep-research.ts:23`. Zero
production imports.

### T6.2 — License audit (reference repos)
Read the LICENSE files: `resources/mcp/deep-research-mcp-main/LICENSE`,
`github-mcp-server-main/LICENSE`, `local-deep-research-main/LICENSE`,
`mcp-toolbox-main/LICENSE`. Expected: MIT ×3 + Apache-2.0; no GPL.
Flag: deep-research `package.json` says ISC but LICENSE file says MIT
(LICENSE file governs).

### T6.3 — Zero new package dependencies
`git status --short | grep package.json` — expected: no feature-added deps
(only the pre-existing `cli/package.json` Bun engine pin from the 0.0.18
provider-key work).

### T6.4 — Cross-FID tool-surface register self-verifies
- `deep_research` ∈ researcher `toolNames` + handler registry
- `github` + `database` ∈ savant.ts spawnableAgents + free-agents.ts +
  ARCHITECTURE helper table
- `browser-use` params ∈ inputSchema

### T6.5 — Child FID linkage + archival
Verify each of FID-002..006 (in `dev/fids/archive/`) carries
`Master FID: FID-2026-0804-006` metadata, Status `closed`, and no FID-*.md
remains in active `dev/fids/`.

### T6.6 — Nova signoff recorded
Verify the correspondence trail exists:
- `dev/nova/outbox/2026-08-04-fid-002-006-mcp-feature-integration-nova-signoff-request.md`
- `dev/nova/inbox/2026-08-04-fid-002-006-mcp-feature-integration-nova-audit-response.md` (PASS)
- `dev/nova/outbox/2026-08-04-fid-002-006-nova-verdict-acknowledgment.md`
- CHANGELOG entry references the Nova PASS + fresh gate evidence.

## Tier 7 — Regression Checks (core surfaces must still work)

### T7.1 — Slash command registry
`cli/src/commands/command-registry.ts` — verify `/export` (aliases `save`),
`/copy` (aliases `copy-chat`), `/health`, `/provider`, `/history`,
`/permissions` all registered.

### T7.2 — Provider key management (FID-001)
Read `cli/src/utils/provider-setup.ts` — verify `saveProviderApiKey` calls
`resetOpenRouterApiKeyCache()` on the openrouter save path and
`getConfiguredProviderKey` exists. `/health` reports required env var +
key-configured status for direct providers.

### T7.3 — Completion-aware exit flush (FID-008)
Read `cli/src/utils/run-state-storage.ts` — verify `flushLiveChatState()`
preserves `completed: true` from the turn-end save
(`flushCompletionForChatDir`); `allChatsInterrupted` helper exists in
`chat-history-screen.tsx`.

### T7.4 — Export HTML self-contained (FID-007)
`grep -c 'data:font/woff2;base64' cli/src/constants/fontawesome.ts` — expected
> 0 (webfonts inlined as base64, zero network requests). Copy buttons +
Copy-all present in the generated HTML template.

### T7.5 — [INTERACTIVE] CLI boot + FSM
Boot `bun dev`, confirm: phase display renders, `/help` lists commands,
`/health` reports provider mode + key status, `/export` writes a self-contained
HTML file (open in browser: zero network requests, Copied flash works).

## Tier 8 — Nova + Archival Evidence (docs)

### T8.1 — All 5 FIDs lint clean
`bunx markdownlint-cli2 --config .markdownlint.json dev/fids/archive/FID-2026-0804-00{2,3,4,5,6}-*.md`
— expected 0 issues.

### T8.2 — CHANGELOG entry
`grep -c 'FID-2026-0804-002..006' CHANGELOG.md` — expected ≥ 1, including the
Nova signoff record.

### T8.3 — Session summaries
`dev/session-summaries/` contains the MCP integration close-out
(provider-key close-out, completion-aware exit flush, and any 0804 MCP
summary).

## Report Contract

Produce `dev/scratchpad/az-test-0804-002-006-results.md` (the runner agent's
write access is sandboxed to `dev/scratchpad/` — it cannot write to
`dev/test-prompts/`). After the audit is accepted, the operator promotes the
report to `dev/test-prompts/az-test-0804-002-006-results.md` (its permanent
home alongside this prompt):

```text
# A-Z Results — FID-2026-0804-002..006 (MCP Feature Integration)

**Date:** <run date>
**Runner:** <operator/agent>
**Version:** v0.0.19

## Summary

| Tier | Section | Status | Notes |
|------|---------|--------|-------|
| T1 | Build & Type Safety | PASS/FAIL | ... |
| T2 | deep_research | PASS/FAIL | ... |
| T3 | github helper | PASS/FAIL | ... |
| T4 | database helper | PASS/FAIL | ... |
| T5 | browser-use params | PASS/FAIL | ... |
| T6 | master gates | PASS/FAIL | ... |
| T7 | regression | PASS/FAIL | ... |
| T8 | docs/archival | PASS/FAIL | ... |

## Per-check evidence

- <T1.1> PASS — sdk/common/agent-runtime/cli/agents typechecks all exit 0
- <T2.2> PASS — no-second-model grep: 1 hit (comment, deep-research.ts:23)
- ... (one line per check; record exact commands + exit codes)

## GO / NO-GO / GO WITH CAVEATS

<final verdict, one line, with the reason>

## Caveats

- Credential-dependent interactive checks (T2.5, T3.5, T5.4) were DEFERRED /
  PASSED as applicable.
```

Final verdict rules: GO requires T1–T6 fully PASS (or documented DEFERRED with
reason). NO-GO on any failure in the safety-contract or no-second-model checks.
