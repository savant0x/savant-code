# FID: model picker renders a free-key lane and orders provider groups by registry order

**Filename:** `FID-2026-1007-017-model-picker-free-key-lane-and-order.md`
**ID:** FID-2026-1007-017
**Severity:** low
**Status:** verified
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Two defects in the `/model` picker, reported by the operator from the rendered
list. **(1)** The synthetic `⭐ FREE KEY` section emitted a **key-lane row**
(`CHATANYWHERE_API_KEY: ···· (free key set)`) directly beneath the section
header, so the free lane read as *ChatAnywhere's* section instead of a lane of
free models — the operator: *"it does not need 'chatanywhere api key' first
line, it should simply show the regular chatanywhere in the model page like
normal"*. **(2)** Provider groups were ordered by the registry `order` field,
not by name: `openai` carries `order: 0`, so OPENAI sorted first — *"the first
entry is openai after the free providers … the list is not in alphabetical order
by providers"*. Fix: the free section renders **models only** (no key lane) and
provider groups are ordered **alphabetically by provider id**.

## Environment

- **OS:** Windows (win32), Bash (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint` (`--max-warnings 0`), `prettier --check`
- **Commit/State:** `main`; FIDs 010–016 committed locally

## Detailed Description

### Problem

The free lane carried a key-slot row, and the provider groups were not in
alphabetical order.

### Expected Behavior

The `⭐ FREE KEY` section lists the hoisted free-token models and **nothing
else**; the free-key provider (chatanywhere) appears as an ordinary provider
group with its ⭐ rows. Provider groups are ordered A→Z by provider id, free
section first.

### Root Cause

Two independent choices in `cli/src/components/model-picker-grouping.ts`.

- `freeKeyItems()` (`FREE_KEY_PROVIDERS` in `cli/src/utils/free-badge.ts:27`)
  was pushed into the section whenever a free-key provider contributed any row,
  rendering `ModelPickerKeyRow`.
- Provider groups were sorted by `getProviderOrder()` = the registry `order`
  field (`common/src/providers/derive.ts` → `deriveProviderOrder`). `openai`
  carries `order: 0` (`common/src/providers/registry-partitioned-2.ts:84`) —
  the same as `openrouter` — so the `localeCompare` tie-break put OPENAI first.

### Evidence

The section push, pre-fix:

```text
items.push({ type: 'header', provider: null, label: `${FREE_BADGE} FREE KEY` })
items.push(...keyItems)   // CHATANYWHERE_API_KEY: ···· (free key set)
items.push(...free)
```

The sort, pre-fix:

```text
const providers = Array.from(byProvider.keys()).sort((a, b) => {
  const orderDiff = getProviderOrder(a) - getProviderOrder(b)   // registry order
  if (orderDiff !== 0) return orderDiff
  return a.localeCompare(b)
})
```

Operator-provided rendering (the defect): `⭐ FREE KEY` → `CHATANYWHERE_API_KEY:
···· (free key set)` → a wall of `apinex/free/*` rows, then provider groups
beginning at `OPENAI`.

## Impact Assessment

### Affected Components

- `cli/src/components/model-picker-grouping.ts`
- `cli/src/components/model-picker.tsx`, `model-picker-rows.tsx`
- `cli/src/components/__tests__/model-picker-free-section.test.ts`

### Risk Level

- [x] Low: display-only; no routing, catalog or key handling changes

## Proposed Solution

### Approach

Drop the key-lane plumbing from the picker and sort provider groups by id.

### Steps

1. Remove `freeKeyItems`, the `KeyItem` type and its `ListItem` member; the
   `⭐ FREE KEY` section is emitted only when it has hoisted free-token models.
2. Sort provider groups with `a.localeCompare(b)` on the provider id; keep
   `getProviderOrder` as the registry-derivation contract (still exercised by
   `custom-catalog.test.ts`).
3. Delete `ModelPickerKeyRow` and the picker's `item.type === 'key'` branch.
4. Update `model-picker-free-section.test.ts` to the new behaviour (this
   supersedes the key-lane pins from FID-2026-1005-010 / FID-2026-1007-005 at
   the operator's direction).

### Verification

```bash
cd cli && bun test src/components/__tests__/model-picker-free-section.test.ts
bun run --cwd=cli typecheck
bun x eslint cli/src/components/ --max-warnings 0
```

## Verification Gates

- gate: test cli/src/components/__tests__/model-picker-free-section.test.ts
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:02b44bb9012c2cda09569f19e3b77f11414b58d43424f5eb4e0b09916d86791f
- verified: 2026-10-08T04:02:18.901Z
- test cli/src/components/__tests__/model-picker-free-section.test.ts: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) The free section renders a `CHATANYWHERE_API_KEY` key row and so
  mislabels the lane. (2) Provider groups follow registry `order`, putting
  `openai` (order 0) first instead of alphabetical.
- **GREEN:** Remove the key lane; sort provider groups by id.
- **AUDIT:** The section still hoists free-token entries and still leads the
  list; the free-key provider keeps its own group and its ⭐.
- **ADVERSARIAL:** Does removing the key lane lose the operator's ability to see
  the free key? No — the key is set via the provider flow; the picker no longer
  claims to own it. Does alphabetical ordering break the openrouter-default?
  No — the picker never selected a default by order; boot selection is separate.
- **CHANGE DELTA:** n/a (single-pass fix)

### Missed Questions

1. **Should the whole `⭐ FREE KEY` section go?** → No. The operator: *"i want the
   free key there"* — the section stays; only its key line goes.
2. **Sort by id or by display label?** → Id. The header renders
   `provider.toUpperCase()`, so id is what the operator reads.
3. **Is `getProviderOrder` now dead?** → No — it is the registry-derivation
   contract for custom providers (`order: 5`), pinned by
   `custom-catalog.test.ts`. Kept, with its comment updated to say the picker no
   longer groups by it.

## Resolution

- **Closed Date:** pending
- **Fix Description:** The free-key lane is removed; provider groups order A→Z.
- **Tests Added:** `model-picker-free-section.test.ts` updated (5 tests).
- **Verification Evidence:** receipt below.
- **Archived:** pending

### Code Verification Evidence

```text
cd cli && bun test src/components/__tests__/model-picker-free-section.test.ts
 5 pass / 0 fail

bun run --cwd=cli typecheck
 exit 0

bun x eslint cli/src/components/ --max-warnings 0
 exit 0
```

## Lessons Learned

**A synthetic section must not name a provider it does not own.** Putting a
`CHATANYWHERE_API_KEY` row under `⭐ FREE KEY` made the lane read as
ChatAnywhere's; a section that aggregates rows across providers should carry no
provider-specific key line.
