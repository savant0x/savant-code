# FID: Run-4 acceptance preconditions are observable and repeatable

**Filename:** `FID-2026-1018-004-repeatable-worktree-acceptance-instrument.md`
**ID:** FID-2026-1018-004
**Severity:** medium
**Status:** closed
**Created:** 2026-10-18
**Automation level:** 3
**YAGNI-Compliance:** Verified — document repair using existing lifecycle paths.

## Summary

Run 3 demonstrated no new lifecycle code defect. A reused tracked proof made
the dirty-disposal expectation false; concurrent main edits invalidated merge
preconditions. Repair the instrument and preserve its unaccepted result.

## Environment

- **OS:** Windows/Git Bash
- **Language/Runtime:** Bun 1.3.14
- **Tool Versions:** repository-pinned Git/worktree implementation
- **Commit/State:** UI implementation committed; run-3 handoff received

## Detailed Description

### Problem

The instrument reuses an existing proof, assumes dirty state and checks a
clean main only at start. Its report location also violates scratch root rules.

### Expected Behavior

Each run uses a new proof and exact graph lookup, checks actual dirty/clean
states before effects, and pins an exclusive main checkout until completion.

### Root Cause

Instrument preconditions did not encode the state their expected verdicts need.

### Evidence

`dev/test-prompts/archive/2026-10-18-parallel-worktrees-live-test-report-run3.md`:
20 PASS, 1 FAIL, 4 OPERATOR-CONFIRMED, 2 NEEDS-REVIEW, 9 NOT-RUN.
Provisioning refuses a retained branch behind the requested base; source
`fid-worktree.ts` checks whether the new base is an ancestor of that branch.
Service disposal refuses only a genuinely dirty lane. Scope parser accepts a
run-unique proof glob under the existing acceptance FID.

## Impact Assessment

### Affected Components

- `dev/test-prompts/az-parallel-worktrees-live-test.md`
- `dev/fids/FID-2026-1017-008-live-parallel-worktree-acceptance.md`
- `SCOPE.md`, run-3 report and session audit records

### Risk Level

- [x] Medium: a false destructive-test precondition can remove the test lane.

## Proposed Solution

### Approach

Select one run stamp before mutations; verify its proof path is absent and
use it throughout write, status, commit, merge and exact graph lookup. Require
dirty:true and exact status evidence before disposal; otherwise STOP without
calling dispose. Require both clean checkouts and expected refs before merge.
Require operator-confirmed exclusive main access. Report under scratch active.

Retained branch must match the starting main tip. If it is behind, document
an operator-confirmed pre-run normal fast-forward with local git fetch, guarded
by ancestry; never delete, force-reset or alter it in this implementation.
Preserve the existing stash; restore only by explicit operator choice.

### Steps

1. Correct instrument, scope target and current acceptance record.
2. Preserve run-3 report/FID handoff and verify scope parsing and document gates.
3. Commit, archive this instrument repair and push. Leave acceptance converged.

### Verification

Manual check each affected row against production service/provisioning source.
Run scope-register and quality probes plus markdownlint and repository validation.
No new test artifact or live acceptance is promised by this document-only repair.

## Verification Gates

- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:35f2ddeb2475de415c0271b1e6977be0d0361f0c760c1ef12e942b83056c3388
- verified: 2026-10-18T19:34:26.093Z
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

All four handoff findings reproduced by comparing the prompt to actual git
state and source. Old substring graph query could match earlier proofs too.

### Loop 2 — Independent audit and self-correction

Unique path needs a matching register grant and exact graph assertion, not
only a changed write row. Dirty tests must STOP before disposal on a clean
lane. Retained branch reuse additionally needs an equal-base precondition.
None of these changes requires a lifecycle code modification.

### Loop 3 — Final convergence

Plan converged before editing. Existing branch/stash remain untouched. A
prepared instrument is not evidence that run 4 passed or even ran.

### Missed Questions

1. Will an old proof satisfy graph lookup? Exact run-specific equality prevents it.
2. Will retained branch provisioning work after main advances? Only after
   separately approved normal fast-forward; preflight detects mismatch.
3. Who enforces writer exclusivity? Operator confirms it; repeated ref/status
   checks detect observable interference but cannot prevent a hostile writer.

### Implementation Evidence

Instrument and register implemented. Production scope parser reports the new
proof path covered and an unrelated root probe uncovered. Read-only graph
query runs successfully and returns an empty list for an absent exact proof.
Positive graph control returns the original tracked proof exactly; negative
control returns no row. Implementation commit: `59a0c0e5`; 2/2 declared gates
exit 0. Retained branch and stash untouched. All three steps implemented,
with normal progress push subject to mandatory hooks.

### Code Verification Evidence

No new production wiring; instrument gates and source comparisons apply.

## Resolution

- **Closed Date:** 2026-10-18
- **Commit SHA:** 59a0c0e5
- **Fix Description:** Unique run proof, observed dirty-state guards, immediate
  merge state/ref checks, exclusive main access and preserved preparation state.
- **Tests Added:** None; document-only change. Existing scope/quality gates pass.
- **Verification Evidence:** 2/2 declared gates, scoped markdownlint and exact
  positive/negative read-only graph controls pass; source parser covers only
  the authorized proof glob. Source code already passed full pre-push gates.
- **Archived:** 2026-10-18

No fourth run or live acceptance is claimed by this instrument repair.

## Lessons Learned

Acceptance must measure the precondition before asking an effect to refuse it.
