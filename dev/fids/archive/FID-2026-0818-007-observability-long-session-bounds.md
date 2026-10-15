<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-007 — Auto Drive observability + long-session bounds: status, queue growth, pause/resume, report, memory caps

**Severity:** medium
**Status:** closed
**ID:** FID-2026-0818-007
**Filename:** `FID-2026-0818-007-observability-long-session-bounds.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001
**Depends On:** FID-2026-0818-004

## Summary

The operator's window into a multi-hour autonomous run, and the memory
hygiene that keeps the run alive. Observability: `/auto status` (goal, active
FID, phase, open count, queue-growth trend), live sidebar surfaces (FID cards
+ drive state, reusing AgentActivity kinds), Esc pause/stop (operator control,
never a confirmation), crash resume (queue = `dev/fids/` scan + master
manifest — no bespoke persistence), and the handoff report: `/export` with
the Run Log (child 005) + certification record (child 006). Long-session
bounds: proactive L0-L3 compaction at FID boundaries (not just reactive),
Immer destructive trims on TUI arrays (`thoughtHistory`, message blocks,
tool entries), and hard caps on prompt/agent/runtime caches — the Every Code
bounded-state pattern applied to the Zustand store.

## Environment

- `common/src/types/session-state.ts:110` — `AgentActivity` kinds
  (`idle | thinking | tool | subagent | researching`) — the drive-state
  broadcast channel.
- `cli/src/state/chat-store/` — Zustand + Immer stores (`chat-store.ts`,
  `message-block-store.ts`, etc.) — the trim targets.
- `agents/context-pruner/` + `packages/agent-runtime` compaction —
  4-layer progressive auto-compaction (README) — L0-L3 at FID boundaries.
- `cli/src/commands/export-conversation.ts` — `/export` self-contained
  branded HTML report — the handoff artifact.
- `cli/src/commands/goal.ts` — `/goal status` rendering pattern — the
  `/auto status` model.
- `common/src/crypto/keys.ts` + `common/src/provenance/` — ZTAP ledger
  (append-only session ledger survives restarts) — resume provenance.
- `resources/code-main/docs/auto-drive.md` — Every Code reference: observer
  cadence, continue modes, Esc semantics (their AGENTS.md: approval pane
  must never swallow Esc).

## Detailed Description

### Problem

A run that lasts hours needs: (1) an operator who can *watch* without
intervening, (2) a way to pause/stop without breaking the run contract, (3)
survival across crashes, (4) a complete offline report, and (5) bounded
memory — both LLM context (compaction) and TUI process memory (state
arrays). Today: no `/auto` status, no queue-growth signal, no drive report
beyond the raw transcript, and compaction is reactive (threshold-triggered),
not scheduled at work boundaries.

### Expected Behavior

The sidebar shows the drive live (goal, active FID, phase, open count,
growth trend); Esc pauses/stops cleanly; a crash resumes from the FID scan +
manifest; the handoff `/export` contains the Run Log + certification record;
compaction fires proactively at FID boundaries; TUI arrays are destructively
trimmed to hard caps so a 6-hour run does not balloon memory.

### Root Cause

Observability and bounds were built for interactive sessions; the drive
supervisor (004) has no UI contract, and memory hygiene is reactive.

### Evidence

- `AgentActivity` kinds verified (`session-state.ts:110`).
- Zustand + Immer stores verified (`cli/src/state/*.ts`).
- Compaction layers verified (README 4-layer; `agents/context-pruner/`).
- `/export` verified (`export-conversation.ts`).
- Every Code observer/countdown/Esc patterns verified
  (`resources/code-main/docs/auto-drive.md`; `code-main/AGENTS.md` Auto
  Drive Escape Handling).

## Impact Assessment

### Affected Components

- `cli/src/state/chat-store/` — drive slice + destructive trims (Immer
  `produce` with bounded arrays).
- `cli/src/components/` — sidebar drive panel (queue growth, phase chip,
  Run Log count); `agent-checklist.tsx`/FID cards reuse.
- `cli/src/commands/` — `/auto status` command; `/export` extension (Run
  Log + certification sections).
- `packages/agent-runtime/src/run-agent-step/` — FID-boundary compaction
  trigger; Esc pause/stop routing (drive driver accepts pause/stop control
  signals).
- `common/src/types/session-state.ts` — drive status types (mirror of
  goal record).

### Risk Level

- [x] Medium: UI + memory hygiene; no enforcement surface. Risk is
  observability lag (operator sees stale state) — mitigated by reusing the
  existing heartbeat/activity pipeline.

## Proposed Solution

### Approach

1. **Drive status record** (mirror of `GoalRecord`): `{ autoRunId, goalId,
   activeFid, phase, openCount, queueTrend, startedAt, lastEventAt }`
   updated by the driver; rendered by the sidebar + `/auto status`.
2. **Sidebar drive panel:** FID cards (existing) + a drive header: goal
   one-liner, active FID + phase chip, open count + growth trend (e.g.,
   "+3 this hour" — the runaway-discovery signal), Run Log event count.
   Activity kinds drive the existing indicator (no new activity model).
3. **Esc semantics:** pause (retain state) / stop (terminal, record in Run
   Log); the approval pane must never swallow Esc (Every Code contract);
   resume via `/auto resume` (queue reload from FID scan + manifest).
4. **Crash resume:** on boot, if a drive record exists and FIDs are open →
   offer resume; queue = `dev/fids/` scan + master manifest (child 004
   reload), ZTAP ledger intact.
5. **Proactive compaction at FID boundaries:** after each COMPLETE, run the
   compaction trigger (L0-L3) — the boundary is the natural checkpoint;
   L3 emergency reinit serializes to `dev/scratchpad/` and restarts from the
   master FID + active FID.
6. **Immer trims:** bounded arrays (`thoughtHistory`, message blocks, tool
   entries, subagent traces) with destructive trim + deterministic caps
   (Every Code bounded-state pattern); TUI caches (prompt/agent/runtime)
   hard-capped.
7. **Handoff report:** `/export` gains the Run Log + certification record
   sections; the report is the offline audit trail (every tool call,
   compaction, subagent invocation, ladder event).

### Steps

1. Drive status record + `/auto status` command.
2. Sidebar drive panel (active FID, phase, open count, growth trend).
3. Esc pause/stop routing + `/auto resume` (approval-pane Esc contract).
4. Crash-resume boot path (FID scan + manifest + ZTAP intact).
5. FID-boundary compaction trigger + L3 restart path.
6. Immer destructive trims + TUI cache caps.
7. `/export` Run Log + certification sections.
8. Tests: status transitions; Esc pause/stop; resume-after-crash fixture;
   trim bounds (arrays never exceed caps); export sections present.

### Verification

- Unit: trim bounds; status record transitions; resume fixture.
- Live: fixture goal run with a simulated crash mid-run → resume → completes;
   sidebar shows live queue growth; `/export` contains Run Log + certification
   sections; a 2-hour soak shows bounded memory (arrays capped).

## Step Status

- [x] 1. Drive status record + `/auto status` (`DriveStatusRecord` type, `/auto status` subcommand, `<drive-control>` directive)
- [x] 2. Sidebar drive panel (`drive-status-panel.tsx` wired into `right-sidebar.tsx`; goal, active FID, phase chip, open count, queue-growth trend, Run Log count)
- [x] 3. Esc pause/stop + `/auto resume` (`drive-interrupt` action in `keyboard-actions.ts`, `onDriveInterrupt` in `keyboard.ts`, threaded through `use-chat-keyboard.ts`; approval pane is `driveMode=false` so its Esc never swallowed)
- [x] 4. Crash-resume boot path (`demoteStaleActiveDrive` + `canResumeDrive` in `auto-drive-driver.ts`, wired into `main-prompt.ts`; FID-scan queue reload + manifest + ZTAP survive by construction)
- [x] 5. FID-boundary compaction trigger + L3 restart (`fidBoundaryDue` flag + `shouldBoundaryCompact` + `context-tokens.ts` boundary micro-compact pass; L3/L4 emergency restart reuses the existing `context-compactor.ts` Layer 3 auto-compact + Layer 4 reactive truncation — no new scratchpad module was needed, cited in AUDIT)
- [x] 6. Immer destructive trims + TUI cache caps (`bounded-arrays.ts` `trimAgentStack`/`trimToolsUsed` applied in `sidebar-actions.ts`; existing caps on toolHistory/provenanceEvents/compactionEvents retained)
- [x] 7. `/export` Run Log + certification sections (`drive-report.ts` + `template.ts` + `template-css-part2.ts` + `export-conversation.ts`)
- [x] 8. Status/Esc/resume/trim/export test matrix (`drive-report.test.ts`, `bounded-arrays.test.ts`, `keyboard-actions.test.ts` drive-interrupt, `auto-drive-driver.test.ts` status/resume, `auto-drive-headless.test.ts`)

## Perfection Loop

### Loop 1 — RED

- R1. No `/auto status`; drive state is invisible to the operator.
- R2. No queue-growth signal — runaway discovery is silent until the bill.
- R3. No pause/resume contract for drive mode; a crash loses the driver's
  in-memory position (queue is recoverable from disk, but nothing offers
  resume).
- R4. Compaction is reactive only; a 6-hour run compacts at thresholds, not
  at safe work boundaries.
- R5. TUI arrays are unbounded over long sessions (memory balloon risk).
- R6. `/export` has no Run Log / certification sections — the operator
  cannot review the autonomous decisions in one artifact.

### Loop 1 — GREEN

- G1. Reuse the existing activity + heartbeat pipeline (AgentActivity kinds,
  sidebar rows) — no new observability substrate.
- G2. Queue-growth trend is the runaway signal — observability, not a
  confirmation (master Missed Question 3 contract).
- G3. Resume-from-disk: FIDs + manifest are the state (child 004 G3); ZTAP
  ledger provides provenance continuity.
- G4. FID boundaries are the natural compaction checkpoints — proactive,
  deterministic lifecycle events (the blueprint's L0-L3 elevation).
- G5. Immer trims mirror Every Code's bounded-state pattern — destructive,
  deterministic, capped.
- G6. Status `analyzed`; Step Status `blocked::` markers.

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `common/src/types/session-state.ts:110` — AgentActivity kinds verified. ✓
- `cli/src/state/chat-store.ts` — Zustand + Immer (`zustand/middleware/immer`)
  verified. ✓
- `cli/src/commands/export-conversation.ts` — `/export` verified. ✓
- `agents/context-pruner/` — compaction machinery verified. ✓
- `resources/code-main/docs/auto-drive.md` — observer cadence + continue
  modes verified; `code-main/AGENTS.md` — Esc contract verified. ✓
→ 5/5 verified.

AUDIT-2 (adversarial):

- A2.1 Could Esc pause violate "never stop"? No — pause is operator
  *control*, not a confirmation request; the run contract (no questions)
  is untouched. The approval pane never swallows Esc (Every Code contract
  adopted).
- A2.2 Could trims destroy evidence the audit needs? The Run Log + FID
  files are disk-persistent; trims apply to ephemeral TUI arrays only —
  evidence lives in files, not arrays.
- A2.3 Could queue-growth observability become a de-facto prompt? No —
  it is a passive sidebar signal; the operator acts or not (Esc), the run
  never asks.
- A2.4 Could L3 restart lose the drive position? The master FID + active FID
  + Run Log are on disk; the restart directive is exactly the drive
  directive (child 004) — position is recoverable by construction.

### Loop 1 — SELF-CORRECT

- SC1: initial design added a new activity kind for drive; corrected — reuse
  existing AgentActivity kinds + a drive status record (G1, Law 13).
- SC2: initial pause design halted the driver thread; corrected — pause is a
  driver control signal (state retained, turns suspended), stop is terminal
  with a Run Log entry; both are driver-internal, not user prompts.

### Missed Questions

1. Should `/auto status` be a slash command or a sidebar-only surface?
   Decision: both — the command renders the same record (goal.ts pattern),
   the sidebar shows it live; zero new state models.
2. Should compaction at FID boundaries be forced (L0 always) or
   threshold-gated? Decision: L0-L2 run at boundaries when over budget
   (deterministic event), L3 only on emergency — forcing L0 on tiny FIDs
   wastes tokens; the boundary is the *checkpoint*, not the trigger.

### Code Verification Evidence

- All citations verified 2026-08-18 (AUDIT-1 5/5).
- `bun run validate:repository` PASS after drafting (see master Resolution).

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  8 steps `[x]` + unit-tested (sidebar panel, Esc hook, crash-resume
  demotion, boundary compaction, Immer trims, `/export` sections, full test
  matrix). Program-level live soak smoke (bounded-memory run, sidebar queue
  growth, crash→resume) stays tracked by master FID-2026-0818-001 (step 8),
  which remains active.
- **Closure path:** record the live soak smoke; Nova implementation
  sign-off; closed + archived with evidence per FID-2026-0817-005.

## Lessons Learned

- Observability is the substitute for confirmation: the operator watches a
  live queue, never answers a question — that is the entire UX contract of
  drive mode.
- Memory hygiene is a lifecycle event, not a panic response: FID boundaries
  are the deterministic checkpoints where compaction and trims belong.