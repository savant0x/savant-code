# FID: Clean Linux test portability

**Filename:** `FID-2026-1015-003-clean-linux-test-portability.md`
**ID:** FID-2026-1015-003
**Severity:** high
**Status:** closed
**Created:** 2026-10-15
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

A clean Docker build succeeds, but its root tests expose synthetic code-search
directories and missing PID 1 child reaping. Repair the test inputs and container
init configuration without weakening production directory validation.
The completed repair also removes undeclared packaging dependencies, private
environment and native-binary assumptions, preserves Unix executable modes,
and repairs Linux path handling exposed by the previously masked tests.

## Environment

Windows host; Debian Linux container; Bun 1.3.14; baseline HEAD e000c44c.

## Detailed Description

### Problem

The SDK gate stops the root test command with 746 pass and 30 fail on Linux.

### Expected Behavior

Tests use existing directories and container subprocesses are reaped.

### Root Cause

The four mocked code-search suites pass `/test/project`, although the executor
requires an existing directory. A container without an init leaves terminated
descendants as zombies, so the process-group cleanup assertion remains true.

### Evidence

`sdk/src/tools/code-search/executor.ts:81` rejects missing directories before
spawn. `sdk/src/__tests__/code-search-part-d.test.ts:50` uses a synthetic path.
The Linux root run reports `746 pass`, `30 fail`. A focused run with Docker
`--init` reports `10 pass`, `0 fail`, including process-group cleanup and the
live ripgrep directory test. Logs: `dev/scratchpad/clean-linux-container-tests.log`
and `dev/scratchpad/clean-linux-focused.log`.

## Impact Assessment

### Affected Components

Dockerfile, README, CLI packaging dependency, workspace test preloads, shared
path helpers, SDK fixtures, native vendor modes, desktop test runner, scope
and session records.

### Risk Level

High: the documented clean-container test command failed and the newly exposed
path regressions included containment and symlink checks. Search directory
validation stays strict; existing security assertions remain enabled.

## Proposed Solution

### Approach

Replace synthetic mocked search roots with `process.cwd()`. Install Debian
`tini` and use it as the container entrypoint, preserving CMD override support.

### Steps

1. Implemented: repair synthetic roots and self-contained environment fixtures.
2. Implemented: add init, pinned tools, safe defaults and required dependencies.
3. Implemented: verify root tests, static gates, Docker build and CLI smoke checks.
4. Implemented: commit explicit paths and archive with implementation evidence.

### Verification

Run the existing code-search suites and process diagnostics tests, then the
documented root command in the Linux container. No tests are skipped or removed.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck desktop
- gate: test sdk/src/__tests__/code-search-part-a.test.ts
- gate: test sdk/src/__tests__/code-search-part-b.test.ts
- gate: test sdk/src/__tests__/code-search-part-c.test.ts
- gate: test sdk/src/__tests__/code-search-part-d.test.ts
- gate: test sdk/src/__tests__/run-terminal-command.test.ts
- gate: test cli/src/__tests__/release/wrapper-safety.test.ts
- gate: test cli/src/__tests__/release/wrapper-safety-launcher.test.ts
- gate: test common/src/__tests__/env-bootstrap.test.ts
- gate: test common/src/util/__tests__/paths.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/path-canonicalization.test.ts
- gate: probe desktop/scripts/test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e573cb97a78e2651f41f595c0cd3e5f67f96ff28dae5924f9199877d4b1abd20
- verified: 2026-10-15T20:58:31.580Z
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck desktop: exit 0
- test sdk/src/__tests__/code-search-part-a.test.ts: exit 0
- test sdk/src/__tests__/code-search-part-b.test.ts: exit 0
- test sdk/src/__tests__/code-search-part-c.test.ts: exit 0
- test sdk/src/__tests__/code-search-part-d.test.ts: exit 0
- test sdk/src/__tests__/run-terminal-command.test.ts: exit 0
- test cli/src/__tests__/release/wrapper-safety.test.ts: exit 0
- test cli/src/__tests__/release/wrapper-safety-launcher.test.ts: exit 0
- test common/src/__tests__/env-bootstrap.test.ts: exit 0
- test common/src/util/__tests__/paths.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/path-canonicalization.test.ts: exit 0
- probe desktop/scripts/test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- RED: reproduced 30 failures in a Linux image built from HEAD alone.
- GREEN: use real workspace roots for mocked searches and an init for children.
- AUDIT: executor inspection proves the missing-directory guard precedes spawn;
  the focused `--init` experiment passes all ten assertions.
- ADVERSARIAL: do not create privileged `/test` directories or bypass guards;
  do not suppress process-cleanup assertions.
- CHANGE DELTA: initial plan.

### Missed Questions

1. Does ripgrep execute on Linux? Yes, the vendored binary reports 14.1.1.
2. Is the process failure reproducible with an init? No; the focused run passes.
3. Does a custom command still work? Tini forwards CMD and Docker overrides.

### Loop 2 — Independent audit and self-correction

The initial Windows-context image had executable permissions, but this did not
prove Git's stored modes. The later exact-tree audit exposed and repaired those
modes without changing binary contents. No production search bypass was added.

### Implementation Evidence (REQUIRED for `closed`)

- **Commit SHA:** `d94e30c7` contains the scoped implementation; `a707aa89`
  restores that exact tree plus the four executable vendor modes; `7c1af232`
  adds the cross-host file-URL fixture correction.
- `Dockerfile:1` pins both image digests; `desktop/scripts/test.ts:15` invokes
  the existing sidecar builder before tests; `common/src/util/paths.ts:65`
  checks symlink entries before ascending missing ancestors.
- All seventeen declared gates passed; the receipt above records their exits.
- Full Linux root command: 9,213 pass / 17 skip / zero fail on isolated source
  with the corrected vendor modes. The working checkout run passed 9,162 /
  17 skip / zero fail; its staged retirement changes are excluded from commits.
- Full root typecheck and ESLint passed. Docker build from the isolated Git
  tree passed; CLI reports 0.0.36 as UID 1000, Bun 1.3.14, Node 22.20.0.
- Existing skips were preserved; no new test skip or assertion removal.

### Code Verification Evidence

Production callers remain in the write handlers and checkpoint store;
`packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts:94` invokes the
shared containment helper. Runtime enforcement and pre-write gates consume
canonicalizePath. Native vendor blob hashes are unchanged; modes are 100755.

## Resolution

- **Closed Date:** 2026-10-15
- **Archived:** 2026-10-15
- Fix: clean Linux build, runtime and root tests no longer depend on this
  workstation's environment, synthetic directories, ignored binaries or modes.
- Tests Added: one sibling-prefix containment regression; existing portability
  and live sidecar regressions remain enabled.
- Verification: root Linux suites, seventeen FID gates, Docker build/CLI smoke,
  root typecheck, ESLint, Markdown lint and scoped formatting.

The initial implementation commit was followed by an erroneous empty-index
commit `a1b5e7d2`. Working files were never removed; `a707aa89` restored the
verified source plus executable modes. History is preserved and nothing was
pushed. The isolated source tree was rechecked after the correction.

### Linux root-suite follow-up

After SDK repairs, all 776 SDK tests pass. The CLI gate then exposes an
undeclared source-test dependency: `cli/release-core/launcher.js:14` requires
`tar`, but only the non-workspace release package declares it. A fresh monorepo
install has no tar, causing two failed wrapper tests and one load error.
Extend the converged repair: declare tar in CLI devDependencies and regenerate
the lockfile through Bun. This changes test dependency availability, not the
published wrapper's dependency contract. Re-run the wrapper and root suites.

The next CLI run reaches the real npm-pack regression and proves npm is absent
from the Bun-only image. Preserve that regression: copy Node 22.20.0 and its npm
from a digest-pinned official Node image, and document Node/npm as native test
prerequisites. This is build/test tooling, not a change of application runtime.

The clean common gate reports 113 environment load errors: workspace-specific
bunfig files load isolation before any test environment defaults. Reuse the
existing SDK environment bootstrap before isolation in common, code-map,
database, knowledge-graph, connectors and desktop. Docker must also supply the
three public boot settings needed before development defaults can apply;
retain the required app URL in the environment template. No credential is baked
into the image and runtime environment overrides remain available.

The unmasked common suite then exposes four existing regressions. Make its
scrubbed-environment test create its own `.env.local` fixture instead of relying
on the developer's file. In the shared path helper, send normalized separators
to realpath resolution and reject dangling/looping symlinks using lstat before
walking to an ancestor. Enforce directory-boundary comparisons so a sibling
whose name shares the root prefix cannot escape containment. Existing Linux
symlink tests cover the repair; add a sibling-prefix rejection regression.

The runtime Linux suite exposes a second separator-order bug: canonicalizePath
resolves a Windows drive spelling as a relative POSIX filename before stripping
the drive. Normalize Windows separators and absolute drive prefixes before
native resolution; keep the existing cross-platform regression and shared
read/write callers unchanged.

All intervening Linux workspaces pass; desktop then proves its live sidecar
integration tests rely on an ignored native binary. Make desktop's one test
command compile the native sidecar through the existing build pipeline before
running its unchanged suites. Select from the existing target table, fail
clearly on unsupported targets, and propagate build/test failures. No Rust/Tauri
GUI build is required, and no integration assertion is skipped.

The exact commit-tree image exposes a final difference from the Windows
checkout context: four Unix ripgrep files are tracked as 100644. SDK emits
`775 pass / 1 fail`; invoking its bundled binary proves `Permission denied`.
Set their Git executable modes to 100755 without changing binary bytes. This
repairs fresh native clones as well as Docker; a Docker-only chmod would leave
native Linux broken. Rebuild from the corrected Git tree and repeat the gate.

The cross-host audit catches the environment fixture's child import spelling on
Windows. Pass a file URL encoded as a JavaScript string and use the running
runtime's absolute executable path; do not interpolate native backslashes into
source text or assume a PATH-resolved Bun in a scrubbed child environment.

## Lessons Learned

A successful image build does not establish that its test command is portable.
