# Session 2026-08-23 20:52 — Harness Stability Marathon + Closure Pass Closeout

## Initial State

Resumed mid-marathon: FID-2026-0823-009 (Law-1 path-form mismatch + undefined
yield keys) had just closed; the four-FID closure pass
(-0820-009/-0822-014/-0823-004/-0823-007) was operator-approved but blocked by
the very defects under repair. A third Recorder read-without-write stall had
reproduced post-restart with the -009 fix live.

## Accomplishments

### FID-2026-0823-011 — Recorder context-bloat stall root-caused + fixed

- RED forensics: all three Recorder stalls show exactly +3 messageCount
  deltas (94→97, 2050→2053, 2874→2877) vs the historical +6 success class —
  the child read the target then ended its turn with TEXT, never calling
  write_file. Zero gate-block traces attributable to any child (awk
  co-occurrence check: `before the closed transition` × `FID gate:` = 0 rows;
  the 5 orphan phrase hits were test-output echoes).
- Root cause: `includeMessageHistory: true` inherited entire parent
  conversations (653K-token spawns) → long-context instruction collapse.
  Contributing: edit-instructions spawn prompts vs the documented
  complete-content contract.
- Fix: agents/recorder/recorder.ts — `includeMessageHistory: false`;
  scaffold seal re-threaded via `params.scaffoldComplete` OR'd with the
  legacy history scan; instructionsPrompt Turn Contract terminal condition.
  Bundle regenerated (`prebuild:agents`).
- Gates: agents+cli typecheck exit 0; eslint --max-warnings 0; fid:verify
  receipt stamped 3/3 gates PASS; markdownlint clean (API-level probe).
- ECHO.md Spawning-the-Recorder contract updated: Context Contract block,
  seal-via-params channel, stall-evidence common-mistake line; protocol
  bundle regenerated, :check PASS. Verifier PASS WITH CONDITIONS on the RED
  record — both NEEDS-REVIEWs discharged (stall #1 Start record extracted:
  94→97 confirms +3; contextTokenCount semantics cited to
  context-compactor.ts:150-191).
- Status `fixed`. OPEN: definitive live Recorder UPDATE probe is RESTART-
  GATED (running process predates the fix) — carried NEEDS-REVIEW.

### Closure pass (operator directive "close all 4 fixed")

- FID-2026-0820-009 Tauri shell supervisor, FID-2026-0822-014 structured
  output cards, FID-2026-0823-004 processAgentDefinitions fix, FID-2026-0823-007
  Laws 1/4 universal hard blocks — all status→closed, moved to archive,
  CHANGELOG entries prepended, archive README indexed.
- Carried operator-side smoke boundaries waived per directive (waiver
  precedent FID-2026-0823-005); recorded as never claimed passed.
- fid-ledger probe LEDGER_OK after moves.

## Lessons Recorded (dev/LEARNINGS.md)

A. markdownlint false-clean trap: CLI/shim/bunx invocations can degrade to
   usage+exit 0 (false-clean). Reliable channel: import { lint } from
   'markdownlint/sync' via a bun probe with .markdownlint.json config
   (dev/scratchpad/md-lint-probe.ts pattern). Direct-API linting must apply
   .markdownlintignore manually — dev/fids/archive/** and CHANGELOG.md are
   exempt (an ignore-blind probe reported 596 out-of-scope findings).
B. Law-1 path-form canonicalization: raw-string guards spanning a
   transformation boundary become hard failures when escalated from advisory
   to blocking; canonicalize at registration AND check time.
C. Specialized sub-agents must not inherit unbounded parent conversation
   history — silent read-then-stop failure mode; thread narrow signals via
   spawn params instead.
D. messageCount-delta forensics from debug/cli.jsonl Start/End records
   classify child runs mechanically (+3 read-only stall / +6 read+write for
   Recorder-class) — cheaper than gate-log attribution.

## Open Items

1. FID-2026-0823-011: restart harness → one live Recorder UPDATE probe →
   flip NEEDS-REVIEW row → close via audit ceremony.
2. Queue-to-zero master FID-2026-0823-003 Step Status rows referencing the
   four newly archived children need refresh (U-row bookkeeping).
3. dev/fids/README.md active table lists records archived today — refresh
   pending.
4. Interrupted four-FID closure pass is now COMPLETE (this session); no
   residual work.
5. Deferred hardening from -009/-011: Fn-only handleSteps gate alignment at
   loop-iteration.ts:218 / run-programmatic-step.ts:61 / step.ts:336;
   conversion-site consolidation; zod-dump truncation in invalid-yield
   errors; win32 case-variance in canonicalizePath.

## Verification State

All gates green at closeout: fid-ledger LEDGER_OK; markdownlint clean on all
touched in-scope files (node direct entrypoint / API probe — NOT the shim);
agents+cli typecheck exit 0; eslint --max-warnings 0 on touched sources;
protocol bundle :check PASS. Working-tree closure throughout
(release-only-commits convention).