# Session summary — gate battery, agenda findings, FID-031 closure, release audit

**When:** 2026-09-22 (local)
**Scope:** SCOPE.md Task 82 (T82-A … T82-J) + Task 81 closure, automation level 3
**FID:** FID-2026-0919-031 — `closed`, receipt re-stamped **7/7 LIVE** at the
archived path (`sha256:341fc2fe…`)
**Commit:** none (G2 withheld — the operator holds the commit)
**Governing protocol:** `dev/echo-v0.1.2-single-agent.md` (single-agent; the
`ECHO.md` harness protocol does not govern this session)

## Operator directive (verbatim)

> "Re-run the gate battery, Work the agenda findings, Close + archive FID-031,
> fix the findings, then continue a release audit"

## 1. Gate battery (T82-A / T82-B)

| Gate | Result |
| --- | --- |
| `bun run typecheck` | **12/12 exit 0** |
| `bun run test` | **12/12 workspaces, 0 fail** (7616 tests) |
| `bun x eslint . --max-warnings 0` | exit 0 |
| `bunx prettier --check .` | PASS |
| `bun run quality:report` | **PASS (1498 baselined files)** |
| `bun run validate:repository` | **PASS** |
| `bun run lint:md` | **RED — 1 finding** (fixed below) |

**The one red line in the whole battery** was `SCOPE.md:42` — the Task 81
register heading, 133 chars against the 120 limit (MD013). Fixed by shortening
the heading to the register's own convention (T82-B); `lint:md` re-run green.

## 2. Agenda findings (T82-C … T82-F)

`dev/agenda.md` listed three items. Ground truth was taken from the ledger
itself (`dev/experiences/raw-traces.jsonl`, 131 records / 64 sessions) rather
than from the agenda's own claim, per the FID Ground-Truth rule:

| Agenda item | In-window | Verdict |
| --- | --- | --- |
| `read_url` — "No readable text found at URL" | 15 | **LIVE, fixed (T82-C)** |
| `code_search` — ripgrep ENOENT | 13 | resolved by FID-2026-0918-007 (T82-D) |
| `str_replace` — "tool result contains an error" | 6 (14 total) | resolved by FID-2026-0909-005 (T82-E) |

**T82-C — fixed.** All 15 `read_url` records sit in one 35-minute research pass
(2026-09-19T04:57–06:32Z) over pages with no extractable text. The tool reported
its **correct** outcome — the same "resource has no content" shape as a search
404, which the engine already treats as expected. `/no readable text/i` was added
to `EXPECTED_FAILURE_PATTERNS` (`scripts/experiences-dedup.ts`). Live effect:
recurrence groups **12 → 11** and the 15× class is gone from the report. Pinned
narrow on purpose: a 429, a timeout, and `No change to the file` all stay
promotable (three negative pins).

**T82-D / T82-E — already resolved, no code change.** `code_search`'s 13 records
span 2026-09-10 → **2026-09-17T17:34**, and FID-2026-0918-007 (closed, commit
`0e0ffcd9`) landed the PATH fallback + install guarantee: **zero occurrences
after the fix**. `str_replace`'s 14 records end at **2026-09-09T06:19:38Z**, and
FID-2026-0909-005/-006 landed the real-error-line extraction on 2026-09-09/-10:
**zero after**. Both classes are coasting out of the 14-day window (≈2026-10-01 /
already). Deliberately **not** silenced as expected failures — silencing a fixed
class would hide its regression, which is the opposite of the ledger's job.

**T82-F — the ledger's largest class, owned elsewhere.** `Incomplete arguments
for tool …` accounts for 30 records across 5 tools. It is generated at
`sdk/src/impl/llm/errors.ts:101-102` and is the native tool-call truncation
class, already owned and actively steered by FID-2026-0909-007 (closed
2026-09-10: steering-map entries for `spawn_agents` / `run_readonly_command` /
`sequentialthinking`, strike-1 steering ungated). No repo defect, no new work —
recorded so it is not re-discovered. It stays visible per tool in the dedup
report; it only falls outside the agenda's 3-item cap.

## 3. FID-2026-0919-031 closure (T82-G)

- Status `verified` → **`closed`**; Resolution restructured to the closure format
  (Closed Date / Fix Description / Tests Added / Verification Evidence /
  Archived).
- Moved to `dev/fids/archive/FID-2026-0919-031-lifecycle-events-and-contract-truth.md`.
- Receipt **re-stamped LIVE at the archived path** from a real seven-gate run —
  `[PASS]` typecheck common, typecheck agent-runtime, the three hook suites,
  `probe scripts/hook-events-check.ts`, `quality` — fingerprint
  **`sha256:341fc2fe…`**; `fid:verify --check` repo-wide **PASS**.
- Records updated: archive index (`dev/fids/archive/README.md`), active ledger
  (`dev/fids/README.md` — "The active FID queue is empty."), `CHANGELOG.md`
  (0.0.33 entry relabelled Closed + archived), `SCOPE.md` (Task 81 heading +
  T81-I).

## 4. Release audit (T82-H … T82-J)

| Leg | Result |
| --- | --- |
| `version:check` | **PASS** (enforced surfaces synchronized) |
| changelog audit | **no `[Unreleased]`** anywhere |
| `release:public:preview` | exit 0; `Changelog section ready: ## 0.0.33 — 2026-09-19` |
| `release:preaudit:check` | **FAIL — 2 blocking preconditions** |

**Blocker 1 (known).** Worktree dirty — 141 paths. This is the G2 boundary the
whole session lineage carries: nothing is committed until the operator says so.

**Blocker 2 (NEW, T82-I).** The pre-push credential scan refuses the **entire
unpushed range**. Reproduced read-only:

```text
pre-push: 1 credential-shaped file(s) in the pushed range:
  - cli/src/utils/__tests__/logger-mask-secret-values.test.ts
    (content matches /\b(?:ghp|gho|ghu|ghs)_([A-Za-z0-9]{20,})\b/)
pre-push: refusing to push.
```

The match is a **synthetic fixture** from FID-2026-0919-011's masking suite,
introduced by commit `9c2dcd5e` — position **10 of 22**, and the only commit that
touches the file.

**The first fix was wrong, and verification caught it.** The whole-file scan
reports only the **first** matching pattern per file (it `break`s at the first
hit), so it named one literal. Scanning the file line by line with the real
`scanStagedCredentials` found **four** offending lines: three `sk-…` and one
`ghp_…`. Worse, removing the `ghp_` literal simply surfaced an `sk-` one — the
“fix” would have left the push blocked with a different reported pattern. The
corrected rule uses the gap between the two thresholds: the masking layer needs
**≥8** chars after a known prefix (`SECRET_PREFIX_REGEX`), while the scan flags
**≥20**. Every secret-shaped fixture therefore uses an **8–19 char body** — the
tested intent is unchanged, nothing is a scannable literal, and the rule is
documented in the file so it is not undone.

Verified against the real scanner: original content **FLAGGED on 4 lines**,
fixed content **CLEAN (0 lines)**; masking suite **8 pass / 0 fail** (expectations
unchanged), eslint 0, prettier clean.

**Why a forward fix cannot clear it (structural).** The scan is per-commit by
design — its own contract says *"Scanning per-commit (not just a net tip-vs-tip
diff) catches secrets that were committed and later reverted inside the pushed
range"* — so the blob reaches the remote's history regardless. Clearance requires
rewriting the unpublished commits, which G1 reserves to the operator.

**Disposition: resolved as a plan.** The operator chose the rewrite (Option A).
The agent prepared and verified every non-git step; the runbook is
`dev/build-orders/BO-2026-09-22-pre-push-rewrite.md` (pre-flight, backup branch,
stash, the 13-commit rebase, four verification legs with expected values, the
contingency, and the post-rewrite gates). **The item is blocked only on operator
git execution**, which the single-agent protocol reserves. Owned follow-up: after
the rewrite, add the erratum and sweep the **24 stale citations** to the 11
changed SHAs (positions 1–9 keep theirs).

**T82-J (closed — by design, on the operator's ruling).** `cli/.env.local`
carries a live-GitHub-PAT-shaped value. Operator ruling (verbatim, 2026-09-22):
*"when i run my relese system, the entire creds file is hidden and switched for
the public"*. Corroborated in the repo, not inferred: the automating script is
`package.json:26` (`"release:public": "bun run scripts/public-release.ts"`),
whose `PUBLIC_PROFILE` stage (`scripts/public-release/fail.ts:41`) snapshots
local state (`scripts/public-release/stages.ts:74`), applies the non-secret
profile (`scripts/public-release/local-state.ts`) and restores it
(`restoreLocalState`). The pre-push scan never saw it either: gitignored
(`.gitignore:7:.env.*`), untracked, never committed in the push range. No
remediation required; the earlier rotate-or-delete recommendation is withdrawn.

**Distinct from T82-I — the two controls protect different surfaces.** The
release's `PUBLIC_PROFILE` swap protects the **release run** (env + settings).
The pre-push credential scan protects the **committed blob** in the push range,
and it is what blocks T82-I. A synthetic fixture committed inside the range is
invisible to the profile swap and visible to the scan, so T82-J's disposition
does not clear T82-I. The value is not reproduced in any record.

## Law-12 self-correction (recorded, not hidden)

While verifying the fixture fix, a recursive `grep` over `cli/` printed the
`cli/.env.local` secret-shaped value into this session's terminal transcript
once, before the finding above was understood. The value was **not** copied into
any repository artifact, and every subsequent check used `-l`/`-c` or the
gitignore status instead of printing content. Lesson: for secret-shaped pattern
searches, never print matches — use `grep -l`, `grep -c`, or `git check-ignore`.

## Evidence ledger

- Agenda findings: `bun scripts/experiences-dedup.ts` before/after
  (**12 → 11** recurrence groups); `scripts/__tests__/experiences-dedup.test.ts`
  **24 pass / 0 fail**; `scripts/` tree **295 pass / 0 fail**.
- Fixture fix: masking suite **8 pass / 0 fail** (18 expects). Scanner legs via
  the real `scanStagedCredentials`, line by line: original content **4 flagged
  lines** (3× `sk-`, 1× `ghp_`) → fixed content **0 flagged lines**; whole-file
  scan of the fixed artifact **CLEAN**, original **FLAGGED** (RED/GREEN pair).
- Governance: `fid:verify --check` **PASS**; `validate:repository` **PASS**;
  `scope-register-check` **PASS (0 issues)**; `lint:md` clean.
- Release: `scripts/pre-push-scan.ts` **exit 1** on the real range (reproduced
  before and after the tree fix — proving the per-commit conclusion).

## Files changed

| File | Change |
| --- | --- |
| `scripts/experiences-dedup.ts` | `no readable text` expected-failure class (T82-C) |
| `scripts/__tests__/experiences-dedup.test.ts` | 1 promotion pin + 3 narrowness pins |
| `cli/src/utils/__tests__/logger-mask-secret-values.test.ts` | all 4 secret-shaped fixtures moved to an 8–19 char body, rule documented (T82-I) |
| `dev/build-orders/BO-2026-09-22-pre-push-rewrite.md` | operator runbook for the 13-commit rewrite (T82-I) |
| `dev/scratchpad/active/t82-fixture-{at-9c2dcd5e,fixed}.ts` | prepared + verified rewrite artifacts (gitignored) |
| `dev/fids/FID-2026-0919-031-…md` → `archive/` | closure format, `closed`, receipt re-stamped |
| `dev/fids/archive/README.md` | 2026-09-22 closure index entry |
| `dev/fids/README.md` | ledger: `closed` at the archived path; queue empty |
| `CHANGELOG.md` | 0.0.33 entry relabelled Closed + archived |
| `SCOPE.md` | Task 82 (T82-A…J), Task 81 heading + T81-I |

## Open items

1. **T82-I — prepared and handed over; blocked only on operator git execution.**
   Runbook: `dev/build-orders/BO-2026-09-22-pre-push-rewrite.md`. Until the
   rewrite runs, the 0.0.33 push is refused and so is the release.
2. **G2 — every commit.** 22 unpushed commits + this session's work are
   uncommitted; the operator holds the commit and the push.
3. Live boundaries never claimed: the re-stamped receipt is the record of the
   verification that earned the status; the closed record carries no live
   fingerprint guarantee (by design, documented in the single-agent protocol).
