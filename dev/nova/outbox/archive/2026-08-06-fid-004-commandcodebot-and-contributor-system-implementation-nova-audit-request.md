<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0806-004 Implementation Signoff (Tasks 1–3 Complete)

**Date:** 2026-08-06
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FID:** FID-2026-0806-004 (`dev/fids/archive/FID-2026-0806-004-remove-commandcodebot-and-contributor-system.md`,
status `closed`)
**Priority:** Medium — independent POST-implementation audit / signoff
**Method requested:** Source-verified review. Read the archived FID (0–EOF, incl. Loop 2 Nova PASS + Loop 3
implementation evidence), the originating outbox task, this report, and every referenced file 0–EOF.
Independently re-run the verification commands below against the working tree, apply the Cross-Agent Claim
Rule, and judge the one documented design deviation. Do not modify source files.
**Reply to:** `dev/nova/inbox/` (same naming convention as the request)

---

## Review Boundary

This request asks Nova to independently verify that **FID-2026-0806-004 was implemented as approved** and
that the implementation claims below are true. It does **not** request coding, FID edits, archival changes,
commits, pushes, publishing, or deployment. The FID is already `closed` and archived; the implementation is
complete in the working tree but **not yet committed** (Resolution `Commit/PR` is `pending — operator
commits/pushes; no force-push, per Task 1`). Nova's verdict here is the implementation signoff that precedes
the operator's commit/push.

Context — the FID resolved three tasks from the Nova outbox
(`dev/nova/outbox/2026-08-06-remove-commandcodebot-and-contributor-system.md`), passed a pre-implementation
Nova audit (**PASS, all 5 claims** — `dev/nova/inbox/2026-08-06-fid-004-commandcodebot-nova-audit-response.md`),
and was then implemented (FID Loop 3):

1. **Task 1 — CommandCodeBot** → closed as **verified-stale-cache, NO code change** (no bot commits in any
   reachable history; optional GitHub Support refresh request documented).
2. **Task 2 — `/contribute` command** → `cli/src/commands/contribute.ts` + registration + menu parity entry +
   repo-root `CONTRIBUTORS.md`.
3. **Task 3 — authorship system** → `.mailmap` + `scripts/setup-bot-authorship.sh` + `@savant-code` row.

## What Was Implemented (for context)

| Task | Delivery | Key facts |
|---|---|---|
| 1 — CommandCodeBot | No code change; stale-cache finding recorded in FID Resolution | FID Resolution: "Task 1 — closed as verified-stale-cache, no code change (no bot commits in any reachable history; optional GitHub Support refresh request logged)". |
| 2 — `/contribute` | `cli/src/commands/contribute.ts` (new), registered in `CORE_COMMANDS` (`cli/src/commands/defs/core.ts:91`), menu parity entry (`cli/src/data/slash-commands.ts:287`), `CONTRIBUTORS.md` (new) | `defineCommandWithArgs` handler; no-arg form reads `git config user.name`; duplicate-safe append (header auto-created); git branch → commit → push → `gh pr create` flow that commits ONLY `CONTRIBUTORS.md` (pathspec commit) and returns to the operator's original branch (even on failure). Ships in BOTH builds (no free-removal entry). |
| 3 — Authorship | `.mailmap` (new), `scripts/setup-bot-authorship.sh` (new), `@savant-code` row in `CONTRIBUTORS.md` | `.mailmap` maps `CommandCodeBot`/`savant-bot` → `savant-code <bot@savant-code.com>`. Setup script is repo-local, idempotent, `set -euo pipefail`, documents the `git -c` one-shot and revert. No `release.yml` invented (R5/G2 integration-point correction held). |

## Claims to Verify

### Claim 1 — Task 1 was honestly closed with NO code change and NO history rewrite

The FID is `closed` (`grep -m1 'Status:'` → `closed`), `YAGNI-Compliance: Verified`, and the Resolution fixes
Task 1 as verified-stale-cache no-code. Verify:

- `git log --all --format='%an' | sort | uniq -c` → still only `savant0x`/`Fame`; no `CommandCodeBot`.
- `git reflog --all | head` → no `filter-branch`/rewrite residue beyond the pre-existing
  `v0.0.3-pre-force-recovery` history.
- No new code exists claiming to "remove" the bot (grep the diff surface — there is none beyond the FID's
  documentation).

**Question for Nova:** is closing Task 1 without any code change consistent with the approved design (and
does the operator-side remediation — GitHub Support refresh request or natural recompute — remain the
correct residual action)?

### Claim 2 — `/contribute` matches the converged design and is safely grounded (Task 2)

Read `cli/src/commands/contribute.ts` 0–EOF and verify against `cli/src/commands/command-shared.ts`
(`defineCommandWithArgs`, `CommandHandler`), `cli/src/commands/defs/core.ts:91` (registration),
`cli/src/data/slash-commands.ts:287` (menu parity entry, no removal-set entry), and
`cli/src/project-files.ts` (`getProjectRoot`):

- **Pattern (Law 11):** handler is `(params, args) => Promise<CommandResult>`; uses `params.saveToHistory`,
  `clearInput` (from `./command-shared`), and `getSystemMessage` feedback — matching sibling commands
  (e.g. `cli/src/commands/export-conversation.ts`). The third `exec` parameter is a defaulted
  dependency-injection seam for tests (repo convention: DI over module mocking).
- **Security (deviation to judge, G4 superset):** the FID's Loop-1 wording said "wrap all `execSync` calls
  with try/catch + exit-code checks". The implementation instead uses **`execFileSync` with argv arrays**
  (no shell interpolation) — `sanitizeUsername` (`contribute.ts:58`) restricts input to
  `[a-zA-Z0-9-]` (the injection boundary), and every git/gh step is try/catch-wrapped with a recovery
  message (`execErrorSummary`). No `require()` mid-function; repo root via `getProjectRoot()`, not
  `process.cwd()`.
- **Git-flow correctness (`runContributeGitFlow`, `contribute.ts:145`):** `git rev-parse --is-inside-work-tree`
  sanity; original-branch capture; branch-exists check (`git rev-parse --verify --quiet refs/heads/...`);
  `git commit -m ... -- CONTRIBUTORS.md` (pathspec form — commits ONLY that file's working-tree content,
  other staged changes are left in the index); porcelain dirty-check skips a no-op commit; `git push -u
  origin <branch>`; `gh pr create --base main --head <branch>`; `finally` returns to the original branch
  (best-effort, swallowed) so a failed checkout-back cannot misreport a successful PR.
- **Duplicate safety:** `checkContributorExists` (`contribute.ts:68`) matches `@user` bounded right by
  whitespace/EOL, case-insensitive; the handler exits early with "already listed" before appending.
- **Both-builds gating:** no entry in `SAVANT_FREE_REMOVED_COMMAND_IDS` / `SAVANT_FREE_ONLY_COMMAND_IDS`
  and no `SAVANT_FREE_REMOVED_COMMANDS` registry set entry → `/contribute` resolves in paid AND free
  registries (verify with the FID-007 V4 parity test).

**Questions for Nova:** (a) Is the `execFileSync`-argv deviation an acceptable superset of the FID's
`execSync` + try/catch requirement (same Law-14 intent, strictly less injection surface), or does it
require a FID amendment? (b) Is the pathspec-commit flow the safest way to guarantee a PR that contains
only `CONTRIBUTORS.md`? (c) Does the no-arg `git config user.name` fallback interact acceptably with Task
3's repo-local bot identity (documented in the command docstring: pass the username explicitly once bot
authorship is enabled)?

### Claim 3 — Task 3 artifacts exist, are correctly formatted, and no release.yml was invented

- `.mailmap` (repo root) follows the git format `Proper Name <proper@email> Commit Name <commit@email>` and
  maps `CommandCodeBot <commandcodebot@users.noreply.github.com>` and
  `savant-bot <savant-bot@users.noreply.github.com>` → `savant-code <bot@savant-code.com>`.
- `scripts/setup-bot-authorship.sh` is `#!/usr/bin/env bash`, `set -euo pipefail`, `cd`s to
  `git rev-parse --show-toplevel`, sets repo-local `user.name`/`user.email` to the bot, and documents the
  `git -c` one-shot + `git config --unset` revert — it never touches the global git config.
- `CONTRIBUTORS.md` contains both seed rows (`@savant0x`, `@savant-code`) and the `/contribute` command
  would append below them (verify `formatContributorRow`, `contribute.ts:77`).
- **No `release.yml` was created** (`ls .github/workflows/` → only `build-release-binaries.yml`). The FID's
  R5/G2 correction (this repo's release tooling does NOT commit: `release.py` targets
  `fame0528/savant-protocol`, `release.ts` dispatches to `SavantCode/savant-free-private`) is unchanged.

**Question for Nova:** is the authorship surface (Forge/automation + version-bump commits via the setup
script / `git -c`) the complete, honest scope — or is there a commit-producing release path in this repo
the FID still missed?

### Claim 4 — Validation evidence is real and tool-derived

Independently re-run (all from repo root):

- `cd cli && bun test src/commands/__tests__/contribute.test.ts` → **20 pass / 0 fail** (covers
  sanitize/duplicate/content-builder/git-flow incl. branch-exists, clean-commit skip, failure propagation +
  branch return; handler usage / no-arg / duplicate / partial-failure paths).
- `cd cli && bun test src/commands/__tests__/registry-gating.test.ts` → **5 pass / 0 fail** (FID-007 V4
  parity, both flavors).
- `cd cli && bun run typecheck` → exit 0.
- `bun x eslint . --max-warnings 0` → 0 problems; `bunx prettier --check .` → "All matched files use
  Prettier code style!"; `bun run lint:md` → 0 errors.
- Root `bun run test` → all workspace suites pass, 0 fail (aggregate 4,883 pass at close time).

**Question for Nova:** do the above commands reproduce the claimed results on this machine, and are the
claimed test counts consistent with the files on disk?

### Claim 5 — FID lifecycle and records are honest

- FID moved to `dev/fids/archive/FID-2026-0806-004-remove-commandcodebot-and-contributor-system.md`,
  `Status: closed`, `YAGNI-Compliance: Verified`.
- Loop 2 records the Nova PASS verdict with the response path; Loop 3 documents the implementation RED /
  GREEN / AUDIT, including the `execFileSync` deviation and the cross-task identity note (post-review).
- `Resolution` is fully populated except `Commit/PR` (correctly `pending` — operator commits/pushes; the
  working tree is intentionally uncommitted for Nova signoff).
- `CHANGELOG.md` gained a "Contributor system + CommandCodeBot remediation (FID-2026-0806-004)" entry.
- The Nova pre-implementation response artifact
  (`dev/nova/inbox/2026-08-06-fid-004-commandcodebot-nova-audit-response.md`) received only the standard
  third-party markdownlint disable header (content untouched, repo convention).

**Questions for Nova:** (a) Is `closed` (post-implementation, pre-commit) the correct honest state, or
should the FID remain `fixed` until the operator commits? (b) Does the FID's own Loop-3 AUDIT contradict
anything you find on disk?

## Files to Read

1. `dev/fids/archive/FID-2026-0806-004-remove-commandcodebot-and-contributor-system.md` (0–EOF; Loop 2
   verdict + Loop 3 implementation evidence)
2. `dev/nova/inbox/2026-08-06-fid-004-commandcodebot-nova-audit-response.md` (pre-implementation PASS)
3. `dev/nova/outbox/2026-08-06-remove-commandcodebot-and-contributor-system.md` (originating task)
4. `cli/src/commands/contribute.ts` (the implementation, 0–EOF)
5. `cli/src/commands/__tests__/contribute.test.ts` (20 tests)
6. `cli/src/commands/defs/core.ts` (`CORE_COMMANDS` registration, line 91)
7. `cli/src/data/slash-commands.ts` (menu parity entry, line 287; removal-set absence)
8. `cli/src/commands/command-shared.ts` (`defineCommandWithArgs` / `CommandHandler` / `clearInput`)
9. `cli/src/project-files.ts` (`getProjectRoot`)
10. `cli/src/commands/__tests__/registry-gating.test.ts` (FID-007 V4 parity contract)
11. `.mailmap`, `CONTRIBUTORS.md`, `scripts/setup-bot-authorship.sh` (Task 3 artifacts)
12. `.github/workflows/build-release-binaries.yml` + `cli/scripts/release.ts` + `scripts/release.py`
    (no-commit release surface, Claim 3)

## Known Verification Status (reported honestly)

- Gates re-run at close time, all green: `eslint . --max-warnings 0` → 0; `prettier --check .` → clean;
  `lint:md` → 0; `cli` typecheck → exit 0.
- Test suites: `cli` full suite → 2,854 pass / 0 fail; root `bun run test` → 12 workspace suites, 0 fail
  (4,883 pass aggregate); `contribute.test.ts` → 20 pass; `registry-gating.test.ts` → 5 pass.
- The new implementation files are **untracked** in git (`??`) — the operator has not committed yet; the
  FID Resolution's `Commit/PR: pending` reflects this. Nova should not treat untracked files as a defect;
  the working tree is the review target.
- A third-party code reviewer (`code-reviewer-deepseek-flash`) reviewed the implementation and passed it
  after two minor fixes (identity-collision docstring note; "git/gh flow failed" wording) that are already
  in the tree and covered by the test suite.

---

*Report written 2026-08-06 by Savant (Savant ECHO v0.1.2). Awaiting Nova's independent implementation
signoff before the operator commits and pushes (no force-push, per Task 1).*
