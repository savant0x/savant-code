# FID: FID status vocabulary modernization — `converged` admitted, `fixed` deprecated

**Filename:** `FID-2026-0915-004-vocabulary-modernization.md`
**ID:** FID-2026-0915-004
**Severity:** low
**Status:** closed
**Created:** 2026-09-15 (operator ruling during FID-2026-0915-002
sequencing: "converged = the perfection loop is completed, we may need to
update the language we're using because fixed is old" — recorded as
[OPEN-OUT-OF-SCOPE] then, implemented now per the automation directive)
**YAGNI-Compliance:** Verified — one enum value added to the ledger
admission set, one exported-constant pin, one LEARNINGS amendment. The
receipt machinery is untouched (it correctly stays keyed to the
implementation-stage statuses); no consumer code reads these statuses.
**Related:** FID-2026-0820-007 (the 2026-08-18 ruling this supersedes —
the LEARNINGS entry `active-ledger-status-admission`); FID-2026-0818-001
MQ1 (deferred the vocabulary call to a separate operator ruling — now
made); scripts/fid-gates.ts (VERIFIED_STATUSES stays fixed/verified).

## Summary

The operator modernized the FID status vocabulary (2026-09-15 ruling):
**`converged` becomes an admissible ACTIVE-queue status** meaning "the
Perfection Loop completed; awaiting implementation approval", and **`fixed`
is deprecated as legacy language** (still accepted — archived and
in-flight records must keep validating). Implementation: add `converged`
to `ALLOWED_ACTIVE_STATUSES` in `scripts/fid-ledger.ts`, pin the ruling
with a focused test, amend the LEARNINGS lesson that documented the old
rule.

## Problem Statement

The 2026-08-18 ruling (FID-2026-0820-007) excluded `converged` from the
active queue on the grounds that it "documents loop state, not an
admissible active-queue status" — forcing loop-converged planning FIDs to
carry the legacy `analyzed` label even when their loops had completed.
The operator has now ruled the opposite mapping is the intended
vocabulary: `converged` IS the correct active-queue status for
loop-complete/pre-implementation, and `fixed` is the outdated term. The
enforcement in `scripts/fid-ledger.ts` and the LEARNINGS lesson must align
with the ruling.

## Scope Boundary (MQ1)

The anti-deferral step gate
(`packages/agent-runtime/src/echo/fid-validator.ts` →
`validateFidStepStatus`) treats `converged`/`closed` as closure-claiming
for FID **Step Status checklists** — that is a different mechanism from
the ledger **Status** field and is NOT modified here: an FID claiming
`converged` with unchecked implementation steps still trips the
anti-deferral gate, which is correct (converged = planning done, NOT work
done).

## Perfection Loop

### Missed Questions

- MQ1: Does admitting `converged` weaken the anti-deferral gate? No — the
  step-status validator is untouched (see Scope Boundary); the ledger
  admission is metadata vocabulary only.
- MQ2: Do existing archived records break? No — `fixed`/`verified`/`closed`
  remain accepted; nothing is removed from any admission set.
- MQ3: Does the receipt contract move to `converged`? No — receipts
  verify implementation, and `converged` is explicitly pre-implementation;
  `VERIFIED_STATUSES` stays `fixed | verified`.

### Code Verification Evidence

(Recorded at implementation closure, 2026-09-15.)

- **Pin test:** `scripts/__tests__/fid-ledger-vocab.test.ts` — 4 tests
  pinning: `converged` admitted; all four legacy statuses still accepted
  (set size 5 — nothing removed); `closed` still not active-queue legal;
  `VERIFIED_STATUSES` unchanged (`converged` does NOT satisfy the receipt
  check — MQ3).
- **Existing fid suites:** fid-gates.test.ts + fid-verify.test.ts green
  alongside the new pins (32 tests / 55 expect() / 0 fail across the three
  files) — pre-existing `analyzed` fixtures validate unchanged.
- **LEARNINGS amendment:** the `active-ledger-status-admission` lesson
  rewritten (title, Invariant, Guard) to the new rule with the
  supersession note; `learnings:check` exit 0. First amendment attempt
  tripped `learning.structure.malformed-prose` (prose inside the field
  name) + a non-schema date suffix — both caught by the validator and
  corrected (recorded, not hidden).
- **Gates:** typecheck cli exit 0; probe `learnings.ts` PASS; eslint
  `--max-warnings 0` exit 0 on the three touched files (one import/order
  auto-fixed); prettier + lint:md green; `validate:repository` PASS
  (run directly, not as a gate — see Lessons).

## Verification Gates

- gate: typecheck cli
- gate: test scripts/__tests__/fid-ledger-vocab.test.ts
- gate: test scripts/__tests__/fid-gates.test.ts
- gate: probe scripts/learnings.ts

### Verification Receipt

- fingerprint: sha256:a7cbe9c710752c6438a0aadab7e915b336324c8ad9678eb7313779df9dea23bf
- verified: 2026-09-15T19:59:06.528Z
- typecheck cli: exit 0
- test scripts/__tests__/fid-ledger-vocab.test.ts: exit 0
- test scripts/__tests__/fid-gates.test.ts: exit 0
- probe scripts/learnings.ts: exit 0

## Lessons Learned

- Declaring `probe scripts/validate-repository.ts` inside a Verification
  Gates section creates infinite recursion: validate:repository's C3
  LIVE-re-runs every declared gate of every fixed FID, so validating the
  repo spawns validate:repository, which spawns itself (observed as a
  fid:verify hang at the 590s timeout). Gate lists must never reference
  the validator that consumes them.

## Resolution

- **Closed Date:** 2026-09-15
- **Fix Description:** `ALLOWED_ACTIVE_STATUSES` in `scripts/fid-ledger.ts`
  admits `converged` (exported with the ruling comment); `VERIFIED_STATUSES`
  in `scripts/fid-gates.ts` exported unchanged with the MQ3 comment; the
  LEARNINGS lesson amended to the superseded rule; vocabulary pin test
  added. Implementation-stage status `fixed` remains accepted everywhere
  (deprecated, not removed).
- **Tests Added:** `scripts/__tests__/fid-ledger-vocab.test.ts` (4 tests).
- **Verification Evidence:** the Code Verification Evidence section above;
  receipt stamped on closure.
- **Commit:** recorded in the session summary (hash captured post-commit).
- **Archived:** yes — 2026-09-15, same session (Auto-Archive rule).
