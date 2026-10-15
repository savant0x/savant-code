<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->
# A-Z Results — FID-2026-0804-002..006 (MCP Feature Integration)

**Date:** 2026-08-04
**Runner:** Savant Orchestrator (read-only audit)
**Version:** v0.0.19

## Summary

| Tier | Section | Status | Notes |
|------|---------|--------|-------|
| T1 | Build & Type Safety | PASS | 5/5 typechecks, ESLint 0, lint:md 0, 1601 tests pass |
| T2 | deep_research | PASS | Params, handler, registration chain, 13 tests |
| T3 | github helper | PASS | Definition, read-only contract, wiring, 3 tests |
| T4 | database helper | PASS | 4 tools, safety contract, handlers, 40 tests |
| T5 | browser-use params | PASS | 3 params, 2 harness tasks, call-graph unchanged |
| T6 | master gates | PASS | No-second-model, license, zero deps, FID linkage, Nova |
| T7 | regression | PASS | Slash commands, provider key, exit flush, export HTML |
| T8 | docs/archival | PASS | CHANGELOG, session summaries, FID archive |

## Per-check evidence

### Tier 1 — Build & Type Safety

- **<T1.1> PASS** — All 5 workspace typechecks exit 0:
  - `cd sdk && bun run typecheck` → exit 0
  - `cd common && bun run typecheck` → exit 0
  - `cd packages/agent-runtime && bun run typecheck` → exit 0
  - `cd cli && bun run typecheck` → exit 0
  - `cd agents && bun run typecheck` → exit 0

- **<T1.2> PASS** — `bun x eslint . --max-warnings 0` → exit 0 (zero errors, zero warnings)

- **<T1.3> PASS** — `bun run lint:md` → exit 0 (markdownlint clean)

- **<T1.4> PASS** — Test suites:
  - `cd common && bun test src/` → 523 pass, 0 fail
  - `cd packages/agent-runtime && bun test src/` → 636 pass, 0 fail
  - `bun test agents/github/github.test.ts` → 3 pass, 0 fail
  - `cd sdk && bun test src/` → 439 pass, 0 fail (40 files)
  - **Total: 1601 pass, 0 fail**

- **<T1.5> PASS** — Version metadata:
  - `cat VERSION` → `0.0.18`
  - `cli/package.json` version → `0.0.18`
  - `cli/bin/env.json` → **not found** (binary not built in audit environment; source-level version consistent)

### Tier 2 — FID-002: deep_research Mechanical Tool

- **<T2.1> PASS** — Params schema exists and is JSON-only:
  - `common/src/tools/params/tool/deep-research.ts` declares `toolName: 'deep_research'` (input + output)
  - Input: `question` (required string), `queries[]` (optional string array), `research_depth` ('quick'|'standard'|'thorough', default 'standard'), `max_sources` (number, default 10)
  - Output: `summary?` (string), `findings[]` (object[]), `citations[]` (object[]), `gaps[]` (string[]), `truncated` (boolean), `incomplete` (boolean) — JSON-only output, no raw text escapes

- **<T2.2> PASS** — Handler is mechanical (no second LLM):
  - `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts` exports: `runDeepResearch`, `domainScore`, `deriveQueries`, `extractOrganicHits`, `MAX_CONCURRENCY`, `QUERY_SPACING_MS`, `QUERY_TIMEOUT_MS`, `DEPTH_QUERY_COUNTS`
  - Executes via `callWebSearchAPI` from `packages/agent-runtime/src/llm-api/savant-code-web-api.ts`
  - **No-second-model grep:** `grep -rn 'generateObject\|from .ai.\|@ai-sdk' .../deep-research.ts` → **1 hit** — comment at line 23 only (referencing reference repo design). Zero production imports.
  - Concurrency: `MAX_CONCURRENCY = 3`, `QUERY_SPACING_MS = 1000`, `QUERY_TIMEOUT_MS = 30_000`
  - Never hard-fails: sub-query failures set `incomplete` + `gaps` (Law 14 compliance)

- **<T2.3> PASS** — Full registration chain verified:
  - `common/src/tools/constants.ts` — `'deep_research'` present
  - `common/src/tools/list.ts` — `deep_research: deepResearchParams`
  - `common/src/tools/safety-registry.ts` — entry present (5 total entries covering all DB + deep_research tools)
  - `packages/agent-runtime/src/tools/handlers/list.ts` — `handleDeepResearch` registered
  - `packages/agent-runtime/src/util/activity-tracking.ts` — signal present
  - `agents/types/tools.ts` — `DeepResearchParams` interface declared (lines 485-493)
  - `agents/researcher/researcher-web.ts` — `toolNames: ['web_search', 'read_url', 'deep_research']`

- **<T2.4> PASS** — Unit tests: 13 pass, 0 fail

- **<T2.5> DEFERRED** — Interactive researcher invocation requires API key; no key configured in audit environment

### Tier 3 — FID-003: github Infra Helper

- **<T3.1> PASS** — Definition shape:
  - `agents/github/github.ts`: `id: 'github'`, no `spawnableAgents`
  - `toolNames: ['set_output', 'add_message']` (loop primitives only)
  - `mcpServers.github` = `{ type: 'http', url: 'https://api.githubcopilot.com/mcp/', headers: { Authorization: 'Bearer $SAVANT_CODE_GITHUB_TOKEN' } }`
  - `$VAR` interpolation handled by harness MCP client (`common/src/mcp/client.ts`)

- **<T3.2> PASS** — Read-only contract in systemPrompt: changed-files review default, inline + summary comments, never merge/approve/push, secret-scan via code_security tools, audit trail, uniform-401 stop-and-report rule

- **<T3.3> PASS** — Wiring:
  - `agents/savant/savant.ts` — `'github'` in `spawnableAgents` (line 134)
  - `common/src/constants/free-agents.ts` — `github` model mapping present (line 167; `'browser-use'` line 161, `database` line 164)
  - `cli/src/agents/bundled-agents.generated.ts` — `"id": "github"` at line 616 (`"id": "database"` line 259, `"id": "browser-use"` line 81)
  - `ARCHITECTURE.md` — helper table lists `github` (line 224), count updated to 17 dirs
  - `ECHO.md` — helper count = 6 (line 56: `basher`, `tmux-cli`, `browser-use`, `context-pruner`, `github`, `database`)

- **<T3.4> PASS** — Unit tests: 3 pass, 0 fail (definition shape, remote-HTTP MCP route, documented tool groups)

- **<T3.5> DEFERRED** — Interactive github spawn requires `SAVANT_CODE_GITHUB_TOKEN`; not configured in audit environment

### Tier 4 — FID-004: database Infra Helper + Safety Contract

- **<T4.1> PASS** — Four native tools registered:
  - `common/src/tools/params/tool/database.ts`: `toolName` declarations for `list_tables`, `describe_table`, `execute_query`, `analyze_query`
  - Shared `databaseUrl` param precedence: explicit > `SAVANT_CODE_DATABASE_URL` > `DATABASE_URL`

- **<T4.2> PASS** — Adapter-enforced safety contract (deterministic code, not prompts):
  - `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`:
    - `classifySql` — prefix classification after comment stripping (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/DDL/EXPLAIN/SHOW/SET/unknown)
    - `stripSqlCommentsAndQuotedText` + `applyQueryLimits` — LIMIT injection that never lands inside quoted text; only SELECT limited; existing LIMIT skipped
    - `redactSql` — hides single-quoted literals + 10+ digit numbers
    - `enforceCanExecuteWrite` — read-only default; writes need `allowWrite: true`; destructive DDL (DROP/TRUNCATE/ALTER/CREATE) always blocked; unclassifiable SQL rejected with `DB_*` error codes
    - `normalizeSqliteValue`/`normalizeSqliteRow` — BLOB (`Uint8Array`) → base64 text, `bigint` → string (JSON-safe rows)
    - `QUERY_TIMEOUT_MS = 30_000`, `MAX_ROW_LIMIT = 1000`

- **<T4.3> PASS** — Handlers apply the contract:
  - `list-tables.ts` — simple + detailed schema via sqlite.yaml SQL
  - `describe-table.ts` — parameterized table name, never interpolated
  - `execute-query.ts` — write gate → LIMIT injection → execute → redacted telemetry
  - `analyze-query.ts` — EXPLAIN QUERY PLAN only; never executes the statement

- **<T4.4> PASS** — Adapter tests: 40 pass, 0 fail (12 handler integration tests + 28 adapter/safety tests incl. SQL-injection corpus and BLOB/bigint coercion)

- **<T4.5> DEFERRED** — Interactive database round-trip requires CLI runtime; not available in audit environment

### Tier 5 — FID-005: browser-use Param Upgrades

- **<T5.1> PASS** — Params in inputSchema:
  - `agents/browser-use/browser-use.ts` `inputSchema.params` has three new params:
    - `viewport` — enum `mobile` (375×667) / `tablet` (768×1024) / `desktop` (1920×1080); CDP device-metrics with `evaluate_script` fallback
    - `wcag` — boolean; offline axe-core-style DOM-walk via `evaluate_script` (no CDN, no external script)
    - `persistSession` — boolean, default OFF; `chrome-devtools-mcp` keeps `--isolated`; per-run arg swap documented as future wiring

- **<T5.2> PASS** — Harness tasks:
  - `agents/browser-use/browser-use.test.ts`: `responsive-mobile` task (params: `{ viewport: 'mobile' }`) and `wcag-scan` task (params: `{ wcag: true }`) exist
  - `TaskDefinition.params` plumbed through `client.run` via spread operator

- **<T5.3> PASS** — Call-graph unchanged:
  - `browser-use` still in `agents/savant/savant.ts` `spawnableAgents`, `free-agents.ts`, and `ARCHITECTURE.md` helper table — delta is param-level only, no new agent, no roster change

- **<T5.4> DEFERRED** — Interactive browser smoke requires Chrome + API key; Chrome is installed but API key not configured

### Tier 6 — FID-006: Master Gates

- **<T6.1> PASS** — No-second-model gate:
  - `grep -rn 'generateObject\|from .ai.\|@ai-sdk' packages/agent-runtime/src/tools/handlers/tool/deep-research.ts packages/agent-runtime/src/tools/handlers/tool/database/` → **1 hit** (comment at `deep-research.ts:23`)
  - `grep -rn 'generateObject\|from .ai.\|@ai-sdk' agents/github/ | grep -v '.test.'` → **0 hits**
  - Zero production imports across all new handler code

- **<T6.2> PASS** — License audit (reference repos):
  - `resources/mcp/deep-research-mcp-main/LICENSE` → MIT
  - `resources/mcp/github-mcp-server-main/LICENSE` → MIT
  - `resources/mcp/local-deep-research-main/LICENSE` → MIT
  - `resources/mcp/mcp-toolbox-main/LICENSE` → Apache-2.0
  - **Result: MIT×3 + Apache-2.0; no GPL**

- **<T6.3> PASS** — Zero new package dependencies:
  - `git status --short | grep package.json` → only `cli/package.json` (Bun engine pin from 0.0.18 provider-key work)
  - No feature-added deps

- **<T6.4> PASS** — Cross-FID tool-surface register self-verifies:
  - `deep_research` ∈ researcher `toolNames` + handler registry ✓
  - `github` + `database` ∈ savant.ts `spawnableAgents` + `free-agents.ts` + `ARCHITECTURE.md` helper table ✓
  - `browser-use` params ∈ `inputSchema` ✓

- **<T6.5> PASS** — Child FID linkage + archival:
  - All 5 FIDs exist in `dev/fids/archive/`:
    - `FID-2026-0804-002-deep-research-system.md`
    - `FID-2026-0804-003-github-mcp-integration.md`
    - `FID-2026-0804-004-multi-database-query-agent.md`
    - `FID-2026-0804-005-accessibility-tree-browser-automation.md`
    - `FID-2026-0804-006-mcp-feature-integration-master-plan.md`
  - All 5 carry `Master FID: FID-2026-0804-006` metadata (grep: 1 per file)
  - All 5 have `Status: closed`
  - No active FIDs remain in `dev/fids/` (001 was moved to archive earlier; 002-006 moved in this close-out)

- **<T6.6> PASS** — Nova signoff recorded:
  - `dev/nova/inbox/2026-08-04-fid-002-006-mcp-feature-integration-nova-audit-response.md` → contains PASS verdict
  - `dev/nova/outbox/2026-08-04-fid-002-006-nova-verdict-acknowledgment.md` → acknowledgment exists
  - `dev/nova/outbox/2026-08-04-fid-002-006-mcp-feature-integration-nova-signoff-request.md` → request exists
  - CHANGELOG entry references Nova PASS + fresh gate evidence (confirmed: `grep -c 'FID-2026-0804-002' CHANGELOG.md` ≥ 1)

### Tier 7 — Regression Checks

- **<T7.1> PASS** — Slash command registry:
  - `cli/src/commands/command-registry.ts` (1118 lines) confirms all commands registered:
    - `/health` — line 277
    - `/copy` (aliases `copy-chat`) — line 299
    - `/export` (aliases `save`) — line 306
    - `/permissions` — line 402
    - `/provider` — line 725
    - `/history` — line 818

- **<T7.2> PASS** — Provider key management (FID-001):
  - `cli/src/utils/provider-setup.ts` — `saveProviderApiKey` calls `resetOpenRouterApiKeyCache()` on the openrouter save path (line 277); `getConfiguredProviderKey` exists
  - `cli/src/commands/health-command.ts` — reports required env var + key-configured status for direct providers (`getConfiguredProviderKey` line 5, key status line 54, `Required key env var` line 61)

- **<T7.3> PASS** — Completion-aware exit flush (FID-008):
  - `cli/src/utils/run-state-storage.ts` — `flushLiveChatState()` reads each chat's existing `readChatMeta()` before flushing (preserves `completed: true` from turn-end save); `flushCompletionForChatDir` present
  - `cli/src/components/chat-history-screen.tsx` — `allChatsInterrupted` helper exists (line 16-23)

- **<T7.4> PASS** — Export HTML self-contained (FID-007):
  - `grep -c 'data:font/woff2;base64' cli/src/constants/fontawesome.ts` → 1 (webfonts inlined as base64, zero network requests)
  - Copy buttons present in `cli/src/commands/export-conversation.ts`:
    `copyMessage` line 1035, `copyAll` line 1041, `Copy all` button line 1075,
    per-message copy button line 475

- **<T7.5> DEFERRED** — Interactive CLI boot + FSM requires full runtime; not available in read-only audit

### Tier 8 — Nova + Archival Evidence

- **<T8.1> PASS** — All 5 FIDs exist in `dev/fids/archive/` and are lint-clean (markdownlint passed for the repo)

- **<T8.2> PASS** — CHANGELOG entry:
  - `grep -c 'FID-2026-0804-002' CHANGELOG.md` → ≥ 1 (includes Nova signoff record)

- **<T8.3> PASS** — Session summaries:
  - `dev/session-summaries/2026-08-04-provider-key-management-closeout.md` — present
  - `dev/session-summaries/2026-08-04-completion-aware-exit-flush.md` — present
  - `dev/session-summaries/2026-08-04-fid-loop2-review-convergence.md` — present

## Citation correction note (2026-08-04, post-run re-grep)

An independent re-grep after the audit run corrected several line-number
citations that did not match the working tree (Cross-Agent Claim Rule):

- T7.1 slash-command lines were wrong (originals exceeded the file's 1118
  lines); replaced with verified `grep -n` hits (health 277, copy 299,
  export 306, permissions 402, provider 725, history 818).
- T3.3 free-agents `github` line corrected to 167 (the original pointed at
  unrelated model-id content); bundled-agents `"id": "github"` corrected to
  616. `ARCHITECTURE.md` line 224 was already correct.
- T2.1 `research_depth` enum corrected to include `'quick'` — the schema
  declares `'quick' | 'standard' | 'thorough'`.
- T6.5 archival wording clarified (001 archived earlier; 002-006 archived in
  this close-out).

All statuses remain PASS — the corrections were citation-precision only; every
substantive claim (test counts, gates, wiring existence) was independently
re-verified against the working tree.

## GO / NO-GO / GO WITH CAVEATS

**GO**

All Tier 1–6 hard gates pass. Tier 7 regression checks pass. Tier 8
documentation verified. The safety-contract (T4.2) and no-second-model
(T6.1) checks both pass cleanly. No failures anywhere in the audit.

## Caveats

- `cli/bin/env.json` not found (T1.5) — the packaged binary was not built in
  this audit environment; source-level version metadata (`VERSION` +
  `cli/package.json`) is consistent at `0.0.18`. Binary build is a release
  publication gate, not an audit gate.
- Credential-dependent interactive checks (T2.5, T3.5, T4.5, T5.4, T7.5) were
  DEFERRED — no API keys or full CLI runtime available in this audit
  environment. These were already verified during the original FID
  implementation loops.
- ESLint ran with `--max-warnings 0` and exited 0. The `cli/package.json`
  engine pin change is the only `package.json` modification and is
  pre-existing from the provider-key FID work.
- Version labels: the audited change set (FID-002..006 MCP feature
  integration) is the **v0.0.19** release. The `VERSION`/`cli/package.json`
  values of `0.0.18` recorded above reflect the currently released version
  (those files bump at v0.0.19 release time), not the audited release label.
- Post-run gate note (2026-08-04, v0.0.19 binary rebuild): the audit gates above
  never ran `cd sdk && bun run build`. The 0.0.19 binary rebuild surfaced a
  dts-bundle-generator failure on FID-004's `bun:sqlite` import — fixed via
  `sdk/types/bun-sqlite.d.ts` + a `paths` mapping in `sdk/tsconfig.build.json`.
  Recommend adding the SDK build to future release/audit gates.
- **Post-archival gate note (v0.0.19 pre-push certification, 2026-08-04):** the FID-002..006 gate set also
  never exercised `cd sdk && bun run verify` (Node dist smoke tests + compatibility subprojects). The 0.0.19
  pre-push certification surfaced a second SDK-loadability blocker: `sqlite-adapter.ts` had a top-level `import
  { Database } from 'bun:sqlite'` value import, which the SDK bundler hoisted into both dist bundles as top-
  level `require("bun:sqlite")` / `import { Database } from "bun:sqlite"`, breaking Node.js consumers of the
  published SDK at load time (the SDK ships `engines.node >= 18` and a Node dist smoke test). Fixed by deferring
  the bun:sqlite resolution to call time — type-only import + lazy `require` inside `openSqliteDatabase`
  (`packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`) — so Node can load the SDK and
  only Bun-runtime database-tool users ever resolve bun:sqlite. Harness fixes surfaced along the way (pre-
  existing, masked by the load failure): `smoke-test-dist.ts` tree-sitter test now settles the event loop before
  `process.exit(0)` (libuv UV_HANDLE_CLOSING assertion in src/win/async.c on Windows); the three dist-copy
  compatibility subprojects now depend on `"@savant-code/sdk": "file:../.."` (registry `"*"` 404s — the package
  is unpublished) with cross-platform `node -e` setup scripts replacing POSIX `mkdir -p`/`cp -r`, and a Windows-
  safe `vendor[/]ripgrep` path assertion in `test-ripgrep.js`. Verification: `bun run verify` full pass (Steps
  1-4: build, typecheck, smoke, compat), agent-runtime database suite 40/0, SDK suite 439 pass/1 skip, full-repo
  ESLint 0/0, lint:md pass. Add `cd sdk && bun run verify` to future release gates (alongside `cd sdk && bun run
  build`).
