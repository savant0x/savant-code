# FID: A-Z Test Regression Cleanup After Phase 32

**Filename:** `FID-2026-0726-002-a-z-test-regression-cleanup.md`
**ID:** FID-2026-0726-002
**Severity:** high
**Status:** closed
**Created:** 2026-07-26 10:00
**Author:** Savant Orchestrator

---

## Summary

The full A-Z test run (`bash scripts/run-az-test.sh`) failed with 4 errors after the addition of Phase 32. The failures are pre-existing and not caused by Phase 32, but they block the A-Z gate from passing. This FID tracks the cleanup required to restore a green A-Z run.

## Environment

- **OS:** Windows 10/11 (win32), bash shell
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** ESLint via bun, A-Z script v11
- **Commit/State:** main @ v0.0.7

## Detailed Description

### Problem

Running `bash scripts/run-az-test.sh` after adding Phase 32 produced 4 failures:

| Test | Phase | Failure |
|---|---|---|
| T151 | Phase 29 (ECHO Compliance) | 1 `Record<string, unknown>` shortcut remains in production source |
| T156 | Phase 29 (ECHO Compliance) | `ESLint --max-warnings 0` failed |
| T179 | Phase 31 (Release metadata) | `VERSION` file is `0.0.7` (expected `0.0.6`) |
| T180 | Phase 31 (Release metadata) | Root `package.json` is `0.0.7` (expected `0.0.6`) |

### Expected Behavior

All automatable A-Z phases pass; version expectations reflect the current project version.

### Root Cause

1. **T151:** `packages/agent-runtime/src/context-compactor.ts` line 366 uses `const errorObj = error as Record<string, unknown>`, violating ECHO Law 6 (no type-safety shortcuts).
2. **T156:** `packages/agent-runtime/src/run-agent-step.ts` has accumulated lint issues: an misplaced relative import, inline `import()` type annotations, and an declared-but-unused `preStepTokenCount` variable.
3. **T179/T180:** The project version was bumped to `0.0.7` (VERSION + root `package.json`) but the A-Z script still expects `0.0.6`.

### Evidence

```text
ESLint analysis of the specified workspaces resulted in 5 warnings (0 errors):

File: packages/agent-runtime/src/run-agent-step.ts
  Line 28:1   import/order — ./context-compactor import should occur before ./llm-api/savant-code-web-api
  Line 1096:104 consistent-type-imports — import() type annotations are forbidden
  Line 1112:56  consistent-type-imports — import() type annotations are forbidden
  Line 1130:13  @typescript-eslint/no-unused-vars — 'preStepTokenCount' assigned but never used
  Line 1346:56  consistent-type-imports — import() type annotations are forbidden
```

```text
VERSION: 0.0.7
Root package.json: 0.0.7
cli/package.json: 0.0.6
A-Z script expects: 0.0.6
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/context-compactor.ts`
- `packages/agent-runtime/src/run-agent-step.ts`
- `scripts/run-az-test.sh`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **T151:** Replace `Record<string, unknown>` cast in `context-compactor.ts` with a type guard that checks properties directly.
2. **T156:** Fix all ESLint warnings in `run-agent-step.ts`:
   - Reorder imports so `./context-compactor` comes before `./llm-api/savant-code-web-api`.
   - Replace inline `import('./context-compactor').CompactionMessage[]` type annotations with imported `CompactionMessage` type.
   - Remove unused `preStepTokenCount` variable.
3. **T179/T180:** Update `scripts/run-az-test.sh` Phase 31 expected version from `0.0.6` to `0.0.7`.

### Steps

1. Edit `packages/agent-runtime/src/context-compactor.ts`
2. Edit `packages/agent-runtime/src/run-agent-step.ts`
3. Edit `scripts/run-az-test.sh`
4. Run `bash scripts/run-az-test.sh` to verify all phases pass
5. Run `cd packages/agent-runtime && bun run typecheck`

### Verification

- `bash scripts/run-az-test.sh` exits 0 with no failures.
- `bun x eslint common/src cli/src sdk/src packages/agent-runtime/src --max-warnings 0` exits 0.

## Perfection Loop

### Loop 1

- **RED:** Four A-Z failures cataloged above.
- **GREEN:** Minimal fixes documented in Proposed Solution.
- **AUDIT:** Run A-Z script and ESLint; verify no regressions.
- **CHANGE DELTA:** < 1% of repository.

### Missed Questions

> What questions should I have asked when this FID was created, but failed to?

1. **Why did the version bump not update the A-Z script?** — The A-Z script encodes expected version constants and was not updated when the release was cut. Future releases should include updating the A-Z script's expected version.
2. **Are there other `Record<string, unknown>` shortcuts not caught by T151?** — The code search found several in test files and non-core packages, but T151 only scans `common/src`, `cli/src`, `sdk/src`, and `packages/agent-runtime/src`. The one remaining in production source is in `packages/agent-runtime/src/context-compactor.ts`.
3. **Could the ESLint warnings have been caught earlier?** — Yes; the Phase 29 T156 check already runs ESLint. The warnings were introduced after the last green A-Z run.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes: `cd packages/agent-runtime && bun run typecheck`
- [x] A-Z script passes: `bash scripts/run-az-test.sh`
- [x] FID status updated to reflect actual implementation state

## Resolution

- **Fixed By:** Savant Orchestrator
- **Fixed Date:** 2026-07-26
- **Fix Description:** Remove remaining `Record<string, unknown>` shortcut; fix ESLint warnings in `run-agent-step.ts`; update A-Z script expected version to 0.0.7.
- **Tests Added:** No (existing A-Z script covers regressions)
- **Verified By:** `bash scripts/run-az-test.sh`
- **Commit/PR:** —
- **Archived:** 2026-07-26

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

1. Keep A-Z test script version expectations in sync with `VERSION` and `package.json` at release time.
2. Run ESLint with `--max-warnings 0` before merging to avoid accumulation of lint debt.
3. Prefer type guards over `Record<string, unknown>` casts at trust boundaries.
