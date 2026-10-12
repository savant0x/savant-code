# FID: Tiarina Cloud AI Gateway provider integration

**Filename:** `FID-2026-1012-005-tiarina-cloud-provider.md`
**ID:** FID-2026-1012-005
**Severity:** medium
**Status:** closed
**Created:** 2026-10-12
**Closed:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Passed

---

## Summary

Register **Tiarina Cloud** (`ai.tiarina.cloud`) as a built-in provider with a
checked-in static catalog, `/provider` setup, exact model-ID routing, and
generated references — through the existing registry contract, with no new
adapter.

The operator supplied the provider's console URL
(`https://console.tiarina.cloud/ai#models`), which is the fourth provider the
register's T119 entry was waiting on ("a possible fourth provider needs its
name or URL"). This FID names it and records the intake evidence.

Two measured facts shape the plan: the vendor's "Anthropic-compatible" claim
is **refuted on the wire** (keyed `POST /v1/messages` → 404 under both
authentication shapes), so the entry must not claim dual protocol; and the
catalog publishes **no context window on any of its 19 rows**, so window
coverage is a fallback-table obligation rather than a runtime read. The
operator's key landed on 2026-10-12 and the keyed acceptance leg passed. The
Perfection Loop has since run on this document (see Perfection Loop): the
conformance decision is a **checked-in static catalog**, the ChatAnywhere
precedent for this exact catalog shape — not a live fetch.

## Environment

- **OS:** Windows (`C:\Users\spenc\dev\savant-code`), bash (Git Bash).
- **Language/Runtime:** TypeScript monorepo; Bun 1.3.14.
- **Commit/State:** HEAD `09d212eb`. The working tree carries unrelated
  in-flight work (FID-2026-1012-004). This FID's evidence was collected with
  read-only probes and no product edit; this record does not commit or push.
- **Governance:** Single-agent ECHO; `dev/echo-v0.1.2-single-agent.md` read
  0-EOF before planning; contract `protocol.config.yaml`
  (`single_agent.protocol` 0.1.2-single-agent, `session.autonomy_level: 3`).
- **Keyed legs (2026-10-12):** the operator placed `TIARINA_API_KEY` in
  `.env.local`; the keyed evidence below ran against it. The value was read
  into a shell variable, sent only in request headers, never printed, and
  never written to an artifact (checked: no occurrence of the value anywhere
  under `dev/scratchpad/active/tiarina-2026-10-12/`).
- **Evidence class:** every probe below is `api-public` (an unauthenticated
  provider endpoint, `GET`/keyless `POST` only, no credentials, no inference
  billed). Vendor marketing is `reported-unverified` and is labelled as such.

## Detailed Description

### Problem

Tiarina Cloud is absent from `PROVIDER_REGISTRY`, so it cannot be selected in
`/provider`, contributes no routing prefix, and has no catalog, credential
resolution, readiness guidance, or generated documentation. A repository-wide
case-insensitive search for `tiarina` returns exactly one match — a dated
idea-shelf note, not an integration:

```text
dev/idea-shelf/free-llm-api-directory-2026-10.md:73:
xKiro, CleanAPIs, GreenPower, Tiarina ("Tiarina Cloud" exists only as Twitter
mentions), MiniMax Code official download page.
```

That note was recorded 2026-10-07 under a "NOT FOUND — searched, zero
confident hits" heading. It is superseded: `ai.tiarina.cloud` resolves and
serves a live gateway. The note is a dated claim, not a fact about today.

### Expected Behavior

| Field | Value | Basis |
|---|---|---|
| Registry ID | `tiarina` | `<ID>_API_KEY` convention; `slugForHost` derivation in `scripts/providers/propose-provider.ts` |
| Label | `Tiarina Cloud` | vendor site title (`tiarina.cloud`) |
| Kind | `gateway` | host is a hosted endpoint, not a local daemon |
| Credential | `TIARINA_API_KEY` | every registry gateway follows `<ID>_API_KEY`; `.env.example:58-144` |
| API root | `https://ai.tiarina.cloud/v1` | `GET /v1/models` → 401 (route exists, key required); `GET /` → 404 |
| Protocol | `openai` (single) | keyless `POST /v1/chat/completions` → 401; **keyed → 200**; keyed `POST /v1/messages` → 404 under both auth shapes |
| ID transform | `strip` (confirmed) | all 19 catalog ids are bare — no upstream `vendor/` prefix to preserve |
| Catalog | `static`, `modelsRef: 'tiarina'` — 19 checked-in ids | conformance decision: the keyed `/v1/models` publishes no window fields, so the audited allowlist is the source of truth (chatanywhere precedent) |
| Windows | `table-section` + `NO_PUBLISH_GATEWAY_IDS` membership | 0 of 19 runtime rows carry a window; register membership is what enforces the seam file and the window-truth suite |
| Domain | `tiarina.cloud` | favicon/logo derivation |
| Order | `4` | unknown providers sort at 4; the tie is intentional |

The provider appears in `/provider` setup, persists like every other gateway,
routes `tiarina/<id>` through the generic SDK factory, and appears in the
generated `.env.example` gateway block, `README.md`, `cli/release/README.md`
and the `docs/providers.md` registry table.

**This FID does not claim the Anthropic half of the vendor's compatibility
claim.** No Anthropic-shaped route exists at any probed prefix, so the entry
must not be `openai-anthropic` (which would additionally require a
`protocolMap` and the `dual-protocol` exception — fail-closed by
`validateProviderRegistry`).

### Root Cause

Nothing has attempted the integration; there is no defect to repair. The
blocking conditions are procedural and evidentiary, not architectural:

1. The provider is **not a tracked discovery candidate**. It is absent from
   `dev/provider-candidates/candidates.json` (`_meta.hostCount: 72`), so
   `scripts/providers/propose-provider.ts` **refuses by design**
   (`isTrackableCandidateHost`, FID-2026-0916-001 MQ3). The harvest path
   cannot scaffold this entry; the FID seed-intake path is the lawful route.
2. The keyed legs **have run** (evidence below) and what they measure is the
   conformance decision: a keyed, 19-row catalog whose items carry only
   `id/object/created/owned_by` — the same shape `chatanywhere` was registered
   with as a **static** allowlist, and the repo's audited-allowlist rule
   (HCNSec/TokenBom/Infron/UnoRouter/BazaarLink) says measured dead channels
   and un-audited additions must not flow straight into the picker.
3. The **console roster is behind a login** (`console.tiarina.cloud/ai#models`
   is a client-rendered SPA: `read_url` retrieves only the shell — verified
   `title: "Tiarina Cloud"`, zero body text), so the model list is not
   obtainable without either the key or an authenticated browser render.

### Evidence

Keyless live probe, 2026-10-12 (no credentials sent, no inference performed):

| Request | Result | Interpretation |
|---|---|---|
| `GET https://ai.tiarina.cloud/health` | **200** `{"ok":true,"catalog_age_ms":84006,"queue_depth":0}` | Public health; a cached vendor catalog and a request queue exist |
| `GET https://ai.tiarina.cloud/v1/models` | **401** `{"error":{"message":"Missing or invalid Authorization header.","type":"invalid_request_error","code":"invalid_api_key"}}` | Catalog route exists; key required |
| `POST https://ai.tiarina.cloud/v1/chat/completions` (keyless, 1-token body) | **401**, same envelope | Chat route exists; **not an open relay** |
| `POST /v1/messages`, `/v1/embeddings`, `/v1/responses`, `/anthropic/v1/messages`, `/v1/anthropic/messages`, `/claude/v1/messages` | **404** `{"error":{...,"code":"not_found"}}` | No Anthropic/Responses/embeddings surface at any probed prefix |
| `GET /`, `/v1`, `/models` | **404** | No root listing |
| `GET console.tiarina.cloud/api/models` | 200 HTML shell (no JSON) | Console API is not public |

Response headers record `Server: cloudflare`, `CF-RAY: ...-ATL`, so the
gateway is Cloudflare-fronted. The keyless `POST` returning 401 rather than a
completion is the load-bearing negative: the discovery pipeline's
`open-relay-reject` hard-exclude (unauthenticated generation succeeding —
LLMjacking class, `scripts/providers/propose-provider.ts`) **does not apply**.

Vendor surface (`reported-unverified`, from `tiarina.cloud` and the operator's
own Threads posts — leads, never evidence):

- `tiarina.cloud` is an Indonesian PaaS: deploy from Git/Docker/ZIP, free
  subdomains, VPS, managed database, S3-compatible storage, and the AI
  Gateway; prepaid in Rupiah on 30-day cycles. `tiarina.id` is a separate
  AI chat/coding platform.
- "Satu API key buat beberapa model, kompatibel OpenAI dan Anthropic" (one
  key, several models, OpenAI- and Anthropic-compatible).
- Free models "DeepSeek dan GLM", "gratis tidak perlu topup, cukup login dan
  buat api key" (free without top-up; log in, create a key); paid plans named
  Go / Plus / Pro.

Repository facts that constrain the change:

- `common/src/providers/registry-partitioned-2.ts` is **267 lines** against
  the absolute 300-line ceiling (`protocol.config.yaml quality.max_file_lines`),
  so the entry fits without creating a new partition.
- The registry currently holds **26** providers (`registry.ts` 8 inline +
  10 + 8 partitioned), pinned by
  `common/src/providers/__tests__/provider-registry.test.ts:26`
  (`test('covers all twenty-six current providers', ...)`) — the closed-world
  pin this change must widen to 27.
- `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts:34-45`
  fails closed in both directions: every registry provider needs a
  `WINDOW_COVERAGE_REGISTER` disposition, and no stale entries may exist.
- `common/src/providers/__tests__/provider-audit.test.ts` +
  `scripts/validate-repository.ts:183` enforce the exception manifest:
  a `live` catalog requires a `live-catalog` entry whose `owner`/`evidence`
  paths exist on disk.
- `cli/src/utils/openrouter-models/gateway.ts` (291 lines) fans out with
  `Promise.allSettled` and `gateway-live-results.ts` (161 lines) destructures
  the settled results **by position** — a new live source must be inserted
  before the custom-catalogs tail, or catalogs silently resolve under the
  wrong provider with no failing test.
- House pattern for a provider's own test:
  `cli/src/utils/openrouter-models/__tests__/fid-2026-0916-005-atria.test.ts`,
  `fid-2026-1004-008-intern.test.ts`, `fid-2026-1009-005-mistral.test.ts`.

Keyed probe, 2026-10-12 (`Authorization: Bearer` `TIARINA_API_KEY`; raw
artifacts under `dev/scratchpad/active/tiarina-2026-10-12/`, key-free by
construction and verified key-free):

| Request | Result |
|---|---|
| `GET /v1/models` | **200** — 19 rows, 19 unique ids; every item carries only `id, object, created, owned_by`; **0 of 19 rows publish a window field** |
| `POST /v1/chat/completions` `glm-5.3-flash:free` (`max_tokens: 200`) | **200** — `content: "TIARINA-OK"` (exact echo), `finish_reason: stop`, `completion_tokens: 157`; message keys `role,content,reasoning_content` |
| `POST /v1/chat/completions` `deepseek-v4-flash:free` | **200** — `content: "TIARINA-OK"` |
| `POST /v1/chat/completions` `qwen3.8-flash:free` | **502** — body verbatim `error code: 502` (Cloudflare origin-failure shape, not a JSON error envelope) |
| `POST /v1/chat/completions` `deepseek-v4.1-flash:free`, `mimo-v2.6-flash:free` | **429** `{"error":{"message":"The provider is rate limiting this model. Try again shortly.","type":"rate_limit_error","code":"rate_limit_exceeded"}}` |
| `POST /v1/messages` keyed (`Authorization: Bearer` **and** `x-api-key`) | **404** `not_found` |

The roster (`ids.txt`, raw JSON in `models.json`) contains 12 bare-size ids
plus 7 suffixed variants: `deepseek-v4.1-flash`, `deepseek-v4.1-flash:free`,
`deepseek-v4-flash:free`, `deepseek-v4-pro`, `deepseek-v4-pro:cloudflare`,
`kimi-k3`, `kimi-k2.7-code`, `kimi-k2.6`, `glm-5.3`, `glm-5.3:cloudflare`,
`glm-5.3-flash:free`, `glm-5.2`, `glm-4.7-flash`, `qwen3.8-flash`,
`qwen3.8-flash:free`, `qwen3.7-plus`, `qwen3.8-max`, `mimo-v2.6-flash:free`,
`gpt-oss-120b`. Two of the five probed free ids completed; one upstream 502
and two 429s were observed in the same session — a route-level failure that
does not fail the provider (gauntlet rule), but it does mean the free lane is
rate-limited in practice and the operator's "full catalog" intent will meet
429s on some ids.

Observed above the standard OpenAI envelope:

- `usage` carries a non-standard `neurons` member (`{"prompt_tokens":21,
  "completion_tokens":16,"total_tokens":37,
  "prompt_tokens_details":{"cached_tokens":0},"neurons":1.0136364698410034}`)
  — the billing unit Cloudflare Workers AI publishes, consistent with the
  catalog's `:cloudflare`-suffixed ids. Recorded as an observation, not as a
  routing conclusion.
- Responses carry `x-request-id` and `CF-RAY`; no `x-ratelimit-*` headers are
  exposed, so quota state is not readable from headers.
- The console model list is login-gated (`console.tiarina.cloud/ai#models` is
  a client-rendered SPA), so the keyed `/v1/models` response is the roster of
  record for this FID.

Contract seams measured in the loop's RED round (tool-verified, not
estimated). Every one is a real edit target for this plan:

| Seam | Fact |
|---|---|
| `common/src/constants/model-config/gateway-catalogs.ts` | 229 lines; `chatanywhereModels` (the static-but-live-catalog precedent) ends at 229 |
| `common/src/providers/model-catalogs.ts` | `MODEL_CATALOGS` is the compile-checked `modelsRef` registry (12 entries today) |
| `common/src/providers/registry-partitioned-2.ts` | 267 lines against the 300 cap — the Tiarina entry may **not** fit; the runbook's rule is a new partition |
| `common/src/constants/window-coverage-register.ts` | 266 lines; `NO_PUBLISH_GATEWAY_IDS` is `['apinex','bai','chatanywhere','kiosapi']` |
| `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts` | four fail-closed assertions; for each `NO_PUBLISH_GATEWAY_IDS` member it requires a `context-window-table-<id>.ts` **and** a `window-truth-<id>.test.ts` to exist |
| `common/src/constants/context-window-table.ts` | 271 lines; seam files are spread at 264-270 (kiosapi/apinex/bai/chatanywhere) |
| `cli/src/utils/openrouter-models/chatanywhere.ts` | 32 lines — the static-builder template (`getContextWindowFallback(id).contextWindow`) |
| `cli/src/utils/openrouter-models/gateway-catalog-merge.ts` | static builders merge here; `...live.customModels` is **last** by design |
| `common/src/providers/__tests__/provider-registry.test.ts:26` | `test('covers all twenty-six current providers')` pins the sorted id list |
| `scripts/provider-catalog-parity.ts` | committed census `common/src/constants/provider-catalog-census.json`; regeneration is `bun run providers:parity`, CI check `providers:parity:check`; `catalogPairingIssues` only constrains `modelsRef` providers |
| `cli/src/utils/provider-credentials.ts` | `resolveProviderApiKey(providerId)` is the credential seam live wrappers use — **the runbook's `process.env.X` example is drift** |
| `packages/agent-runtime/src/echo/fid-validator.ts:85` + `scripts/fid-ledger-steps.ts` | a `converged`/`closed` FID carrying an unresolved step is an **error**; the pre-write gate blocks the write (`pre-write-gates-fid.ts:79-90`) |

Discovered while reviewing (a work item, recorded not dropped):
`.env.example:152` cites task `T146` for the hand-maintained pre-registration
probe block (`GEAIX_API_KEY=` / `EXCELNT_API_KEY=`, lines 150-163), but the
register carries that work as **T147** and no `T146` exists in `SCOPE.md`.
Step 13 below handles it.

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-2.ts` — the registry entry
  (or a new `registry-partitioned-3.ts` if the 300-line cap is hit)
- `common/src/constants/model-config/gateway-catalogs.ts` — the `tiarinaModels`
  map (19 ids) + barrel export
- `common/src/providers/model-catalogs.ts` — `MODEL_CATALOGS` registration
- `common/src/constants/window-coverage-register.ts` — coverage disposition +
  `NO_PUBLISH_GATEWAY_IDS` membership
- `common/src/constants/context-window-table-tiarina.ts` — window seam (new)
- `common/src/constants/context-window-table.ts` — the seam spread
- `common/src/providers/__tests__/provider-registry.test.ts` — closed-world pin 26 → 27
- `cli/src/utils/openrouter-models/tiarina.ts` — static builder (new)
- `cli/src/utils/openrouter-models/gateway-catalog-merge.ts` — picker merge
- `cli/src/utils/openrouter-models/__tests__/fid-2026-1012-005-tiarina.test.ts` — provider test (new)
- `docs/providers.md`, `.env.example`, `README.md`, `cli/release/README.md` —
  provider surfaces (generated); `README.zh-CN.md` (hand-maintained mirror)
- `dev/scratchpad/active/tiarina-2026-10-12/` — measured evidence (`models.json`, `ids.txt`, chat/probe responses, `chat-headers.txt`)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Wrong registry entry, missing coverage disposition or a
      a wrong or stale static allowlist, an unpinned window row, or a merge
      placed after the custom-catalogs tail degrades provider selection. The
      closed-world gates catch the structural half; the window *values* and the
      channel-id routing leg are the halves that only tests and acceptance
      catch.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Follow `docs/adding-a-provider.md` exactly (the live contract; the archived
`docs/archive/design/Adding New Providers.md` is superseded). One typed
registry entry plus the things its shape *implies*: the checked-in catalog map
(`modelsRef`), the coverage disposition and its window seam file, the static
CLI builder wired into the picker merge, and the tests. This shape derives
**zero** exception kinds, so no `provider-exception-manifest.ts` entry may
exist for it (a stale kind fails `validateProviderAudit` closed). No new
adapter is created — the OpenAI chat surface is already served by the generic
`createProviderModel` factory.

### Steps

1. **Keyed ground truth — `implemented` (2026-10-12).** `GET /v1/models`
   returned 19 bare ids, confirming `idTransform: 'strip'`; a real
   `POST /v1/chat/completions` round-trip on `glm-5.3-flash:free` returned
   `TIARINA-OK` at `finish_reason: stop`; keyed `/v1/messages` returned 404
   under both auth shapes, settling the Anthropic claim. Remaining inside
   this step: no non-free id has been exercised (the operator's balance was
   not spent) and the roster has not been re-probed on a second day.
2. **The checked-in catalog map** — add `tiarinaModels` (all 19 measured ids,
   each carrying the `tiarina/` routing prefix, e.g.
   `tiarina_glm_5_3_flash_free: 'tiarina/glm-5.3-flash:free'`) to
   `common/src/constants/model-config/gateway-catalogs.ts` (229 lines — room
   under the cap) and export it through the `model-config.ts` barrel
   (the `chatanywhereModels` pattern; display names are the vendor's own bare
   ids, deliberately unchecked-in naming aside from the keys).
3. **Register the map** in `MODEL_CATALOGS` (`common/src/providers/model-catalogs.ts`)
   as `tiarina: tiarinaModels` — `modelsRef` is `keyof typeof MODEL_CATALOGS`,
   so this reference is compile-checked.
4. **Registry entry** in `common/src/providers/registry-partitioned-2.ts`:
   `id/label` `tiarina`/`Tiarina Cloud`, `kind: 'gateway'`,
   `credentials.envVar: 'TIARINA_API_KEY'`, `baseUrl:
   'https://ai.tiarina.cloud/v1'`, `protocol: 'openai'`, `idTransform: 'strip'`,
   `catalog: { source: 'static', modelsRef: 'tiarina' }`,
   `setupAvailable: true`, `domain: 'tiarina.cloud'`, `order: 4`, with a comment
   carrying the probe receipt (keyed roster shape, date, the refuted Anthropic
   claim). That file is 267/300 lines: **measure after writing** — if the entry
   pushes it past the cap, create `registry-partitioned-3.ts` and spread it in
   `registry.ts` (the runbook's rule; do not grow a partition past 300).
5. **Windows** — in `common/src/constants/window-coverage-register.ts`: add
   `'tiarina'` to `NO_PUBLISH_GATEWAY_IDS` and a `table-section` entry whose
   `note` carries the 2026-10-12 counts (`19 rows, 0 window fields`).
   Membership is what makes the next two steps mandatory.
6. **The window seam file** `common/src/constants/context-window-table-tiarina.ts`
   (new, the chatanywhere shape): `TIARINA_CONTEXT_WINDOW_FALLBACKS` rows
   sourced **only** by cross-gateway consensus (>=2 existing rows for the same
   upstream model, cited inline), single-source rows flagged NEEDS-REVIEW, and
   `TIARINA_NO_ROW_IDS` for ids with no row (they keep the flagged 200k
   default); spread it in `context-window-table.ts` (271 lines — import + 3
   spread lines fit) next to the other seam spreads. **Write the measured
   values from the Step 6 row plan** (18 rows + 1 documented no-row id); they
   are read off existing table rows and must not be re-derived from family
   knowledge.
7. **The CLI builder** `cli/src/utils/openrouter-models/tiarina.ts` (new, 32-line
   `chatanywhere.ts` template): `fetchTiarinaModels()` returns one row per
   catalog id with `provider: 'tiarina'` and
   `contextLength: getContextWindowFallback(id).contextWindow`; synchronous, no
   network, no key.
8. **Merge it into the picker** — `...fetchTiarinaModels()` in
   `assembleGatewayCatalog` (`cli/src/utils/openrouter-models/gateway-catalog-merge.ts`),
   in the static block and **before** `...live.customModels`, which stays last.
9. **Widen the closed-world pin** — `common/src/providers/__tests__/provider-registry.test.ts:26`:
   add `'tiarina'` to the sorted list and retitle the test 26 → 27.
10. **The provider's own tests** (two new files, both mandatory):
    `cli/src/utils/openrouter-models/__tests__/fid-2026-1012-005-tiarina.test.ts`
    (the `intern` template: catalog == the 19 probed ids, the builder serves each
    id with its pinned window compared against an **independent** oracle, the
    registry shape, the `table-section` disposition, and **zero**
    exception-manifest entries for `tiarina`) and
    `cli/src/utils/openrouter-models/__tests__/window-truth-tiarina.test.ts`
    (required by `NO_PUBLISH_GATEWAY_IDS` membership).
11. **Regenerate the census** — `bun run providers:parity` (needs the key +
    network) so `common/src/constants/provider-catalog-census.json` gains
    `tiarina`; confirm `providers:parity:check` and `window-coverage:check` are
    clean. Never hand-edit the census.
12. **Regenerate and reconcile the surfaces** — `bun run generate:provider-docs`
    (`.env.example` gateway block, `README.md` / `cli/release/README.md`
    provider tables, `docs/providers.md` registry table), then
    `generate:provider-docs:check` and the `handSurfaceDrift` surfaces it names
    (root README provider bullet, quick-start command list, dispatch prefix
    list, env-var reference, dotenv release template, `README.zh-CN.md`
    mirrors). Update `docs/providers.md` prose by hand.
13. **Doc fixes this loop discovered** — (a) `docs/adding-a-provider.md`'s
    live-catalog example resolves the key with `process.env.MYPROVIDER_API_KEY`
    while every shipped wrapper uses `resolveProviderApiKey(providerId)`
    (`cli/src/utils/openrouter-models/mistral.ts:64-68`); (b) the
    `.env.example:152` task reference names `T146`, which is not registered (the
    work is T147). **Partially blocked:** the `.env` half of (b) is
    operator-owned (steering `no-write-dotenv`) and sits deliberately outside
    the generated section, so it needs an operator edit; (a) is ours to fix.
14. **Close** — the production-chain acceptance round-trip on
    `tiarina/glm-5.3-flash:free`, all declared gates, a local path-scoped commit
    (G2), the CHANGELOG entry, the archive move, and the archive logged in the
    session summary.

### Verification

- Keyed acceptance: one real completion through `tiarina/<model-id>`, plus a
  recorded model count — catalog reachability and inference reachability are
  **two** separate checks (the runbook's Nous 424-row counter-example).
  Already satisfied at the raw-endpoint layer (`glm-5.3-flash:free` → 200,
  exact echo, and `deepseek-v4-flash:free` → 200); the production-chain leg
  runs once the registry entry exists.
- Hermetic suites: the new provider test, `provider-registry.test.ts` (27),
  `provider-audit.test.ts`, `window-coverage-register.test.ts`,
  `gateway-coverage.test.ts`, `validate-provider-registry.test.ts`.
- Gates: typecheck `common`, `cli`, `sdk`, `packages/agent-runtime`;
  `generate:provider-docs:check`; eslint `--max-warnings 0`; `lint:md`;
  prettier; `quality`.

> Every promised test artifact is named above with its repo-relative path.
> The `- gate:` declarations and their receipt land when the status flips to
> `fixed`/`verified` (FID-2026-0823-009): pre-implementation the declared test
> files do not exist yet, so declaring them now would make
> `validate:repository` re-run a nonexistent path. No gates are claimed here.

## Perfection Loop### Loop 1 — RED / GREEN / AUDIT / ADVERSARIAL

**RED.** Intake is complete and evidence-backed: the keyed probe (roster, two
free-lane completions, the keyed `/v1/messages` 404) plus the contract-seam
table above, which replaces line-count estimates with the real edit targets and
the exact tests that police each one. Two blockers are named rather than
assumed: the operator-owned `.env` surfaces (steps 11 and 12) and the fact that
the harvest/propose path refuses this host by design. RED also surfaced a
runbook defect — `docs/adding-a-provider.md`'s live-catalog example resolves
the key with `process.env.X`, while every shipped wrapper uses
`resolveProviderApiKey(providerId)` (`cli/src/utils/provider-credentials.ts`),
which is the seam that sees keys entered through `/provider`. Recorded; the
step-13 doc fix owns it.

**GREEN.** The plan below is rewritten from the live plan to a **static
catalog**, for measured reasons rather than taste:

1. The catalog publishes **no** window field on any of 19 rows, so a live fetch
   would still need the same fallback-table section — the live path buys no
   window coverage.
2. The shape is `chatanywhere`'s verbatim (keyed catalog, `id/object/created/
   owned_by` rows, small roster, no windows). The repo decided **static** there,
   and `intern`/`atria`/`bazaarlink` follow the same audited-allowlist rule
   because live listings had measured dead channels and substitutions.
3. Statism removes the entire positional-ladder hazard: the settled ladder in
   `gateway-live-results.ts` is a silent-contract seam (a wrong insertion
   populates catalogs under the wrong provider with no failing test), and a
   static builder merges through `gateway-catalog-merge.ts` instead.
4. It also removes the `live-catalog` exception entirely: this shape derives
   **zero** exception kinds, so no manifest entry may exist (the `intern` test
   asserts exactly that).

**AUDIT** (plan-level, against the tree — tool output, not self-report): every
seam in the contract table exists at the stated size; the fail-closed tests are
real (`window-coverage-register.test.ts:34/41/48/57/67`, `provider-audit.test.ts`,
`provider-registry.test.ts:26`); the four repo gates declared for this record's
own artifacts pass (`validate-repository`, `scope-register`, `scope-guard`,
`markdownlint`, Prettier — pasted under Code Verification Evidence).
Implementation-level gates remain **cannot-run**: the artifacts they would name
do not exist. `NEEDS-REVIEW`: the identity/hardware gauntlet has not run, and
no non-free/channel id was exercised.

**ADVERSARIAL** (fresh challenge, each resolved — refuted or accepted):

| Challenge | Verdict |
|---|---|
| "The operator wants the full catalog, so live is required." | **Refuted.** Static checks in the full measured roster (19 ids including every `:free` and `:cloudflare` variant); the operator's point was not to wire one model, and both paths satisfy it. |
| "Windows can be read from the catalog instead of pinned." | **Refuted.** 0/19 rows publish a window; `table-section` is forced and the register test requires table rows. |
| "Cross-gateway rows are trustworthy." | **Accepted with the repo's guard.** The chatanywhere sourcing rule stands: >=2-row consensus, single-source rows flagged NEEDS-REVIEW, no family guesses, and a documented `NO_ROW_IDS` list rather than an invented window. The AUDIT round measured that list to be **one** id (`glm-4.7-flash`), not empty — see the Step 6 row plan. |
| "`tiarina/glm-5.3:cloudflare` routing is proven." | **NEEDS-REVIEW.** `strip` removes exactly one internal prefix by construction, but the channel-suffixed ids were never exercised (no free offer). Paid/channel verification belongs to the acceptance step. |
| "A static allowlist can go stale as the vendor rotates its free lane." | **Accepted, dated.** Identical trade-off to chatanywhere; the FID records the probe date and the registry comment carries the evidence, so staleness is visible rather than silent. |
| "The window test could pass vacuously." | **Accepted as a build rule.** The `intern` audit found exactly this: comparing the fetcher to the same table it reads is a tautology. The new suite must compare against independently probed values. |
| "`NO_PUBLISH_GATEWAY_IDS` membership is optional." | **Refuted.** Membership is the truthful classification and is what mechanically enforces the seam file + window-truth suite. Omitting it drops the guard built for this exact shape. |
| "The document is loop-complete, so declare `converged`." | **Refuted by the machinery.** `validateFidStepStatus` errors on any unresolved step under a `converged`/`closed` status and the pre-write gate blocks that write, so claiming `converged` now would require marking unimplemented work `implemented`. The record stays `analyzed`, asserts `implementation_started: false`, and flips as steps resolve in the implementation pass. **This is presented to the operator, not decided unilaterally.** |

**Converged for implementation.** The FID is the approved plan surface; the
implementation pass resolves the step ledger and flips the status.

### Loop 2 — Self-correction (from the adversarial pass)

- **RED:** Loop 1 found the plan's premise wrong in one place — a live catalog
  was assumed by analogy with the newest provider (`mistral`) instead of by the
  measured shape, which matches `chatanywhere`.
- **GREEN:** Steps 2-10 rewritten to the static package; the live alternative
  recorded above with its rejected costs; the runbook drift and the status rule
  folded into the same file so neither is rediscovered next session.
- **AUDIT:** The rewritten plan's seams were re-verified after the rewrite (the
  contract table is the evidence); the record still passes the four repo gates.
- **ADVERSARIAL:** Residual risk accepted and named: window row *values* and the
  channel-id routing leg are the two places this plan can be right in shape and
  wrong in fact, and both are pinned by tests/acceptance rather than assertion.
- **CHANGE DELTA:** ~45% of the document (plan + loop + questions), single pass,
  within the circuit breaker.

### Step 6 row plan (measured in the AUDIT round, 2026-10-12)

Every row below was read out of `context-window-table{,-apinex,-bai,-kiosapi,
-tokenharbor}.ts` with a search tool (tool output, not recall). Rule applied:
>=2 existing rows for the same upstream model, cited inline; when two >=2-row
groups disagree, the conservative **minimum** (the repo's documented
tie-break); a variant id with no independent row is pinned to its parent's
consensus value.

| Tiarina id | Window | Rows cited |
|---|---|---|
| `deepseek-v4.1-flash` | 1,048,576 | CC + NV + CHA |
| `deepseek-v4.1-flash:free` | 1,048,576 | parent (variant) |
| `deepseek-v4-flash:free` | 1,048,576 | UNO + INF + ORC + CHA |
| `deepseek-v4-pro` | 1,048,576 | TR + CC + UNO + CHA + KIO |
| `deepseek-v4-pro:cloudflare` | 1,048,576 | parent (channel variant) |
| `glm-5.3` | 1,000,000 | BAI + APINEX + NV vs KIO + intern → minimum |
| `glm-5.3:cloudflare` | 1,000,000 | parent (channel variant) |
| `glm-5.3-flash:free` | 1,048,575 | KIO + NV vs UNO + INF + HC → minimum |
| `glm-5.2` | 1,048,576 | TR (2-of-3) + BAI + KIO |
| `kimi-k3` | 1,048,576 | HC + TB + TR + NV + TH + BAI + APINEX + CC |
| `kimi-k2.6` | 262,144 | intern + NV + BAI + TH + CC |
| `kimi-k2.7-code` | 262,144 | INF + TR + CC |
| `qwen3.8-max` | 1,000,000 | BR + BAI + TH + CC |
| `qwen3.7-plus` | 1,000,000 | TR + CC |
| `qwen3.8-flash` | 1,000,000 | BAI + KIO (+ OR-live) |
| `qwen3.8-flash:free` | 1,000,000 | KIO `:free` + parent |
| `mimo-v2.6-flash:free` | 1,048,576 | TH + KIO + BAI + APINEX |
| `gpt-oss-120b` | 131,072 | UNO + TR |

**No row, documented in `TIARINA_NO_ROW_IDS` (keeps the flagged 200k
default):** `glm-4.7-flash` — no cross-gateway row exists anywhere in the
table. The only `glm-4.7-flash`-family rows in the repo are catalog-owned
orcarouter/vercel values the register explicitly does **not** row
(`window-coverage-register.ts:38`, FID-2026-1004-003), and inventing a value
from the family name is the failure mode this rule exists to prevent.

18 rows + 1 no-row id = the 19 measured ids, all accounted for.

### Missed Questions

1. **Is Tiarina one vendor or two?** Two distinct surfaces: the PaaS AI
   Gateway (`ai.tiarina.cloud`, this FID) and the separate AI platform
   (`tiarina.id`). Only the gateway is in scope; do not merge their identities.
2. **Is it an open relay?** No — keyless `POST /v1/chat/completions` returns
   401. Measured, not assumed, because the answer would otherwise disqualify
   the host outright.
3. **Does "OpenAI and Anthropic compatible" mean `openai-anthropic`?** No.
   Keyed `POST /v1/messages` returns 404 under both `Authorization: Bearer`
   and `x-api-key`, and every other Anthropic-shaped prefix is 404 too. The
   claim is vendor marketing (`reported-unverified`) and is refuted on the
   wire. Claiming dual protocol would also demand a `protocolMap` +
   `dual-protocol` exception (fail-closed), so the entry is `openai`.
4. **Is the free tier real?** Partly measured: the free lane round-trips
   (`glm-5.3-flash:free`, `deepseek-v4-flash:free` → 200 with the exact echo),
   and it rate-limits (`deepseek-v4.1-flash:free`, `mimo-v2.6-flash:free` →
   429) in the same session. The vendor's marketing is `reported-unverified`;
   pricing and quota must still be cited from the vendor's own console at
   curation, never from a social post.
5. **Where do the model ids and windows come from?** Ids: the live catalog —
   19 measured rows, saved to `ids.txt`. Windows: **not the catalog at all**
   (0 of 19 rows carry a window field), so the disposition is `table-section`
   and the values must be vendor-published and cited per model; until then no
   window may be invented and the conservative default stands with its
   evidence recorded.
6. **Why not `providers:harvest` / `providers:propose`?** The host is not a
   tracked candidate; `propose-provider` refuses fail-closed. Seed intake via
   a FID is the intended route, so no pipeline change is needed.
7. **Does adding this need a hand-edit of `.env.example` / `.env.local`?**
   No: the registry entry makes the generated `.env.example` block follow; the
   live key is operator-placed, and agent writes to `.env*` are forbidden by
   steering.
8. **Is a typosquat or aggregator risk present?** The intake did not establish
   first-party ASN/ownership evidence. The identity gauntlet is the operator-run
   check for that; it is `NEEDS-REVIEW` here, not a PASS.

Asked in the loop, missed at creation:

9. **Live or static?** Static — decided by the measured shape against the
   repo's own precedent (chatanywhere), not by recency (mistral). Decision: the
   audited allowlist, with the free-lane rotation accepted as a dated risk.
10. **Where do window values come from if the catalog publishes none?**
    Cross-gateway consensus rows in a new `context-window-table-tiarina.ts`
    seam, >=2 rows agreeing; single-source flagged NEEDS-REVIEW; ids without a
    row go to `<PROVIDER>_NO_ROW_IDS` and keep the flagged 200k default.
    Decision: never invent a window, never use family knowledge.
11. **Do the `:free` / `:cloudflare` ids need their own rows?** Yes — the
    kiosapi lesson ("the `:free` id is a separate roster entry and must be
    pinned too"). Decision: all 19 ids are rowed or documented as no-row.
12. **Does the committed census need regenerating?** Yes: `tiarina: 19` belongs
    in `common/src/constants/provider-catalog-census.json`, produced by
    `bun run providers:parity` (which needs the key + network), verified by
    `providers:parity:check`. Decision: regenerate in the implementation pass;
    never hand-edit the census.
13. **Is the picker guaranteed to receive rows?** Not by registration alone —
    `chatanywhere` shipped registered, catalogued and window-covered while the
    merge never asked for it (FID-2026-1007-005). Decision: wire the builder
    into `assembleGatewayCatalog` and let `providers:parity`'s pairing check
    prove it.

`implementation_started: true` — the implementation pass ran in the same
session as the loop (operator approval: "Static audited allowlist", "Proceed
with the coding step", "add the entire catalog"). Every step below is resolved
with its artifact and its receipt; none is dropped and none is deferred.

## Step Status

- [x] 1. Keyed ground-truth probe — roster, free-lane round-trips, keyed
  `/v1/messages` 404 — implemented
- [x] 2. `tiarinaModels` map (19 ids) in `gateway-catalogs.ts` + barrel
  export — implemented (`common/src/constants/model-config/gateway-catalogs.ts`
  19 rows; `model-config.ts` exports the map + `TiarinaModel`)
- [x] 3. `MODEL_CATALOGS` registration (`modelsRef: 'tiarina'`) — implemented
  (`common/src/providers/model-catalogs.ts`; compile-checked by
  `keyof typeof MODEL_CATALOGS`)
- [x] 4. Registry entry — implemented as **`registry-partitioned-3.ts`**
  (new): the 267/300 headroom would not absorb the entry plus its probe
  receipt, so the runbook's rule applied and a third partition was created and
  spread in `registry.ts` (order preserved)
- [x] 5. Window register: `NO_PUBLISH_GATEWAY_IDS` membership + a
  `table-section` entry — implemented (`window-coverage-register.ts`;
  `window-coverage:check` exit 0)
- [x] 6. `context-window-table-tiarina.ts` seam (18 consensus rows + 1
  documented no-row id) and its spread — implemented; the spread-wiring census
  in the new window-truth suite fails if the spread is ever dropped
- [x] 7. `cli/src/utils/openrouter-models/tiarina.ts` static builder —
  implemented (32-line chatanywhere template) + barrel export in
  `cli/src/utils/openrouter-models.ts`
- [x] 8. `assembleGatewayCatalog` merge before the custom-catalogs tail —
  implemented; `providers:parity` measured `tiarina: 19` picker rows
- [x] 9. Closed-world pin widened 26 → 27 (`provider-registry.test.ts:26`) +
  the setup list 25 → 26 + the order-4 family — implemented
- [x] 10. Two new test files (`fid-2026-1012-005-tiarina.test.ts`,
  `window-truth-tiarina.test.ts`) — implemented; 17 pass / 0 fail with the
  register lint
- [x] 11. Census regeneration via `bun run providers:parity` — implemented
  (`tiarina: 19`; the regeneration also refreshed a stale committed row set,
  see Resolution)
- [x] 12. Generated and hand provider surfaces reconciled — implemented
  (`generate:provider-docs` wrote 4 byte-exact surfaces; all 13 hand-surface
  items across 6 files synced; `generate:provider-docs:check` exit 0)
- [x] 13. Doc fixes — implemented for the runbook `resolveKey` drift
  (`docs/adding-a-provider.md` now shows
  `resolveKey: () => resolveProviderApiKey('myprovider')` with the
  `../provider-credentials` import, the mistral.ts pattern). **Not done, by
  boundary:** `.env.example:152` (`T146`) — every `.env*` surface is
  deliberately outside T188's write surface (operator-owned, steering
  `no-write-dotenv`); recorded for the operator
- [x] 14. Acceptance round-trip, gates, local commit, CHANGELOG, archive —
  implemented: the production-chain round-trip passed (receipt below), the
  declared gates are green, the commit is local and path-scoped, and the
  CHANGELOG entry + archive move + register eviction landed with it

## Verification Gates

Declared at closure (FID-2026-0823-009). Every line below is a command that ran
on the final tree, with its captured exit status — no gate is claimed from
recall.

- gate: `bun run typecheck` (13 workspaces + `scripts/`)
- gate: `bun x eslint . --max-warnings 0`
- gate: `bun run lint:md`
- gate: `bun x prettier --check .`
- gate: `bun run generate:provider-docs:check`
- gate: `bun run window-coverage:check`
- gate: `bun run providers:parity` (+ `providers:parity:check`)
- gate: `cd cli && bun test src/utils/openrouter-models/__tests__/fid-2026-1012-005-tiarina.test.ts src/utils/openrouter-models/__tests__/window-truth-tiarina.test.ts src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`
- gate: `cd common && bun test src/providers/__tests__/provider-registry.test.ts src/providers/__tests__/provider-fact-evidence.test.ts src/providers/__tests__/validate-provider-registry.test.ts src/providers/__tests__/provider-audit.test.ts`
- gate: `bun test scripts/__tests__/provider-docs-counts-drift.test.ts scripts/__tests__/provider-registry-doc.test.ts scripts/__tests__/provider-catalog-parity.test.ts`
- gate: `bun scripts/validate-repository.ts` + `bun scripts/scope-register-check.ts` + `bun scripts/scope-guard-check.ts`
- gate: keyed production-chain acceptance (SDK `getModelForRequest` +
  `generateText`, `tiarina/glm-5.3-flash:free`)

## Resolution

### Code Verification Evidence

Implementation is complete and verified. Evidence:

- **Files referenced in Affected Components exist — verified**, and the
  Affected Components list was rewritten in the loop to the static package
  (the pre-rewrite list named the live plan's seams). Line counts at closure:
  `registry-partitioned-2.ts` 267/300 (untouched — the entry went to the new
  partition), `gateway-catalogs.ts` 229 → 268, `context-window-table.ts`
  271 → 278, `window-coverage-register.ts` 266 → 274,
  `gateway-catalog-merge.ts` 72 → 77.
- **Implementation matches the Proposed Solution — yes.** One typed registry
  entry (`registry-partitioned-3.ts`) plus the checked-in catalog map, the
  `MODEL_CATALOGS` registration, the coverage disposition and its seam file,
  the static CLI builder wired into `assembleGatewayCatalog` **before**
  `...live.customModels` (which is still last), the widened closed-world pins,
  the two new suites, and the regenerated surfaces. No new adapter, no
  protocolMap, and **zero** exception-manifest entries (asserted by the new
  suite — this shape derives no exception kind).
- **Typecheck/tests/lint with pasted tool output — yes** (pasted below).
- **Production call-graph evidence for the wiring — executed.**
  `sdk/src/impl/model-provider.ts:109-124` iterates the effective registry and
  routes any `${config.id}/` id through `createProviderModel(config, key,
  model, extraCreds)`, so `tiarina/…` needs no SDK change — and the live
  acceptance below proves it end to end rather than by reading.
- **FID status reflects the actual implementation state — yes.** `closed`:
  every step resolved, gates green, acceptance passed, artifact archived.

The acceptance leg — keyed, through the **production** chain, not the raw
endpoint (`dev/scratchpad/active/tiarina-2026-10-12/production-chain-acceptance.ts`):

```text
$ cd sdk && bun --env-file=../.env.local tiarina-acceptance.ts
model: tiarina/glm-5.3-flash:free
isChatGptOAuth: false
finishReason: stop
usage: {"inputTokens":23,"outputTokens":87,"totalTokens":110,"cachedInputTokens":0}
text: TIARINA-CHAIN-OK
exit 0
```

Gates on the final tree:

```text
bun run typecheck                                    exit 0  (13 workspaces + scripts)
bun x eslint . --max-warnings 0                      exit 0
bun run lint:md                                      exit 0
bun x prettier --check .                             exit 0  (all files clean)
bun run generate:provider-docs:check                 exit 0  (docs up to date)
bun run window-coverage:check                        exit 0  (register matches the census)
bun run providers:parity                             exit 0  (tiarina: 19; pairing: every
                                                              modelsRef provider contributes rows)
cd cli && bun test <3 tiarina-related suites>        exit 0  (17 pass / 0 fail)
cd common && bun test <4 registry suites>            exit 0  (44 pass / 0 fail)
bun test scripts/__tests__/provider-{docs-counts-drift,registry-doc,catalog-parity}.test.ts
                                                     exit 0  (24 pass / 0 fail)
bun scripts/validate-repository.ts                   exit 0  (validation: PASS)
bun scripts/scope-register-check.ts                  exit 0  (0 issues)
bun scripts/scope-guard-check.ts                     exit 0  (0 issues)
```

Two facts a reviewer should not have to rediscover:

1. **The census regeneration was not a one-line diff.** The committed
   `provider-catalog-census.json` was a stale 2026-10-06 subset (two provider
   rows, an older script `notes` string). `bun run providers:parity` — the only
   lawful way to touch that file — wrote the full current assembly, so the diff
   carries every provider's row plus `tiarina: 19`. `window-coverage:check`
   consumes the file and passes with it.
2. **`.env.example:152` still cites unregistered `T146`.** The fix is one
   character (→ `T147`) but every `.env*` surface is deliberately outside
   T188's approved write surface (operator-owned under `no-write-dotenv`), so
   it is left to the operator rather than taken silently.

- **Closed Date:** 2026-10-12
- **Fix Description:** Tiarina Cloud (`ai.tiarina.cloud`) is a built-in
  gateway: routing prefix `tiarina/`, `/provider` setup, a 19-id static catalog
  with 18 cross-gateway window rows and one documented no-row id, generated
  references, and closed-world pins — with no SDK change, because the router is
  registry-driven.
- **Tests Added:**
  `cli/src/utils/openrouter-models/__tests__/fid-2026-1012-005-tiarina.test.ts`
  (catalog/window/registry/coverage/zero-exception pins, windows compared
  against an independent oracle) and
  `cli/src/utils/openrouter-models/__tests__/window-truth-tiarina.test.ts`
  (roster windows, variant inheritance, no-row default, total coverage, and the
  seam-wiring census).
- **Verification Evidence:** the acceptance receipt and the gate block above.
- **Archived:** 2026-10-12 →
  `dev/fids/archive/FID-2026-1012-005-tiarina-cloud-provider.md`

> When the status is set to **closed**, move this file to `dev/fids/archive/`
> and append the CHANGELOG entry.

## Lessons Learned

- **A dated "not found" is a claim, not a fact.** The 2026-10-07 idea-shelf
  note ("exists only as Twitter mentions") would have closed this intake had
  it been trusted; the host now answers on `/health` and 401s on `/v1/models`.
- **Probe the security-shaped negative first.** The keyless `POST` costs one
  request and decides whether the host is disqualified as an open relay before
  any curation effort is spent.
- **Vendor compatibility claims are leads.** "OpenAI and Anthropic compatible"
  collapsed to an OpenAI-only wire surface under probing, and encoding it as
  `openai-anthropic` would have demanded a protocol map the vendor may not
  support.
- **Fail-closed gates do not cover ordering.** The positional settled ladder in
  `gateway-live-results.ts` is the one seam where a wrong insertion produces no
  failing test — the provider's own test must pin its own slot.
