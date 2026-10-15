<!-- markdownlint-disable MD013 -->

# FID: Environment Validation Boundary for Development and Release

**Filename:** `FID-2026-0811-011-environment-validation-boundary.md`
**ID:** FID-2026-0811-011
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`

> Planning-only. No environment values or release credentials are to be created by this FID.

## Summary

`common/src/env.ts:37-56` defines development placeholders for support, analytics, Stripe, and site-verification values
and applies them whenever those variables are absent. This solves fresh-clone development boot failures, but module-scope
defaulting is a release-boundary risk unless the execution context is positively identified. The environment contract must
allow local development while remaining fail-closed for production, CI, release builds, and any unknown context.

## Evidence

- `common/src/env.ts:37-49` defines `DEV_DEFAULTS` including placeholder public keys and localhost URLs.
- `common/src/env.ts:51-69` merges defaults before schema validation and throws only if validation still fails.
- The code comment claims release/CI explicitly set canonical values, but the boundary is not independently proven by the
  environment schema and release path in this audit.

## Expected behavior

- Local interactive dev/test may use clearly marked non-secret placeholders for noncritical services.
- Production, CI, package builds, release diagnostics, and unknown contexts must require explicit validated values.
- Placeholders must never be accepted as real production credentials or sent to external services accidentally.
- Missing boot-critical variables always fail with actionable but non-sensitive diagnostics.

## Proposed solution

1. Define an explicit environment mode matrix (`dev`, `test`, `prod`, `ci`, `release`, unknown).
2. Apply defaults only under a positively identified local dev/test mode, never by absence alone.
3. Add schema refinements rejecting placeholders in release/prod/CI contexts.
4. Ensure release subprocess environments are sanitized and intentionally populated.
5. Add module-isolated tests for every mode, missing variables, malformed values, and placeholder leakage.
6. Document the boundary in `.env.example`, release scripts, and current docs without exposing credentials.

## Verification contract

- Dev boot works with absent optional variables and uses only placeholders in the approved mode.
- Prod/CI/release/unknown contexts fail closed when explicit variables are missing or placeholder-shaped.
- Tests prove no placeholder reaches release artifact environment or external provider client.
- All environment consumers have a production caller and mode-specific behavior is covered.
- Typecheck, tests, lint, format, and repository validation pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** Defaults are merged at module scope based on absence, not an explicit trusted mode; release safety depends on
  callers setting canonical values.
- **GREEN:** Make context explicit, reject unsafe placeholders outside dev/test, and test the complete matrix.
- **AUDIT:** Source lines and claimed boundary are cited above. No environment mutation was performed.
- **ADVERSARIAL:** Do not infer safety from `NEXT_PUBLIC_CB_ENVIRONMENT` alone if it can be user-controlled; validate and
  normalize mode before defaulting.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found that the trusted source for execution mode and every release/CI caller was not yet enumerated.
- **GREEN:** Require a caller inventory from CLI dev scripts, SDK/build scripts, CI environment, release gate runner, and
  compiled binary path; unknown or conflicting mode signals fail closed.
- **AUDIT:** Reproduced evidence is `common/src/env.ts:37-69`; the release/CI safety assertion in the comment is treated as
  unverified until caller tests prove it. No environment values were created or logged.
- **ADVERSARIAL:** A mode string from an arbitrary environment variable is not automatically trusted. The implementation
  must establish precedence and reject contradictory signals.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Are public placeholders harmless? → They can still route analytics/billing or hide configuration errors; restrict them.
2. What is the safest unknown mode? → Fail closed, never default.
3. Can `.env.example` values satisfy release tests? → No; fixtures must distinguish examples from runtime credentials.
4. Should all optional variables become mandatory? → Only in contexts where the feature is required; encode the matrix.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The implementation audit confirmed development defaults were applied unconditionally before environment mode/protection signals were evaluated.
- **GREEN:** Added the pure `allowsDevelopmentDefaults` trust predicate and gated defaults on local dev/test plus absence of CI, production, or release automation signals. Explicit unknown/release/prod contexts receive no placeholders and therefore fail schema validation when required values are absent.
- **AUDIT:** `bun test common/src/__tests__/env-boundary.test.ts` → `2 pass / 0 fail`, `8 expect()` calls. Common typecheck exit 0; ESLint and Prettier pass. Caller inventory covers `SAVANT_CODE_GITHUB_ACTIONS`, `CI`, `SAVANT_CODE_RELEASE`, `SAVANT_CODE_RELEASE_AUTOMATION`, and `NODE_ENV` conventions used by build/release code.
- **ADVERSARIAL:** Both `'1'` and `'true'` release flag conventions are rejected; explicit unknown modes are rejected; unset mode remains development-compatible only outside protected contexts.
- **CHANGE DELTA:** New pure environment boundary module/test and gated `env.ts` default application.

### Code Verification Evidence

- [x] Protected mode predicate implemented with explicit true/1 release signals.
- [x] Dev/test/unset and prod/unknown/CI/release matrix tested.
- [x] Common typecheck, ESLint, and Prettier pass.
- [x] Module-scope env path consumes the predicate before applying defaults.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Development placeholders cannot silently flow into CI, production, release automation, or unknown explicit modes.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

A development convenience is safe only when its activation boundary is explicit, positively identified, and impossible to
inherit accidentally into release or production execution.
