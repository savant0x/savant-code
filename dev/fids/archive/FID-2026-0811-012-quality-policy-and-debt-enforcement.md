<!-- markdownlint-disable MD013 -->

# FID: Quality Policy and Maintainability Debt Enforcement

**Filename:** `FID-2026-0811-012-quality-policy-and-debt-enforcement.md`
**ID:** FID-2026-0811-012
**Severity:** medium
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`, `FID-2026-0811-010`

> Planning-only. This FID does not authorize a broad decomposition rewrite.

## Summary

The repository documents substantial quality limits but marks them advisory: `protocol.config.yaml:49-78` states that
file length, testing, and FID limits are not enforced. The audit found production outliers including
`scripts/public-release.ts` at 2,849 lines, `cli/src/constants/savant-logo.ts` at 920, `common/src/constants/savant-free-models.ts`
at 855, `cli/scripts/build-binary.ts` at 739, and `agents/context-pruner/main.ts` at 621, plus representative unsafe-type and error-handling patterns. Production type/error remediation is separately tracked
in FID-2026-0811-014. The robust path is a staged measurable policy with an explicit debt ledger and regression prevention,
not an immediate hard gate that would strand the repository.

## Evidence

- `protocol.config.yaml:49-57` defines quality limits but explicitly calls them advisory.
- `protocol.config.yaml:63-78` defines aspirational testing and FID limits that are not fully enforced.
- Audit inventory measured the largest production files above; generated/test/config exceptions must be classified.
- `ECHO.md:700-714` includes file-length, error, security, documentation, and no-TODO audit checks.
- Representative production unsafe surface: `common/src/browser-actions.ts:94` uses `Record<string, any>`; generated
  `any` is handled separately by child 010.

## Expected behavior

The quality policy states what is enforced, what is advisory, and what is legacy debt. New regressions are blocked or
warned according to an explicit staged threshold. Existing debt has owners, scope, and an exit path. Tests and generated
artifacts are measured separately from production code.

## Proposed solution

1. Inventory source, tests, generated artifacts, fixtures, docs, and intentional exceptions.
2. Create a versioned debt ledger with baseline counts and rationale for each exception.
3. Add a read-only quality report first; do not hard-gate current debt before a baseline exists.
4. Introduce ratcheting: new or modified files cannot worsen the baseline; later phases lower thresholds.
5. Prioritize giant cohesive modules through separate implementation FIDs; defer production type/error remediation to
   FID-2026-0811-014.
6. Add function complexity, line length, TODO-without-FID, and test coverage signals only where tooling is reliable.
7. Ensure generated type findings defer to child 010 and historical artifacts defer to child 006.

## Verification contract

- Quality report is deterministic and classifies every finding.
- Baseline and debt ledger are versioned and validated.
- Ratchet tests fail on new debt and pass on unchanged legacy debt.
- No hard gate is introduced without a migration path and measured false-positive review.
- Typecheck, tests, lint, format, and repository validation pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** Quality rules are documented but advisory; large files and unsafe patterns remain measurable debt.
- **GREEN:** Establish baseline/report/ratchet phases, with exception classes and separate implementation FIDs for real
  decompositions.
- **AUDIT:** Exact config, ECHO checklist, file metrics, and representative type evidence are cited above.
- **ADVERSARIAL:** A universal 300-line hard gate would be counterproductive and would conflate generated assets, tests,
  cohesive data, and production logic. The plan requires classification first.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found that unsafe types, error handling, TODO policy, file length, and testing were too broad for one
  implementation child and overlapped other FIDs.
- **GREEN:** Narrowed this child to inventory, baseline, exception classification, and ratcheting mechanics. Production
  type/error remediation is now exclusively child 014; generated surfaces remain child 010.
- **AUDIT:** Config evidence is `protocol.config.yaml:49-78`, ECHO checklist evidence is `ECHO.md:700-714`, and the
  representative production type evidence is `common/src/browser-actions.ts:94`. No remediation is claimed.
- **ADVERSARIAL:** The child cannot close merely because a report exists; the ratchet must be deterministic and prove it
  does not hide legacy debt or create a hard gate without migration.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Should every file be forced under 300 lines? → No; use language overrides and explicit generated/data/test classes.
2. Is a warning enough forever? → No; ratchet new debt immediately and schedule legacy reduction.
3. Should `any` be eliminated in tests? → Prioritize production/shipped surfaces; test exceptions must be explicit.
4. Can decomposition change behavior? → Only under child FIDs with byte/differential and runtime proof.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The implementation audit confirmed quality limits were advisory and no deterministic debt boundary existed.
- **GREEN:** Added `scripts/quality-report.ts`, a checked-in `dev/quality-baseline.json` covering 1,296 production TS/TSX files, a root `quality:report` command, and repository-validation integration. Tests/generated files are excluded; existing debt is baselined and new increases fail.
- **AUDIT:** `bun run quality:report` → `quality: PASS (1296 baselined files)`. `bun test scripts/quality-report.test.ts` passes both current-baseline and synthetic-ratchet cases. `bun run validate:repository` → `validation: PASS`; ESLint and Prettier pass.
- **ADVERSARIAL:** The report is read-only and does not demand immediate legacy decomposition; it blocks only untracked growth over the measured baseline, preserving the child-014 scope boundary.
- **CHANGE DELTA:** Quality report, baseline ledger, root command, repository gate, and regression tests.

### Code Verification Evidence

- [x] Deterministic production inventory and baseline ledger implemented.
- [x] Ratchet regression test proves baseline increases fail.
- [x] Root quality command and repository-validation caller wired.
- [x] Quality report and repository validation pass; formatting/lint pass.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Maintainability debt is now measurable and cannot silently increase beyond the checked-in baseline.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

An unenforced quality bar is not a quality system. A ratcheted baseline turns existing debt into a bounded migration rather
than a permanent contradiction between policy and reality.
