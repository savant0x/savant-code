# Session Summary: 2026-10-06 22:33

**Session ID:** 2026-10-06-2233-law15-split-baseline
**Duration:** 2026-10-06 ~19:40 — 2026-10-06 22:33
**Status:** completed

---

## Initial State

### Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Branch:** `main`
- **Last Commit:** `43f436b0` — docs(fids): record the FID-2026-1006-003 closure

### Known Issues

- The single open implementation item was T153 / `FID-2026-1006-004`: the Law 15 worktree
  backstop refuses its own baseline on a repository this size, so out-of-band mutations go
  unverifiable for the life of the session.
- The working tree carried pre-existing changes not made by this session (`SCOPE.md`,
  `dev/fids/README.md`, `dev/experiences/raw-traces.jsonl` modified; the FID plus four other
  untracked paths), and the agent-runtime suite is red on HEAD outside this area — 76 failing
  tests in `run-agent-step` / `web_search` / hook-event files (see Verification limits).
- `bun run validate:repository` was RED: `vendored.tree.foreign-root` for untracked
  `.ohmyagent/`.

### Dependencies

- git (present), bun 1.3.14, no external services required; nothing installed.

---

## Planned Work

1. [x] Run the remaining Perfection Loop passes (Loop 3 + adversarial) on `FID-2026-1006-004`.
2. [x] Implement the record's ten steps.
3. [x] Write the pins P1-P10 (plus the moved pin) and the extended fixtures.
4. [x] Run every declared gate and paste the evidence.
5. [x] Update the durable records (FID, SCOPE.md, the FID index, this summary).
6. [ ] Closure + archive — blocked on operator G2 commit authority.

---

## Work Completed

### Task 1: Law 15 split-baseline implementation (T153 / `FID-2026-1006-004`)

- **Status:** completed (verified; closure withheld pending G2)
- **FIDs Created:** `dev/fids/FID-2026-1006-004-law15-capture-budget-refusal.md` (status
  `analyzed` → `verified`)
- **Changes Made:**
  - `packages/agent-runtime/src/echo/enforcement/worktree-git.ts` (new, 192 lines): the two
    git enumeration helpers, `CAPTURE_BUDGET_MS` / `RECONCILE_BUDGET_MS`, the pure
    `isSpuriousTimeout` predicate and the retry-once `runGitSpawn` policy, plus
    `describeGitFailure` (step 6).
  - `packages/agent-runtime/src/echo/enforcement/worktree-scan.ts` (new, 216 lines):
    `resolveCandidates` (the status leg with the bounded-walk fallback) and the
    change-bounded deletion source `collectDeletions` / `dropBaselineKeys` (step 4).
  - `packages/agent-runtime/src/echo/enforcement/worktree-capture.ts` (271 lines): git mode
    inventories every path and content-hashes only the initially-dirty set; walk mode keeps
    full-inventory hashing; the refusal names its leg (`worktreeBaselineFailure`); the pure
    `shouldRetryCapture` predicate gates a bounded recapture (steps 1, 2, 7).
  - `packages/agent-runtime/src/echo/enforcement/worktree-reconcile.ts` (294 lines): coverage
    is the in-memory union of the inventory and the map keys; the candidate fallback keeps
    HEAD's exact expression; the unknown rule counts walk-sourced, hash-less candidates as
    `unexamined`; the deletion terms run through `worktree-scan`; `budgetMs` is injectable
    (steps 3, 5, 8, 9).
  - `common/src/types/session-state-records.ts` (293 lines): `worktreeBaselinePaths`,
    `worktreeBaselineFailure`, `worktreeBaselineRetries`, and the restated `skipped` /
    `dirtyPaths` contracts.
  - `packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts`: the moved pin, its
    new contract stated in the test.
  - `packages/agent-runtime/src/echo/__tests__/worktree-reconcile-fixtures.ts`: the fixture
    surface extended to N clean / M dirty / nested-directory repos.
  - `packages/agent-runtime/src/echo/__tests__/worktree-capture-scale.test.ts` (new, 258
    lines): P1, P2, P6, P9, P10 and the transport round trip.
  - `packages/agent-runtime/src/echo/__tests__/worktree-reconcile-deletion.test.ts` (new, 181
    lines): P3, P4, P5, P7, P8.
  - `sdk/src/__tests__/run-state-serialization.test.ts`: step 10 through the real
    `serializeRunState` / `deserializeRunState` transport.
  - `.gitignore`: one entry for `.ohmyagent/` (the in-pass `validate:repository` fix).
  - `SCOPE.md`, `dev/fids/README.md`: T153's state and the index entry.
- **Verification:** `bun run fid:verify <record> --check` 10/10 exit 0; 39 tests / 0 fail
  across the five declared agent-runtime gates (24 pre-existing + 15 new); sdk suite 8/0;
  `typecheck` common / packages/agent-runtime / sdk exit 0; `bunx eslint --max-warnings 0`
  exit 0 on all ten changed files; `prettier --check` clean; `quality: PASS (1498 baselined
  files)`; `validate:repository` PASS; `scope-register-check` PASS (0 issues).
- **Live probe** (`dev/scratchpad/active/law15-split-baseline-probe.ts`, gitignored): capture
  244-254 ms with 18 content hashes over a 5,464-path inventory (pre-fix 956-1,128 ms over
  5,454 hashes); reconcile 110-114 ms `degraded: false` (pre-fix 289-344 ms with a 5,459-stat
  deletion leg); durable checkpoint 301,304 B against a 663,482 B pre-split equivalent.

---

## Issues Discovered

### Issue 1: `.ohmyagent/` untracked foreign root

- **Severity:** low
- **FID:** none — an in-pass fix, completed in the same pass per "NOTHING IS EVER OUT OF SCOPE"
- **Status:** resolved
- **Detail:** `validate:repository` refused the tree with `vendored.tree.foreign-root`: a
  top-level `.ohmyagent/` with one 4-line `settings.json` and no tracked files, i.e. another
  agent CLI's local state. Fixed with one ignore entry following the existing
  `.commandcode/` precedent (automation level 3); the gate returns PASS. Recorded in
  `SCOPE.md` as a completion note rather than an open box, because a completed item does not
  belong in the register.

### Issue 2: the deletion source needed a fourth term

- **Severity:** high (caught before it shipped)
- **FID:** `FID-2026-1006-004` (Loop 3 adversarial pass A)
- **Status:** resolved
- **Detail:** the plan's three deletion terms leave a regression in walk mode — a walked
  inventory minus a walked candidate set was the pre-split net, and no term covered it. Term
  (iv) (a walk-scope set difference, guarded by `isWalkVisible` so a tracked path under
  `resources/` cannot be falsely reported) closes it; P5 pins the false-positive direction.

### Issue 3: pre-existing agent-runtime suite failures on HEAD

- **Severity:** medium (unrelated to this work, not fixed here)
- **FID:** none
- **Status:** open
- **Detail:** the whole-workspace run reports 1759 pass / 76 fail across
  `run-agent-step` (set_output), `web_search`, and the hook-event loop suites. The declaration
  gates for this record are file-scoped and green; the broad failures reproduce on an
  unmodified tree and are recorded as an observation, not as this session's regression.

---

## Perfection Loop Summary

| Loop | Target                          | RED                                                              | GREEN                                                                                     | AUDIT                                        | Delta |
| ---- | ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- | ----- |
| 1    | FID `-1006-004` (document)      | defect catalogued with measured evidence                          | proposed solution, six design amendments                                                  | Verifier PASS on the figures, NEEDS-REVIEW elsewhere | new   |
| 2    | FID `-1006-004` (document)      | re-measurement refuted two causal claims; a third cause found      | steps 7→10, pins 6→10                                                                     | findings folded in                           | large |
| 3    | FID `-1006-004` (implementation) | the live defect reproduced; two ordering defects found pre-edit    | two new modules, two rewritten, three durable fields                                      | 10/10 gates, 39 tests, live probe            | large |

---

## Validation Results

- [x] `bun run --cwd=common typecheck`: PASS
- [x] `bun run --cwd=packages/agent-runtime typecheck`: PASS
- [x] `bun run --cwd=sdk typecheck`: PASS
- [x] `bun run fid:verify dev/fids/FID-2026-1006-004-… --check`: PASS (10/10)
- [x] declared test gates (5 agent-runtime suites + the sdk leg): PASS (39 + 8 tests, 0 fail)
- [x] `bunx eslint --max-warnings 0` (changed files): PASS (0 warnings)
- [x] `bunx prettier --check` (changed files): PASS
- [x] `bun run quality:report`: PASS (1498 baselined files)
- [x] `bun run validate:repository`: PASS
- [x] `bun run scripts/scope-register-check.ts`: PASS (0 issues)
- [ ] `bun run --cwd=packages/agent-runtime test` (whole workspace): FAIL — 76 pre-existing
      failures unrelated to this change (Issue 3); the declared gates are file-scoped

---

## Final State

### Code Changes

- **Files Modified:** 9 (513 insertions, 263 deletions)
- **Files Created:** 4 production/test modules (847 lines) + the 852-line FID + the gitignored probe
- **Net Change:** +1,360 lines of tracked content against 263 removed

### Git Status

- **Branch:** `main`
- **Uncommitted Changes:** yes — everything from this session, by design (G2 withheld)
- **New Commits:** none

---

## Open Questions

- Should the 5,464-path inventory be compressed on the wire (a shared prefix table, or a
  per-directory manifest) if checkpoint writes become hot? Measured today at 297 KB of a
  301 KB checkpoint — smaller than the pre-split map, but still the largest field in it.
- Is `walk-budget` worth a deterministic pin? Reaching it needs a budget that lets the walk
  enumerate but not hash, which today can only be forced with wall-clock timing.

---

## Lessons Learned

- The plan's own vocabulary can hide a class: "three deletion terms" was a coverage claim, and
  the expensive loop it replaced had a fourth net with no term. Read the removed mechanism
  line by line before deleting it.
- A budget in the wrong place names the wrong leg: deciding which failure wins at a spent
  budget is part of naming the failure honestly, not a detail of control flow.
- Durable state has a size budget too — the split adds an inventory and still shrinks the
  checkpoint by ~55% (301 KB against 663 KB); the intuitive direction was wrong, and only
  measurement settled it.

---

## Next Session

### Priority Tasks

1. [x] Operator G2: commit the verified tree path-scoped, flip the record to `closed`, archive
       it to `dev/fids/archive/`, and add the CHANGELOG entry. — **Completed 2026-10-06** in
       the follow-on segment; see
       `dev/session-summaries/2026-10-06-2345-law15-closure-and-cache-record.md` and local
       commits `ba38c548` (the change set) and `d7cd1836` (the closure tail).
2. [ ] Consider the whole-workspace agent-runtime failures (Issue 3) as their own item.

### Blockers

- G2 commit authority — reserved to the operator; no commit, push, tag or release was made.

### Notes for Next Agent

- The record is `verified`, not `closed`: `SCOPE.md` T153 stays open (with the blocker named)
  until it moves.
- The live probe is `dev/scratchpad/active/law15-split-baseline-probe.ts` (gitignored) and can
  re-measure the whole path end to end in ~1 s.
