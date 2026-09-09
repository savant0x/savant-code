# FID: Clean-checkout gate leaves an orphaned Temp worktree directory on failed runs

**Filename:** `FID-2026-0909-001-clean-checkout-gate-orphaned-temp-dir.md`
**ID:** FID-2026-0909-001
**Severity:** low
**Status:** created
**Created:** 2026-09-09 03:10
**YAGNI-Compliance:** Pending

---

## Summary

The release pipeline's clean-checkout gate creates a detached worktree at
`%TEMP%\savant-release-checkout-v<version>` for the committed-tree compile
proof (FID-2026-0906-003). When a gate fails mid-run, the run exits
fail-closed and leaves that directory — including the full frozen-lockfile
`node_modules` install — on disk. The next release attempt aborts at
worktree creation with `fatal: ... already exists`; the leftover directory
is not recoverable through git (`git worktree list` shows nothing) and must
be removed manually before the release can proceed.

## Environment

- **OS:** Windows 11 (win32)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** git (Git Bash / MSYS), PowerShell release shell
- **Commit/State:** v0.0.30 cut attempts, HEAD `aab5109` → `05e2e1a` (2026-09-09)

## Detailed Description

### Problem

During the v0.0.30 cut, three successive gate failures (FID-2026-0909-002
instances) aborted the GATES stage. After fixing each layer, the next run
failed before the gates with:

```text
Unable to create the clean checkout at
  C:\Users\spenc\AppData\Local\Temp\savant-release-checkout-v0.0.30:
Preparing worktree (detached HEAD 05e2e1a)
fatal: 'C:/Users/spenc/AppData/Local/Temp/savant-release-checkout-v0.0.30'
  already exists
```

The directory contained a complete checkout plus `node_modules` from the
gate's frozen-lockfile install. `git worktree list` showed only the main
worktree — the leftover was orphaned disk content, not a registered
worktree, so `git worktree prune` cannot recover it.

### Expected Behavior

A failed gate run should leave no worktree artifacts behind (the gate's
documented contract: "removed on every path"), and a subsequent release
attempt should never be blocked by the previous attempt's debris.

### Root Cause

The clean-checkout worktree lifecycle in
`scripts/public-release/provenance.ts` removes the directory on its own
success/caught-error paths, but a mid-gate `fail()` exit (gate failure →
script abort) escapes before removal — or the Windows removal fails
silently (node_modules file locks). Observed state after failure:
directory present, not git-registered. Exact removal-path gap to be pinned
by reading `verifyPreflight`/gate code at GREEN.

### Evidence

```text
# After the test-gate failure aborted the run:
$ git worktree list
C:/Users/spenc/dev/savant-code  05e2e1a [main]
$ ls C:/Users/spenc/AppData/Local/Temp/savant-release-checkout-v0.0.30
node_modules  NOTICE  package.json  packages  protocol.config.yaml
README.md  README.zh-CN.md  savant-free  SCOPE.md  scripts  ...
```

Manual cleanup (`rm -rf` the directory) unblocked the next run; the
follow-up `git worktree list` still showed only the main worktree.

## Impact Assessment

### Affected Components

- `scripts/public-release/provenance.ts` (clean-checkout worktree lifecycle)
- Release pipeline GATES stage recovery flow

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

Manual one-line cleanup restores the path; no data loss. Recurs on every
failed gate run, which during a release loop is frequent.

## Proposed Solution

### Approach

Make the clean-checkout worktree lifecycle self-healing: remove any
pre-existing checkout directory before `git worktree add`, and guarantee
removal on every exit path — including the mid-gate `fail()` rethrow path
(try/finally around the entire GATES-stage gate execution, not only around
the worktree creation call).

### Steps

1. Read `scripts/public-release/provenance.ts` 0-EOF and pin the exact
   removal-path gap (which exits skip cleanup; whether Windows file locks
   swallow a silent rm).
2. Add a pre-create remove-if-exists guard keyed on the same versioned
   path, before `git worktree add`.
3. Wrap the clean-checkout lifecycle so removal runs on every exit path
   (success, gate failure, abort), with a logged warning if removal fails.
4. RED-first pin: a unit test simulating a stale directory asserts the
   pre-create guard removes it and the gate proceeds.

### Verification

Release-cut end-to-end: force a gate failure, confirm the checkout
directory is absent afterward, confirm the immediate re-run passes
worktree creation. Unit pin green; typecheck scripts; eslint clean.

## Verification Gates

Pending — declared at GREEN once the fix approach is implemented (the
declared gates are live re-run by `validate:repository` from status
`fixed` onward).

## Perfection Loop

### Loop 1 — RED

- **RED:** Finding cataloged 2026-09-09 during the v0.0.30 cut — orphaned
  checkout directory blocked the post-failure re-run (evidence above);
  manual cleanup was the only recovery.
- **GREEN:** Not started (proposed approach above).
- **AUDIT:** Not started.
- **ADVERSARIAL:** Not started.
- **CHANGE DELTA:** N/A (planning record).

### Missed Questions

1. Why was the directory not in `git worktree list`? — Most likely the
   `git worktree add` failed after creating the directory contents and git
   rolled back the registration (or the metadata was pruned on a later
   attempt); the removal gap is in the pipeline's own cleanup, not git's.
   Answer to be confirmed by the Step 1 code read.
2. Should the removal be best-effort or fail-closed? — Best-effort with a
   logged warning: a stale Temp directory is recoverable debris, not a
   correctness violation, and a fail-closed removal would reintroduce the
   very block this FID removes.

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state

## Lessons Learned

The gate environment is a stateful surface: any artifact it creates must
be cleaned by the same run's exit paths, or the *next* run inherits the
failure. "Removed on every path" claims need a test that simulates a
mid-gate abort, not just the success path.

## Resolution

- **Closed Date:** (pending)
- **Fix Description:** (pending)
- **Tests Added:** (pending)
- **Verification Evidence:** (pending)
- **Archived:** (pending)