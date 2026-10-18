# FID: Preserve junction targets during worktree disposal

**Filename:** `FID-2026-1017-009-worktree-junction-disposal.md`
**ID:** FID-2026-1017-009
**Severity:** critical
**Status:** verified
**Created:** 2026-10-17
**Automation level:** 3
**YAGNI-Compliance:** Verified — repairs existing lifecycle teardown.

## Summary

Git worktree removal on Windows follows linked dependency directories and can
delete main-checkout dependency contents. Restore installation from the frozen
lockfile and detach links before any recursive lane removal.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** installed Git for Windows
- **Commit/State:** `3d24daf9`; no tracked source modifications on discovery

## Detailed Description

### Problem

CLI startup fails with missing `@ai-sdk/openai`. The live acceptance disposed a
lane linked to main's root and workspace dependency directories.

### Expected Behavior

Removing a lane must preserve every linked target, including package bytes and
executable shims. Failure to detach a link must stop recursive removal.

### Root Cause

`disposeFidWorktree` passes the lane directly to `git worktree remove --force`
while dependency junctions remain attached. Unit fakes do not model Git's
Windows traversal. Existing real tests did not assert host dependency survival.

### Evidence

```text
bun --no-env-file run src/index.tsx --help
error: Cannot find module '@ai-sdk/openai'
bun install --frozen-lockfile: 35 packages installed; exit 0
CLI --help after installation: exit 0
Disposable real-git junction probe:
{"status":0,"mainDependencySurvived":false,"laneSurvived":false}
```

The fixture was isolated under the OS temp directory; no operator dependency
directory was used by this reproduction.

## Impact Assessment

### Affected Components

- Worktree disposal, provisioning rollback and crashed-lane cleanup.
- Main dependency installation, restored with the existing frozen lockfile.

### Risk Level

- [x] Critical: deletion reaches shared dependency target contents.

## Proposed Solution

### Approach

Add an injected filesystem detachment operation. Walk the lane using lstat,
unlink symbolic links/junctions without traversing them, recurse only into real
directories, and return failure on any inspection/unlink error. Run it before
Git removal and its filesystem fallback. Enumerate actual links rather than
trusting a record, covering rollback before record persistence and crash debris.

### Steps

1. Restore dependencies and reproduce target deletion — completed.
2. Add real-git regression and fail-closed coverage, then repair teardown — implemented.
3. Verify workspace and root gates — implemented; commit and archive follow verification.

### Verification

`packages/agent-runtime/src/__tests__/fid-worktree-junction-disposal.test.ts`
must prove root/workspace target bytes survive real disposal, missing records,
and initialization rollback; a failed detachment must leave git untouched.
Existing disposal/provisioning suites must retain their lifecycle behavior.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-junction-disposal.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-dispose.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts
- gate: probe scripts/probes/fid-worktrees.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:fcb0614b78745011f783d4ba37c23c2b3dce60c9ea39a8e8347ac33337bd23fa
- verified: 2026-10-18T00:02:10.292Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-junction-disposal.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-dispose.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts: exit 0
- probe scripts/probes/fid-worktrees.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Real Git deletes the external sentinel; startup fails before inference.
- **GREEN:** Detach actual links before removal, with injected fail-closed seam.
- **AUDIT:** All production disposal paths call `disposeFidWorktree`; the
  filesystem seam is implemented only by production and the shared test fixture.
- **ADVERSARIAL:** Record-only detachment misses pre-record rollback and stale
  records. Walking with lstat avoids both, and must not follow nested links.

### Missed Questions

1. Does Git preserve junction targets? No: the real Windows fixture disproves it.
2. Can rollback lack a record? Yes; inspect the actual lane before removal.
3. What if unlink fails? Refuse teardown and retain the lane/record for inspection.

### Loop 2 — Independent audit and self-correction

- **RED:** Root-only link checks miss workspace links and dangling links.
- **GREEN:** Traverse real directories; lstat and unlink every encountered link.
- **AUDIT:** Test both root and nested workspace sentinel bytes, recordless
  disposal, rollback, and a simulated detachment refusal.
- **ADVERSARIAL:** This is host-controlled cleanup, not a hostile-process sandbox;
  do not claim protection against simultaneous external filesystem rewrites.

### Loop 3 — Final convergence

- **RED:** Existing fallback teardown must remain reachable after detachment.
- **GREEN:** Preserve git-remove, absence check, bounded fallback and prune order.
- **AUDIT:** Run existing lifecycle suites alongside the new real-git regression.
- **ADVERSARIAL:** No unrelated graph-refresh or transient-root claim is repaired
  by this junction fix; acceptance findings remain recorded under FID-008.

### Implementation Evidence

Implementation: `fid-worktree.ts` invokes `fs.detachLinks(lanePath)` before
either recursive removal path; `fid-worktree-record.ts` wires production to
`detachWorktreeLinks` in `fid-worktree-detach.ts`. The shared test seam models
detachment. The implementation commit is recorded at closure.

### Code Verification Evidence

All four new regression cases failed before the fix and pass after it. The
combined new/provision/dispose suites pass 19 tests. All six declared gates
pass, as do full root typecheck, SDK build and targeted zero-warning ESLint.
The helper uses lstat/unlink and never traverses a discovered link. Caller
search confirms normal disposal, rollback and debris cleanup use this seam.
The CLI help startup check passes without a model call. Full pre-push gates
run before delivery. Logs: `dev/session-summaries/2026-10-17-junction-recovery-*.log`.

## Resolution

Installation and executable shims restored with the frozen lockfile, without
dependency-version edits. Permanent teardown repair is implemented and verified;
commit and archive follow the receipt stamp.

## Lessons Learned

Real Windows junction tests must assert target survival, not only lane absence.
