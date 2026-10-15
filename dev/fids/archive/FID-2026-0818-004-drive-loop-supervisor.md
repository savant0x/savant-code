<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-004 — Auto Drive drive-loop supervisor: queue, phase-completion validation, transition driving

**Severity:** high
**Status:** closed
**ID:** FID-2026-0818-004
**Filename:** `FID-2026-0818-004-drive-loop-supervisor.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001
**Depends On:** FID-2026-0818-002, FID-2026-0818-003

## Summary

The core supervisor loop of Auto Drive. It owns the FID queue (dynamic:
append on discovery, reorder by dependency), selects the active FID, injects
phase directives into the STRICT agent's turns, validates **phase completion
from the FID file itself** (RED evidence, GREEN fix + zero unanswered
questions, AUDIT evidence, ADVERSARIAL verdict), invokes `transition_phase`
legally, loops back to SELF_CORRECT on failure, executes the archive move +
CHANGELOG entry at COMPLETE, and detects the zero-open-FID condition. The
supervisor never trusts the agent's self-report: the FID file is ground
truth.

## Environment

- `packages/agent-runtime/src/run-agent-step/goal-driver.ts` — the existing
  continuation driver (FID-2026-0814-002) — the loop skeleton to extend.
- `common/src/types/session-state.ts:220` — `PerfectionLoopPhase`:
  `idle | red | green | audit | adversarial | self_correct | complete`.
- `agents/types/tools.ts:41,86` — `transition_phase` tool registered;
  FSM validates legal transitions (ECHO.md: "Phase transitions are explicit
  via the `transition_phase` tool").
- `packages/agent-runtime/src/echo/fid-validator.ts` — `validateFid` (required
  sections), `validateFidStepStatus` (step inventory, FID-2026-0817-005) —
  the phase-completion checker's building blocks.
- `packages/agent-runtime/src/echo/pre-write-gates.ts` — FID write gates
  (step-status transition gate; `>20`-line Recorder routing).
- `scripts/fid-ledger.ts` — active-FID scan, status set, master/dependency
  graph — the queue's source of truth at start/resume.
- `agents/recorder/recorder.ts` + ECHO.md FID Auto-Archive — Recorder authors
  the CHANGELOG entry; the CLI/orchestrator executes the `dev/fids/ → archive`
  move (Recorder has no move tool).
- `agents/savant/savant-strict.ts` — STRICT agent the supervisor drives.

## Detailed Description

### Problem

The goal driver runs continuation turns but has no queue, no phase state, and
no evidence checks. An agent running long autonomously could: skip phases,
mark phases done without evidence, transition `transition_phase` illegally,
or declare the queue finished while FIDs remain open. Every one of those is a
real failure mode observed in this repo's history (phase skipping, silent
deferrals, closed-without-implementation).

### Expected Behavior

The supervisor selects the next FID, injects "current FID + current phase",
runs the STRICT agent until the phase's evidence exists in the FID file,
transitions legally, self-corrects on failure, archives at COMPLETE, and
stops only on zero open FIDs (or terminal block from child 005). All state
recoverable on crash: queue = `dev/fids/` scan + master FID manifest.

### Root Cause

Phase progress lives in prose and agent memory; nothing parses the FID file
as a state machine. The anti-deferral gate proved FIDs are parseable — this
child makes that parsing the driver.

### Evidence

- `common/src/types/session-state.ts:220` — phase vocabulary confirmed.
- `agents/types/tools.ts:41` — `transition_phase` in the tool union.
- `packages/agent-runtime/src/echo/fid-validator.ts` — section + step-status
  parsers exist and are exported.
- `scripts/fid-ledger.ts` — active-FID scan + status validation exists
  (`validateActiveFidLedger`).
- ECHO.md FID Auto-Archive — archive rules confirmed (Recorder authors,
  orchestrator moves).

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/` — new `auto-drive-driver.ts`
  (or goal-driver extension): queue, phase machine, evidence checks.
- `packages/agent-runtime/src/echo/fid-validator.ts` — add
  `validateFidPhaseEvidence(fid, phase)` (pure; reuses existing parsers).
- `agents/savant/` — STRICT prompt gains the drive directive format
  ("Current FID / Current phase / Next evidence required").
- `cli/src/state/` — drive status mirror (open count, active FID, phase) for
  the sidebar (child 007 renders).

### Risk Level

- [x] High: the supervisor is the heart of Auto Drive; every failure mode
  must fail closed to a terminal block (child 005) or the anti-deferral
  gates catch it at the ledger.

## Proposed Solution

### Approach

1. **Queue source of truth:** at start/resume, scan `dev/fids/` via the
   ledger rules (active statuses only) + the master FID's child manifest.
   Dynamic appends come from child 005's new-FID-on-discovery.
2. **Per-FID phase machine:** state = the FID's declared phase + the
   supervisor's `expectPhase`. Each turn injects the directive; after the
   agent's turn, `validateFidPhaseEvidence` checks the FID file:
   - RED done → FID contains `### RED` findings with `file:line` + grep
     evidence (Detective contract, `agents/detective/detective.ts:145-146`).
   - GREEN done → FID contains the fix + no unanswered questions
     (`### Unanswered Questions` empty/answered — `fid-validator.ts`
     MIN_UNANSWERED_QUESTIONS machinery).
   - AUDIT done → FID contains `### Code Verification Evidence` with gate
     output + Verifier verdict.
   - ADVERSARIAL done → FID contains the Adversary verdict block.
   - COMPLETE → FID status `closed` + CHANGELOG entry exists + file moved
     to archive (the ledger's `archivedFidExists` checks, `scripts/fid-ledger.ts:44-58`).
3. **Transition driving:** on evidence PASS, invoke `transition_phase` with
   the legal next phase (FSM-validated). On FAIL, route per child 005's
   ladder (default: SELF_CORRECT). Never advance on self-report.
4. **Zero-open-FID detection:** after each COMPLETE, rescan; when the active
   scan is empty and the master manifest is satisfied → Stage 4 (child 006).

### Steps

1. Add `validateFidPhaseEvidence(fid, phase)` to `fid-validator.ts` (pure,
   section-conditional, unit-tested).
2. Implement `auto-drive-driver.ts`: queue load/reload, active-FID
   selection (dependency-ordered), directive injection, evidence polling,
   legal `transition_phase` invocation, archive-move + CHANGELOG at COMPLETE.
3. STRICT prompt: drive directive format (current FID, phase, required
   evidence).
4. Session-state drive record: `{ activeFid, expectPhase, openCount }`.
5. Crash resume: reload from `dev/fids/` scan + master manifest (no new
   persistence needed — FIDs are the state).
6. Tests: phase-evidence matrix (missing RED evidence → no advance; stale
   evidence → no advance; full evidence → advance); illegal transition
   rejected; zero-open-FID detection; archive move + CHANGELOG presence.

### Verification

- Unit: `validateFidPhaseEvidence` matrix + driver transitions.
- Live: fixture goal → decomposition (003) → drive loop runs RED→GREEN→
  AUDIT→ADVERSARIAL→COMPLETE on one child with no human input; archive +
  CHANGELOG verified; zero-open-FID fires.

## Step Status

- [x] 1. `validateFidPhaseEvidence(fid, phase)` in fid-validator.ts (+ `fid-validator-phase-evidence.test.ts`, 8 cases)
- [x] 2. `auto-drive-driver.ts` queue load/reload + dependency-ordered selection (`loadDriveQueue`/`orderFids`/`selectActiveFid`)
- [x] 3. Directive injection + evidence polling primitives (`buildPhaseDirective`/`evaluateFidPhase`/`nextPhaseAfter`)
- [x] 4. Drive-loop turn wiring (`auto-drive-loop.ts` `driveAutoTurns`, wired into `main-prompt.ts`; `transition_phase` is prompt-driven by the STRICT directive + ladder-router SELF_CORRECT mapping)
- [x] 5. COMPLETE: archive move + CHANGELOG entry (`archiveCompletedFid` + `buildChangelogEntry`)
- [x] 6. STRICT prompt drive-directive format (`agents/savant/system-prompt.ts`)
- [x] 7. Crash resume (FID scan + manifest reload) (`loadDriveQueue` disk scan)
- [x] 8. Phase-evidence + transition test matrix (`auto-drive-driver.test.ts` + `fid-validator-phase-evidence.test.ts`)

## Perfection Loop

### Loop 1 — RED

- R1. Goal driver has no FID-queue or phase concept
  (`docs/design/goal-mode.md` — driver scope: continuation turns only).
- R2. No phase-evidence check exists anywhere — "phase done" is prose.
- R3. `transition_phase` validates legality but nothing decides *when* to
  call it.
- R4. Archive + CHANGELOG at COMPLETE is manual (Recorder + orchestrator).
- R5. No crash resume for a multi-hour drive (driver state is in-memory).

### Loop 1 — GREEN

- G1. FID file = state machine. The parsers exist (`fid-validator.ts`);
  add one pure function, no new storage.
- G2. Supervisor drives STRICT agent by directive — the ceremony remains
  prompt-level, the supervision is mechanical (preserves separation of
  duties: the supervisor is not an agent, it cannot write).
- G3. Resume-from-disk: queue is `dev/fids/` + master manifest; no
  bespoke persistence (Law 13 — FIDs are already durable).
- G4. Fail-closed: any evidence check that cannot run → treat as not-done →
  SELF_CORRECT/terminal block; never advance on absence.
- G5. Status `analyzed` while active; Step Status `blocked::` markers.

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `common/src/types/session-state.ts:220` — `PerfectionLoopPhase` verified. ✓
- `agents/types/tools.ts:41` — `transition_phase` verified. ✓
- `packages/agent-runtime/src/echo/fid-validator.ts` — parsers read 0-EOF. ✓
- `scripts/fid-ledger.ts:44-58` — `archivedFidExists` (closed + CHANGELOG +
  evidence headings) verified — the COMPLETE check reuses it. ✓
- `agents/savant/system-prompt.ts:35` — STRICT contract verified. ✓
→ 5/5 verified.

AUDIT-2 (adversarial):

- A2.1 Could the agent fake evidence (paste fake grep output into the FID)?
  The supervisor can only check presence, not truth — the Verifier's
  EHEL-injected evidence and the Adversary's citation resolution are the
  truth layers (both already exist); the supervisor advances only after
  their verdicts, and the ZTAP ledger records writes. Presence-check is the
  floor, not the ceiling.
- A2.2 Could the supervisor loop forever between AUDIT and SELF_CORRECT?
  Circuit breakers (iterationCount, oscillationDetections in AgentState,
  ECHO.md) terminate → terminal block (005).
- A2.3 Could the archive move race the ledger scan? The move is synchronous
  with the CHANGELOG write; `validate:repository` runs only at rest
  (pre-push/CI), so no live race.

### Loop 1 — SELF-CORRECT

- SC1: initial design had the supervisor *write* FID evidence itself;
  corrected — the supervisor is read-only over FIDs (evidence is authored by
  the agents; the supervisor only parses). Preserves separation of duties.
- SC2: initial resume design serialized driver state to scratchpad;
  corrected to FID-scan + manifest reload (G3) — no extra state file.

### Missed Questions

1. Should the supervisor run one phase per LLM turn or let the STRICT agent
   drive multiple phases per turn (as it does interactively)? Decision:
   directive per phase, evidence poll per turn — the tighter loop is the
   whole point; a phase may still complete in one turn when evidence lands.
2. Should AUDIT evidence include the EHEL-injected payload or the Verifier's
   verdict only? Decision: both — the FID's `### Code Verification Evidence`
   section must contain gate output (EHEL) AND the Verifier verdict; the
   ADVERSARIAL verdict must follow. Absence of either = not done.

### Code Verification Evidence

- All citations verified 2026-08-18 (AUDIT-1 5/5).
- `bun run validate:repository` PASS after drafting (see master Resolution).

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  8 steps `[x]`, typecheck ×4 + agent-runtime suite + drive-loop/archive unit
  matrix green. Program-level live drive smoke stays tracked by master
  FID-2026-0818-001 (step 8), which closed + archived 2026-08-18. `transition_phase`
  invocation is prompt-driven by the STRICT directive (the FSM tool validates
  legality); the supervisor itself never authors FID evidence.
- **Closure path:** live drive smoke on one child FID (needs a live model
  run) → closed + archived with evidence per FID-2026-0817-005.

## Lessons Learned

- The FID file is the only state the supervisor needs — the anti-deferral
  gate turned FIDs into parseable progress records; the driver just reads
  them.
- Separation of duties survives automation: the supervisor may read FIDs
  and call `transition_phase`, but never writes evidence — the agents
  author, the machine checks.
