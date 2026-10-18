# FID: Parallel acceptance readiness — root-guard flake, instrument corrections, lint gate

**Filename:** `FID-2026-1017-012-parallel-acceptance-readiness.md`
**ID:** FID-2026-1017-012
**Severity:** high
**Status:** closed
**Created:** 2026-10-17 22:05
**Automation level:** 3
**YAGNI-Compliance:** Verified — one bounded retry in an existing guard, one
test, corrections to an existing instrument and one lint-exemption entry. No
new module, dependency or service.

---

## Summary

The parallel-worktree acceptance run cannot be repeated cleanly yet. Three
findings from FID-2026-1017-008's live report are repaired here: (1) the
`unsafe-root` guard retries once when the git process could not run at all,
while still refusing any root git actually reports as different; (2) the A–Z
instrument is corrected for the four divergences its own run recorded, so it is
executable as written; (3) the mandatory Markdown gate is unblocked by
exempting a paste-ready draft that is not repository documentation. The lane is
then prepped (stale branch removed, blueprint stashed) and the work pushed.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** Git 2.52
- **Commit/State:** `main` at `39dd95f9`

## Detailed Description

### Problem

1. **Root guard.** In the live run, `safeHostRoot` refused 3 of the 18 lifecycle
   calls that reached the service with `unsafe-root`, although the same root
   passed 20/20 direct `list` calls and 200/200 direct `git rev-parse` spawns.
   The guard cannot distinguish "git reported a different root" from "the git
   process never ran" (`status: null` from a spawn failure or the 60 s timeout).
   Both produce the same refusal, so the failure cannot name itself and a
   transient spawn failure takes down the whole lifecycle.
2. **Instrument drift.** The A–Z prompt still encodes four divergences its own
   run recorded: it expects an untracked blueprint to be permitted while the
   merge gate forbids untracked files; it expects the service's `invalid-input`
   refusal although the tool schema refuses malformed ids first; it expects
   dispose to carry no warning although the git-fallback recovery is a
   legitimate warning; and it assumes the FID record is committed without
   noting that `/dev` is gitignored and needs a force-add.
3. **Lint gate.** `bun run lint:md` exits 1 on
   `dev/test-prompts/dark-factory-yt-script.md`, an untracked paste-ready draft
   with long spoken lines. The pre-push hook runs this gate, so no commit can be
   pushed while it fails.

### Expected Behavior

- A root that git confirms is accepted even if the first spawn failed; a root
  git reports as different, or a git invocation that exits non-zero, is still
  refused. The retry is bounded at one and never applies to a real refusal.
- The A–Z instrument's preconditions and expectations match the code and the
  gates it exercises.
- `bun run lint:md` exits 0 without suppressing a documentation defect: the
  exempted file is a paste-ready payload, the same class the config already
  exempts (`dev/test-prompts/*-deep-research-prompt.md`, `dev/operator/**`).

### Root Cause

- The guard collapses `status === null` (spawn failure/timeout) and `status !== 0`
  (git ran and refused) into one boolean.
- The instrument was written before the run and never revised against its
  observed divergences.
- The lint configuration predates the untracked draft; the draft is not in the
  repository, so it is not governed documentation.

### Evidence

```text
FID-2026-1017-008 report, §6.8 BLOCKER-1: 3 of the 18 live lifecycle calls
that reached the service were refused `unsafe-root`; not reproducible
out-of-process; the only leg that can return false without throwing is the
`git rev-parse --show-toplevel` comparison, which requires `status === 0`.

FID-2026-1017-008 report, §6.1: D1 (§2 committed-record check), D2 (schema
refusal before service refusal), D5 (dispose warning), D8 (§2 permits the
untracked blueprint while §5.13 requires a clean tree).

$ bun run lint:md
dev/test-prompts/dark-factory-yt-script.md:3:121 error MD013/line-length …
error: script "lint:md" exited with code 1
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts`
- `packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts`
- `dev/test-prompts/az-parallel-worktrees-live-test.md`
- `.markdownlintignore`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: the lifecycle is intermittently refused and no push can pass the
      mandatory gate
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

1. Split "could not run" from "ran and refused": retry the `rev-parse` once only
   when `status === null`; keep every non-zero status and every different-root
   result a refusal. Export `safeHostRoot` with an injected runner so the
   behaviour is pinned without spawning.
2. Correct the instrument's §2 baseline/precondition, §5.2 expectation, §5.17c
   warning expectation, §5.4 path-form note and §9 cleanup line.
3. Add a narrow `.markdownlintignore` entry for the paste-ready script class,
   with the same justification style as the existing exemptions.

### Steps

1. Harden the root guard and export it for injection. — implemented
2. Add the five-case root-guard test (accepted, transient retry, two spawn
   failures, wrong root, git refusal). — implemented
3. Correct the A–Z instrument. — implemented (§2 baseline + tracked-record
   check, §5.2 schema-first refusal, §5.4 path form, §5.17c recovery warning,
   §9 restore line)
4. Add the lint exemption. — implemented
5. Prep the lane: delete the contained stale branch and stash the blueprint;
   record both. — implemented (`3d24daf9` deleted, blueprint stashed,
   SHA-256 `bf6075224adee1f51f82d601e0145082dd3ae2f8057f8f081f370b35ac9a91a9`)
6. Run the declared gates, commit and push through the unmodified hook. —
   implemented

### Verification

The root-guard test must show: a matching root accepted; a first-call
`status: null` retried and accepted; two nulls refused; a different root
refused; a non-zero status refused. The instrument corrections must leave no
contradiction between §2 and §5.13. `bun run lint:md` must exit 0 and
`bun run validate:repository` must PASS.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts
- gate: probe scripts/probes/fid-worktrees.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:4f88cff0be64b767b75b1522262b32372b3e12da7a55236eb6e17d2b7c2b5d44
- verified: 2026-10-18T01:10:30.363Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts: exit 0
- probe scripts/probes/fid-worktrees.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The guard cannot distinguish no-spawn from wrong-root; the instrument
  contradicts the merge gate; the lint gate is red on an unshipped draft.
- **GREEN:** Bounded retry with an injected runner; instrument corrections; a
  narrow exemption justified by the existing class.
- **AUDIT:** The retry path requires a successful `rev-parse` whose output
  matches the root. A wrong root still fails the comparison; a non-zero status
  still returns null immediately.
- **ADVERSARIAL:** Retrying a spawn failure does not weaken fail-closed
  behaviour: the retry cannot accept anything the first call could not prove,
  and it costs one extra spawn only in the failure case.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. Could the flake be a different leg (realpath/`.git` check)? Yes; the report
   labels its hypothesis unproven. This change removes one indistinguishable
   failure mode and adds no new acceptance path, so it is safe either way.
2. Why not retry every failure? A non-zero status is a real answer ("not a
   repository"); retrying it only delays a correct refusal.
3. Is the lint exemption a suppression? No: the file is not in the repository
   and is not documentation; the config already exempts the same paste-ready
   class, and the exemption is one narrow glob with its reason recorded.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `4f989510`
- [x] **File:line ranges:**
      `packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts:38-70`
      (retry + exported guard);
      `packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts:38-78`
      (five-case test); `dev/test-prompts/az-parallel-worktrees-live-test.md`
      lines 74, 86, 135, 137, 161 and the §9 cleanup line;
      `.markdownlintignore` final entry
- [x] **Gate output:** stamped below — agent-runtime typecheck exit 0, tool
      suite 7/7, provision suite, lane probe and quality all exit 0
- [x] **Reproducibility:** `grep -n "resolveGitTopLevel" packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts`
- [x] **Step statuses:** Steps 1–6 implemented

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence: `runFidWorktreeAction` calls
      `safeHostRoot` on every non-`list` action
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** An exported predicate could be misused with an arbitrary runner.
- **GREEN:** The runner parameter is optional and defaults to the production
  runner; only the test passes a double.
- **AUDIT:** The five-case test runs the real filesystem checks against a temp
  checkout.
- **ADVERSARIAL:** The instrument corrections are documentation; they cannot
  make the run pass, only make its steps executable.
- **CHANGE DELTA:** Minor.

### Loop 3 — Final convergence

- **RED:** Residual risk: the flake may still occur on a different leg.
- **GREEN:** The re-run will now either succeed or name the refusal; if it
  recurs, the report's environment section records it.
- **AUDIT:** Full tool suite and probe.
- **ADVERSARIAL:** No throughput, sandbox or scheduling claim is made.
- **CHANGE DELTA:** Converged.

## Resolution

- **Closed Date:** 2026-10-17 22:25
- **Fix Description:** `resolveGitTopLevel` retries once only for `status: null`
  (the process could not run) and immediately returns null for any non-zero
  status; `safeHostRoot` is exported with an injected runner so the five cases
  are pinned. The A–Z instrument now requires an empty baseline, documents the
  force-add for the gitignored FID record, expects the schema refusal at §5.2,
  accepts the dispose recovery warning, and notes the mixed-separator path. A
  narrow `.markdownlintignore` entry exempts the paste-ready video draft.
- **Tests Added:** Yes — five-case root-guard test in
  `fid-worktree-tool.test.ts` (matching root, transient retry, bounded retry,
  different root, non-zero status).
- **Verification Evidence:** `fid:verify --write` ran 5/5 declared gates with
  exit 0 (agent-runtime typecheck, tool suite 7/7, provision suite 5/5, lane
  probe, quality). ESLint `--max-warnings 0` exit 0; `bun run lint:md` exit 0;
  `bun run validate:repository` PASS.
- **Lane prep:** `savant/FID-2026-1017-008` deleted (was `3d24daf9`, contained
  in main); blueprint stashed at SHA-256
  `bf6075224adee1f51f82d601e0145082dd3ae2f8057f8f081f370b35ac9a91a9`, restore
  with `git stash pop`.
- **Archived:** 2026-10-17 22:25

## Lessons Learned

A guard that returns one boolean for several failure modes cannot be diagnosed
from its refusal. Retry only the mode that proves nothing, and give the mode a
name in code even when the UI message must stay stable for the instrument.
