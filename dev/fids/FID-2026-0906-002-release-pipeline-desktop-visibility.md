# FID: Release Pipeline Desktop-Stage Visibility (loud skips + flag-independent verification)

**Filename:** `FID-2026-0906-002-release-pipeline-desktop-visibility.md`
**ID:** FID-2026-0906-002
**Severity:** high
**Status:** fixed
**Created:** 2026-09-06
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0903-001 (desktop pipeline stages — source of the opt-in
gate), FID-2026-0906-001 (workflow repair — the blockers the skipped stages
would have hit anyway)

---

## Summary

The v0.0.29 pipeline run completed every stage it attempted and reported a
full green release while the desktop stages (`DESKTOP_BUNDLES`,
`DESKTOP_RELEASE`) silently never ran — the `SAVANT_CODE_RELEASE_DESKTOP=1`
opt-in (FID-2026-0903-001) was not set, and no surface a reader checks
(plan output, receipt, verification asserts) said so. Three specific
silent-absence surfaces made a desktop-less release indistinguishable from
a complete one. This FID makes the desktop decision loud and verified in
both modes: the plan always shows it, the receipt always records it, and
`POST_RELEASE_VERIFY` always carries a machine-checked desktop-assets claim
(present and sound when enabled, provably absent when not).

## Environment

- **OS:** Windows 11 host (win32, Git Bash)
- **Runtime:** Bun 1.3.14-pinned
- **Commit/State:** `4d85b6b` (v0.0.29 tag target); receipt
  `savant-public-release-0.0.29.json` (release-receipt/v2) recovered from
  the release host

## Detailed Description

### Problem

A release completed green with desktop absent. The three surfaces that
should have said so:

1. **The plan omits the desktop steps when the flag is unset.**
   `buildPublicReleasePlan` (`. ..`/`scripts/public-release/catalog.ts:197-206`)
   interpolates the desktop plan lines behind `isDesktopPackagingEnabled()`
   — `--preview` and the run log show a step list that reads as complete
   with no desktop gap.
2. **The transaction's flag gate has no else-branch and the receipt never
   records the decision.** `scripts/public-release/transaction.ts:186-193`
   wraps both stage calls in `if (isDesktopPackagingEnabled())` with no
   skip logging; `completedStages` (validated against `RELEASE_STAGES`,
   `scripts/public-release/receipts.ts:69`; stage names at
   `scripts/public-release/fail.ts:46,50`) simply never gains the desktop
   entries. The v0.0.29 receipt's `completedStages` ends at
   `NPM_PUBLISH_CLI` — indistinguishable from "desktop does not exist".
3. **The updater-manifest assert is conditioned on stage completion.**
   `scripts/public-release/stages-verify.ts:67-75` runs
   `fetchUpdaterManifest` + `assertUpdaterManifestShape` only when
   `isStageComplete(receipt, 'DESKTOP_RELEASE')`. Skipped stages mean the
   assert never fires; `verifyReleaseAssets` (the CLI tarballs, the
   v0.0.21 zero-asset regression guard) still passes, so the verify stage
   concludes green.

### Expected Behavior

Every release cut carries an explicit, machine-checkable desktop claim:

- The plan output (`--preview` and live) always includes the desktop lines
  — active when enabled, marked `SKIPPED — SAVANT_CODE_RELEASE_DESKTOP not
  set` when not.
- The receipt records the desktop decision (`completed` or `skipped` +
  reason) so a post-mortem reads it without external knowledge.
- `POST_RELEASE_VERIFY` verifies desktop assets in both modes: manifest
  present and structurally sound when the stages ran; `latest.json`
  provably absent from the release when they did not (mirroring the
  fail-closed philosophy of `verifyReleaseAssets` for the CLI surface).

### Root Cause

The opt-in was designed to let the first integrated cut fail safely
(FID-2026-0903-001 Missed Questions 3 explicitly deferred the default-flip
decision), but "fail safely" was implemented as "fail silently by
absence": no plan line, no receipt record, no else-branch, and a verify
assert coupled to stage completion instead of the release contract. The
FID's live-validation step (Step 5, still open) assumed the flag would be
set; nothing enforced or surfaced that assumption.

### Evidence

- Receipt (recovered 2026-09-06 from the release host):
  `"completedStages": ["AUTHENTICATION","PREFLIGHT","CONFIRMATION",
  "PUBLIC_PROFILE","GATES_AND_PACKAGE_DRY_RUNS","TAG","GIT_PUSH",
  "BACKUP_BUNDLE","GITHUB_RELEASE","NPM_PUBLISH_CLI"]` — no desktop
  entries, no skip record.
- `scripts/public-release/catalog.ts:197-206` (plan interpolation behind
  the flag), `:219-222` (`isDesktopPackagingEnabled` reads
  `env.SAVANT_CODE_RELEASE_DESKTOP === '1'`).
- `scripts/public-release/transaction.ts:186-193` (both stage calls gated,
  no else-branch).
- `scripts/public-release/stages-verify.ts:67-75` (manifest assert gated on
  `isStageComplete(receipt, 'DESKTOP_RELEASE')`).
- `gh release view v0.0.29 --json assets` → exactly the 5 CLI tarballs, no
  desktop bundles, no `latest.json`.
- `scripts/public-release/desktop-stages.ts:43` — the stages themselves
  already refuse to run without the flag; the silence is upstream of them.

## Impact Assessment

### Affected Components

- `scripts/public-release/catalog.ts` — receipt type + plan lines
- `scripts/public-release/transaction.ts` — skip logging + receipt field
- `scripts/public-release/stages-verify.ts` — flag-independent desktop claim
- `scripts/public-release-desktop.test.ts`,
  `scripts/public-release.test.ts`,
  `scripts/public-release-receipts.test.ts` — pins for all of the above
- `scripts/public-release/redaction.ts` — reviewed only (new receipt field
  is a boolean + flag name; non-secret)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

A whole product surface can be silently omitted from any release; the only
workaround is manually diffing release assets against expectations after
the fact (which is exactly what happened).

## Proposed Solution

### Approach

1. **Plan always shows the desktop decision.** `buildPublicReleasePlan`
   emits the two desktop lines unconditionally: the active form when the
   flag is set, and `Dispatch desktop-release.yml for v<version>
   (SKIPPED — SAVANT_CODE_RELEASE_DESKTOP not set)` / the matching
   attach line when not. `--preview` stops being able to imply completeness.
2. **Receipt records the decision.** Add an optional field to the
   `release-receipt/v2` type (catalog.ts) — `desktopStagesSkipped?: true`
   plus the reason string — written by the transaction when the flag is
   unset. Additive and backward-compatible: `validateResumeReceipt` is
   untouched for existing receipts; the redaction surface is unaffected
   (no secret material).
3. **Loud skip in the live run.** The transaction's flag gate gains an
   else-branch that prints a prominent block (the desktop stages are
   SKIPPED and the release ships without desktop bundles) before
   continuing — a human watching the release log cannot miss it.
4. **Flag-independent POST_RELEASE_VERIFY.** Replace the
   `isStageComplete('DESKTOP_RELEASE')` condition with:
   - flag enabled → `fetchUpdaterManifest` + `assertUpdaterManifestShape`
     (unchanged asserts; the stages necessarily ran);
   - flag disabled → assert `latest.json` is **absent** from the release
     (fetch fails with the not-found shape the manifest fetch already
     classifies) and the receipt carries `desktopStagesSkipped` — a
     verified absence claim instead of an unverified gap.
5. **Tests pin all four surfaces** (plan lines both modes, receipt field
   round-trip, warn block, verify branch both modes) before the source
   changes (RED-first).

### Steps

1. [x] RED: plan-pin rewritten to the always-visible contract + 7 new
       pins (skip helper, 5 claim branches, receipt round-trip) — failed
       RED-first (module-load failure on the missing export; 1 plan-pin
       fail)
2. [x] GREEN: implemented Approach 1-4 (catalog.ts, desktop-stages.ts,
       transaction.ts, stages-verify.ts)
3. [x] AUDIT: 46/0 across the 5 gate files; 44/0 parity across the 10
       untouched siblings; live `release:public --preview` shows the three
       SKIPPED lines (exit 0); quality:report PASS
4. [x] Plan-text surface folded (catalog.ts plan lines carry the SKIPPED
       form; no README scope — operator-directed only)
5. [ ] Live validation on the next release cut — the receipt and plan
       output show the desktop decision in whichever mode runs; close —
       **`blocked` (the cut itself)**

### Verification

- Static: gates below green; `bun run release:public --preview` shows the
  SKIPPED form with the flag unset and the active form with it set.
- Live: next cut's receipt carries either the desktop stage names or
  `desktopStagesSkipped` — never neither.

## Verification Gates

- gate: test scripts/public-release-desktop.test.ts
- gate: test scripts/public-release-desktop-claim.test.ts
- gate: test scripts/public-release-desktop-manifest.test.ts
- gate: test scripts/public-release.test.ts
- gate: test scripts/public-release-receipts.test.ts

### Verification Receipt

- fingerprint: sha256:d7e64afb1e02a1bb3c2bb36481b36f9fe7f7fb18b30df089f41f6cbf79e466b0
- verified: 2026-09-06T18:39:23.129Z
- test scripts/public-release-desktop.test.ts: exit 0
- test scripts/public-release-desktop-claim.test.ts: exit 0
- test scripts/public-release-desktop-manifest.test.ts: exit 0
- test scripts/public-release.test.ts: exit 0
- test scripts/public-release-receipts.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the three silent-absence surfaces cataloged with file:line
  evidence; the v0.0.29 receipt quoted; the release-asset inspection
  (gh release view) confirming desktop absence post-release.
- **GREEN (document convergence):** approach settled on the four-surface
  fix; skip pseudo-stages in `completedStages` rejected (would corrupt the
  executed-stages contract validated at `receipts.ts:69`) in favor of an
  additive receipt field; absence-assert chosen over "fail the release
  when desktop is skipped" (Missed Questions 3).
- **AUDIT (tool-evidenced):**
  - V1 PASS — all four citations re-verified this session:
    `catalog.ts:197-206,219-222`; `transaction.ts:186-193`;
    `stages-verify.ts:67-75`; `fail.ts:46,50`; `receipts.ts:69`;
    `desktop-stages.ts:43`.
  - V2 PASS — receipt schema location: `catalog.ts` carries the
    `release-receipt/v2` type (`schemaVersion?: 'release-receipt/v2'`,
    `receiptPath: string`); the additive field lands there.
  - V3 FAIL → corrected: the first draft asserted "the pipeline treats
    unexecuted-optional stages as not-failed" as if the transaction had an
    explicit skip mechanism; ground truth is simpler and worse — there is
    no skip mechanism at all, just an unadorned `if` with no else
    (`transaction.ts:186-193`). Wording corrected throughout.
  - V4 NOTE — `fetchUpdaterManifest`'s not-found classification must be
    confirmed at implementation (RED step) before the absence-assert
    reuses it; if it treats 404 as a throw rather than a classified
    result, the absence branch needs its own probe. Marked as an
    implementation-time verification, not an assumption.
  - V5 PASS — redaction review: the new field is a boolean + flag name;
    no secret material; no redaction change required.
- **ADVERSARIAL:** "a console warning is not enforcement" — counter: the
  warning is the human surface only; the machine surfaces are the receipt
  field (post-mortem queryable) and the verify-stage absence assert
  (release-blocking). The three layers are independent. "Make desktop
  mandatory (no flag at all)" — counter: the flag is the documented escape
  hatch (a secret incident must not block a CLI-only hotfix cut); removing
  it converts one failure mode into a stricter one. Loud recording is the
  honest middle. "Generalize to all conditional stages" — counter:
  desktop is the only proven silent-absence instance; generalization is
  YAGNI until a second appears (recorded, not built).
- **CHANGE DELTA:** initial authoring (Loop 1 converged in-document; audit
  correction V3 folded before first presentation).

### Missed Questions

1. *Skip markers inside `completedStages` instead of a new field?* → No.
   `completedStages` means executed stages (validated against
   `RELEASE_STAGES` at `receipts.ts:69`); a SKIPPED pseudo-entry would
   corrupt that contract and leak into resume logic
   (`isStageComplete`). The additive field keeps both meanings clean.
2. *Flip the flag default to on while here?* → Out of scope; FID-2026-0903-001
   records the default-flip as an explicit operator decision. This FID
   makes whichever mode runs loud and verified; the operator decides the
   default separately (and FID-2026-0906-001 must land first — a default-on
   desktop stage would have aborted the v0.0.29 cut on the secret).
3. *Should a skipped desktop surface fail the release?* → No (v1). The
   flag exists precisely to permit desktop-less cuts; making absence fatal
   removes the operator's escape hatch. The combination of loud plan line
   + receipt field + absence assert is the honest middle.
4. *Does the absence assert break historical releases?* → No:
   POST_RELEASE_VERIFY runs only on new cuts; old releases are never
   re-verified by the pipeline.
5. *Redaction implications of the new receipt field?* → None: boolean +
   fixed flag-name string, no secret material (V5). The receipts suite
   pins the round-trip either way.
6. *Does the resume path need changes?* → No: `validateResumeReceipt`
   validates stage names, not the new field; an old receipt without it
   remains loadable, and a skipped-then-resumed run re-evaluates the flag
   live (the same contract the stages already use via
   `assertEnabled`).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `e6f44d80` (feat(release): loud desktop-stage skips
      + flag-independent updater verification — 8 files, 699 insertions)
- [x] **File:line ranges:** `scripts/public-release/catalog.ts:69-78`
      (receipt fields `desktopStagesSkipped`/`desktopStagesSkipReason`),
      `:205-215` (unconditional plan lines — SKIPPED form when the flag
      is unset); `scripts/public-release/desktop-stages.ts:44-54`
      (`DESKTOP_SKIP_REASON` + `recordDesktopStagesSkipped`);
      `scripts/public-release/transaction.ts:186-202` (stale-skip clear
      on flag-on resume + loud skip block + record inside the restoration
      guard); `scripts/public-release/stages-verify.ts:22-69`
      (`verifyDesktopUpdaterClaim` — enabled branch reuses the existing
      manifest asserts, disabled branch: 404 → proven absence recorded,
      ok → claim-mismatch fail-closed, other → unverifiable fail-closed),
      `:120` (call site replacing the `isStageComplete` gate);
      `scripts/public-release-desktop.test.ts` (plan pins both modes +
      skip-helper pin), `scripts/public-release-desktop-claim.test.ts`
      (new, 5 branch pins), `scripts/public-release-receipts.test.ts`
      (round-trip pin)
- [x] **Gate output:** gate battery 46 pass / 0 fail (5 files);
      sibling parity 44/0 (10 files); live preview smoke exit 0 with the
      SKIPPED lines visible; quality:report PASS (1467 baselined files);
      lint:md exit 0
- [x] **Reproducibility:** `bun run release:public --preview | grep
      SKIPPED` shows the three lines; `bun test
      scripts/public-release-desktop-claim.test.ts` green; `grep -n
      "desktopStagesSkipped" scripts/public-release/catalog.ts` → line 75
- [x] **Step statuses:** Steps 1-4 `implemented` (output above); Step 5
      `blocked` (requires the next release cut — recorded, not silently
      deferred)
- [ ] **Archived:** (set when moved to `dev/fids/archive/`)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (catalog.ts,
      transaction.ts, stages-verify.ts, desktop-stages.ts, the test files
      — all on disk; `public-release-desktop-claim.test.ts` created this
      session)
- [x] Evidence citations verified at the cited lines this session (V1)
- [x] V4 boundary discharged at implementation: `fetchUpdaterManifest`
      calls `fail()` on any non-ok response (`desktop-manifest.ts:104-108`),
      so the absence branch uses its own raw probe instead
- [x] Typecheck/tests/lint pass with pasted tool output (46/0 battery +
      44/0 parity + preview smoke + quality:report PASS + lint:md 0)
- [x] Production call-graph evidence — `verifyDesktopUpdaterClaim` is
      called from the POST_RELEASE_VERIFY stage body (`stages-verify.ts:120`)
      and `recordDesktopStagesSkipped` from the transaction guard
      (`transaction.ts:199`) — both reachable from the production
      entrypoint, pinned by tests
- [x] FID status reflects the actual implementation state — `fixed`
      (implementation exists, gates green; closure awaits the live cut)

### Loop 2 — Independent audit and self-correction

- **RED:** none remaining in-document; the one live boundary (V4) is
  pinned as an implementation-time verification.
- **GREEN:** no corrections — re-read of the final document found no
  unevidenced PASS claims; V3's correction is reflected in Problem item 2
  and Root Cause.
- **AUDIT:** re-verified the changed-surface citations against the working
  tree — unchanged; the receipt quote matches the recovered file.
- **ADVERSARIAL:** STANDS. The loop boundary holds: no source edits inside
  the loop; Steps 1-4 are implementation scope.
- **CHANGE DELTA:** <2% (convergence — no further passes warranted).

### Loop 3 — Structural verification (pre-implementation)

- **RED:** none in-document — `bun run fid:verify --check` passed live
  (all four shared gates exit 0, receipt summary stamped
  2026-09-06T14:29:52.547Z).
- **GREEN:** no corrections; the V4 boundary (manifest-fetch not-found
  classification) remains the implementation-time RED verification.
- **AUDIT:** citations re-confirmed on the current tree
  (`transaction.ts:186,191`; `stages-verify.ts:73`).
- **ADVERSARIAL:** STANDS — structural pass + citation re-confirmation.
- **CHANGE DELTA:** 0% (no document change).

### Loop 4 — Implementation audit (post-GREEN)

- **RED:** implementation surfaced three findings folded in: (1) V4
  discharged — `fetchUpdaterManifest` fails on ANY non-ok status, so the
  absence branch required its own raw 404 probe (implemented);
  (2) resume semantics hardened beyond the original plan — a pre-002
  receipt gets the skip recorded live at verify time, and a flag-on
  resume clears a stale skip record (two guards, both pinned);
  (3) the test additions pushed `public-release-desktop.test.ts` to 379
  lines — split to 265 + a new 136-line claim file (quality ratchet
  holds, `quality:report` PASS).
- **GREEN:** none — all three findings were resolved in the same pass.
- **AUDIT:** gate battery 46/0 (5 files, incl. the new claim file);
  sibling parity 44/0 (10 untouched files); live `--preview` smoke shows
  the three SKIPPED lines (the exact v0.0.29 silence, now loud);
  quality:report PASS; lint:md 0. Receipt stamped via `fid:verify
  --write`.
- **ADVERSARIAL:** "the absence assert could false-positive on a private
  repo 404 (auth vs. missing)" → counter: the release repo is public
  (`PUBLIC_REPOSITORY_SLUG`, the manifest URL is the public redirect the
  updater itself uses); a non-404 auth failure lands in the unverifiable
  fail-closed branch, and 404 on a public asset URL is absence. "The
  skip record could go stale if the operator re-runs with the flag" →
  counter: the flag-on guard clears it, and the verify-time clear makes
  the terminal receipt correct even for a resumed pre-002 receipt.
- **CHANGE DELTA:** document +~20% (implementation evidence folded in;
  document-only change, code untouched).

## Resolution

- (closure condition: the next **pipeline release cut** demonstrates the
  loud desktop decision in the receipt. Closure is a live-cut ceremony —
  operator-held — per the same rule as the v0.0.29 FIDs.)
- **Live dual-branch preview proof (2026-09-06, post-run-7):** with the
  flag **unset**, `bun run release:public:preview` prints all three
  desktop lines as `SKIPPED — SAVANT_CODE_RELEASE_DESKTOP not set` (exit
  0) — the exact decision that was invisible on v0.0.29 night. With
  `SAVANT_CODE_RELEASE_DESKTOP=1`, the same preview prints the three
  active desktop stages (dispatch-and-watch, attach, verify manifest at
  the per-release URL) with no SKIPPED lines. The scratch-run pipeline
  does not exercise the full receipt path (no npm publish occurred), so
  the receipt field's live cut remains the closure condition.

## Lessons Learned

- **An opt-in flag needs a loud both-ways record.** A feature gate that
  defaults off must leave evidence of the skipped path in every surface a
  reader trusts — plan output, receipts, and verification — or "not
  attempted" becomes indistinguishable from "not needed".
- **Verification asserts must be conditioned on the contract, not on
  implementation progress.** Gating an assert on `isStageComplete` means
  the assert inherits the stage's skip; conditioning on the release
  contract (desktop enabled or not) keeps the claim true in both modes.
- **Receipts are post-mortem artifacts.** The v0.0.29 receipt read as a
  complete release because absence leaves no trace; a receipt should be
  interpretable months later without the release-night context.
