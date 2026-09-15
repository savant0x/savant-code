# FID: FID status vocabulary modernization — `converged` admitted, `fixed` deprecated

**Filename:** `FID-2026-0915-004-vocabulary-modernization.md`
**ID:** FID-2026-0915-004
**Severity:** low
**Status:** analyzed
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

(Recorded at implementation closure: typecheck cli exit 0; new pin
`fid-ledger-vocab.test.ts` green; probe `validate-repository.ts` PASS with
a synthetic converged-status FID admitted cleanly; learnings:check green
on the amended lesson.)

## Verification Gates

- gate: typecheck cli
- gate: test scripts/__tests__/fid-ledger-vocab.test.ts
- gate: test scripts/__tests__/fid-gates.test.ts
- gate: probe scripts/validate-repository.ts

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Commit:** —
- **Archived:** —
