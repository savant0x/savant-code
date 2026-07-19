<!-- markdownlint-disable MD041 -->

# dev/releases/ -- Ephemeral Release-Notes Staging

> **Status:** Ephemeral. Gitignored (except this README) per **FID-2026-0718-025**.

This directory is an **ephemeral staging area** for the Orchestrator's release-notes drafts, NOT a canonical release-history store.

## Conventions

| Artifact                          | Canonical Source-of-Truth           |
| --------------------------------- | ----------------------------------- |
| In-repo history                   | `CHANGELOG.md` (auto-archive)       |
| External releases                 | GitHub Releases (web UI / `gh` CLI) |
| Ephemeral drafts                  | THIS directory (gitignored)         |

## Why Ephemeral

Three reasons (per FID-2026-0718-025 + Thinker-with-files-gemini review):

1. **Single Source of Truth** -- `CHANGELOG.md` Line 1 declares itself the canonical in-repo history via ECHO FID Auto-Archive rule.
2. **GitHub Releases is canonical external source** -- in-repo `.md` files would risk drift if GitHub content diverges.
3. **`dev/*` permanent siblings** (`fids/`, `nova/`, `session-summaries/`) hold original process context not found elsewhere; release notes are entirely derivative of CHANGELOG + GitHub Releases.

## Workflow

1. Draft `dev/releases/v<X>.<Y>.<Z>.md` here (gitignored, free to evolve without commits).
2. Publish to GitHub Releases via `gh release create v<X>.<Y>.<Z> --notes-file dev/releases/v<X>.<Y>.<Z>.md` OR via the GitHub web UI release-creation form.
3. Optionally commit a frozen copy as canonical repo-state reference (rare exception, like the v0.0.2.md commit backing the pre-rebrand safety checkpoint).
4. Old drafts are removed on next release cycle.

## Current Staged Drafts

(None at the moment. Add drafts as `dev/releases/v<X>.<Y>.<Z>.md`.)

## See Also

- `../../CHANGELOG.md` -- canonical in-repo history
- GitHub Releases -- canonical external source
- `../fids/archive/FID-2026-0718-025-dev-releases-ephemeral-staging.md` -- the FID that established this convention

---

<sub>Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../../ECHO.md).</sub>
