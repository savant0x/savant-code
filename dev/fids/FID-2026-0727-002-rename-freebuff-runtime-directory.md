# FID: Rename `.freebuff/` Runtime Directory and Remove Remaining Docs References

**Filename:** `FID-2026-0727-002-rename-freebuff-runtime-directory.md`
**ID:** FID-2026-0727-002
**Severity:** low
**Status:** open
**Created:** 2026-07-27
**Author:** Orchestrator

---

## Summary

The product rebrand from Freebuff to Savant-Code is functionally complete, but the runtime directory `.freebuff/` and some documentation still carry the old name. This FID tracks the remaining cleanup so no product artifact references the old brand.

## Environment

- **OS:** Windows (bash shell)
- **Language/Runtime:** TypeScript / Bun ≥ 1.3.11
- **ECHO Protocol:** v0.2.0

## Detailed Description

### Problem

A review of the working tree revealed at least one remaining Freebuff-branded artifact:

1. Runtime directory `.freebuff/` at the repository root — stores local desktop runtime state (SQLite DB, worktrees, session cache).
2. Documentation in `docs/FreeBuff Business And Backend Research.md` and possibly other files still use the old brand name.

### Expected Behavior

All runtime directories, config files, and docs should use the Savant-Code / Savant branding. The old `.freebuff/` name should be fully replaced and the directory should be ignored by git.

### Evidence

- `.freebuff/` is present in the working tree and already ignored by `.gitignore`.
- `docs/FreeBuff Business And Backend Research.md` exists and is untracked.
- `docs/CLI Agent Inference Backend Research.md` may also contain references.

## Proposed Solution

### Approach

Rename the runtime directory from `.freebuff/` to `.savant-code/` (or another unambiguous Savant-branded name) and update all code references. Audit docs for remaining Freebuff references and either rename the files or update the text.

### Steps

1. Decide the new runtime directory name (`.savant-code/` is preferred to avoid ambiguity with `.savant-free/`).
2. Search the codebase for all references to `.freebuff/` and `freebuff`:
   ```bash
   cd /c/Users/spenc/dev/savant-code
   rg -i "freebuff" --hidden . || true
   ```
3. Update `.gitignore` to ignore the new directory (`.freebuff/` is already ignored; add `.savant-code/`).
4. Update any code that constructs or reads from `.freebuff/` (currently no source references are known; confirm with grep above).
3. Update `.gitignore` to ignore the new directory.
4. Update any code that constructs or reads from `.freebuff/`.
5. Rename or update docs files that use "FreeBuff" / "freebuff".
6. Verify with `git status`, typecheck, and lint.

## Acceptance Criteria

- [ ] `.freebuff/` is no longer referenced in source code, config, or docs.
- [ ] New runtime directory (e.g., `.savant-code/`) is ignored by `.gitignore`.
- [ ] `docs/FreeBuff Business And Backend Research.md` is renamed or updated.
- [ ] `docs/CLI Agent Inference Backend Research.md` is checked for remaining Freebuff references.
- [ ] Full-project typecheck passes.
- [ ] ESLint on touched files passes with zero warnings.

## Known References

- `.gitignore` — already ignores `.freebuff/`.
- `docs/FreeBuff Business And Backend Research.md` — untracked research doc using old brand name.
- `docs/CLI Agent Inference Backend Research.md` — may contain references; audit required.

## Missed Questions

1. **Should the docs be renamed or simply updated in place?** → Prefer renaming files to use `Savant` naming; update any internal links.
2. **Is `.savant/` the right directory name?** → Yes, it aligns with the existing `.savant-free/` directory and is brand-consistent.

---

> When status is set to **Closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.
