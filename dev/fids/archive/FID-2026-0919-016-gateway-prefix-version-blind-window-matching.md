# FID: Gateway-Prefix And Version-Blind Family Matching Poisons Context-Window Resolution

**Filename:** `FID-2026-0919-016-gateway-prefix-version-blind-window-matching.md`
**ID:** FID-2026-0919-016
**Severity:** medium
**Status:** closed
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — one regex sourced from an
existing closed-world registry + a deterministic version-preference
ranking inside two existing match branches; no new catalogs, no config.)

---

## Summary

`resolveContextWindowForModel` (and `resolveMaxOutputTokensForModel`,
which shares the matcher) resolves gateway model ids through
`findModelFieldFromOpenRouter` in `cli/src/utils/openrouter-models/lookup.ts`.
Two defects compound:

1. **Prefix gap.** `toCanonicalModelId` (lookup.ts:24-33) strips only
   `tokenrouter|tokenharbor|nvidia/` prefixes. Every newer gateway id
   (`kiosapi/`, `apinex/`, `orcarouter/`, `bai/`, `hcnsec/`, `tokenbom/`,
   `infron/`, `unorouter/`, `bazaarlink/`, `atria/`, …) keeps its prefix,
   so the exact-match branches (1 and 2) can never hit the upstream
   OpenRouter entry.
2. **Version-blind family fallback.** The remaining family branches
   (3: `startsWith(familyId)`, 3b: terminal-family-name equality,
   lookup.ts:139-161) take the **first hit in id-sorted order**. The CLI
   sorts the OpenRouter catalog by id (`openrouter.ts:73`), so with
   family `"grok"` the first hit is `x-ai/grok-4.20` — `"2" < "3"` sorts
   before `grok-4.3/4.5/4.6`.

**Live-proven symptom (2026-09-19, probe in
`dev/scratchpad/probe-grok-window.ts`):** `kiosapi/grok-4.6-free`
displays **2000.0k** — the window of `x-ai/grok-4.20` (2,000,000) — while
the operator-cited OpenRouter page for `x-ai/grok-4.6` and the live
OpenRouter catalog both say **500,000**. The repo's own audited pins
agree (`common/src/constants/context-windows.ts`:
`tokenbom/grok-4.6 → 500_000`; FID-2026-0913-001: "grok-4.6 is 500k, not
1M"). `resolveContextWindowSourceForModel` reports the poisoned value as
source `'catalog'`, so the sidebar presents it as authoritative.

## Environment

- **OS:** all
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `cli/src/utils/openrouter-models/lookup.ts`,
  `cli/src/utils/openrouter-models/openrouter.ts`,
  `common/src/providers/registry-partitioned.ts`
- **Commit/State:** live-probed 2026-09-19 (OpenRouter /api/v1/models
  HTTP 200; grok family enumerated; branch-by-branch simulation of
  lookup.ts matching)

## Detailed Description

### Problem

Resolution for `kiosapi/grok-4.6-free`, branch by branch (probe output):

```text
canonical id: kiosapi/grok-4.6  (kiosapi/ prefix NOT stripped)
branch 1 exact kiosapi/grok-4.6: MISS
branch 2 base grok-4.6:         MISS   ← would have hit if prefix stripped? no:
                                        OpenRouter id is x-ai/grok-4.6
branch 3 family prefix kiosapi/grok: MISS
branch 3b name-family "grok":   x-ai/grok-4.20 ctx=2000000  ← WRONG SIBLING
```

Sorted catalog order (live): `grok-4.20, grok-4.20-multi-agent, grok-4.3,
grok-4.3:batch, grok-4.5, grok-4.6, grok-build-0.1` — the first family hit
is the 2M model.

### Expected Behavior

A gateway id carrying an **exact upstream version** must resolve to that
version's window before any family fallback considers a sibling. Prefix
stripping must be **registry-driven** (every `PROVIDER_REGISTRY` gateway
id), not a hardcoded trio that silently rots as providers are added — the
next gateway would re-introduce this exact bug.

### Evidence

```text
cli/src/utils/openrouter-models/lookup.ts:24-33    toCanonicalModelId (3 prefixes only)
cli/src/utils/openrouter-models/lookup.ts:139-161  branches 3/3b take first sorted hit
cli/src/utils/openrouter-models/lookup.ts:258      max-output shares the matcher
cli/src/utils/openrouter-models/openrouter.ts:73   catalog sorted by id
common/src/constants/context-windows.ts:61         repo pin: grok-4.6 = 500_000
common/src/providers/registry-partitioned.ts      closed-world provider ids
dev/scratchpad/probe-grok-window.ts                live branch-by-branch proof
```

## Impact Assessment

### Affected Components

- `lookup.ts` — canonicalization + family matching (window AND max-output
  resolution)
- Every model id from the 14+ non-legacy gateways in the `/model` picker
- The sidebar window badge shows a wrong number with `'catalog'`
  provenance; the max-output budget can inherit a sibling's cap (larger
  or smaller — a smaller inherited cap would truncate long tool calls)

### Risk

Wrong-but-authoritative-looking window numbers cause silent over-flow of
real context (truncation/compaction firing late) and wrong max-output
caps. Severity medium: misconfiguration-class (no security boundary), but
it directly misleads operator trust decisions and every downstream prompt
budget.

### Out of Scope

- The KiosAPI gateway's own reported `context_length` values (tier 2;
  cannot be audited without the operator's key — catalog values are
  upstream data, not ours to correct).
- `~x-ai/grok-latest`-style alias ids and `:batch` variants (excluded from
  family "grok" by the existing terminal-segment derivation; unchanged).
- The deprecated `inferContextLength` name heuristics (retired as final
  fallback by FID-2026-0914-002; not on this path).

## Proposed Fix (GREEN)

1. **Registry-driven stripping:** derive the prefix-stripping regex from
   the closed-world `PROVIDER_REGISTRY` ids (`common/src/providers/`) —
   longest-first, built once at module load — replacing the hardcoded
   3-id regex in `toCanonicalModelId`. Suffix stripping (`-free`, `:free`)
   unchanged. The three legacy ids remain covered (registry superset).
2. **Version-preference ranking in branches 3 and 3b:** among family
   candidates, prefer the entry whose terminal segment equals the query's
   terminal segment (e.g. `grok-4.6`) before falling back to first-in-
   sorted-order. Deterministic, no new branches:
   `find(preferred) ?? find(existing)`.
3. **Result:** `kiosapi/grok-4.6-free` → canonical `grok-4.6` → branch 3
   candidates ranked → `x-ai/grok-4.6` → 500_000. Max-output resolution
   inherits the same correction through the shared matcher.

### Steps

1. [x] DONE — registry-driven regex (`GATEWAY_PREFIX_STRIP_REGEX`) built
      from `Object.keys(PROVIDER_REGISTRY)` longest-first; hardcoded trio
      removed. Vendor segments survive (they are not registry ids).
2. [x] DONE — exact-version preference implemented in BOTH family
      branches. Empirical correction during implementation: the first
      attempt ranked only branch 3 and stayed red (4/7) — the poisoned
      path for stripped-vendor ids flows through branch 3b
      (`startsWith(familyId)` cannot match `x-ai/grok-4.6` once the query
      prefix is stripped); the ranking was extended to 3b, suite green.
3. [x] DONE — `openrouter-models-fid-0919-016.test.ts` (7 tests): the
      sorted-grok fixture pins kiosapi/grok-4.6-free → 500_000 with source
      'catalog', per-version isolation, tokenbom/infron strip pins, legacy
      trio guard, max-output pin, family fallback for twinless versions,
      conservative default. Sibling suites: 61/0 across 11 files.
      LIVE e2e: real `fetchOpenRouterModels` (447 models, HTTP 200) +
      real resolvers → kiosapi/grok-4.6-free = 500000 / source 'catalog' /
      max-output 450000 (probe preserved in `dev/scratchpad/`).
4. [x] DONE — doc Loop 2/3 updated; receipt stamped `--write`; `--check`.

Declared under `## Verification Gates` (machine-executed by
`scripts/fid-verify.ts`).

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/openrouter-models-fid-0919-016.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:88d1ea3a724973224e3697f09b72da268cf88448ef6900c8f0e2ccbce33d01d8
- verified: 2026-09-19T05:14:27.920Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/openrouter-models-fid-0919-016.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (grounded 2026-09-19)

Live probe (OpenRouter HTTP 200) enumerates the grok family and replays
lookup.ts branch order against the id-sorted catalog: branches 1–3 MISS,
3b hits `x-ai/grok-4.20` (2M). The repo's audited pins and the operator's
page both give 500k. `resolveMaxOutputTokensForModel` shares the matcher.

### Loop 2 — Independent audit and self-correction

- (1) Could registry-derived stripping over-strip? Vendor-style prefixes
  (`x-ai/`, `z-ai/`, `deepseek/`) are NOT registry ids, so upstream
  segments survive; only the gateway prefix is removed. Prefixes that are
  substrings of others handled by longest-first sort.
- (2) Could version-preference pick a wrong-vendor same-version twin?
  Possible in theory (two vendors, same terminal id, different windows);
  deterministic and strictly better than the status quo, which ignores
  version entirely. Vendor-segment preference noted as a future
  refinement if a real case appears (YAGNI now).
- (3) ADVERSARIAL — does stripping break `findGatewayModel` consumers?
  `findGatewayModel` operates on the raw id against the gateway catalog
  and is NOT changed; only `toCanonicalModelId` (OpenRouter tier) is.
- (4) ADVERSARIAL — does the fixture pin over-fit to grok? The pin's
  mechanism (sorted family, exact version preferred) is generic; ids from
  two other gateways are pinned for the strip half.

### Loop 3 — Final convergence

CONVERGED 2026-09-19. Implementation matched GREEN with one empirical
correction (branch-3b ranking — see Loop 3 note in Steps 2) and one
ceiling discipline event: verbose FID comments pushed `lookup.ts` to 310
lines; compressed under the 300 absolute maximum (quality PASS, 1498
files). Gates: cli + repo-wide typecheck exit 0; FID suite 7/0; sibling
suites 61/0 (11 files); eslint 0 warnings; lint:md 0; quality PASS;
receipt 5/5 via `fid:verify --write`; `--check` PASS. No open deltas.

### Implementation Evidence closure (2026-09-19)

- [x] **Commit SHA:** 246008fd (operator-authorized 2026-09-19)
- [x] **Archived:** 2026-09-19 — moved to `dev/fids/archive/`

## Operator Decision

Operator reported the symptom and directed the FID + Perfection Loop
("yeah, fid+perfection loop") on 2026-09-19. Implementation proceeds under
the standing approval pattern for this session's FIDs.
