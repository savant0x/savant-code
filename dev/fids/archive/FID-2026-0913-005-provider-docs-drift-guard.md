# FID: Provider docs drifted from the 16-provider registry (main README + 6 surfaces)

**Filename:** `FID-2026-0913-005-provider-docs-drift-guard.md`
**ID:** FID-2026-0913-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-13 18:44
**YAGNI-Compliance:** Verified

---

## Summary

After the v0.0.31 push, the top-level `README.md` provider table listed only 9
rows (Ollama + 8 hosted) against a registry of 16 providers — six hosted
providers (KiosAPI, APInex, OrcaRouter, B.AI, HCNSec, TokenBom) were missing —
while the same README's release header claimed "the registry now carries 16
providers". Five further hand-maintained doc surfaces were stale by one to four
providers each, and the shipped npm README (`cli/release/README.md`) still
taught the legacy `OPENCODE_GO_API_KEY` as the primary OpenCode key.

## Environment

- **OS:** Windows (Git Bash)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Commit/State:** main post-v0.0.31 push, clean tree at session start

## Detailed Description

### Problem

`scripts/generate-provider-reference.ts` mechanically rendered exactly two
surfaces (`.env.example` gateway section, `cli/release/README.md` table)
between GENERATED markers, and the `generate:provider-docs:check` drift gate
(wired into `validate:repository` + release gates) passed on both. Every other
provider-doc surface was hand-maintained and drifted silently across two
releases.

### Root Cause

The main README table was never given GENERATED markers, so no generator owned
it; the remaining surfaces (translations, bullets, prefix lists, env rows)
cannot be byte-rendered (prose/translation) and had no presence-based pin at
all. Matches the LEARNINGS 2026-08-10 rule: "Files that update often and must
stay in sync get a mechanical generator, never hand-copied mirrors."

### Evidence (RED catalog, verified against the working tree)

Registry ground truth: 16 providers, 14 setup-available
(`common/src/providers/registry.ts` + `registry-partitioned.ts`);
HCNSec/TokenBom each carry audited static 7-model allowlists
(`common/src/constants/model-config/gateway-catalogs.ts:22-59` — the
release-header "14-model" phrasing is the combined count).

Pre-fix drift (69 findings from the new gate: 67 DRIFT + 2 STALE; full list
in session summary 2026-09-13-1844):

| Surface | Missing |
|---|---|
| README.md table (9 rows) | KiosAPI, APInex, OrcaRouter, B.AI, HCNSec, TokenBom |
| README.md "Gateway providers" bullet | OpenRouter, OrcaRouter, B.AI, HCNSec, TokenBom |
| README.md quick-start commands + env sentence | 8 commands / 7 env vars |
| README.zh-CN.md table, bullet, quick-start | same set |
| docs/index.md bullet | B.AI, HCNSec, OrcaRouter, TokenBom |
| docs/sdk-overview.md dispatch prefixes + env row | 4 prefixes + 4 env vars |
| cli/release/README.md shell examples + dotenv | legacy `OPENCODE_GO_API_KEY` primary; 6 gateway keys absent from the "complete variable surface" dotenv |

Adjacent finding folded in: 4 dead links to
`docs/design/Adding New Providers.md` (README.md:107, docs/sdk-overview.md ×3)
— the runbook was moved to `docs/archive/design/` in the v0.0.24 audit.

## Impact Assessment

### Affected Components

- `scripts/generate-provider-reference.ts`, `scripts/provider-docs-drift.ts`
  (new), `scripts/__tests__/provider-docs-drift.test.ts` (new)
- `README.md`, `README.zh-CN.md`, `docs/index.md`, `docs/sdk-overview.md`,
  `cli/release/README.md`, `.env.example` (regenerated unchanged)

### Risk Level

- [x] Low: documentation-only drift; no provider routing/runtime behavior
  involved (prefixes/env vars derive from the registry mechanically)

## Proposed Solution

### Approach

Two layers, per the operator's "Sync + generator guard" selection:

1. **Generator guard** — README.md's table becomes the third GENERATED surface
   (same markers); `TABLE_NOTES` enriched into the shared note source for both
   tables (one truth); new `provider-docs-drift.ts` module runs
   presence-in-window/whole-file token checks on every surface that cannot be
   byte-rendered, wired into `--check` (and thus `validate:repository`,
   pre-push, and release gates).
2. **Hand sync** — every stale surface brought to the full registry;
   illustrative shell blocks compacted to "any key from the table above"
   (deliberately non-enumerating: nothing to rot); legacy
   `OPENCODE_GO_API_KEY` primary usage replaced with canonical
   `OPENCODE_API_KEY`; dead runbook links re-pointed to
   `docs/archive/design/`.

### Steps

1. Extend `generate-provider-reference.ts` to a SURFACES table (3 surfaces,
   check + write) ✅
2. New `scripts/provider-docs-drift.ts` — windowed + whole-file checks over
   all hand surfaces ✅
3. Insert markers in README.md table; regenerate ✅
4. Hand-sync README.md, README.zh-CN.md, docs/index.md, docs/sdk-overview.md,
   cli/release/README.md ✅
5. Re-point 4 dead runbook links ✅
6. RED-first drift test ✅
7. Verification battery + Verifier ✅ (see receipt)

### Verification

- `bun run generate:provider-docs:check` → "Provider reference docs are up to
  date." (exit 0) — was 69 findings pre-fix (67 DRIFT + 2 STALE)
- `bun test scripts/__tests__/provider-docs-drift.test.ts` → 4 pass / 0 fail
  (45 expects), including stale-fixture + missing-anchor RED pins
- `bun run lint:md` full-repo exit 0 (Loop 2); `bun x eslint .
  --max-warnings 0` exit 0; `bunx prettier --check .` exit 0

## Verification Gates

- gate: test scripts/__tests__/provider-docs-drift.test.ts
- gate: typecheck common

### Verification Receipt

- fingerprint: sha256:9552d5966bc8b7eb1eb1f83634450486c9ff4200396c2a05519b7229aca88daa
- verified: 2026-09-14T00:58:32.524Z
- test scripts/__tests__/provider-docs-drift.test.ts: exit 0
- typecheck common: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** 69 findings (67 DRIFT across 7 hand surfaces + 2 STALE generated
  surfaces) cataloged with file/surface/token/provider evidence (full list
  in the session summary); root cause isolated to the 2-surface generator +
  absent hand-surface pins.
- **GREEN:** 3-surface generator + drift module + hand sync; each write
  verified inline (markdownlint per file; eslint+prettier per script) as EHEL
  required.
- **AUDIT:** see Verification Receipt (live gate re-runs) + independent
  Verifier spawn.
- **CHANGE DELTA:** initial authoring.

### Loop 2 — table-token defect exposed by full-repo lint:md

- **RED:** the first full-repo `lint:md` run failed on README.md's generated
  rows — the markers sat BETWEEN the table's delimiter row and the body
  rows, and an HTML comment at that position terminates the markdown table
  token. The rows render as orphaned prose (un-exempted from MD013's
  `tables: false`), and strict renderers break the table. The defect had
shipped in `cli/release/README.md` since the generator's introduction,
  masked by that file's line-1 file-wide `<!-- markdownlint-disable MD013 -->`
  (15 MD013 errors surfaced on README.md:162-178 the moment an unmasked file
  carried the same shape).
- **GREEN:** the generator now renders the ENTIRE contiguous table (header +
  delimiter + rows) inside the markers (`renderProviderTable`); both
  READMEs restructured so the hand-written header/delimiter rows are gone
  and the markers wrap the full table.
- **AUDIT:** full-repo `lint:md` exit 0; drift check + drift test re-run
  green (4/4, 45 expects); eslint + prettier green; receipt re-stamped.
- **CHANGE DELTA:** ~5% (generator function header + two README marker
  regions).

### Missed Questions

1. Should the zh-CN table also be GENERATED? → No: translations cannot be
   byte-rendered; windowed token pins cover it (labels/commands/env vars are
   language-neutral tokens).
2. Should illustrative shell blocks enumerate every key? → No:
   compact-with-pointer (like both READMEs' "choose one" pattern); enumerated
   examples were the original rot vector. The dotenv template DOES enumerate
   (it documents the "complete variable surface") and is pinned.
3. Do the withdrawal-era note entries (tabitoken/gorouter/vyceai) in the
   ORIGINAL TABLE_NOTES matter? → Removed: the rewrite carries notes for
   exactly the 16 current registry ids; the fallback `?? 'Hosted gateway'`
   covers any future id (Verifier Loop 2 finding — the stale entries were
   dropped rather than kept as inert extras).
4. Does the header "14-model static allowlists" claim need fixing? →
   Yes-and-done: the generated notes state 7-model allowlists each (matching
   gateway-catalogs.ts and docs/features.md). The README release-header
   phrasing is a historical release note (combined count) — left as written
   history.

### Implementation Evidence

- [x] **File:line ranges:**
  `scripts/generate-provider-reference.ts` (SURFACES table, enriched
  TABLE_NOTES, drift wiring in check/write), `scripts/provider-docs-drift.ts`
  (new, 8 window checks + 5 file checks),
  `scripts/__tests__/provider-docs-drift.test.ts` (new, 4 tests), README.md
  (markers + bullet + quick-start + env sentence + 1 link), README.zh-CN.md
  (6 table rows + bullet + quick-start + env sentence + 3 compacted shell
  blocks), docs/index.md (bullet), docs/sdk-overview.md (prefix list + env row
  + 3 links), cli/release/README.md (3 shell blocks + dotenv completion)
- [x] **Gate output:** pasted in Verification Receipt (fid:verify live re-runs)
- [x] **Reproducibility:** `bun run generate:provider-docs:check` greps clean;
  the README GENERATED markers hold 17 rows (16 providers + custom endpoint)
- [x] **Step statuses:** all steps `implemented`

### Code Verification Evidence

- [x] Files referenced exist; implementation matches the approved plan
- [x] markdownlint/eslint/prettier pass with pasted output above and in the
  receipt
- [x] FID status reflects implementation state (`verified` post-receipt)

## Resolution

- **Closed Date:** 2026-09-13 20:55
- **Fix Description:** third GENERATED surface + registry-driven hand-surface
  drift gate + full 16-provider sync across 7 doc surfaces + legacy-key and
  dead-link corrections.
- **Tests Added:** `scripts/__tests__/provider-docs-drift.test.ts`
  (4 tests / 45 expects)
- **Verification Evidence:** Verification Receipt above (fid:verify --write,
  live gate re-runs, both exit 0); Verifier PASS (8/9 quoted evidence,
  bookkeeping findings remediated); `validate:repository` PASS
- **Commit SHA:** `dec13050` (implementation, 10 files, +1023/−133)
- **Archived:** 2026-09-13 20:55 — moved to `dev/fids/archive/`

## Lessons Learned

A drift gate that covers only its generator's own surfaces is silent about
every other surface the registry feeds. When a registry is the single source
of truth, each consumer surface is either GENERATED (byte-exact, markers) or
PINNED (presence tokens between stable anchors) — "hand-maintained and hope"
is the third, forbidden category. Illustrative examples should point at the
authoritative table rather than duplicate its contents.