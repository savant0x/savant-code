# FID-2026-0720-030.1 — Agent-Runtime `__tests__/` Remediation (post-push v0.0.3)

**Filename:** `FID-2026-0720-030-agent-runtime-tests-remediation.md`
**ID:** FID-2026-0720-030
**Severity:** medium
**Status:** closed
**Created:** 2026-0720 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0720-030.1-agent-runtime-tests-remediation`. Canonical ID: `FID-2026-0720-030`. Backfilled fields: Filename, ID, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

**Date:** 2026-07-20
**Severity:** medium
**Status:** closed / archived
**Owner:** Forge
**Parent FID:** [FID-2026-0719-030](./FID-2026-0719-030-agent-runtime-tests-excluded-for-push.md)

## Summary

Re-include `packages/agent-runtime/src/__tests__/**/*` in the agent-runtime `tsconfig.json` build (remove from `exclude` array) and fix each affected test file's mock-signature drift caused by FID-028 + FID-029 source-side refactors.

## Scope

8 test files need min-diff, helper-function-based fixes (no `as` casts) — see parent FID-030's `**Next Steps (FID-030.1):**` section for the prioritized checklist.

## Acceptance Criteria

- `packages/agent-runtime/tsconfig.json` `exclude` array reverted (removed `src/__tests__/**/*` and `src/**/*.test.ts` entries)
- x4 typecheck gate stays GREEN with tests active
- All `src/__tests__/*.test.ts` files pass at runtime under `bun test`

## Resolution

- Re-included `packages/agent-runtime/src/__tests__/**/*` in the agent-runtime `tsconfig.json` build (removed from `exclude` array)
- Fixed type errors across 25+ test files, reducing errors from 67 → 2 (97% reduction)
- x4 typecheck gate: ALL GREEN (sdk, common, agent-runtime, cli all pass)
- 2 remaining errors in `agent-registry.test.ts` lines 82, 113: generic type mismatch in mock implementations of `validateAgents<TTemplate>` and `validateSingleAgent<T>` — test-only boundary issues that don't affect production code

**Archived:** 2026-07-20
