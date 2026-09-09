# FID: Clean-checkout gate leaves an orphaned Temp worktree directory on failed runs

**Filename:** `FID-2026-0909-001-clean-checkout-gate-orphaned-temp-dir.md`
**ID:** FID-2026-0909-001
**Severity:** low
**Status:** fixed
**Created:** 2026-09-09 03:10
**YAGNI-Compliance:** PASS (2026-09-09 — see Loop 1)

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

**Corrected (Loop 1, 2026-09-09 — `scripts/public-release/provenance.ts`
read 0-EOF):** the original hypothesis is not what the code does. The
install/typecheck gates run INSIDE the try block and their `fail()` throws
reach the `finally` (`provenance.ts:161-208`), which does attempt
`git worktree remove --force`. The real gap is threefold:

1. **Silent removal failure.** The `finally` discards the removal result
   — a removal failure (Windows node_modules file locks) leaves the
   workdir on disk with no warning anywhere.
2. **No pre-create self-healing.** A leftover directory from a previous
   failed run (registered or orphaned) makes `git worktree add` fail with
   `already exists` on the NEXT run, and that failure path (line 158,
   before the `try`) cleans nothing by construction.
3. **No filesystem fallback.** `git worktree remove` only works for a
   registered worktree, and the leading `git worktree prune` only deletes
   registrations whose directory is missing — neither can clear a present
   orphan directory.

The observed incident sequence (run 1 fails at gates → silent removal
failure → run 2 aborts at `already exists` → manual `rm -rf`) matches this
chain. The exact git-internal ordering (whether a failed `worktree
remove` detaches the admin entry) is confirmed by a live probe at
implementation; the fix below is robust to either ordering.

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

**Corrected 2026-09-09 (Loop 1):** make the lifecycle self-healing at all
three pinned gaps:

1. **Pre-create guard** — before `git worktree add`, if the checkout path
   exists: best-effort `git worktree remove --force` (harmless when
   unregistered) followed by a filesystem `rm -rf` (`node:fs`
   `rmSync({ recursive: true, force: true })`), each failure logged,
   never thrown.
2. **Result capture** — the `finally`'s removal result is inspected; a
   non-zero status or a still-present directory produces a loud warning
   naming the path and the manual remediation.
3. **Filesystem fallback** — after the git removal, verify absence; if
   the directory survives, remove it via the filesystem layer under the
   same best-effort contract.

Cleanup stays best-effort (never fail-closed): debris is recoverable, and
fail-closed cleanup would reintroduce the block this FID removes. An
injected fs seam (`existsSync`/`rmSync`) keeps every command + filesystem
surface injectable per the repo's DI convention — no module mocking.

### Steps

1. Read `scripts/public-release/provenance.ts` 0-EOF and pin the exact
   removal-path gap. **Done 2026-09-09 (Loop 1)** — gaps pinned; see the
   Root Cause correction.
2. RED-first pins in `scripts/public-release-provenance.test.ts`
   (mock runner + memory fs adapter, mirroring the suite's existing
   injectable convention): (a) a stale directory is removed by the
   pre-create guard and the run proceeds to `worktree add`; (b) a failed
   git removal in the `finally` surfaces a warning instead of vanishing;
   (c) the release-path default chain is byte-identical (existing parity
   pins stay green).
3. GREEN: implement the guard + result capture + filesystem fallback in
   `assertCleanCheckoutCompiles` with the injected fs adapter. The file is
   212 lines today — the addition must stay under the 300-line ceiling.
4. Live end-to-end recovery drill (operator boundary, release cut): force
   a gate failure, confirm no leftover directory afterward, confirm the
   immediate re-run passes worktree creation.

### Verification

Release-cut end-to-end: force a gate failure, confirm the checkout
directory is absent afterward, confirm the immediate re-run passes
worktree creation. Unit pin green; typecheck scripts; eslint clean.

## Verification Gates

- gate: test scripts/public-release-clean-checkout.test.ts
- gate: test scripts/public-release-provenance.test.ts
- gate: test scripts/__tests__/verify-clean.test.ts

### Verification Receipt

- fingerprint: sha256:95679a9c2516c528b956f1ffc54b2127f0de38297e76995076efb719ded24f89
- verified: 2026-09-09T16:06:52.377Z
- test scripts/public-release-clean-checkout.test.ts: exit 0
- test scripts/public-release-provenance.test.ts: exit 0
- test scripts/__tests__/verify-clean.test.ts: exit 0

## Implementation Evidence

Declared at Loop 1 (2026-09-09); run green at implementation (2026-09-09).
Boundary notes: (1) the release-cut recovery drill stays an operator-
assisted live boundary (never claimed from local runs); (2) the git
internal-ordering probe was run locally instead: unregistered orphan dir →
`git worktree remove --force` exit 128 with the dir intact (fs fallback
required — exactly what the guard implements); registered worktree → exit
0 with the dir removed.

- `scripts/public-release/clean-checkout.ts` (new, 128 lines):
  `ensureCheckoutDirectoryAbsent` (pre-create guard: git removal then fs
  removal on survivors), `cleanupCheckoutDirectory` (finally-path: git
  removal ALWAYS issued as the registration owner, fs fallback for
  survivors), `defaultCheckoutFilesystem` (node:fs rmSync with maxRetries
  for the Windows EBUSY/EPERM lock class), `emitLifecycleWarning`
  (structured stderr warnings, never thrown), `CheckoutFilesystem` seam.
- `scripts/public-release/provenance.ts` (212 → 248 lines, under the 300
  ceiling): `assertCleanCheckoutCompiles` runs the guard FIRST (before
  prune + add), passes the fs adapter via the new optional `options`
  parameter (4-positional signature preserved; call sites unchanged), and
  the finally now captures the cleanup outcome, emitting warnings.
- RED-first recorded: `bun test scripts/public-release-clean-checkout.test.ts`
  failed with `Cannot find module './public-release/clean-checkout'` before
  implementation; 12/0 after.
- Suite parity: provenance 11/0 + verify-clean 9/0 unchanged in behavior
  for the default chain (the release path's command sequence keeps the
  documented shape — pinned by the parity test).

## Perfection Loop

### Loop 1 — RED / GREEN / AUDIT (2026-09-09, codebase-grounded)

- **RED (ground-truth verification):** the incident is CONFIRMED against
  the live code, with the root-cause mechanism corrected (three gaps
  above, replacing the original single-gap hypothesis). The original
  claim "a mid-gate fail() exit escapes before removal" is REFUTED by the
  code: gate failures throw inside the try and DO reach the finally.
  Evidence: `provenance.ts:151-208` (worktree add → try/gates →
  finally/remove with discarded result), `provenance.ts:139-147` (prune
  before add), `provenance.ts:153-160` (the add-failure fail() that
  cleans nothing by construction).
- **GREEN (design corrections from grounding):** the fix is now three
  coordinated pieces (pre-create guard, result capture, filesystem
  fallback) instead of one try/finally relocation — the original Approach
  would NOT have fixed the incident, because the finally already runs on
  gate failures; what failed silently is the removal itself. The fs seam
  is added because the filesystem fallback cannot exist inside a
  CommandRunner (commands are process spawns; deleting an orphan
  directory is not a git command).
- **AUDIT (Missed Questions answered):**
  1. *Why was the directory not in `git worktree list`?* — ANSWERED as a
     mechanism analysis: the finally's `git worktree remove --force` runs
     while node_modules files are OS-locked (bun install spawns in the
     checkout); a partial removal leaves the directory with detached or
     prunable registration, and every subsequent run begins with
     `git worktree prune`, which deletes registrations whose directory
     is missing. The exact git-internal ordering is confirmed by a live
     probe at implementation (recorded constraint, not an open design
     question — the fix handles both orderings).
  2. *Best-effort or fail-closed removal?* — CONFIRMED best-effort with a
     logged warning, per the FID's original reasoning; the pre-create
     guard makes the NEXT run self-heal regardless, which is the durable
     property that matters.
- **ADVERSARIAL (self-refutation pass):** strongest objection — "the
  pre-create guard masks a real failure: deleting a directory owned by a
  concurrent run." Refuted by the contract: the path is
  version-keyed (`savant-release-checkout-v<version>`) and the pipeline
  is single-run by design (the receipt/transaction model); a concurrent
  same-version run is already unsupported today (the add would fail
  identically). Second objection — "rmSync on Windows with live locks
  can still fail." Accepted: that is precisely why the guard is
  best-effort + warned + paired with result capture, and why the live
  recovery drill is an operator boundary.
- **CHANGE DELTA:** planning record; document edits only.
- **CONVERGENCE:** all RED findings resolved in one pass (no
  oscillation); delta < 2% for this pass. Loop closed at 1.

### Missed Questions

1. ~~Why was the directory not in `git worktree list`?~~ ANSWERED (Loop 1
   AUDIT — mechanism analysis above; live probe at implementation
   confirms git's internal ordering).
2. ~~Should the removal be best-effort or fail-closed?~~ ANSWERED (Loop 1
   AUDIT): best-effort with a logged warning + a self-healing pre-create
   guard on the next run.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`provenance.ts` + the
      new `clean-checkout.ts`; test file created)
- [x] Implementation matches the Proposed Solution (three-piece corrected
      design: pre-create guard, result capture, fs fallback)
- [x] Tests/lint pass with pasted tool output (32/0 across the three
      suites; eslint `--max-warnings 0` clean)
- [x] Production call-graph evidence is present (call sites verified:
      `assertReleaseHeadCompiles` ← `stages.ts` GATES stage;
      `assertCleanCheckoutCompiles` ← `verify-clean.ts:66` — both reached
      through the same hardened lifecycle; grep-backed in the Loop 1 RED)
- [x] FID status reflects the actual implementation state (`fixed`)

## Lessons Learned

The gate environment is a stateful surface: any artifact it creates must
be cleaned by the same run's exit paths, or the *next* run inherits the
failure. **Corrected (Loop 1):** the harder lesson is that cleanup whose
result is discarded is not cleanup — `finally { remove() }` without
inspecting the removal result converted a transient Windows lock into a
permanent, silent block. "Removed on every path" claims need both: a test
that simulates cleanup failure, and a next-run design that self-heals
from the previous run's debris instead of requiring a human `rm -rf`.

## Resolution

- **Closed Date:** 2026-09-09. G2 commit hash: `086565b` (full sha
  `086565b6`, resolved via `git log`; verified 2026-09-09).
- **Fix Description:** self-healing clean-checkout lifecycle — pre-create
  guard clears debris before the add; finally-path cleanup captures its
  result, warns loudly, and falls back to a filesystem removal for
  survivors; best-effort by design so cleanup can never abort a run.
- **Tests Added:** `scripts/public-release-clean-checkout.test.ts` (12
  tests: guard self-heal, fallback-on-failed-git-removal, no-op-when-
  absent, best-effort warnings, cleanup capture, survivor fallback,
  registration-owner rule, guard-first ordering, default-chain parity,
  gate-failure cleanup, add-failure non-blocking)
- **Verification Evidence:** 32/0 across the three suites (12 new + 11
  provenance + 9 verify-clean); eslint clean; live git-ordering probe
  recorded above. Operator boundary: the release-cut recovery drill.
- **Archived:** (pending — move to archive + CHANGELOG entry, then the
  receipt is re-stamped at the archived path per the repo convention)