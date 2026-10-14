# FID: A Windows lock code and the 5 s default make the graph fixture red

**Filename:** `FID-2026-1013-007-windows-lock-codes-and-the-default-test-budget.md`
**ID:** FID-2026-1013-007
**Severity:** medium
**Status:** closed
**Created:** 2026-10-13 21:10
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

---

## Summary

The root `bun run test` chain exits 1 on a clean tree, in `packages/knowledge-graph`. Two causes,
both environmental and both measured: the refresh-safety fixture's teardown retries only `EBUSY`,
for 250 ms, while Windows reports whichever lock code it holds (`EBUSY`, `EPERM`, `EACCES`,
`ENOTEMPTY`); and one test fabricates 10,001 readdir entries and runs a full refresh, costing
2.2 s idle and 5.1 s under load against bun's 5 s default. The fixture's own intent — "the temp
tree is gone, whatever the OS was holding" — is what the repair restores.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** `main` @ `2a34e558` + the `FID-2026-1012-024` Loop 11 working tree

## Detailed Description

### Problem

In the root chain's final leg (`packages/knowledge-graph`, 76 tests / 9 files) the run ended
`1 error`, `bun run test` exit 1. In isolation the same file produced a different failure: the
`files DELETE failure rolls back the entire refresh` test failed inside `removeFixture` — teardown,
not an assertion.

### Expected Behavior

Teardown absorbs the OS's transient lock states within a bounded budget, and a test's timing budget
reflects the work it deliberately performs.

### Root Cause

1. `removeFixture` retried `error.code !== 'EBUSY' || attempt >= 10` — one lock code, 10 × 25 ms = 250 ms.
   Windows raises `EPERM`/`EACCES` for a file a closing handle still holds, and `ENOTEMPTY` for a
   directory whose child was removed concurrently; each of those threw out of the loop immediately.
   The `rmdir` catch tolerated only `ENOENT`.
2. `capped enumeration preserves the snapshot; a complete later scan deletes` fabricates a
   10,001-entry readdir and performs a full refresh, which costs seconds on this platform.

### Evidence

```text
$ bun run test                      # root chain, final leg
(fail) FID-2026-1011-006 refresh safety > capped enumeration preserves the snapshot; a complete later scan deletes [5140.06ms]
# Unhandled error between tests
Ran 76 tests across 9 files. [11.98s]
error: script "test" exited with code 1

$ cd packages/knowledge-graph && bun test src/__tests__/refresh-safety.test.ts
(pass) ... capped enumeration preserves the snapshot ... [2212.24ms]     # passes alone
      at async removeFixture (.../refresh-safety.test.ts:47:29)          # different test, teardown
(fail) FID-2026-1011-006 refresh safety > files DELETE failure rolls back the entire refresh [495.18ms]
 14 pass / 1 fail

$ grep -n "EBUSY" packages/knowledge-graph/src/__tests__/refresh-safety.test.ts
47:          if (error.code !== 'EBUSY' || attempt >= 10) throw error
```

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/__tests__/refresh-safety.test.ts`

### Risk Level

- [ ] Critical / [ ] High
- [x] Medium: Feature degraded, workaround exists — the chain is red for an environmental reason, so
  a real graph regression cannot be distinguished from a locked temp file.
- [ ] Low

## Proposed Solution

### Approach

Extract the retry, name the OS's transient lock set, give it a real budget, and give the heavy test a
budget that matches its work. No assertion changes.

### Steps

1. `retryTransient` retries `EBUSY`, `EPERM`, `EACCES` and `ENOTEMPTY` for up to 40 × 50 ms, still
   tolerating `ENOENT` as the desired end state, and now guards the `rmdir` as well as the unlink.
2. Explicit `30_000` budget on the fabricated-enumeration test, with its measured cost recorded.

### Verification

The file green repeatedly in isolation and inside the root chain; `quality` and
`typecheck packages/knowledge-graph` green.

## Verification Gates

- gate: test packages/knowledge-graph/src/__tests__/refresh-safety.test.ts
- gate: typecheck packages/knowledge-graph
- gate: quality

### Verification Receipt

- fingerprint: sha256:eec636fa5ee8d6a85657fe26790569b3b97504542195f5a776127929be59adba
- verified: 2026-10-14T01:05:02.912Z
- test packages/knowledge-graph/src/__tests__/refresh-safety.test.ts: exit 0
- typecheck packages/knowledge-graph: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-13)

- **RED:** Root chain exit 1 from this leg; the isolated run fails in teardown while the load-time
  run times out on a different test — two symptoms of one platform-cost problem.
- **GREEN:** Name the transient lock set and bound it; give the heavy test its real budget.
- **AUDIT:** Both failures reproduced (chain and isolated); the retry's narrow code set and 250 ms
  budget are quoted at `refresh-safety.test.ts:47`.
- **ADVERSARIAL:** Does a longer budget hide a genuine hang? The test's work is deterministic
  (10,001 entries), it passes alone, and the failure mode is a timeout with partial output — not a
  stall. Teardown retries remain bounded at 2 s, after which they still throw, so a real lock
  failure is reported rather than swallowed.
- **CHANGE DELTA:** One fixture helper extracted, one code set widened, one budget added.

### Missed Questions

1. **Why did the chain and the isolated run fail differently?** Because the underlying problem is
   OS timing, so which symptom appears depends on machine load — the fix must address both.
2. **Was the failing test caused by the concurrent `-024` work?** No: the file lives in another
   workspace and imports nothing this session touched; it fails on the committed tree too.
3. **Should the heavy test be made cheaper instead?** The 10,001-entry cap is the thing under test
   (the enumeration bound), so the budget moves rather than the fixture.

### Code Verification Evidence

- [x] `packages/knowledge-graph/src/__tests__/refresh-safety.test.ts:43` — `retryTransient`;
      called at `:79` (unlink) and `:81` (rmdir).
- [x] `:200` — the explicit budget beside the test it protects.
- [x] Gate output: the file 15 PASS in isolation; `typecheck packages/knowledge-graph` exit 0;
      `quality` PASS.
- [x] FID status reflects the implementation: `converged` until the commit lands (G2).

## Resolution

- **Closed Date:** 2026-10-13 21:35
- **Fix Description:** teardown retries the full Windows transient lock set under a bounded budget;
  the fabricated-enumeration test carries an explicit budget.
- **Tests Added:** none — assertions untouched.
- **Verification Evidence:** `bun test src/__tests__/refresh-safety.test.ts` 15 PASS / 0 FAIL on
  three consecutive runs; the root chain's knowledge-graph leg 76 PASS / 0 FAIL (3.1 s, previously
  11.98 s with `error: script "test" exited with code 1`); declared gates stamped;
  `bun run validate:repository` PASS.
- **Commit SHA:** `2f003aed`
- **Archived:** 2026-10-13 21:35

## Lessons Learned

The same class as `FID-2026-1013-006`, one workspace over: a per-test default written for a fast
platform, plus a retry that enumerated one operating-system error code out of four. A fixture's
tolerance should name the whole set it actually faces, and a test that deliberately fabricates
10,001 entries should not be asked to finish inside a default it cannot meet.
