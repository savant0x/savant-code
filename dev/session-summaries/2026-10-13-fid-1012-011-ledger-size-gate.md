# FID-2026-1012-011 — the ledger's size ceiling is gated (2026-10-13)

**Status:** implemented, `fixed` (receipt stamped, 4/4 gates PASS live). **Program of record:**
`dev/fids/FID-2026-1012-022`; this pass worked **Chain B wave B0** (first half). Nothing is pushed; local
commits only.

## What landed

- `scripts/learnings-size-policy.ts` (new) — the ceilings belong to the artifact, not the repair tool:
  **1,200 logical lines** (newline-delimited segments, the unit `learnings:retire` reports) and **100,000
  JavaScript characters** (UTF-16 code units, the unit the boot boundary truncates on). Breach messages
  name the measure, the current value, the overage and the restoring command; the pass output reports
  headroom.
- `scripts/learnings-validation.ts` — `validateLearnings` carries the size issues, so `learnings:check`
  (and therefore `validate:repository`) fails on either ceiling.
- `scripts/learnings-retire.ts` — retirement appends `dev/learnings-move-log.jsonl` (one object per move:
  `title`, `date`, `reason`, `destination`, `retiredAt`, `linesBefore`, `linesAfter`), written **after**
  both file writes succeed so a receipt never describes a move that did not finish.
- `scripts/__tests__/learnings-size-policy.test.ts` (new, 6 cases) and one new case in
  `scripts/__tests__/learnings-retire.test.ts`.

## Both directions were demonstrated, then reverted

- Green: `bun run learnings:check` exits 0 and prints
  `1,175/1,200 logical lines, 76,775/100,000 JavaScript characters (25 lines, 23,225 characters of headroom)`
  — the split-line unit matches Loop 2's recorded headroom exactly.
- Red: with 30 blank lines temporarily appended, it **exits 1** with
  `[learning.size.line-ceiling] dev/LEARNINGS.md is 1,205 logical lines … 5 over. Restore headroom with
  `bun run learnings:retire` (operator-run, move-only: nothing is deleted).`
- Restored byte-identically (`git diff --stat` clean); exits 0 again. Nothing was retired and no ceiling
  value changed.

## Findings raised, not parked

- **A missing gate, not a missing vocabulary — corrected.** `scripts/__tests__/experiences-coverage.test.ts`
  (FID-2026-1012-021) shipped `triggerType: 'tool-failure'` instead of `'tool_failure'`; **all three of its
  declared gates passed** and the hand-run root `typecheck` caught it. I first read that as a structural
  gap ("`scripts` is not a bun workspace, so the leg has no declarable form"). **That was wrong**: the
  declarable form already exists — `scripts/scripts-typecheck-check.ts` — and
  `scripts/gate-declarability-registry.ts` pairs it with the root `typecheck` gate for precisely that
  reason. Both records now declare it. The surviving finding is narrower: **nothing requires a record's
  gate set to cover the surfaces it touched**, so a plausible explanation for a missing gate passed for a
  check. `FID-2026-1012-027` owns it.
- **The ceiling is now a source change, not a flag.** `--cap` still affects only a retirement run; the
  validator's limits move only by editing the policy module — which is what "raising the limit is a
  decision" has to mean if it is to be auditable.

## Still open

1. **`FID-2026-1012-012` must consume the move record** so a retired title resolves across live + retired.
2. **`FID-2026-1012-010`** owns the boot digest that will make the character ceiling less load-bearing.
3. **Chain B wave B0, second half:** `FID-2026-1012-014` (rule-first schema with an explicit boot tier),
   which `-010` and `-013` both depend on.
