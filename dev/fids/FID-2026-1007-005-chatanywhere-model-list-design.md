# FID: ChatAnywhere is in the registry, the docs and the free-key lane — but not in the `/model` list

**Filename:** `FID-2026-1007-005-chatanywhere-model-list-design.md`
**ID:** FID-2026-1007-005
**Severity:** medium
**Status:** converged
**Created:** 2026-10-07 15:55
**Automation level:** 3
**YAGNI-Compliance:** Pending

---

## Summary

ChatAnywhere is a registered provider with a checked-in 27-model catalog, documented
provider surfaces, and — uniquely — a free-key lane in the `/model` picker
(`FREE_KEY_PROVIDERS = [{ provider: 'chatanywhere', envVar: 'CHATANYWHERE_API_KEY' }]`,
`cli/src/utils/free-badge.ts:23`). It contributes **zero rows** to `/model`.
`fetchGatewayModels` fans out to 21 provider fetchers and chatanywhere is not one of
them (`cli/src/utils/openrouter-models/gateway.ts:180-198`), and outside tests
`cli/src` names chatanywhere exactly once — in that free-key list. So the only
chatanywhere surface the operator can see is a blank `CHATANYWHERE_API_KEY` row inside
the synthetic `⭐ FREE KEY` section, and that section appears for an *unrelated*
reason: other providers ship `:free` model ids (`tokenharbor/…:free`,
`unorouter/…:free`, `infron/…:free`, `tokenrouter/…-free`), which the same predicate
matches. A key lane advertising a provider whose models are not in the list is the
"designed wrong" half of the report; the "not matching the rest of the list" half is
that `FREE_KEY_PROVIDERS` hoists a whole provider roster out of its provider group, so
even a correct wiring would render chatanywhere's 27 rows inside `⭐ FREE KEY` while
every other provider keeps a `PROVIDER` group — measured with the shipped
`buildGroupedItems`, not inferred.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint (repo-pinned), prettier (repo-pinned)
- **Commit/State:** base `0fd258dd` plus this record (the retention closure commits
  precede it). Working tree clean apart from three parked untracked inputs this record
  does not touch.
- **Measured with:** `dev/scratchpad/active/probe-model-list-chatanywhere.ts`
  (gitignored probe; drives the SHIPPED `fetchGatewayModels` and
  `buildGroupedItems`) plus the greps quoted below

## Detailed Description

### Problem

Operator report, verbatim: *"looking at the /model list, the 'chatanywhere' list seems
to be designed wrong and not matching the rest of the list too -- we need to review it,
open a fid for a fix"*.

Three distinct defects share one surface.

**(1) The provider's models never reach the picker.** The `/model` command opens the
picker with `await fetchGatewayModels()` (`cli/src/commands/defs/model-provider-commands.ts:66`).
That function's `Promise.allSettled` fan-out covers OpenRouter, NVIDIA, Nous, KiosAPI,
APInex, OpenAI, OrcaRouter, B.AI, Vercel, CleanAPIs, CodeCraft, xKiro, custom catalogs
(`gateway.ts:180-198`) and then merges thirteen static builders
(`gateway.ts:224-243`) — TokenRouter, TokenHarbor, CommandCode, HCNSec, TokenBom,
Infron, UnoRouter, BazaarLink, Atria, Intern. ChatAnywhere is absent from both lists.

**(2) The free-key lane points at a provider with nothing behind it.** The `⭐ FREE KEY`
section is emitted when `free.length > 0` (`model-picker-grouping.ts:81-98`), and
`freeKeyItems()` renders one blank key row per `FREE_KEY_PROVIDERS` entry regardless of
whether that provider contributed any rows (`model-picker-grouping.ts:57-63`). Because
other providers' `:free` ids satisfy `isFreeTierEntry`, the section is present in a real
catalog — so the operator sees `CHATANYWHERE_API_KEY: ______ (blank — add your free
key)` in a list that contains no chatanywhere model at all, while the key the row asks
for is already set.

**(3) The section rule would still misplace the roster after a correct wiring.**
`buildGroupedItems` hoists **every** `isFreeTierEntry` row into the synthetic section
and `continue`s past provider grouping (`model-picker-grouping.ts:66-98`), so
chatanywhere's roster would appear under `⭐ FREE KEY` instead of a `CHATANYWHERE`
header. The operator's own rule for the marker was per-entry — *"if it has free in the
name or is from this provider, add the star"* — which is a star on the row, not a
relocation of the provider.

### Expected Behavior

- `/model` lists chatanywhere's chat roster as a normal `CHATANYWHERE` provider group,
  with the per-row ⭐ the free-key predicate already computes for each entry.
- The `⭐ FREE KEY` section collects free-related **entries** and the key slots that
  need them, and it never renders a key lane for a provider that contributed no rows.
- A provider whose registry entry declares `catalog.modelsRef` cannot be silently
  absent from the picker: the condition that produced this defect fails a gate.

### Root Cause

The provider was added along one axis only. FID-2026-1005-010 registered the provider
(`common/src/providers/registry-partitioned-2.ts:185`, `catalog.modelsRef: 'chatanywhere'`),
wired the catalog into `MODEL_CATALOGS` (`common/src/providers/model-catalogs.ts:36`),
covered its windows (`common/src/constants/context-window-table-chatanywhere.ts`) and
documented it — but the `cli`-side catalog builder that every other `modelsRef`
provider has was never written, and nothing enforces that pairing. The `intern` entry is
the close precedent: same `modelsRef` shape, same "no window fields on `/v1/models`"
finding, and it has a builder in `cli/src/utils/openrouter-models/static-catalogs-gateways.ts:186-217`.
The free-key lane was added by the same record, so the one CLI surface that names
chatanywhere is also the one that made its absence look intentional.

### Evidence

**(a) The catalog the picker actually receives — 21 providers, 166 rows, zero
chatanywhere** (`bun run dev/scratchpad/active/probe-model-list-chatanywhere.ts`, driving
the shipped `fetchGatewayModels(true)`):

```text
rows: 166
--- providers contributing rows ---
(unset → openrouter semantics): 2      nvidia: 2        bai: 2
apinex: 2                              openai: 2        bazaarlink: 12
atria: 1                               orcarouter: 2    cleanapis: 2
codecraft: 2                           tokenbom: 7      commandcode: 33
hcnsec: 7                              infron: 9        intern: 10
kiosapi: 2                             nous: 2          tokenharbor: 17
tokenrouter: 31                        unorouter: 17    vercel: 2
--- rows whose id mentions chatanywhere ---
[]
```

**(b) The only non-test reference to the provider in the CLI source:**

```text
$ grep -rn "chatanywhere" cli/src sdk/src common/src/providers/registry-partitioned-2.ts | grep -v __tests__
cli/src/utils/free-badge.ts:23:}> = [{ provider: 'chatanywhere', envVar: 'CHATANYWHERE_API_KEY' }]
common/src/providers/registry-partitioned-2.ts:185:  chatanywhere: {
… (the registry entry, its baseUrl, its modelsRef and its evidence line)
```

**(c) Where the rows would land after a correct wiring** (same probe, synthetic rows fed
to the shipped `buildGroupedItems`):

```text
--- grouped layout for a synthetic chatanywhere row ---
HEADER  ⭐ FREE KEY [null]
KEY     CHATANYWHERE_API_KEY ready=true
MODEL   chatanywhere/deepseek-v4-pro (chatanywhere)
MODEL   chatanywhere/gpt-5.6-sol (chatanywhere)
HEADER  INTERN [intern]
MODEL   intern/glm-5.3 (intern)
```

Note `ready=true`: the key is set, so the blank-lane row is asking for a key the
operator already provided.

**(d) The section appears in production for an unrelated reason** — the free-token
predicate matches other providers' `:free` ids, e.g.
`tokenharbor/deepseek-v4-flash:free`, `unorouter/glm-5.3-flash:free`,
`infron/qwen/qwen3.8-27b:free` (`static-catalogs.ts:84-85`,
`static-catalogs-gateways.ts:26-75`), so `free.length > 0` holds without chatanywhere.

## Impact Assessment

### Affected Components

- `cli/src/utils/openrouter-models/gateway.ts` (the fan-out and the merge list)
- `cli/src/utils/openrouter-models/static-catalogs-gateways.ts` and/or a new
  `cli/src/utils/openrouter-models/chatanywhere.ts` (the missing builder)
- `cli/src/utils/free-badge.ts` and `cli/src/components/model-picker-grouping.ts`
  (the hoisting rule and the key-lane condition)
- `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`,
  `cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts`,
  `cli/src/components/__tests__/model-picker-free-section.test.ts`
- `scripts/provider-catalog-parity.ts` (the census that can catch the class)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

A registered provider is unselectable from the picker; the operator can still route to
it (`/provider chatanywhere` plus an explicit model id), which is why this is medium
rather than high. The section defect is cosmetic but it makes the picker's free-key
lane misleading, and the class (a `modelsRef` with no CLI builder) is what let the
provider ship in this state.

## Proposed Solution

### Approach

Finish the axis that was left open, then make the section rule honest, then close the
class mechanically.

The catalog source should follow the `intern`/`atria` precedent: the gateway publishes
**no window fields** on its keyed `/v1/models` (30 rows, `id`/`object`/`created`/`owned_by`,
probed 2026-10-05 and recorded in the registry entry's own evidence line) and its chat
roster is already a checked-in 27-row map (`chatanywhereModels`), so a static builder in
`static-catalogs-gateways.ts` is the source of truth, and the live endpoint stays the
audit that keeps that map honest — exactly how `intern` is built and pinned.

### Steps

1. Add the CLI catalog builder for `chatanywhere` beside `fetchInternModels` /
   `fetchAtriaModels` in `cli/src/utils/openrouter-models/static-catalogs-gateways.ts`,
   deriving ids and names from `chatanywhereModels` with `id_transform: 'strip'`
   semantics (the internal `chatanywhere/` prefix is the routing prefix, never the wire
   id). No second store and no second catalog: the map already exists.
2. Wire it into `fetchGatewayModels` — the merge list, the `resolveGatewayLiveCatalogs`
   positional contract where static catalogs are joined, and
   `__resetOpenRouterModelsCacheForTest` (module-scope state, FID-2026-1007-002 class).
3. Change the hoisting rule in `buildGroupedItems`: keep the per-row ⭐ from
   `freeBadgeFor` for every free-related entry, but stop relocating a whole **provider**
   roster — a provider that has a group keeps its group, and the synthetic section
   collects the free-key slots plus the free-named entries that belong to no group. The
   operator's rule is about the marker, not the placement.
4. Make a free-key lane honest: emit the key row only where the section can say what it
   is for, and never for a provider that contributed no rows (or state that the provider
   is unreachable, which is the honest version of the same row).
5. Close the class in `scripts/provider-catalog-parity.ts` — it already measures
   per-provider row counts through the production function, so extend it with the
   assertion: every active provider whose registry entry declares `catalog.modelsRef`
   must contribute rows (or carry a stated, checked reason), which is the condition that
   was false here and true for nothing else.
6. Keep the documented surfaces registry-derived: the provider tables, the model counts
   and the `chatanywhere.catalog.model-count` fact are already generated, so re-run the
   generators rather than editing prose.

### Verification

- The wiring is pinned from the production entry point: extend
  `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts` with the
  chatanywhere rows, and re-run
  `cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts` so the
  roster and the window seam still agree.
- The section rule is pinned in
  `cli/src/components/__tests__/model-picker-free-section.test.ts`: a free-key provider
  with rows keeps its `CHATANYWHERE` group AND each row is starred; a free-key provider
  with no rows does not produce a key lane; the ⭐ section still collects free-named
  entries from other providers.
- The registry/catalog pairing is pinned in
  `common/src/providers/__tests__/provider-registry.test.ts` (the `modelsRef` surface)
  and enforced by the census leg in `scripts/provider-catalog-parity.ts`.
- `typecheck cli`, `typecheck common` and `quality` gate the change.

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts
- gate: test cli/src/components/__tests__/model-picker-free-section.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: probe scripts/provider-catalog-parity.ts
- gate: quality

> The census probe reaches the network (it calls `fetchGatewayModels(true)` against the
> live endpoints) and therefore reports provider coverage only when the keyed providers
> are reachable; that boundary is stated here rather than hidden, and the offline proof
> of the same property is the account-level rows the record pins in the three suites.

## Perfection Loop

### Loop 1 — RED

- **RED (measured, not read):** the probe drove the SHIPPED `fetchGatewayModels(true)`
  and the SHIPPED `buildGroupedItems` rather than a mirror: 166 rows from 21 providers
  and `[]` for chatanywhere; a synthetic chatanywhere row lands in `⭐ FREE KEY` with the
  `CHATANYWHERE_API_KEY` lane above every provider group. Both halves of the operator's
  report are reproduced before any edit.
- **GREEN:** the plan above (builder → fan-out → section rule → honest lane → census →
  registry-derived docs).
- **AUDIT:** the read side was verified at `file:line` rather than from the report:
  `gateway.ts:180-198` (fan-out) and `:224-243` (merge) contain no chatanywhere;
  `claude`-style absence claims are stated with the exact grep in `### Evidence` (b);
  the `intern` precedent is cited at `static-catalogs-gateways.ts:186-217`, and
  `common/src/providers/model-catalogs.ts:36` shows the `modelsRef` registration that
  has no CLI counterpart.
- **ADVERSARIAL:** the strongest objection is that the fix should wait for the
  operator's design call between "static roster" and "live keyed fetch". The evidence
  answers it: the gateway publishes no window fields, so a live-derived catalog would
  produce rows the window seam cannot describe — the exact reason `intern` is static —
  and the live endpoint stays in the loop as an audit. A second objection is that the
  free-key lane was itself an operator request, so removing hoisting could read as
  undoing it; the plan keeps the marker the operator asked for on every entry and
  removes only the relocation, which the request never asked for.
- **CHANGE DELTA:** new document (n/a).

### Missed Questions

1. **Is chatanywhere reachable at all today?** Yes, by `/provider chatanywhere` plus an
   explicit model id — the picker is the missing surface, which is what makes this
   medium rather than high.
2. **Does the registry entry already carry a keyed, verified evidence line?** Yes: 30
   rows on a keyed `/v1/models` probe, 3 `text-embedding-*` ids excluded as non-chat, and
   a free-key tier of 10,000 points/day (`registry-partitioned-2.ts:213-227`). The
   record's job is the CLI seam, not re-deriving that.
3. **Should the roster be live-fetched instead of checked in?** No, and the reason is
   structural: the gateway publishes no window fields, so the picker would show rows
   whose context windows the window seam cannot resolve. `intern` is the precedent.
4. **Does the window seam already cover the roster?** Yes —
   `context-window-table-chatanywhere.ts` holds 13 exact-id rows cross-gateway
   consensus plus 14 documented no-row ids, pinned by
   `window-truth-chatanywhere.test.ts`. The plan only has to keep it true.
5. **Why did nothing catch a provider with a `modelsRef` and no picker rows?** Because
   the pairing is derived in one direction only: the registry types
   `catalog.modelsRef` as `keyof typeof MODEL_CATALOGS` (compile-time), but nothing
   asserts that a `modelsRef` provider reaches `fetchGatewayModels`. That asymmetry is
   the class, and step 5 is its fix.
6. **Is the free-key list itself wrong?** Not as a rule — it is the operator's own
   marker surface — but it is wrong as a *section* condition: it is consulted for the
   lane while the rows it names are absent, and its predicate also collects other
   providers' `:free` ids, so the section's contents do not correspond to its title.
7. **Does any documentation state a chatanywhere model count the fix would invalidate?**
   Yes, `chatanywhere.catalog.model-count = 27` is a registry fact gated by
   `scripts/provider-docs-counts-drift.ts`; the fix feeds the same map, so the count and
   the docs stay generated rather than hand-edited.

### Implementation Evidence (REQUIRED for `closed`)

> NOT STARTED. This record converges the plan; no production edit has been made for it.

- [ ] **Commit SHA:** —
- [ ] **File:line ranges:** —
- [ ] **Gate output:** —
- [ ] **Reproducibility:** the measurement is reproducible today with
      `bun run dev/scratchpad/active/probe-model-list-chatanywhere.ts` (gitignored) and
      the greps in `### Evidence`
- [ ] **Step statuses:** steps 1-6 planned; none started

### Code Verification Evidence

> Claims below were read in this pass against the shipped tree.

- [x] Files referenced in Affected Components exist, verified by read: `gateway.ts`,
      `gateway-lookup.ts`, `static-catalogs-gateways.ts`, `free-badge.ts`,
      `model-picker-grouping.ts`, `model-picker.tsx`, `model-picker-rows.tsx`,
      `model-provider-commands.ts`, `registry-partitioned-2.ts`,
      `providers/model-catalogs.ts`, `context-window-table-chatanywhere.ts`,
      `scripts/provider-catalog-parity.ts`
- [ ] Implementation matches the Proposed Solution — not started
- [ ] Typecheck/tests/lint pass with pasted tool output — not started
- [ ] Production call-graph evidence for new wiring — the ABSENCE is the call graph
      evidence for this record: `fetchGatewayModels` ← `model-provider-commands.ts:66`
      (`/model`) and `cli/src/index.tsx:188` (boot prefetch), and neither reaches any
      chatanywhere parser because none exists
- [x] FID status reflects the actual implementation state (`converged`: the plan is
      complete and measured, no code has been written)

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Archived:** —

## Lessons Learned

1. A provider is registered along several axes — registry entry, catalog map, windows,
   docs, marker rules — and every axis has its own consumer. Adding four of them and
   missing the fifth leaves a provider that every gate agrees is present and no user can
   select.
2. A marker surface can outrun its subject. The free-key lane was correct in intent
   (name the key slot, star free entries) and became misleading the moment it rendered a
   key for a provider whose rows do not exist — a lane is a promise that something is
   behind it.
3. A derived-pairing check is worth more than the pairing itself: `modelsRef` is
   type-checked into the catalog registry and nothing checked it out to the picker,
   which is why this survived a closed record with green gates.
