# FID-2026-1008-005 — /model stale-while-revalidate, gauntlet docs, registry-only auto-wire

**Filename:** `FID-2026-1008-005-model-picker-swr-gauntlet-docs-autowire.md`
**ID:** FID-2026-1008-005
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-08
**Automation level:** 2
**YAGNI-Compliance:** Verified

Register: SCOPE.md T172

## Summary

Operator request (2026-10-08): "make a fid for this, run full perfection loop on
the fid then present it". Three recommendations accepted:

1. **`/model` stale-while-revalidate.** Opening the picker awaits the full
   gateway merge. Measured: cold fetch 5409 ms for 2234 models; cached 0 ms.
   Open the picker from the in-memory cache when it has rows, then refresh in
   the background and update the open picker.
2. **Gauntlet docs.** The provider quality and identity gauntlets exist
   (`scripts/providers/`), but no document explains them. Add
   `docs/provider-gauntlets.md` and link it from the AGENTS.md docs map.
3. **Registry-only auto-wire.** Selecting a model whose provider is in the
   registry but unkeyed ("Not wired") runs the existing `/provider <id>` key
   flow inline and makes that model active when the key is saved. No
   harvested-candidate wiring (that remains deferred).

## Root cause / RED

- 1: `cli/src/commands/defs/model-provider-commands.ts` (~line 66) does
  `const models = await fetchGatewayModels()` before
  `useModelPickerStore.getState().open(models)`. The picker cannot open until
  the merge completes. `getCachedGatewayModels()` and
  `subscribeGatewayCatalog()` already exist in
  `cli/src/utils/openrouter-models/gateway.ts`. `cli/src/state/model-picker-store.ts`
  has no action to replace models on an open picker.
- 2: No doc covers `scripts/providers/quality-gauntlet.ts` or
  `scripts/providers/identity-gauntlet.ts`. AGENTS.md's docs map does not list
  them.
- 3: `cli/src/chat/use-chat-pickers.ts` `handleModelPickerSelect` calls
  `applyModelPickerSelection` (`cli/src/utils/provider-setup.ts`). For an
  unkeyed provider that call declines activation and only persists the
  preference. The user gets no key prompt. `handleProviderPickerSelection`
  (`cli/src/commands/provider-subcommands-picker.ts`) runs the key flow, but
  key save (`cli/src/commands/router/route-masked-key-setup.ts`
  `saveKey`) does not activate the provider, so a saved key would not wire the
  picked model.

## Proposed solution

1. New `cli/src/utils/model-picker-open.ts`: `openModelPicker({ readCached,
   refresh, open, setModels, isOpen })` (dependency injection). If the cache is
   non-empty, open immediately and fire `refresh().then(setModels-if-open)` in
   the background. If the cache is empty, await `refresh()` (the cold path is
   unchanged). `model-picker-store.ts` gains `setModels(models)` that keeps the
   query and clamps the selected index.
2. `model-provider-commands.ts` calls `openModelPicker` with the gateway seams.
3. New `cli/src/utils/model-picker-autowire.ts`: a single pending slot
   `{ modelId, provider }`. `stageModelAutoWire(model)`,
   `completeModelAutoWire(provider, apply)` applies and clears only when the
   provider matches, `clearModelAutoWire()`. Pure, with `apply` injected.
4. `use-chat-pickers.ts` `handleModelPickerSelect`: when the provider has setup
   info and no credentials, stage the model, run
   `handleProviderPickerSelection(provider, …)`, and skip the immediate
   activation. Otherwise keep `applyModelPickerSelection`.
5. `route-masked-key-setup.ts` `saveKey`: after `saveProviderApiKey`, call
   `completeModelAutoWire(provider, applyModelPickerSelection)`.
6. `docs/provider-gauntlets.md` documents the two gauntlets, their inputs, costs,
   report locations, and that neither is a merge gate. Link from AGENTS.md.

## Verification Gates

- gate: test cli/src/utils/__tests__/model-picker-open.test.ts
- gate: test cli/src/utils/__tests__/model-picker-autowire.test.ts
- gate: test cli/src/chat/__tests__/model-picker-activation.test.ts
- gate: test cli/src/commands/__tests__/provider-picker-add-new.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:1f1239f902a539e5d8eefb658d1eb395f916adc66feca363963b0e27d9d02ff4
- verified: 2026-10-08T21:50:32.187Z
- test cli/src/utils/__tests__/model-picker-open.test.ts: exit 0
- test cli/src/utils/__tests__/model-picker-autowire.test.ts: exit 0
- test cli/src/chat/__tests__/model-picker-activation.test.ts: exit 0
- test cli/src/commands/__tests__/provider-picker-add-new.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Cited above. Latency measured by script: cold 5409 ms, cached 0 ms.

### Loop 2 — GREEN

Implement items 1–6. Tests pin: cached open is synchronous (no awaited
refresh); background refresh updates an open picker; a closed picker is not
mutated; cold path awaits; auto-wire stages, completes only for the matching
provider, and clears after apply.

### Loop 3 — AUDIT

Re-run all gates on final files. Compare before/after timing for `/model`
open with the cached path.

### Missed Questions

- Harvested-candidate wiring remains out of scope (operator ruled registry-only).
- Concurrent `/model` opens share the in-flight refresh (existing inflight
  guard in `fetchGatewayModels`).

### Code Verification Evidence

Loop 1 RED:

- `/model` lag measured in `cli/`: cold fetch 10,874 ms for 2234 rows; a
  stale-TTL invocation (the old `await fetchGatewayModels()`) paid 10,025 ms
  before `open(models)`.
- 1: `model-provider-commands.ts` awaited the full merge; `model-picker-store.ts`
  had no `setModels` action.
- 3: `handleModelPickerSelect` declined activation for unkeyed providers with
  no prompt; `route-masked-key-setup.ts` `saveKey` did not activate.

Loop 2 GREEN / Loop 3 AUDIT (run from repo root unless noted):

- The five declared `test` gates run together from the `cli` workspace →
  **41 pass, 0 fail** (122 expect() calls).
- `bun run --cwd=cli typecheck` → **exit 0** (re-run after the import-order
  fix).
- `bun x eslint <9 changed .ts/.tsx files> --max-warnings 0` → **exit 0**;
  `bun x prettier --check <12 changed files>` → clean.
- Timing (AUDIT): cache-first open → **0 ms** to `open()`; background rebuild
  continues separately (10,025 ms when forced). Old path: 10,025 ms.
- New suites: 5 tests pinning cache-first open ordering (cached open precedes
  refresh; background refresh updates an open picker; closed picker not
  mutated; cold path awaits; cold-empty reports not-opened), 5 pinning
  auto-wire (apply-once on matching provider; other provider leaves pending;
  restage replaces; clear drops; no-op when empty).
- Docs: `docs/provider-gauntlets.md` cites only facts from
  `identity-gauntlet.ts` / `quality-gauntlet.ts` headers; FID paths and test
  paths confirmed by glob (`FID-2026-0915-001-…` and
  `FID-2026-1007-008-…` both archived); AGENTS.md docs-map link added.
- Repo gates: `bun run validate:repository`, `bun run lint:md`,
  `bun run scripts/scope-register-check.ts` — results recorded in Resolution.

## Resolution

**fixed** (2026-10-08) — all three items implemented and gate-verified:

1. `/model` opens from the gateway cache in **0 ms** (was 10,025 ms on a
   stale-TTL invocation) and refreshes in the background; picker rows update
   only while the picker stays open. 5 new tests.
2. `docs/provider-gauntlets.md` published and linked from the AGENTS.md docs
   map.
3. Registry-only auto-wire: picking a model for an unkeyed registry provider
   runs the `/provider <id>` key flow; saving that key applies the staged
   model (matching provider only, applied once). 5 new tests; existing
   fail-closed activation pins still pass.

Receipt: `bun run fid:verify … --write` PASS (tests ×3, typecheck cli,
quality). `validate:repository` PASS; `lint:md` PASS; `scope-register-check`
PASS (T172). `use-chat-pickers.ts` refactored (shared `syncInputValue`
adapter) to stay under the 300-line quality ceiling — 298 lines.

Note: FID-2026-1008-004 item C (auto-wire) is resolved by this FID's item 3
registry-only branch; harvested-candidate wiring remains deferred.
