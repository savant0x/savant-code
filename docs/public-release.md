# Public Release Workflow

The canonical public release command is `scripts/public-release.ts`. It is the only
supported path for publishing the public Savant-Code npm package, with the SDK included
only when it is explicitly in the release scope.

## Commands

```bash
# Validate repository identity, version metadata, and the current CHANGELOG section.
# This never changes settings, stages files, commits, tags, GitHub, or npm.
bun run release:public:preview

# Manual mode: run the complete release transaction after an interactive RELEASE confirmation.
bun run release:public

# Continue a recorded partial release after a failure.
bun run release:public:resume

# Run the exact local build/typecheck/test/lint/format/package gates read-only.
# This never tags, pushes, creates a GitHub release, or publishes npm packages.
bun run release:public:diagnose
```

## CLI command flow

The same operations are available as CLI commands — interactively via the `/release`
slash command in the Savant-Code TUI, or standalone in any shell via
`savant-code release <op>` (both share one handler):

```bash
savant-code release status      # version, git position, tag, last receipt + diagnostic evidence
savant-code release preview     # read-only sanity check — never mutates
savant-code release diagnose    # read-only gate manifest with evidence (investigate failures)
savant-code release go          # full release: gates → tag → push → GitHub release → npm publish
savant-code release resume      # continue a recorded partial release after a failure
```

In the TUI, `/release <op>` streams the engine's output into the chat as it runs and
finishes with a summary bubble. The full release runs under the pinned-Bun
self-bootstrap and writes the same `release-receipt/v2` evidence as the npm script
forms. Exit codes for the standalone subcommand: `0` ok, `1` release failure,
`2` usage error.

For the zero-command public-development workflow, set
`SAVANT_CODE_RELEASE_AUTOMATION=1` in the already-configured release environment.
The automation path consumes `GITHUB_TOKEN` (falling back to `GH_TOKEN`), uses the
GitHub REST API directly, performs a token-safe Git push, stages and commits all current
tracked and untracked changes, and does not require the `gh` executable or an interactive
prompt. npm continues to use its existing authentication configuration.

Automation is deliberately opt-in. Without that flag, the normal command remains
interactive and requires `gh` authentication plus a clean worktree. Preview mode always
wins over automation and remains mutation-free.

## Public targets

The workflow is intentionally limited to:

1. `@savant-code/sdk` from `sdk/`
2. `savant-code` from `cli/release/`

When both packages are in scope, the SDK is published first because the CLI release
artifact depends on it. `savant-free` is not public and is never included.

By default only `savant-code` is published. The `@savant-code/sdk` npm scope does not
exist and the SDK is never published in a normal release, so it is catalog-only
(`defaultPublish: false`) and must be opted into explicitly — the release incident at
the end of this file is the case that forced this default. Release `v0.0.21`
intentionally used the CLI-only scope; `savant-code@0.0.21` is public while
`@savant-code/sdk@0.0.21` remains unpublished.

To scope a release to a subset of the public
packages, set `SAVANT_CODE_RELEASE_PACKAGES` to a comma-separated list of package names;
the npm-pack dry-run gates, npm access verification, not-already-published checks,
publishing, and post-publish verification all follow the scope. Any unknown package
name aborts the run fail-closed (a typo can never silently publish less than intended).
The CLI-only scope is the default; explicitly requesting it is still accepted:

```bash
SAVANT_CODE_RELEASE_PACKAGES=savant-code SAVANT_CODE_RELEASE_AUTOMATION=1 bun run release:public
```

## Transaction order

Manual mode and automation mode share the same release stages:

1. Verify the public `savant0x/savant-code` remote and aligned version metadata.
2. Extract exactly one current-version section from `CHANGELOG.md` for GitHub notes.
3. Validate GitHub and npm authentication. Automation validates the GitHub token with
   the REST API; manual mode validates `gh auth status`.
4. Snapshot the release routing environment and persisted settings file.
5. In automation mode, stage all current changes and create one
   `chore(release): prepare v<version>` commit. The receipt records the commit and file list.
6. Apply non-secret OpenRouter direct defaults (`openrouter/free`).
7. Run build, typecheck, test, ESLint, Markdownlint, Prettier, and package dry-run gates.
8. Manual mode asks for confirmation listing exact targets. Automation records its explicit
   environment approval and continues without a prompt.
9. Create the annotated tag and push `main` plus the tag with Git. Automation supplies a
   process-only Git extraheader; the token is never placed in argv, URLs, files, or logs.
10. Create or verify the GitHub release. Automation uses the GitHub REST API with the
    extracted changelog section; manual mode uses `gh`.
11. Publish each scoped npm package in public-package order (SDK before CLI when both
    are selected), and record each completed stage.
12. Restore the original local settings and environment in a `finally` path.
13. Verify the public tag, GitHub release, npm artifacts, and package contents.

A non-secret `release-receipt/v2` receipt is written under the operating system temporary
directory. Gate commands use file-backed capture and write complete, secret-redacted transcripts
outside the repository; the receipt stores each command's exit/signal/spawn classification,
attempt, bounded summary, transcript path/hash, and manifest hash. Receipt and transcript writes
are atomic, and resume rejects incomplete or legacy evidence. If publication fails after GitHub
creation, the workflow does not delete public history or unpublish packages. Use the explicit
resume command only after reviewing the receipt and diagnostic transcript.

The diagnostic command is the safe way to investigate a failed gate. It runs the canonical
read-only manifest and writes evidence without changing settings or invoking any public mutation.
The diagnostic is bound to the current HEAD and tracked worktree state: it fingerprints every
tracked file (and untracked, non-ignored path) before and after the gates and rejects the
evidence if any tracked path changed. Ignored artifacts that gates legitimately regenerate (for
example the CLI `debug/` logs or SDK build output) do not reject the evidence; instead, when the
full gate manifest completes, the receipt records the exact ignored paths the gates added or
removed as `ignoredChanges` so an auditor can distinguish expected generated output from
contamination. A worktree that is already
dirty before the diagnostic runs is captured in both fingerprints and does not by itself fail the
run. The release path applies the same tracked-state fingerprint around its gate manifest, so a
concurrent writer that changes tracked files mid-release fails the release before any push; note
that the guard covers the gate window only, so a writer that mutates tracked files after the last
gate but before `git push` is outside the fingerprint boundary (the residual window is seconds,
and resume re-binds to HEAD with the same guard). Timed-out gate children are cleaned up on
Windows only: the full owned descendant tree is
enumerated through the Win32 process table (up to ~20 seconds), terminated with `taskkill /T /F`,
and every enumerated owned PID is verified gone before cleanup is reported successful. Stragglers
are only killed after a fresh process-table read confirms they are still parented inside the
owned tree, so a PID reused by an unrelated process is never terminated. On non-Windows
platforms timeout cleanup remains evidence-only (recorded in the receipt) and the release never
proceeds after a timeout. The release path does not automatically retry a failed gate.
Bun `1.3.14` and npm `10.x` are required before the gate manifest is accepted.

## Release prerequisites

Manual mode requires:

- The operator has prepared and committed the version, changelog, README, and source
  changes before starting the workflow.
- The worktree is clean and `origin` is exactly
  `https://github.com/savant0x/savant-code.git`.
- `gh` is installed and authenticated for the public repository.
- npm is installed and authenticated with publish access to the public packages selected
  for this release.

Automation mode requires:

- `SAVANT_CODE_RELEASE_AUTOMATION=1`.
- `GITHUB_TOKEN` or `GH_TOKEN` with repository release/write permission.
- npm installed and authenticated with publish access to the public packages being
  released.
- (Optional) `SAVANT_CODE_RELEASE_PACKAGES` to scope npm targets to a subset of
  `@savant-code/sdk` / `savant-code`.
- The process is allowed to create the release commit; all current tracked and untracked
  worktree changes are intentionally included by policy.

Both modes require the current version to be present exactly once as a
reverse-chronological `CHANGELOG.md` heading and all checked package manifests to match
`VERSION`. The script never copies API, GitHub, or npm credentials into the release
profile.

Bun `1.3.14` (pinned by `.bun-version`) and npm `10.x` are required for every gate
manifest. The script self-bootstraps the pinned Bun: at startup it verifies the `bun`
on PATH; if it is not `1.3.14`, it probes the version-pinned install
(`~/.bun-1.3.14/bin/bun` first, then the standard `~/.bun/bin/bun`) and prepends the
matching install's bin directory to the process PATH so every `bun`/`bunx` gate command
resolves to the required version. When neither PATH nor a pinned install provides
`1.3.14`, the run fails closed with install guidance. No manual PATH editing is needed
for daily pushes.

## Next release checklist

Prepare the next version before invoking the mutation flow:

1. Update `VERSION`, the root `package.json`, `cli/package.json`,
   `cli/release/package.json`, and `sdk/package.json` to the same version.
2. Add exactly one reverse-chronological `v<version>` heading and release notes to
   `CHANGELOG.md`.
3. Run the read-only checks:
   ```bash
   bun run release:public:preview
   bun run release:public:diagnose
   ```
4. The default publication policy is CLI-only, so run:
   ```bash
   SAVANT_CODE_RELEASE_AUTOMATION=1 bun run release:public
   ```
   (`SAVANT_CODE_RELEASE_PACKAGES=savant-code` is still accepted but no longer
   required — the SDK is opt-in via that variable.)
5. If a mutation stage fails, inspect the receipt and transcript, fix the cause, then
   use the same package scope with `bun run release:public:resume`.

To publish the SDK in a future release, explicitly opt it in (the default is
CLI-only):

```bash
SAVANT_CODE_RELEASE_PACKAGES=@savant-code/sdk,savant-code \
SAVANT_CODE_RELEASE_AUTOMATION=1 bun run release:public
```

## Safety boundaries

The automation mode is not a hidden background release: it is enabled only by an explicit
environment flag and fails closed on missing credentials, unexpected GitHub HTTP statuses,
malformed API responses, mismatched tags, changed resume HEADs, failed local gates, and npm
publication errors. Preview never commits or calls a mutating external endpoint.

## Release incident: v0.0.24 — phantom dependency shipped without binaries

**Date:** 2026-08-16 · **Severity:** high · **FID:** `FID-2026-0816-001` (archived)

### What happened

`v0.0.24` was committed (`05f829a`), tagged, GitHub-released, and published to npm, but
its `build-release-binaries.yml` run failed on all 5 platforms at the `Build binary`
step: `error: Could not resolve: "@noble/hashes/sha512"` at
`common/src/crypto/keys.ts:2:24`. The GitHub release shipped zero binary tarballs.

### Why the impact was limited to missing binaries (the launcher pattern)

The npm `savant-code` package is a thin launcher: `index.js` → `launcher.js` downloads
`https://github.com/savant0x/savant-code/releases/download/v<version>/savant-code-<platform>.tar.gz`
and extracts it. The tarball ships zero CLI source and its only dependency is `tar`, so
the npm package itself was never broken — only the GitHub binaries were missing. A
release that appears broken is therefore usually a **missing-binaries** problem, not a
broken npm tarball: verify the GitHub release assets before assuming the npm package
needs a bump.

### Root cause chain (why every local gate was green)

1. The ZTAP provenance code imports `@noble/hashes/sha512` (`common/src/crypto/keys.ts`).
2. `@noble/hashes` was never declared in `common/package.json` nor locked in `bun.lock`.
3. Locally, the import resolved from `C:\Users\spenc\node_modules\@noble\hashes` — a
   node_modules **outside the repo** (a phantom hoist left by another project) — so
   typecheck, the full test suite, and all 13 diagnostic gates passed.
4. Only CI's fresh checkout had nothing up-tree to resolve against, so the compile
   failed — after the release was already live.

### The fix (commits `5a55a3b`, `8bfced0`)

- `common/package.json` declares `@noble/hashes ^1.8.0`; `bun.lock` locks it at `1.8.0`.
- `PUBLIC_PACKAGES` in `scripts/public-release.ts` defaults to `savant-code` only; the
  SDK is catalog-only (`defaultPublish: false`) and opt-in via
  `SAVANT_CODE_RELEASE_PACKAGES`. This also ended the SDK-scope publish wall that
  killed the original 0.0.24 run and forced an out-of-pipeline npm publish.
- `scripts/validation-manifest.ts` adds the `cli-bundle-resolution` release gate
  (`bun build cli/src/index.tsx --target=bun`, output to the gitignored `cli/bin/`) —
  the exact CI failure phase now blocks the release **before** commit/tag/publish.
- The asset-verify failure message and the workflow's `source_ref` input now require a
  **branch or tag** (a bare commit SHA fails `actions/checkout`).

### Remediation flow for a release that shipped without binaries

1. Fix the root cause; commit and push to `main`.
2. Dispatch the binary workflow with a **branch/tag** source ref — never a bare SHA:

   ```bash
   # release_tag = the broken release tag; source_ref = the branch carrying the fix
   # POST /repos/savant0x/savant-code/actions/workflows/build-release-binaries.yml/dispatches
   # {"ref": "main", "inputs": {"release_tag": "v0.0.24", "source_ref": "main"}}
   ```
3. Watch the run and confirm all 5 tarballs land on the release
   (`savant-code-{linux-x64,linux-arm64,darwin-x64,darwin-arm64,win32-x64}.tar.gz`).
4. Do **not** bump the version for a pure binary backfill: the npm launcher serves
   whatever release its version points at, so once the binaries exist the existing npm
   version works. npm never allows republishing a version anyway.

### Prevention guardrails (current state)

| Layer | Guard |
| --- | --- |
| Pre-ship | 14-gate release manifest incl. `cli-bundle-resolution` (`release:public:diagnose`) |
| Publish set | Default = `savant-code` only; SDK opt-in |
| Post-ship | `verifyReleaseAssets` polls for all 5 tarballs and fails closed |
| CI | Binary workflow fails loudly per platform; `verify-release-assets` job asserts all 5 |

### Rules for future release sessions

- Run `bun run release:public:diagnose` and confirm 14/14 gates before any release.
- After `bun install --frozen-lockfile`, a source import must resolve from the repo's
  own node_modules — a resolution that only works from a node_modules outside the repo
  is a defect (LEARNINGS: "Undeclared imports can ride a phantom node_modules").
- The npm package is a launcher: check GitHub release assets, not the npm tarball, when
  a release appears broken.
- Backfill dispatches take a branch/tag `source_ref`, never a SHA (LEARNINGS:
  "workflow_dispatch source_ref must be a branch or tag, not a SHA").

See also: `dev/fids/archive/FID-2026-0816-001-*.md` and the two LEARNINGS entries
referenced above.
