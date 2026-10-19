# FID: Remediate release dependency advisories and unused backend packages

**Filename:** `FID-2026-1018-014-dependency-release-audit.md`
**ID:** FID-2026-1018-014
**Severity:** high
**Status:** closed
**Created:** 2026-10-18 23:40
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

The release audit identifies advisories in 25 installed packages and unused
backend dependencies that bring a server framework into this CLI monorepo.

## Environment

- **Commit/State:** e26b9ab230f8ebf1df543d819bf0d48a914f0ea4 plus audit changes.
- **Runtime:** Bun 1.3.14, Windows.

## Detailed Description

### Problem / Root Cause / Evidence

`bun audit --json` exits 1. Direct package pins and old transitive resolutions
retain patched vulnerabilities. common/package.json still declares next-auth,
its adapter, pg and stripe without source imports. The sole next-auth source
reference constructs a cookie name and does not import that package.
Root better-sqlite3 has no source imports; the database uses bun:sqlite.

### Expected Behavior

Retain only packages with actual consumers. Resolve available compatible
security updates and validate runtime/build behavior. Explicitly investigate
unpatched advisories instead of hiding them or forcing incompatible majors.

## Impact Assessment

Dependency resolution and build tooling across workspaces. Major upgrades are
limited to Vite/zip development tooling and typescript-eslint 8, which supports
the repository's ESLint 9 instead of installing with incompatible peer warnings.

## Proposed Solution

1. Remove unused backend packages and unused native SQLite dependency/types.
2. Upgrade vulnerable direct pins and the provider-utils override. Refresh
   compatible lockfile resolutions using the package manager.
   Move typescript-eslint to its supported ESLint 9 line while explicitly
   preserving the previous catch-binding lint policy. Remove two runtime
   schemas used only to infer exported types, replacing them with equivalent
   static types; remove adjacent retired commented-out validation branches.
3. Re-audit remaining findings, inspect reachability and available fixes;
   implement and verify any necessary mitigation under this same record.
   Pin YAML 4.3.2 across the tree and patch gray-matter's deprecated
   safeLoad/safeDump engine names to load/dump (the safe YAML 4 defaults).
   This removes the YAML 3 argparse/sprintf chain and updates the lint CLI's
   YAML dependency without changing its load call. Bound braces parser stack
   depth at 128 before constructing recursive-walker input, covering both
   curly groups and parentheses. Persist patches with Bun patchedDependencies.
   Verify normal frontmatter, unsafe-tag rejection, normal glob semantics and
   crafted excessive nesting using a durable dependency-security probe.
   Run that probe as the first pristine-install prebundle step so the standing
   release gate verifies the installed patches before building artifacts.
4. Run typecheck, workspace tests, SDK build/verification and desktop build.
   Record any advisory lacking an upstream fix with exact evidence.

### Verification

Use package audit output, complete existing workspace suites and builds.
No new behavior-mirroring test is required for manifest-only updates.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck desktop
- gate: typecheck packages/agent-runtime
- gate: probe scripts/scripts-typecheck-check.ts
- gate: probe scripts/probes/dependency-security.ts
- gate: test scripts/__tests__/clean-install-bundle.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:93108416ebe446952d59eb571864e3586cdbea422e0647b25627e64986dea167
- verified: 2026-10-19T02:47:09.850Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck desktop: exit 0
- typecheck packages/agent-runtime: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- probe scripts/probes/dependency-security.ts: exit 0
- test scripts/__tests__/clean-install-bundle.test.ts: exit 0
- quality: exit 0

## Perfection Loop

- RED: inspect installed advisory data and source import reachability.
- GREEN: remove unused owners, use compatible fixed releases first.
- AUDIT: typecheck and build consumers rather than assuming semver safety.
- ADVERSARIAL: gray-matter requires js-yaml 3 safeLoad; a forced YAML 4
  override alone would break it. Patch its engine explicitly and test normal
  and hostile frontmatter. Bun 1.3.14 ignores scoped overrides; regenerate
  the lockfile from declared ranges and use only supported top-level pins.

### Missed Questions

1. Are all advisories patched upstream? No. braces and sprintf-js currently
   have no published fixed version. Investigate actual ownership and mitigation.
2. Are native SQLite packages required? The source uses bun:sqlite; the only
   better-sqlite3 mention outside manifests is a descriptive comment.

### Code Verification Evidence

Root manifests remove seven unused packages including native SQLite types;
common MCP, lodash, Vite and zip tooling have been updated. The persisted Bun
patches and top-level compatible overrides load through real SDK consumers.
Full 14-workspace/scripts typecheck, SDK build and compatibility verification,
desktop renderer build and the hostile-input security probe pass. The first
pristine bundle resolves all 2,840 inputs within its own fresh installation.
The new standing prebundle security step is covered by 15 engine tests.
The raw registry audit still reports patched braces@3.0.3; no zero-advisory
claim is made. Committed as `60c50a67`.

**Closed:** 2026-10-19
**Archived:** 2026-10-19

## Resolution

Verified implementation committed as `60c50a67`; closure follows the committed
hash and the refreshed gates rather than the pre-commit prose above.

## Lessons Learned

Unused dependencies enlarge the release attack surface even without imports.
