<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0809-002 Release Binary Asset Verification + Frozen-Lockfile Gate (Design Approval)

**Date:** 2026-08-09
**To:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/FID-2026-0809-002-release-binary-asset-verification.md`
**Status:** AWAITING AUDIT
**Priority:** High — independent design approval before implementation of the next release
**Method requested:** Source-verified review. Read the referenced files 0–EOF, independently
verify each claim against the code and the public GitHub/npm APIs, and apply the Cross-Agent
Claim Rule. Do not modify source files.

---

## Review Boundary

This request asks Nova to independently validate a **spec-only design** and return a written
verdict. It does not request coding, scope changes, FID edits, archival changes, commits,
pushes, publishing, or deployment.

**Mutation boundary (this session):** no production code was changed; no commits, tags, pushes,
GitHub releases, npm publications, credential mutations, or durable settings mutations. The only
artifacts created are: the FID, the earlier FID-2026-0809-001 Nova audit request, and this
request. The FID is at status `analyzed`; implementation has not begun. Nova's response must not
be treated as a substitute for operator approval or as authorization for additional
implementation.

---

## What the FID proposes

The `v0.0.21` release **published to npm with zero downloadable binary assets**. The npm
`savant-code@0.0.21` package is a thin launcher that downloads the real CLI binary from GitHub
release assets at first run. The workflow that builds and uploads those binaries
(`.github/workflows/build-release-binaries.yml`) **failed at `bun install --frozen-lockfile`**
(run `31276460628`, step "Install dependencies"), so the `v0.0.21` GitHub release shipped with
`assets: []`. Every user who ran `npm i -g savant-code` kept their previously cached `v0.0.20`
binary — explaining both reported symptoms (UI shows `v0.0.20`; TokenHarbor absent). The release
system reported **PASS** (`POST_RELEASE_VERIFY` completed) because it verified the npm tarball
contents but never the GitHub release assets.

The FID fixes this in **three parts**:

1. **Fix A (prevent):** regenerate and commit `bun.lock` (stale — reproducibly fails
   `bun install --frozen-lockfile` at both the `v0.0.21` tag and `HEAD`), and add a `lockfile`
   gate to the release pipeline's pre-publish gates so a stale lockfile aborts before npm publish.
2. **Fix B (verify):** add `verifyReleaseAssets` to `POST_RELEASE_VERIFY` asserting the **5
   workflow-matrix tarballs** (NOT all 7 `PLATFORM_TARGETS` keys — two are baseline variants the
   workflow does not build), fail-closed with a configurable retry window, plus live remediation
   of the existing v0.0.21 release via `workflow_dispatch`.
3. **Fix C (govern every release path):** add a post-matrix "Verify release assets" job to the
   workflow, and retire (or redirect) three legacy dispatch scripts that bypass every gate by
   targeting non-public `SavantCode/savant-free-private` workflows.

The design has been through three Perfection Loop iterations (RED/GREEN/AUDIT/ADVERSARIAL, all
documented in the FID's Perfection Loop section): Loop 1 verified the four-part root-cause chain;
Loop 2 (independent review) caught the `PLATFORM_TARGETS` 7-key trap and the missing live
remediation; Loop 3 (scope extension after operator feedback) added Fix C for the auto-release
system. Declared converged under Circuit Breaker Rule 3 (diminishing returns).

---

## Audit Targets (please verify independently)

### Target 1 — The root-cause chain is accurate and reproducible

Verify each claim:

- `bun.lock` is stale relative to the workspace manifests. Reproduce mechanically:
  `bun install --frozen-lockfile` at tag `942c947` exits with
  `error: lockfile had changes, but lockfile is frozen`; a non-frozen install rewrites `bun.lock`
  (17 lines): `scripts/tmux` workspace version `0.0.1 → 0.0.21`, removes
  `async` / `@types/async` / `pino` / `@pinojs/redact` from the `agents` workspace deps, drops the
  stale `zod` resolution. **`HEAD` fails identically.**
- GitHub Actions run `31276460628` (`v0.0.21`, `event: release`, `head_branch: v0.0.21`) failed at
  step "Install dependencies" (18s); all later steps (build, smoke, package, upload) skipped.
- The `v0.0.21` GitHub release (`367293410`) has `"assets": []`; the prior `v0.0.20` release
  carried all 5 tarballs. Verify via the public GitHub API.
- The release receipt for `0.0.21` records `POST_RELEASE_VERIFY` complete with
  `failedStage: null` while assets were absent (`scripts/public-release.ts:2026-2097`
  `verifyPublishedPackage` only checks the npm tarball contents: `README.md` + `index.js`).
- Version is baked into the binary at compile time (`cli/scripts/build-binary.ts:378` via
  `--define`), so a v0.0.20-era binary reports `0.0.20` and cannot contain TokenHarbor (entered
  the tree at commit `7cb6184`).

### Target 2 — Fix A: the lockfile gate placement is sound

- `buildGateManifest` at `scripts/public-release.ts:411-448` is the pre-publish gate manifest
  (build/typecheck/test/eslint/markdownlint/prettier/npm-pack) run at `GATES_AND_PACKAGE_DRY_RUNS`
  before `TAG`/`GIT_PUSH`/`GITHUB_RELEASE`/npm publish. Verify the proposed
  `{ label: 'lockfile', command: 'bun', args: ['install', '--frozen-lockfile'], cwd: root }` gate
  slot is consistent with the existing spec shape and that the gate-manifest hash +
  `gateAttempts` receipt evidence would capture a failure.
- Verify the pinned-Bun self-bootstrap claim: `ensurePinnedBunOnPath` is called before gate
  execution at `scripts/public-release.ts:2641` and `:2703`, and `REQUIRED_BUN_VERSION` is
  `'1.3.14'` at `:146`.

### Target 3 — Fix B: `verifyReleaseAssets` design is correct

- The expected asset set is the **5 workflow-matrix tarballs**
  (`savant-code-{linux-x64,linux-arm64,darwin-x64,darwin-arm64,win32-x64}.tar.gz`) — matching the
  matrix in `.github/workflows/build-release-binaries.yml` (`target` entries), NOT every
  `PLATFORM_TARGETS` key. Verify `cli/release-core/launcher.js:190-198` has **7 keys** including
  `linux-x64-baseline` and `win32-x64-baseline`, and that the workflow explicitly does not build
  baseline variants (end-note comment).
- Because binary builds run after the release is published (`on: release: types: [published]`),
  the check may race the build; the FID recommends fail-closed with a bounded, env-configurable
  retry window (default ~45 min), then fail with remediation commands (`workflow_dispatch` +
  `release:public:resume`). The warning-only alternative is explicitly rejected. Assess whether
  fail-closed-with-retry is the right posture.
- Live remediation (Step 6): after the lockfile fix lands, dispatch the workflow with
  `release_tag: v0.0.21` + `source_ref: <fixed commit>` to heal the existing release — heals fresh
  installs and auto-updates cached-0.0.20 users. Verify this is consistent with the workflow's
  `workflow_dispatch` inputs.

### Target 4 — Fix C: the auto-release system coverage is complete

- **Workflow verify job (Step 7):** the workflow runs the matrix with `fail-fast: false` and has
  **no post-matrix asset-completeness check** (verify: the only `verify` hit in the workflow is a
  smoke-test comment at `:141`). The proposed final job (`needs: build-binary`) asserts all 5
  tarballs are present. Confirm the job must resolve the release tag itself (per-job step outputs
  are not consumable) — implementation note in the FID.
- **Legacy dispatch scripts (Step 8):** verify `cli/scripts/release.ts:56`,
  `sdk/scripts/release.js:56`, and `savant-free/cli/release.ts:83` curl `workflow_dispatch`
  against `SavantCode/savant-free-private` workflows (`cli-release-prod.yml`, `sdk-release.yml`,
  `savant-free-release.yml`) that do not exist in this repository, and that the git remote is
  `savant0x/savant-code` (not `SavantCode/savant-free-private`). Verify a **fourth** foreign
  reference at `savant-free/cli/release/package.json:36` (`repository.url`). Assess whether
  removal (with repoint-to-canonical-engine as the fallback) is the right recommendation, and
  that the retirement touches **four** package.json manifests (root `release:cli`/`release:sdk`/
  `release:savant-free` delegations + workspace-level `release` scripts at `cli/package.json:21`,
  `sdk/package.json:35`, `savant-free/package.json`).
- **Automation mode already inherits Fixes A and B:** verify `SAVANT_CODE_RELEASE_AUTOMATION=1`
  runs the same stages as manual mode — `verifyPublishedPackage` is called at
  `scripts/public-release.ts:2495` inside the shared `POST_RELEASE_VERIFY` block, and
  `buildGateManifest` runs for both modes.

### Target 5 — Tests and verification plan are implementable

- Step 9 regression tests: stale-lockfile receipt/gate test; `verifyReleaseAssets` test with a
  mocked GitHub API returning 0 vs 5 assets; receipt-not-marked-complete-when-assets-absent test.
- Verification section: `bun install --frozen-lockfile` exits 0 at `HEAD`; preview lists the
  `lockfile` gate + asset-count line; workflow verify job fails a run when a tarball is missing;
  `grep -rn 'savant-free-private'` returns nothing in active release code.

### Target 6 — YAGNI and no-behavior-rewrite guarantees

- Fixes A and B are additive to the existing release system (no changes to the launcher's
  download protocol or the workflow matrix). Fix C retires bypass paths and hardens the
  workflow's own completion check — no speculative features.
- The launcher's silent-fallback behavior (keeps cached binary on staging failure,
  `launcher.js:1054`) is deliberately NOT changed; a one-line stderr notice is filed as a stretch
  improvement, not a release blocker. Confirm this scoping is reasonable.

---

## Files to Read

1. `dev/fids/FID-2026-0809-002-release-binary-asset-verification.md`
2. `scripts/public-release.ts` (gate manifest `:411-448`; `REQUIRED_BUN_VERSION` `:146`;
   `verifyPublishedPackage` `:2026-2097`; shared `POST_RELEASE_VERIFY` `:2495`;
   `ensurePinnedBunOnPath` calls `:2641`, `:2703`; automation detection `:250`)
3. `scripts/public-release.test.ts` (existing release contract tests)
4. `.github/workflows/build-release-binaries.yml` (matrix, `--frozen-lockfile` install step,
   no post-matrix verify, `workflow_dispatch` inputs, baseline end-note)
5. `cli/release-core/launcher.js` (`PLATFORM_TARGETS` `:190-198`; download URL `:812-815`;
   staging catch `:1054`)
6. `cli/scripts/build-binary.ts` (`:378` version bake via `--define`)
7. `cli/scripts/release.ts` (`:56` foreign dispatch)
8. `sdk/scripts/release.js` (`:56` foreign dispatch)
9. `savant-free/cli/release.ts` (`:83` foreign dispatch)
10. `savant-free/cli/release/package.json` (`:36` foreign `repository.url`)
11. `package.json`, `cli/package.json` (`:21`), `sdk/package.json` (`:35`),
    `savant-free/package.json` (legacy `release` scripts)
12. `savant-free/SPEC.md` (`:254` stale `savant-free-release.yml` plan)
13. `docs/public-release.md` (canonical release workflow, automation mode)
14. `bun.lock` (root — stale state)

**Public API evidence to re-verify independently:**

- GitHub Actions run `31276460628` (conclusion: failure, failed at "Install dependencies")
- GitHub release `367293410` (`v0.0.21`: `assets: []`) vs the `v0.0.20` release (5 assets)
- npm `savant-code` latest version (`0.0.21`)

---

## Requested Verdict

- PASS/FAIL per audit target with file:line evidence (per the FID's AUDIT evidence-citation rule,
  FID-2026-0805-004).
- An overall verdict: **is the design ready for implementation for the next release?**
- Any critical or high objections, stated with the exact contract or claim they invalidate.
- Confirmation of the mutation boundary (no production code changed, no public mutations).
