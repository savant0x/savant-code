# Build Order — clear the pre-push credential-scan block (T82-I)

**Date:** 2026-09-22
**Scope:** SCOPE.md Task 82 → T82-I
**Decision:** operator chose **Option A** (rewrite the 13 unpublished commits)
**Status:** ✅ **EXECUTED 2026-09-22** — blocked precondition CLEARED (see Outcome)
**Executor:** the agent, under the operator's explicit directive "just fix it"
(2026-09-22). The governing single-agent protocol reserves git execution to the
operator, so nothing below ran until that instruction arrived
**Automation level:** 1 (operator-authorized git execution)

## Outcome (2026-09-22) — CLEARED

Executed as written. **Rebase clean: 12/12 replayed, zero conflicts.** New tip
`834a992b` (was `b8f72ed2`); the amended commit is `294aa251` (was `9c2dcd5e`).

| Verification leg | Expected | Measured | Verdict |
| --- | --- | --- | --- |
| pre-push scan on the pushed range | `credential scan passed`, exit 0 | `pre-push: credential scan passed (147 file(s) scanned).`, exit 0 | **PASS — block cleared** |
| unpushed count | 22 | 22 | PASS |
| fast-forward | `origin/main` an ancestor | ancestor | PASS |
| files differing in the range | 1 | 1 | PASS |
| committed blob vs validated artifact | identical | `diff -q` IDENTICAL | PASS |
| offending literals in the committed blob | 0 | 0 | PASS |
| masking suite | 8 pass / 0 fail | 8 pass / 0 fail (18 expects) | PASS |
| stash restore | clean | clean, stash list empty, 143 paths restored | PASS |

Post-rewrite gates: typecheck 12/12 exit 0, root `test` chain exit 0, eslint 0,
`lint:md` 0, prettier PASS, `version:check` PASS. `release:preaudit:check` dropped
from **2** blocking preconditions to **1** — the remaining one is the dirty
worktree (the operator's G2 commit).

### Two figures in this order were wrong; both corrected by measurement

1. **Step 3c predicted `12 insertions(+), 1 deletion(-)`; measured `16
   insertions(+), 4 deletions(-)`.** The prediction was written against the
   earlier `ghp_${GITHUB_PAT_BODY}` assembly-helper fix, which was replaced by the
   8–19-char-body design plus an in-file rationale comment. 4 literal lines
   changed (4 del / 4 ins) + the ~12-line rationale = 16/4. The larger delta is
   the correct one.
2. **The "24 tracked references across 11 SHAs" figure was wrong.** It named SHAs
   (`0e0ffcd9`, `20fe3180`, `be2ca107`, `5e1a3cf5`, `57bdb173`, `27c1f020`,
   `2cc0b854`) that are **not in the changed set at all**. Measured with
   `git grep`: **43 occurrences across 12 tracked files** — the bulk in
   `dev/fids/archive/FID-2026-0919-011…020`, plus `CHANGELOG.md` and `SCOPE.md`.
   Followed the 2026-09-13 precedent: an **erratum** recording that the cited SHAs
   are stale and the messages/diffs unchanged, rather than rewriting 43 citations
   (the messages and diffs are the evidence; short-SHAs are pointers to it).

Nothing was pushed. `backup-pre-rewrite-20260922` is retained.

## Why this is needed

`git push` is refused fail-closed by the pre-push credential scan, so the 0.0.33
release cannot complete (`scripts/public-release/stages.ts:210` pushes with no
bypass). The scan reads **committed blobs, per commit**, so no forward commit can
clear it — the blob reaches the remote's history either way.

**Two things the first pass got wrong, both caught by verification:**

1. The whole-file scan reports only the **first** matching pattern per file (it
   `break`s), so it named one literal. A line-by-line scan with the real scanner
   found **four** offending lines in that file: three `sk-…` and one `ghp_…`.
2. Removing only the `ghp_` literal merely surfaced an `sk-` literal. The fix
   therefore covers all four.

## What is already done (agent, verified)

The offending file is:

```text
cli/src/utils/__tests__/logger-mask-secret-values.test.ts
```

introduced by commit **`9c2dcd5e`** (position **10 of 22** in the unpushed range;
the only commit that touches the file).

Fix rule: the masking layer needs **≥8** characters after a known prefix
(`SECRET_PREFIX_REGEX`), while the scan flags prefixed bodies of **≥20**
(`/\bsk-…/`, `/\bghp_…/`). So every secret-shaped fixture now uses an **8–19
character body** — the tests' intent is unchanged and nothing is a scannable
literal. The rationale is documented in the file itself.

Verified, against the real scanner (`scanStagedCredentials`):

| Artifact | Result |
| --- | --- |
| `dev/scratchpad/active/t82-fixture-at-9c2dcd5e.ts` (original content) | **FLAGGED** on 4 lines |
| `dev/scratchpad/active/t82-fixture-fixed.ts` (= the working-tree fix) | **CLEAN — 0 flagged lines** |
| `bun test cli/src/utils/__tests__/logger-mask-secret-values.test.ts` | **8 pass / 0 fail** (18 expects) |
| eslint `--max-warnings 0`, prettier `--check` | exit 0, PASS |

The prepared fixed file is the exact content the rewrite injects.

## Runbook

### 0. Pre-flight (read-only)

```bash
git rev-parse HEAD                        # expect b8f72ed2…
git rev-list --count origin/main..HEAD    # expect 22
git merge-base --is-ancestor origin/main HEAD && echo "fast-forward: ok"
git log --format=%h origin/main..HEAD -- cli/src/utils/__tests__/logger-mask-secret-values.test.ts
#   expect exactly one line: 9c2dcd5e
```

### 1. Safety net

```bash
git branch backup-pre-rewrite-20260922 HEAD     # keeps the pre-rewrite history
git rev-parse HEAD > dev/scratchpad/active/t82-old-head.txt   # b8f72ed2… for step 3
```

Park the uncommitted work (rebase requires a clean tree). Revert *this one file*
first: its fix lives in the prepared artifact and the rewrite injects it, so
excluding it from the stash keeps the later `stash pop` clean.

```bash
git checkout -- cli/src/utils/__tests__/logger-mask-secret-values.test.ts
git stash push --include-untracked -m "T82 pre-rewrite checkpoint"
```

### 2. The rewrite (13 commits: positions 10–22)

```bash
git checkout --detach 9c2dcd5e
cp dev/scratchpad/active/t82-fixture-fixed.ts cli/src/utils/__tests__/logger-mask-secret-values.test.ts
git add cli/src/utils/__tests__/logger-mask-secret-values.test.ts
git commit --amend --no-edit
git branch -f scrub-base HEAD
git rebase --onto scrub-base 9c2dcd5e main
git branch -D scrub-base
git checkout main
```

Expect **zero conflicts** — no other commit in the range touches that file.

### 3. Verification (do not skip; every leg has an expected value)

```bash
# 3a. THE POINT: the block is cleared
printf 'refs/heads/main %s refs/heads/main %s\n' "$(git rev-parse HEAD)" "$(git rev-parse origin/main)" | bun scripts/pre-push-scan.ts
#   expect: "pre-push: credential scan passed (N file(s) scanned)."  exit 0

# 3b. shape unchanged: still 22 commits, still a fast-forward
git rev-list --count origin/main..HEAD          # expect 22
git merge-base --is-ancestor origin/main HEAD && echo "fast-forward: ok"

# 3c. content identical except the one file
git diff "$(cat dev/scratchpad/active/t82-old-head.txt)" HEAD --stat
#   expect exactly: 1 file changed, 16 insertions(+), 4 deletions(-)   [MEASURED — the original 12/1 prediction was stale, see Outcome]

# 3d. the rewritten blob is clean, and the suite still passes
git show HEAD:cli/src/utils/__tests__/logger-mask-secret-values.test.ts | grep -cE 'ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}'
#   expect 0
bun test cli/src/utils/__tests__/logger-mask-secret-values.test.ts   # expect 8 pass / 0 fail
```

### 4. Restore the parked work

```bash
git stash pop            # expect clean (the fixture file was excluded by design)
```

Contingency: if the pop reports a conflict **only** on the fixture file, that
file already holds the correct rewritten content — take it and continue:

```bash
git checkout HEAD -- cli/src/utils/__tests__/logger-mask-secret-values.test.ts
git stash drop
```

### 5. Re-run the gates

```bash
bun run typecheck && bun run test
bun x eslint . --max-warnings 0 && bun run lint:md && bunx prettier --check .
bun run quality:report && bun run validate:repository && bun run version:check
bun run release:preaudit:check      # expect the credential-scan BLOCK to be gone;
                                    # the dirty-worktree BLOCK remains until you commit
```

Optional hygiene, **only after 3a–3d pass**: keep `backup-pre-rewrite-20260922`
until the release ships, then

```bash
git reflog expire --expire=now --all && git gc --prune=now
```

## Consequence to record (agent follow-up)

13 commit SHAs change. **11 of them are cited across 24 tracked references**
(`9c2dcd5e` ×3, `0e0ffcd9` ×3, `20fe3180` ×3, `b8bb5a5d` ×3, and `be2ca107` /
`5e1a3cf5` / `57bdb173` / `246008fd` / `85e877af` ×2 each, `27c1f020` /
`2cc0b854` ×1 each). Positions 1–9 keep their SHAs.

The 2026-09-13 erratum is the precedent for how this is recorded: an erratum
noting that citations to the affected SHAs refer to pre-rewrite commits, with
content and diffs unchanged. The agent will add that erratum and sweep the
citations on request.

## What this does NOT do

- It does not commit the 141 uncommitted paths, and it does not push — both
  remain the operator's (G2; the single-agent protocol reserves `git push`).
- It does not touch the scanner. The fail-closed control keeps exactly the
  semantics it had; the fixtures moved out of its way instead.
