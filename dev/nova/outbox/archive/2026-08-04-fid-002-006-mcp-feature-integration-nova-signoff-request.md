# Nova Audit Request — FID-2026-0804-002..006 MCP Feature Integration Master Plan

**Date:** 2026-08-04
**From:** Savant Orchestrator (Savant ECHO v0.1.2)
**To:** Nova — independent third-party ECHO auditor
**FIDs:** FID-2026-0804-002 (deep research), FID-2026-0804-003 (github),
FID-2026-0804-004 (multi-database), FID-2026-0804-005 (browser-use),
FID-2026-0804-006 (master plan) — all under `dev/fids/`
**Priority:** High — independent post-implementation sign-off
**Method requested:** Source-verified review. Read the referenced files 0–EOF,
independently inspect the implementation, and apply the Cross-Agent Claim Rule.
Do not modify source files.

---

## Review Boundary

This request asks Nova to independently verify the completed implementation and
provide a written verdict. It does not request additional coding, scope changes,
FID edits, archival changes, commits, pushes, publishing, or deployment.

The FIDs were approved by the operator before implementation, completed through
their Perfection Loops, and marked `closed` (still in `dev/fids/`, archival
pending). Nova's response must not be treated as a substitute for operator
approval or as authorization for additional implementation.

## What Was Built

A 4-phase MCP feature integration (ideas retrofitted from the four reference
repos in `resources/mcp/` — NOT 1:1 ports; harness model drives all cognition,
no second LLM anywhere):

| Phase | FID | Delivery | Distribution |
|---|---|---|---|
| 1 | FID-005 | `browser-use` param upgrades (viewport/WCAG/persistSession) | npx chrome-devtools-mcp (in-tree) |
| 2 | FID-003 | `github` infra helper via official MCP server | remote HTTP (default), read-only |
| 3 | FID-004 | `database` infra helper, 4 native tools | bun:sqlite (zero new deps) |
| 4 | FID-002 | `deep_research` mechanical tool on Researcher role | existing Serper facade |

## Implementation Claims to Verify

### Claim 1 — deep_research is mechanical; no second LLM

Read `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts` 0–EOF and
verify:

- The handler exports pure mechanics: `runDeepResearch`, `domainScore`,
  `deriveQueries`, `extractOrganicHits`.
- It executes via the existing web-search facade (`callWebSearchAPI` in
  `packages/agent-runtime/src/llm-api/savant-code-web-api.ts`) — no `ai` SDK,
  no `generateObject`, no direct LLM calls. Grep for `generateObject` /
  `from 'ai'` / `@ai-sdk` in the handler should return only a comment
  (line 23 references the reference repo's design, not usage).
- Failure behavior: never hard-fails; returns `incomplete` + `gaps`
  (Law 14). Concurrency cap 3, ≥1s stagger, 30s timeout, `max_sources` cap
  with `truncated`.

### Claim 2 — deep_research is registered and gated

Verify registration in:

- `common/src/tools/params/tool/deep-research.ts` (zod v4 schema: `question`,
  `queries?`, `research_depth?`, `max_sources?`; JSON-only output)
- `common/src/tools/constants.ts`, `common/src/tools/list.ts`,
  `common/src/tools/safety-registry.ts`
- `packages/agent-runtime/src/tools/handlers/list.ts`
- `packages/agent-runtime/src/util/activity-tracking.ts`
- `agents/types/tools.ts` (`DeepResearchParams`)
- `agents/researcher/researcher-web.ts` (`toolNames` + loop protocol in
  `instructionsPrompt`)

### Claim 3 — github infra helper uses the official MCP server, read-only

Read `agents/github/github.ts` 0–EOF and verify:

- `mcpServers.github` = `{ type: 'http',
  url: 'https://api.githubcopilot.com/mcp/',
  headers: { Authorization: 'Bearer $SAVANT_CODE_GITHUB_TOKEN' } }`.
- The `$VAR` header interpolation is supported by the harness MCP client
  (`common/src/mcp/client.ts` `substituteEnvInValue` — verify the regex
  handles `Bearer $VAR` interpolation).
- `toolNames` contains only loop primitives (`set_output`, `add_message`); all
  GitHub capability comes from MCP tools.
- systemPrompt encodes: changed-files review default, inline + summary
  comments, no merge/approve/push, secret-scan via code_security tools,
  audit trail, and the unset-token degradation rule (stop + report on
  uniform 401/403, don't retry in a loop).
- Wiring: `agents/savant/savant.ts` `spawnableAgents` + system-prompt helper
  list; `common/src/constants/free-agents.ts`; bundled agents regenerated at
  `cli/src/agents/bundled-agents.generated.ts` (grep for `"github"`).

### Claim 4 — database safety contract is adapter-enforced, deterministic code

Read `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`
0–EOF and verify the ported mcp-toolbox algorithms:

- `classifySql` — prefix classification after comment stripping.
- `stripSqlCommentsAndQuotedText` + `applyQueryLimits` — LIMIT injection that
  never lands inside quoted text; only SELECT is limited.
- `redactSql` — string literals + 10+ digit numbers hidden.
- `enforceCanExecuteWrite` — read-only default; INSERT/UPDATE/DELETE need
  `allowWrite: true`; destructive DDL (DROP/TRUNCATE/ALTER/CREATE) always
  blocked; unclassifiable SQL rejected.
- `normalizeSqliteValue`/`normalizeSqliteRow` — BLOB (`Uint8Array`) → base64
  text, `bigint` → string, so raw rows are always JSONValue.
- Structured error codes (DB_*) and 30s timeout contract.

Then verify the four handlers apply the contract:
`list-tables.ts`, `describe-table.ts`, `execute-query.ts`, `analyze-query.ts`
(all in the same directory) — and their zod schemas in
`common/src/tools/params/tool/database.ts` (shared `databaseUrl` param:
explicit > `SAVANT_CODE_DATABASE_URL` > `DATABASE_URL`).

### Claim 5 — browser-use params are honest prompt-level contracts

Read `agents/browser-use/browser-use.ts` 0–EOF and verify the three params in
`inputSchema.params`:

- `viewport` (mobile 375x667 / tablet 768x1024 / desktop 1920x1080) —
  describes CDP device-metrics with `evaluate_script` fallback.
- `wcag` (boolean) — describes an offline axe-core-style DOM-walk via
  `evaluate_script`; NO claim of a bundled artifact (no axe-core ships).
- `persistSession` (boolean, default OFF) — honestly scoped: the
  `chrome-devtools-mcp` launch keeps `--isolated`; the param is a workflow
  contract, with the runtime per-run arg swap documented as future harness
  wiring (see the mcpServers comment).

Note: these are agent-definition params executed by the harness model (E2E
verification requires a live browser, CI-only) — the acceptance gate is that
the params render in `inputSchema` and the task-index harness
(`agents/browser-use/browser-use.test.ts`) includes `responsive-mobile` and
`wcag-scan` tasks.

### Claim 6 — master gates (FID-006)

Verify from source:

- **No-second-model gate:** grep for `generateObject` / `from 'ai'` /
  `@ai-sdk` across the new handler code returns at most one hit — a comment
  (verified: `deep-research.ts:23`).
- **License audit:** `resources/mcp/*/LICENSE` — MIT ×3 (deep-research,
  github-server, local-deep-research) + Apache-2.0 (mcp-toolbox); no GPL.
  deep-research `package.json` says ISC but LICENSE file is MIT (flag; LICENSE
  governs).
- **Zero new package dependencies:** `git status --short | grep package.json`
  shows no feature-added deps (only the pre-existing `cli/package.json` Bun
  engine pin from the 0.0.18 work).
- **Docs:** `ARCHITECTURE.md` helper table + hierarchy counts (17 agent dirs);
  `ECHO.md` footnote helper count 4 → 6; `CHANGELOG.md` entry added; all five
  FIDs carry `Master FID: FID-2026-0804-006` metadata (GAP-1 closed).

### Claim 7 — verification gates passed (independently re-run)

The implementation record claims the following. Independently verify where
possible and report exact command status:

- `packages/agent-runtime`: 636 pass / 0 fail / 1762 expects
  (incl. 13 deep_research + 40 database)
- `common`: 523 pass / 0 fail / 1323 expects (incl. free-agents 8/0)
- `agents/github/github.test.ts`: 3 pass / 0 fail / 19 expects
- typecheck ×5 all exit 0: sdk, common, packages/agent-runtime, cli, agents
- full-repo ESLint `--max-warnings 0`: exit 0
- markdownlint 0 issues on all 7 docs in the change set (5 FIDs + ECHO.md +
  ARCHITECTURE.md)

### Known pre-existing items (NOT part of this change set)

For transparency, two repo-wide gate notes that predate this work:

- `bun run lint:md` (repo-wide) fails on untracked files written by another
  session: `MCP Servers Operational Audit.md` and
  `dev/session-summaries/2026-08-04-fid-loop2-review-convergence.md`.
  Verified via `git stash` that HEAD's committed state lints clean — this
  change set introduces no new lint failures (all 7 touched docs lint 0/0).
- `CHANGELOG.md` is in `.markdownlintignore`, so its long lines do not fail
  the gate.

## Files to Read

1. `dev/fids/FID-2026-0804-002-deep-research-system.md`
2. `dev/fids/FID-2026-0804-003-github-mcp-integration.md`
3. `dev/fids/FID-2026-0804-004-multi-database-query-agent.md`
4. `dev/fids/FID-2026-0804-005-accessibility-tree-browser-automation.md`
5. `dev/fids/FID-2026-0804-006-mcp-feature-integration-master-plan.md`
6. `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts`
7. `packages/agent-runtime/src/tools/handlers/tool/__tests__/deep-research.test.ts`
8. `common/src/tools/params/tool/deep-research.ts`
9. `agents/github/github.ts`
10. `agents/github/github.test.ts`
11. `agents/database/database.ts`
12. `common/src/tools/params/tool/database.ts`
13. `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`
14. `packages/agent-runtime/src/tools/handlers/tool/database/execute-query.ts`
15. `packages/agent-runtime/src/tools/handlers/tool/database/analyze-query.ts`
16. `packages/agent-runtime/src/tools/handlers/tool/database/describe-table.ts`
17. `packages/agent-runtime/src/tools/handlers/tool/database/list-tables.ts`
18. `packages/agent-runtime/src/tools/handlers/tool/database/__tests__/sqlite-adapter.test.ts`
19. `agents/browser-use/browser-use.ts`
20. `agents/browser-use/browser-use.test.ts`
21. `agents/researcher/researcher-web.ts`
22. `common/src/mcp/client.ts` (env-var interpolation)
23. `ARCHITECTURE.md` (helper table)
24. `ECHO.md` (helper-count footnote)
