# FID: Rename Remaining `freebuff` References

**Filename:** `FID-2026-0727-002-rename-remaining-freebuff-references.md`
**ID:** FID-2026-0727-002
**Severity:** low
**Status:** created
**Created:** 2026-07-27
**Author:** Orchestrator

---

## Summary

The active source code has been fully rebranded from `freebuff` to `savant-free`, but some `freebuff` references remain: (1) the runtime state directory `.freebuff/`, and (2) historical/research docs that mention FreeBuff. This FID tracks the cleanup of these remaining references.

## Environment

- **OS:** Windows (bash shell)
- **Language/Runtime:** TypeScript / Bun ≥ 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** main at v0.0.7, working tree staged for release

## Detailed Description

### Problem

During v0.0.7 release staging, a search for `freebuff` returned 44 matches in CHANGELOG, 32 in research docs, and the runtime directory `.freebuff/`. While the active TypeScript source code has been rebranded (per FID-026, FID-028), the runtime directory and some docs still carry the old name.

### Expected Behavior

All user-facing and runtime artifacts should use the `savant`/`savant-free` naming. Historical CHANGELOG entries may retain `freebuff` when describing the rebrand itself, but runtime directories and docs should not.

### Root Cause

The rebrand FIDs focused on active source code. Runtime state directories and research docs were deprioritized.

### Evidence

```text
.freebuff/  (runtime directory with desktop.db, etc.)
docs/FreeBuff Business And Backend Research.md
docs/Codebuff Rebranding And Migration Plan.md
docs/CLI Agent Inference Backend Research.md
dev/nova/prompts/*
CHANGELOG.md  (historical rebrand entries — may be kept)
```

## Impact Assessment

### Affected Components

- `.freebuff/` runtime directory
- `.gitignore` entry for `.freebuff/`
- Documentation files mentioning FreeBuff

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. Rename the runtime directory `.freebuff/` → `.savant-free/` or `.savant-code/`.
2. Update all code references that read/write to this directory.
3. Update `.gitignore` to reflect the new directory name.
4. Review docs and decide whether to rename them or keep them as historical references.
5. Verify with search that no unexpected `freebuff` references remain in active source/runtime paths.

### Steps

1. Search for all code paths that reference `.freebuff/`.
2. Rename the directory and update code paths.
3. Update `.gitignore`.
4. Rename or annotate docs.
5. Run typecheck, lint, and tests.

### Verification

- `grep -rE '\.freebuff' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' .` returns no matches in active source.
- Full typecheck and lint pass.

## Perfection Loop

### Loop 1

- **RED:** `.freebuff/` runtime directory and docs still reference old brand.
- **GREEN:** Rename directory and update docs; verify no active-source references.
- **AUDIT:** Search + typecheck + lint.
- **CHANGE DELTA:** N/A

### Missed Questions

1. **What is the canonical runtime directory name?** → Determine from existing savant-code conventions (`.savant-code/`, `.savant-free/`, or similar).
2. **Should historical docs be renamed?** → Research docs may be renamed; CHANGELOG historical entries can stay.
3. **Are there environment variables or config paths still using `freebuff`?** → Verify with `grep` across source code.

### Code Verification Evidence

- [ ] All `.freebuff/` references removed from active code
- [ ] Runtime directory renamed and `.gitignore` updated
- [ ] Typecheck passes
- [ ] Lint passes

## Resolution

- **Fixed By:** [To be filled]
- **Fixed Date:** [To be filled]
- **Fix Description:** [To be filled]
- **Tests Added:** No
- **Verified By:** Typecheck + lint + grep
- **Commit/PR:** [To be filled]
- **Archived:** [To be filled]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

- Runtime state directories are easy to overlook during a rebrand.
- Docs and research files should be audited separately from active source code.
