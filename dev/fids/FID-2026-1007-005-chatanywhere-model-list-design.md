# FID: ChatAnywhere is in the registry, the docs and the free-key lane — but not in the `/model` list

**Filename:** `FID-2026-1007-005-chatanywhere-model-list-design.md`
**ID:** FID-2026-1007-005
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-07 15:55
**Automation level:** 3
**YAGNI-Compliance:** Verified

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

**Status: fixed and gated (2026-10-07, commit `edc761a8`).** All six steps are
implemented. The provider has a builder off the checked-in map and is in the merge list;
the `⭐ FREE KEY` section hoists free-TOKEN entries only and never relocates a roster out
of its own provider group; the key lane renders only for a free-key provider that actually
contributed rows; and the class is closed mechanically — `catalogPairingIssues` fails when
a provider declaring `catalog.modelsRef` contributes zero picker rows, or when an audited
exception starts contributing. Measured live through the shipped `fetchGatewayModels`:
the census now reports `chatanywhere: 27`, and `provider-parity-check` PASSES.

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

**(e) The same measurement after the fix, through the SHIPPED production function**
(`bun scripts/provider-catalog-parity.ts --check`, which calls
`fetchGatewayModels(true)` against the live endpoints):

```text
$ bun scripts/provider-catalog-parity.ts --check
Parity census 2026-10-07T20:28:07.295Z — 2220 rows:
  atria: 1          bai: 59         bazaarlink: 12   chatanywhere: 27
  cleanapis: 33     codecraft: 33  commandcode: 33  hcnsec: 7
  infron: 9         intern: 10      kiosapi: 2      nous: 2 …
Registry/catalog pairing: every modelsRef provider contributes rows.
exit 0
```

**(f) The class check is two-directional, and its offline legs were run RED first.** The
live probe above needs the keyed endpoints to say anything, so the property itself is
pinned offline in `scripts/__tests__/provider-catalog-parity.test.ts` (8 pass / 0 fail):
a `modelsRef` provider with zero rows is reported, an audited exception that starts
contributing is reported, and a census where every non-exception provider contributes is
silent. Before step 5 the module exported no such helper, so the pin could not exist at
all — the RED here is an absence, which is why the live probe is quoted above as the
end-to-end proof.

**(g) The section rule, after the fix** (`buildGroupedItems`, shipped):

```text
input: chatanywhere/gpt-5.6-sol + openai/kept + tokenharbor/free-mini
HEADER  ⭐ FREE KEY [null]          ← section: the lane for a present free-key provider
KEY     CHATANYWHERE_API_KEY ready=true
MODEL   tokenharbor/free-mini      ← hoisted: its OWN id carries the free token
HEADER  OPENROUTER [openrouter]
MODEL   openai/kept
HEADER  CHATANYWHERE [chatanywhere] ← the roster keeps its own group, starred in place
MODEL   chatanywhere/gpt-5.6-sol

input: tokenharbor/free-mini only  →  zero `type: 'key'` rows (pre-fix: one, for a
                                       provider with no rows in the list at all)
```

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

1. **DONE (2026-10-07, commit `edc761a8`) — at a different seam than planned, and the
deviation is stated rather than hidden.** The builder exists as
`cli/src/utils/openrouter-models/chatanywhere.ts` rather than as an entry appended to
`static-catalogs-gateways.ts`. The plan's site was chosen for proximity to
`fetchInternModels`/`fetchAtriaModels`; the implemented module is prose-documented
(vendor prefix, the no-window-fields finding, why the display name is the vendor's bare
id) and keeps that provenance in one auditable place, which is the same reasoning that
gave every live provider its own module. `id_transform: 'strip'` semantics are preserved:
the internal `chatanywhere/` prefix is added once for routing and
`name` is the bare upstream id. No second store and no second catalog — the rows come from
`chatanywhereModels`.
2. **DONE (2026-10-07).** Wired into the merge list (which now lives in
   `gateway-catalog-merge.ts`) immediately after `intern`, before the custom catalogs, and
   re-exported from `cli/src/utils/openrouter-models.ts`. **One planned item is
   deliberately absent:** there is nothing to add to `__resetOpenRouterModelsCacheForTest`.
   The builder is synchronous and derives from a compile-time map, so it holds no
   module-scope state — the FID-2026-1007-002 audit requirement applies to caches, and
   this has none. `bun scripts/module-state-check.ts` confirms no new binding appears.
3. **DONE (2026-10-07).** `buildGroupedItems` hoists on `hasFreeToken` (the entry's own
   name or id) and never on `isFreeKeyProvider`, so a free-key provider's row stays in its
   own group and is starred there by `freeBadgeFor`. `isFreeTierEntry` is unchanged, which
   is what keeps the ⭐ the operator asked for on every row of the provider.
4. **DONE (2026-10-07).** `freeKeyItems(presentProviders)` emits a lane only for a
   free-key provider that contributed rows to this list, and the section is emitted when
   `hoisted.length > 0 || presentProviders.size > 0` — so the section and its lane can no
   longer disagree with their own contents.
5. **DONE (2026-10-07).** `catalogPairingIssues` in `scripts/provider-catalog-parity.ts`
   asserts the pairing in BOTH directions: a `modelsRef` provider contributing zero rows
   is an issue, and an audited exception that starts contributing rows is also an issue
   (so a stale excuse cannot hide a provider that has since been wired). One exception is
   recorded with its reason: `cloudflare`, which is SDK-routed and has no CLI builder.
   `providers:parity --check` now exits non-zero on either kind. The offline pin is in
   `scripts/__tests__/provider-catalog-parity.test.ts` (4 new cases), because the live
   probe needs the keyed endpoints to say anything at all.
6. **DONE (2026-10-07) — and nothing needed regenerating.** The fix feeds the same
   `chatanywhereModels` map the count was derived from, so
   `chatanywhere.catalog.model-count = 27` stays true and
   `bun scripts/provider-docs-counts-drift.ts` is green. No prose was hand-edited.

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
- The census gate reaches the network (it calls `fetchGatewayModels(true)` against the
  live endpoints), so it reports provider coverage only when the keyed providers are
  reachable. That boundary is stated here rather than hidden, and the offline proof of
  the same property is the account-level rows pinned in the three suites.

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts
- gate: test cli/src/components/__tests__/model-picker-free-section.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: probe scripts/provider-parity-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:946d7f3fd948a82147a2d025783de5dcee75222a022016d19da00722142b5e77
- verified: 2026-10-07T20:36:42.660Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts: exit 0
- test cli/src/components/__tests__/model-picker-free-section.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- probe scripts/provider-parity-check.ts: exit 0
- quality: exit 0

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

> COMPLETE. All six steps are implemented and gated; `edc761a8` is the implementation
> commit and its parent is the pre-fix tree.

- [x] **Commit SHA:** `edc761a8`
- [x] **File:line ranges:** `cli/src/utils/openrouter-models/chatanywhere.ts` (the builder
      and its provenance note), `cli/src/utils/openrouter-models/gateway-catalog-merge.ts`
      (the merge row), `cli/src/utils/openrouter-models.ts` (the re-export),
      `cli/src/utils/free-badge.ts` (`hasFreeToken`, `isFreeKeyProvider`, and the doc that
      separates the marker rule from the hoisting rule),
      `cli/src/components/model-picker-grouping.ts` (`freeKeyItems(presentProviders)`, the
      hoisting rule, the section condition),
      `cli/src/components/__tests__/model-picker-free-section.test.ts` (the rewritten
      hoisting pin plus three new pins),
      `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts` (the
      ChatAnywhere rows, pinned from the production entry point),
      `scripts/provider-catalog-parity.ts` (`catalogPairingIssues`,
      `CATALOG_PAIRING_EXCEPTIONS`, the `--check` exit code),
      `scripts/__tests__/provider-catalog-parity.test.ts` (four offline cases)
- [x] **Gate output:** all eight declared gates exit 0 at the stamped receipt
- [x] **Reproducibility:** the RED is reproducible with
      `bun run dev/scratchpad/active/probe-model-list-chatanywhere.ts` (gitignored; drives
      the shipped `fetchGatewayModels` and `buildGroupedItems`) and reverting
      `gateway-catalog-merge.ts` removes the provider again; the GREEN is the same probe's
      post-fix reading plus `bun scripts/provider-catalog-parity.ts --check`, which
      reports `chatanywhere: 27`
- [x] **Step statuses:** steps 1-6 `implemented`/verified (`edc761a8`); step 1 landed at a
      different seam than planned and step 2's reset item is deliberately absent, both
      stated in `### Steps`

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
- [x] FID status reflects the actual implementation state (`fixed`: all six steps are in
      the codebase and gated)
- [x] The production call graph is evidenced for the new wiring, not merely typechecked:
      `fetchGatewayModels` ← `model-provider-commands.ts:66` (`/model`) and
      `index.tsx:188` (boot prefetch), and the census above is the per-provider count that
      the same function now produces — the exact measurement whose absence was the defect

## Resolution

- **Closed Date:** 2026-10-07 16:33
- **Fix Description:** Both halves of the operator's report are cured
  (`edc761a8`). **The provider reaches the picker:**
  `cli/src/utils/openrouter-models/chatanywhere.ts` derives the 27 rows from the
  checked-in `chatanywhereModels` map (the gateway publishes no window fields on its keyed
  `/v1/models`, so the map is the source of truth and the live endpoint stays the audit),
  and `gateway-catalog-merge.ts` merges them before the custom catalogs. Measured live
  through the shipped function: `chatanywhere: 27`. **The section is honest:** the
  `⭐ FREE KEY` section hoists entries whose OWN name or id carries the free token
  (`hasFreeToken`) instead of every free-RELATED row, so a free-key provider's roster
  stays in its own `CHATANYWHERE` group and keeps the per-row ⭐ from `freeBadgeFor`; and
  the key lane renders only for a free-key provider that contributed rows, so the lane can
  no longer ask for `CHATANYWHERE_API_KEY` inside a list containing no chatanywhere model.
  **The class is closed:** `catalogPairingIssues` fails when a provider declaring
  `catalog.modelsRef` contributes zero picker rows, or when an audited exception
  (`cloudflare`, SDK-routed) starts contributing, and `providers:parity --check` exits
  non-zero on either.
- **Tests Added:** Yes — the census pin in
  `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts` (the provider's
  rows plus the builder's 27-row contract and one full row shape, driven through
  `fetchGatewayModels(true)`), three new pins in
  `cli/src/components/__tests__/model-picker-free-section.test.ts` (a free-key row is
  starred inside its own group and never relocated; no key lane for a provider with no
  rows; the lane appears only when its provider contributed), one rewritten pin in the
  same file (the old hoisting expectation described the defect), and four offline cases in
  `scripts/__tests__/provider-catalog-parity.test.ts` for the pairing rule in both
  directions.
- **Verification Evidence:** RED is measured before any edit — the shipped
  `fetchGatewayModels(true)` returned 166 rows from 21 providers and `[]` for chatanywhere,
  and a synthetic chatanywhere row landed in `⭐ FREE KEY` under a key lane for a provider
  whose rows did not exist. GREEN: the census reports `chatanywhere: 27` through the same
  function, `providers:parity --check` exits 0 with "every modelsRef provider contributes
  rows", the cli suite is `3969 pass / 18 skip / 0 fail` across 482 files, and all eight
  declared gates exit 0 at the stamped receipt.
- **Archived:** 2026-10-07 16:33 (moved to `dev/fids/archive/`)

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
4. **A marker rule and a placement rule are different rules, and one function can hide
   that they were conflated.** `isFreeTierEntry` was correct for what the operator asked
   (which rows get a ⭐) and wrong for what the picker used it for (which rows leave their
   provider group). Splitting the predicate made the difference visible; until then the
   only symptom was "this provider does not look like the others".
5. **A green gate proves the property it asserts, not the property you meant.** The
   census could already count rows per provider; what it could not do was care whether a
   provider was missing. The count was right and the conclusion was absent, which is why
   the fix is a two-directional assertion rather than a threshold.

### Loop 2 — fixed (2026-10-07)

- **RED:** measured through the SHIPPED functions before any edit — 166 rows from 21
  providers, `[]` for chatanywhere, and the synthetic-row layout that put a correct
  wiring's roster under `⭐ FREE KEY`. The RED also included the class's absence: nothing
  in the tree could fail on a `modelsRef` provider with no picker rows.
- **GREEN:** the builder, the merge row, the narrowed hoisting rule, the present-provider
  key lane, and the two-directional pairing assertion.
- **AUDIT:** the claim that the failure was invisible to every gate is checked rather than
  asserted — the pairing helper did not exist, `provider-docs-counts-drift` was green
  because the count is derived from the same map, and the picker's own suite pinned the
  hoisting behaviour as CORRECT. The one test that had to change is named in the
  Resolution: the old expectation in `model-picker-free-section.test.ts` was a pin on the
  defect, and it was rewritten to the contract rather than deleted. The audit also
  separated "the new thing works" from "nothing else moved": cli suite
  `3969 pass / 18 skip / 0 fail`, `typecheck cli` and `typecheck common` exit 0,
  `quality:report` PASS after the 300-line splits, eslint `--max-warnings 0` exit 0,
  prettier clean, and `module-state-check` PASS with no new module-scope binding (the
  builder is synchronous and stateless).
- **ADVERSARIAL:** the strongest objection is that this reverses a decision the operator
  asked for — the free-key lane. It does not: the request was for the MARKER ("if it has
  free in the name or is from this provider, add the star"), the star still lands on every
  row of the provider, and the only thing removed is the relocation the request never
  mentioned. The second objection is that the pairing exception for cloudflare is a
  loophole; it is a stated, audited, two-directional one — an entry that starts
  contributing rows fails the check, so it cannot be used to hide a wired provider.
- **CHANGE DELTA:** the status line, the Summary's status paragraph, all six step statuses,
  Evidence (e)-(g), the Implementation Evidence, the Code Verification Evidence, the
  Resolution, two new lessons and this loop.
