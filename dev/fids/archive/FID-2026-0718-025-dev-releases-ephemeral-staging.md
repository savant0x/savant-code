# FID-2026-0718-025 — small — dev/releases/ Ephemeralization (.gitignore + README Index)

**Filename:** `FID-2026-0718-025-dev-releases-ephemeral-staging.md`
**ID:** FID-2026-0718-025
**Severity:** low
**Status:** closed
**Created:** 2026-0718 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0718-025`. Backfilled fields: Filename, Severity, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

**ID:** FID-2026-0718-025
**Status:** closed
**Lifecycle note:** Historical status prose retained below; canonical status is `closed` after the documented FORGE+AUDIT+COMPLETE work.

## Background

After commit `72d0a19` added `dev/releases/v0.0.2.md` (the v0.0.2 release notes draft), Thinker-with-files-gemini identified a redundancy risk:

- `CHANGELOG.md` Line 1 declares itself the canonical in-repo history via ECHO FID Auto-Archive rule.
- GitHub Releases is the canonical external source-of-truth for shipped release notes.
- An in-repo permanent `dev/releases/*.md` convention would create a competing source-of-truth and risk drift if GitHub content diverges from in-repo content.

**Five-questions test:**

1. **ALL cases?** No — would require perfect sync between GitHub Releases and in-repo.
2. **1000 agents?** No — every release doubles the surface area to verify.
3. **Hostile attacker?** No — release notes are public on GitHub anyway; in-repo surface is a maintenance risk.
4. **2-year maintainability?** No — CHANGELOG + GitHub Releases already provide history.
5. **Industry standard?** No — release notes are external to repo by convention.

## GREEN — Proposed Resolution

**Decision:** Make `dev/releases/` an EPHEMERAL staging directory (modeled after the existing `dev/scratchpad/*` ephemeral pattern in `.gitignore`).

### File changes (3 total: 1 modified, 2 new)

**1. `.gitignore`** — append 5 lines (1 blank separator + 4 with rule + comment):

```
# dev/releases/ — ephemeral staging area for release notes drafts.
# Canonical in-repo history: CHANGELOG.md. Canonical external source: GitHub Releases.
# README.md is the permanent index. All *.md drafts are gitignored.
dev/releases/*.md
!dev/releases/README.md
```

**2. `dev/releases/README.md`** — NEW permanent file (44 lines). Documents the EPHEMERAL convention, points to CHANGELOG/GitHub Releases, includes workflow steps. `markdownlint-disable MD041` matches root README structure.

**3. `dev/fids/FID-2026-0718-025-dev-releases-ephemeral-staging.md`** — THIS document.

### Already-committed (1 file, NOT modified)

`dev/releases/v0.0.2.md` — commit `72d0a19` 2026-07-19, 123 lines. Per **ECHO L5 (no destructive rewinds of history)**, this stays in place as the historic v0.0.2 release artifact. It becomes the canonical in-repo copy of v0.0.2's GitHub release notes — a one-time exception, not the new convention.

### Why this design

- **Specific:** addresses the redundancy risk identified by Thinker.
- **Consistent with existing convention:** the `dev/scratchpad/*` (with `!dev/scratchpad/.gitkeep` exception) rule already uses this exact pattern in `.gitignore`.
- **Reversible:** `.gitignore` edits can be revised later; README is informational.
- **Self-documenting:** README + `.gitignore` comments explain the convention to new contributors.
- **Low-risk:** zero TypeScript touched, no functional behavior change.

### Open questions (loop-until-converge verdicts)

| Q | Answer |
|---|--------|
| Q1: Future v0.0.3 / v0.0.4 / rebrand-push? | Drafts go to `dev/releases/*.md` but gitignored; publish via `gh release create … --notes-file …` or web UI. |
| Q2: Should v0.0.2.md be retroactively removed? | **NO** — destructive rewind forbidden by ECHO L5. |
| Q3: Where does dev/releases/ sit in dev/ hierarchy? | Sibling of `dev/fids/`, `dev/nova/`, `dev/session-summaries/` (all permanent documentation directories). dev/releases/ is the FIRST ephemeral one. |
| Q4: Do FIDs that ship in a release get cross-referenced? | Yes via CHANGELOG.md (canonical); not duplicated in release notes. |
| Q5: README required even though ephemeral? | **YES** — permanent index explains the convention to future contributors. |

## AUDIT — Verification Plan (5 items)

1. `grep -cE '^dev/releases/\*\.md$' .gitignore` ≥ 1 (the rule)
2. `grep -cE '^!dev/releases/README\.md$' .gitignore` ≥ 1 (the exception)
3. `head -5 dev/releases/README.md | grep -ci 'ephemeral'` ≥ 1
4. **Negative test:** create `dev/releases/_test_ignored.md` → `git check-ignore -v dev/releases/v0.0.3-draft.md` returns exit 0 with the matching pattern on stdout (`dev/releases/*.md:1:dev/releases/v0.0.3-draft.md`) if the rule fires; exit 1 if not. Cleaner than the deprecated `git status --ignored`. Optional sanity check: `touch dev/releases/_tmp_ignored.md; git status` (semicolon keeps sed-safe from ``git status --ignored` shows it is `!!`-prefixed (ignored), NOT `??`-prefixed (untracked) → delete`) — no untracked entry. Clean up _tmp_ignored.md after.
5. `git log --oneline origin/main..HEAD` post-push = 1 new commit FORGE + 1 close-out commit

## COMPLETE — Close-out Steps

1. CHANGELOG.md top entry: `FID-2026-0718-025`
2. Move FID to `dev/fids/archive/FID-2026-0718-025-dev-releases-ephemeral-staging.md`
3. Nova outbox file: `dev/nova/outbox/2026-0718-fid-025-closeout-request.md`
4. Push both FORGE + close-out commits to origin
5. Verify `dev/fids/` root empty post-archive

## Linked FIDs

- **FID-2026-0718-024** — predecessor. Decision-A/C/D FID with initially deferred permanence questions.
- **FID-2026-0718-018** — sibling. Doc House-Cleaning that established the dev/ organizational pattern (kept this convention).

## Status

`proposed` → `closed` (post-implementation)
