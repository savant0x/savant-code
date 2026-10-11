# FID: Public release gates exclude the unpublished SDK

**Filename:** `FID-2026-1011-002-public-release-excludes-sdk.md`
**ID:** FID-2026-1011-002
**Severity:** high
**Status:** verified
**Created:** 2026-10-11
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The default public release publishes only `savant-code`, but the release gate
manifest reuses the all-workspace validation commands. This runs the SDK build,
typecheck, and tests, including failures in an unpublished package. Use
release-specific validation commands that exclude the SDK workspace while
keeping the full root gates intact for repository development and CI.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Commit/State:** release candidate v0.0.35, local HEAD 0b8e0512

## Detailed Description

### Problem

The release preview targets the CLI npm package `savant-code`. The public
release manifest nevertheless includes `build:sdk`, root `typecheck`, and
root `test`; the latter two chains include the SDK. The release failed before
publishing because 18 SDK tests failed under the release profile.

### Expected Behavior

Public release gates validate the CLI and repository components required by
the public CLI release. They do not build, typecheck, or run the standalone
SDK package. The ordinary root `typecheck` and `test` commands continue to
cover all currently registered workspaces.

### Root Cause

`buildGateManifest` uses `repositoryValidationGates`, the shared all-workspace
gate list. The release package catalog already marks the SDK
`defaultPublish: false`, but that publication setting does not scope build,
typecheck, test, or committed-head compile proof.

### Evidence

- `scripts/public-release/catalog.ts` marks `@savant-code/sdk` as not in the
  default publish set; `savant-code` is the default package.
- `scripts/public-release/gates.ts` currently appends every
  `repositoryValidationGates(root)` gate to the release manifest.
- `scripts/validation-gates.ts` maps `build:sdk` to the SDK build, `typecheck`
  to the root all-workspace typecheck, and `test` to the root all-workspace
  suite.
- Release transcript `C:\Users\spenc\AppData\Local\Temp\savant-public-release-0.0.35-evidence\test-1.log`
  records 658 pass and 18 failures in the SDK stage.

## Impact Assessment

### Affected Components

- `package.json` — release-specific test and typecheck chains.
- `scripts/validation-gates.ts` — release-only gate subset.
- Public release gate manifest and committed-head compile proof.
- Gate contract tests and the release plan preview text.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Add root scripts for release validation that mirror the existing root chains
without the SDK legs. Build a public release validation gate list from the
repository gates while dropping the SDK build and replacing the full root
typecheck/test commands with those release-specific scripts. Keep the
developer-facing all-workspace chains unchanged. Use the release-specific
typecheck for the detached committed-head proof and make the preview describe
the CLI release accurately.

### Steps

1. Add `typecheck:release` and `test:release` root scripts excluding `sdk`.
2. Add `publicReleaseValidationGates` and use it for the release manifest.
3. Use the release typecheck for the release committed-head proof; preserve
   the full typecheck as the clean-checkout default for other callers.
4. Update release-plan wording and tests to assert SDK gates are absent while
   CLI and shared repository gates remain present.

### Verification

The public release manifest excludes SDK build/typecheck/test gates; its
release-specific chains cover all other currently configured release
workspaces. Focused release manifest and committed-head provenance tests pass
(21 tests, 68 expectations), as does the scripts typecheck gate.

### Code Verification Evidence

- `bun test scripts/public-release-gates.test.ts scripts/public-release-provenance.test.ts` — 21 pass, 0 fail, 68 expectations.
- `bun run typecheck:scripts` — exit 0.
- `git diff --check` — exit 0 before commit `6093e7f7`.

## Resolution

Commit `6093e7f7` adds release-only validation chains that omit SDK build,
typecheck, and tests while preserving the full developer and CI chains. Release
manifest and committed-head proof use the release-specific chains.

## Verification Gates

- gate: test scripts/public-release-gates.test.ts
- gate: test scripts/public-release-provenance.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:22f9868699e7ebff3231583cfa74cceeaa1db085d98ef5e8480372f036e5f8a5
- verified: 2026-10-11T19:39:57.289Z
- test scripts/public-release-gates.test.ts: exit 0
- test scripts/public-release-provenance.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The release publishes only the CLI by default but invokes SDK build,
  typecheck, and tests through shared repository-wide commands.
- **GREEN:** Give release execution its own validation chains and gate subset,
  without changing the all-workspace developer commands.
- **AUDIT:** Assert the release manifest excludes SDK-specific gates and uses
  release-specific test/typecheck scripts; retain all other root gates.
- **ADVERSARIAL:** Check committed-head compile proof and ordinary clean-checkout
  verification separately so the change does not silently weaken repository CI.
- **CHANGE DELTA:** Implemented and verified in commit `6093e7f7`.

### Missed Questions

1. Should every repository workspace still be tested by the release? No; the
   user's release target is the CLI package, and the root chains remain the
   place for all-workspace verification.
2. Should shared CLI dependencies disappear from release validation? No; the
   release-specific chains preserve every existing non-SDK workspace leg.
