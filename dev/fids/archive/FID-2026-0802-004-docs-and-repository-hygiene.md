# FID: 0.0.15 Documentation Refresh and Reversible Repository Hygiene

**Filename:** `FID-2026-0802-004-docs-and-repository-hygiene.md`
**ID:** FID-2026-0802-004
**Severity:** medium
**Status:** closed
**Created:** 2026-08-02
**Author:** Buffy (FreeBuff)
**Archived:** 2026-08-02

---

## Summary

Reviewed current documentation for stale 0.0.15, provider, branding, and architecture claims. Updated only current
user-facing docs and organized approved untracked artifacts into a reversible dated archive. No content was deleted and
no Git history or remote state was changed.

## Environment

- **OS:** Windows (`win32`) through Bash
- **Runtime:** Bun 1.3.14, TypeScript monorepo
- **Protocol:** FreeBuff ECHO v0.1.2, `strict_mode: true`
- **Release boundary:** Savant-Code `0.0.15`
- **State:** Dirty local worktree; no reset, checkout, clean, commit, or remote operation

## Problem and expected behavior

Current docs had old account/API-key instructions, an obsolete architecture checkpoint, incomplete provider guidance, and
stale product claims. Session artifacts and drafts also lacked one clear archive boundary.

The result must keep historical FIDs, changelog entries, session summaries, and research content intact while making
current docs accurate and placing approved untracked artifacts under a discoverable archive.

## Scope

### Current documentation updated

- `ARCHITECTURE.md` — replaced the obsolete 0.0.2 pre-rebrand checkpoint.
- `README.md` — added the exact CommandCode variable, `COMMAND_CODE_API_KEY`.
- `README.zh-CN.md` — updated current product, provider, onboarding, and agent-roster guidance.
- `sdk/README.md` — removed legacy hosted-account instructions, clarified the SDK/backend credential contract, and
  changed example agent identifiers to `savant-code/base@latest`.
- `cli/release/README.md` — documented CommandCode's exact environment variable.
- `WINDOWS.md` — made release-metadata troubleshooting compatible with current and older wrappers without removing
  valid login troubleshooting.
- `docs/privacy.md` — fixed current wording and listed direct-provider environment variables.
- `docs/SAVANT-VERSIONING.md` — recorded the current `0.0.15` release.

### Reversible archive

Created `dev/archive/2026-08-02-repository-hygiene/` with these categories:

- `recovery-artifacts/`
- `scratchpad-scripts/`
- `release-drafts/`
- `nova-drafts/`
- `router-research/`

Moved exactly 19 approved untracked files. The archive contains before/after manifests with original paths, destinations,
byte counts, and SHA-256 hashes. The two router research documents were preserved separately because their hashes differ.

Tracked FIDs, changelog history, session summaries, active configuration, Git history, and remote state were not moved.

## Perfection Loop

### Loop 1 — converged

- **RED:** Found stale current architecture text, legacy SDK account/API-key guidance, incomplete Chinese provider docs,
  and unorganized untracked recovery, scratchpad, release, Nova, and research artifacts.
- **GREEN:** Proposed source-backed doc edits and a dated archive with category directories and hash manifests.
- **AUDIT:** Confirmed current provider variables from source: `OPENCODE_GO_API_KEY`, `TOKENROUTER_API_KEY`,
  `NVIDIA_API_KEY`, `COMMAND_CODE_API_KEY`, and credential persistence under `.savant-code/credentials.json` for CLI
  onboarding.
- **CHANGE DELTA:** Documentation and reversible organization only; no production code.

### Loop 2 — self-correction and convergence

- **RED:** Independent review identified risks of conflating CLI credentials with SDK credentials, rewriting valid Windows
  troubleshooting, moving tracked history, and collapsing distinct research documents.
- **GREEN:** Kept SDK backend/API-key behavior separate, preserved Windows login guidance, preserved all research files,
  and moved only user-approved untracked files.
- **AUDIT:** Archive hashes matched for all 19 files; no approved original paths remained; current-doc stale-reference scan
  was clean.
- **CONVERGENCE:** PASS. No actionable design issues remain.
- **CHANGE DELTA:** Documentation, archive metadata, and path organization only.

## Code and documentation verification

- [x] Current provider and credential behavior verified against `sdk/src/env.ts`, `sdk/src/impl/model-provider.ts`, and
  `cli/src/utils/provider-setup.ts`.
- [x] Archive manifest verified 19 of 19 SHA-256 hashes.
- [x] Historical FIDs, changelog, session summaries, and tracked release history preserved.
- [x] No approved source paths remain after the reversible move.
- [x] Current-doc scan contains no stale `0.0.12`, `0.0.16`, pre-rebrand, or legacy account-URL claims.
- [x] Markdownlint and `git diff --check` passed for the declared scope.

## Resolution

- **Fixed By:** Buffy (FreeBuff)
- **Fixed Date:** 2026-08-02
- **Fix Description:** Updated current documentation and organized 19 approved untracked artifacts under the dated archive.
- **Tests Added:** No; documentation and archive validation only.
- **Verified By:** Independent review plus Markdownlint, reference, and SHA-256 checks.
- **CHANGELOG:** `CHANGELOG.md` — `v0.0.15` release entry.
- **Commit/PR:** Local-only; no commit or remote operation.
- **Archived:** 2026-08-02

## Lessons Learned

Current documentation and reversible archive manifests are separate concerns. User-facing docs should stay concise and
current, while recovery and research artifacts should retain provenance in dated categories.
