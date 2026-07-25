# Nova Audit Request — FID-2026-0718-025 Close-out

**Date:** 2026-07-19
**Re:** FID-2026-0718-025 (dev/releases/ Ephemeralization)
**Priority:** Low (config-only, no functional code)
**Method:** Read source files + run AUDIT 5-item gate yourself + grep verifications

## Claims to verify (5)

### Claim 1: .gitignore has 5 new lines for dev/releases/ pattern
- `dev/releases/*.md` (rule)
- `!dev/releases/README.md` (exception)
- 3 comment lines
- VERIFY: `tail -10 .gitignore` should show 5 new lines + a blank separator.

### Claim 2: dev/releases/README.md (44 lines) documents EPHEMERAL convention
- VERIFY: `head -10 dev/releases/README.md` contains "ephemeral" + a reference to CHANGELOG + a reference to GitHub Releases.

### Claim 3: Negative-ignore test passes
- VERIFY: `touch dev/releases/_test_ignored.md && git status --ignored` shows it as `!! dev/releases/_test_ignored.md` (ignored), NOT `??` (untracked). Then `rm` cleans up.

### Claim 4: Pre-existing v0.0.2.md NOT modified
- v0.0.2.md was committed in commit 72d0a19 (BEFORE FID-025). The FID-025 FORGE commit should NOT touch it.
- VERIFY: `git diff 72d0a19~1..HEAD -- dev/releases/v0.0.2.md | wc -l` should be 0 (no diff in v0.0.2.md between pre-72d0a19 and current HEAD).

### Claim 5: CHANGELOG.md top entry FID-2026-0718-025
- VERIFY: `head -10 CHANGELOG.md | grep -c FID-2026-0718-025` should be 1.

## Source-of-truth files
- `.gitignore` (last 10 lines including new rule)
- `dev/releases/README.md` (first 10 lines + workflow section)
- `CHANGELOG.md` (first 10 lines for top entry)
- `dev/fids/archive/FID-2026-0718-025-dev-releases-ephemeral-staging.md` (verify post-archive location)

## Cross-FID invariants to NOT regress
- All 12 READMEs Apache-2.0 license claim (preserved)
- Zero stale substituted strings (preserved)
- Markdownlint IDE Problems panel clean (preserved)
- v0.0.2 tag at d1fcd71 (preserved — new commits don't move the tag)

Reply with PASS / NEEDS_FIXES per claim.
