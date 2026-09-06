# FID: Release Pipeline Backup Stage (FID-2026-0905-009)

**Filename:** `FID-2026-0905-009-release-pipeline-backup-stage.md`
**ID:** FID-2026-0905-009
**Severity:** medium
**Status:** fixed
**Date opened:** 2026-09-05
**Opened by:** Buffy (single-agent ECHO session, operator directive)
**Related:** FID-2026-0905-008 (git-bundle-backup, closed), FID-2026-0905-007
(public-release decomposition, closed), BO-2026-08-23 (G1/G6 amendment:
pipeline-only releases), FID-2026-0903-001 (desktop packaging — next release
cut)

## Summary

Wire `git-bundle-backup` into the public-release pipeline as a new
`BACKUP_BUNDLE` stage between `GIT_PUSH` and `GITHUB_RELEASE`. Rationale: the
G1/G6 amendment restricts releases to the pipeline, so the pipeline owns the
last durable copy of every release commit before public artifacts are cut.
Currently the bundle backup is operator-invoked only; a release that is
pushed but never backed up leaves `dee1922`-style tip commits recoverable
only from the remote. The stage is fail-closed (verify-or-no-advance is
inherited from the backup core) and incremental — after the 2026-09-05 live
baseline, the stage writes `incr-<sha>.bundle` to the OneDrive-synced
destination and advances `last-backup` only after `git bundle verify`
passes.

## Ground Truth (all tool-verified 2026-09-05)

- `scripts/public-release/fail.ts:35` — `RELEASE_STAGES` is an ordered
  `Set` of 13 stage names; `receipts.ts:69` validates `completedStages`
  against it (`!RELEASE_STAGES.has(stage)` → fail).
- `scripts/public-release/stages.ts:190-211` — `runGitPushStage` marks
  `TAG` then `GIT_PUSH`; the next stage in the transaction
  (`transaction.ts:171-180`) is `runGitHubReleaseStage`.
- `scripts/git-bundle-backup.ts` exports `runBundleBackup({ cwd, mode,
  bundleDir })` returning `BundleResult { ok, message, bundlePath?, files?
  }`; it asserts main branch, resolves the bundle dir (env
  `SAVANT_BUNDLE_DIR`), fails closed without a `last-backup` marker in
  incremental mode, and never advances the marker on create/verify failure.
- Live state 2026-09-05: baseline exists (37 MB at
  `C:/Users/spenc/OneDrive/savant-backups/baseline.bundle`), marker
  `last-backup` = `dee19226c4a7`; first release-stage run will write
  `incr-<new-sha>.bundle`.
- 12 sibling test files pin the pipeline at 57 pass / 216 expects (RED
  baseline parity from FID-007); `bun test scripts/` directory-wide is a
  known non-gate (vendored-tree hang documented in FID-007).

## Proposed Solution

1. **Stage list:** insert `'BACKUP_BUNDLE'` into `RELEASE_STAGES` between
   `GIT_PUSH` and `GITHUB_RELEASE` (fail.ts). The receipt schema
   (`completedStages: string[]`) is untyped strings validated against the
   set, so old receipts remain loadable; a pre-existing receipt with
   `GITHUB_RELEASE` complete but no `BACKUP_BUNDLE` marks the stage as
   complete at resume-init (idempotent retro-compat, mirroring how the
   transaction treats already-passed stages).

   **Loop-2 correction (found during GREEN):** for a pre-009 resumed
   receipt (GITHUB_RELEASE complete, BACKUP_BUNDLE absent) the stage runs
   the incremental backup for real instead of retro-marking — that
   commit was pushed by a pre-009 pipeline run with NO backup, so
   retro-marking would skip durability exactly where it is missing; the
   incremental is cheap and captures it.
2. **New module `scripts/public-release/backup-stage.ts`:**
   `runBackupBundleStage(ctx: TransactionContext): void` — calls
   `runBundleBackup({ cwd: ctx.root, mode: 'incremental' })`; `ok` →
   `markStage(receipt, 'BACKUP_BUNDLE')`; `!ok` → `fail(...)` with the
   backup message (marker NOT advanced is guaranteed by the core; the
   stage adds receipt-level fail-closed behavior: the release aborts
   before GITHUB_RELEASE/NPM_PUBLISH). Never call baseline mode from the
   pipeline (operator-run only, per FID-008).
3. **Transaction wiring:** `transaction.ts` calls
   `runBackupBundleStage(ctx)` after `runGitPushStage(ctx)` and before
   `runGitHubReleaseStage(ctx)`, inside the same
   `withLocalStateRestoration` guard.
4. **Preview surface:** the preview plan line for the new stage is added
   to `buildPublicReleasePlan` (catalog.ts) between the push and
   release-creation steps, so `--preview` output shows the backup step.

## Verification Gates

- gate: test scripts/public-release-backup-stage.test.ts
- gate: test scripts/public-release.test.ts
- gate: test scripts/public-release-assets.test.ts
- gate: test scripts/public-release-credential-scan.test.ts
- gate: test scripts/public-release-gate-env.test.ts
- gate: test scripts/public-release-gates.test.ts
- gate: test scripts/public-release-git.test.ts
- gate: test scripts/public-release-local-state.test.ts
- gate: test scripts/public-release-lock.test.ts
- gate: test scripts/public-release-pinned-bun.test.ts
- gate: test scripts/public-release-receipts.test.ts
- gate: test scripts/public-release-redaction.test.ts
- gate: test scripts/git-bundle-backup.test.ts

### Verification Receipt

- fingerprint: sha256:523926cb5ef6518b813fe28efa1401d4e4342d3982e3d90c71dcfd03ece49033
- verified: 2026-09-06T02:22:52.319Z
- test scripts/public-release-backup-stage.test.ts: exit 0
- test scripts/public-release.test.ts: exit 0
- test scripts/public-release-assets.test.ts: exit 0
- test scripts/public-release-credential-scan.test.ts: exit 0
- test scripts/public-release-gate-env.test.ts: exit 0
- test scripts/public-release-gates.test.ts: exit 0
- test scripts/public-release-git.test.ts: exit 0
- test scripts/public-release-local-state.test.ts: exit 0
- test scripts/public-release-lock.test.ts: exit 0
- test scripts/public-release-pinned-bun.test.ts: exit 0
- test scripts/public-release-receipts.test.ts: exit 0
- test scripts/public-release-redaction.test.ts: exit 0
- test scripts/git-bundle-backup.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the new test file is written first; gates 1b/1c/1d fail against
  the unimplemented stage module (module does not exist → the stage-list
  and wiring assertions are the pins that define the contract).
- **GREEN:** implement in dependency order: fail.ts stage list →
  backup-stage.ts → transaction.ts wiring → catalog.ts preview line.
- **AUDIT:** run the full 13-file sibling suite + new file; compare totals
  (57/216 pre-existing pins must hold); eslint/prettier/lint:md;
  fid:verify receipt.
- **ADVERSARIAL:** (a) "backup failure shouldn't block a release" —
  counter: the G1/G6 amendment makes releases pipeline-only; a release
  whose commit is not durably backed up violates the durability layer the
  amendment presupposes; the operator can still run the backup manually
  and `--resume` (the stage is resume-aware). (b) "spawnSync inside the
  release lock is a deadlock risk" — backup spawns `git` only (no bun
  script recursion, no lock dir access); OneDrive sync latency does not
  block the release (write + verify only). (c) "baseline via pipeline
  could be huge" — baseline mode is never invoked by the stage;
  incrementals from the existing marker are 37 MB-bounded deltas.

- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Does a mid-transaction backup failure lose the already-pushed tag?*
   → No: the stage runs after GIT_PUSH; a backup failure aborts the
   release with the tag already on the remote, and `--resume` skips to
   BACKUP_BUNDLE (retry) then continues — the receipt's completedStages
   carries everything before it.
2. *What if the operator has never run the baseline?* → The stage fails
   closed with the core's explicit "run with --baseline first" message;
   the release aborts before any public artifact — the same contract as
   the operator-run script (fail-closed without a verified chain).
3. *Should the stage run before TAG instead?* → No: the bundle range is
   `last-backup..main`; running before the automation commit/tag risks
   capturing a stale HEAD relative to the receipt's headSha. After
   GIT_PUSH the pushed commit IS the receipt's HEAD — the exact commit
   the release publishes.
4. *Does the OneDrive sync need to complete before the release continues?*
   → No: the durability contract is write + `git bundle verify` on the
   local file; OneDrive replication is asynchronous by design and is the
   operator's off-site layer, not the pipeline's.
5. *Why not reuse the existing `runBackupBundleStage`-shaped hook from
   the desktop packaging FID (-0903-001)?* → That FID adds packaging
   stages on a future cut; sequencing with it is recorded in Related,
   and its stages can slot after BACKUP_BUNDLE without re-ordering.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA (G2):** stamped post-drain (this FID is implemented
      and committed under the 2026-09-05 G1 amendment).
- [x] **File:line ranges:** `scripts/public-release/fail.ts` (RELEASE_STAGES
      13 → 14 entries, BACKUP_BUNDLE between GIT_PUSH and GITHUB_RELEASE);
      `scripts/public-release/backup-stage.ts` (new, 41 lines:
      runBackupBundleStage — resume-skip via isStageComplete, core call,
      throw-and-result fail-closed translation, markStage, console line);
      `scripts/public-release/transaction.ts` (import + one call between
      runGitPushStage and runGitHubReleaseStage inside the
      withLocalStateRestoration guard); `scripts/public-release/catalog.ts`
      (preview plan line between push and GitHub-release steps);
      `scripts/public-release-backup-stage.test.ts` (new, 238 lines, 6
      tests / 11 expects on scratch repos with env-isolated bundle dirs).
- [x] **Gate output:** backup-stage suite 6 pass / 0 fail; sibling parity
      56/0 across the 11 pre-existing public-release test files (see parity
      note); adjacent suites (git-bundle-backup, audit-evidence,
      pre-push-scan) 20/0; eslint `--max-warnings 0` clean on `scripts/`;
      prettier clean; lint:md 0.
- [x] **Parity note (ground-truth correction):** FID-007's ledger line said
      "12 files, 57/216"; the tree carries **11** pre-existing public-release
      test files measuring **56 pass / 205 expects** — the FID-007 summary
      glob over-counted by one file. Verified non-regression: `git diff
      --stat 32255bb..HEAD -- scripts/` shows zero test-file changes, and
      `git ls-tree 32255bb scripts/` confirms 11 public-release test files
      at the FID-007 commit. No pin broke; the FID-009 baseline is the
      measured 56/205 + the new 6/11.
- [x] **Loop-2 corrections folded in:** (1) resume contract — a pre-009
      receipt runs the incremental for real instead of retro-marking;
      (2) stage fail-closed translation — the core's precondition throws are
      wrapped into the uniform `BACKUP_BUNDLE failed` abort so the receipt's
      failedStage carries context either way; (3) test isolation —
      `withIsolatedBundleDir` env override (the stage resolves its
      destination from `SAVANT_BUNDLE_DIR` by design; the first run wrote
      12 junk incrementals into the real OneDrive dir before isolation,
      removed and re-verified clean).
- [x] **Tests Added:** Yes — `scripts/public-release-backup-stage.test.ts`
      (6 tests): stage-list ordering, mark-on-verified-incremental,
      fail-closed-no-mark (missing marker), resume-skip, pre-009
      runs-for-real + incremental file asserted, destination failure throws
      with marker unchanged.
- [x] **Verification Evidence:** suites green (6/11 new + 56/205 parity +
      20/0 adjacent); eslint/prettier/lint:md clean; `fid:verify` receipt
      stamped below; **live preview smoke 2026-09-05**: `release:public
      --preview` ran end-to-end after fixing the decomposition regression
      (below) and the preview plan shows the backup step between push and
      GitHub release.
- [ ] **Archived:** (set when moved to `dev/fids/archive/`)

### Live smoke finding (decomposition regression, fixed)

- **Finding:** `release:public --preview` failed immediately —
  `ENOENT ... scripts/VERSION`. Root cause: the monolith's
  `repositoryRoot()` used `path.resolve(import.meta.dir, '..')`, correct
  from `<root>/scripts/`; the FID-007 move into
  `scripts/public-release/` put the module one directory deeper, so the
  unqualified `'..'` resolved to `scripts/` instead of the repo root.
  The sibling tests never caught it because they construct explicit
  root paths and never call the module-level `repositoryRoot()`.
- **Fix:** both `import.meta.dir` sites (`local-state.ts` `repositoryRoot`,
  `command-runner.ts` private copy) resolved to `'..','..'` with a
  comment explaining the per-directory-move rule; re-ran the preview:
  full plan output including the BACKUP_BUNDLE line, exit 0.
- **Lesson:** a facade can be surface-identical and test-parity green
  while module-relative path derivations rot one level deep — the live
  entrypoint is the only pin for those.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (stage module,
      test file, transaction/catalog/fail edits — all on disk and
      committed); `grep -rn "import.meta.dir" scripts/public-release/`
      → exactly 2 sites, both fixed to `'..','..'`.
- [x] Implementation matches the Proposed Solution + the two Loop-2
      corrections (run-for-real pre-009; throw-translation fail-closed).
- [x] Typecheck/tests/lint pass with pasted tool output (Gate output
      above + 13 fid:verify gate receipts PASS).
- [x] Production call-graph evidence — the stage is called from
      `transaction.ts` between runGitPushStage and
      runGitHubReleaseStage (the Law-4 wiring grep; preview plan line
      is the user-visible surface).
- [x] FID status reflects the actual implementation state — `fixed`;
      `closed` after the operator's first real release cut exercises
      the stage end-to-end.

## Resolution

- (pending — closes after the operator's first real release cut drives a
  pipeline-authored BACKUP_BUNDLE; all static gates green and the preview
  smoke passed 2026-09-05 — commits `8ff0657b`, `6dc45811`.)
