# 2026-08-02 — 0.0.15 Documentation and Repository Hygiene Closeout

## Scope

Reviewed current documentation for stale 0.0.15, provider, architecture, onboarding, Windows, privacy, and versioning
claims. No GitHub, remote, history, reset, checkout, clean, commit, or publish operation was performed.

## Documentation updates

- Removed the obsolete pre-rebrand checkpoint from `ARCHITECTURE.md`.
- Updated root and Chinese README guidance for the current local/BYOK release and provider onboarding.
- Corrected CommandCode's source-of-truth variable to `COMMAND_CODE_API_KEY`.
- Clarified that CLI `/provider` credentials and SDK backend credentials are separate contracts.
- Updated SDK, npm release, Windows, privacy, versioning, and historical-modes documentation.
- Preserved historical bodies while clearly labeling outdated mode analysis as historical.

## Reversible archive

User approved archive-only organization. Exactly 19 untracked artifacts moved to:

`dev/archive/2026-08-02-repository-hygiene/`

Categories:

- `recovery-artifacts/`
- `scratchpad-scripts/`
- `release-drafts/`
- `nova-drafts/`
- `router-research/`

`MANIFEST.before.json` and `MANIFEST.after.json` record original paths, destinations, byte counts, and SHA-256 hashes.
All 19 files re-verified byte-for-byte. No content was deleted. The distinct router research files were preserved
separately because their hashes differ.

## FID lifecycle

- FID: `FID-2026-0802-004-docs-and-repository-hygiene.md`
- Status: closed
- Archived: `dev/fids/archive/`
- Changelog: `CHANGELOG.md` v0.0.15 entry

## Verification

- `bun run lint:md` passed.
- Scoped `git diff --check` passed; only line-ending normalization warnings were reported.
- Current-doc stale-reference scan passed for old release versions, pre-rebrand checkpoint text, legacy account URLs, and
  the old CommandCode variable spelling.
- Archive hash and source-absence checks passed for 19 of 19 files.
- No active FIDs remain.

The broader pre-existing worktree diff was not modified or normalized as part of this documentation/hygiene scope.
