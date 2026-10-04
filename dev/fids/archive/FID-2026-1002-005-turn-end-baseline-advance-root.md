# FID: Turn-end baseline advance must use the captured worktree root

**Filename:** `FID-2026-1002-005-turn-end-baseline-advance-root.md`
**ID:** FID-2026-1002-005
**Severity:** medium
**Status:** closed (implemented + verified, 2026-10-03, commit 9f1b8068)
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Turn-end worktree reconciliation runs against the captured baseline root,
but the same function advances the baseline against `process.cwd()`. When
the process cwd differs from the capture root, every path verified in the
turn fails the advance prefix filter, the baseline never absorbs verified
content, and strict-mode turn ends re-flag the same files every turn.

## Environment

- **OS:** Windows (audit session), Bun 1.3.14
- **Language/Runtime:** TypeScript strict monorepo
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October 2
  work; no commit authorized (G2)

## Detailed Description

### Problem

`packages/agent-runtime/src/echo/enforcement/turn-end.ts` reconciles with
the captured root but advances with the process cwd:

```text
turn-end.ts:56   reconcileWorktree({ checkpoint, repoRoot:
                 checkpoint?.worktreeBaselineRoot ?? process.cwd(), ... })
turn-end.ts:117  advanceWorktreeBaseline({ checkpoint: self.ensureCheckpoint(),
                 repoRoot: process.cwd(), paths: [...self.state.verifiedFiles] })
```

`advanceWorktreeBaseline` silently drops any path outside the passed root
(`worktree-capture.ts:236-238`, the `startsWith(rootCanonical + '/')`
filter), and `resetForNewTurn` clears the verified set regardless
(`turn-end.ts:126`).

### Expected Behavior

Both reconciliation and advance run against the same root the baseline was
captured from, so verified content is absorbed exactly once and never
re-flagged.

### Root Cause

The advance call predates the captured-root contract that
FID-2026-1002-002 introduced for the reconcile leg; it still assumes cwd is
stable for the session lifetime. Production chdir sites break that
assumption: `cli/src/components/app-with-async-auth.tsx:76` (project
open/switch) and `cli/src/init/init-app.ts:26`.

### Evidence

Source-confirmed in the T113 full-system data-flow audit (finding D2,
`dev/session-summaries/2026-10-02-full-data-flow-audit.md`). The mechanism:
with cwd ≠ capture root, `advanceWorktreeBaseline` skips every verified
path (prefix mismatch), the baseline keeps the pre-turn hashes, and the
next turn-end reconciliation re-reports those files as changed → merged
into dirtyFiles → Law 15 blocks a turn whose work was already verified.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/enforcement/turn-end.ts` (the advance call)
- `packages/agent-runtime/src/echo/enforcement/worktree-capture.ts`
  (advance contract — unchanged, only its caller is)

### Risk Level

- [x] Medium: repeated Law 15 re-flags of already-verified work after a
  project switch in strict mode; no data loss.

## Proposed Solution

### Approach

Reuse the `checkpoint` binding that the turn-end function already holds for
reconciliation and pass its captured root to `advanceWorktreeBaseline`,
mirroring the reconcile line exactly. No new state, no new API — the root
authority stays the checkpoint (Law 13: one truth).

### Steps

1. Change the advance call to
   `repoRoot: checkpoint?.worktreeBaselineRoot ?? process.cwd()`, reusing
   the existing `checkpoint` const instead of a second
   `self.ensureCheckpoint()` call.
2. Add a turn-end regression test in
   `packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts`:
   capture a baseline in a temp git repo (cwd during `bun test` is the
   workspace root — naturally different), perform a gated write, grant Law
   3 verification credit, run turn end, and assert the baseline absorbed
   the new hash AND a second turn end stays unblocked. This fails on the
   old code (advance skips the path; second turn blocks).

### Verification

Two turn ends on a captured temp repo with cwd ≠ capture root: the first
turn end absorbs the verified content into
`checkpoint.worktreeBaseline`, the second reports no changes and does not
block. Declared gates below re-run the enforcement suites and the quality
gate.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/terminal-bypass-pipeline.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:71f1a4a2a1181b3d2cf3bbaf360b41c4e8030835247f705a7caf72fcae9985ab
- verified: 2026-10-03T03:14:16.621Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/terminal-bypass-pipeline.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Audit finding D2 with `file:line` evidence for the asymmetry (turn-end.ts
advance vs reconcile), the advance prefix filter
(worktree-capture.ts:236-238), and the production chdir sites. The
regression test does not exist yet; the asymmetry is pinned by source only.

### GREEN

The fix reuses the checkpoint's captured root — the same authority the
reconcile line already uses. The temp-repo test exercises the strict turn
end twice; `bun test` cwd (the workspace) is inherently different from the
capture root, so no `process.chdir` is needed in the test.

### AUDIT

The reconcile call at `turn-end.ts:56` and the fixed advance call now
resolve the same root from the same `checkpoint` binding. `advanceWorktreeBaseline`
keeps its guard (`checkpoint.worktreeBaselineCapturedAt == null` → no-op),
so an uncaptured session advances nothing — unchanged behavior. The
terminal-bypass-pipeline suite pins the existing cwd==capture-root flow
(dev CLI sessions) end-to-end.

### Missed Questions

1. Why not pass `process.cwd()` always and drop the captured root? The
   captured root is the baseline's namespace (FID-2026-1002-002 comment:
   reconciling against any other root diffs the baseline against an
   unrelated tree); the advance half of that contract must match.
2. Does anything else call `advanceWorktreeBaseline` with a different root?
   Call-graph: only `turn-end.ts` in production; `worktree-capture.test.ts`
   pins the unit contract with explicit roots — unaffected.
3. Is the second `self.ensureCheckpoint()` call load-bearing? It returns
   the same durable checkpoint object; reusing the local binding is
   behavior-identical and removes a redundant lookup.
4. Could a chdir happen between reconcile and advance within one turn end?
   They run synchronously in the same function on the same tick — no await
   between them; the shared binding is safe.

### Convergence

Plan is grounded in production source with a failing-test shape. Ready for
implementation at level 3.

## Implementation Evidence

### Code Verification Evidence

- `packages/agent-runtime/src/echo/enforcement/turn-end.ts:135-139` — the
  advance call now resolves its root from the same `checkpoint` binding the
  reconcile call at `:56` uses: `repoRoot:
  checkpoint?.worktreeBaselineRoot ?? process.cwd()`. Call-graph: the only
  production caller of `advanceWorktreeBaseline` is this site
  (`turn-end.ts:139`); `worktree-capture.test.ts` pins the unit contract
  with explicit roots and is unaffected.
- `packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts:186-244`
  — the regression test: gated write (Law 8 intent → Law 1 read → write)
  plus a green `bun run typecheck` credit in strict mode, with the capture
  root in a temp git repo while `bun test`'s cwd is the workspace — the
  exact drift condition, with no `process.chdir` needed. It asserts the
  baseline absorbed the verified hash (`worktreeBaseline['tracked.ts'] ===
  hashFile(file)`) and that a second turn end stays unblocked. On the old
  code the advance prefix filter (workspace cwd) skipped the path, the
  baseline kept the original hash, and the second turn end re-flagged and
  blocked — both assertions fail.
- Gates (run this session, exit codes below in the receipt): agent-runtime
  typecheck 0; worktree-reconcile 10 pass / 0 fail (incl. the new test);
  worktree-capture 5 pass / 0 fail; terminal-bypass-pipeline 9 pass / 0
  fail.

### Step Status

- [x] Step 1 — advance against the captured root: implemented
      (`turn-end.ts:135-139`, comment updated at `:127-134`).
- [x] Step 2 — chdir-drift regression test: implemented
      (`worktree-reconcile.test.ts:186-244`).

## Resolution

- **Fix Description:** the turn-end baseline advance resolves its root from
  the captured baseline root, matching the reconciliation contract.
- **Tests Added:** Yes — the captured-root advance regression in the
  turn-end integration block of the worktree-reconcile suite.
- **Verification Evidence:** all four declared gates exit 0; receipt
  stamped below by the project verifier.
- **Commit SHA:** `9f1b8068` — landed in the 2026-10-03 batch commit on
  local main (operator granted G2; local commit only, no push).
- **Archived:** 2026-10-03 (moved to `dev/fids/archive/`)
