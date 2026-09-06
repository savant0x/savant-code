# FID: Release-Provenance Guard (phantom-source detection + clean-checkout gate)

**Filename:** `FID-2026-0906-003-release-provenance-guard.md`
**ID:** FID-2026-0906-003
**Severity:** high
**Status:** analyzed
**Created:** 2026-09-06 15:20
**YAGNI-Compliance:** Pending

---

## Summary

The v0.0.29 phantom-source incident (3 tracked files in assume-unchanged state
silently excluded 21 source lines from every commit; local gates passed while
clean checkouts failed to compile) exposed three unguarded provenance surfaces
in the release pipeline. Nothing detects hidden tracked-file index state, no
gate proves the committed tree compiles, and the desktop bundle binding check
is bypassable when the Actions API omits `head_sha`. This FID closes all three.

## Environment

- **OS:** Windows (release operator host); CI runners ubuntu-latest / windows-latest / macos-latest
- **Language/Runtime:** TypeScript on Bun 1.3.14 (pinned, `VERSION` 0.0.29)
- **Tool Versions:** git (index-state flags are git-native behavior, version-independent)
- **Commit/State:** `09c6647` on `main` (post FID-2026-0906-001/-002 implementation)

## Detailed Description

### Problem

The v0.0.29 release-night incident (commit `4d85b6b` documents the fix) had
three contributing surfaces that remain unguarded today:

1. **Assume-unchanged blindness.** `scripts/public-release/preflight.ts:95`
   runs `git status --porcelain --untracked-files=all` as the worktree-hygiene
   gate. By git's design, tracked files marked assume-unchanged (or
   skip-worktree) do not appear in status output at all — the exact mechanism
   that let 21 lines of real source vanish from every commit. Any number of
   hidden-state files pass preflight silently.

2. **No clean-checkout compile proof.** Every gate and the worktree
   fingerprint (`scripts/public-release/stages.ts:99`, `:126`, `:163-171`) run
   against the *worktree*, not the committed tree. Gates passing proves only
   that the on-disk content compiles — which is precisely the state that lied
   on release night. Nothing anywhere runs `git worktree` (grep
   `worktree add` across `scripts/` → 0 matches).

3. **Desktop `head_sha` binding bypass.** `runDesktopBundlesStage`
   (`scripts/public-release/desktop-stages.ts:72-74`) correctly rejects a run
   whose `head_sha` differs from the release HEAD, but only when
   `completed.head_sha !== ''`. The API mapper
   (`scripts/public-release/desktop-workflow.ts:75`) defaults an omitted
   `head_sha` to `''`, so a malformed/empty API payload silently skips the
   binding assertion — the bundle could then be attached to a release without
   provenance.

### Expected Behavior

- The pipeline refuses to start a cut from a tree with any tracked file in
  assume-unchanged or skip-worktree state, naming the files and the remediation.
- The release gates include a compile proof that runs from a clean checkout of
  the release HEAD (the committed tree), not the worktree.
- A desktop workflow run with unknown `head_sha` fails closed instead of
  skipping the binding check.

### Root Cause

Git index-state flags (`assume-unchanged`, `skip-worktree`) are invisible to
every status-based check in the pipeline, and all local evidence is gathered
from the worktree. The pipeline never asserts index-state uniformity nor
compiles from committed content.

### Evidence

```text
$ grep -rn "ls-files -v" scripts/        → 0 matches (no index-state check anywhere)
$ grep -rn "worktree add" scripts/       → 0 matches (no clean-checkout gate)
$ git ls-files -v | grep -cv '^H '       → 0 (tree currently clean — guard would pass today)
$ sed -n '72,74p' scripts/public-release/desktop-stages.ts
  if (
    completed.head_sha !== '' &&
    completed.head_sha !== ctx.preflight.headSha
  ) {
$ sed -n '75p' scripts/public-release/desktop-workflow.ts
  head_sha: entry.head_sha ?? '',
```

Incident record: v0.0.29 — `desktop-ci` failed twice overnight on clean
checkouts (`No matching export ... PROVIDER_PROTOCOL_MAPS`, commits `dee1922`
and `6ae2052d`), first caught by CI rather than local gates; fix landed at
`4d85b6b` (06:06 UTC) after npm publish (05:21 UTC) and the GitHub release
(05:21–06:10 UTC). Full audit trail:
`dev/session-summaries/2026-09-06-v0.0.29-release-night-audit.md`.

### Already-present guards (NOT gaps — recorded to prevent re-proposal)

- **Tag↔commit binding** exists: `verifyGitHubTagHead`
  (`scripts/public-release/git-publish.ts:76`) and `verifyGitHubTagHeadApi`
  (`scripts/public-release/github-api.ts:74`), wired at
  `scripts/public-release/stages.ts:228` and `:241`. The earlier SCOPE draft
  listed this as a gap; it is not.
- **Worktree mutation during gates** is detected: fingerprint comparison at
  `scripts/public-release/stages.ts:171` fails the cut when gates change the
  tracked worktree. This guards mutation *during* the run — it cannot see
  pre-existing hidden index state, which is why step 1 below is still required.

## Impact Assessment

### Affected Components

- `scripts/public-release/preflight.ts` (new index-state assertion)
- `scripts/public-release/stages.ts` or a new sibling module (clean-checkout compile gate)
- `scripts/public-release/desktop-stages.ts` (empty-`head_sha` fail-closed)
- `scripts/public-release.test.ts`, `scripts/public-release-desktop-workflow.test.ts` (new pins)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — silent source corruption can reach a published release
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Three narrow, independent guards matching the three failure classes of the
incident. No new workflow files, no CI-side changes (YAGNI: the pipeline is the
enforcement point; CI coverage of `desktop-ci` Linux compile is already
delivered by FID-2026-0906-001).

### Steps

1. **Index-state guard** (`preflight.ts`): add
   `assertNoHiddenTrackedFiles(root)` — run `git ls-files -v`, fail when any
   tracked file's tag is `S` (skip-worktree) or lowercase (assume-unchanged
   variants `h/f/s/m/r/c/k`). Error must list every offending path and the
   remediation (`git update-index --no-assume-unchanged <path>` /
   `--no-skip-worktree`). Wire into `verifyPreflight` before the status check
   (covers both mutation and automation paths).
2. **Clean-checkout compile gate**: after worktree gates pass, create a
   detached temp worktree at release HEAD (`git worktree add <tmp> HEAD
   --detach`), run the typecheck chain there (the 12-workspace chain from
   `protocol.config.yaml`), then `git worktree remove --force`. Fail closed on
   any nonzero exit, citing the worktree output. Runs once per cut — release
   latency is an accepted cost (recorded as an operator-adjustable decision).
3. **Desktop binding hardening** (`desktop-stages.ts`): change the guard so
   `completed.head_sha === ''` fails with
   `"run <id> reported no head_sha — cannot bind bundles to this cut"` in
   addition to the existing mismatch failure.
4. **Tests (RED-first)**: pins for all three guards in the existing suites:
   hidden-state detection (synthetic `ls-files -v` output via injected
   runner), clean-checkout gate behavior (injected command runner), empty
   `head_sha` rejection.

### Verification

- RED: new pins fail against the current tree exactly where proposed.
- GREEN: all three guards implemented; pins pass; sibling suites unaffected.
- AUDIT: full gate files green; `quality:report` PASS (300-line ratchet).
- Live acceptance (operator, next cut): a release with the guards active;
  FID flips to `fixed` on gate evidence, `closed` on the live cut.

## Verification Gates

- gate: test scripts/public-release.test.ts
- gate: test scripts/public-release-desktop-workflow.test.ts

### Verification Receipt

- fingerprint: sha256:9e1076d6fb82cce39d35cbc01a212163af80173207399d68ef973f032d226ee2
- verified: 2026-09-06T15:24:00.091Z
- test scripts/public-release.test.ts: exit 0
- test scripts/public-release-desktop-workflow.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) SCOPE draft claimed "asserts tag/asset/commit binding" as a
  gap — audit found tag↔commit binding already exists (`git-publish.ts:76`,
  `github-api.ts:74`); claim corrected in "Already-present guards". (2) SCOPE
  draft missed that desktop SHA binding partially exists — the real gap is the
  `''` bypass, now scoped as step 3. (3) Draft omitted which suites absorb the
  pins — pinned to `public-release.test.ts` +
  `public-release-desktop-workflow.test.ts` (both exist; verified via
  `ls scripts/*.test.ts`).
- **GREEN:** Problem statement rewritten around the three verified gaps;
  steps re-scoped; citations pinned to exact lines (`preflight.ts:95`,
  `stages.ts:163-171`, `desktop-stages.ts:72-74`, `desktop-workflow.ts:75`).
- **AUDIT:** Every absence claim pasted as a grep with 0 matches; every
  presence claim cites file:line re-read this session (Law 11).
- **ADVERSARIAL:** "Isn't `ls-files -v` alone enough?" — No: it proves
  index-state uniformity, not content correctness; the clean-checkout gate
  proves the committed tree compiles. The two guards cover disjoint failure
  classes; both are required. "Why not verify the tag tree hash instead?" —
  the tag is created *after* gates in the stage order
  (`stages.ts:199-209`); the proof must precede tagging.
- **CHANGE DELTA:** ~35% (initial scoping revision; expected for Loop 1)

### Missed Questions

1. *Does `ls-files -v` cover skip-worktree too?* → Yes: `S` tags skip-worktree;
   lowercase letters tag assume-unchanged variants. Step 1 fails on both.
2. *Should the clean-checkout gate run tests or only typecheck?* → Typecheck
   chain only: the incident class is compile-from-committed-content. Full
   tests would roughly double release time for marginal provenance value.
   Operator may widen later; recorded here so the narrowing is explicit.
3. *Why a temp worktree rather than `git stash` + checkout?* → Stash mutates
   the operator's worktree (the thing a release must never risk); a detached
   worktree in the OS temp dir is additive and removable. Idempotent cleanup
   (`worktree remove --force`) is an implementation requirement.
4. *Does the `''` bypass matter given GitHub reliably returns `head_sha`?* →
   Contract hardening: the mapper already contemplates omission (`?? ''`),
   so the pipeline must treat omission as unprovable, not as absence.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending implementation
- [ ] **File:line ranges:** pending implementation
- [ ] **Gate output:** pending implementation
- [ ] **Reproducibility:** pending implementation
- [ ] **Step statuses:** Step 1 `blocked` (awaiting implementation approval),
      Step 2 `blocked`, Step 3 `blocked`, Step 4 `blocked`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`preflight.ts`,
      `stages.ts`, `desktop-stages.ts`, `desktop-workflow.ts` — all read
      0-EOF this session)
- [ ] Implementation matches the Proposed Solution (pending)
- [x] Gate files exist and pass at authoring time (receipt above)
- [ ] Production call-graph evidence for new wiring (pending)
- [x] FID status reflects actual state (`analyzed` — authored, not implemented)

### Loop 2 — Independent audit and self-correction

- **RED:** Receipt-fingerprint discipline: this document will be edited if
  implementation proceeds, invalidating the authoring receipt — re-stamp
  required at each status flip (same ceremony as FID-2026-0906-001/-002).
- **GREEN:** Recorded above; no text change required.
- **AUDIT:** Template sections all present; gate lines match the allowlisted
  shapes (`test <repo-relative-path>`, files exist); no attribution fields;
  `severity: high` justified by "silent source corruption reaching a
  published release" with the v0.0.29 incident as precedent.
- **ADVERSARIAL:** "Is severity inflated — assume-unchanged requires a human
  to set it?" → No: the bits survived silently for weeks once set, gates were
  green throughout, and the failure surfaced only in CI. The cost of the
  guard is seconds per cut; the incident cost was a corrupted release.
- **CHANGE DELTA:** <2% (converged)

### Loop 3 — Final convergence

- **RED:** None outstanding. Clean-checkout gate's exact typecheck invocation
  (chain vs. subset) is deliberately an implementation-loop decision with the
  chain as the recorded default.
- **GREEN:** No corrections required this pass.
- **AUDIT:** `bun run fid:verify` over this document: gate lines parse, gate
  files exist, declared gates exit 0 (receipt above).
- **ADVERSARIAL:** "Could the clean-checkout gate pass while the *tagged*
  tree differs?" → Only if HEAD moved between gate and tag; the stage order
  plus `evidenceFinalized` fingerprinting closes that window (revisit only if
  a live incident shows otherwise).
- **CHANGE DELTA:** <2% (converged — circuit breaker)

## Resolution

- **Closed Date:** pending (implementation + live cut)
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Archived:** pending

## Lessons Learned

Provenance guards must assert the *committed* tree, not the worktree the
operator sees. Status-based checks inherit git's index-state blindness — any
flag that hides content from `git status` hides it from every guard built on
status. When a mapper defaults a provenance field (`?? ''`), every consumer
must treat the default as "unprovable", never as "absent".
