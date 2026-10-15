# FID-2026-0807-016 — `/dev` folder and FID lifecycle hygiene

**Filename:** `FID-2026-0807-016-dev-folder-and-fid-hygiene.md`
**ID:** FID-2026-0807-016
**Severity:** medium
**Status:** closed
**Created:** 2026-08-07
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

The `dev/` directory has accumulated active work, historical records, generated
artifacts, and scratch experiments without a consistent boundary. The most
visible issue is `dev/fids/`: eight active FIDs remain in the active directory,
including completed-looking records, while archived FIDs contain historical
status drift. The cleanup must improve navigation without rewriting historical
evidence or deleting development records.

## RED — Evidence

- `dev/fids/` contains eight active FIDs (`0806-017`, `0806-018`, and
  `0807-001` through `0807-006`).
- `0806-017` and `0806-018` look implementation-complete but explicitly retain
  pending operator closure language.
- `0807-003` and `0807-006` retain unresolved browser-runtime or visual-review
  boundaries and must remain active.
- `0807-001`, `0807-002`, `0807-004`, and `0807-005` retain analysis or runtime
  review work and must remain active.
- Historical duplicate numeric IDs exist for `FID-2026-0805-006` and
  `FID-2026-0805-007`. Renaming them would risk breaking historical references.
- `dev/scratchpad/` contains one-off probes, generated dumps, test databases,
  research notes, and reusable validation scripts together at its root.
- `dev/nova/`, `dev/session-summaries/`, and `dev/test-prompts/` already have
  archive boundaries; their historical contents should not be rewritten.

## GREEN — Approved cleanup

1. Add `README.md` navigation/index files to `dev/`, `dev/fids/`,
   `dev/fids/archive/`, and `dev/scratchpad/`.
2. Keep all eight unresolved active FIDs in `dev/fids/`; do not falsely close
   or archive them.
3. Add a FID lifecycle inventory documenting active status, review boundary,
   duplicate historical IDs, and the archive rule.
4. Create `dev/scratchpad/active/` and move the currently reusable real-export
   validator there: `regenerate-and-measure.ts`.
5. Move older scratchpad experiments and result artifacts into
   `dev/scratchpad/archive/`, grouped into `graph-export/`, `benchmarks/`, and
   `runtime/` subdirectories. Preserve every file byte-for-byte.
6. Leave `dev/nova/`, `dev/session-summaries/`, and `dev/test-prompts/` in
   place except for navigation documentation; they are historical/audit
   channels, not scratchpad material.
7. Do not rename duplicate FID files, delete files, rewrite historical FID
   prose, or move generated `dev/exports/` output.
8. Update current documentation references if a moved scratchpad path is named
   by a live changelog or README entry.

## AUDIT — Verification plan

- Confirm all active FIDs remain present and all moved files exist at exactly
  one destination.
- Confirm no source file was deleted and no duplicate FID filename was renamed.
- Confirm active FID statuses and unresolved review boundaries remain unchanged.
- Run Prettier and markdownlint on new/modified Markdown files.
- Run a move/reference audit for moved scratchpad paths.
- Review `git diff --summary` and `git status` for unintended changes.

## Resolution

- **Fixed Date:** 2026-08-07
- **Fix Description:** Added `/dev` navigation documentation; split scratchpad
  into `active/` and categorized `archive/` areas; moved 24 retained scripts,
  probes, logs, dumps, and databases without deleting or rewriting them; fixed
  the two live changelog paths affected by the moves.
- **Tests Added:** No code tests; move/reference audit performed.
- **Verified By:** Prettier clean; markdownlint clean; all expected moved paths
  present; no stale moved scratchpad references; active FIDs with unresolved
  review boundaries remain active; duplicate historical FID names unchanged.
- **Archived:** 2026-08-07 after move/reference audit.

## Lessons Learned

`dev/` is an audit surface, not a general dumping ground. Active work,
historical evidence, generated output, and disposable experiments need explicit
boundaries, while historical FID identifiers and prose must remain immutable.
