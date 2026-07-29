# FID: A-Z Test Gap Cleanup — Stale References + Missing v0.0.8 Coverage

**Filename:** `FID-2026-0728-001-az-test-gap-cleanup.md`
**ID:** FID-2026-0728-001
**Severity:** medium
**Status:** fixed
**Created:** 2026-07-28 12:00
**Author:** Savant (MiMo V2.5)

---

## Summary

A-Z test run on v0.0.8 revealed: (1) a stale `freebuffModelPreference` migration key in `cli/src/utils/settings.ts` line 151, (2) the A-Z test prompt missing v0.0.8 feature coverage (permissions, sandbox, login, goal alias, .savant-code/ rename). Initial scan found 8 potential issues; converged analysis narrowed actionable scope to 1 code change + 1 documentation update.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript / Bun >= 1.3.11
- **Tool Versions:** Savant-Code v0.0.8
- **Commit/State:** 0b72fea (chore(release): v0.0.8)

## Detailed Description

### Problem

1. `cli/src/utils/settings.ts` line 151 references `freebuffModelPreference` — a migration fallback from the `.freebuff/` → `.savant-code/` rename in FID-2026-07-27-002. This is stale dead code that should be removed since the migration window has passed.

2. The A-Z test prompt `dev/test-prompts/release-az-test-fid-2026-0726-001.md` covers v0.0.7 goal/loop features (24 tests across 6 tiers) but has zero coverage for v0.0.8 features.

### Expected Behavior

1. No stale `freebuff` references in production source code.
2. A-Z test prompt covers all shipped features including v0.0.8.

### Root Cause

1. The `.freebuff/` → `.savant-code/` rename (FID-2026-07-27-002) left a migration fallback key that was never cleaned up.
2. The A-Z test prompt was written for v0.0.7 goal/loop features and was not updated when v0.0.8 shipped.

### Evidence

```text
$ grep -rn 'freebuff' cli/src/utils/settings.ts
(before fix) 151:  const savantFreeModelPreference = obj.savantFreeModelPreference ?? obj.freebuffModelPreference ?? obj.savantFreeModelPreferenceLegacy
(after fix) exit code 1 — CLEAN

$ grep -rn 'freebuff' cli/src/ packages/agent-runtime/src/ common/src/ sdk/src/
(after fix) exit code 1 — CLEAN (zero matches in production source)

A-Z test report: dev/scratchpad/release-az-test-fid-2026-0726-001-report.md
Result: 22 PASS / 1 WARN (now resolved) / 1 NOT TESTED
```

## Impact Assessment

### Affected Components

- `cli/src/utils/settings.ts` — stale migration key at line 151
- `dev/test-prompts/release-az-test-fid-2026-0726-001.md` — missing v0.0.8 test coverage

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. Remove the `freebuffModelPreference` migration fallback from `settings.ts`. Keep `savantFreeModelPreference` as canonical + `savantFreeModelPreferenceLegacy` as intermediate migration key (one more version).
2. Add Tier 7 (Tool Safety & Sandbox Engine) and Tier 8 (Brand & Login Restorations) to the A-Z test prompt.

### Steps

1. ✅ Read `cli/src/utils/settings.ts` fully (0-EOF) in RED phase.
2. ✅ Remove `?? obj.freebuffModelPreference` from line 151 migration chain.
3. ✅ Read the A-Z test prompt fully.
4. ✅ Add Tier 7: Tool Safety & Sandbox Engine (T7.1-T7.8).
5. ✅ Add Tier 8: Brand & Login Restorations (T8.1-T8.4).
6. ✅ Run typecheck (4/4 pass) + lint (zero warnings).
7. ✅ FID status updated to fixed.

### Verification

1. ✅ `grep -rn 'freebuff' cli/src/` returns CLEAN (exit code 1).
2. ✅ `cd cli && bun run typecheck` passes.
3. ✅ `cd common && bun run typecheck` passes.
4. ✅ `cd packages/agent-runtime && bun run typecheck` passes.
5. ✅ `cd sdk && bun run typecheck` passes.
6. ✅ A-Z test prompt now has 36 tests across 8 tiers.

## Perfection Loop

### Loop 1

- **RED:** Cataloged 8 issues via Detective. File path corrected: `cli/src/components/settings.ts` → `cli/src/utils/settings.ts`.
- **GREEN:** settings.ts fix applied. A-Z test prompt updated with Tier 7 + Tier 8. CHANGE DELTA: ~15% (settings.ts: 1 line removed; test prompt: ~80 lines added).
- **AUDIT:** Verifier found 1 issue — math error in Summary table (40 → 36). Fixed in self_correct.
- **CHANGE DELTA:** 1 line code change + 80 lines documentation.

### Missed Questions

> *"What questions should I have asked when this FID was created, but failed to?"*

1. **Should `savantFreeModelPreferenceLegacy` also be removed?**
   → **No.** Separate intermediate migration key (not freebuff). Keep for one more version; remove in v0.0.9.

2. **What about `savantCode$1` in settings.ts line 183?**
   → **Leave it.** Same naming convention used across 6+ files. Part of intentional architecture, not a migration artifact.

3. **`savantCode$1` in sdk/src/run.ts line 97 — safe to remove?**
   → **No.** Actively used in `isRunPauseError()` type guard. Breaking SDK change if removed.

4. **Is the CHANGELOG entry contradictory?**
   → **No.** CHANGELOG describes the feature; code provides backward-compat. Not contradictory.

5. **Should we add tests for `validateSettings()` migration logic?**
   → **Out of scope.** Migration logic works correctly; issue was the stale freebuff key, not missing test coverage.

6. **What is the correct file path for settings.ts?**
   → **`cli/src/utils/settings.ts`** (NOT `cli/src/components/settings.ts`).

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes: 4/4 workspaces (cli, common, agent-runtime, sdk)
- [x] Lint passes: zero warnings
- [x] FID status updated to fixed

## Resolution

- **Fixed By:** Savant (MiMo V2.5 via opencode-go)
- **Fixed Date:** 2026-07-28
- **Fix Description:** Removed stale `freebuffModelPreference` migration fallback from settings.ts. Added Tier 7 (8 tests) and Tier 8 (4 tests) to A-Z test prompt covering v0.0.8 features.
- **Tests Added:** 12 new tests (T7.1-T7.8, T8.1-T8.4)
- **Verified By:** Savant (inline typecheck 4/4 + lint + grep verification)
- **Commit/PR:** [pending — to be committed]
- **Archived:** [pending — to be archived after commit]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

1. **Don't skip the Thinker before GREEN.** The FID convergence process exists to catch scope creep and missed questions. Jumping straight to GREEN caused a premature code change (settings.ts) that had to be accounted for retroactively.
2. **File paths in FIDs must be verified in RED.** The initial FID referenced `cli/src/components/settings.ts` but the actual path is `cli/src/utils/settings.ts`.
3. **8 potential issues can converge to 2 actionable ones.** Not every grep hit is a bug. `savantCode$1` and `savantFreeModelPreferenceLegacy` were correctly identified as false positives through systematic analysis.
4. **Test prompts are first-class deliverables.** The A-Z test prompt is a living document that must be updated with every feature release.
