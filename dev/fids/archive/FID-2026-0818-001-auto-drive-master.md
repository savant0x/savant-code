<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-001 — Auto Drive master: autonomous end-to-end execution

**Severity:** high
**Status:** closed
**ID:** FID-2026-0818-001
**Filename:** `FID-2026-0818-001-auto-drive-master.md`
**Created:** 2026-08-18

## Summary

Auto Drive is the autonomous continuation driver that lets an operator state
an end goal once, approve a single pre-build plan, and then have the harness
decompose, implement, verify, and ship the entire objective without any
further human confirmation. It is **not** a new agent and **not** a new
protocol: it mechanizes the existing STRICT-mode Perfection Loop ceremony
(Recorder → Detective → Forge → Verifier → Adversary → archive) behind a
supervisor loop that reads FID files as ground truth, drives `transition_phase`
transitions, self-heals through a documented escalation ladder, and terminates
only when the FID queue is empty **and** the approved acceptance criteria are
met. This master FID organizes the program: goal, architecture decision,
approval contract, child manifest, dependency order, and explicit non-goals.

## Environment

- `ECHO.md` — the 10-agent harness protocol (the governing protocol for the
  Savant-Code product; the single-agent file governs Freebuff-harness sessions
  only). Hybrid Mode is the default; STRICT is the full ceremony.
- `agents/savant/savant-strict.ts` — the STRICT agent: "Every code change runs
  the full ECHO Perfection Loop: FID (Recorder), RED (Detective), GREEN
  (Forge), AUDIT (Verifier), archive (Recorder). No direct writes, no phase
  skipping, no self-verification" (`agents/savant/system-prompt.ts:35`).
- `packages/agent-runtime/src/run-agent-step/goal-engine.ts` +
  `goal-driver.ts` — the Durable Budgeted Goal Engine (FID-2026-0814-002):
  `active | paused | blocked | complete` states, budgets, `<untrusted_objective>`
  injection, continuation turns, `completionCriterion`
  (`common/src/types/session-state.ts:149`).
- `packages/agent-runtime/src/echo/` — EHEL pre-write gates, `fid-validator.ts`
  (incl. `validateFidStepStatus`, FID-2026-0817-005), the anti-deferral gate.
- `scripts/fid-ledger.ts` — `validate:repository` ledger: active statuses are
  `created|analyzed|fixed|verified` (`:18-23`); required headings; master/
  dependency graph (`:72+`); archived-`closed`-with-unresolved-steps fails
  closed.
- `cli/src/commands/defs/misc.ts:67` — `/interview` command; its prompt
  (`cli/src/commands/prompt-builders.ts:62-75`) mandates context gathering,
  ≥3 rounds of `ask_user` clarifying questions, and a spec file with no code
  changes.
- `cli/src/commands/goal.ts` — `/goal` durable goal command.
- `cli/src/state/` — Zustand + Immer stores; `common/src/types/session-state.ts:110`
  AgentActivity kinds (`idle | thinking | tool | subagent | researching`).
- `resources/code-main/` — Every Code (just-every/code) reference: Auto Drive
  (`docs/auto-drive.md`), Auto Review ghost-commit watcher, bounded state maps,
  observer cadence, continue modes.

## Detailed Description

### Problem

The harness today requires an operator at every boundary: phase transitions,
Verifier-trigger decisions, blocked-step presentation, and end-of-turn handoff.
The `goal` driver runs continuation turns but has no notion of a FID queue, no
ceremony enforcement, and no completion contract stronger than the model's own
`update_goal` claim. STRICT mode performs the full ceremony but only under
continuous interactive shepherding. There is no mode in which the operator can
say "build this, all of it" once and have the harness execute the entire
objective.

### Expected Behavior

`/auto "<goal>"` → clarify (interview) → present pre-build plan → operator
confirms **once** → harness drafts the FID backlog, drives every FID through
the full Perfection Loop with mechanical evidence checks, self-heals failures
without sacrificing enforcement, and terminates only when the queue is empty
AND the approved acceptance criteria are met — then certifies (`/verify`),
exports the audit trail (`/export`), and hands back. No mid-run confirmations,
ever.

### Root Cause

The ceremony is prompt-driven and the driver is goal-driven; nothing joins
them. The FID file — status field, phase sections, Step Status checkboxes —
is already a machine-readable progress record, but no component consumes it
as a queue/state source.

### Evidence

- `cli/src/commands/command-registry.ts` — no `/auto` command exists.
- `dev/fids/README.md:28-35` — status vocabulary documents `converged`, but
  `scripts/fid-ledger.ts:18-23` rejects it in the active set (word drift,
  FID-2026-0817-005 Missed Question 1).
- `packages/agent-runtime/src/run-agent-step/goal-driver.ts` — continuation
  driver exists but knows nothing of FIDs (verified by design docs,
  `docs/design/goal-mode.md`).
- 2026-08-16 incidents (6 planning FIDs closed without implementation; 3-of-7
  silent deferral) — the anti-deferral gate (FID-2026-0817-005) now makes
  step status machine-checkable; Auto Drive reuses that machinery as its
  progress model.

## Impact Assessment

### Affected Components

- `cli/src/commands/` (new `/auto`), `cli/src/state/` (drive-mode slice),
  `packages/agent-runtime/src/run-agent-step/` (driver + ladder + conformance),
  `agents/` (instruction updates: thinker, detective, recorder, scribe),
  `common/src/types/session-state.ts` (drive state types), `scripts/`
  (certification helpers), `dev/fids/` (this program's artifacts).

### Risk Level

- [x] High: core harness autonomy — every change lands behind the existing
  EHEL gates, but a driver bug could burn budget or loop; mitigated by
  circuit breakers, budgets, and the ledger's closed-loop validation.

### Out of scope (explicit, operator-confirmed)

- **Background ghost-review worker** (Every Code Auto Review): a separate
  feature, not Auto Drive — operator-confirmed out of scope 2026-08-18.
  The in-process Verifier + Adversary already cover the quality role.
- **Single-agent-mode Auto Drive variant** (Freebuff harness scope): a
  separate harness — operator-confirmed out of scope 2026-08-18.
- Changes to `ECHO.md` / `dev/echo-v0.1.2-single-agent.md` (governance docs
  require separate operator approval, per FID-2026-0817-005 Part F).
- Retroactive ledger/step-status backfill of archived FIDs.
- Release/CI automation changes beyond `/verify` reuse.

## Proposed Solution

### Approach

A supervisor loop layered on the goal driver, pinned to the STRICT agent:

```text
/auto "<goal>"
  Stage 0 CLARITY — goal already a full spec? else /interview (existing)
  Stage 1 PLAN     — Thinker → pre-build plan (master-FID draft); ONE
                     operator confirmation = the Law 2 approval; Revise loops
  Stage 2 DECOMPOSE — Recorder drafts child FIDs; plan↔FID manifest check
  Stage 3 DRIVE    — queue supervisor: per FID, STRICT ceremony, phase
                     completion validated from the FID file, transition_phase
                     auto-invoked, self-healing ladder, Run Log
  Stage 4 CERTIFY  — zero open FIDs AND goal-conformance audit AND /verify;
                     gaps → new FIDs → back to Stage 3
  Stage 5 HANDOFF  — /export report with Run Log; status complete
```

### Steps

1. Child `002` — drive-mode entry: `/auto`, clarity check, pre-build plan,
   one-time confirmation, tool filtering (`ask_user`/`suggest_followups`/
   `end_turn` stripped), input lock.
2. Child `003` — decomposition engine: spec → master FID + child FIDs,
   plan↔FID manifest check.
3. Child `004` — drive-loop supervisor: dynamic queue, phase-completion
   validator, `transition_phase` auto-invocation, archive + CHANGELOG at
   COMPLETE, zero-open-FID detection.
4. Child `005` — self-healing ladder: mechanical retry → SELF_CORRECT →
   RED re-analysis → new-FID-on-discovery → documented default → terminal
   block; Run Log writer.
5. Child `006` — completion certification: goal-conformance audit,
   gap→new-FID loop, `/verify` gate.
6. Child `007` — observability + long-session bounds: `/auto status`,
   sidebar queue growth, Esc pause/stop, crash resume, `/export` with Run
   Log, Immer trims + TUI cache caps, proactive compaction at FID
   boundaries.
7. Child `008` — headless CLI mode: `savant-code --auto "<goal>"` non-TUI
   entry, non-interactive approval contract (`--plan-file`/`--approve`),
   stdout progress + `/verify` + `/export` output, CI exit codes, crash
   resume (reuses `--continue` + FID scan).

### Verification

- Each child: full gate sweep (typecheck ×4, eslint 0, lint:md 0, prettier,
  `bun run validate:repository` PASS) + Law-4 reachability greps.
- Program-level: a live `/auto` smoke run on a scoped fixture goal with zero
  human touchpoints after confirmation; `/export` report contains the Run Log;
  every child FID closes with implementation evidence per
  FID-2026-0817-005.

## Step Status

- [x] 1. Child `FID-2026-0818-002` drive-mode entry — closed + archived 2026-08-18 (steps 1-9, gates green)
- [x] 2. Child `FID-2026-0818-003` decomposition engine — closed + archived 2026-08-18 (steps 1-6)
- [x] 3. Child `FID-2026-0818-004` drive-loop supervisor — closed + archived 2026-08-18 (`driveAutoTurns` + archive move + crash-resume scan, steps 1-8)
- [x] 4. Child `FID-2026-0818-005` self-healing ladder — closed + archived 2026-08-18 (steps 1-7 incl. rung-5 documented-default)
- [x] 5. Child `FID-2026-0818-006` completion certification — closed + archived 2026-08-18 (steps 1-6 incl. `/export` report hooks)
- [x] 6. Child `FID-2026-0818-007` observability + long-session bounds — closed + archived 2026-08-18 (steps 1-8: sidebar panel, Esc hook, crash-resume, boundary compaction, trims, `/export`)
- [x] 7. Child `FID-2026-0818-008` headless CLI mode — closed + archived 2026-08-18 (steps 1-8: entry path, store-agnostic drive, exit codes, `--continue` resume)
- [x] 8. Program certification — **operator-confirmed 2026-08-18:** live `/auto` smoke run (TUI + headless + crash resume) passed; all gates green; all children archived with evidence; 009 (Discord live smoke) closed + archived 2026-08-18; Nova implementation PASS on record (009/010 hardcode + docs verdict in `dev/nova/outbox/archive/2026-08-18-discord-rich-presence-hardcode-and-docs-nova-verdict.md`)

## Perfection Loop

### Loop 1 — RED

- R1. No `/auto` command in `cli/src/commands/command-registry.ts`.
- R2. Goal driver has no FID-queue awareness, no ceremony enforcement
  (`docs/design/goal-mode.md` — driver scope is continuation turns only).
- R3. STRICT ceremony exists but is prompt-only; nothing mechanically consumes
  FID status/sections as a progress record.
- R4. No phase-completion evidence check: an agent could transition phases
  without the FID containing the phase's evidence.
- R5. No completion contract: `update_goal` is a model claim, not a verified
  criterion.
- R6. No drive-mode observability/queue-growth signal; no Run Log; no crash
  resume for multi-hour runs (goal record + FID files persist, but no driver
  state on disk).
- R7. `converged` is not a legal active status
  (`scripts/fid-ledger.ts:18-23`) — planning status must be `analyzed`.

### Loop 1 — GREEN

- G1. **Driver, not agent:** Auto Drive is a supervisor loop, not an 11th
  agent; it extends `goal-driver.ts` and reuses the STRICT agent
  (`agents/savant/savant-strict.ts`).
- G2. **FID file is ground truth:** phase completion is validated by reading
  the FID (RED evidence, GREEN fix + no unanswered questions, AUDIT evidence,
  ADVERSARIAL verdict) — never by the agent's self-report alone.
- G3. **One approval gate:** the pre-build plan confirmation carries the Law 2
  approval: scope = child FID manifest; resolution policy = documented
  most-robust-default; genuine impasse = terminal block + report.
- G4. **Queue = anti-deferral:** completion requires zero open FIDs AND the
  goal-conformance audit; discoveries become new FIDs processed before
  completion (FID-2026-0817-005 gates stay fully intact).
- G5. **Status `analyzed`** while active (ledger-legal); `converged` stays
  rejected until the vocabulary drift is resolved separately (FID-2026-0817-005
  Missed Question 1 — operator call, not this program).
- G6. Non-goals recorded (ghost-review worker, governance doc changes,
  single-agent variant) — visible, not silent.

### Loop 1 — AUDIT

AUDIT-1 (grep verification of every claim):

- `cli/src/commands/command-registry.ts` — full command list read 2026-08-18;
  no `auto` command. ✓
- `cli/src/commands/prompt-builders.ts:62-75` — `INTERVIEW_BASE_PROMPT`
  confirmed (context → ≥3 ask_user rounds → spec → no code). ✓
- `scripts/fid-ledger.ts:18-23` — `ALLOWED_ACTIVE_STATUSES` =
  created|analyzed|fixed|verified (no `converged`). ✓
- `agents/savant/system-prompt.ts:35` — STRICT contract text confirmed. ✓
- `common/src/types/session-state.ts:149` — `completionCriterion` on
  GoalRecord confirmed. ✓
- `packages/agent-runtime/src/echo/fid-validator.ts` — `validateFidStepStatus`
  read 0-EOF; grammar confirmed. ✓
- `dev/fids/archive/FID-2026-0817-005-anti-deferral-fid-step-enforcement.md` —
  exemplar read 0-EOF; no Author field; `analyzed` while active. ✓
→ 7/7 citations verify.

AUDIT-2 (adversarial cross-check):

- A2.1 Could an operator's single approval be misused? The confirmation
  approves the plan + resolution policy; the anti-deferral gate still blocks
  silent deferrals and the ledger fails any archived FID with unresolved
  steps. Approval ≠ blank check; defaults are documented, not silent.
- A2.2 Does this weaken STRICT? No — STRICT is preserved verbatim; Auto Drive
  adds the mechanical driver around it. The only relaxation is *who* approves
  (operator once, up front), and that is the explicit operator contract.
- A2.3 Could the program fail `validate:repository`? Active status `analyzed`
  is ledger-legal; Step Status uses `blocked::` markers (no deferral markers);
  master graph: one master, children declare `**Master FID:**` 001, master
  lists every child, deps reference active siblings. Validated live after
  drafting (see Code Verification Evidence).
- A2.4 Is `converged` rejection a blocker? No — loop convergence is recorded
  in each FID's Perfection Loop section; the status field is `analyzed`.

### Loop 1 — SELF-CORRECT

- SC1: dropped a child FID for ghost-review (AUDIT-2 + non-goal G6) — in-process
  Verifier/Adversary covers the quality role; a worker/worktree duplicate is
  YAGNI until measured.
- SC2: Step Status markers use `blocked::` (not `deferred::`) — the program is
  awaiting operator approval, which is a presentation, not a deferral.

### Missed Questions

1. Should `converged` be added to `ALLOWED_ACTIVE_STATUSES` so the
   documented vocabulary matches enforcement? Decision: **no in this
   program** — the drift fix belongs to a separate operator call (recorded
   in FID-2026-0817-005 Missed Question 1); all program FIDs use `analyzed`.
2. Should Auto Drive support headless CLI mode (`savant-code --auto` in
   CI) or TUI-only? Decision (revised 2026-08-18, operator): build it out
   completely — no v1/v2 phasing. TUI **and** headless CLI mode are both
   first-class (child 008); inline plan editing is also in scope
   (child 002).
3. What happens to `/loop` and `/goal` when `/auto` runs? Decision: `/auto`
   is a distinct mode; `/goal` records and `/loop` cadence are independent
   and remain available outside drive mode.

### Code Verification Evidence

- This master FID drafted 2026-08-18; children `002`–`007` drafted in the same
  pass; `dev/fids/README.md` updated to index the active program.
- `bun run validate:repository` run after drafting — PASS (see Resolution).
- All citations above verified against the working tree (AUDIT-1 7/7).

## Resolution

- **Status:** `analyzed` — Perfection Loop converged 2026-08-18; scope
  revised 2026-08-18 (operator: build it out completely, no phasing);
  **Nova planning sign-off PASS 2026-08-18** (all nine records; verdict in
  `dev/nova/outbox/archive/2026-08-18-auto-drive-and-discord-rich-presence-planning-verdict.md`);
  operator approval GRANTED 2026-08-18 — implementation begins with child 002.
- **Operator decisions (2026-08-18):** (1) program approval — APPROVED
  2026-08-18 (implementation begins with child 002); (2) resolution policy —
  APPROVED (documented most-robust-default; new-FID on discovery; terminal
  block only when the ladder is exhausted); (3) scope — build completely:
  TUI + headless CLI mode (child 008) + inline plan editing (child 002), no
  v1/v2 phasing. Auto Review ghost-worker and the single-agent variant are
  operator-confirmed OUT of scope (separate feature/harness).
- **Closed 2026-08-18 (operator-confirmed):** the program certification smoke
  passed — the operator confirmed the live `/auto` run (TUI + headless +
  crash resume) and the Discord live smoke (via 009, also closed + archived
  2026-08-18). All seven children (002–008) closed + archived with evidence;
  master step 8 marked `[x]`; all gates green. Closed + archived with
  evidence per FID-2026-0817-005; Nova planning + implementation PASS on
  record.

## Lessons Learned

- The ceremony already exists; autonomy is a driver problem, not a governance
  problem. STRICT + goal-driver + FID files are 90% of the machine.
- The anti-deferral gate's Step Status section is the progress model for the
  driver — enforcement data and orchestration data are the same bytes.
- The operator's single up-front approval is the entire Law 2 surface; making
  that contract explicit (scope, resolution policy, terminal rules) is what
  makes zero-confirmation execution lawful.
