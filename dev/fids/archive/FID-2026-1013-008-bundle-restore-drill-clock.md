# FID: The bundle restore drill fails on the clock, not on its assertions

**Filename:** `FID-2026-1013-008-bundle-restore-drill-clock.md`
**ID:** FID-2026-1013-008
**Severity:** medium
**Status:** closed
**Created:** 2026-10-13 22:00
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

---

## Summary

The scripts suite is not deterministically green: `bun test` in `scripts/` exited 1 at the end of a
full gate sweep with `1 fail` of 960 — `git bundle backup > restore drill: baseline clone +
incremental fetch reaches main` at 5034.79 ms against bun's 5 s default per-test timeout, with no
assertion failing. Reproduced in isolation three times (5462 ms fail, 4261 ms pass, 5007 ms fail), so
the case's true cost straddles the default rather than occasionally spiking past it. Every case in
that file drives the real bundle pipeline through spawned git processes, which is why the clock is a
function of machine load rather than of the unit under test. The repair gives the file the explicit
budget its work needs and records the measurements beside it; no assertion changed.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** `main` @ `850f7eb7` (working tree clean apart from this pass)

## Detailed Description

### Problem

After `bun run test` (root chain, 13 legs) finished green with an explicit exit status of 0, the same
sweep ran the scripts suite, which returned **exit 1**:

```text
1 tests failed:
(fail) git bundle backup > restore drill: baseline clone + incremental fetch reaches main [5034.79ms]
  ^ this test timed out after 5000ms.

 959 pass
 1 fail
Ran 960 tests across 118 files. [184.57s]
```

### Expected Behavior

A test whose duration is dominated by spawned subprocess work carries a budget that reflects the work
it deliberately performs, so that a red suite means a broken assertion — not a busy machine.

### Root Cause

`scripts/git-bundle-backup.test.ts` contains seven cases, each of which initializes a scratch git
repository, makes commits, and runs the real bundle pipeline through `spawnSync('git', …)` — the
restore drill additionally clones from `baseline.bundle` and fetches the incremental bundle. Sibling
cases in the same file measured 1076 ms, 3263 ms, 1638 ms and 2172 ms; the restore drill, which does
the most subprocess work of the set, measured 4261–5462 ms. bun's per-test default is 5000 ms, so the
case sits on the wrong side of it depending on load. This is the same class as `FID-2026-1013-007`
(one workspace over) and `FID-2026-1010-004` (same tree, a repository-walking case): a default sized
for unit tests applied to a test that deliberately does integration work.

### Evidence

```text
$ cd scripts && bun test git-bundle-backup.test.ts          # three isolated runs
(fail) ... restore drill: baseline clone + incremental fetch reaches main [5462.56ms]   6 pass / 1 fail
(pass) ... restore drill: baseline clone + incremental fetch reaches main [4261.02ms]   7 pass / 0 fail
(fail) ... restore drill: baseline clone + incremental fetch reaches main [5007.55ms]   6 pass / 1 fail

$ sed -n '150,152p' dev/scratchpad/active/2026-10-13-final-gates.log   # sibling costs, same file
(pass) git bundle backup > same-HEAD rerun is idempotent (no second incremental for one commit) [3263.58ms]
(pass) git bundle backup > unwritable destination fails closed without touching the marker [2172.37ms]
```

## Impact Assessment

### Affected Components

- `scripts/git-bundle-backup.test.ts`

### Risk Level

- [ ] Critical / [ ] High
- [x] Medium: Feature degraded, workaround exists — the scripts suite is one of the declared gates, so
  a red run cannot be distinguished from a real regression in the bundle backup path.
- [ ] Low

## Proposed Solution

### Approach

Declare the file's per-test ceiling explicitly, using the convention already established in this tree
by `FID-2026-1010-004` (`scripts/quality-report.test.ts`): a named constant with the measurements that
justify it, passed as the third argument to each case, assertions untouched.

### Steps

1. Add `GIT_CHILD_TIMEOUT_MS = 30_000` with a comment recording the isolated measurements and the two
   clock-only failures out of three runs.
2. Pass it to all seven cases in the file — the sibling cases share the same subprocess-heavy shape
   (one already measured 65% of the default), so the ceiling is declared once for the file rather than
   per case as failures appear.

### Verification

The file green on three consecutive isolated runs; the full scripts suite green from its declared cwd
with an explicit exit status.

## Verification Gates

- gate: test scripts/git-bundle-backup.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:PENDING
- verified: PENDING
- test scripts/git-bundle-backup.test.ts: PENDING
- probe scripts/scripts-typecheck-check.ts: PENDING
- quality: PENDING

## Perfection Loop

### Loop 1 — RED (2026-10-13)

- **RED:** The scripts suite exits 1 on a clean tree with a clock-only failure; reproduced in
  isolation at 5462 ms and 5007 ms, and the passing run at 4261 ms shows the underlying work is real
  and merely near the default.
- **GREEN:** An explicit, measured budget on the file's cases, following the tree's existing
  convention.
- **AUDIT:** Failure and its timing quoted from the sweep log; sibling costs read from the same log to
  establish that this is a file-wide shape, not one outlier test.
- **ADVERSARIAL:** Does a longer ceiling hide a hang? The drill is deterministic work with a measured
  completion of 3.5–5.0 s across both the unformatted and final bytes, all well inside the 30 s
  ceiling; an actual hang still fails, just later. Would making the test cheaper be better?
  The clone-and-fetch is the thing under test — a restore drill that does not restore from the bundle
  would assert nothing — so the budget moves rather than the fixture. Is 30 s generous enough for a
  loaded machine? The precedent case used the same ceiling for the same class, and here the spread
  observed under load is 4.0–5.5 s.
- **CHANGE DELTA:** One named constant, seven call sites, no assertion or production change.

### Missed Questions

1. **Why did the earlier run of this suite pass?** It was green at 960/0 earlier in the session with
   the same code; the difference is machine load, which is exactly why the fix is a declared ceiling
   rather than a re-run.
2. **Is this the same failure `FID-2026-1013-006` closed?** No — that record repaired four
   deterministic failures in other files (cwd-dependent live checks, an origin-scoped redirect guard,
   two git fixtures below their spawn budget). This is a fifth, independent case that surfaced only
   once those stopped masking the suite's exit status.
3. **Should the whole tree be swept for cases near the default?** That is a class decision, not this
   record's: enumerating every subprocess-spawning test and measuring it is the recurrence-to-fix-loop
   work owned by the master plan, and it is recorded there as the remaining harness item rather than
   guessed at here.

### Code Verification Evidence

- [x] `scripts/git-bundle-backup.test.ts:29` — `GIT_CHILD_TIMEOUT_MS`, with the measurements that
      justify it; passed as the third argument at the seven case call sites (`:88`, `:118`, `:138`,
      `:167`, `:189`, `:221`, `:263`). The formatter owns the call layout: a trailing non-function
      argument stops prettier hugging `test('name', () => {` and it expands the cases, so the file is
      committed in prettier's own layout rather than a hand-formatted near-miss.
- [x] Gate output captured with explicit exit statuses in
      `dev/scratchpad/active/2026-10-13-final-gates.log`.
- [x] FID status reflects the implementation: `converged` until the commit lands (G2).

## Resolution

- **Closed Date:** 2026-10-13 22:10
- **Fix Description:** `scripts/git-bundle-backup.test.ts` declares `GIT_CHILD_TIMEOUT_MS = 30_000` —
  with the isolated measurements recorded beside it — and passes it to its seven cases. No assertion,
  fixture or production change.
- **Tests Added:** none — assertions untouched.
- **Verification Evidence:** three isolated runs of the file on the final bytes, green and exit 0, with
  the drill at 3534 ms / 3517 ms / 3474 ms (7 PASS each); the full scripts suite `exit 0`, **960 pass / 0 fail** in 194.01 s from its
  declared cwd (`dev/scratchpad/active/2026-10-13-scripts-suite-post008.log`); declared gates stamped
  (fingerprint `sha256:7109e0ae…`); the root `bun run test` chain exit 0 (13 legs) on the pre-fix tree,
  re-run below on the final bytes.
- **Commit SHA:** `4be4de9e`
- **Archived:** 2026-10-13 22:10

## Lessons Learned

Third instance of one class in one session (`FID-2026-1010-004`, `-1013-006`, `-1013-007`, now
`-1013-008`): a test that deliberately drives real subprocesses inherits a timeout default sized for
unit tests, and the resulting red run is indistinguishable from a real defect. The cheap tell is
sibling durations in the same file — when one case in a file costs 3.3 s, the file's heaviest case is
already living on the edge of a 5 s default. Measure, then declare the ceiling next to the test it
protects.
