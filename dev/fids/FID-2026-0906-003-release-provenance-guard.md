# FID: Release-Provenance Guard (phantom-source detection + clean-checkout gate)

**Filename:** `FID-2026-0906-003-release-provenance-guard.md`
**ID:** FID-2026-0906-003
**Severity:** high
**Status:** fixed
**Created:** 2026-09-06 15:20
**YAGNI-Compliance:** Verified

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

- fingerprint: sha256:da95c461ed093a233280b4d4563901ce573bc6c986a684a3c181a0590ad6e9c9
- verified: 2026-09-06T20:06:29.353Z
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

- [x] **Commit SHA:** pending live cut (implementation commit recorded in
      the CHANGELOG entry; this field is filled at closure per contract)
- [x] **File:line ranges:** `scripts/public-release/provenance.ts`
      (new module — `HIDDEN_INDEX_TAGS` + `parseGitLsFilesVerbose` +
      `hiddenTrackedFiles`/`hiddenIndexStateMessage`/
      `assertNoHiddenTrackedFiles` + `assertCleanCheckoutCompiles` +
      `assertReleaseHeadCompiles`);
      `scripts/public-release/preflight.ts` (index-state assertion wired
      after the status check, mode-aware fail/warn);
      `scripts/public-release/stages.ts` (clean-checkout compile gate
      before `evidenceFinalized = true`);
      `scripts/public-release/desktop-stages.ts` (empty-`head_sha`
      fail-closed branch); `scripts/public-release-desktop-attach.test.ts`
      + `scripts/public-release-provenance.test.ts` +
      `scripts/public-release-desktop-testkit.ts` (new pins/fixtures)
- [x] **Gate output:** `bun test scripts/public-release-provenance.test.ts`
      → 11 pass / 0 fail; 6-suite pipeline battery → 48 pass / 0 fail;
      `bun run quality:report` → PASS (1467 baselined files) after the
      300-line-ceiling family split; `bun run fid:verify --write` receipt
      below
- [x] **Reproducibility:** `bun -e` running `hiddenTrackedFiles(cwd)` on
      the live tree → 0 hidden files (guard passes on a uniform tree);
      `grep -c "assertNoHiddenTrackedFiles\|assertReleaseHeadCompiles"
      scripts/public-release/preflight.ts scripts/public-release/stages.ts`
      → 1 wired call site each
- [x] **Step statuses:** Step 1 `implemented`, Step 2 `implemented` (with
      the Loop-4 corrections recorded below), Step 3 `implemented`,
      Step 4 `implemented` (RED-first, suites below). Live acceptance
      (status flip `fixed` → `closed`) awaits the next real cut.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`preflight.ts`,
      `stages.ts`, `desktop-stages.ts`, `desktop-workflow.ts` — all read
      0-EOF this session)
- [x] Implementation matches the Proposed Solution (three guards as
      scoped; deviations recorded in Loop 4 — sync contract, dedicated
      provenance suite, `bun install` step added to the worktree sequence)
- [x] Gate files exist and pass at authoring time (receipt above)
- [x] Production call-graph evidence for new wiring:
      `verifyPreflight` calls `hiddenTrackedFiles(root)` before returning
      (both mutation and automation paths re-verify through it —
      `transaction.ts` and `stages.ts:runProfileStage`); `runGatesStage`
      calls `assertReleaseHeadCompiles` immediately before
      `receipt.evidenceFinalized = true`; `runDesktopBundlesStage` fails
      closed on `completed.head_sha === ''` before the mismatch check
- [x] FID status reflects actual state (`fixed` — implemented, gates
      green; `closed` awaits the live cut)

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

### Loop 4 — Implementation audit (post-GREEN)

- **RED:** implementation self-review found three deviations from the
  authored plan, each corrected on evidence: (1) the guards are **sync**
  (`fail()` throws; `verifyPreflight` and `runGatesStage` are sync), so
  the first test draft's async `rejectionOf` helper was wrong — replaced
  with a sync `messageOf` capture; (2) the clean-checkout sequence needs
  `bun install --frozen-lockfile` — a fresh worktree has no
  `node_modules` (gitignored), so the typecheck chain would fail on
  missing dependencies, not on committed-tree drift; (3) the pins landed
  in a dedicated `public-release-provenance.test.ts` plus a desktop
  family split (`-testkit.ts` fixtures + `-attach.test.ts`) because
  `public-release.test.ts` (231 lines) and the desktop stage suite would
  breach the 300-line ceiling the ratchet enforces — caught by
  `quality:report` failing on `desktop-stages`-suite edits, fixed by the
  split; `stages.ts` itself was trimmed back under the ceiling after the
  gate wiring pushed it to 301.
- **GREEN:** none — the `head_sha` hardening kept the original mismatch
  message intact so the existing pin's regex still holds (test-output
  compatibility preserved).
- **AUDIT:** 11/0 provenance suite; 9/0 desktop family (7 stage + 2
  attach); 48/0 across the six pipeline suites; `quality:report` PASS;
  live `hiddenTrackedFiles` run on the operator tree → 0 hidden files
  (guard green on a uniform tree, matching the authoring baseline grep).
- **ADVERSARIAL:** "the index-state guard is redundant with the
  clean-checkout compile gate" → counter: disjoint failure classes — a
  hidden assume-unchanged file's *content* still lands in the worktree
  the compile gate runs from (install/typecheck would pass on the very
  content that will be missing from the commit); only `ls-files -v`
  sees the flag. "`worktree add` in a temp dir could race a parallel
  release" → the pipeline already holds an exclusive release lock for
  the whole transaction; the prune/add/remove sequence is inside it.
- **CHANGE DELTA:** ~10% (document-only updates + the three recorded
  corrections; code scope unchanged vs. the Proposed Solution).

## Resolution

- **Closed Date:** pending (the live cut — a release run with all three
  guards active — flips this to `closed` and archives the FID)
- **Fix Description:** `scripts/public-release/provenance.ts` —
  `git ls-files -v` index-state assertion (`assertNoHiddenTrackedFiles`,
  wired mode-aware into `verifyPreflight` after the status check) +
  clean-checkout compile gate (`assertReleaseHeadCompiles` → detached
  temp worktree at HEAD → `bun install --frozen-lockfile` → the canonical
  typecheck chain → `worktree remove --force` on every path, wired into
  `runGatesStage` before `evidenceFinalized`) + desktop
  `runDesktopBundlesStage` fail-closed on `head_sha === ''` (provenance
  unprovable ≠ mismatch absent)
- **Tests Added:** Yes — `scripts/public-release-provenance.test.ts`
  (11 pins: tag classification, hidden-set contract, remediation exactness,
  git-failure fail-closed, worktree command sequence, compile-failure
  fail-closed + cleanup, worktree-add failure) and
  `scripts/public-release-desktop-attach.test.ts` (empty-`head_sha`
  rejection + the FID-004 flatten layout), RED-first; fixtures split into
  `scripts/public-release-desktop-testkit.ts` for the 300-line ceiling
- **Verification Evidence:** 48 pass / 0 fail across the six pipeline
  suites; `quality:report` PASS; live `hiddenTrackedFiles` on the operator
  tree → 0 hidden files (uniform tree passes; the guard's detection path
  is proven by the pinned synthetic outputs from the incident class)
- **Archived:** pending

## Lessons Learned

Provenance guards must assert the *committed* tree, not the worktree the
operator sees. Status-based checks inherit git's index-state blindness — any
flag that hides content from `git status` hides it from every guard built on
status. When a mapper defaults a provenance field (`?? ''`), every consumer
must treat the default as "unprovable", never as "absent".
