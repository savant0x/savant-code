# FID: Rename `.freebuff/` Runtime Directory and Remove Remaining Docs References

**Filename:** `FID-2026-0727-002-rename-freebuff-runtime-directory.md`
**ID:** FID-2026-0727-002
**Severity:** low
**Status:** closed
**Created:** 2026-07-27
**Closed:** 2026-07-27
**Author:** Orchestrator

---

## Summary

The product rebrand from Freebuff to Savant-Code is functionally complete, but the runtime directory `.freebuff/` and some documentation still carried the old name. This FID tracks the remaining cleanup so no product artifact references the old brand.

## Environment

- **OS:** Windows (bash shell)
- **Language/Runtime:** TypeScript / Bun ≥ 1.3.11
- **ECHO Protocol:** v0.2.0

## Detailed Description

### Problem

A review of the working tree revealed at least one remaining Freebuff-branded artifact:

1. Runtime directory `.freebuff/` at the repository root — stores local desktop runtime state (SQLite DB, worktrees, session cache).
2. Documentation in `docs/FreeBuff Business And Backend Research.md` and `docs/CLI Agent Inference Backend Research.md` still used the old brand name.

### Expected Behavior

All runtime directories, config files, and docs should use the Savant-Code / Savant branding. The old `.freebuff/` name should be fully replaced and the directory should be ignored by git.

## Proposed Solution

### Approach

Rename the runtime directory from `.freebuff/` to `.savant-code/` and update all code references. Audit docs for remaining Freebuff references and either rename the files or update the text.

### Steps

1. Decide the new runtime directory name (`.savant-code/` is preferred to avoid ambiguity with `.savant-free/`).
2. Search the codebase for all references to `.freebuff/` and `freebuff`.
3. Update `.gitignore` to ignore the new directory.
4. Update any code that constructs or reads from `.freebuff/` (none found in active source).
5. Rename or update docs files that use "FreeBuff" / "freebuff".
6. Verify with `git status`, typecheck, and lint.

## Acceptance Criteria

- [x] `.freebuff/` is no longer referenced in source code, config, or docs.
- [x] New runtime directory (`.savant-code/`) is ignored by `.gitignore`.
- [x] `docs/FreeBuff Business And Backend Research.md` is renamed and updated.
- [x] `docs/CLI Agent Inference Backend Research.md` is annotated with a historical note.
- [x] Full-project typecheck passes.
- [x] ESLint on touched files passes with zero warnings.

## Known References

- `.gitignore` — now ignores `.savant-code/`.
- `docs/Savant-Code Business And Backend Research.md` — renamed from `docs/FreeBuff Business And Backend Research.md`; historical note added.
- `docs/CLI Agent Inference Backend Research.md` — historical note added.

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-27
- **Fix Description:**
  - Removed the duplicate FID `dev/fids/FID-2026-0727-002-rename-remaining-freebuff-references.md`.
  - Archived the kept FID to `dev/fids/archive/FID-2026-0727-002-rename-freebuff-runtime-directory.md`.
  - Updated `.gitignore` to ignore `.savant-code/` instead of `.freebuff/`.
  - Renamed `docs/FreeBuff Business And Backend Research.md` to `docs/Savant-Code Business And Backend Research.md`.
  - Added a historical note to `docs/Savant-Code Business And Backend Research.md` and `docs/CLI Agent Inference Backend Research.md` explaining that the original prose uses legacy product names for historical accuracy.
- **Tests Added:** No
- **Verified By:** grep for `.freebuff/` returns only `.gitignore` (updated) and historical notes; x4 typecheck and SDK tests pass.
- **Commit/PR:** chore(cleanup): rename .freebuff runtime directory and archive FID-002
- **Archived:** 2026-07-27

> When status is set to **Closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.
