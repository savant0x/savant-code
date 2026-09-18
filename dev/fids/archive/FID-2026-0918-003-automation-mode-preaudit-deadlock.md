# FID-2026-0918-003 — Automation-Mode Release Is Dead Code

> Preaudit clean-tree block contradicts the required-changes automation
> commit.

## Metadata

**Filename:** FID-2026-0918-003-automation-mode-preaudit-deadlock.md
**ID:** FID-2026-0918-003
**Severity:** medium
**Status:** verified
**Created:** 2026-09-18

## Summary

`SAVANT_CODE_RELEASE_AUTOMATION=1` — the documented non-interactive release
path (`docs/public-release.md:46-49`) — can no longer complete a release.
The pre-audit (FID-2026-0913-004, shipped in v0.0.31) blocks any dirty
worktree before the stages run, while the automation-commit stage **fails**
when the worktree has no changes. The two requirements are mutually
exclusive: a dirty tree dies at the pre-audit, a clean tree dies at the
automation commit. Automation mode is unreachable in all cases.

## Problem

Live evidence from the v0.0.32 release day (2026-09-18):

1. **Clean tree + automation** → `SAVANT_CODE_RELEASE_AUTOMATION=1 bun run
   release:public` printed `Automation mode found no changes to commit.`
   and exited 1 (receipt: mode `automation`, completedStages
   `["AUTHENTICATION"]`, failedStage `Automation mode found no changes to
   commit.`).
2. **Dirty tree (1 untracked path) + automation** → pre-audit BLOCK:
   `worktree is dirty (1 path(s)); the release refuses to start.`

### Root cause — two stages demand opposite worktree states

- `scripts/public-release/pre-audit-local.ts:24-90` —
  `checkWorktreeClean` runs `git status --porcelain
  --untracked-files=all`; any dirty path not in
  `TELEMETRY_CHURN_PATHS = ['dev/experiences/raw-traces.jsonl']`
  (line 19) produces a `severity: 'block'` finding (line 85).
- `scripts/public-release/transaction.ts:245-258` — `runPreAudit(root,
  version, preAuditMode)` runs before any stage; `preAudit.blocked &&
  preAuditMode !== 'preview'` → `fail(...)`.
- `scripts/public-release/stages.ts:92` — `runProfileStage` then calls
  `commitAllAutomationChanges(root, version)`, which
  (`scripts/public-release/git-publish.ts:30` and `:41`) calls
  `fail('Automation mode found no changes to commit.')` when
  `git status --porcelain --untracked-files=all` is empty.

So automation mode requires `status` non-empty (commit stage) **and**
empty (pre-audit) at the same instant. The churn carve-out does not save
it: if only `raw-traces.jsonl` is dirty, the pre-audit auto-commits it
(mutation mode), producing the clean tree the commit stage then rejects.

### History — this regression shipped with the pre-audit

Automation mode worked before v0.0.31: `git log --oneline --grep='prepare
v'` shows automation commits `51fa261c` (v0.0.28), `93c58892`/`372e9c3b`/
`1eaa4d4f` (v0.0.27), `8c34b19f` (v0.0.25) — all created by
`commitAllAutomationChanges` before FID-2026-0913-004 added the pre-audit.
v0.0.31 and v0.0.32 shipped via manual mode (operator TTY confirm), which
requires a clean tree and never enters the automation-commit stage.

## Proposed Solution

Resolve the contradiction at the only stage that demands dirt: make the
automation-commit stage tolerate a clean tree by tagging the current HEAD.

1. **`scripts/public-release/stages.ts`** (`runProfileStage`): when
   `commitAllAutomationChanges` would find an empty status, skip the
   commit — record `committedHead` = current HEAD, `committedFiles: []`,
   still `markStage(receipt, 'AUTOMATION_COMMIT_ALL')`, and log
   `Automation commit: worktree clean — tagging current HEAD <sha>`.
   Implementation shape: add a `hasChanges` check (or a
   `commitAutomationChangesOrTagHead` helper in
   `scripts/public-release/git-publish.ts`) instead of the two bare
   `fail(...)` calls on empty status.
2. **Keep the pre-audit untouched.** `checkWorktreeClean` stays a total
   block on dirty trees in automation mode — it is the guard that failed
   shut correctly during the live attempt, and weakening it (Option B)
   would trade a real safety property for convenience.
3. **`scripts/public-release/transaction.ts`** — verify
   `recoverAutomationCommit` tolerates `committedFiles: []` on resume
   (it only runs on a receipt/headSha mismatch; with no automation commit
   created it must fall through to the existing HEAD-changed refusal,
   identical to manual-mode semantics — no code change expected, pin
   documents it).
4. **`docs/public-release.md`** — amend transaction-order step 5:
   "stage all current changes and create one `chore(release): prepare
   v<version>` commit; when the worktree is clean, the tag points at the
   current HEAD and no commit is created."

### Invariants preserved

- The pre-audit remains the single fail-closed gate on worktree churn —
  no new exemption path.
- Dirty-tree automation releases behave exactly as before (one sweep
  commit, credential scan, governance-sweep warning).
- Receipt schema unchanged: `release-receipt/v2` already models
  `committedHead` + `committedFiles` (empty list is valid data).
- Manual mode untouched (clean tree + TTY confirm, the path that shipped
  v0.0.31 and v0.0.32).

## Affected Components

- `scripts/public-release/stages.ts` (clean-tree branch in
  `runProfileStage`)
- `scripts/public-release/git-publish.ts` (empty-status early return or
  `commitAutomationChangesOrTagHead` helper)
- `scripts/public-release-git.test.ts` (RED-first pins)
- `docs/public-release.md` (step-5 amendment)

## Verification Gates

- gate: test scripts/public-release-git.test.ts
- gate: test scripts/public-release-tag-hygiene.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9114354444bd357459baa02e27f71a1506c53c1a6f5fb99e299df8969a2b5823
- verified: 2026-09-18T20:06:22.046Z
- test scripts/public-release-git.test.ts: exit 0
- test scripts/public-release-tag-hygiene.test.ts: exit 0
- quality: exit 0

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and are modified
- [x] Implementation matches the Proposed Solution
- [x] RED-first pins pass after failing first (missing export, 0 pass)
- [x] Production call-graph reachability: stages.ts:92 routes through commitAutomationChangesOrTagHead (detail in Implementation Evidence)
- [x] Typecheck/tests/lint pass with pasted tool output

## Implementation Evidence

- RED first: `bun test scripts/public-release-git.test.ts` failed with the
  missing-export error (0 pass) before implementation.
- GREEN: `public-release-git.test.ts` + `public-release-tag-hygiene.test.ts`
  — **8 pass / 0 fail (30 expects)**; contract suites
  (`public-release.test.ts`, `public-release-credential-scan.test.ts`) —
  **15 pass / 0 fail**; root `bun run typecheck` (12 workspaces) exit 0;
  `quality:report` PASS (1498 files — after the tag-hygiene split held
  `public-release-git.test.ts` under the 300-line ceiling); eslint
  `--max-warnings 0` clean; prettier clean; `lint:md` PASS;
  `validate:repository` PASS.
- RED-first pin detail: clean-tree automation produces no commit and
  records `committedFiles: []` at the pre-existing HEAD; dirty-tree
  automation still creates exactly one sweep commit through the shared
  entry point (regression pin).
- Reachability detail: `runProfileStage` → `commitAutomationChangesOrTagHead`
  (`stages.ts:92`) → `markStage('AUTOMATION_COMMIT_ALL')`; exported via the
  `scripts/public-release.ts:90` barrel; no remaining non-test
  `commitAllAutomationChanges` callers.
- Ceiling split: the tag-prune test moved verbatim to
  `scripts/public-release-tag-hygiene.test.ts` (FID-2026-0915-002
  move-only discipline; assertion count preserved); the placeholder stub in
  the origin file was removed rather than left as a tautology (per the
  FID-2026-0917-005 tautological-test lesson).

## Perfection Loop

**Loop 1 → 2 (approach revision):** the first draft exempted automation
mode from the pre-audit clean-tree block (treat automation as
allowed-dirty). Rejected in review: it weakens the guard that correctly
failed shut during the live v0.0.32 attempt, and the sweep-ambiguity
warning (`git-publish.ts:56-66`) exists precisely because swept content
is not reviewed. Loop 2 inverts the fix: keep the pre-audit absolute and
make the commit stage accept the clean tree it is now guaranteed to see.

**Loop 3 (convergence, change delta <2%):** drift audit — resume path
checked (`recoverAutomationCommit` never runs when no commit was created
unless HEAD moved, in which case the existing refusal is correct);
receipt contract checked (`committedFiles: []` needs no schema change);
docs amendment added to scope; desktop stages out of scope (skipped
independently of this defect).

### Missed Questions

- **MQ1 — Does clean-tree tagging break `--resume`?** No new failure
  mode: with no automation commit, `receipt.headSha` is the pre-flight
  HEAD; a later HEAD change still trips the existing "Release HEAD
  changed" refusal, same as manual mode. Pinned in tests.
- **MQ2 — Should the receipt distinguish "tagged HEAD" from "swept
  commit"?** Not required: `committedFiles: []` already encodes it, and
  adding a schema field for a boolean derivable from existing data
  violates the minimal-change discipline.
- **MQ3 — Why not auto-commit inside the pre-audit for automation mode
  (Option C)?** It duplicates the commit stage's job and would create a
  second commit source; the churn carve-out stays narrow
  (`raw-traces.jsonl`) by design.

## Resolution

- **Closed Date:** 2026-09-18
- **Fix Description:** `commitAutomationChangesOrTagHead` in
  `scripts/public-release/git-publish.ts` — a clean worktree (which the
  pre-audit now guarantees in automation mode) records the current HEAD
  with `committedFiles: []` and creates no commit; a dirty worktree still
  sweeps into the single `chore(release): prepare v<version>` commit with
  the credential scan + governance warning intact. `runProfileStage` wired
  to the new entry point; the pre-audit is untouched (still the absolute
  clean-tree gate); `docs/public-release.md` transaction-order step 5
  amended.
- **Tests Added:** Yes — 2 pins in `scripts/public-release-git.test.ts`
  (clean-tree tag-HEAD: no commit, HEAD unchanged, empty file list;
  dirty-tree sweep regression through the shared entry point), plus the
  verbatim tag-hygiene split file. Suite 8/0 (30 expects).
- **Verification Evidence:** see Code Verification Evidence (RED-first
  failure captured, then all gates green with tool output); receipt stamped
  via `bun run fid:verify --write`.
- **Archived:** 2026-09-18 — moved to `dev/fids/archive/`; receipt re-stamped
  at the archived path.
