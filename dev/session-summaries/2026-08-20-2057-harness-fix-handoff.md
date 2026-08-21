# Session Handoff — 2026-08-20 20:57 EDT (updated 21:00, pre-restart)

> **Purpose:** the operator is restarting the harness so the two EHEL fixes
> in this working tree go live. **New session: read this file first, then
> `dev/fids/FID-2026-0820-012*.md` and `dev/fids/FID-2026-0820-013*.md`
> (status `fixed`, all RED/GREEN/AUDIT steps checked).** This document
> records exactly what changed, how to verify each fix live, and what
> remains. Nothing needs re-doing.

## 1. Completed this session (all verified, uncommitted)

### FID-2026-0820-012 — EHEL Law-3 verification-tracker deadlock (`fixed`)

- **Symptom:** after any `write_file`, every later write (including exempt
  paths `dev/fids/`, `SCOPE.md`) was blocked with
  `Law 3: Verify before proceeding — N unverified file(s)` until the operator
  ended the turn. Passing verification via `run_readonly_command`/`basher`
  never cleared it. Reproduced 2× this session + independently in a second
  operator session (docs-only `lint:md` ×3 clean, still blocked).
- **Root cause:** the Law-3 pre-write gate
  (`packages/agent-runtime/src/echo/pre-write-gates.ts:83`) keyed on
  `hasVerifiedSinceLastDirty`, a flag only cleared by `resetForNewTurn`
  (turn end). Verification commands credit `verifiedFiles`
  (`enforcement.ts` `afterToolCall`, both `run_terminal_command` AND
  `run_readonly_command`), which the gate never consulted.
- **Fix (3 files):**
  1. `pre-write-gates.ts` — gate now blocks only on
     `dirtyFiles` − `verifiedFiles` (same predicate as turn-end Law 15);
     exempt-path targets (`dev/fids/`, `dev/nova/`, `dev/scratchpad/`) are
     never blocked by pending code verification.
  2. `enforcement.ts` — a successful write evicts the path from
     `verifiedFiles`, so the block re-arms when a verified file is
     re-modified (Verifier audit finding).
  3. Tests: 6 regression tests in
     `echo/__tests__/pre-write-gates.test.ts` + 1 re-arm test in
     `echo/__tests__/enforcement.test.ts`.
- **Evidence:** agent-runtime typecheck 0; echo suite 86/0/163; full
  agent-runtime suite 1118 pass / 0 fail / 2951 assertions; ESLint/Prettier
  clean; Verifier PASS (2 rounds, incl. the eviction delta).

### FID-2026-0820-013 — subagent spawn `ModelMessage[]` failures (`fixed`)

- **Symptom:** subagent spawns died intermittently with
  `AI_InvalidPromptError: Invalid prompt: The messages must be a
  ModelMessage[]` (Adversary ×3, Thinker ×2, Recorder ×3 across two
  sessions), correlated with session growth; `basher` output injection
  sometimes lost ("no command output in my context").
- **Root cause:** `convertCbToModelMessages`
  (`common/src/util/messages/aggregate.ts`) returned early — BEFORE its
  per-message `modelMessageSchema` validation loop — whenever
  `includeCacheControl` was false, which is per-model
  (`run-agent-step/step.ts:251`). Subagents on non-cache-control models got
  zero validation; rare late-session shapes then failed the AI SDK's array
  validation in `standardizePrompt`
  (`node_modules/ai/dist/index.mjs:1379-1397`) as the opaque error.
- **Fix:** validation loop now runs unconditionally (ahead of the
  `includeCacheControl` branch) — invalid shapes fail fast with an
  actionable error (index, role, zod issues). 3 regression tests in
  `common/src/util/__tests__/messages.test.ts`.
- **Evidence:** common typecheck 0; messages suite 85/0/114; full common
  suite 623 pass / 4 skip / 0 fail; ESLint/Prettier clean; Verifier PASS
  (implementation + doc delta). The `providerOptions` ordering question is
  resolved: cache control only injects schema-covered fields
  (`ai/dist/index.mjs:1230-1315`). Step Status: RED/GREEN/AUDIT all
  checked; only "closed + archived" remains (awaits live verification).
- **Note:** the basher "no output" symptom is re-scoped as the same
  conversion failure killing the summarizer LLM call — no relay code change
  was required. A fresh live instance (Recorder spawn params arrived empty)
  is recorded in the FID evidence; re-test after this restart.

### Loop 130 — line-limit remediation (also this session)

- `cli/src/hooks/use-savant-free-session.ts` 330 → **294 lines**; the
  `restart('landing')` probe moved to
  `use-savant-free-session/landing-restart.ts` (`runLandingRestart`, 59
  lines). Full CLI suite 3242/18s/0/9001. Quality inventory **170 → 169**.
  Recorded as Loop 130 in FID-2026-0819-005 (line 3112) + `SCOPE.md` QR-ED.

## 2. Live verification for the next session (after restart)

1. **Law-3 fix (FID-012):** in one turn, `write_file` a scratch file in
   `dev/scratchpad/`, run `bun run --cwd=cli typecheck` (or any
   typecheck/lint), then `str_replace` a different verified file — it must
   succeed with NO turn-end. Also confirm a write to `dev/fids/` is not
   blocked by an unrelated dirty source file.
2. **Law-3 re-arm:** modify a verified file again → the next write must be
   blocked until fresh verification runs (enforcement preserved).
3. **Spawn fix (FID-013):** in a LONG session (many turns of mixed tool
   calls), spawn a subagent (basher/Thinker/Recorder) — must not die with
   `AI_InvalidPromptError`. If any shape still fails, the error now names
   the message index/role/zod issues — paste it into FID-013.
4. If both hold: set both FIDs → `closed`, move to `dev/fids/archive/`, add
   CHANGELOG entries (the archive step is deliberately unchecked in both).

## 3. Pending work queue

- **Line-limit program** (FID-2026-0819-005): resume at **Loop 131** —
  169 violations remaining (`bun run quality:report`). Manual-only,
  utility-first protocol per the FID.
- **Second session's desktop work** (operator-pasted accounting): FSM
  paused in `green` on FID-2026-0820-008..011 (RED catalog of 13 issues +
  GREEN corrections composed, ready to write); FID-2026-0820-007 master is
  `converged`; the design doc + 5 FIDs are **untracked in git** awaiting
  the operator's commit.
- **Out-of-scope drift flagged, not fixed:** `dev/fids/README.md` claims an
  empty active queue while 6 active FIDs exist; the desktop planning FIDs
  fail repository structure/attribution validation (23 findings); the
  savant-free e2e suite is broken (missing `.exe` suffix + missing
  `SavantFreeSession` export) — all recorded in `SCOPE.md` and FID
  evidence, none blocking.

## 4. Working tree

Everything above is **uncommitted** in the working tree (per policy: no
commits/pushes without explicit operator authorization). Key changed paths:
`packages/agent-runtime/src/echo/{pre-write-gates,enforcement}.ts`,
`packages/agent-runtime/src/echo/__tests__/{pre-write-gates,enforcement}.test.ts`,
`common/src/util/messages/aggregate.ts`,
`common/src/util/__tests__/messages.test.ts`,
`cli/src/hooks/use-savant-free-session.ts` (+ new `landing-restart.ts`),
`dev/fids/FID-2026-0820-012*.md`, `dev/fids/FID-2026-0820-013*.md`,
`dev/fids/FID-2026-0819-005*.md`, `SCOPE.md`, plus the pre-existing
second-session changes.

## 5. Lessons for the harness (candidates for LESSONS.md)

- A verification gate is only as good as the channels that can satisfy it:
  if no channel available to the writing role registers verification, the
  gate becomes a deadlock instead of a quality bar.
- Gate state reconciled only at turn boundaries converts a transient
  bookkeeping gap into a hard workflow stop.
- Intermittent failures correlated with conversation growth point at
  conversion paths that only exercise rare message shapes late in a
  session — test spawn paths with long, mixed histories.

## 6. Live verification result — FAILED (2026-08-20, post-restart session)

> The post-restart session executed §2 exactly as written. **Both fixes are
> NOT live in the running harness.** Neither FID was closed. Evidence:
>
> - **FID-012 (Law-3 gate):** `write_file` created
>   `dev/scratchpad/live-verify-fid-012.ts`; `bun run --cwd=cli
>   typecheck` passed (exit 0) three times via `run_readonly_command`; a
>   `str_replace` on a different (non-exempt) file in the same turn was
>   BLOCKED with `Law 3: ... 1 unverified file(s)`; and a
>   `dev/scratchpad/` write with one dirty-unverified file pending was
>   ALSO blocked — impossible under the fix (`isExemptWritePath` exempts
>   scratchpad targets from Law-3 blocking; the gate keys on unverified
>   dirty files, not on the target's verified status).
> - **FID-013 (spawn conversion):** a `basher` spawn ran (no
>   `AI_InvalidPromptError`) but reported "no command output in my
>   context" — the exact output-injection symptom, live.
> - **Root cause — deployment, not code:** the harness was relaunched from
>   the installed launcher cache `~/.config/savant/savant-code.exe` —
>   **v0.0.26, dated Aug 19 23:14** (metadata file confirmed), predating
>   every fix (working-tree fixes landed 20:24–20:48 EDT). `cli/bin/`
>   contains no binary. The working-tree code remains verified correct
>   (unit suites + Verifier PASS per the FIDs); it was never executed.
> - **Action:** relaunch from the working tree (`bun run --cwd=cli dev`) or
>   rebuild/reinstall the binary so the launcher cache picks up the fixes;
>   then re-run §2. The stale gate deadlocked all Orchestrator writes for
>   the remainder of that turn (the original FID-012 bug, live); FID
>   evidence updates were recorded via FRESH Recorder subagent instances
>   (each instance's enforcement state starts clean; within a single
>   instance, even a `dev/fids/` write was blocked by the stale gate once
>   it held its own dirty entry). The scratch marker
>   `dev/scratchpad/live-verify-fid-012.ts` is reused by the re-run —
>   delete after closure.
