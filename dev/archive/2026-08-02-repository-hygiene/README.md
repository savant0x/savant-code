# Repository Hygiene Archive — 2026-08-02

This directory preserves approved untracked artifacts moved during the 0.0.15 documentation and repository-hygiene review.

## Categories

- `recovery-artifacts/` — ESLint and Markdown recovery scripts and reports.
- `scratchpad-scripts/` — Publish, push, retry, and version-sync scratch scripts.
- `release-drafts/` — Historical release-note drafts from the ignored `dev/releases/` staging area.
- `nova-drafts/` — Nova outbox drafts and the related router research report.
- `router-research/` — Two distinct router research documents removed from active documentation locations.

## Provenance and integrity

`MANIFEST.before.json` records each original path, destination, byte count, and SHA-256 hash before the move.
`MANIFEST.after.json` records the post-move verification. All 19 moved files matched their recorded hashes, and no
source file was deleted or overwritten.

## Restoration

To restore an item, move it from its manifest-listed destination back to its original path. Review the manifest first;
no restoration is performed automatically. The archive is intentionally excluded from the Markdownlint corpus because it
preserves historical/session artifacts rather than current documentation.

## Scope boundary

Tracked FIDs, changelog entries, session summaries, active configuration, Git history, and remote state were not moved.
No files were deleted.
