# FID: Desktop Packaging Integration into the Automatic Release Pipeline

**Filename:** `FID-2026-0903-001-desktop-packaging-auto-release-integration.md`
**ID:** FID-2026-0903-001
**Severity:** high
**Status:** fixed
**Created:** 2026-09-03
**Parent:** FID-2026-0820-011 (closed 2026-09-03 — this FID succeeds its release-time remainder)

## Summary

The desktop packaging release-time checklist (FID-2026-0820-011 Loop 4,
items 2–6) was executed as a one-off local ceremony on 2026-09-03 and its
code-side surface (signing env, workflow prebuild, console fix, signed
bundles, manifest both-ways) is proven. The operator directive of
2026-09-03: the project runs a **completely automatic release system**
(`scripts/public-release.ts` + `release:public{,:preview,:resume,:diagnose}`),
and desktop packaging **must be added to it for the next release** — so the
desktop bundles, updater manifest, and draft-release promotion become stages
of the canonical pipeline instead of a separate manual `desktop-release.yml`
dispatch.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); CI: GitHub Actions
  (windows-latest / ubuntu-latest / macos-latest)
- **Runtime:** Bun 1.3.14-pinned (`REQUIRED_BUN_VERSION` in
  `scripts/public-release.ts`); tauri-cli 2.11.4; Rust 1.97.1
- **Pipeline:** `scripts/public-release.ts` — staged
  (`PREFLIGHT → GATES_AND_PACKAGE_DRY_RUNS → TAG → GIT_PUSH →
  GITHUB_RELEASE → npm publishes → POST_RELEASE_VERIFY`), receipt-driven
  (`release-receipt/v2`, `completedStages`), fail-closed with gate
  transcripts, `--preview/--resume/--diagnose`, automation mode with
  token-safe push env
- **Desktop release surface:** `.github/workflows/desktop-release.yml`
  (dispatch-based, `desktop-updater-signing` environment, matrix
  nsis+msi / appimage+deb, fail-closed `generate-latest-json.ts`)

## Detailed Description

### Problem

Desktop packaging currently ships through a **separate** workflow
(`desktop-release.yml`) that the operator dispatches by hand with
`gh workflow run`. The canonical release path (`bun run release:public`)
cuts CLI/SDK releases — tags main, creates the GitHub Release with the
CHANGELOG section, publishes npm packages, verifies assets — but knows
nothing about desktop bundles. Consequence: every release requires a
remembered, manual second ceremony, and the updater channel (`latest.json`)
can drift from the CLI release it semantically belongs to.

### Expected Behavior

`bun run release:public` (and `--preview`) for version N produces the CLI/SDK
release **and** the desktop bundles as first-class pipeline stages: desktop
artifacts build from the tagged commit, are verified fail-closed, and are
attached to the same GitHub Release (or an explicitly recorded companion
tag), with `latest.json` published from pipeline-verified artifacts. Resume
semantics cover the new stages; the receipt records them.

### Root Cause

Historical sequencing: the packaging FID (0820-011) was authored as a
standalone dispatch workflow (2026-08-26) before the integration requirement
existed; the operator re-homed the remainder into the automatic system on
2026-09-03.

### Evidence

- Pipeline stages + receipt contract: `scripts/public-release.ts`
  (`buildPublicReleasePlan`, `RELEASE_STAGES`, `isStageComplete`,
  `validateResumeReceipt`) — read 0-EOF 2026-09-03
- Desktop workflow contract verified live 2026-09-03: signed `tauri build
  --bundles msi,nsis` exit 0, `.sig` sidecars, `generate-latest-json.ts`
  fail-closed (exit 1 Windows-only) and positive (valid 2-platform
  manifest) — FID-2026-0820-011 Loop 6 (archived)
- Environment secret `desktop-updater-signing` created 2026-09-03 (both
  secret names verified present)

## Impact Assessment

### Affected Components

- `scripts/public-release.ts` (+ tests) — new stages, plan text, resume
  validation
- `.github/workflows/desktop-release.yml` — becomes callable from the
  pipeline (`gh workflow run` with the cut's tag) or is superseded by
  in-pipeline `tauri build` steps (decide at RED)
- `desktop/scripts/generate-latest-json.ts` — reused as the stage's
  fail-closed verifier
- `dev/fids/` ledger + CHANGELOG at closure

### Risk Level

Medium: touches the release critical path. Mitigated by the pipeline's
existing fail-closed gate/transcript machinery and `--preview` dry runs.

## Proposed Solution

### Approach

Re-home the Loop 4 checklist into the pipeline as explicit stages, reusing
the workflow's proven contract rather than duplicating it:

1. **`DESKTOP_BUNDLES` stage** (after `GIT_PUSH`, before `GITHUB_RELEASE`):
   dispatch `desktop-release.yml` with `release_tag = v<version>` (the cut's
   tag, v-prefixed — matches the pipeline's tag format `v${version}` at
   `public-release.ts:325` AND the GitHub asset URL base
   `releases/download/<tag>/…`) and `source_ref = <tag>` (or omitted; the
   workflow defaults it to `release_tag`); poll the run; download artifacts;
   run `generate-latest-json.ts` against them as the fail-closed assertion.
   (Alternative evaluated at RED: run `tauri build` per-platform in-pipeline
   — rejected for v1: pipeline runs on one host; the workflow matrix already
   solves cross-platform.)
2. **`GITHUB_RELEASE` extension:** upload desktop artifacts + `latest.json`
   to the release being created; `prerelease: true` until checklist item 3
   (installer smoke) passes, then manual promotion per missed-Q3.
3. **`POST_RELEASE_VERIFY` extension:** assert `latest.json` resolvable at
   the pinned updater endpoint (first success closes the smoke's
   `302 → 404` era).
4. **Resume/plan/receipt updates:** stage names registered in
   `RELEASE_STAGES`; `buildPublicReleasePlan` extended; receipt schema
   untouched (`completedStages` absorbs the new names); `--preview` prints
   the desktop stages without executing.

### Steps

1. [ ] RED: baseline tests for stage registration + plan text + resume
       validation with the new stages (all fail)
2. [ ] GREEN: implement stage 1 (dispatch + poll + download + fail-closed
       manifest check) behind `SAVANT_CODE_RELEASE_DESKTOP=1` opt-in for
       the first cut — INCLUDING the workflow amendment required by Loop 1
       AUDIT finding V2: the `generate-latest-json` step must derive the
       bare version from the tag (strip the `v` prefix) because the
       generator's `VERSION_PATTERN` rejects `v`-prefixed input while the
       asset URLs need the v-tag verbatim
3. [ ] GREEN: extend GITHUB_RELEASE upload + POST_RELEASE_VERIFY endpoint
       assertion
4. [ ] AUDIT: full `--preview` on the next cut candidate; resume drill by
       killing mid-`DESKTOP_BUNDLES`
5. [ ] First live validation on the NEXT release cut (operator timed the
       directive 2026-09-03: "we're not releasing right now")

### Verification

- Static: `bun test scripts/public-release.test.ts` extended and green;
  `--preview` output shows the new stages
- Live: first cut with `SAVANT_CODE_RELEASE_DESKTOP=1` produces bundles +
  `latest.json` attached to the release; updater check succeeds on next
  installed-app launch

## Verification Gates

- gate: test scripts/public-release-desktop.test.ts
- gate: test scripts/public-release-desktop-manifest.test.ts
- gate: test scripts/public-release-desktop-workflow.test.ts
- gate: test scripts/public-release.test.ts
- gate: test scripts/public-release-backup-stage.test.ts
- gate: test scripts/public-release-receipts.test.ts
- gate: test scripts/git-bundle-backup.test.ts

### Verification Receipt

- fingerprint: sha256:18d96a8b79092ea67f6498defde55d4f635848fa1004636e9aa6330a8c4685ae
- verified: 2026-09-06T02:27:07.811Z
- test scripts/public-release-desktop.test.ts: exit 0
- test scripts/public-release-desktop-manifest.test.ts: exit 0
- test scripts/public-release-desktop-workflow.test.ts: exit 0
- test scripts/public-release.test.ts: exit 0
- test scripts/public-release-backup-stage.test.ts: exit 0
- test scripts/public-release-receipts.test.ts: exit 0
- test scripts/git-bundle-backup.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED (2026-09-03)

- FID created at ceremony time; implementation explicitly deferred to the
  next release cycle per operator directive ("we're not releasing right
  now, we have more work to do"). Ground truth captured: pipeline read
  (stages/receipt/resume contract), desktop workflow contract proven live
  same day. Status `analyzed` honestly — no receipt until GREEN/AUDIT
  converge.
- **GREEN (document convergence, 2026-09-03):** record completed to the
  template contract — `### Missed Questions`, `### Code Verification
  Evidence`, `## Resolution` added (they were missing; the ledger's
  `REQUIRED_HEADINGS` check is unconditional for active FIDs but
  `fid:verify --check` only scans fixed/verified, which is why the gap
  went unflagged — recorded as scan-gap V4 below).
- **AUDIT (2026-09-03, tool-evidenced):** every citation re-verified
  against the code:
  - V1 PASS — pipeline symbols exist as cited: `buildPublicReleasePlan`
    (`public-release.ts:316`), `RELEASE_STAGES` (:188), `isStageComplete`
    (:562), `validateResumeReceipt` (:598), `REQUIRED_BUN_VERSION` =
    '1.3.14' (:186), receipt `release-receipt/v2` + `completedStages`
    (:81/:85).
  - V2 FAIL → corrected: the original dispatch contract ("release_tag
    stripped of `v`") was wrong and the workflow is internally
    inconsistent. Evidence: pipeline tags `v${version}`
    (`public-release.ts:325`); the workflow passes `release_tag` verbatim
    into the asset base-download-url (needs the v-tag), while
    `generate-latest-json.ts` `VERSION_PATTERN` (`^\d+\.\d+\.\d+…`,
    :34) rejects v-prefixed `--version`. Dispatching v-prefixed →
    generator throws; dispatching stripped → every manifest URL 404s.
    Resolution recorded: dispatch `release_tag = v<version>`; the
    workflow's manifest step must strip the `v` before `--version`
    (added to step 2's GREEN scope — implementation, not loop, work).
  - V3 PASS — `scripts/public-release.test.ts` exists; gate
    `test scripts/public-release.test.ts` matches sibling precedent
    (FID-2026-0824-019:111). The previously declared `typecheck scripts`
    gate referenced a workspace absent from `VALIDATION_WORKSPACE_POLICY`
    (`scripts/validation-manifest.ts:22-62`) — gate removed.
  - V4 NOTE — `fid:verify --check` scans only fixed/verified FIDs, so an
    `analyzed` FID with missing required headings passes silently. The
    structural gap in this record is fixed; the scan-coverage question
    (should --check enforce headings for analyzed too?) is routed to the
    ratchet HOLD backlog, not acted on here.
- **ADVERSARIAL (2026-09-03):** STANDS WITH CORRECTIONS. Re-audit of the
  audit: V2 is evidence-backed (three file:line citations, no inference
  gaps) and its correction narrows no boundary — it fixes a contract that
  would have broken the first live cut either way it was dispatched. The
  loop boundary is respected: the workflow `v`-strip amendment is recorded
  as step-2 implementation scope, NOT executed inside the loop. No
  unevidenced PASS claims remain; the one FAIL (V2) is corrected in-document.
- **CHANGE DELTA:** Approach step 1 dispatch contract corrected; step 2
  scope extended (workflow v-strip); `typecheck scripts` gate removed;
  Missed Questions / Code Verification Evidence / Resolution sections
  added; this loop record.

### Missed Questions

1. Which tag format does `DESKTOP_BUNDLES` dispatch with — `v<version>` or
   bare? → **(resolved Loop 1 AUDIT V2)** `v<version>`, always: the tag is
   the pipeline's own `v${version}` and the asset URLs derive from it. The
   bare version is a workflow-internal derivation (`--version` strips `v`),
   never a dispatch input.
2. Who promotes the prerelease after installer smoke? → The operator
   (missed-Q3 of the predecessor FID, unchanged): the pipeline ships
   `prerelease: true`; promotion is a human decision after item-3 smoke.
3. Does the `SAVANT_CODE_RELEASE_DESKTOP=1` opt-in ever default on? → Not
   decided here; the flag exists so the first integrated cut can fail
   safely. Flipping the default is an explicit operator decision recorded
   in this FID when taken.

## Gate provenance

Gates re-declared 2026-09-05 at implementation (the original single gate
predated the decomposition-era suite layout; the original
`test scripts/public-release.test.ts` line is retained above). Live-cut
evidence (bundles + `latest.json` attached to the release, updater
endpoint resolving) is recorded at closure per the original plan.

## Implementation-audit corrections (Loop 2, 2026-09-05)

1. **Stage split around an UNCHANGED GITHUB_RELEASE.** The original
   approach extended GITHUB_RELEASE with asset upload; the decomposed
   pipeline (FID-007) preserves that body verbatim and the release must
   EXIST before `gh release upload`. Corrected: `DESKTOP_BUNDLES`
   (dispatch desktop-release.yml with `release_tag=v<version>`, watch the
   run fail-closed) sits after `BACKUP_BUNDLE` (FID-009) and before
   `GITHUB_RELEASE`; `DESKTOP_RELEASE` (locate run, download artifacts,
   re-run the fail-closed generator, `gh release upload --clobber`) sits
   after the npm publishes, before `POST_RELEASE_VERIFY`. GITHUB_RELEASE
   itself is not modified.
2. **Updater-endpoint assert targets the per-release URL, not the
   `releases/latest` redirect.** `releases/latest/download/latest.json`
   (tauri.conf.json:46-48) excludes prereleases, and the pipeline ships
   `prerelease: true` until the operator's installer smoke — asserting it
   in-pipeline would fail every integrated cut. POST_RELEASE_VERIFY
   asserts `releases/download/v<version>/latest.json` (asset-existence +
   structural checks: version match, exact platform key set, non-empty
   signatures, correct URL base). The pinned-endpoint check moves to the
   operator's post-promotion smoke, where it belongs temporally.
3. **Workflow v-strip (Loop 1 V2) lands with this work:** the
   `latest-json` job derives the bare X.Y.Z from `inputs.release_tag`
   (strip `v`) before `--version`, because the generator's
   `VERSION_PATTERN` rejects v-prefixed input while artifact URLs need
   the v-tag verbatim. Verified live in the workflow file 2026-09-05.
4. **Resume run-location is re-derived, never persisted:** the receipt
   schema stays frozen (`completedStages` absorbs the new stage names);
   `DESKTOP_RELEASE` re-locates the successful workflow run for the tag
   via the Actions run list and fails closed on ambiguity with the exact
   remediation commands. Artifacts land in a deterministic
   per-version temp directory so a mid-stage crash resumes cleanly.

### Code Verification Evidence

Planning/convergence-phase record: implementation is deliberately deferred
to the next release cut (operator directive 2026-09-03), so runtime
verification evidence is intentionally pending. Static verification
completed at Loop 1 AUDIT (2026-09-03, tool-evidenced — see loop record):
pipeline symbols verified at `scripts/public-release.ts:186,188,316,562,598,81-85`;
workflow dispatch inputs `release_tag`/`source_ref` verified at
`.github/workflows/desktop-release.yml:11-18`; manifest generator version
contract verified at `desktop/scripts/generate-latest-json.ts:34,106`;
test target `scripts/public-release.test.ts` exists. At closure (after
steps 2–5): unit battery green, `--preview` shows desktop stages, live-cut
evidence (bundles + `latest.json` attached to the release, updater endpoint
resolving) recorded here, gates run and receipt stamped per
FID-2026-0823-009.

## Resolution

- (pending — closes after the first integrated live cut; implementation
  status `fixed` 2026-09-05: stages implemented, 18-test desktop suite
  green, plan/resume/receipt contract pinned, workflow v-strip landed.
  Live evidence per the original plan lands here at closure.)

## Re-Homing Record (from FID-2026-0820-011 Loop 4, archived)

| # | Old checklist item (manual) | New home |
|---|---|---|
| 1 | Secrets in `desktop-updater-signing` | DONE 2026-09-03 (outside pipeline; pipeline asserts presence at PREFLIGHT) |
| 2 | Dispatch desktop-release on scratch tag | → `DESKTOP_BUNDLES` stage (this FID) |
| 3 | Installer smoke + publish promotion | stays operator (missed-Q3); pipeline ships `prerelease: true` |
| 4 | `signtool` verify host+sidecar | → `DESKTOP_BUNDLES` post-build step (workflow) |
| 5 | Updater E2E + malformed-`latest.json` rejection | → `POST_RELEASE_VERIFY` extension (this FID) |
| 6 | Closure ceremony (-011 + masters) | DONE 2026-09-03; this FID is the successor record |
