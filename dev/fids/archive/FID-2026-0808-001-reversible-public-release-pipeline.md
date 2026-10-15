<!-- markdownlint-disable MD013 -->

# FID: Reversible Public Release Pipeline

**Filename:** `FID-2026-0808-001-reversible-public-release-pipeline.md`
**ID:** FID-2026-0808-001
**Severity:** high
**Status:** closed (2026-08-09 — Nova second-approval sign-off granted; FID-001/002/003 approvals extended to cumulative state; operator-directed close)
**Created:** 2026-08-08
**YAGNI-Compliance:** Pending

---

## Summary

Design and implement one canonical, reversible release command for the public Savant-Code repository. The command must temporarily apply the public release profile, verify the repository and release artifacts, update and consume the current `CHANGELOG.md` section, push the approved commit to GitHub, create the matching GitHub release, publish the public npm packages `savant-code` and `@savant-code/sdk`, and restore the operator's private development settings even when any stage fails. `savant-free` is explicitly excluded because it is not public yet.

This FID was specification-only at creation. It converged before implementation; implementation is now verified locally, while no release, commit, tag, push, npm publication, or settings mutation has been executed by this session.

## Environment

- **OS:** Windows development workstation; workflow must remain cross-platform where practical
- **Language/Runtime:** TypeScript/Bun monorepo; Node-compatible release wrappers; Python legacy release helper
- **Tool Versions:** Bun 1.3.14, npm available, GitHub CLI (`gh`) currently unavailable on the workstation
- **Commit/State:** `main`, project version `0.0.21`, working tree contains unrelated in-progress changes

## Detailed Description

### Problem

Public releases currently require manually switching local provider/model settings,
ensuring production-safe release environment values, aligning versions and changelog
data, building artifacts, pushing Git state, creating a GitHub release, publishing npm
packages, and then restoring private development settings. This is slow and error-prone
for an actively developed public repository.

The existing release surface is fragmented:

- `cli/scripts/build-binary.ts` generates sibling `env.json` and currently defines Savant-Code release defaults for OpenRouter direct mode and `openrouter/free`.
- `cli/src/pre-init/load-dev-env.ts` applies release `env.json` values and preserves direct-provider routing overrides.
- `cli/src/utils/settings.ts` persists model/provider preferences under the user configuration directory.
- `sdk/scripts/publish.ts` performs SDK `npm pack --dry-run` and `npm publish`.
- `cli/scripts/release.ts` dispatches a workflow in a private repository rather than publishing the public repository directly.
- `savant-free/cli/release.ts` dispatches a private Savant-Free workflow and must not be included in the public pipeline.
- `scripts/release.py` is an older release helper configured for `fame0528/savant-protocol`, not the public `savant0x/savant-code` repository.

Composing these scripts without a canonical contract risks publishing stale metadata,
the wrong repository, private provider values, an unintended Savant-Free package, or a
release without matching changelog notes.

### Expected Behavior

A single documented command should support two modes:

1. **Public-release mode** — normal invocation. Runs preflight first, displays the full
   non-secret mutation plan, asks for one immediate interactive confirmation, and then
   performs the complete release transaction in deterministic order. It must not publish
   merely because a build passed or because a noninteractive process supplied no input.
2. **Preflight/preview mode** — explicit `--preview` or equivalent. Performs validation,
   creates no commit/tag/push/release/publication, does not alter the operator's durable
   settings, and prints the exact planned stages and package targets.

The public-release mode must:

1. Confirm the repository is the expected public repository and branch/ref policy is satisfied.
2. Confirm there are no unresolved blocking FIDs or, if the project policy permits a
   dirty worktree, explicitly display and obtain approval for the files included in the
   release commit.
3. Snapshot only the local state required for restoration, using a secret-safe temporary location outside the repository.
4. Apply the public release profile:
   - `DIRECT_PROVIDER=openrouter`
   - `INFERENCE_BASE_URL=https://openrouter.ai/api/v1`
   - `SAVANT_CODE_DEFAULT_MODEL_ID=openrouter/free`
   - production `NEXT_PUBLIC_*` release values from the canonical build profile
   - no personal API keys, GitHub tokens, npm tokens, or local credentials in tracked
     files or public artifacts
5. Validate the version across `VERSION`, root/workspace package metadata, release wrappers, protocol configuration, and user-facing release documentation according to the existing release policy.
6. Confirm the current version has a matching reverse-chronological `CHANGELOG.md` section and extract that section as the canonical GitHub release body.
7. Run the configured build, typecheck, test, ESLint, Markdownlint, and Prettier gates, plus package-specific release dry-runs.
8. Build the public CLI and SDK artifacts without publishing secrets.
9. Create the intended commit/tag or validate that the operator has already prepared them, according to the chosen release policy.
10. Before any mutation, verify `gh auth status` and `npm whoami`, then verify
    authenticated access/ownership for both `savant-code` and `@savant-code/sdk`.
11. Push the approved public branch/tag to
    `https://github.com/savant0x/savant-code.git` using Git or GitHub CLI. The command
    must never push the wrong remote.
12. Create or update the matching GitHub release using the extracted changelog section.
    Re-running must detect an existing tag/release and fail safely or enter an explicit
    update mode; it must not create duplicate releases.
13. Publish exactly these public npm packages:
    - `savant-code` from `cli/release/`
    - `@savant-code/sdk` from `sdk/`

    `savant-free` is excluded until a separate public-release decision is recorded.
14. Verify the published package versions and package contents after publication.
15. Restore the operator's original local settings and environment in a `finally`/cleanup
    path regardless of whether build, push, GitHub release, or npm publication succeeds.
16. Print a concise receipt containing version, commit/tag, package targets, completed
    stages, failed stage if any, and restoration status. Never print credential values.
    The confirmation prompt must enumerate the exact version, commit/tag, verified
    remote, GitHub release target, and both npm packages; missing input or a
    noninteractive environment must refuse mutation.

### Root Cause

There is no single public-release transaction boundary. Environment/profile changes, release builds, Git operations, GitHub release creation, and npm publication are currently separate scripts with different repositories and safety assumptions. Local persisted settings are also independent of the release scripts, so manual restoration is required.

### Evidence

Current source evidence gathered during RED reconnaissance:

```text
cli/scripts/build-binary.ts:63-69
CANONICAL_RELEASE_RUNTIME_DEFAULTS contains DIRECT_PROVIDER=openrouter,
INFERENCE_BASE_URL=https://openrouter.ai/api/v1, and
SAVANT_CODE_DEFAULT_MODEL_ID=openrouter/free.

cli/scripts/build-binary.ts:85-94
getReleaseRuntimeDefaults('savant-free') returns {} while Savant-Code receives
those direct OpenRouter defaults.

cli/src/pre-init/load-dev-env.ts:55-82
applyBinaryEnvValues treats DIRECT_PROVIDER and INFERENCE_BASE_URL as an
atomic override pair and keeps release client values authoritative.

cli/src/utils/settings.ts:12-23, 77-105
The default model/provider are resolved from SAVANT_CODE_DEFAULT_MODEL_ID and
persisted settings are stored through the user configuration directory.

cli/src/utils/config-dir.ts:17-29
The production configuration directory resolves to the user's home directory
under .savant-code; non-production tests may override it.

sdk/scripts/publish.ts:25-39
SDK publication runs npm pack --dry-run, then npm publish unless --dry-run is
passed.

sdk/package.json:2-4, 14-18
@savant-code/sdk is public (private=false), version 0.0.21, and ships dist,
README.md, and CHANGELOG.md.

cli/release/package.json:2-4, 24-29
savant-code is the public CLI package at version 0.0.21.

savant-free/cli/release/package.json:2-4
savant-free is a separate package and is intentionally excluded by this FID.

cli/scripts/release.ts:45-58
The current CLI release helper dispatches a workflow in
SavantCode/savant-free-private and is not a canonical public-repository release
implementation.

savant-free/cli/release.ts:48-60
The Savant-Free release helper also targets the private Savant-Free workflow.

scripts/release.py:24-28, 46-47
The legacy Python helper is configured for fame0528/savant-protocol and is not
safe to reuse as the public Savant-Code release command without reconfiguration.
```

## Impact Assessment

### Affected Components

- New canonical release workflow script and its focused tests
- `cli/scripts/build-binary.ts` public release profile integration
- `cli/src/pre-init/load-dev-env.ts` and settings snapshot boundary
- `sdk/scripts/publish.ts` or a shared package-publish wrapper
- `cli/release/`, `sdk/`, and release documentation
- `CHANGELOG.md`, version metadata, and public README/release documentation
- Git/GitHub release automation and npm package publication

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Primary risks are accidental public disclosure of credentials, publishing the wrong
package or version, pushing an unintended worktree, creating duplicate releases, and
failing to restore personal settings after a partial release.

## Proposed Solution

### Approach

Create one release orchestrator with pure, testable planning/profile functions and a
thin effectful runner. The runner should use dependency-injected command/file adapters
where possible so tests can simulate failures without touching the real Git repository,
home directory, npm registry, or GitHub.

The release profile must be represented as a typed, non-secret manifest. Secrets remain
supplied by the operator's authenticated Git/npm/GitHub tooling or environment and are
never copied into the profile snapshot or release receipt.

The workflow must use explicit stage boundaries:

```text
PREFLIGHT
  → SNAPSHOT_LOCAL_STATE
  → APPLY_PUBLIC_PROFILE
  → VERIFY_VERSION_AND_CHANGELOG
  → BUILD_AND_TEST
  → PACKAGE_DRY_RUN
  → APPROVE_PUBLIC_MUTATIONS
  → COMMIT/TAG (if selected by policy)
  → GIT_PUSH
  → GITHUB_RELEASE
  → NPM_PUBLISH_SDK
  → NPM_PUBLISH_CLI
  → POST_RELEASE_VERIFY
  → RESTORE_LOCAL_STATE
  → RECEIPT
```

`RESTORE_LOCAL_STATE` is mandatory on every exit path after snapshot creation. If restoration fails, the command must exit non-zero and print the exact non-secret paths requiring operator attention.

### GREEN decisions and durable defaults

The following decisions converge the design for implementation:

1. The orchestrator does not infer versions, generate changelog prose, or create a
   release commit from an ambiguous dirty tree. The operator prepares and commits the
   aligned source/version/changelog changes first. The orchestrator validates `HEAD`,
   creates the annotated `v<version>` tag after confirmation, and pushes the branch and
   tag.
2. `gh` is mandatory for the real public-release path. No private workflow dispatch and
   no untested API fallback is used. `--preview` may report that `gh` is unavailable;
   mutation mode must fail before snapshot/profile changes if `gh auth status` cannot
   pass.
3. `git push` is the one canonical Git transport. GitHub CLI has no generic `gh push`
   operation. `gh release create` is used only for the verified GitHub release after
   the branch and tag are pushed.
4. npm publication is sequential: `@savant-code/sdk` first, then `savant-code`.
   A non-secret stage receipt records successful publication; resume checks the registry
   before attempting a package again and never unpublishes automatically.
5. A dirty worktree is refused in mutation mode. `--preview` may inspect it and explain
   the refusal. This prevents unrelated active development from entering a public push.
6. Version bumping and changelog authoring remain explicit source changes outside the
   orchestrator. The command requires aligned metadata and exactly one current changelog
   section before it can mutate anything.
7. The order is: preflight → snapshot/profile → gates → confirmation → annotated tag →
   branch/tag push → GitHub release → SDK npm publication → CLI npm publication → verify
   → restore. Existing releases/tags produce an idempotent resume/error path, not a
   duplicate.
8. The workflow snapshots process routing variables and the persisted settings file
   only if it will touch them. Credentials are never copied, transformed, logged, or
   included in the snapshot receipt. Restoration is mandatory through `finally`.

### Steps

1. Create this FID and converge the release contract through RED → GREEN → AUDIT → ADVERSARIAL.
2. Add a typed public release profile and a pure stage planner.
3. Add secret-safe snapshot/restore for process environment and relevant `.savant-code` settings.
4. Add current-version changelog extraction with strict heading/version validation.
5. Add repository identity, branch, remote, package-target, and version preflight checks.
6. Reuse or refactor SDK package verification so both SDK and CLI package dry-runs are checked before publication.
7. Add GitHub release and npm publication adapters with idempotent existing-version checks.
8. Add an explicit `--preview` mode and an immediate interactive confirmation before
   mutation/publication; no test may call real push, release, or npm publication.
9. Update public release documentation and root package scripts with the canonical command.
10. Add a release receipt/resume record that contains no secrets and is stored outside tracked source or in the ignored release staging area.

### Verification

- Unit tests for profile application, complete/partial failure-safe restoration, and secret redaction.
- Unit tests for changelog section extraction, missing/duplicate version headings, and reverse-chronological validation.
- Unit tests for package target selection proving `savant-code` + `@savant-code/sdk` are included and `savant-free` is excluded.
- Unit tests for stage ordering and idempotent resume behavior.
- Mocked command-adapter tests proving no `git push`, `gh release`, or `npm publish` occurs in preview mode.
- Package dry-runs:
  - `npm pack ./cli/release --dry-run`
  - `npm pack ./sdk --dry-run`
- Focused build-binary env tests and loader tests.
- CLI and SDK typechecks.
- Relevant CLI/SDK test suites.
- `bun x eslint . --max-warnings 0`.
- `bun run lint:md`.
- `bunx prettier --check .`.
- Manual operator review of the final non-secret receipt before any real public mutation.

## Perfection Loop

### Loop 1

- **RED:** Reconnaissance completed. Existing release paths are fragmented; public and
  private release targets are mixed; the legacy Python helper points at a different
  repository; SDK publication exists but CLI/public GitHub publication does not share
  one transaction boundary; local settings restoration is manual.
- **GREEN:** Proposed a single typed, reversible orchestrator with public profile
  application, secret-safe snapshot/restore, changelog extraction, package-target
  validation, Git push, GitHub release, and sequential npm publication for
  `savant-code` + `@savant-code/sdk`; `savant-free` excluded.
- **AUDIT:** Initial review passed formatting and scope checks, but left release
  transport, dirty-tree, version/tag ownership, and authentication fallback decisions
  open. The FID remained `analyzed`.
- **CHANGE DELTA:** FID-only specification; no production code delta.

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: “What questions should I have asked when this FID was created, but failed to?”

1. **Should a failed npm publication automatically roll back the GitHub release?** → No destructive rollback should be attempted automatically. Record the completed stages and provide an idempotent resume command; GitHub release deletion and npm unpublish are dangerous and should require separate explicit operator action.
2. **Should credentials be copied into the temporary public profile?** → No. The public profile contains only non-secret routing/default metadata. Credentials remain in the operator's existing authenticated environment/tooling and are never serialized into tracked files or receipts.
3. **Should a dirty worktree be allowed?** → Not by default. Refuse or require an explicit commit/ref scope so unrelated active development cannot enter a public release.
4. **What happens if `gh` is unavailable?** → Preflight must report the missing capability before any mutation. A documented API fallback may be added only if it uses an already authenticated, secret-safe mechanism and is separately tested; it must not silently call the old private workflow scripts.
5. **How should the command behave after the user closes/restarts it?** → Store a non-secret stage receipt outside the repository and allow explicit resume after re-running preflight. Never infer that a partially completed publish is safe to repeat.
6. **What does “restore personal setup” include?** → At minimum process routing variables, model/provider preference, direct-provider persistence fields, and any release-generated local environment/profile files. Credentials are not transformed; they remain untouched and are never copied.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID actually exists. FID metadata is a claim — the code is ground truth.

- [x] Files referenced in “Affected Components” exist in the codebase
- [x] Reconnaissance evidence matches the current implementation
- [x] Implementation exists and matches the proposed solution
- [x] Bun bundle check passes for `scripts/public-release.ts`
- [x] FID status reflects the implemented-but-not-published state

> **AUDIT evidence-citation rule:** implementation audit must cite every PASS/FAIL with `path/to/file.ts:LINE` and quoted code, including exact NO-MATCH output for absence checks. Out-of-reach evidence must be marked `NEEDS-REVIEW`.

### Loop 2 — FID convergence

- **RED:** Adversarial review identified four convergence gaps: the FID did not state
  who owns commit/tag creation, left `gh` fallback policy open, did not explicitly
  reject dirty mutation trees, and did not require the confirmation prompt to enumerate
  the exact mutation targets. It also required fresh audit evidence rather than relying
  only on initial reconnaissance.
- **GREEN:** Resolved those gaps with durable defaults: operator-prepared clean `HEAD`,
  orchestrator-created annotated tag, mandatory authenticated `gh` for mutation mode,
  canonical `git push` plus `gh release create`, no automatic version/changelog
  authoring, SDK-first then CLI npm publication, registry-aware resume, and an exact
  interactive confirmation. `savant-free` remains excluded.
- **AUDIT:** Fresh source and contract checks passed:
  - `cli/scripts/build-binary.ts:63-69` contains the OpenRouter route and
    `openrouter/free`; `getReleaseRuntimeDefaults('savant-free')` returns `{}` at
    `:85-94`.
  - `cli/src/pre-init/load-dev-env.ts:55-82` preserves an explicit direct-routing
    pair and applies release client values.
  - `cli/src/utils/settings.ts:12-23` resolves `openrouter/free` and provider
    defaults; `cli/src/utils/config-dir.ts:17-29` resolves production state under
    the user's `.savant-code` directory.
  - `sdk/scripts/publish.ts:25-39` performs `npm pack --dry-run` before optional
    publication; `sdk/package.json` identifies public `@savant-code/sdk`, and
    `cli/release/package.json` identifies public `savant-code`, both at `0.0.21`.
  - `cli/scripts/release.ts:45-58` targets the private workflow, while
    `scripts/release.py:24-28` targets `fame0528/savant-protocol`; neither is reused.
  - Read-only validation output: `bunx markdownlint ...` exit `0`,
    `bunx prettier --check ...` exit `0`, and `git diff --check` exit `0`.
  - Contract marker audit found `PREFLIGHT`, `SNAPSHOT_LOCAL_STATE`, `GIT_PUSH`,
    `GITHUB_RELEASE`, `NPM_PUBLISH_SDK`, `NPM_PUBLISH_CLI`, `gh auth status`,
    `npm whoami`, `--preview`, and `finally`.
- **CHANGE DELTA:** FID-only specification update; no production code delta.

### ADVERSARIAL review

- **CONFIRMED:** Public package scope is exactly `savant-code` plus
  `@savant-code/sdk`; `savant-free` is excluded.
- **CONFIRMED:** The implementation keeps real publication behind interactive
  confirmation and does not execute any push, tag, GitHub release, or npm command
  during tests or validation.
- **CONFIRMED:** Resume is bound to the recorded `HEAD` SHA, requires prior
  restoration, validates annotated-tag dereferencing, checks fetch and push URLs,
  and re-runs npm access checks.
- **CONFIRMED:** Ambiguous GitHub/npm lookups fail closed; published package
  inspection checks registry metadata and required artifact files.
- **ADJUSTED:** FID lifecycle state is now `implemented`, not `closed`: operator
  release execution and final independent audit remain outstanding.
- **VERDICT:** Implementation is ready for a separate operator-approved release
  run after the final independent audit; no public mutation was performed.

### Loop 3 — implementation

- **RED:** The first implementation review found unused `--resume`, preview failure
  on dirty trees, incomplete confirmation targets, and legacy root release wiring.
- **GREEN:** Added `scripts/public-release.ts` with preview/resume modes, SDK-first
  package order, public profile snapshot/restore, strict changelog/version checks,
  exact confirmation targets, fail-closed registry checks, HEAD-bound receipts,
  and post-release verification. Added root `release:public`,
  `release:public:preview`, and `release:public:resume` scripts.
- **AUDIT:** Initial implementation verification passed with 6/6 tests, but Nova's
  independent pre-push audit withheld sign-off because resume, failure recovery, and
  credential-redaction coverage were too shallow, and the real preview extraction
  had not been executed.
- **ADVERSARIAL:** Nova classified the implementation as `PASS WITH BLOCKERS`:
  public scope, preview boundary, confirmation, restoration design, version gates,
  fail-closed checks, stage order, and bookkeeping passed; resume remained
  `NEEDS-REVIEW`. The two blockers were accepted as verification gaps, not as a
  reason to weaken the release safety contract.
- **GREEN:** Expanded `scripts/public-release.test.ts` from 104 to 190+ lines with
  contract coverage for restored/HEAD-bound resume receipts, refusal of un-restored
  or unbound receipts, simulated gate failure followed by settings/environment
  restoration, credential-bearing failure-detail redaction, and extraction of the
  real repository changelog section. Added exported pure seams in
  `scripts/public-release.ts` for receipt validation and local-state testing.
  Receipt validation now rejects malformed commit SHAs and duplicate/unknown
  stages. The production transaction uses `withLocalStateRestoration()` so the
  failure test exercises the same cleanup wrapper as the runner. Receipt
  serialization redacts quoted and unquoted credential values plus bearer tokens.
  Changelog heading validation now uses explicit ISO dates when headings provide
  them, with semantic-version ordering as the fallback; this preserves the actual
  historical date order (`v0.0.8` before `v0.0.10`) without weakening the gate.
- **AUDIT:** Focused verification now passes **10/10 tests (32 assertions)**;
  Bun bundles the release script; ESLint and Prettier pass. The real read-only
  `bun run release:public:preview` exits 0 and prints exactly
  `Changelog section ready: ## v0.0.21 — 2026-08-06`. No normal release command,
  commit, tag, push, GitHub release, npm publication, or credential mutation was
  executed. Preview warnings are limited to the expected local remote/worktree/tool
  conditions and do not alter public state.
- **ADVERSARIAL:** The two Nova blockers are addressed in implementation and
  evidence. The FID remains `implemented` and awaits Nova's re-audit/sign-off;
  it is not represented as publicly released or archived.
- **CHANGE DELTA:** Production implementation plus focused tests, package wiring,
  release documentation, docs index link, and CHANGELOG entry.

## Resolution

- **Lifecycle:** Implementation completed under the converged FID contract on 2026-08-08
- **Fix Description:** Added the canonical reversible public release workflow in
  `scripts/public-release.ts`. It validates the public repository and clean `main`
  worktree, snapshots/restores non-secret local routing/settings state, applies the
  OpenRouter/free release profile, runs all configured gates and package dry-runs,
  confirms exact mutation targets, creates/pushes the annotated tag, creates the
  GitHub release from `CHANGELOG.md`, publishes SDK then CLI, supports safe resume,
  and verifies/restores state. `savant-free` remains excluded.
- **Tests Added:** `scripts/public-release.test.ts` — changelog extraction/order,
  package/version validation, public target ordering, stage checks, restored and
  HEAD-bound resume validation, simulated failure restoration, credential-bearing
  failure redaction, and real changelog extraction (10 pass / 0 fail; 32
  assertions).
- **Verification:** Bun bundle check; focused Bun tests; ESLint; Prettier;
  Markdownlint; `git diff --check`; read-only `bun run release:public:preview`
  with exact `v0.0.21` extraction; independent implementation review; Nova
  pre-push audit recorded as `PASS WITH BLOCKERS` pending re-audit.
- **Nova blocker response:** Both requested blockers are resolved. Resume and
  restoration behavior are directly exercised by the production restoration
  wrapper, credential-bearing failure details are redacted before receipt
  serialization, and the live preview confirmed the extracted current release
  section. A re-audit request is staged at
  `dev/nova/outbox/2026-08-08-fid-2026-0808-001-public-release-pipeline-reaudit-request.md`;
  Nova's second audit and sign-off remain pending before any public mutation.
- **Repository state:** Uncommitted working tree; no release execution performed
- **Lifecycle state:** Closed + archived 2026-08-09 per operator direction after Nova's
  second-approval sign-off (`dev/nova/inbox/2026-08-08-release-system-second-approval-SIGN-OFF.md`)
  granted pre-push approval and extended the FID-001/002/003 approvals to the cumulative state.
  The implementation remains verified; the actual release execution is a separate
  operator-approved action covered by the A-Z build/release remediation session.
- **CHANGELOG:** appended 2026-08-09 (v0.0.21 release-system closure entry).

## Lessons Learned

- Public release automation must have one repository identity and one transaction boundary.
Authentication and package ownership must be verified before any public mutation, not only
when the final publication command runs.
- A release profile must be non-secret and reversible; user credentials must never be copied into release artifacts.
- Private product releases must be explicit targets, never accidental byproducts of a shared builder.
- Changelog extraction and package dry-runs should be first-class gates, not manual afterthoughts.
- Publishing stages need idempotent resume behavior because a successful GitHub release followed by a failed npm publish is not safely repaired by deleting history.
- The normal command may run the complete release after one explicit confirmation; `--preview`
  is the no-mutation escape hatch. Noninteractive execution must refuse the mutation stages
  rather than treating missing input as consent.
