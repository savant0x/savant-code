# FID: Run-4 instrument outputs and closure evidence

**Filename:** `FID-2026-1018-005-worktree-run4-instrument-closure.md`
**ID:** FID-2026-1018-005
**Severity:** medium
**Status:** closed
**Created:** 2026-10-18
**Automation level:** 3
**YAGNI-Compliance:** Verified — documentation repair on existing paths.

## Summary

The live lifecycle succeeded, but its instrument authored a 231-column proof,
omitted output gates, assumed shell syntax and an uncovered stray, and its
report summary undercounts the table. Repair the instrument and preserve the
actual acceptance evidence without erasing deviations.

## Environment

- **OS:** Windows, PowerShell and Git Bash
- **Language/Runtime:** Bun 1.3.14
- **Tool Versions:** repository Markdown/format gates
- **Commit/State:** `e0d29fb0`, clean main, two unpushed proof commits

## Detailed Description

### Problem

Run-4 handoff defects 1–3 and its report accounting require correction.

### Expected Behavior

The instrument validates its output before committing and after merging, gives
shell-specific lock steps, uses covered dirty state and counts unique rows.

### Root Cause

Preflight gates preceded the new artifact; operator steps lacked shell context.

### Evidence

Run report §7.4 records MD013 expected 120 / actual 231 at `a99db5b8`, repaired
by `e0d29fb0`. Its row tables label 43 PASS and one substituted SKIP while
the summary says 34 PASS. §5.19 labels PASS despite two commits versus one.

## Impact Assessment

### Affected Components

- `dev/test-prompts/az-parallel-worktrees-live-test.md`
- durable run-4 report, closure assessment and acceptance FID
- scope, changelog and session audit records

### Risk Level

- [x] Medium: a merged instrument artifact broke a repository gate.

## Proposed Solution

### Approach

Wrap proof after substitution, check artifact Markdown lint before commit and
after merge, STOP on failures, use a covered tracked-file edit for discard,
name shell commands and prohibit reusing/removing another writer's lock.
Preserve the original report with a separate reconciliation assessment.
After acceptance archival, explicitly require new authorization and a new
active converged FID before this historical instrument can run again.

### Steps

1. Repair instrument and preserve/reconcile the evidence.
2. Verify document gates and scope parsing; commit implementation.
3. Close/archive with changelog and scope release after verification.

### Verification

Compare every modified row against service semantics and run-4 evidence.
Run Markdown lint and existing scope/quality gates. Markdown is excluded from
Prettier by repository policy; do not treat a skipped format check as proof.
No new test artifact or fresh live acceptance is promised.

## Verification Gates

- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:767a8e62d79498dc4143841a40d6996be75becee4dfa9c968c39b77550f937f3
- verified: 2026-10-18T20:33:05.656Z
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Handoff findings matched actual prompt and report. Output gates are absent;
the stray is denied by Law 2. No production lifecycle repair follows from this.

### Loop 2 — Independent audit and self-correction

Do not use force/mkdir-p to reuse a live lock. Do not automatically repair main
inside the measured run; STOP, preserve evidence and seek operator direction.
Original counts and failed gate remain historical evidence, not rewritten PASS.

### Loop 3 — Final convergence

Converged before editing. Closure accepts demonstrated lifecycle with recorded
deviations and limits. Retained branch, stash and external paths stay untouched.

### Missed Questions

1. Is another run needed? No lifecycle defect was shown; correct the instrument
   and preserve the completed run's limits rather than inventing new coverage.
2. Does 43 PASS mean every original constraint passed? No: these are table labels;
   §5.19's second repair commit violates the original one-commit expectation.

### Implementation Evidence

Instrument repaired and original report promoted to
`dev/test-prompts/archive/2026-10-18-parallel-worktrees-live-test-report-run4.md`.
Companion `2026-10-18-parallel-worktrees-run4-closure-assessment.md` preserves
the MD013 failure, second-commit deviation and actual row accounting.
The report's additional MSYS conversion observation is addressed with a named
Git Bash `MSYS_NO_PATHCONV=1` prefix; PowerShell keeps the original command.
Implementation commit `72aefe15`. All three steps implemented; 2/2 declared
gates passed and receipt stamped, scoped Markdown lint exit 0.

### Code Verification Evidence

No new production wiring. Manual document audit plus existing gates apply.

## Resolution

- **Closed Date:** 2026-10-18
- **Commit SHA:** 72aefe15
- **Fix Description:** Output gates, wrapped proof, covered discard setup,
  named-shell lock procedure, MSYS probe note and qualified durable evidence.
- **Tests Added:** None; existing scope/quality gates and document lint apply.
- **Verification Evidence:** 2/2 declared gates exit 0; Markdown lint exit 0.
- **Archived:** 2026-10-18

Initial stamp attempts rejected prose inside the receipt subsection as malformed
gate declarations. Removing that prose allowed the normal stamp; no parser or
gate bypass was used. No new live run occurred.

## Lessons Learned

Check generated artifacts before merge and preserve failures through repairs.
