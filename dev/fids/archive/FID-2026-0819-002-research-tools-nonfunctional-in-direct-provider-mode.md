# FID: Research tools non-functional in direct-provider mode (read_docs / web_search / deep_research)

**Filename:** `FID-2026-0819-002-research-tools-nonfunctional-in-direct-provider-mode.md`
**ID:** FID-2026-0819-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-19 13:31
**YAGNI-Compliance:** Confirmed (no speculative code — every new facade has a production
caller; the docset module is the net-new minimum required for indexed read_docs)

---

## Summary

In direct-provider mode (`DIRECT_PROVIDER` set — the **default** release-binary boot mode), the
Researcher's `read_docs` tool is a guaranteed failure, and `web_search` / `deep_research` fail the
same way. All three route exclusively through the SavantCode backend web API, which short-circuits
with `"SavantCode backend services are unavailable in direct-provider mode."` The `researcher-docs`
agent has **only** `read_docs`, so it is 100% non-functional in direct-provider mode; the
`researcher-web` agent loses `web_search` and `deep_research`, leaving only the native `read_url`.
Direct (backend-free) API facades already exist in the codebase (`serper-api.ts` `searchWeb`,
`context7-api.ts` `fetchContext7LibraryDocumentation`) but are not wired into the handlers.

**Refined root cause (2026-08-19):** `DIRECT_PROVIDER` is conflated — it correctly routes
*inference* to a provider but incorrectly short-circuits *research*. The operator runs `bun dev`
with `DIRECT_PROVIDER=openrouter` set since day one, so research has been dead the entire time
(not a recent regression). The fix is an architecture decision, not a small wiring change.

## Environment

- **OS:** win32 (reproducible on any OS — the gate is a pure env check)
- **Language/Runtime:** TypeScript / Bun, monorepo `@savant-code/*` @ 0.0.26
- **Commit/State:** `5067dd99` (working tree, pre-implementation)
- **Trigger:** `DIRECT_PROVIDER=openrouter` (set by `cli/scripts/build-binary.ts` for release artifacts)

## Detailed Description

### Problem

Operator ran Savant; a Researcher subagent (`researcher-docs`) tried to fetch Bun documentation and
returned only the error:

> "I'm unable to fetch the documentation … the read_docs tool is returning an error indicating that
> 'SavantCode backend services are unavailable in direct-provider mode.'"

The agent then degraded into "Unable to Complete Research" without any documentation content.

### Expected Behavior

In direct-provider mode, `read_docs` (and the other research tools) should still return real results
by calling the direct Context7 / Serper APIs — the facades already shipped in the codebase — instead
of failing on the backend short-circuit.

### Root Cause

The research tool handlers were migrated to route through the SavantCode backend
(`callDocsSearchAPI` / `callWebSearchAPI` — for backend-side credit accounting, note the
`creditsUsed` field), but no direct-mode fallback was wired. The direct facades remain as dead code.

1. `callSavantCodeV1` returns a hard error for ALL three research endpoints when
   `DIRECT_PROVIDER` is set (`savant-code-web-api.ts:52-58`).
2. `handleReadDocs` calls **only** `callDocsSearchAPI` (`read-docs.ts:76-86`). It imports the
   **type** of the direct Context7 facade `fetchContext7LibraryDocumentation`
   (`read-docs.ts:5`) and its params signature is literally `ParamsExcluding<typeof
   fetchContext7LibraryDocumentation, 'query' | 'topic' | 'tokens'>` (`read-docs.ts:27-31`) — the
   handler still receives `folders`/`logger`/`fetch` for the direct path — yet it never calls the
   direct facade. Strong evidence the handler originally called Context7 directly and was switched
   to backend-only.
3. `handleWebSearch` calls only `callWebSearchAPI` (`web-search.ts:64-78`); `handleDeepResearch`
   wires its `SearchFn` to `callWebSearchAPI` (`deep-research.ts:303-315`).
4. The direct facades exist and are tested but uncalled: `searchWeb` (`serper-api.ts:44`,
   referenced only by its own test) and `fetchContext7LibraryDocumentation`
   (`context7-api.ts:134`, zero callers — only the type import above).
5. Documentation and agent prompts still describe the **direct** backends — `read_docs` is
   "using Context7 API" (`common/src/tools/params/tool/read-docs.ts:31,34`), `web_search` is "using
   Serper API" (`common/src/tools/params/tool/web-search.ts:23,25`), and the `researcher-web`
   prompt says "Use web_search to get Serper JSON search results" (`researcher-web.ts:24`). The
   shipped behavior contradicts all three.
6. `researcher-docs` exposes only `toolNames: ['read_docs']` (`researcher-docs.ts:22`), so it has
   zero working tools in direct-provider mode.

### Evidence

```text
packages/agent-runtime/src/llm-api/savant-code-web-api.ts:39-40
  const isDirectProviderModeRuntime = (): boolean =>
    (process.env.DIRECT_PROVIDER ?? '').trim().length > 0

packages/agent-runtime/src/llm-api/savant-code-web-api.ts:52-58
  if (isDirectProviderModeRuntime()) {
    return {
      error: 'SavantCode backend services are unavailable in direct-provider mode.',
    }
  }
  // endpoint is one of: /api/v1/web-search | /api/v1/docs-search | /api/v1/gravity-index

packages/agent-runtime/src/tools/handlers/tool/read-docs.ts:5
  import type { fetchContext7LibraryDocumentation } from '../../../llm-api/context7-api'
packages/agent-runtime/src/tools/handlers/tool/read-docs.ts:76-86
  const viaWebApi = await callDocsSearchAPI({ libraryTitle, topic, maxTokens: max_tokens, ... })
  if (viaWebApi.error || typeof viaWebApi.documentation !== 'string') { /* returns the error text */ }

agents/researcher/researcher-docs.ts:22
  toolNames: ['read_docs'],

packages/agent-runtime/src/tools/handlers/tool/web-search.ts:64-78
  const webApi = await callWebSearchAPI({ query, depth, ... })  // no direct fallback

packages/agent-runtime/src/tools/handlers/tool/deep-research.ts:303-315
  const search: SearchFn = async (query) => callWebSearchAPI({ query, ... })

packages/agent-runtime/src/llm-api/context7-api.ts:134   fetchContext7LibraryDocumentation  (0 callers)
packages/agent-runtime/src/llm-api/serper-api.ts:44      searchWeb                        (only its own test)

cli/scripts/build-binary.ts:67
  DIRECT_PROVIDER: 'openrouter',   // release binary boots in direct-provider mode by default
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/read-docs.ts`
- `packages/agent-runtime/src/tools/handlers/tool/web-search.ts`
- `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts`
- `agents/researcher/researcher-docs.ts` + `agents/researcher/researcher-web.ts` (affected consumers)
- `packages/agent-runtime/src/llm-api/savant-code-web-api.ts` (the short-circuit + narrow gate)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

(High: research is a core capability and is silently dead in the default boot mode. A workaround
exists — run in backend mode — but that is the non-default path for release binaries.)

## Direction Change (operator, 2026-08-19)

> **The operator redirected this FID.** Wiring the Serper/Context7 direct facades would require
> per-user `SERPER_API_KEY` / `CONTEXT7_API_KEY` — rejected for a multi-thousand-user product
> ("no per-user keys", "not buying a service"). New direction: decouple research from the
> `DIRECT_PROVIDER` flag and build web search + docs retrieval **keyless / self-hosted at $0**.
> Reference selected: **Hound** (`master-fetch`, MIT; keyless metasearch backbone vendored from
> `ddgs`, MIT, attributed via `NOTICE.ddgs.txt`), vendored locally at `master-fetch-master/` for
> study + adaptation. The approach below is superseded by the Converged Plan.

## Direction Change #2 (operator, 2026-08-19) — "make it work, no feature loss"

> The operator's constraint: **research must work with no feature loss.** Nothing is
> dropped: the keyless `ddgs` port is the default `web_search` source; Parallel is kept
> as a **BYOK** source (the user provides `PARALLEL_API_KEY`, not the anonymous tier);
> BYOK is expanded to Parallel/Serper/Tavily/Exa/Firecrawl (web_search) + Context7
> (read_docs), with keys entered via the UI the same way provider keys are saved.
> Reference evidence reviewed: Hound (`master-fetch`, MIT + vendored `ddgs`), Hermes
> Agent research skills (`duckduckgo-search` / `scrapling` / `searxng-search`, MIT),
> and Parallel Search MCP.

## Converged Plan (FINAL, 2026-08-19) — complete in full, nothing deferred

> Operator decisions (2026-08-19): **(1) nothing is dropped** — every source ships;
> (2) Parallel is kept as a **BYOK** source (the user provides their own
> `PARALLEL_API_KEY`), NOT the anonymous keyless tier; (3) the keyless `ddgs` port is the
> default `web_search` source; (4) BYOK is expanded — users enter research API keys in
> the UI, saved the same way provider keys are (`credentials.json`). All steps are in
> scope for this session — no phase-2 deferral.

### Structural fix

- **Swappable search/docs adapter** + **decouple research from `DIRECT_PROVIDER`**:
  inference mode must not gate research availability. Remove/replace the research
  short-circuit in `savant-code-web-api.ts`.
- `deep_research` already injects its `SearchFn` (`deep-research.ts:303-315`); make
  `web_search` and `read_docs` adopt the same pluggable-source shape.

### web_search — keyless default + BYOK (all behind the adapter)

- **Keyless (default):** TS port of Hound's keyless layer (vendored `ddgs`, MIT,
  `NOTICE.ddgs.txt`) — multi-engine scrape (ddg/bing/qwant/mojeek/yahoo/startpage/
  yandex) + per-engine circuit-breaker + consensus ranking + graceful degradation.
  Transport: plain fetch + graceful degradation (curl-impersonate hardening can be
  added later; the adapter keeps it swappable). No keys, free, works out of the box.
- **BYOK (user's own key):** Parallel (`PARALLEL_API_KEY`), Serper (`SERPER_API_KEY`,
  facade exists), Tavily, Exa, Firecrawl. When a key is present that source is primary;
  the keyless port is the fallback. `deep_research` inherits whichever source is active.

### read_docs — keyless + BYOK (all behind the adapter)

- **Keyless search+fetch:** `web_search` to locate official docs pages and return the
  discovered hits (title + link + snippet) as the documentation result, bounded by
  `max_tokens`. Full-page extraction is delegated to the agent's existing SSRF-guarded
  `read_url` tool (the SSRF guard `assertUrlAllowed` lives in the SDK client, the single
  source of truth) — `read_docs` does not duplicate the guard in the runtime.
- **Keyless indexed (docsets) — self-populating cache:** Dash/DevDocs-style SQLite FTS5
  docsets queried via a net-new `bun:sqlite` FTS5 module (NOT `@savant-code/knowledge-graph`,
  a code dependency-graph engine with no full-text search). No server, no download: `read_docs`
  re-discovers docs keylessly and merges them into `~/.savant-code/docsets/<slug>.sqlite`.
  Freshness: each docset stores `fetched_at` + `version` metadata; a 7-day TTL triggers a lazy
  re-search on read, and keyless version detection (npm / PyPI / crates.io / RubyGems /
  proxy.golang.org) pins the search query to the current release so results stay up to date.
  An ambiguous name that resolves in multiple ecosystems is NOT silently pinned — it is
  searched unpinned and the detected candidates are surfaced to the agent for disambiguation.
  Full-page content stays on-demand via `read_url`.
- **BYOK:** Context7 (`CONTEXT7_API_KEY`, facade exists) — indexed precision when the
  user provides a key.

### BYOK key management (UI) — same pattern as provider keys

- Research API keys are entered via the UI (masked input), saved to `credentials.json`
  (a `researchApiKeys` section alongside `providerApiKeys`), applied to the runtime env
  at boot (the `applyPersistedProviderApiKeys` pattern), and never written to chat
  history. Mirrors `saveProviderApiKey` / the `/provider` flow in
  `cli/src/utils/provider-setup.ts`.

## Step Status

- [x] 1. Swappable search/docs adapter + decouple research from `DIRECT_PROVIDER` (structural fix)
- [x] 2. Keyless `web_search` source: TS port of Hound's keyless layer (multi-engine
  scrape + consensus + graceful degradation)
- [x] 3. `deep_research` → `SearchFn` points at the adapter (facade-agnostic inheritance)
- [x] 4. `read_docs` keyless search+fetch (`web_search` + SSRF-guarded `read_url`, bounded budget)
- [x] 5. `read_docs` keyless indexed: SQLite FTS5 docsets — self-populating cache + 7-day TTL
  freshness + keyless version detection (npm/PyPI/crates.io/RubyGems/Go proxy;
  ambiguous-name candidates surfaced, never silently pinned; explicit `ecosystem`
  param lets the agent pin one registry — e.g. `read_docs({ libraryTitle, ecosystem: "go" })`)
- [x] 6. `web_search` BYOK: Parallel + Serper + Tavily + Exa + Firecrawl facades,
  wired behind the adapter
- [x] 7. `read_docs` BYOK: Context7 facade, wired behind the adapter
- [x] 8. BYOK key management UI: research keys entered/saved via UI
  (`credentials.json`), applied at boot, masked, never in chat history

## Proposed Solution (SUPERSEDED — see Direction Change)

### Approach

The former approach (kept for the record) wired the existing direct facades as the
direct-provider-mode path (not merely an on-error fallback,
so the backend is not the coupling point for a mode that by definition has no backend):

- `handleReadDocs` → in direct-provider mode call `fetchContext7LibraryDocumentation`
  (`query: libraryTitle`, `topic`, `tokens: max_tokens`), using the `folders`/`logger`/`fetch`
  params already threaded in. Map `null`/empty to the same error surface as today.
- `handleWebSearch` → in direct-provider mode call `searchWeb` (`SERPER_API_KEY`).
- `handleDeepResearch` → in direct-provider mode, its `SearchFn` calls `searchWeb`; the rest of
  `runDeepResearch` (dedup, scoring, budget) is facade-agnostic and works unchanged.
- Missing direct-API key (`SERPER_API_KEY` / `CONTEXT7_API_KEY`) returns an **actionable** error
  naming the exact key to set — never a silent null.

Detection reuses the runtime's `isDirectProviderModeRuntime()`; a separate decision below covers
whether to widen that gate to match the CLI/SDK (`DIRECT_PROVIDER` OR `INFERENCE_BASE_URL`).

### Steps

1. Add a `directProviderFallback` decision into the three handlers so direct-provider mode bypasses
   the backend web API entirely and calls the direct facade.
2. Map the direct facade result into the handlers' existing `jsonToolResult` output shape
   (`documentation` for read_docs; `result` for web_search; unchanged for deep_research).
3. Emit actionable key-missing errors when `SERPER_API_KEY` / `CONTEXT7_API_KEY` is absent in
   direct-provider mode.
4. Add unit tests: direct-mode read_docs/web_search/deep_research hit the direct facade and produce
   results; missing-key paths return the actionable message.
5. (Decision-gated) Widen `isDirectProviderModeRuntime` to also treat `INFERENCE_BASE_URL` as
   direct mode, matching `sdk/src/env.ts` `isDirectProviderMode` and the CLI.
6. Run typecheck ×4 + agent-runtime suite + lint; verify call-graph reachability of the new wiring.

### Verification

- Unit tests prove the direct facades are invoked in direct-provider mode (mock `searchWeb` /
  `fetchContext7LibraryDocumentation`).
- `bun run --cwd=packages/agent-runtime test` green; typecheck ×4 green; eslint/lint:md green.
- Grep shows the direct facades now have production callers (Law 4).

## Perfection Loop

### Loop iterations (perfection loop run on this FID, 2026-08-19)

- **Loop 1 — RED:** catalogued — backend-only routing + direct-mode short-circuit kills the
  three research tools; direct facades uncalled; docs/prompts describe Serper/Context7;
  `DIRECT_PROVIDER` conflates inference and research.
- **Loop 2 — GREEN (superseded):** wire the Serper/Context7 facades → rejected: per-user keys
  for a multi-thousand-user product.
- **Loop 3 — SELF-CORRECT (superseded):** keyless/self-hosted — TS port of Hound + SQLite
  docsets. Refined further by the operator.
- **Loop 4 — GREEN (final):** "works, no feature loss, nothing deferred" — keyless `ddgs` port
  (default `web_search`) + search+fetch + SQLite docsets (`read_docs`) + BYOK (Parallel/Serper/
  Tavily/Exa/Firecrawl for web_search; Context7 for read_docs) + UI key management, all behind
  the swappable adapter.
- **AUDIT:** Five Questions self-check + missed-questions pass (below) → **converged**. No code
  written; presented to the operator for approval before GREEN.
- **ADVERSARIAL (post-implementation, 2026-08-19):** re-audited the implementation against the
  converged plan. All 8 steps implemented and wired; every previously-dead facade
  (`searchWeb`, `fetchContext7LibraryDocumentation`) and every new facade has a production
  caller (grep-verified). One wording correction surfaced: step 4's "fetch" is delegated to
  the agent's SSRF-guarded `read_url` (the guard lives in the SDK client) rather than duplicated
  in the runtime — the converged-plan bullet was amended to state this exactly. No silent
  deferral: the BYOK UI key path, the keyless port, and the docset pipeline all ship. VERDICT:
  PASS.
- **CHANGE DELTA:** converged plan supersedes the two earlier approaches (kept for the record).

### Missed Questions

1. **Why do the docs/prompts still say "Serper/Context7" if the handlers route to the backend?**
   → The backend proxies Serper (web-search) and Context7 (docs-search); the tool *contract* is
   accurate about the upstream source, but the *implementation* silently depends on a backend that
   direct mode does not have. Fix: make the direct facades the direct-mode implementation so the
   contract and behavior agree in both modes.
2. **Should gravity_index get a direct fallback too?**
   → No — there is no local gravity-index facade, and Gravity Index is a hosted service by design.
   It remains backend-only; out of scope for this FID. (Flagged, not silently absorbed.)
3. **What if the operator has no SERPER_API_KEY / CONTEXT7_API_KEY in direct mode?**
   → Return an actionable error naming the key (mirrors `searchWeb`'s existing "Please set
   SERPER_API_KEY" message). This is strictly better than the current misleading
   "backend services are unavailable" text.
4. **Is the narrow `isDirectProviderModeRuntime` gate (DIRECT_PROVIDER only) itself a bug?**
   → It diverges from `sdk/src/env.ts` and the CLI, which treat `INFERENCE_BASE_URL` alone as direct
   mode too. A user who sets only `INFERENCE_BASE_URL` today falls through to a "Missing base URL or
   API key" error. Folded into Step 5 as a decision-gated fix; presented to the operator rather than
   silently bundled.
5. **What if a BYOK source (Parallel/Serper/etc.) changes terms or is removed?** → the adapter
   makes every source swappable; the keyless ddgs port is the no-key fallback, and the source
   list is additive. Mitigated by graceful degradation + swappable adapter.
6. **Where do BYOK research keys live, and how do they reach the runtime?** → saved to
   `credentials.json` via a UI flow mirroring `saveProviderApiKey` (masked, never in chat history),
   applied to the runtime env at boot. Note: `context7-api.ts` reads `process.env['CONTEXT7_API_KEY']`
   directly while `serper-api.ts` reads an injected `serverEnv` — align them during implementation.
7. **How is read_docs' search+fetch bounded?** → cap search results fetched and total bytes read
   per call (source budget, mirroring deep_research's existing budget).
8. **Does the Parallel result shape map cleanly to the existing tool output?** → v1 maps it
   explicitly; the output contract (`web_search` → `result`, `read_docs` → `documentation`) is
   preserved so agents' expectations don't change.
9. **gravity_index?** → unchanged: no local facade exists; stays backend-only, out of scope.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree on base `5067dd99` (not committed — no commit instruction this session)
- [x] **File:line ranges:**
  - `packages/agent-runtime/src/llm-api/research-sources.ts` — adapter
    (`searchWebSource` L42, `readDocsSource` L105, `keylessReadDocs`, `formatOrganicAsDocumentation`)
  - `packages/agent-runtime/src/llm-api/keyless-search.ts` — keyless Qwant+DDG port (`keylessSearch` L201)
  - `packages/agent-runtime/src/llm-api/byok-search.ts` — Parallel/Tavily/Exa/Firecrawl facades (L68/120/172/233)
  - `packages/agent-runtime/src/llm-api/docset-search.ts` — FTS5 build+query+meta
    (`buildDocset`, `queryDocset`, `buildMatchExpression`, `setDocsetMeta`)
  - `packages/agent-runtime/src/llm-api/docset-cache.ts` — self-populating cache + TTL
    (`cacheDocsetHits`, `readDocsetFreshness`, `queryCachedDocset`)
  - `packages/agent-runtime/src/llm-api/version-detect.ts` — keyless latest-version detection
    (npm / PyPI / crates.io / RubyGems / proxy.golang.org; returns ALL matches so an
    ambiguous name is surfaced for disambiguation rather than first-hit-wins; an
    `ecosystem` option restricts the lookup to one registry)
  - `common/src/tools/params/tool/read-docs.ts` — `ecosystem` enum param
    (`npm`/`pypi`/`crates.io`/`rubygems`/`go`) for explicit per-registry pinning
  - `packages/agent-runtime/src/tools/handlers/tool/{web-search,read-docs,deep-research}.ts`
    — handlers rewired to the adapter (L63/65/336)
  - `packages/agent-runtime/src/llm-api/savant-code-web-api.ts` — research short-circuit removed
  - `cli/src/utils/provider-setup.ts` — `RESEARCH_KEY_SERVICES`, `saveResearchApiKey` (L385),
    `applyPersistedResearchApiKeys` (L375)
  - `cli/src/utils/input-modes.ts` — `researchKeySetup` input mode;
    `cli/src/commands/defs/modes.ts` — `/research-keys` command (L259)
  - `cli/src/commands/router/route-user-prompt.ts` (L254-291) — save handler;
    `cli/src/index.tsx` (L304) — boot apply; `cli/src/components/chat-input-bar.tsx` — masked input
  - `cli/src/data/slash-commands.ts` (L294) — menu entry; `scripts/build-docset.ts` — build pipeline
  - [x] **Gate output:** typecheck ×4 exit 0; agent-runtime 1103 pass / 0 fail;
  CLI 3242 pass / 0 fail (18 skip); eslint on changed files 0 errors / 0 warnings;
  prettier clean; FID markdownlint clean. (Full-repo eslint/lint:md still show
  pre-existing issues in files untouched by this FID — enforcement.ts,
  knowledge-graph export test, llm-providers test, and the desktop-app docs.)
- [x] **Reproducibility:** `cd packages/agent-runtime && bun test`; `cd cli && bun test`; typecheck ×4;
  `bun scripts/build-docset.ts <dir> <out.sqlite>` smoke-builds a docset from markdown.
- [x] **Step statuses:** all 8 `[x]` (see Step Status).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-08-19
- **Fix Description:** research decoupled from `DIRECT_PROVIDER` via a swappable adapter; `web_search`
  keyless (Qwant+DDG) + BYOK (Serper/Parallel/Tavily/Exa/Firecrawl); `read_docs` keyless (SQLite FTS5
  docsets + search-derived hits) + BYOK (Context7); `deep_research` inherits via `SearchFn`; BYOK keys
  entered via `/research-keys`, saved to `credentials.json`, applied at boot, masked.
- **Tests Added:** keyless-search (7), research-sources (5), byok-search (8), docset-search (7),
  docset-cache (7), version-detect (11), provider-setup research-key cases (5),
  read-docs-tool ecosystem passthrough (1).
- **Verification Evidence:** typecheck ×4 exit 0; agent-runtime 1103/0; CLI 3242/0; eslint (changed
  files) clean; prettier clean; call-graph grep shows every facade has a production caller.
- **Archived:** 2026-08-19 (`dev/fids/archive/FID-2026-0819-002-research-tools-nonfunctional-in-direct-provider-mode.md`).

## Lessons Learned

1. A mode gate (`DIRECT_PROVIDER`) that silently short-circuits a tool must be paired with a
   local/swappable fallback for any capability that is not backend-owned — otherwise the default
   boot mode loses the capability with no visible error.
2. "Free web search" is two decisions: the transport (scrape vs API) and the anti-bot layer (TLS
   fingerprinting). The search logic ports trivially; the anti-bot layer is the entire cost. A
   swappable-adapter boundary lets a keyless scrape ship now and a paid API or proxy slot in later
   without rework.
3. Vendored reference codebases (`master-fetch-master/`) must be ignored by eslint/prettier/
   markdownlint the same way as `resources/` and `devvy-main/`, or a third-party snapshot fails the
   pre-push gates.
4. `bun:sqlite` FTS5 works for docsets, but never `rmSync` a just-closed SQLite file on Windows —
   rebuild in place (DROP + recreate) instead.
