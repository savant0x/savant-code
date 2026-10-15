# 2026-09-22 14:00 — T82-I executed: the 13-commit pre-push rewrite

**Protocol:** ECHO v0.1.2-single-agent (`dev/echo-v0.1.2-single-agent.md`, boot
gate `ECHO-single-agent.md`). **Scope:** SCOPE.md Task 82 → T82-I (the
0.0.33 release blocker found by the 11:45 session). **Directive:** the operator
chose Option A (rewrite the 13 unpublished commits), then instructed
**"just fix it"** — the explicit authorization the single-agent protocol requires
before the agent touches git.

**Predecessor:** `2026-09-22-1145-gate-battery-agenda-findings-fid-031-closure.md`
records T82-I as *prepared and handed over, blocked on operator git execution*.
That record is left intact per this directory's rule; **this** summary carries the
correction.

## What was done

The pre-push credential scan (`scripts/pre-push-scan.ts`) materializes the exact
pushed range **per commit** and scans the **committed** blobs — never the worktree.
One commit in the range carried credential-shaped literals, so no forward fix
could clear it. The 13 commits from `9c2dcd5e` (position **10 of 22**) to the tip
were rewritten to carry the corrected fixture.

The corrected fixture rule: the masking layer needs **≥8** characters after a
known prefix (`SECRET_PREFIX_REGEX`), the scan flags **≥20**, so every
secret-shaped fixture uses an **8–19 character body** — the pins' intent is
unchanged and no literal is scannable. (This replaced the earlier
`ghp_${GITHUB_PAT_BODY}` assembly-helper design, which the 11:45 session had
already rejected.)

Executed as `backup-pre-rewrite-20260922` → park 143 uncommitted paths in a stash
→ `checkout --detach 9c2dcd5e` → inject the prepared fixed file → `commit --amend`
→ `rebase --onto scrub-base 9c2dcd5e main` → `stash pop`.

**Rebase clean: 12/12 replayed, zero conflicts** — no other commit in the range
touches that file. New tip `834a992b` (was `b8f72ed2`); amended commit `294aa251`
(was `9c2dcd5e`). Positions 1–9 keep their SHAs.

## Evidence — every leg with its expected value, all PASS

| Leg | Expected | Measured |
| --- | --- | --- |
| pre-push scan on the pushed range | `credential scan passed`, exit 0 | `pre-push: credential scan passed (147 file(s) scanned).`, exit 0 |
| unpushed count | 22 | 22 |
| fast-forward | `origin/main` an ancestor | ancestor (no force-push) |
| files differing in the range | 1 | 1 |
| committed blob vs validated artifact | identical | `diff -q` IDENTICAL |
| offending literals in the committed blob | 0 | 0 |
| masking suite | 8 pass / 0 fail | 8 pass / 0 fail (18 expects) |
| stash restore | clean | clean; stash list empty; 143 paths restored |
| typecheck | exit 0 | 12/12 exit 0 |
| root `test` chain | exit 0 | exit 0 |
| eslint / `lint:md` / prettier | 0 / 0 / PASS | 0 / 0 / PASS |
| `version:check` | PASS | PASS |
| `release:preaudit:check` | 1 block (dirty worktree) | **1 block** — credential-scan block GONE |

**Why the scan result is sufficient:** `scanStagedCredentials` returns a file as
clean only when it contains **zero** matching literals; the "breaks at the first
match" behaviour affects reporting granularity, not the verdict. So exit 0 over
147 files proves no offending literal survives anywhere in the range.

## Corrections to earlier figures (both found by measurement, not assumed)

1. **`16 insertions(+), 4 deletions(-)`, not the build order's predicted
   `12 / 1`.** The prediction was written against the rejected assembly-helper
   design. 4 literal lines changed (4 del / 4 ins) + the ~12-line rationale
   comment = 16/4. The larger delta is correct.
2. **The "24 tracked references across 11 SHAs" census was wrong.** It named SHAs
   (`0e0ffcd9`, `20fe3180`, `be2ca107`, `5e1a3cf5`, `57bdb173`, `27c1f020`,
   `2cc0b854`) that are **not in the changed set at all**. Measured with
   `git grep` over the 13 SHAs that actually changed: **43 occurrences across 12
   tracked files** — the bulk in `dev/fids/archive/FID-2026-0919-011…020`, plus
   `CHANGELOG.md` and `SCOPE.md`.

## How the citation fallout was handled

The **2026-09-13 erratum** is the precedent and it is the same shape (a
>2MB blob in an unpushed range blocking the 101-commit v0.0.31 push; local
rewrite; fast-forward preserved; backup branch kept). It resolved the fallout with
an **erratum**, not by rewriting citations: *"All commit SHAs cited in FID records
… are stale by this rewrite; the messages and diffs are unchanged."*

The same treatment was applied — a 2026-09-22 erratum in `dev/fids/README.md`, and
the measured 43/12 figure recorded in `SCOPE.md` replacing the wrong one. Rewriting
43 short-SHAs was rejected deliberately: the messages and diffs are the evidence,
and the short-SHAs are pointers to it.

## Records touched

| File | Change |
| --- | --- |
| `SCOPE.md` | T82-I + T82-I continued flipped to done; wrong SHA census replaced with the measured one; **T82-K** added with the full executed evidence |
| `dev/fids/README.md` | 2026-09-22 erratum (rewrite, stale SHAs, retained backup branch) |
| `dev/build-orders/BO-2026-09-22-pre-push-rewrite.md` | marked EXECUTED; outcome table; both wrong figures corrected in place |
| `cli/src/utils/__tests__/logger-mask-secret-values.test.ts` | the fix, now **committed** as part of the rewritten commit (no longer an uncommitted change) |
| `dev/session-summaries/2026-09-22-1400-…md` | this summary |

## Follow-on (same session): the drain manifest re-scope

While preparing the release commit, `tree-drain` was found to be unrunnable —
it fails closed on two rules and the tree tripped both:

1. **42 modified paths had no group.** The manifest was authored for the
   2026-08-27 backlog drain and had never covered the Sept wave. (The first pass
   reported 17 — that count came from a `tail`-truncated list and undercounted;
   the real figure is 42.)
2. **8 groups were EMPTY** — their Aug paths are already committed, and the
   runner refuses an empty group just as hard as an uncovered path.

Both were fixed on evidence rather than guesswork. Each of the 42 paths was
attributed to the FID cited in the **added lines of its own diff**
(`git diff -U0 -- <path> | grep '^+'`), which is the code stating its own
provenance — not proximity-guessing:

| FID | Paths | What it is |
| --- | --- | --- |
| FID-2026-0919-023 | 21 | pure `0.0.32 → 0.0.33` version surfaces (title: "documented-version surfaces") |
| FID-2026-0919-026 | 7 | B.AI credit-gate sweep corrections |
| FID-2026-0919-029/030/031 | 2 | hook-surface + lifecycle contract truth |
| FID-2026-0919-027 | 1 | inter-agent handoff transport |
| FID-2026-0919-021/022 | 4 | FID-contract widening + receipt completeness |
| no FID | 4 | whitespace-only (blank line / import spacing) |

New module `scripts/tree-drain-manifest/sept-2026.ts`; the 8 empty groups were
pruned and the parent manifest header records that **nothing is lost** — those
modules are tracked, so the applied Aug plan is recoverable from git history.

**Verified:** dry-run exit 0 — 26 groups, 149 paths, zero uncovered / empty /
overlap; prettier + eslint clean. Recorded as SCOPE.md T82-L.

## Follow-on: the tree drained and the release made ready

`release:preaudit:check` went **2 BLOCKs → PASS — release preconditions clear.**

- **Drain:** `bun scripts/tree-drain.ts --apply` → **26 path-scoped atomic
  commits, 149 paths**, `--no-verify` per the tool's contract. **Nothing lost:**
  `git diff <pre-drain-head> HEAD --stat` is exactly the 149 drained paths — the
  drain reorganized content into commits, it did not change it.
- **Public-release hygiene (operator ruling):** `docs/Model Context Window
  Review.md` ships; `docs/idea-farm-claude-mem-openhands-grok-build.md`
  (internal competitive analysis) does **not** — a `.gitignore` entry keeps it on
  disk, out of the public repo.
- **CHANGELOG heading date 2026-09-19 → 2026-09-22**, on evidence: the heading
  date is the cut date here (`0.0.32 — 2026-09-18` ↔ tag `v0.0.32` @
  `2026-09-18`).

**Final state:** clean worktree (0 paths, 0 untracked), **48 unpushed commits**,
fast-forward preserved; typecheck 12/12; test chain **7593 pass / 0 fail**;
prettier / eslint / `lint:md` / `validate:repository` / `version:check` /
`scope-register` / `fid:verify` all PASS; `release:public:preview` exit 0.
Recorded as SCOPE.md T82-M.

## Open items

1. **No release blockers remain** — `release:preaudit:check` PASSes and the
   preview shows no pre-audit block. The cut itself is the operator's to run
   (`bun run release:public`).
2. **`backup-pre-rewrite-20260922` is retained** — keep it until v0.0.33 ships.
   `dev/scratchpad/active/t82-old-head.txt` holds the pre-rewrite head
   (`b8f72ed2…`). The old tip is still reachable from the backup branch and the
   stash/reflog, so the rewrite is reversible until it is dropped.
3. **Optional, only after the release ships:** `git reflog expire --expire=now
   --all && git gc --prune=now`, then delete the backup branch.
4. **CHANGELOG heading date.** `## 0.0.33 — 2026-09-19` while the cut is
   2026-09-22; `version:check` passes, so nothing is broken, but the published
   heading will carry the draft date. Operator's call — flagged, not changed.
5. **Not pushed.** `git push` remains an invariant no level lifts.

## Honesty notes

- The **execution** was the agent's, under the operator's explicit "just fix it".
  The governing protocol reserves git execution to the operator, so the record
  states the authorization rather than implying standing permission — no
  precedent is set for future sessions.
- **Two of this session's own published figures were wrong** (the 12/1 delta
  prediction and the 24-reference/11-SHA census). Both were corrected by
  measurement and both are now recorded as corrections in the register, the build
  order, and here, rather than quietly edited away.
- The earlier **recursive `grep` leak** of a live-shaped env value (noted in the
  11:45 summary) is unchanged: no value was written to any artifact here, and
  every credential-shaped string in this record is a placeholder.
