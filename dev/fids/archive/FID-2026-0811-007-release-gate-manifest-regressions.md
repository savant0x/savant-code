<!-- markdownlint-disable MD013 -->

# FID: Release Gate Manifest Regressions and Command Parity

**Filename:** `FID-2026-0811-007-release-gate-manifest-regressions.md`
**ID:** FID-2026-0811-007
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`

> Planning-only. The release system must not be invoked in mutation mode by this FID.

## Summary

The focused governance/release suite currently reports three failures in `scripts/public-release.test.ts`: the expected
root gate prefix/order differs from the manifest, scoped package manifests retain an unexpected dry-run entry, and the
diagnostic manifest length is 12 while the test expects 11. The failure pattern indicates drift between the canonical
`repositoryValidationGates` contract and the release-specific package dry-run assembly. This FID resolves the contract and
its tests without weakening any release gate.

## Evidence

- `scripts/validation-manifest.ts:85-132` defines the canonical root gates, including `protocol-bundle`.
- `scripts/public-release.test.ts:326-374` expects a specific SDK-first manifest and package-gate ordering.
- `scripts/public-release.test.ts:399-429` expects scoped package exclusion.
- `scripts/public-release.test.ts:1191-1203` expects a diagnostic manifest with no public mutation commands and a fixed count.
- The audited focused run returned exit 1 with three failed tests: deterministic manifest, scoped manifest, and diagnostic
  manifest length.

## Expected behavior

- One canonical root gate list is reused by release diagnostics and repository validation.
- Package dry-run gates are appended in deterministic public-package order and respect an explicit package scope.
- Diagnostic mode contains only non-mutating commands; tests assert semantic properties rather than brittle counts where
  appropriate, while still detecting accidental omissions.
- Manifest hashes change when inputs or gate contents change and remain stable for identical inputs.

## Proposed solution

1. Trace `buildGateManifest` and `configuredReleasePackages` to identify whether the implementation or expectations are
   stale; do not blindly alter tests.
2. Make root-gate inclusion and package-scope filtering derive from one canonical function.
3. Decide whether `protocol-bundle` belongs in the root release manifest and update all consumers consistently.
4. Replace magic expected counts with an explicit expected label contract where that improves durability.
5. Add tests for full scope, single-package scope, invalid scope, order, hash stability, and mutation-command absence.
6. Keep the release command path read-only during diagnostics and fail closed on malformed manifests.

## Verification contract

- Targeted `validation-manifest` and `public-release` suites pass with zero failures.
- Manifest labels, commands, arguments, cwd, and hash are deterministic across two independent builds.
- No manifest command matches tag/push/publish/release mutation patterns.
- Production call graph proves repository validation and release diagnostics consume the same canonical gate function.
- Full typecheck, test, lint, format, and markdown gates pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** Three focused release contract tests fail; root gate and package-gate expectations have drifted.
- **GREEN:** Reconcile implementation and contract from the canonical gate source, then harden semantic tests.
- **AUDIT:** Failure names and exact test locations are cited above; no release mutation was executed.
- **ADVERSARIAL:** Do not “fix” the suite by deleting a gate or changing expected counts without proving the intended
  security/release contract. The extra gate may be correct; the contract must decide.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review required stronger evidence than a summarized failure count and required the child to distinguish a stale
  test from an incorrect production manifest.
- **GREEN:** Implementation must capture the exact failing test names, expected/received labels, and current production
  call graph before selecting the correction; semantic label assertions take precedence over count-only edits.
- **AUDIT:** The independent focused run returned exit 1 with three failures; exact test locations are
  `scripts/public-release.test.ts:326-374`, `:399-429`, and `:1191-1203`. No mutation command was executed.
- **ADVERSARIAL:** An extra gate is not automatically a regression. The child remains open to either implementation or test
  correction, but only after the canonical release contract is proven.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Is the extra gate harmful? → Not inherently; determine whether it is canonical and required before changing anything.
2. Can package scope reorder packages? → No; preserve SDK-first deterministic order.
3. Should tests assert only counts? → Prefer labels and command semantics; counts are secondary regression signals.
4. Can diagnostics run public mutations? → Never; fail closed if they do.

### Loop 3 — Final evidence and implementation correction (2026-08-11)

- **RED:** The implementation audit reproduced three stale manifest assertions: the canonical gate contract now includes `protocol-bundle` and `prettier`, and the diagnostic count was stale.
- **GREEN:** Updated only the contract tests. The production manifest remains sourced from `repositoryValidationGates(root)` plus configured package dry runs; no gate was removed or weakened. The manifest test now derives the repository-gate prefix and total count from the canonical sources.
- **AUDIT:** `bun test scripts/pre-push-scan.test.ts scripts/public-release.test.ts scripts/validation-manifest.test.ts` → `74 pass / 0 fail`, `218 expect()` calls. `bun x eslint scripts/pre-push-scan.ts scripts/pre-push-scan.test.ts scripts/public-release.ts scripts/public-release.test.ts scripts/validation-manifest.ts --max-warnings 0` → exit 0. `bun x prettier --check ...` → `All matched files use Prettier code style!`, exit 0. Call-graph proof: `buildGateManifest` consumes `repositoryValidationGates(root)` in `scripts/public-release.ts`, and the focused tests exercise both full and scoped manifests.
- **ADVERSARIAL:** No release mutation command was introduced; the no-mutation test remains green. The count assertion is derived from canonical gate/package sources rather than duplicated as a production constant.
- **CHANGE DELTA:** `scripts/public-release.test.ts` only for FID-007; production release behavior was unchanged.

### Code Verification Evidence

- [x] Canonical gate source and failing test contracts identified.
- [x] Production manifest call graph verified.
- [x] All three stale assertions corrected without weakening the release gate set.
- [x] Focused release/manifest suite: 74 pass / 0 fail; 218 assertions.
- [x] ESLint and Prettier pass on all changed release/manifest files.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Test contracts now match the canonical deterministic gate manifest, including protocol-bundle/prettier gates and derived count/order checks.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

Release gates are APIs. A shared manifest needs one source of truth, deterministic ordering, and tests that assert
semantics rather than accidental list length.
