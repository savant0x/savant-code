# FID: Intern InkStone (discovery-api.intern-ai.org.cn) as a built-in provider

**Filename:** `FID-2026-1004-008-intern-inkstone-provider.md`
**ID:** FID-2026-1004-008
**Severity:** low
**Status:** closed
**Created:** 2026-10-04 23:42
**Automation level:** 3
**YAGNI-Compliance:** Pending

> **Operator directive (verbatim):** *"i am interested in adding this
> https://discovery.intern-ai.org.cn/token-plan/home?tabIndex=1"*, followed by
> *"but live probe first, make the fid+perfection loop"*. Design decisions
> confirmed by the operator via structured question: **built-in registry
> provider** (not `/provider add`), **static catalog** (not live), **OpenAI Chat
> Completions only** (no `multi` protocol map).

## Summary

Intern InkStone (书生·端砚) — the Shanghai AI Laboratory science-discovery
platform behind `discovery.intern-ai.org.cn` — is added as built-in provider
`intern`, following `docs/adding-a-provider.md` (the LIVE runbook; the archived
`docs/archive/design/Adding New Providers.md` is a dated claim, per
`dev/LEARNINGS.md` → `archived-runbook-is-claim-not-contract`).

The design decision that mattered came from the **live probe**, not the docs:
the endpoint is reachable and fast (1.8 s keyless), its model-list route is
**auth-gated (HTTP 401 keyless, 200 with a key)**, and its catalog publishes
context windows in a **non-standard nested shape**
(`input_modalities[].supported_inputs.max_context_length.value`) that the shared
`parseChatCatalog` would extract **zero** windows from. The operator therefore
chose a **static** catalog pinned from the authenticated probe — sidestepping
both the custom-parser work and any boot-time dependency on a `.cn` host.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Workspaces touched:** `common` (registry, catalog map, window table,
  coverage register), `cli` (static-catalog fetcher, gateway fan-out, tests)
- **Governance:** ECHO Protocol v0.2.0, FID-bound, Laws 1/3/4

## Detailed Description

### What the provider is, and the twin already in the registry

`discovery.intern-ai.org.cn` is the China-hosted front door of the same vendor
whose **international twin** (`api.atria-asi.ai`) already ships as the `atria`
provider (`common/src/providers/registry-partitioned.ts` → `atria`,
FID-2026-0916-005). That existing entry is a **single-model static catalog**
(`atria/Atria-Dawn-Preview`, window 262_144) and its own comment already records
that "the vendor also serves Anthropic /v1/messages and Responses /v1/responses".
The China endpoint is not a new vendor — it is a **second front door with a
10-model roster** instead of one. The two entries are kept separate: distinct
`baseUrl` (so `validateProviderUrlOwnership` passes), distinct credential
(`INTERN_API_KEY` vs `ATRIA_API_KEY`), distinct domain.

### Probe evidence — measured 2026-10-04, this session

**Keyless boundary probe:**

```text
discovery_models_no_auth:        401 (1.842s)
discovery_models_dummy_key:      401 (0.930s)
discovery_chat_no_auth:          405
discovery_messages_no_auth:      405
atria_twin_models_no_auth:       401 (10.016s)
atria_twin_chat_no_auth:         405
```

`401` = route exists and is auth-gated (a dummy key is rejected, so keys are
validated). `405` = route exists, POST-only. The `.cn` host is reachable and
**5x faster than the international twin**, so geo-gating is not a factor here.

**Authenticated probe** (`Authorization: Bearer $INTERN_API_KEY`, key read from
`.env.local` into a shell variable and never echoed):

```text
GET  /v1/models                -> HTTP 200, total_count: 10
POST /v1/chat/completions      -> HTTP 200, model "Intern-S2", usage reported
   request: {"model":"intern-s2","messages":[{"role":"user",
             "content":"Reply with exactly: PONG"}],"max_tokens":16}
   response: {"choices":[{"index":0,"message":{"role":"assistant",
             "content":null,"reasoning_content":"Thinking Process:..."},
             "finish_reason":"length"}],"model":"Intern-S2",
             "object":"chat.completion","id":"90906",
             "usage":{"prompt_tokens":16,"completion_tokens":16,"total_tokens":32}}
```

**Catalog reachability and inference reachability are separate acceptance
checks** (the runbook's Nous lesson). Both are green here: the roster returns 10
rows AND a real completion round-trips. The `content: null` +
`finish_reason: "length"` is a **budget artifact of `max_tokens: 16`**, not a
defect: `intern-s2` is a reasoning model that spent the budget in
`reasoning_content` (a non-standard extension the vendor returns, like DeepSeek's).

### The live roster — exact ids and measured windows

Every row is `owned_by: "tokenplan"`, `is_ready: true`, `object: "model"`, and
carries `openrouter: { slug: <id> }`.

| Model id | Context window | Input | Notes |
|---|---|---|---|
| `Agents-A1` | 262,144 | text, image | |
| `Atria-Dawn-Preview` | **524,288** | text | **512K here vs the twin's pinned 262,144** |
| `deepseek-v4-flash-0731` | 1,048,576 | text | malformed second input entry `{"type":"文本"}` (vendor bug) |
| `deepseek-v4-flash-vision` | 1,048,576 | text, image | |
| `deepseek-v4-pro-0813` | 1,048,576 | text | |
| `glm-5.3` | 1,048,576 | text | |
| `intern-s2` | 262,144 | text, image | display name `书生-S2` |
| `kimi-k2.6` | 262,144 | text, image | |
| `minimax-m3` | 1,048,576 | text | |
| `qwen3.8-27b` | 262,144 | text, image | |

### Root Cause

Not a defect class — this is a **feature addition**. Recorded as a FID because
the runbook's own claim ("one registry entry, everything else derives")
understates the work: the entry is one of ~19 surfaces a provider actually
touches, and the drift/coverage gates exist precisely because the rest are
hand-maintained and fail closed when missed.

### Why the catalog shape forces the static choice

The vendor serves a **`schema_version: "2.4"` extension**, not the OpenRouter
shape: windows live at
`input_modalities[].supported_inputs.max_context_length.value`, with sibling
`output_modalities`, `capacity` (per-minute prompt/request quotas) and
`pricing[].cost_usd` blocks. This is the Vercel mis-parse class the runbook warns
about — a parser reuse would silently yield 0/10 windows. A live catalog would
require a bespoke parser (`parseVercelCatalog` precedent). The operator chose
static; the pinned rows above are the **measured** values, not doc-sourced.

## Impact Assessment

### Affected Components

- `common/src/providers/registry-partitioned-2.ts` — the entry
- `common/src/constants/model-config/gateway-catalogs.ts` — `internModels` map
- `common/src/constants/model-config.ts` — barrel export (value + type)
- `common/src/providers/model-catalogs.ts` — `MODEL_CATALOGS` registration
- `common/src/constants/context-window-table.ts` — 10 fallback rows
- `common/src/constants/context-windows.ts` — `NAME_CATALOG_MODEL_IDS` union
- `common/src/constants/window-coverage-register.ts` — coverage entry
- `cli/src/utils/openrouter-models/static-catalogs-gateways.ts` — fetcher + names
- `cli/src/utils/openrouter-models/gateway.ts` — fan-out + combined array
- `cli/src/utils/openrouter-models.ts` — public re-export
- Tests: `provider-registry.test.ts`, `provider-list.test.ts`, new pin suite
- **Deliberately NOT touched:** `provider-exception-manifest.ts` — the entry's
  shape derives **zero** exception kinds (`requiredExceptionKinds` in
  `common/src/providers/audit.ts`: no resolver, `catalog.source === 'static'`,
  `protocol === 'openai'`, no `credentials.extra`, `idTransform === 'strip'`,
  `kind === 'gateway'`, `setupAvailable === true`), and the manifest fails
  closed on a **stale** kind — so adding an entry would be a defect, not a
  safeguard. `validateProviderUrlOwnership` and
  `validateProviderSurfaceSnapshot` need no file edit either: both run over the
  registry from the `common` suite, which the declared gates execute.
- Docs: `README.md`, `README.zh-CN.md`, `cli/release/README.md`,
  `docs/installation.md`, `docs/features.md`, `docs/sdk-overview.md`,
  `docs/providers.md`, `.env.example` (generated)

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] **Low** — additive. One new routing prefix, one picker entry, one env var.
  No existing behaviour altered. Catalog unavailable → degrades to empty list;
  free-text `/model intern/<id>` still routes via the registry.

## Proposed Solution

### Approach

One typed registry entry + one checked-in static catalog + exact-id window rows +
a coverage-register disposition, following the `atria` entry as the template
(same vendor, same single-protocol OpenAI choice, same static-catalog rationale).

### Steps

1. `internModels` map (10 prefixed ids) + `InternModel` type in
   `common/src/constants/model-config/gateway-catalogs.ts`.
2. Export both through the `common/src/constants/model-config.ts` barrel.
3. Register `intern: internModels` in `common/src/providers/model-catalogs.ts`.
4. Registry entry in `registry-partitioned-2.ts` (the newest partition;
   `registry-partitioned.ts` is at 298/300 lines): id `intern`, label
   `Intern InkStone`, kind `gateway`, `INTERN_API_KEY`,
   `baseUrl https://discovery-api.intern-ai.org.cn/v1`, `protocol 'openai'`,
   `idTransform 'strip'` (**grounded, not assumed**: the roster's own `id`
   fields are bare — `glm-5.3`, `intern-s2`, `deepseek-v4-flash-0731` — and the
   live round-trip sent the bare `intern-s2` and returned HTTP 200, so the wire
   id is bare and `strip` removes exactly the internal `intern/` prefix),
   `catalog { source: 'static', modelsRef: 'intern' }`,
   `setupAvailable true`, `domain 'intern-ai.org.cn'`, `order 4`.
5. Ten exact-id rows in `CONTEXT_WINDOW_FALLBACKS` (values from the live probe).
6. Add `...Object.values(internModels)` to `NAME_CATALOG_MODEL_IDS`.
7. `WINDOW_COVERAGE_REGISTER` → `intern` = `table-section` with the probe note.
8. `INTERN_NAMES` + `fetchInternModels()` in `static-catalogs-gateways.ts`
   (the `fetchAtriaModels` pattern; windows via `getContextWindowFallback`).
9. Wire into `gateway.ts`: import, `internCatalog` fetch, combined-array spread,
   and the `cli/src/utils/openrouter-models.ts` re-export.
10. Update the two hardcoded registry-count lists in `provider-registry.test.ts`
    ("twenty-three" → "twenty-four"; "twenty-two" → "twenty-three") plus the
    order-4 family list, and the `provider-list.test.ts` label list.
11. New pin suite `cli/src/utils/openrouter-models/__tests__/fid-2026-1004-008-intern.test.ts`
    — it pins `fetchInternModels()`'s windows. Note
    `context-window-fallbacks.test.ts` iterates only the Infron/UnoRouter
    fetchers and does **not** include the `atria` template's fetcher, so `intern`
    follows the atria precedent rather than joining that loop.
12. `bun run generate:provider-docs`, then sync the hand-maintained surfaces the
    drift checker names (README bullets, env reference, zh-CN mirrors, release
    README, `docs/providers.md`).

### Verification

Typecheck the four workspaces; run the `common` provider suites, the CLI catalog
suites and the new pin suite; `generate:provider-docs:check`; eslint; lint:md;
prettier; `validate:repository`; `quality:report`.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/fid-2026-1004-008-intern.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Catalogued before any edit. (a) The endpoint is reachable and
  auth-gated (401/405 keyless; 200/200 authenticated). (b) The catalog shape is
  `schema_version: "2.4"` — **not** OpenRouter — so window extraction would be
  silent-zero under a reused parser. (c) The existing `atria` entry pins
  `Atria-Dawn-Preview` at 262,144 while this endpoint publishes **524,288** — a
  measured cross-deployment divergence. (d) Two hardcoded registry-count lists
  (`provider-registry.test.ts`, "twenty-three"/"twenty-two") and the
  `provider-list.test.ts` label list will fail on the new entry. (e) `WINDOW_
  COVERAGE_REGISTER` is fail-closed since FID-2026-1004-002 — a provider without
  an entry fails `window-coverage-register.test.ts`.
- **GREEN:** Implemented — the full 12-step change set landed in the working
  tree (7 `common` files, 3 `cli` source files, 2 test-pin updates, plus the new
  pin suite), then `generate:provider-docs` regenerated the managed surfaces and
  the 13 hand-maintained surfaces the drift checker names were synced.
- **AUDIT:** Complete — independent Verifier pass returned 4 FAILs and 3
  NEEDS-REVIEWs against the FID document.
- **ADVERSARIAL:** Complete — meta-verification resolved them: FAIL-1 (gate set)
  **CONFIRMED** and fixed (added `typecheck sdk` +
  `typecheck packages/agent-runtime`; the runbook's own verification section
  mandates four workspaces); FAIL-2 (`strip` uncited) **ADJUSTED** to a citation
  gap — the claim was already grounded in the roster's bare ids and the HTTP 200
  round-trip; FAIL-3 (receipt placeholder) **ADJUSTED** — removed, since the
  receipt is machine-stamped; FAIL-4 (exception manifest) **REFUTED** —
  `requiredExceptionKinds` derives an empty set for this shape and a stale kind
  fails closed; NEEDS-REVIEW-2/3 **REFUTED** (`docs/adding-a-provider.md` and the
  `archived-runbook-is-claim-not-contract` slug both exist and were read);
  MINOR-1 (status) **REFUTED** — `analyzed` is required while Step Status items
  are unchecked, because `converged` + unchecked steps trips
  `fid.steps.unresolved`; MINOR-2 **CONFIRMED as non-blocking** (the
  `context-window-fallbacks.test.ts` loop covers Infron/UnoRouter only, not the
  `atria` template).
- **CHANGE DELTA:** ~8% (self-correct pass on the FID document).

### Missed Questions

1. **Why not `protocol: 'multi'`, given the vendor advertises three wire
   protocols?** Because every one of the 10 models supports OpenAI Chat
   Completions, and the runbook is explicit that map dispatch is mandatory only
   for **MIXED** rosters. A map here would add a `multi-protocol` exception kind
   and a `ProviderProtocolMap` union member for zero routing benefit. The
   Anthropic/Responses lanes remain available to external clients
   (`ANTHROPIC_BASE_URL=https://discovery-api.intern-ai.org.cn`), which is
   outside Savant's routing.
2. **Why a new provider instead of extending `atria`?** Different `baseUrl`,
   different credential, different roster, different domain. Extending would
   violate `validateProviderUrlOwnership`'s intent (one provider, one root) and
   conflate two deployments behind one credential.
3. **Is `INTERN_API_KEY` collision-free?** Verified against the full variable
   list in `.env.local` (names only) and against `claimEnvVar`'s registry-wide
   uniqueness gate: no `INTERN_*` exists.
4. **Should `Atria-Dawn-Preview`'s 512K be reconciled with the twin's 256K?** No —
   they are different deployments. `atria/Atria-Dawn-Preview` keeps its
   vendor-published 262,144; `intern/Atria-Dawn-Preview` takes the measured
   524,288. Recorded as a divergence, not a defect.
5. **Does the `content: null` response mean inference is broken?** No — it is a
   `max_tokens: 16` budget artifact on a reasoning model. `finish_reason:
   "length"` and a populated `usage` block prove the round-trip.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending — G2 commit authority not yet exercised for this
      change set (working-tree implementation only)
- [x] **File:line ranges:** see *Code Verification Evidence* below
- [x] **Gate output:** see *Code Verification Evidence* below
- [x] **Reproducibility:** `grep -rn "intern" common/src/providers/registry-partitioned-2.ts`
      and `grep -rn "fetchInternModels" cli/src` both match in the working tree
- [x] **Step statuses:** every Proposed Solution step is `implemented` (Step
      Status section below)

### Code Verification Evidence

> Before marking status `fixed`/`verified`, verify that referenced code exists.
> FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output:

```text
typecheck common / cli / sdk / packages/agent-runtime   exit 0 (all four)
bun test common/src/providers/__tests__/                78 pass / 0 fail
bun test cli .../openrouter-models/__tests__/ + pins    102 pass / 0 fail
  (incl. fid-2026-1004-008-intern.test.ts 7 pass / 0 fail)
generate:provider-docs:check                            "up to date"
eslint <13 changed files> --max-warnings 0              exit 0
lint:md                                                 exit 0
prettier --check <20 changed files>                     clean
```

- [x] Production call-graph evidence: `fetchInternModels` is called from
      `fetchGatewayModels` (`cli/src/utils/openrouter-models/gateway.ts`) — the
      picker / live-refresh entry point — not only from tests.
- [x] FID status reflects the actual implementation state

## Step Status

- [x] Live-probe the endpoint keyless (boundary + routes)
- [x] Authenticated probe: roster + inference round-trip
- [x] `internModels` map + barrel export
- [x] `MODEL_CATALOGS` registration
- [x] Registry entry in `registry-partitioned-2.ts`
- [x] Ten exact-id window rows + `NAME_CATALOG_MODEL_IDS` union
- [x] `WINDOW_COVERAGE_REGISTER` disposition
- [x] `fetchInternModels()` + `INTERN_NAMES` + gateway fan-out + re-export
- [x] Update the two registry-count pins + the label list
- [x] New pin suite
- [x] Regenerate + sync docs; `generate:provider-docs:check` clean

## Resolution

- **Closed Date:** 2026-10-05 00:15
- **Fix Description:** Built-in provider `intern` (Intern InkStone) added to the
  unified registry as a static 10-model, single-protocol OpenAI gateway on
  `https://discovery-api.intern-ai.org.cn/v1` with `INTERN_API_KEY`; exact-id
  context windows pinned from the authenticated live probe; coverage-register
  disposition `table-section`; no exception-manifest entry (the shape derives
  zero kinds, and a stale kind fails closed).
- **Tests Added:** Yes —
  `cli/src/utils/openrouter-models/__tests__/fid-2026-1004-008-intern.test.ts`
  (7 legs: catalog identity, fetcher windows, probed-window parity, the
  512K/256K twin divergence, the registry entry, the coverage disposition, and
  the absence of a manifest entry). The two registry-count pins
  (`provider-registry.test.ts`) and the `provider-list.test.ts` label pin were
  updated in place.
- **Verification Evidence:** typecheck ×4 exit 0; `common` provider suites
  78/78; CLI catalog + pin suites 102/102; `generate:provider-docs:check`
  clean; eslint 0; lint:md 0; prettier clean.
- **Verification Receipt:** not stamped. A `closed` record is outside the
  receipt contract by design (FID-2026-0919-021): closure edits the document
  after the last stamp, so the fingerprint is expected to drift. The gate
  evidence above is the record.
- **Archived:** yes — `dev/fids/archive/`

## Lessons Learned

- **The live probe chose the design, not the docs.** The console table and the
  vendor docs agreed on 10 models, but only the probe revealed that the catalog
  publishes windows in a shape no existing parser reads — which is what made
  "static" the correct call rather than a conservative one.
- **A twin entry is a shortcut and a trap.** An existing provider for the same
  vendor (`atria`) supplied the template, the protocol choice, and the
  static-catalog rationale — and simultaneously planted a wrong number
  (262,144 vs the measured 524,288) that would have been inherited silently.
- **Catalog reachability and inference reachability are two checks.** HTTP 200
  on `/v1/models` proves nothing about `/v1/chat/completions`; both were measured
  separately here (the Nous 424-row/404-inference lesson).