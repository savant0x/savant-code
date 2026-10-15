# Session Summary — FID-2026-0804-002..006 MCP Feature Integration Closeout

**Date:** 2026-08-04
**Author:** Savant
**FIDs:** `dev/fids/archive/FID-2026-0804-002-deep-research-system.md`,
`dev/fids/archive/FID-2026-0804-003-github-mcp-integration.md`,
`dev/fids/archive/FID-2026-0804-004-multi-database-query-agent.md`,
`dev/fids/archive/FID-2026-0804-005-accessibility-tree-browser-automation.md`,
`dev/fids/archive/FID-2026-0804-006-mcp-feature-integration-master-plan.md`
**Master FID:** FID-2026-0804-006 (MCP Feature Integration Master Plan)

## What happened

Implemented the four-phase MCP Feature Integration master plan after the Loop 2
review-and-convergence session (see `2026-08-04-fid-loop2-review-convergence.md`).
Ideas were adopted from the four `resources/mcp/` reference repos (deep-research,
github-mcp-server, local-deep-research, mcp-toolbox) and **retrofitted for
Savant** — no 1:1 ports and, per the master gate, **no second LLM anywhere** (the
harness already runs the model). All five FIDs were implemented, unit-tested,
verified, Nova-signed-off, and archived.

## Implementation summary (converged GREEN sections)

- **FID-002 — `deep_research` mechanical tool (Researcher role):**
  `common/src/tools/params/tool/deep-research.ts` (zod v4: `question` required +
  model-supplied `queries[]`, `research_depth` quick|standard|thorough,
  `max_sources`), handler at
  `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts` exporting
  `runDeepResearch`/`domainScore`/`deriveQueries`/`extractOrganicHits` — max-3
  concurrency, ≥1s stagger, 30s timeout, URL dedup, domain scoring map, never
  hard-fails (`incomplete` + `gaps`). Executes via `callWebSearchAPI` from the
  harness web API — no AI SDK. 13 unit tests.
- **FID-003 — `github` infra helper (helpers 4 → 6):**
  `agents/github/github.ts` with remote-HTTP official MCP route
  `https://api.githubcopilot.com/mcp/` + `Authorization: Bearer
  $SAVANT_CODE_GITHUB_TOKEN` (client-side `$VAR` interpolation verified),
  read-only default, changed-files review contract, uniform-401 stop-and-report.
  3 definition tests.
- **FID-004 — `database` infra helper + 4 native tools:** `list_tables` /
  `describe_table` / `execute_query` / `analyze_query` over `bun:sqlite` with an
  adapter-enforced safety contract in `sqlite-adapter.ts` (`classifySql`, comment
  + quoted-text-stripping, LIMIT injection, `redactSql`, write gate with
  destructive-DDL block, JSON-safe BLOB/bigint coercion, 30s timeout, 1000-row
  cap). 40 tests incl. a 12-test handler integration suite and an 8-entry
  SQL-injection corpus.
- **FID-005 — `browser-use` param upgrades:** `viewport` (mobile 375×667 /
  tablet 768×1024 / desktop 1920×1080 via CDP device-metrics with
  `evaluate_script` fallback), `wcag` (offline DOM-walk accessibility scan, no
  CDN/external script), `persistSession` (default OFF, `--isolated` retained).
  E2E task harness extended with `responsive-mobile` + `wcag-scan` tasks.
- **FID-006 — master gates:** no-second-model grep PASSES (the one hit is a
  comment), license audit PASSES (MIT×3 + Apache-2.0, no GPL), zero new package
  dependencies, size budget intact (no `ai` SDK), `ARCHITECTURE.md` helper table
  + counts (17 dirs) + `ECHO.md` footnote refreshed, bundled-agents regenerated
  (github + database).

## Verification (gates)

- Typecheck ×5 (sdk/common/agent-runtime/cli/agents) — all exit 0.
- Full-repo ESLint `--max-warnings 0` — clean. markdownlint — 0 issues.
- Suites: common **523/0**, agent-runtime **630/0** (incl. 13 deep-research +
  40 database), sdk **439/0**, github **3/0**, free-agents **8/0**.
- A-Z harness audit (`dev/test-prompts/archive/release-az-test-fid-2026-0804-002-006.md`
  + `az-test-0804-002-006-results.md`) returned **GO** — 1601 tests pass / 0
  fail, all 8 tiers PASS with credential-dependent checks DEFERRED. Post-run
  citation corrections applied (re-grep verified line numbers; see the report's
  citation-correction note).
- **Nova (independent third-party auditor) signed off PASS** on 2026-08-04 — all
  7 claims verified, including the verification-gates claim re-run at verdict
  time (636/0, 523/0, 3/0, typecheck ×5 exit 0, ESLint exit 0). Verdict:
  `dev/nova/inbox/2026-08-04-fid-002-006-mcp-feature-integration-nova-audit-response.md`;
  acknowledgment: `dev/nova/outbox/2026-08-04-fid-002-006-nova-verdict-acknowledgment.md`.
- **Post-archival gate note (v0.0.19 binary rebuild, 2026-08-04):** the gate set
  above never included `cd sdk && bun run build`. The 0.0.19 binary rebuild
  surfaced a dts-bundle-generator failure on FID-004's `bun:sqlite` import
  (bun-types globals reference `node:util.TextEncoderEncodeIntoResult`, absent
  from pinned @types/node 22.x; dts-bundle-generator cannot skip lib files the
  way tsc's `skipLibCheck` does). Fixed with a minimal
  `sdk/types/bun-sqlite.d.ts` stub + `paths` mapping in `sdk/tsconfig.build.json`;
  `dist/index.d.ts` carries zero `bun:sqlite` references. Add `cd sdk && bun run
  build` to future release gates.
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

## Archival action taken

- All 5 FIDs moved to `dev/fids/archive/` per the ECHO Auto-Archive rule
  (Status `closed` verified first; active `dev/fids/` now holds only `.gitkeep`).
- CHANGELOG v0.0.19 Verification entry updated with the full FID-002..006 record
  (implementation, gates, A-Z GO, Nova PASS, archival).
- This closeout summary.

## Dependencies / open items

- The FID-002..006 implementation remains **uncommitted** working-tree
  modifications (owner: operator commit decision).
- Credential-dependent interactive checks (deep_research invocation, github
  spawn, database round-trip, browser smoke) were DEFERRED in the A-Z audit —
  they require API keys / full CLI runtime and were verified during the FID
  implementation loops.
