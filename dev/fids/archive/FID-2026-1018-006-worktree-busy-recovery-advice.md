# FID: Require writer confirmation before stale-lock removal

**Filename:** `FID-2026-1018-006-worktree-busy-recovery-advice.md`
**ID:** FID-2026-1018-006
**Severity:** low
**Status:** closed
**Created:** 2026-10-18
**Automation level:** 3
**YAGNI-Compliance:** Verified — advisory wording, no new behavior or API.

## Summary

Busy refusal should explicitly require confirming no lifecycle writer remains
before removing a confirmed abandoned, empty lock directory.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript strict / Bun 1.3.14
- **Tool Versions:** existing real-git service suite
- **Commit/State:** `e0d29fb0`

## Detailed Description

### Problem

The old busy message says to inspect/remove an empty lock after a crashed host,
without explicitly checking whether another lifecycle writer is still active.

### Expected Behavior

Retry active operations; only inspect removal after confirming abandonment.

### Root Cause

The lock is a directory with no owner metadata; emptiness cannot establish liveness.

### Evidence

`fid-worktree-service.ts` acquires with `mkdirSync(lock)` and releases with
`rmdirSync(lock)`. A legitimate active lock is normally empty. Run-4 handoff
defect 4's suggested content-based distinction would be unsound.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts`
- `packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts`

### Risk Level

- [x] Low: wording only; fail-closed locking remains unchanged.

## Proposed Solution

### Approach

Clarify busy detail without inspecting contents or changing acquisition/release.
Extend the existing occupied-lock case to verify the advice and preservation
of both empty and populated locks.

### Steps

1. Change advisory and extend existing assertions.
2. Run declared gates and inspect production callers; commit.
3. Archive with changelog, release scope and push through mandatory gates.

### Verification

`packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts` checks refusal,
safe recovery wording and preservation. Verify handler and CLI share this service.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c4699a4798dce4e4e6691df38c25f65e7926858280781e246df2c4c8c473c0bb
- verified: 2026-10-18T20:31:48.629Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Read service and full existing suite; busy refusal correctly preserves the lock.
Only recovery advice needs clarification.

### Loop 2 — Independent audit and self-correction

Reject empty/nonempty liveness inference: active locks are empty too. No new
filesystem operation, owner metadata, automatic cleanup or behavior change.

### Loop 3 — Final convergence

Plan converged before implementation. Exercise both lock shapes in the existing
case; preserve typed busy output and existing lifecycle coverage.

### Missed Questions

1. Can this service establish abandonment? No; the operator must confirm it.
2. Does populated lock cleanup change? No; service preserves it as before.

### Implementation Evidence

Busy detail now requires writer confirmation and abandonment before removal.
Existing suite asserts both safe-advice phrases, retained empty lock and an
unchanged occupant after a second refusal. Implementation commit `a9413a69`;
3/3 declared gates exit 0. All three implementation/closure steps complete;
normal progress push remains subject to mandatory hooks.

### Code Verification Evidence

`scripts/worktree.ts:64` and handler `tool/fid-worktree.ts:22` call the shared
service (grep `runFidWorktreeAction` returned both production callers).
Scoped Prettier reports all matched files use code style.

## Resolution

- **Closed Date:** 2026-10-18
- **Commit SHA:** a9413a69
- **Fix Description:** Require live-writer confirmation and abandonment before
  lock removal; no filesystem behavior or lock contents changed.
- **Tests Added:** Existing service suite extended for safe advice and retained
  empty/populated locks.
- **Verification Evidence:** 3/3 declared gates exit 0; scoped Prettier and SDK
  build `bun run ci` pass. Production handler and CLI callers verified by grep.
- **Archived:** 2026-10-18

## Lessons Learned

Lock contents are not a liveness signal.
