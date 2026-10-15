<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Current Release A–Z Audit — Savant-Code v0.0.21 (All Recently-Closed Fixes FID-2026-0806-005 … 015)

**Version:** v0.0.21 (unchanged — the complete fix set ships on the same version
as the knowledge-graph/token-optimization/adversarial/contributor release)

**FIDs under test — Batch A (Nova feature requests + gate failures):**
- FID-2026-0806-005 (ECHO Protocol Enforcement System — session-init hard
  gate, 15-turn refresh, compactor protection)
- FID-2026-0806-006 (Graph Export Interactive Fixes — layout, click, sidebar,
  code preview)
- FID-2026-0806-007 (Startup Playbook Skill — evidence-grounded coaching skill)
- FID-2026-0806-008 (v0.0.21 Gate Failures — SDK build, ESLint, markdownlint)

**FIDs under test — Batch B (fresh-user teardown):**
- FID-2026-0806-009 (BYOK gate — no backend call in direct mode)
- FID-2026-0806-010 (OpenRouter-first boot default)
- FID-2026-0806-011 (visible failures + `--print` headless mode)
- FID-2026-0806-012 (cyclic-safe chat-state serialization)
- FID-2026-0806-013 (strip foreign/dead branding)
- FID-2026-0806-014 (consent-gated auto-update)
- FID-2026-0806-015 (analytics disclosure + first-run notice)

**Regression scope:** knowledge graph + `/graph-export` + `/export`
(FID-2026-0806-002 / FID-2026-0804-007 — re-tested per operator), mode axis
(FID-2026-0805-001), MCP surfaces.

**Purpose:** Fresh end-to-end evidence for ALL recently-closed fixes **before
the operator pushes anything**. Operator decisions honored:
- Version intentionally unchanged at **0.0.21**.
- Backend intentionally NOT deployed — BYOK/direct mode is the only path a
  fresh user can complete.
- Boot default is **OpenRouter** (free tier `openrouter/free`), not OpenCode Go.
- **savant-free stays OUT of official docs** (dead domain, future product —
  will return in a few months). Code/workspace identifiers stay.

## Ground Rules

- Run from the repository root unless a command changes directory explicitly.
- Record exact exit codes and concise output for every check.
- Use `PASS`, `FAIL`, or `DEFERRED`; never convert unavailable interactive or
  credential-dependent checks into `PASS`.
- Do not publish, upload, promote, advertise, commit, or push.
- Do not modify source files; this is a read-only audit. The ONLY writable
  paths are `dev/scratchpad/` (results + harness) and `/tmp/`.
- Live agent sessions consume provider credits; keep prompts minimal and
  budgeted.
- Write the report to `dev/scratchpad/az-test-v0.0.21-all-fixes-results.md`
  using the Report Contract at the end.

## Tier 1 — Build & Type Safety (baseline gates)

### T1.1 — Workspace typechecks ×11
Run each; all must exit 0 (mirrors `protocol.config.yaml` `type_check`):

```text
cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../agents && bun run typecheck && cd ../packages/agent-runtime && bun run typecheck && cd ../packages/code-map && bun run typecheck && cd ../packages/knowledge-graph && bun run typecheck && cd ../packages/database && bun run typecheck && cd ../packages/llm-providers && bun run typecheck && cd ../../cli && bun run typecheck && cd ../evals && bun run typecheck
```

### T1.2 — Full-repo ESLint zero-warnings
`bun x eslint . --max-warnings 0` — must exit 0.

### T1.3 — Markdown lint (repo gate)
`bun run lint:md` — must exit 0.

### T1.4 — Test suites (all workspaces)
Run and record final counts (expected: no failures):

```text
cd sdk && bun test src/
cd cli && bun test                    # expected ~2892 pass / 0 fail
cd common && bun test
cd agents && bun test __tests__
cd evals && bun run test:v2
cd packages/agent-runtime && bun test
cd packages/code-map && bun test
cd packages/knowledge-graph && bun test
cd packages/database && bun test
cd packages/llm-providers && bun test
```

### T1.5 — Version metadata (still 0.0.21 — no bump on this fix set)
`cat VERSION` → `0.0.21`; `grep '"version"'` in root + every workspace
`package.json` → all `0.0.21` — **including the npm-publishable release
wrapper `cli/release/package.json`** (was found stale at `0.0.20` during the
pre-release sweep — a publish blocker: npm would refuse/reuse the old
version). Check: `grep '"version"' cli/release/package.json` → `0.0.21`.
`cli/release-staging/package.json` stays `0.0.1` (staging wrapper) and
`savant-free/cli/release/package.json` keeps its own lineage — do not flag.

### T1.6 — SDK build + verify (FID-2026-0806-008 regression)
```text
cd sdk && bun run build && bun run verify
```
Expected: build exit 0; verify Steps 1-4 pass. This was the FID-008 failure —
the `bun-sqlite.d.ts` stub must include `exec` (`sdk/types/bun-sqlite.d.ts`):
`grep -n 'exec' sdk/types/bun-sqlite.d.ts` → `exec(sql: string): void` present.

## Tier 2 — FID-2026-0806-005: ECHO Protocol Enforcement

### T2.1 — Session-init hard gate (Layer 1)
- `packages/agent-runtime/src/echo/enforcement.ts`:
  `requiredProtocolFile` (default `ECHO.md`, line ~58); `beforeToolCall`
  blocks non-read tools with reason "Must read {requiredProtocolFile} 0-EOF
  before using tools" when `!state.protocolRead` (line ~76-82); the gate
  clears when a read targets the protocol file (line ~313).
- `packages/agent-runtime/src/echo/enforcement-state.ts` / `types.ts`:
  `protocolRead` + `turnCount` in `EnforcementState`.
- Subagent spawn seeds `protocolRead = true` (parent already read).

### T2.2 — 15-turn refresh (Layer 2)
- `packages/agent-runtime/src/echo/protocol-summary.ts` — condensed summary
  util (~800-token bound).
- `loop-iteration.ts` injects it when `turnCount % 15 === 0`.

### T2.3 — Compactor protection (Layer 3)
- `packages/agent-runtime/src/context-compactor.ts` preserves messages
  containing the `<!--echo-critical-->` sentinel (like the preserved-state
  block).

### T2.4 — Unit coverage
```text
cd packages/agent-runtime && bun test src/echo/__tests__/enforcement.test.ts
```
Expected: session-init protocol gate tests (blocks non-read tools, clears on
protocol read, refresh at turn 15, subagent seeding) + pre-write steering.

## Tier 3 — FID-2026-0806-006: Graph Export Interactive Fixes

> The export page issues (nodes bunched up, click dead, no sidebar) were fixed
> here. T9 re-runs the full export pipeline live.

### T3.1 — Layout fix (template.ts)
- `#cy` explicit sizing: `height: min(62vh, 720px); min-height: 420px;
  width: 100%` with `cy.resize()` on window resize + init.
- COSE tuning present: `nodeRepulsion: 8000`, `idealEdgeLength: 80`,
  `componentSpacing: 120`, `gravity: 0.25`, `animate: false`.

### T3.2 — Click + selection
- `cy.on('tap', 'node', …)` (mouse + touch); Ctrl/Meta shortest-path branch;
  visible `node:selected` brand border + glow.

### T3.3 — Sidebar (source parity)
- `<aside id="graph-sidebar">` drawer: header (file path), meta rows (type,
  cluster), Connections list (connected node + edge type + direction), Preview
  block (first 20 lines).
- Opens on node tap; closes on background tap (`e.target === cy`) + close
  button; all values via `textContent` (injection-safe); responsive under
  600px.

### T3.4 — Code preview data
- `packages/knowledge-graph/src/export-serializer.ts`: optional `preview?` per
  file node — first 20 lines, 2,000-char cap, NUL/binary skip, 1 MB size skip.
- `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` opt-out (`cli/src/commands/graph-export.ts:14`,
  `export-serializer.ts:16,61`).
- Privacy comment states the cap ("first 20 lines / 2,000 chars; full contents
  never embedded").

### T3.5 — Unit coverage
```text
cd cli && bun test src/commands/__tests__/graph-export.test.ts
```
Expected: 7 tests incl. preview present/capped/binary-skipped.

## Tier 4 — FID-2026-0806-007: Startup Playbook Skill

### T4.1 — Skill vendored
- `.agents/skills/startup-playbook/SKILL.md` (4 modes: Learn/Practice/Apply/
  Reference; metadata ≤ 150 tokens — 42 words recorded).
- `chapters/` (01-04), `references/` (decision-rules, sources.md,
  provenance.json), `prompts/` (exercise + rubric), `playbooks/`
  (opportunity + safety-power review), `scripts/verify-provenance.ts`.
- Mode files all < 5,000 tokens.

### T4.2 — Provenance drift guard
- `.agents/skills/startup-playbook/scripts/verify-provenance.ts` validates 62
  claim refs against the 29-claim ledger.
- Run it:
```text
cd .agents/skills/startup-playbook && bun scripts/verify-provenance.ts
```
Expected: 62/62 refs clean, exit 0.

### T4.3 — BLAKE3 Merkle
- Deferred as YAGNI debt (recorded in the FID / `dev/YAGNI-LEDGER.md`) — do
  not flag as missing.

## Tier 5 — FID-2026-0806-008: v0.0.21 Gate Failures (regression of the gates themselves)

### T5.1 — SDK build stub
- `sdk/types/bun-sqlite.d.ts` includes `exec(sql: string): void` (T1.6 re-runs
  the failing build).

### T5.2 — ESLint fixes
- `sdk/examples/readme-example-2.ts` import-order fixed; T1.2 re-runs the
  zero-warnings gate.

### T5.3 — markdownlintignore policy
- `.markdownlintignore` covers `dev/scratchpad/`, `dev/nova/` channels, and
  `docs/design/ECHO-Agent-Skills-Integration-Plan.md`; T1.3 re-runs the gate.

## Tier 6 — FID-2026-0806-009: BYOK Gate (no backend call in direct mode)

### T6.1 — Single source of truth
- `sdk/src/env.ts` exports `isDirectProviderMode()` — true when
  `DIRECT_PROVIDER` **or** `INFERENCE_BASE_URL` is set.
- `sdk/src/impl/database.ts`: `finishAgentRun`, `addAgentStep`,
  `fetchAgentFromDatabase` short-circuit in direct mode (5 gate sites).
- `sdk/src/composio.ts` + `sdk/src/client.ts` (healthz) gated in direct mode.
- `startAgentRun` logs the no-backend path at **debug** (not warn).

### T6.2 — Unit coverage
```text
cd sdk && bun test src/__tests__/database.test.ts src/__tests__/env.test.ts src/__tests__/composio.test.ts src/__tests__/client.test.ts
```
Expected: direct-mode gate tests pass, including the env-cleanup that keeps a
user's `.env.local` (`DIRECT_PROVIDER=openrouter`) from leaking across tests.

### T6.3 — No backend call can leak
`grep -n 'isDirectProviderMode' sdk/src/impl/database.ts sdk/src/composio.ts sdk/src/client.ts sdk/src/env.ts`
→ each backend method consults the guard before building a URL or calling
`fetch`.

## Tier 7 — FID-2026-0806-010: OpenRouter-First Boot Default

### T7.1 — Boot default is OpenRouter free tier
- `cli/src/utils/settings.ts`: `DEFAULT_SAVANT_CODE_MODEL_ID = 'openrouter/free'`,
  `DEFAULT_SAVANT_CODE_MODEL_PROVIDER = 'openrouter'`.
- `cli/src/utils/provider-setup.ts`: `PROVIDER_SETUP_DEFAULT = 'openrouter'`.

### T7.2 — SDK routing
- `sdk/src/impl/model-provider.ts`: `isOpenRouterModel` branch routes
  `openrouter/` slugs to `https://openrouter.ai/api/v1` with the resolved key
  (full slug preserved).
- `INFERENCE_BASE_URL` override still wins.
- Key precedence: `OR_MASTER_KEY` → `OPENROUTER_API_KEY` → `INFERENCE_API_KEY`.

### T7.3 — Unit coverage
```text
cd sdk && bun test src/impl/__tests__/model-provider-free-mode.test.ts
cd cli && bun test src/utils/__tests__/settings.test.ts src/utils/__tests__/provider-setup.test.ts
```

## Tier 8 — FID-2026-0806-011: Visible Failures + Headless `--print`

### T8.1 — CLI surface
- `cli/src/cli-args.ts` parses `--print <prompt>`.
- `cli/src/headless-run.ts`: exit `0` success, `1` error or timeout, `2` usage.
- `cli/src/index.tsx` auto-headless on piped stdin or CI.
- `SAVANT_CODE_RUN_TIMEOUT_MS` (default 10 min) aborts hung runs; headless
  client skips `ask_user`.

### T8.2 — Unit coverage
```text
cd cli && bun test src/__tests__/headless-run.test.ts src/__tests__/cli-args.test.ts
```
Expected: 13 headless-run tests + 2 `--print` parse tests.

### T8.3 — [LIVE] headless run (credential-dependent — DEFERRABLE)
```text
SAVANT_CODE_RUN_TIMEOUT_MS=120000 bun cli/src/index.tsx --print "reply with exactly: OK"
```
Expected: answer on stdout, exit 0. No key configured → DEFERRED (DI-based
unit suite is the functional substitute).

## Tier 9 — FID-2026-0806-012: Cyclic-Safe Chat Serialization

### T9.1 — Shared util
- `cli/src/utils/safe-stringify.ts` (WeakSet cycle guard) used by all 4 save
  sites in `cli/src/utils/run-state-storage.ts`.

### T9.2 — Unit coverage
```text
cd cli && bun test src/utils/__tests__/run-state-storage.test.ts
```
Expected: 43 pass / 0 fail incl. cyclic-serialization tests.

## Tier 10 — FID-2026-0806-013: Branding Strip

### T10.1 — Dead domain removed from src
- `grep -rn 'savant-free.com' common/src agents cli/src sdk/src` (excluding
  `*.test.ts` fixtures and `.generated.`) → zero hits.
- `cli/src/agents/bundled-agents.generated.ts` regenerated: 0 `savant-free.com`,
  > 0 `savant-code.com`.
- `common/src/constants/hosts.ts` legacy constant re-pointed to
  `savant-code.com` (comment only); `NEXT_PUBLIC_SAVANT_FREE_APP_URL` is a typed
  fallback in `common/src/env-schema.ts`.

### T10.2 — Official docs carry no savant-free branding (operator directive)
> savant-free is a future product — kept OUT of official docs until it ships.
> The workspace dir + `IS_SAVANT_FREE` code identifiers stay; do not flag code.

- `grep -rn 'SavantFree\\|Savant-Free\\|Savant Free\\|savant-free.com' README.md README.zh-CN.md docs/features.md docs/installation.md docs/privacy.md docs/index.md docs/agents.md docs/agents-and-tools.md cli/README.md cli/release/README.md`
  → zero hits (dated `docs/design/**`, `docs/launch/**`, `docs/reports/**`,
  `docs/research/**` are historical — allowed).
- Zero `savant-free.com` in any `.md`/`.json` outside `dev/` and CHANGELOG.

### T10.3 — Unit coverage
```text
cd cli && bun test src/utils/__tests__/savant-code-api.test.ts
```

## Tier 11 — FID-2026-0806-014: Consent-Gated Auto-Update

### T11.1 — Launcher behavior
- `cli/release-core/launcher.js`: `checkForUpdates` stages + writes a
  pending-update marker — NEVER stops or installs mid-session.
- Next launch: `applyPendingUpdateIfApproved()` prompts y/N; non-TTY defers.
- `SAVANT_CODE_NO_AUTO_UPDATE=1` opts out.

### T11.2 — Unit coverage
```text
cd cli && bun test src/__tests__/release/wrapper-safety.test.ts
node --check cli/release-core/launcher.js
```
Expected: 12 pass / 0 fail (consent-gated flow); launcher syntax valid.

## Tier 12 — FID-2026-0806-015: Analytics Disclosure

### T12.1 — Docs + first-run notice
- `README.md` "Privacy & Telemetry" section (default-on disclosure,
  `/telemetry disable`, ads separate).
- `cli/src/index.tsx` one-line first-run notice to stderr, shown once
  (`settings.analyticsNoticeShown`).
- `docs/privacy.md` documents default + shown-once notice.

### T12.2 — Unit coverage
```text
cd cli && bun test src/utils/__tests__/settings.test.ts
```

## Tier 13 — [RE-TEST] Knowledge Graph + Export (FID-2026-0806-002 + FID-2026-0804-007)

> The `/graph-export` interactive surface (FID-006) is exercised end-to-end
> here. Browser interaction remains DEFERRABLE if browser automation is
> unavailable — the handler harness is the functional substitute.

### T13.1 — Command suite + registry parity
- `/graph refresh` + `/graph-export` resolve; both in
  `cli/src/data/slash-commands.ts`.
- `cd cli && bun test src/commands/__tests__/registry-gating.test.ts` → 5 pass.

### T13.2 — Index + export unit suites
```text
cd cli && bun test src/commands/__tests__/graph-export.test.ts   # 7 tests
cd cli && bun test src/commands/__tests__/export-conversation.test.ts  # 6 tests
cd packages/knowledge-graph && bun test                          # 17 tests
cd packages/code-map && bun test                                 # 51 tests
```

### T13.3 — [LIVE] Graph + export e2e harness (real handlers)
```text
cd cli && bun ../dev/test-prompts/graph-export-e2e.ts
```
Expected: **14 PASS / 0 FAIL** — `/graph refresh` builds `.savant/graph.db`
with incremental skip; `/graph-export` writes a self-contained branded HTML
(inlined logo, offline Font Awesome, Cytoscape + `GRAPH_DATA`); `/export`
writes a self-contained branded HTML (copy buttons, zero network refs).

### T13.4 — [LIVE, DEFERRABLE] Interactive export in browser
Open the exported `savant-graph-*.html` in a browser and verify: nodes are
spread (not bunched), node tap opens the sidebar (path/type/cluster/
connections/preview), background tap closes it, Ctrl+click shortest-path,
fuzzy search, cluster colors, fit button, zero console JS errors. Mark
DEFERRED with reason if browser automation is unavailable — T13.3 + the
template greps in T3 cover the code paths.

### T13.5 — Agent tools + Verifier Law-4 contract
- `common/src/tools/list.ts` registers `query_blast_radius` /
  `query_node_edges` / `query_domain_clusters` (Detective/Scout only).
- Verifier/Thinker remain zero-tool; reachability evidence is harness-computed
  and injected.

## Tier 14 — Regression (previously-certified surfaces)

### T14.1 — Mode axis HYBRID/SCAFFOLD/STRICT/ANALYZE (FID-0805-001)
- `grep -n 'HYBRID' cli/src/utils/constants.ts`; `mode:edit` alias preserved.
- `bun test cli/src/commands/__tests__/mode-command.test.ts`

### T14.2 — ECHO enforcement + ADVERSARIAL (FID-0805-007/004)
- `agents/adversary/adversary.ts` exists; bundle contains it:
  `grep -c 'adversary' cli/src/agents/bundled-agents.generated.ts` → > 0.

### T14.3 — Token optimization / YAGNI (FID-0806-003) — smoke
- `packages/agent-runtime/src/yagni-ladder.ts` exists;
  `bun test packages/agent-runtime/src/__tests__/yagni-ladder.test.ts`

### T14.4 — Contributor system (FID-0806-004)
- `cli/src/commands/contribute.ts` exists; `bun test cli/src/commands/__tests__/contribute.test.ts` → 20 pass.

### T14.5 — MCP surfaces still registered (FID-002..006)
- `deep_research` in `common/src/tools/list.ts`; github / database /
  browser-use agents present.

## Tier 15 — Repo-Wide Audit / Docs / Archival (pre-push gate)

### T15.1 — Version alignment (unchanged)
- `VERSION` = `0.0.21`; all workspace `package.json` = `0.0.21`, including
  the npm-publishable `cli/release/package.json` (see T1.5).

### T15.2 — Docs aligned with the full fix set
- `README.md` + `README.zh-CN.md`: boot default OpenRouter (`openrouter/free`),
  `--print` headless documented, auto-update consent, Privacy & Telemetry
  section, no savant-free branding.
- `docs/features.md`: OpenRouter default boot provider; Headless +
  Consent-Gated Auto-Update sections.
- `docs/installation.md`: OpenRouter default row + headless usage.
- `docs/privacy.md`: update-check consent note + first-run notice; v0.0.21.
- `cli/release/README.md`: OpenRouter default, headless example.
- No stale "MiMo 2.5 default via OpenCode Go":
  `grep -rn 'MiMo 2.5' README.md README.zh-CN.md docs/features.md docs/installation.md cli/release/README.md docs/index.md`
- No savant-free branding in official docs (T10.2).

### T15.3 — CHANGELOG + FIDs + Nova trail
- `CHANGELOG.md` v0.0.21 section covers BOTH batches: "ECHO enforcement +
  graph export + playbook skill + gate fixes (FID-2026-0806-005 … 008)" and
  "Fresh-user teardown fixes (FID-2026-0806-009 … 015)".
- `dev/fids/` has no active FID-*.md; all 11 archived
  (`dev/fids/archive/FID-2026-0806-00{5,6,7,8,9,10,11,12,13,14,15}-*.md` present).
- Nova trail: `dev/nova/inbox/2026-08-06-{echo-enforcement,graph-export-fix,
  startup-playbook}-feature-request.md`, the 005/006/007 audit responses, and
  `2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md` present.
- `dev/nova/inbox/2026-08-06-fresh-user-teardown-response.md` carries the
  implementation-complete update.

### T15.4 — No bloat / stray files
- No tracked `savant-export-*.html` / `savant-graph-*.html`
  (`git ls-files | grep -iE 'savant-(export|graph)'` → empty); both in
  `.gitignore`.
- No stray root artifacts; `.savant/` graph DB untracked.

## Report Contract

Produce `dev/scratchpad/az-test-v0.0.21-all-fixes-results.md`:

```text
# A-Z Results — Savant-Code v0.0.21 (All Recently-Closed Fixes 005–015)

**Date:** <run date>
**Runner:** Savant Orchestrator (read-only audit + live harness)
**Version:** v0.0.21

## Summary

| Tier | Section | Status | Notes |
|------|---------|--------|-------|
| T1 | Build & Type Safety | PASS/FAIL | ... |
| T2 | ECHO enforcement (005) | PASS/FAIL | ... |
| T3 | Graph export interactive (006) | PASS/FAIL | ... |
| T4 | Startup playbook (007) | PASS/FAIL | ... |
| T5 | Gate failures (008) | PASS/FAIL | ... |
| T6 | BYOK gate (009) | PASS/FAIL | ... |
| T7 | OpenRouter-first (010) | PASS/FAIL | ... |
| T8 | Headless --print (011) | PASS/FAIL | ... |
| T9 | Safe serialization (012) | PASS/FAIL | ... |
| T10 | Branding strip (013) | PASS/FAIL | ... |
| T11 | Auto-update consent (014) | PASS/FAIL | ... |
| T12 | Analytics disclosure (015) | PASS/FAIL | ... |
| T13 | Graph/export RE-TEST | PASS/FAIL | ... |
| T14 | Regression | PASS/FAIL | ... |
| T15 | Repo audit / docs / archival | PASS/FAIL | ... |

## Per-check evidence

- <T3.1> PASS — #cy explicit sizing + COSE tuning in template.ts
- <T10.2> PASS — zero savant-free branding in official docs
- ... (one line per check; record exact commands + exit codes)

## GO / NO-GO / GO WITH CAVEATS

<final verdict, one line, with the reason>

## Caveats

- Version intentionally unchanged at 0.0.21 for this fix set.
- Live headless run (T8.3) DEFERRED if no provider key is configured.
- Browser interactive export (T13.4) DEFERRED if browser automation is
  unavailable (handler harness T13.3 is the functional substitute).
```

Final verdict rules: GO requires T1–T12, T14, T15 fully PASS (or documented
DEFERRED with reason). NO-GO on any failure in the safety contract (BYOK gate,
ECHO enforcement gate, env gate), the headless exit-code contract, or the
repo-audit tier (T15).
