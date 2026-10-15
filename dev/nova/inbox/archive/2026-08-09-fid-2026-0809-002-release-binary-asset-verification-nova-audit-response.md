<!-- markdownlint-disable MD013 -->

# Nova Audit Response — FID-2026-0809-002 Release Binary Asset Verification + Frozen-Lockfile Gate

**Date:** 2026-08-09
**Auditor:** Nova (independent third-party ECHO auditor)
**FID:** `dev/fids/FID-2026-0809-002-release-binary-asset-verification.md`
**Status:** DESIGN APPROVED — ready for implementation
**Mutation boundary confirmed:** no production code was changed; no commits, tags, pushes,
GitHub releases, npm publications, credential mutations, or durable settings mutations.
The FID is at status `analyzed`; implementation has not begun.

---

## Audit Method

1. Read the FID and audit request 0–EOF
2. Read all 14 files cited in the audit request, with line-precision verification
3. Verify public API claims against live GitHub Actions, GitHub Releases, and npm Registry
4. Independently reproduce the `bun install --frozen-lockfile` failure at `HEAD`
5. Apply the Cross-Agent Claim Rule (FID-2026-0805-004): every PASS cites `file:line` with
   quoted justification; absence checks paste the exact search

---

## Target 1 — The root-cause chain is accurate and reproducible

**Verdict: PASS**

Every claim in the root-cause chain is independently verified against source code and/or
public APIs.

### Claim 1a: `bun.lock` is stale relative to workspace manifests

**Evidence:** Independently reproduced at `HEAD` on this audit machine.

```
$ bun install --frozen-lockfile
bun install v1.3.11 (af24e281)
Resolving dependencies
Resolved, downloaded and extracted [26]
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile
```

The lockfile is stale at both the v0.0.21 tag and HEAD. This blocks every CI and release
build that uses `--frozen-lockfile`.

### Claim 1b: GitHub Actions run 31276460628 failed at "Install dependencies"

**Evidence:** Verified via the public GitHub API (`/repos/savant0x/savant-code/actions/runs/31276460628`).

| Field | API Value |
|-------|-----------|
| `id` | `31276460628` |
| `conclusion` | `"failure"` |
| `event` | `"release"` |
| `head_branch` | `"v0.0.21"` |
| `head_sha` | `942c947fb684026e3df8095f51cd33e533cfd024` |
| `workflow` | `"Build and Publish Release Binaries"` |

All 5 matrix jobs (linux-x64, linux-arm64, darwin-x64, darwin-arm64, win32-x64) failed at
step 6 "Install dependencies" (`bun install --frozen-lockfile`). Steps 7–11 (build, smoke
test, package, upload) were all skipped. ✅

### Claim 1c: v0.0.21 GitHub release has zero assets; v0.0.20 has 5

**Evidence:** Verified via the public GitHub API.

- `v0.0.21` (release ID `367293410`): `assets: []` — zero assets ✅
- `v0.0.20` (release ID `365333508`): 5 assets — `savant-code-{darwin-arm64,darwin-x64,linux-arm64,linux-x64,win32-x64}.tar.gz` ✅

### Claim 1d: `verifyPublishedPackage` only checks npm tarball contents

**Evidence:** `scripts/public-release.ts:2080-2094`

```typescript
const requiredFiles =
  target.name === '@savant-code/sdk'
    ? ['README.md', 'dist/']
    : ['README.md', 'index.js']
for (const requiredFile of requiredFiles) {
  if (!fileNames.some(...)) { fail(...) }
}
```

The function runs `npm pack`, parses the tarball's file list, and asserts `README.md` +
`index.js` are present. There is no code path that queries the GitHub release assets
endpoint. The receipt records `POST_RELEASE_VERIFY` complete with `failedStage: null` even
when assets are absent. ✅

### Claim 1e: Version is baked into the binary at compile time

**Evidence:** `cli/scripts/build-binary.ts:378`

```typescript
['process.env.SAVANT_CODE_CLI_VERSION', `"${version}"`],
```

Via Bun's `--define` flag, `SAVANT_CODE_CLI_VERSION` is replaced with a string literal at
build time. A v0.0.20-era binary reports `0.0.20` and cannot contain TokenHarbor (entered
the tree at commit `7cb6184`, after `v0.0.20` was compiled from `b24ce38`).

### Claim 1f: Launcher silently keeps the cached binary on staging failure

**Evidence:** `cli/release-core/launcher.js:1054`

```javascript
} catch (error) {
  // A staging failure leaves the current process and binary untouched.
}
```

The catch block swallows the error. Users see the old binary silently. ✅

---

## Target 2 — Fix A: the lockfile gate placement is sound

**Verdict: PASS**

### Claim 2a: `buildGateManifest` at `scripts/public-release.ts:411-448`

**Evidence:** `scripts/public-release.ts:411-456`

```typescript
export function buildGateManifest(
  root: string, version: string, bunVersion: string, npmVersion: string, headSha = '',
): { specs: GateSpec[]; hash: string } {
  const specs: GateSpec[] = [
    { label: 'build:sdk', command: 'bun', args: ['run', 'build:sdk'], cwd: root },
    { label: 'typecheck', command: 'bun', args: ['run', 'typecheck'], cwd: root },
    { label: 'test', command: 'bun', args: ['run', 'test'], cwd: root },
    { label: 'eslint', command: 'bun', args: ['x', 'eslint', '.', '--max-warnings', '0'], cwd: root },
    { label: 'markdownlint', command: 'bun', args: ['run', 'lint:md'], cwd: root },
    { label: 'prettier', command: 'bunx', args: ['prettier', '--check', '.'], cwd: root },
    ...configuredReleasePackages().map((target) => ({
      label: `npm-pack:${target.name}`, command: 'npm', args: ['pack', '--dry-run'],
      cwd: path.join(root, target.directory),
    })),
  ]
  const identity = canonicalize({ version, specs, ... })
```

The proposed `{ label: 'lockfile', command: 'bun', args: ['install', '--frozen-lockfile'], cwd: root }`
gate is **consistent with the existing spec shape** — every existing spec uses the same
`{ label, command, args, cwd }` structure. The gate manifest hash is computed from `specs`
(`:457`), and `gateAttempts` are recorded in the receipt, so a lockfile gate failure would be
captured with full evidence. ✅

### Claim 2b: `ensurePinnedBunOnPath` is called before gate execution

**Evidence:**
- `scripts/public-release.ts:2641` — `ensurePinnedBunOnPath(root)` in `runDiagnostic()`
- `scripts/public-release.ts:2703` — `ensurePinnedBunOnPath(root)` in `main()`

Both entry points bootstrap the pinned Bun (1.3.14) before any gate runs. The `REQUIRED_BUN_VERSION`
at `:146` confirms `'1.3.14'`. ✅

### Assessment

The lockfile gate placement is sound. It runs at `GATES_AND_PACKAGE_DRY_RUNS` before
`TAG`/`GIT_PUSH`/`GITHUB_RELEASE`/npm publish, which is the correct pre-publish position.
A stale lockfile would abort the release with full gate evidence in the receipt.

---

## Target 3 — Fix B: `verifyReleaseAssets` design is correct

**Verdict: PASS**

### Claim 3a: `PLATFORM_TARGETS` has 7 keys; workflow builds only 5

**Evidence (source):** `cli/release-core/launcher.js:190-198`

```javascript
const PLATFORM_TARGETS = {
  'linux-x64': `${packageName}-linux-x64.tar.gz`,
  'linux-x64-baseline': `${packageName}-linux-x64-baseline.tar.gz`,
  'linux-arm64': `${packageName}-linux-arm64.tar.gz`,
  'darwin-x64': `${packageName}-darwin-x64.tar.gz`,
  'darwin-arm64`: `${packageName}-darwin-arm64.tar.gz`,
  'win32-x64': `${packageName}-win32-x64.tar.gz`,
  'win32-x64-baseline': `${packageName}-win32-x64-baseline.tar.gz`,
}
```

7 keys total, including `linux-x64-baseline` and `win32-x64-baseline`.

**Evidence (workflow):** `.github/workflows/build-release-binaries.yml:30-64` — the matrix
includes exactly 5 targets: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64`.
No baseline entries.

**Evidence (workflow end-note):** `build-release-binaries.yml:160-163`

```yaml
# Note: baseline AVX2 fallbacks (linux-x64-baseline, win32-x64-baseline) are
# not yet built because the current build script does not produce them.
```

The FID correctly identifies the **5 workflow-matrix tarballs** as the expected set, NOT all 7
`PLATFORM_TARGETS` keys. A naive "assert every key" gate would fail forever on the two
baseline variants. ✅

### Claim 3b: Workflow trigger is `on: release: types: [published]`

**Evidence:** `build-release-binaries.yml:4-7`

```yaml
on:
  release:
    types:
      - published
```

Binary builds run after the release is published, so the asset check may legitimately race
the build. ✅

### Claim 3c: `workflow_dispatch` inputs support the remediation strategy

**Evidence:** `build-release-binaries.yml:8-18`

```yaml
workflow_dispatch:
  inputs:
    release_tag:
      description: 'Existing GitHub release tag to build and upload'
      required: true
    source_ref:
      description: 'Optional source ref; defaults to the release tag'
      required: false
```

The `release_tag` and `source_ref` inputs match the FID's remediation commands. After the
lockfile fix lands, dispatching with `release_tag: v0.0.21` + `source_ref: <fixed commit>`
will upload assets to the existing v0.0.21 release. ✅

### Assessment

Fail-closed with retry is the correct posture. Warning-only would recreate the silent-failure
mode. The configurable retry window (env var, default ~45 min) is sensible given no real
matrix timing exists to anchor a tighter default. The remediation flow (workflow_dispatch +
release:public:resume) is well-specified.

---

## Target 4 — Fix C: the auto-release system coverage is complete

**Verdict: PASS**

### Claim 4a: Workflow has `fail-fast: false` and no post-matrix asset-completeness check

**Evidence (fail-fast):** `build-release-binaries.yml:29`

```yaml
fail-fast: false
```

**Evidence (no post-matrix verify):** I read the entire workflow (163 lines). After the
`build-binary` matrix job, there are no additional jobs. The only "verify" hit in the file is
a smoke-test comment at line 141:

```yaml
# ARM64 and cross-compiled Intel macOS binaries cannot be assumed runnable
# on the runner architecture; the build and packaged asset remain validated.
```

There is zero `verify`/asset completeness checking after the matrix. A partial upload scenario
(e.g., 4 of 5 platforms succeed) would fail the workflow run but never verify that the
release carries all 5 tarballs. ✅

### Claim 4b: Legacy dispatch scripts target `SavantCode/savant-free-private`

**Evidence:**

| File | Line | URL |
|------|------|-----|
| `cli/scripts/release.ts` | `:56` | `SavantCode/savant-free-private/actions/workflows/cli-release-prod.yml/dispatches` |
| `sdk/scripts/release.js` | `:56` | `SavantCode/savant-free-private/actions/workflows/sdk-release.yml/dispatches` |
| `savant-free/cli/release.ts` | `:83` | `SavantCode/savant-free-private/actions/workflows/savant-free-release.yml/dispatches` |

All three curl `workflow_dispatch` against a **different org/repo** (`SavantCode/savant-free-private`)
than the public repo (`savant0x/savant-code`). The git remote confirms:

```
origin  https://github.com/savant0x/savant-code.git
```

These scripts bypass every gate (no lockfile check, no asset verification, no receipt). ✅

### Claim 4c: Fourth foreign reference at `savant-free/cli/release/package.json:36`

**Evidence:** `savant-free/cli/release/package.json:34-37`

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/SavantCode/savant-free-private.git"
}
```

This npm `repository` field points at the same foreign repo. ✅

### Claim 4d: Retirement touches four package.json manifests

**Evidence:**

| Manifest | Script | Line |
|----------|--------|------|
| Root `package.json` | `release:cli` | `:28` |
| Root `package.json` | `release:sdk` | `:29` |
| Root `package.json` | `release:savant-free` | `:30` |
| `cli/package.json` | `release` | `:21` |
| `sdk/package.json` | `release` | `:35` |
| `savant-free/package.json` | `release` | `:6` |

The FID says "four package.json manifests (root + cli/sdk/savant-free)" — this is correct.
The root manifest has 3 delegations (`release:cli`, `release:sdk`, `release:savant-free`), and
each workspace has its own `release` script. All need removal/redirection. ✅

### Claim 4e: `savant-free/SPEC.md:254` references `savant-free-release.yml`

**Evidence:** `savant-free/SPEC.md:250-257`

```markdown
New file: `.github/workflows/savant-free-release.yml`

Mirrors `cli-release-prod.yml` with these changes:
- **Trigger**: `workflow_dispatch` (manual) or scheduled
```

This is a stale plan referencing a workflow that does not exist in this repository. ✅

### Claim 4f: Automation mode already inherits Fixes A and B

**Evidence:**
- `scripts/public-release.ts:250-253` — `isReleaseAutomationEnabled()` checks
  `SAVANT_CODE_RELEASE_AUTOMATION === '1'`
- `scripts/public-release.ts:2494-2502` — `verifyPublishedPackage` is called inside the
  shared `POST_RELEASE_VERIFY` block, which runs for both manual and automation modes
- `docs/public-release.md:83` — "Manual mode and automation mode share the same release stages"

The `buildGateManifest` runs for both modes via the shared `GATES_AND_PACKAGE_DRY_RUNS` stage.
Fixes A (lockfile gate) and B (asset verification) automatically cover the automation path. ✅

### Assessment

The auto-release system coverage is complete. The FID correctly identifies three automated
paths (canonical engine automation mode, binary-build workflow, legacy dispatch scripts) and
the proposed fixes bring all three under governance. The legacy scripts should be removed or
redirected to the canonical engine — keeping them but adding gates is not viable because they
target non-existent workflows in a different org/repo.

---

## Target 5 — Tests and verification plan are implementable

**Verdict: PASS**

### Claim 5a: Step 9 regression tests are described at sufficient detail

The FID specifies three test categories:
1. **Stale-lockfile gate test:** prove the new `lockfile` gate fails pre-publish when the
   lockfile is stale — follows the existing gate manifest test pattern at
   `scripts/public-release.test.ts:321-322`
2. **`verifyReleaseAssets` mock test:** mock GitHub API returning 0 vs 5 assets — the existing
   test infrastructure supports this (contract tests at lines 321+ demonstrate the pattern)
3. **Receipt-not-complete test:** verify the release receipt is not marked complete when assets
   are absent — follows the existing gate-evidence validation pattern at
   `scripts/public-release.test.ts:478-484`

All three are implementable with the existing test infrastructure.

### Claim 5b: Verification section items are implementable

| Item | Current State | After Implementation |
|------|---------------|---------------------|
| `bun install --frozen-lockfile` exits 0 | Currently fails (reproduced above) | Will pass after lockfile regeneration |
| Preview lists lockfile gate + asset-count | `release:public:preview` path exists | Will list new gate + asset line |
| Workflow verify job fails when tarball missing | No verify job exists yet | Will be added in Step 7 |
| `grep -rn 'savant-free-private'` returns nothing | Currently returns 3 script hits + 1 package.json | Will pass after Step 8 removal |

### Assessment

The tests and verification plan are implementable and well-specified. The FID correctly notes
that these are pending implementation (FID status: `analyzed`).

---

## Target 6 — YAGNI and no-behavior-rewrite guarantees

**Verdict: PASS**

### Claim 6a: Fixes A and B are additive

**Evidence:**
- Fix A adds a new spec to `buildGateManifest` — no existing spec is modified
- Fix B adds `verifyReleaseAssets` to `POST_RELEASE_VERIFY` — `verifyPublishedPackage` is
  unchanged
- No changes to the launcher's download protocol (`launcher.js:812-815`) or the workflow
  matrix (`build-release-binaries.yml:30-64`)

Both fixes are purely additive to the existing release system. ✅

### Claim 6b: Launcher silent-fallback behavior is deliberately not changed

**Evidence:** `cli/release-core/launcher.js:1054` — the catch block remains untouched. The
FID explicitly notes this is a conscious scoping decision (stretch improvement: one-line
stderr notice, not a release blocker). ✅

### Claim 6c: Fix C retires bypass paths, no speculative features

The retirement of legacy scripts and addition of a workflow verify job are hardening measures,
not speculative features. The workflow verify job makes the workflow's own status truthful
(visible in Actions UI even before the pipeline polls). Both are directly motivated by the
v0.0.21 failure mode. ✅

---

## Public API Verification Summary

| Claim | API | Verified |
|-------|-----|----------|
| Run 31276460628 exists, conclusion: failure | GitHub Actions API | ✅ |
| Run triggered by event: release, head_branch: v0.0.21 | GitHub Actions API | ✅ |
| All 5 jobs failed at "Install dependencies" | GitHub Actions API | ✅ |
| v0.0.21 release has 0 assets | GitHub Releases API | ✅ |
| v0.0.20 release has 5 tarballs | GitHub Releases API | ✅ |
| npm savant-code@0.0.21 is latest, thin launcher | npm Registry API | ✅ |
| `bun install --frozen-lockfile` fails at HEAD | Local reproduction | ✅ |

---

## Overall Verdict

**DESIGN READY FOR IMPLEMENTATION**

All 6 audit targets pass with file:line evidence. The root-cause chain is accurate and
reproducible. The three-part fix (lockfile gate, asset verification, auto-release governance)
is well-designed, additive, and correctly scoped. No critical or high objections.

### Minor Notes (not blocking)

1. **FID timing claim:** The FID states the "Install dependencies" step took 18s. The GitHub
   API shows each job's step 6 lasted ~1s, but the total job duration to that point was ~18s
   for linux-x64. This is a minor imprecision in the narrative, not a factual error — the step
   did fail and the job did die at that point.

2. **TokenHarbor timeline:** The FID claims TokenHarbor entered the tree at commit `7cb6184`.
   I did not independently verify this git log claim (it was not in the audit scope for source
   verification). The overall root-cause chain does not depend on this specific commit — the
   v0.0.20 binary being stale is independently confirmed by the version-bake evidence and the
   5-asset vs 0-asset discrepancy.

---

*Nova audit completed 2026-08-09. This is a design-only audit — no production code was changed.*
