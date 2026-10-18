# FID: River AI built-in model provider

**Filename:** `FID-2026-1017-015-river-ai-provider.md`
**ID:** FID-2026-1017-015
**Severity:** medium
**Status:** converged
**Created:** 2026-10-17 22:50
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Add River AI as an official built-in OpenAI-compatible provider. Its authenticated `/v1/models` endpoint is
account-specific, so use the existing registry-driven live-catalog path to show every model available to the
configured River key. Preserve each exact upstream model ID beneath the internal `river/` prefix and use
River's documented context windows for the three currently published models. The operator authorized the
credential check, a one-token inference check, and the identity gauntlet; all were run without exposing the
key. The gauntlet confirms that each route answered and returned its requested model label, while its overall
identity verdict remains inconclusive because it had no independent controls.

## Environment

- **OS:** Windows, PowerShell
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** River API docs accessed 2026-10-17; identity manifest `identity-manifest/1`
- **Commit/State:** implementation is being verified on `main` from base `704dfde9`; only paths listed in the
  active SCOPE entry belong to this FID.

## Detailed Description

### Problem

River is absent from `PROVIDER_REGISTRY`, so it has no provider picker entry, credential setup, routed model
IDs, or contribution to the combined gateway catalog. The user requested support for all River models as an
official provider and supplied `RIVER_AI_API_KEY` in the local `.env.local` file.

### Expected Behavior

Selecting a River model in the provider catalog uses the user's configured `RIVER_AI_API_KEY`, sends the
unmodified upstream model ID to `https://api.river.ai/v1/chat/completions`, and supports every model returned
by River's authenticated `/v1/models` response. Model selection and context reporting use published limits
where known and do not invent limits for future model IDs.

### Root Cause

No River provider entry or live-catalog wrapper exists. River's catalog records expose model IDs and ownership
only; context-window metadata is published separately in the vendor's model documentation.

### Evidence

- River inference documentation names `GET /v1/models` as the account-accessible model list and
  `POST /v1/chat/completions` as the chat endpoint: <https://docs.river.ai/guides/inference/>.
- River's models documentation lists three models and states that all three have a 1,048,576-token combined
  context window: <https://docs.river.ai/guides/inference-models/>.
- Authenticated `GET https://api.river.ai/v1/models`: `HTTP=200`, `MODEL_COUNT=3`; the exact IDs were
  `deepseek-ai/DeepSeek-V4.1-Flash`, `nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4`, and
  `zai-org/GLM-5.3-Flash`. Each row had fields `id,object,owned_by`; no window field.
- Authenticated one-token chat request to `zai-org/GLM-5.3-Flash`: `HTTP=200`, returned model
  `zai-org/GLM-5.3-Flash`, 16 prompt tokens, 1 completion token.
- Corrected `providers:identity` sweep: `swept 3 routes: ok 3, unavailable 0, failed 0`; served-label 3
  matches, 0 mismatches. All three verdicts are `inconclusive` because no independent controls were supplied.
  The report is written under `dev/provider-identity/` and contains no credential.
- `docs/adding-a-provider.md` specifies that a provider exposing a model-list API uses a registry-driven live
  catalog, a wrapper with `resolveProviderApiKey`, fan-out/cache wiring, exception ownership, and a
  window-coverage entry.
- Existing live-provider implementation and examples: `cli/src/utils/openrouter-models/ashna.ts`,
  `cli/src/utils/openrouter-models/gateway-live-results.ts`, `common/src/providers/registry-partitioned-5.ts`.

## Impact Assessment

### Affected Components

- Provider registry, derived setup and generic SDK routing
- Authenticated gateway model catalog, cache invalidation, and settled-result ladder
- Context-window fallback and registry-wide window coverage
- Provider docs, generated provider tables, and SDK/setup/catalog tests

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Use the single registry as the provider source of truth. Configure River as a `gateway` with
`RIVER_AI_API_KEY`, API root `https://api.river.ai/v1`, OpenAI chat protocol, `strip` ID transformation, and
an authenticated live catalog at `/models`. Prefix each account-visible upstream ID exactly once with
`river/`; do not filter River's `/models` results. Register the implied `live-catalog` exception. Add exact
context-window fallback rows for the three IDs currently documented by River, and use `table-section` coverage
because the live response publishes no window fields. New live IDs remain selectable but have no fabricated
fallback window until documented evidence is added.

### Steps

1. Add the River gateway entry to the registry partition with room under the 400-line file ceiling.
2. Add a typed River catalog parser and fetcher using `deriveLiveCatalogUrl`,
   `resolveProviderApiKey('river')`, and `createLiveCatalogFetcher`; preserve upstream ID casing and
   namespace, derive display names from IDs, and leave live window fields absent when River does not return
   them.
3. Add River's exception-manifest ownership, window-coverage entry, and exact fallback rows for the three
   documented 1,048,576-token context windows.
4. Wire River into `fetchGatewayLiveCatalogs`, its positional result ladder, and
   `__resetOpenRouterModelsCacheForTest`, immediately before the custom-catalog tail.
5. Add tests for registry derivation, exact-ID parsing, malformed catalog responses, cached fallback/reset
   behavior, context coverage, and River's settled-ladder slot; extend the existing provider-setup and SDK
   routing contracts.
6. Regenerate provider docs and update `docs/providers.md` and any required hand-maintained provider surfaces.
   Do not hand-edit generated tables.
7. Keep the live catalog and gauntlet evidence; run the declared tests, typechecks, quality, provider-doc
   drift, repository validation, lint, markdown lint, and formatting checks. Commit the implementation and FID
   closure as path-scoped commits and push through the normal pre-push hook.

### Verification

- New parser tests use the exact measured River `{data:[{id,object,owned_by}]}` shape and assert all exact
  upstream IDs survive under `river/` with no invented runtime windows.
- The registry-wide window-coverage test asserts River is registered and that its table section has fallback
  rows.
- The catalog-ladder test asserts River rows resolve in `riverModels` and neighboring providers remain in
  their own slots.
- The completed live gauntlet evidence is scoped to availability and returned labels. Its `inconclusive`
  verdict is preserved because the operator-owned controls manifest has no independent River identity
  controls.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-setup.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/river-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/blazerail-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/tier1-provider-catalog.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:503d6a83b8a9333285ff7744f0214244b9d3074de8758940eb5480a355f8c488
- verified: 2026-10-18T03:52:17.426Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry-setup.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/river-catalog.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/blazerail-catalog.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/tier1-provider-catalog.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** River was absent from the registry and from every derived provider surface. The authenticated
  vendor catalog returned three account-visible models and no window fields. The docs publish 1,048,576-token
  context windows for those three models. The required live-catalog, positional-ladder, cache-reset,
  exception-owner, and context-coverage seams are identified above. The scope register also still listed
  BlazeRail FID-2026-1017-013 as active although its FID is archived; that stale entry is corrected in the
  same register update.
- **GREEN:** Use an authenticated dynamic catalog, preserve all exact upstream IDs, rely on generic SDK
  routing, add table fallbacks only for documented River IDs, and leave unknown future windows absent. The key
  stays in local configuration and is resolved by the shared provider credential seam.
- **AUDIT:** Evidence matches the implementation contract: River docs document the routes; authenticated
  `/models` returned the three IDs; the one-token chat request returned HTTP 200; and the identity gauntlet
  returned three successful route labels. The gauntlet's no-control verdict remains inconclusive. Static
  catalog, catalog-derived context limits, and provider-specific SDK factories are rejected because they
  either drift from account access or duplicate registry logic.
- **ADVERSARIAL:** The main false-positive risk is treating the returned `model` label as proof of model
  weights. The report explicitly limits itself to route availability and label agreement. The catalog does not
  expose context metadata, so only vendor-documented exact fallback rows are approved. The dynamic account
  catalog may later contain IDs absent from the fallback table; those IDs remain selectable with unknown
  context instead of a guessed value.
- **CHANGE DELTA:** Initial FID convergence pass; no prior FID text was replaced.

### Missed Questions

1. **Does River expose an account-specific catalog or a stable public roster?** The docs and authenticated
   response show `GET /v1/models` returns models available to the key; use it live so each user's access is
   represented.
2. **What is the correct key variable?** The operator supplied `RIVER_AI_API_KEY`; register that exact name so
   `/provider` setup and environment resolution agree. Never copy the value from `.env.local` into code or
   evidence.
3. **Can every returned ID be routed without losing publisher namespaces or case?** Prefix with `river/`
   internally and strip exactly that prefix at request time; assert full wire IDs in tests.
4. **Where do context windows come from when `/models` omits them?** River's model docs give 1,048,576 for the
   three observed IDs; use those exact rows and leave all undocumented dynamic IDs without a fallback.
5. **Does a matching gauntlet label confirm model identity?** No. The current gauntlet has no independent
   River control pair and returns `inconclusive`; report label matches as route evidence only.
6. **How many models did the authorized live checks exercise?** Three catalog IDs were returned and all three
   were exercised once by the one-probe-per-route sweep; a separate one-token request verified the GLM chat
   route.
7. **Does River expose other chat dialects requiring per-model routing?** The vendor inference docs specify
   OpenAI-compatible chat and responses endpoints; the observed request verified chat completions. Use the
   single `openai` protocol because the provider catalog makes no per-model dialect distinction.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** implementation and closure commit hashes
- [ ] **File:line ranges:** registry entry, catalog wrapper, context table, and routing/test anchors
- [ ] **Gate output:** pasted output from declared verification gates
- [ ] **Reproducibility:** production reachability grep and catalog/SDK test matches
- [ ] **Step statuses:** Proposed Solution steps 1–7 accounted for

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for the new provider
- [ ] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Implementation paths are present: registry partition, River live-catalog wrapper, gateway
  fan-out/cache reset/settled slot, context fallback, exception owner, coverage registration, generated and
  hand-maintained docs, and provider/setup/SDK tests. All three authenticated model labels and the live
  gauntlet result are recorded; identity remains inconclusive because controls are absent.
- **GREEN:** Exact upstream IDs are preserved beneath `river/`; the catalog is key-authenticated through the
  shared resolver and does not filter rows; context limits exist only for the three vendor-documented models.
  Two existing positional-ladder tests and the registry provider-count fixture were updated for the added
  provider and slot.
- **AUDIT:** Targeted registry, catalog, setup, SDK, provider-doc drift, and scope-register checks pass. Full
  `bun run typecheck` passes. The first full suite exposed two stale ladder assertions and one transient
  terminal-watchdog failure; focused reruns confirmed the watchdog passes, the ladder tests were corrected,
  and a subsequent full `bun run test` completed with exit 0.
- **ADVERSARIAL:** The identity result is not overstated as model-weight confirmation: all three routes
  responded and echoed the requested model label, but no independent control models exist. Future
  account-visible IDs remain selectable without guessed window metadata. River retains its own positional slot
  and cached fallback, and the custom-catalog tail remains last.
- **CHANGE DELTA:** Added registry-derived River support, an authenticated all-rows live catalog, three
  documented context fallbacks, setup and SDK route tests, provider docs, and updated ladder expectations. No
  unrelated cleanup is included.

### Loop 3 — Final convergence

- **RED:** Awaiting completion of lint, repository validation, formatting, final reachability evidence,
  commit, and push.
- **GREEN:** No further code changes proposed.
- **AUDIT:** Full typecheck and full repository tests pass; remaining declared gates are in progress.
- **ADVERSARIAL:** Gauntlet evidence supports route reachability and returned-label agreement only; identity
  remains inconclusive.
- **CHANGE DELTA:** Verification record updated after implementation; final closure evidence will be added
  after remaining gates and commit.

## Resolution

- **Closed Date:** pending implementation
- **Fix Description:** pending implementation
- **Tests Added:** pending implementation
- **Verification Evidence:** pending implementation

## Lessons Learned

An account-specific model-list endpoint should drive the live picker catalog. A response that echoes the
requested model ID is useful route evidence, but an identity verdict needs independent controls and must
remain inconclusive without them.
