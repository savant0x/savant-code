# FID: Utility-First Audit and Deduplication (Law 13)

**Filename:** `FID-2026-07-24-071-law-13-utility-first-audit.md`
**ID:** FID-2026-07-24-071
**Severity:** medium
**Status:** closed
**Created:** 2026-07-24 17:00
**Author:** Orchestrator

---

## Summary

The monorepo contains approximately 225 exported utility functions across `common/src`, `sdk/src`, `cli/src`, `packages/*/src`, and `agents/`. Law 13 requires "Utility-first, universal logic — one function, one truth." This FID proposes an audit to identify and merge duplicate or near-duplicate functions, consolidate overlapping utilities, and establish clear ownership boundaries so shared logic lives in the lowest-dependency workspace.

## Environment

- **OS:** Windows 11 / win32
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** N/A (code-review and call-graph analysis)
- **Commit/State:** `main` at v0.0.05

## Detailed Description

### Problem

Rapid feature growth has produced overlapping helpers. Examples observed during the audit include:
- Multiple date/time formatting helpers in `common/src/util` and `cli/src/utils`.
- Similar string/path manipulation functions in `sdk/src/tools/path-utils.ts` and `common/src/util/paths.ts`.
- Overlapping spawn/agent ID resolution logic in `common/src/util/agent-name-resolver.ts` and CLI code.

Without consolidation, bug fixes and API changes must be duplicated, and the codebase violates Law 13.

### Expected Behavior

- Every utility has a single canonical implementation.
- Shared utilities live in the lowest-dependency workspace (`common/src/util` for cross-workspace code).
- Higher-level workspaces (`sdk`, `cli`, `packages`) consume shared utilities instead of re-implementing them.

### Root Cause

1. Features were developed in parallel without a shared utility registry.
2. Code reviews focused on local correctness rather than cross-workspan duplication.
3. No automated duplication detection is in place.

### Evidence

```text
Exported functions matching common utility prefixes across source:
  get*, create*, build*, format*, resolve*  etc.

Observed potential overlaps:
  common/src/util/paths.ts  vs  sdk/src/tools/path-utils.ts
  common/src/util/agent-name-resolver.ts  vs  cli/src local helpers
  common/src/util/zoned-time.ts  vs  date helpers elsewhere
```

## Impact Assessment

### Affected Components

- `common/src/util/*`
- `cli/src/utils/*`
- `sdk/src/tools/*`
- `packages/*/src/*`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **Discovery:** Use call-graph grep and fuzzy matching to identify function pairs with similar signatures.
2. **Prioritization:** Score duplicates by (a) number of callers, (b) complexity, (c) risk of change.
3. **Consolidation:** Move shared logic to `common/src/util` (or the lowest appropriate workspace); update imports.
4. **Verification:** Run x4 typecheck + tests + grep for all call sites to ensure no broken imports.
5. **Prevention:** Add a session check (or lint rule) that flags new utilities whose names/signatures overlap with existing ones.

### Steps

1. Generate a catalog of all exported utility functions with signatures.
2. Identify top 10–15 duplication candidates.
3. For each candidate, decide: merge into existing utility, extract new shared utility, or leave as-is if semantics differ.
4. Update imports and delete duplicates.
5. Verify with typecheck, tests, and call-graph grep.

### Verification

- x4 typecheck passes.
- SDK and CLI tests pass.
- Grep confirms all former duplicate call sites now call the canonical function.

## Perfection Loop

### Loop 1

- **RED:** ~225 exported utility functions; several suspected duplicate clusters across workspaces.
- **GREEN:** Audit, prioritize, and consolidate top duplication candidates into canonical shared utilities.
- **AUDIT:** x4 typecheck + tests + call-graph grep for canonical functions.
- **CHANGE DELTA:** Variable; estimated < 1,000 lines across 10–20 files (< 1% of monorepo).

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-25
- **Fix Description:**
  - Removed dead `common/src/util/agent-name-resolver.ts` (zero external references).
  - Moved `getSimpleAgentId` from `cli/src/utils/agent-id-utils.ts` into `common/src/util/agent-id-parsing.ts` and updated CLI component imports (`agent-checklist.tsx`, `publish-confirmation.tsx`).
  - Replaced the local `pluralize` helper in `cli/src/utils/code-search-summary.ts` with the canonical `pluralize` from `@savant-code/common/util/string`.
  - Deleted the thin `cli/src/utils/time-format.ts` wrapper and replaced `formatResetTime`/`formatResetTimeLong` calls with direct `formatTimeUntil` from `@savant-code/common/util/dates`.
  - Left `common/src/util/paths.ts` and `sdk/src/tools/path-utils.ts` separate due to different security/semantic responsibilities (write-safety vs read-lookup).
  - Left `common/src/util/array.ts` `groupConsecutive` and `cli/src/utils/implementor-helpers.ts` `groupConsecutiveBlocks` separate due to different signatures and use cases.
  - Deferred auth/credentials `getConfigDir`/`getCredentialsPath` consolidation due to divergent base directory names (`manicode` in CLI vs `savant` in SDK) and existing test coverage; documented as out-of-scope for this FID.
- **Tests Added:** N/A (no new shared utilities introduced; existing tests updated/continue to pass).
- **Verified By:** x4 typecheck gate + `code-search-summary.test.ts` + `publish-confirmation.test.ts` + call-graph grep for deleted names.
- **Commit/PR:** TBD
- **Archived:** 2026-07-25

## Lessons Learned

- Utility duplication is a tax on every future change.
- Cross-workspace duplication is especially easy to miss without automated detection.
