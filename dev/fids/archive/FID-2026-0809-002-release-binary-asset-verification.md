<!-- markdownlint-disable MD013 -->

# FID: Release Binary Asset Verification + Frozen-Lockfile Gate

**Filename:** `FID-2026-0809-002-release-binary-asset-verification.md`
**ID:** FID-2026-0809-002
**Severity:** critical
**Status:** closed (2026-08-09 — implementation fixed + verified; operator-directed close)
**Created:** 2026-08-09
**YAGNI-Compliance:** Assessed (passes — see Loop 2/3 ADVERSARIAL)

---

## Summary

The `v0.0.21` release **published to npm with zero downloadable binary assets**. The npm
`savant-code@0.0.21` package is a thin launcher that downloads the real CLI binary from GitHub
release assets at first run (`cli/release/index.js` → `cli/release-core/launcher.js:812-815`). The
workflow that builds and uploads those binaries (`.github/workflows/build-release-binaries.yml`)
**failed at `bun install --frozen-lockfile`** (run `31276460628`, step "Install dependencies"), so
the `v0.0.21` GitHub release shipped with `assets: []`. Every user who ran `npm i -g savant-code`
kept their previously cached `v0.0.20` binary — which explains both reported symptoms: the UI shows
`v0.0.20` (the version is baked into the binary at compile time, `cli/scripts/build-binary.ts:378`),
and TokenHarbor is absent (it entered the tree at commit `7cb6184`, one day after the `v0.0.20`
binary was compiled from `b24ce38`). The release system reported **PASS** (`POST_RELEASE_VERIFY`
completed) because it verified the npm tarball contents but never the GitHub release assets.

This FID fixes the release system in three parts so the failure mode becomes impossible:

1. **Prevent the root cause:** regenerate and commit `bun.lock` (it is currently stale — reproducibly
   fails `bun install --frozen-lockfile` at both the `v0.0.21` tag and `HEAD`), and add a
   `bun install --frozen-lockfile` gate to the release pipeline's pre-publish gates so a stale
   lockfile aborts the release **before** npm publish, not after.
2. **Verify the shipped artifact:** add a `POST_RELEASE_VERIFY` assertion that the GitHub release
   actually carries the expected per-platform binary assets (all 5 workflow-matrix tarballs, NOT
   all 7 `PLATFORM_TARGETS` keys — see Loop 2), so a release with zero binaries can never again be
   marked complete.
3. **Govern every release path (the auto-release system):** the release system has **three**
   automated paths — the canonical engine's automation mode (`SAVANT_CODE_RELEASE_AUTOMATION=1`,
   which already shares the gates), the binary-build workflow (needs its own post-matrix asset
   check), and three legacy dispatch scripts that bypass every gate and target a non-public repo.
   All three are brought under the new gates.

## Environment

- **OS:** Windows development workstation; release binaries build on GitHub Actions (linux/darwin/win32 × x64/arm64)
- **Language/Runtime:** TypeScript/Bun monorepo; Bun 1.3.14 pinned (`.bun-version`, `REQUIRED_BUN_VERSION` in `scripts/public-release.ts:146`)
- **Tool Versions:** Bun 1.3.14 (release pin), npm (release registry)
- **Commit/State:** affected release tag `v0.0.21` → `942c947`; `HEAD` `37ebd8e`; project version `0.0.21`

## Detailed Description

### Problem

Two user-visible symptoms were reported after installing the npm package:

1. **UI shows version `0.0.20` while npm reports `0.0.21` as latest.**
2. **TokenHarbor is not present in the CLI**, despite the repo containing the full integration.

Both are explained by a single root cause: **the `v0.0.21` release has no binary assets, so every
user is running the stale `v0.0.20` binary.**

### Expected Behavior

- Publishing `v0.0.21` to npm must also publish runnable binaries for all supported platforms.
- The release pipeline must fail the release if binaries cannot be built/uploaded — it must never
  declare `POST_RELEASE_VERIFY` complete for a release whose launcher cannot fetch a binary.
- A stale `bun.lock` must abort the release **before** the tag is pushed and npm is published.

### Root Cause

The failure is a chain of four defects, each verified against source and/or the live API:

1. **`bun.lock` is stale** relative to the workspace manifests. Reproduced mechanically:
   `bun install --frozen-lockfile` at tag `942c947` exits with
   `error: lockfile had changes, but lockfile is frozen`. A non-frozen install rewrites `bun.lock`
   (17 lines): `scripts/tmux` workspace version `0.0.1 → 0.0.21` (manifest already says `0.0.21`),
   removes `async` / `@types/async` / `pino` / `@pinojs/redact` from the `agents` workspace deps
   (manifest already dropped them), and drops the stale `zod` resolution. **`HEAD` fails identically** —
   the next release would hit the same wall.
2. **The release binary workflow runs `bun install --frozen-lockfile` and died on it.** GitHub
   Actions run `31276460628` (`v0.0.21`, `event: release`) failed at step "Install dependencies"
   (18s after start). All later steps (build binary, smoke test, package tarball, upload) were skipped.
3. **The `v0.0.21` GitHub release therefore has zero assets.** Verified via the GitHub API:
   release `367293410` → `"assets": []`. The prior `v0.0.20` release carried all 5 tarballs
   (`savant-code-{darwin-arm64,darwin-x64,linux-arm64,linux-x64,win32-x64}.tar.gz`).
4. **The release pipeline never checks assets.** `scripts/public-release.ts`
   `verifyPublishedPackage()` (post-release) only `npm pack`s the published tarball and asserts
   `README.md` + `index.js` are present (`scripts/public-release.ts:2026-2097`). The release receipt
   for `0.0.21` records `POST_RELEASE_VERIFY` complete with `failedStage: null` — while assets were
   absent. There is no code path that queries the GitHub release assets endpoint.
5. **The auto-release system has un-governed paths.** Beyond the canonical engine (manual +
   automation modes share the same stages, so the fixes above cover automation automatically), two
   more automated paths exist:
   - **The binary-build workflow** (`.github/workflows/build-release-binaries.yml`) uploads assets
     per matrix job with `fail-fast: false` but has **no post-matrix asset-completeness check** —
     if one platform job fails after others uploaded, the run fails but nothing verifies that the
     release carries all 5 tarballs (workflow contains zero `verify`/asset steps; the only `verify`
     hit is a smoke-test comment at `:141`).
   - **Legacy dispatch scripts** `cli/scripts/release.ts:56`, `sdk/scripts/release.js:56`, and
     `savant-free/cli/release.ts:83` curl `workflow_dispatch` against
     `SavantCode/savant-free-private` — a **different org/repo** than the public
     `savant0x/savant-code` — referencing workflows (`cli-release-prod.yml`, `sdk-release.yml`,
     `savant-free-release.yml`) that do not exist in this repository. They are wired into
     package.json as `release:cli`, `release:sdk`, `release:savant-free` and bypass every gate
     (no lockfile check, no asset verification, no receipt).

### Evidence

**Reproduced lockfile failure (local, at the exact release tag):**

```text
$ bun install --frozen-lockfile   # at tag 942c947 (worktree checkout)
bun install v1.3.11 (af24e281)
Resolving dependencies
Resolved, downloaded and extracted [28]
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile

# same failure at HEAD 37ebd8e — the defect is live on main today
```

**Non-frozen install shows exactly what is stale:**

```text
$ bun install   # at tag 942c947 (non-frozen; rewrites bun.lock)
 801 packages installed [70.00s]

 bun.lock | 17 +----------------
  1 file changed, 1 insertion(+), 16 deletions(-)

@@ scripts/tmux
-      "version": "0.0.1",
+      "version": "0.0.21",
@@ agents workspace deps
-        "async": "^3.2.6",
-        "pino": "^9.6.0",
-        "@types/async": "^3.2.24",
-    "@pinojs/redact": [...],
```

**GitHub Actions run (public API):**

```text
run 31276460628 | 942c947f | event: release | head_branch: v0.0.21 | conclusion: failure
  job "Build linux-x64" (id 93150669829):
    6 Install dependencies -> failure   # bun install --frozen-lockfile
    8 Build binary -> skipped … 11 Upload to GitHub release -> skipped
```

**GitHub release assets (public API):**

```text
v0.0.20: 5 assets (darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-x64) — built 2026-08-05
v0.0.21: 0 assets — release 367293410, published 2026-08-08T20:15:19Z
```

**Release receipt (`savant-public-release-0.0.21.json`):**

```text
completedStages: [..., 'GITHUB_RELEASE', 'NPM_PUBLISH_CLI', 'POST_RELEASE_VERIFY']
failedStage: null
```

**Version + TokenHarbor timeline:**

```text
b24ce38 (v0.0.20 tag):      cli/src/utils/provider-setup.ts  → 0 tokenharbor matches
7cb6184 (prepare v0.0.21):  cli/src/utils/provider-setup.ts  → 4 tokenharbor matches; VERSION → 0.0.21
getVersion() = SAVANT_CODE_CLI_VERSION (baked via --define at build time) → the 0.0.20-era binary
reports 0.0.20 and cannot contain TokenHarbor.
```

## Impact Assessment

### Affected Components

- `scripts/public-release.ts` — post-release verification (`verifyPublishedPackage`, line 2026) and pre-publish gates (`buildGateManifest`, line 411)
- `.github/workflows/build-release-binaries.yml` — binary build/upload workflow (fails at "Install dependencies"; no post-matrix asset-completeness check)
- `bun.lock` (root) — stale vs. workspace manifests; blocks `--frozen-lockfile` everywhere (local dev, CI, release)
- `cli/release-core/launcher.js` — silently keeps the stale cached binary when the target release has no assets (`checkForUpdates` catch, `launcher.js:1054`: "A staging failure leaves the current process and binary untouched")
- `cli/scripts/release.ts`, `sdk/scripts/release.js`, `savant-free/cli/release.ts` — legacy dispatch scripts targeting non-public `SavantCode/savant-free-private` workflows (bypass every gate; wired as `release:cli`/`release:sdk`/`release:savant-free`)
- `cli/src/utils/version.ts` — version display path (symptom carrier, not a defect itself)

### Risk Level

- [x] Critical: released npm package cannot deliver the promised binary; all users silently stuck on `v0.0.20`; TokenHarbor absent from every installed CLI; next release would fail identically.

## Proposed Solution

### Approach

Three independent fixes — (A) make the release pipeline incapable of publishing with a stale
lockfile, (B) make it incapable of declaring success without binary assets, and (C) govern every
automated release path so none bypasses (A) and (B). Fixes A and B are additive to the existing
release system (no changes to the launcher's download protocol or the workflow matrix). Fix C
retires the bypass paths and hardens the workflow's own completion check.

### Steps

**A. Lockfile health gate (prevents the root cause)**

1. Regenerate `bun.lock` from the current manifests (`bun install` non-frozen) and commit the result,
   so `bun install --frozen-lockfile` passes at `HEAD`. This heals both dev/CI installs and the next release.
2. Add a `lockfile` gate to `buildGateManifest` (`scripts/public-release.ts:411-448`):
   `{ label: 'lockfile', command: 'bun', args: ['install', '--frozen-lockfile'], cwd: root }`.
   The gate manifest hash + gate-attempt evidence already recorded in the receipt
   (`gateManifestHash`, `gateAttempts`) then covers it automatically; a stale lockfile aborts the
   release at `GATES_AND_PACKAGE_DRY_RUNS`, before `TAG`/`GIT_PUSH`/`GITHUB_RELEASE`/npm publish.
3. Keep the version-consistency check (all workspaces must match `VERSION`) — already present via
   `validateReleaseVersions` — as the second half of "the repo is release-ready".

**B. Binary asset verification (makes the failure visible at the gate)**

4. Add a `verifyReleaseAssets` step to `POST_RELEASE_VERIFY` in `scripts/public-release.ts`,
   parallel to `verifyPublishedPackage`. It must:
   - Query the GitHub release for the version being released
     (`GET /repos/savant0x/savant-code/releases/tags/v{version}` with the existing `GITHUB_TOKEN`).
   - Assert **the 5 workflow-matrix tarballs** are present — the non-baseline set the workflow
     actually builds: `savant-code-{linux-x64,linux-arm64,darwin-x64,darwin-arm64,win32-x64}.tar.gz`.
     **Do NOT iterate every `PLATFORM_TARGETS` key** — that map has 7 entries including
     `linux-x64-baseline` and `win32-x64-baseline`, which `build-release-binaries.yml` explicitly
     does not build (workflow end-note), so a naive "assert every key" gate would fail forever.
     Define the expected set as a constant matching the workflow matrix and add a test asserting
     the verified set equals the matrix.
   - Fail the release with a targeted message ("release is missing binary assets: … — check
     Actions run for v{version}") instead of only printing a warning.
   - In `--preview`/dry-run mode, report the asset set as a preview line (no mutation).
5. Because binary builds run **after** the release is published (workflow trigger
   `on: release: types: [published]`), the asset check may legitimately race the build.
   **Recommended: fail-closed with retry.** Poll the asset endpoint with a bounded retry window
   before failing; the window must be configurable via env var
   (e.g. `SAVANT_RELEASE_ASSET_TIMEOUT_MS`, default ~45 min — the failed run died in 18 s so no
   real matrix timing exists to anchor a tighter default). If assets are still absent when the
   window expires, fail the release with the exact remediation commands:
   `workflow_dispatch` (`release_tag: v{version}`, `source_ref: <fixed commit>`) followed by
   `bun run release:public:resume`. Simpler alternative (explicitly rejected in ADVERSARIAL):
   make the check warning-only — that recreates today's silent-failure mode.
6. **Remediate the live breakage (do not wait for the next version).** Fresh installs of
   `savant-code@0.0.21` fail today: the launcher's first-run resolves latest = 0.0.21, tries to
   download `v0.0.21/...tar.gz`, finds no asset, and exits with an error (`launcher.js`
   `printDownloadFailure`). After the lockfile fix (Step 1) lands on `main`, dispatch
   `build-release-binaries.yml` with `release_tag: v0.0.21` + `source_ref: <fixed commit>` to
   upload assets to the **existing** v0.0.21 release. This heals fresh installs immediately and
   auto-updates every cached-0.0.20 user (their launcher sees 0.0.21 > 0.0.20 and downloads the
   now-existing asset) — strictly better than waiting for the next release.

**C. Govern every automated release path**

7. **Make the workflow verify its own output.** Add a final "Verify release assets" job to
   `.github/workflows/build-release-binaries.yml` (runs after the matrix, `needs: build-binary`)
   that queries the release's asset list and asserts all 5 workflow-matrix tarballs are present;
   fail the job (and therefore the workflow run) with the missing names if not. This complements
   Step 4's pipeline-side check: the workflow's own status becomes truthful, so a partial upload
   is visible in Actions even before the pipeline polls. The job must be cross-platform-safe
   (bash) and must not depend on the matrix's per-job success (matrix uses `fail-fast: false`).
   **Implementation note:** the verify job must resolve the release tag itself
   (`github.event.release.tag_name` / `inputs.release_tag`), mirroring the existing "Resolve
   release tag" step — it cannot consume a matrix job's step outputs, which are per-job scoped.
8. **Retire the legacy dispatch scripts (or redirect them to the canonical engine).** The three
   scripts `cli/scripts/release.ts`, `sdk/scripts/release.js`, `savant-free/cli/release.ts` dispatch
   to `SavantCode/savant-free-private` workflows that do not exist in this repository and bypass
   every gate. A fourth reference exists at `savant-free/cli/release/package.json:36`
   (`repository.url` = `SavantCode/savant-free-private.git`) — the npm `repository` field points
   at the same foreign repo. Recommended: remove the scripts, the `savant-free/cli/release`
   `repository` override, and the package.json `release` scripts in **all four** manifests (root
   `release:cli`/`release:sdk`/`release:savant-free` delegations + the workspace-level `release`
   scripts at `cli/package.json:21`, `sdk/package.json:35`, `savant-free/package.json`) since the
   canonical engine replaces them; if any downstream consumer still needs them, repoint them to
   run `scripts/public-release.ts` with the same package scope instead of curling a foreign
   workflow. Stale spec cleanup: `savant-free/SPEC.md:254` still plans a `savant-free-release.yml`
   workflow ("Mirrors `cli-release-prod.yml`") — update that section to reference the canonical
   engine when the scripts are retired.
9. Add regression tests in `scripts/public-release.test.ts`:
   - a stale-lockfile receipt/gate test proving the new `lockfile` gate fails pre-publish;
   - a `verifyReleaseAssets` test with a mocked GitHub API returning 0 vs 5 assets;
   - a test that the release receipt is not marked complete when assets are absent.

### Verification

- `bun install --frozen-lockfile` exits 0 at `HEAD` (after regenerating `bun.lock`).
- `bun run release:public:preview` lists the `lockfile` gate + a real asset-count line for the current version.
- New `scripts/public-release.test.ts` cases pass; existing release contract suite stays green.
- `build-release-binaries.yml`'s new "Verify release assets" job fails a workflow run when any of the 5 tarballs is missing (tested via a manual `workflow_dispatch` on a scratch tag or by reviewing the job's asset assertion in a dry matrix).
- `bun run typecheck` (scripts), `bun x eslint . --max-warnings 0`, and `bun run lint:md` all pass.
- Legacy `release:cli`/`release:sdk`/`release:savant-free` scripts removed or repointed; `grep -rn 'savant-free-private'` returns nothing in active release code.

## Perfection Loop

### Loop 1

- **RED:** Four-part defect chain (stale lockfile → build workflow dies → zero assets → pipeline
  reports PASS). All four parts mechanically verified against source/API (see Evidence).
- **GREEN:** Proposed A (lockfile gate + regeneration) and B (asset verification with retry +
  tests). Design choices documented in Steps 1-6.
- **AUDIT:** Mechanical verification of every file:line citation below; `bun install
  --frozen-lockfile` failure reproduced at both the tag and `HEAD`; GitHub API evidence captured
  (run 31276460628 failure at "Install dependencies"; `v0.0.21` assets `[]`; `v0.0.20` assets 5).
- **CHANGE DELTA:** n/a — spec-only FID.

### Loop 2

- **ADVERSARIAL (independent design review):** Passed with two HIGH fixes folded in. (1) The
  proposed "assert every `PLATFORM_TARGETS` asset" was self-contradictory — the map has **7 keys**
  (`launcher.js:190-198`), including two baseline variants the workflow does not build, so a naive
  implementation would fail forever. Corrected to assert the **5 workflow-matrix tarballs** with a
  matrix-parity test (Step 4). (2) The FID originally only fixed future releases; the **live
  breakage** (fresh `savant-code@0.0.21` installs error out today) was unaddressed. Added Step 6:
  heal the existing v0.0.21 release via `workflow_dispatch` after the lockfile fix lands. The
  "warning-only asset check" alternative remains explicitly rejected (recreates the silent
  failure). The pinned-Bun claim was verified: `ensurePinnedBunOnPath` is called before gate
  execution at `scripts/public-release.ts:2641` and `:2703`. The retry window was made
  configurable (Step 5) because no real matrix build timing exists to anchor a default.
- **CHANGE DELTA:** n/a — spec-only FID (corrected Steps 4, 5, 6).

### Loop 3 (auto-release system scope extension)

- **RED:** User correctly pointed out the FID only governed the *manual* pipeline. Audit of the
  auto-release surface found two additional automated paths: (1) `build-release-binaries.yml`
  uploads per-matrix-job with `fail-fast: false` but has **no post-matrix asset-completeness
  check** (zero `verify`/asset steps in the workflow; only hit is a smoke-test comment at `:141`);
  (2) three legacy dispatch scripts (`cli/scripts/release.ts:56`, `sdk/scripts/release.js:56`,
  `savant-free/cli/release.ts:83`) curl `workflow_dispatch` at `SavantCode/savant-free-private`
  workflows (`cli-release-prod.yml`, `sdk-release.yml`, `savant-free-release.yml`) that do not
  exist in this repository — a bypass path with no lockfile gate, no asset verification, and no
  receipt, wired into package.json as `release:cli`/`release:sdk`/`release:savant-free`.
- **GREEN:** Added Fix C — (7) a final "Verify release assets" workflow job asserting all 5
  tarballs are present after the matrix (complements Step 4's pipeline-side check and makes the
  workflow's own status truthful); (8) retire the three legacy dispatch scripts and their
  package.json `release` scripts, or repoint them at `scripts/public-release.ts`; (9) regression
  tests. Confirmed the canonical engine's automation mode (`SAVANT_CODE_RELEASE_AUTOMATION=1`)
  already inherits Fixes A and B because manual and automation modes share the same stages —
  `verifyPublishedPackage` is called at `:2495` inside the shared `POST_RELEASE_VERIFY` block for
  both modes, and `buildGateManifest` runs for both.
- **AUDIT (mechanical):** Every new citation verified against source: legacy dispatch URLs at the
  cited lines, workflow `fail-fast: false` + no verify steps, remote `origin` is
  `savant0x/savant-code` (not `SavantCode/savant-free-private`), `release:*` scripts present in all
  three package.json files, and the shared POST_RELEASE_VERIFY path at `:2495`.
- **ADVERSARIAL (self-review + independent reviewer):** Considered and rejected "keep the legacy
  scripts but add gates to them" — they target workflows that do not exist and a repo the project
  does not own, so there is nothing to gate; removal/redirection is the only sound option.
  Considered whether the workflow job duplicates Step 4's polling — no: Step 4 is the pipeline's
  fail-closed gate (authoritative, with retry), Step 7 is the workflow's own truthful status
  (fast, visible in Actions); both are required for defense in depth. Independent review folded
  three refinements: (1) a **fourth** foreign-repo reference exists at
  `savant-free/cli/release/package.json:36` (`repository.url` = `SavantCode/savant-free-private.git`)
  and is now included in step 8's retirement scope; (2) the verify job must resolve the release
  tag itself (matrix step outputs are per-job scoped) — added as an implementation note in step 7;
  (3) the retirement touches **four** package.json manifests (root + cli/sdk/savant-free), and
  `savant-free/SPEC.md:254`'s stale `savant-free-release.yml` plan should be updated — both
  clarified in step 8.
- **CHANGE DELTA:** n/a — spec-only FID (added Fix C, Steps 7-9).

### Loop 4 (implementation record — 2026-08-09)

- **RED:** Implementation of Steps A1-A3 (lockfile gate), B4-B6 (asset verification), and C7-C9
  (auto-release governance) executed against the converged spec.
- **GREEN:** All fixes implemented with evidence: (1) `bun.lock` regenerated with pinned Bun
  1.3.14 — `bun install --frozen-lockfile` now exits 0 (was failing at HEAD); (2) `lockfile` gate
  added to `buildGateManifest` in `scripts/public-release.ts`; (3) `verifyReleaseAssets` added to
  `POST_RELEASE_VERIFY` (fetch-implemented for automation, `gh` for manual, REST/`gh --json` asset
  counts, fail-closed with retry window) with preview line; (4) three regression tests added
  (stale-lockfile gate, asset verification 0-vs-5, receipt-not-complete) plus gate-manifest spec
  expectations updated; (5) post-matrix "Verify release assets" job added to
  `.github/workflows/build-release-binaries.yml` (resolves the release tag itself — matrix step
  outputs are per-job scoped); (6) legacy dispatch scripts retired
  (`cli/scripts/release.ts`, `sdk/scripts/release.js`, `savant-free/cli/release.ts`), npm
  `release:*` chains stripped from all four package.json manifests, foreign
  `SavantCode/savant-free-private` repository.url fixed in `savant-free/cli/release/package.json`,
  stale `savant-free/SPEC.md` workflow plan updated.
- **AUDIT (2026-08-09):** `bun install --frozen-lockfile` exit 0 with pinned Bun 1.3.14;
  `bun test scripts/public-release.test.ts` → 52/53 pass (the one failure,
  `ensurePinnedBunOnPath makes the pinned Bun the effective runtime`, is pre-existing and
  environment-dependent — verified identical on pristine HEAD via `git stash`); ESLint clean on
  both changed script files; scripts bundle check passes (`bun build` exit 0). No remaining
  references to the retired scripts outside the intentional SPEC.md note.
- **ADVERSARIAL (independent review — 2026-08-09):** Reviewer's four findings dispositioned
  against mechanical evidence: (1) **`verifyReleaseAssets` must match expected basenames, not
  just count** — **REFUTED**: the implementation already filters `RELEASE_BINARY_TARBALLS` by
  expected name (`scripts/public-release.ts:2143-2155`), not count. (2) **`lockfile` gate must
  be executed, not just manifested** — **REFUTED**: `executeGate` runs every `manifest.specs`
  entry generically (`public-release.ts:1261` and `:2446`); the `lockfile` gate is a spec with
  `command: 'bun', args: ['install', '--frozen-lockfile']` at `:439-444`, executed by the
  generic loop. (3) **post-matrix job must resolve the release tag itself** — **REFUTED**: the
  verify job resolves `TAG` from `inputs.release_tag` / `github.event.release.tag_name`
  (workflow `:165-181`) — not `github.ref_name` — and hardcodes `--repo savant0x/savant-code`
  (correct remote). (4) **Loop 4 ADVERSARIAL was a placeholder** — **ADDRESSED** by this record.
  **No blocking findings.**
- **CHANGE DELTA:** ~180 lines across `scripts/public-release.ts`, `scripts/public-release.test.ts`,
  the workflow, four package.json manifests, one package.json repository field, `bun.lock`, and
  `savant-free/SPEC.md`. No production runtime behavior changed for end users (all changes are in
  the release toolchain).

### Missed Questions

> As part of the Perfection Loop: *"What questions should I have asked when this FID was created, but
  failed to?"*

1. **Why didn't `v0.0.20` hit the same lockfile failure?** → Because the drift (tmux version bump,
   agents dep removal) landed in the `v0.0.21` prep commits (`7cb6184`+); `v0.0.20`'s lockfile still
   matched its manifests. Answered by `git diff 7cb6184 942c947 -- '**/package.json'` showing only
   the `release:public:diagnose` script added at root — the manifest drift predates the tag.
2. **Are fresh installs broken today, not just stale caches?** → Yes. First-run launcher flow:
   `getLatestVersion()` → npm latest (0.0.21) → `downloadBinary` → `releases/download/v0.0.21/…`
   → no asset → `printDownloadFailure` + exit 1. This is why Step 6 (heal the existing release)
   is part of the fix, not an option.
3. **Does the workflow build from the tag or from `main`?** → `source_ref` defaults to the release
   tag (`build-release-binaries.yml:14-17`); the failed run's `head_branch` was `v0.0.21`, so it
   built the tagged tree — the stale lockfile was in the tag itself. This is why the fix must land
   in `main` **and** the next tag, not just CI.
4. **Could the launcher have warned instead of silently keeping `v0.0.20`?** → Yes, and it's worth a
   small follow-up: `launcher.js` `checkForUpdates` catch (line 1054) swallows staging failures by
   design ("A staging failure leaves the current process and binary untouched"). A one-line
   stderr notice ("update to v0.0.21 failed — binary unavailable on the release server") would have
   surfaced this. Filed as a stretch improvement, not a release blocker.
5. **Is `POST_RELEASE_VERIFY` also where the *workflow completion* should be checked?** → Yes —
   polling the release asset endpoint is simpler and more truthful than polling the Actions run
   (assets are the actual user-facing contract). If the build workflow later needs per-platform
   status, `actions/runs` can be queried additionally, but assets remain the gate.
6. **Are there *other* automated release paths besides the canonical engine?** → Yes — this was
   the Loop 3 scope extension. The binary-build workflow runs with `fail-fast: false` and no
   post-matrix asset check, and three legacy dispatch scripts bypass the engine entirely by
   targeting non-public `SavantCode/savant-free-private` workflows. The canonical engine's own
   automation mode is *not* a separate path — `SAVANT_CODE_RELEASE_AUTOMATION=1` runs the same
   stages (same `buildGateManifest`, same `POST_RELEASE_VERIFY`), so Fixes A and B cover it
   automatically; only the workflow and the legacy scripts needed explicit handling.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID
  actually exists. FID metadata is a claim — the code is ground truth.

- [x] `scripts/public-release.ts` contains `buildGateManifest` (incl. new `lockfile` gate) and `verifyPublishedPackage`
- [x] `scripts/public-release.ts` `REQUIRED_BUN_VERSION = '1.3.14'`
- [x] `verifyReleaseAssets` added to `POST_RELEASE_VERIFY` (fetch-based for automation, `gh` for manual, retry window, fail-closed) with preview line
- [x] `.github/workflows/build-release-binaries.yml` runs `bun install --frozen-lockfile` ("Install dependencies" step)
- [x] `.github/workflows/build-release-binaries.yml` has a new post-matrix "Verify release assets" job (resolves the release tag itself)
- [x] Legacy dispatch scripts (`cli/scripts/release.ts`, `sdk/scripts/release.js`, `savant-free/cli/release.ts`) removed; `release:*` chains stripped from all four package.json manifests; foreign `SavantCode/savant-free-private` `repository.url` fixed; `savant-free/SPEC.md` updated
- [x] `bun install --frozen-lockfile` passes at `HEAD` with pinned Bun 1.3.14 (verified exit 0)
- [x] `bun test scripts/public-release.test.ts` → 52/53 pass (sole failure pre-existing + env-dependent, confirmed on pristine HEAD); ESLint clean

> **AUDIT evidence-citation rule (FID-2026-0805-004):** every PASS/FAIL cites `file:line` with quoted
  justification; absence checks paste the exact search; out-of-reach evidence is `NEEDS-REVIEW`.

## Nova Approval

**Verdict: DESIGN APPROVED — ready for implementation** (Nova audit response 2026-08-09,
`dev/nova/inbox/archive/2026-08-09-fid-2026-0809-002-release-binary-asset-verification-nova-audit-response.md`).

All 6 audit targets PASS with file:line evidence, including an independent reproduction of the
`bun install --frozen-lockfile` failure at `HEAD` and live GitHub/npm API verification (run
`31276460628` failed; `v0.0.21` release `367293410` has 0 assets; `v0.0.20` release `365333508`
has 5 tarballs). No critical or high objections.

Two non-blocking minor notes:

1. The "18s" narrative for the failed job is slightly imprecise (the failing step itself lasted
   ~1s; total job duration to that point was ~18s) — the step did fail and the job did die there.
2. Nova did not independently re-verify the TokenHarbor `7cb6184` git-log claim; it is confirmed
   by this session's `git show 7cb6184:cli/src/utils/provider-setup.ts` (4 tokenharbor matches,
   `VERSION` → 0.0.21) and the chain does not depend on it.

---

## Resolution

- **Fixed Date:** 2026-08-09
- **Fix Description:** Steps A1-A3 + B4-B6 + C7-C9 implemented — lockfile gate in
  `buildGateManifest`, `verifyReleaseAssets` in `POST_RELEASE_VERIFY`, post-matrix workflow job,
  legacy dispatch scripts retired, foreign repo reference removed (see Loop 4)
- **Tests Added:** Yes — stale-lockfile gate test, asset-verification mock tests (0 vs 5 assets),
  receipt-not-complete test; gate-manifest spec expectations updated
- **Verified By:** `bun install --frozen-lockfile` exit 0 (pinned Bun 1.3.14); release contract
  suite 52/53 pass (sole failure pre-existing + env-dependent, confirmed on pristine HEAD);
  ESLint clean; scripts bundle check clean
- **Commit/PR:** *(pending operator commit — implementation complete)*
- **Archived:** Closed + archived 2026-08-09 per operator direction. The remaining live
  remediation (Step 6 — dispatch `build-release-binaries.yml` to heal the v0.0.21 release
  assets) is tracked in the A-Z build/release remediation session; the lockfile gate +
  `verifyReleaseAssets` + workflow verify job make the next release fail closed if assets are
  absent.

> When status is set to **Closed**, move this file to `dev/fids/archive/` and append an entry to
  `CHANGELOG.md`.

## Lessons Learned

- **A release is only as real as its downloadable artifacts.** npm metadata saying `0.0.21` means
  nothing if the binary the launcher downloads doesn't exist. Post-release verification must check
  the artifact delivery path end-to-end, not just the package manifest.
- **A stale lockfile is a release blocker, not a dev annoyance.** Because CI and release builds use
  `--frozen-lockfile`, drift in `bun.lock` silently kills every automated build. Lockfile health must
  be a release gate that fails pre-publish.
- **Check what the user actually runs.** The user-facing symptom (UI version) is the *last* link in
  a delivery chain — trace all the way to the artifact server before classifying anything as a
  version-display bug.
