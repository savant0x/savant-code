<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-002 — Auto Drive entry: `/auto` command, interview stage, one-time approval gate

**Severity:** high
**Status:** closed
**ID:** FID-2026-0818-002
**Filename:** `FID-2026-0818-002-drive-mode-entry.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001

## Summary

The operator-facing entry of Auto Drive. `/auto "<goal>"` runs a clarity
check: if the goal is already a detailed spec it proceeds directly to the
pre-build plan; otherwise it drives the existing `/interview` flow (context
gathering, ≥3 rounds of `ask_user` clarifying questions, a spec file). A
Thinker pass converts the spec into a pre-build plan (the master-FID draft:
scope, module breakdown, dependency order, acceptance criteria, resolution
policy) presented as a single `ask_user` confirmation: Confirm / Revise /
Cancel. Confirmation is the Law 2 approval and locks drive mode: the
confirmation tooling (`ask_user`), handoff tooling (`suggest_followups`),
and `end_turn` are stripped from the tool set for the run, and the input lock
prevents interactive interruption.

## Environment

- `cli/src/commands/defs/misc.ts:67` — `/interview` command definition; input
  mode `interview` set at `:87`.
- `cli/src/commands/prompt-builders.ts:62-75` — `INTERVIEW_BASE_PROMPT`:
  gather context → ≥3 rounds `ask_user` → write `{request}-spec.md` → no code
  changes → `suggest_followups`.
- `cli/src/commands/router/route-user-prompt.ts:144-153` — interview input
  mode routes prompts through `buildInterviewPrompt`.
- `cli/src/commands/goal.ts` — `/goal` handler (directive serialization,
  `serializeGoalSetDirective`, budget parsing) — the pattern for a drive
  directive.
- `cli/src/components/ask-user/` — interactive question components
  (accordion-question, options-list, custom-answer-input, use-form-state).
- `packages/agent-runtime/src/tools/filter-tool-set.ts:10` —
  `filterToolSet(allowedToolNames)` pure allowlist filter; applied at the
  inherited-tool boundary (`run-agent-step/loop-context.ts:19,169`) and at
  spawn (`tools/handlers/tool/spawn-agents.ts:190`).
- `cli/src/utils/finish-logic.ts` — `resetUiToIdle('slash-command')` used by
  command handlers.
- `common/src/types/session-state.ts:149` — `GoalRecord.completionCriterion`
  (the pre-build plan's acceptance criteria land here).
- `agents/savant/savant-strict.ts` — the STRICT agent drive mode pins.

## Detailed Description

### Problem

There is no command that turns a one-sentence goal into an approved,
crystal-clear, executable contract. `/interview` produces a spec but no plan
and no approval gate; `/goal` produces a durable objective but no ceremony and
no completion contract; STRICT ceremony exists but is interactive-only. Law 2
(Present Before Act) and the anti-deferral gate require operator approval for
scope — drive mode needs exactly one place where that approval is granted.

### Expected Behavior

`/auto "<goal>"` → clarify (interview if underspecified) → pre-build plan
presented → Confirm/Revise/Cancel → on Confirm, drive mode locks (tools
filtered, input locked) and the run proceeds without any further operator
input; on Revise, loop back to the interview/plan stage; on Cancel, clean exit.

### Root Cause

The three pieces (interview, goal, ceremony) exist but were never composed
into a single entry with a single approval surface.

### Evidence

- `command-registry.ts` read 2026-08-18: no `/auto`.
- `INTERVIEW_BASE_PROMPT` verified (`prompt-builders.ts:62-75`) — the clarity
  check can reuse it verbatim for the underspecified case.
- `filterToolSet` verified at `filter-tool-set.ts:10` — drive-mode tool
  stripping is a one-call filter at the model-facing boundary
  (`loop-context.ts:169`).

## Impact Assessment

### Affected Components

- `cli/src/commands/` — new `/auto` command definition + `AUTO_*` prompts in
  `prompt-builders.ts`; `command-registry.ts` registration.
- `cli/src/state/chat-store/` — drive-mode slice: `driveMode`, `driveState`
  (`planning | awaiting_confirmation | driving | blocked | complete`),
  `activeAutoRunId`.
- `packages/agent-runtime/src/run-agent-step/` — drive-mode tool filtering
  at the model-facing boundary; a `drive-lock` directive serialized like
  `serializeGoalSetDirective` (`common/src/util/goal-directives.ts`).
- `agents/savant/` — pin drive mode to the STRICT agent
  (`savant-strict.ts`); the savant prompt gains the drive-mode contract
  (no self-report, no asks, evidence via FIDs).

### Risk Level

- [x] High: this is the Law 2 surface — the confirmation contract must be
  explicit in the plan presentation or the anti-deferral gate blocks the
  program (correctly) at every child.

## Proposed Solution

### Approach

1. `/auto "<goal>"` routes: if `--skip-interview` or the goal already carries
   a spec/structured detail → Stage 1; else enter the existing interview mode
   (`route-user-prompt.ts:144-153` path) to produce `{goal}-spec.md`.
2. Stage 1 spawns the Thinker (sequentialthinking, per ECHO.md Thinker
   Protocol) to convert spec → pre-build plan (the master-FID draft content).
   The draft is rendered into one `ask_user` confirmation with three options:
   Confirm / Revise (loops back with notes) / Cancel.
3. On Confirm: serialize a `<drive-lock>` directive (mirror of
   `serializeGoalSetDirective`, `common/src/util/goal-directives.ts:44-53`)
   carrying the goal, acceptance criteria, and resolution policy; the runtime
   records the drive record (goalId, planId, startedAt, policy) and filters
   `ask_user`, `suggest_followups`, `end_turn` out of the model-facing tool
   set via `filterToolSet` at `loop-context.ts:169`.
4. The CLI sets `driveMode: true` in the store, shows the drive banner +
   activity (`AgentActivity` kinds already exist), and locks the input except
   Esc (pause/stop, child 007).

### Steps

1. Add `/auto` command definition + router registration
   (`cli/src/commands/`, `command-registry.ts`).
2. Add `AUTO_CLARITY_PROMPT` + `AUTO_PREBUILD_PLAN_PROMPT` to
   `prompt-builders.ts` (reusing `INTERVIEW_BASE_PROMPT` as the fallback).
3. Add drive-mode slice to `cli/src/state/chat-store/` + types in
   `common/src/types/session-state.ts` (`DriveModeState`).
4. Add `<drive-lock>` directive serialization/parsing in
   `common/src/util/goal-directives.ts`.
5. Wire drive-mode tool filtering in `packages/agent-runtime/src/run-agent-step/`
   (model-facing boundary, `loop-context.ts`) + STRICT pin.
6. Present/confirm flow via `cli/src/components/ask-user/`; wire
   Confirm/Revise/Cancel handlers.
7. Drive-banner + sidebar status (reuse AgentActivity); input lock + Esc hook.
8. Inline plan editing: the confirmation surface gains an editable plan
   field pre-filled with the master-FID draft; edits feed the plan before
   approval (operator: build it out completely, no phasing).
9. Headless entry flag `--auto "<goal>"` in `cli-args.ts` (non-TUI path,
   routed per child 008); `--spec <path>` reuses `--prompt-file` parsing.

### Verification

- Unit: directive parse round-trip; tool-filter set difference (drive vs
  normal); store slice transitions; confirm/revise/cancel routing.
- Live: `/auto` on a fixture goal — interview runs, plan presents, Confirm
  locks drive mode, and the model-facing tool list provably excludes
  `ask_user`/`suggest_followups`/`end_turn`.

## Step Status

- [x] 1. `/auto` command + registration — `cli/src/commands/auto-drive.ts`,
      `defs/misc.ts` (`auto`/`drive` alias), `data/slash-commands.ts`.
- [x] 2. AUTO prompts — `AUTO_CLARITY_PROMPT` + `AUTO_PREBUILD_PLAN_PROMPT` +
      `buildAutoPrompt` in `prompt-builders.ts`.
- [x] 3. Drive-mode store slice + types — `DriveModeState`/`DriveRecord` +
      `AgentState.drive` (common); store `driveMode`/`driveState`/
      `activeAutoRunId`/`drivePlanDraft` + actions.
- [x] 4. `<drive-lock>` directive — `common/src/util/drive-directives.ts`
      (serialize/parse; escaped attribute data boundary).
- [x] 5. Drive-mode tool filtering + STRICT pin — `loop-context.ts` parses
      `<drive-lock>` → records `AgentState.drive` → strips `ask_user`/
      `suggest_followups`/`end_turn`; `/auto` pins `agentMode: 'STRICT'`.
- [x] 6. Confirm/Revise/Cancel flow — `drive-mode/confirmation.tsx` + stream
      end `<drive-plan>` detection in `use-chat-messaging.ts`.
- [x] 7. Drive banner + input lock — `drive-mode/banner.tsx` +
      `route-user-prompt.ts` ordinary-input guard. (Esc pause/stop hook is
      child 007 scope; sidebar observability surfaces via the banner + the
      existing `AgentActivity`.)
- [x] 8. Inline plan editing — editable `MultilineInput` pre-filled with the
      plan; Confirm uses the edited text as the approved plan.
- [x] 9. `--auto "<goal>"` headless entry flag — `cli-args.ts` `--auto` +
      `--spec` (non-TUI routing is child 008).

## Perfection Loop

### Loop 1 — RED

- R1. No `/auto` command (`command-registry.ts` verified).
- R2. Interview exists but ends in a spec + `suggest_followups` — no approval
  gate, no plan.
- R3. `ask_user`/`suggest_followups`/`end_turn` are always available to the
  model — drive mode needs them stripped.
- R4. Goal directive has no drive/policy concept (`goal-directives.ts` read).
- R5. No drive-state machine in the TUI store.

### Loop 1 — GREEN

- G1. Reuse `INTERVIEW_BASE_PROMPT` verbatim for clarity (Law 7/13 — search
  before create).
- G2. Pre-build plan = master-FID draft; confirmation options Confirm/Revise/
  Cancel map to the existing ask-user machinery (no new UI components).
- G3. Drive lock via directive + `filterToolSet` — the existing allowlist
  filter is the enforcement seam (`loop-context.ts:169`).
- G4. STRICT pin: drive mode selects `savant-strict` — the prompt contract
  already forbids direct writes/skips (child 004 builds on this).
- G5. Status `analyzed`; Step Status `blocked::` (awaiting operator).

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `cli/src/commands/prompt-builders.ts:62-75` — INTERVIEW_BASE_PROMPT read. ✓
- `cli/src/commands/defs/misc.ts:67,87` — interview command + mode set. ✓
- `cli/src/commands/router/route-user-prompt.ts:144-153` — interview routing. ✓
- `packages/agent-runtime/src/tools/filter-tool-set.ts:10` — pure filter. ✓
- `packages/agent-runtime/src/run-agent-step/loop-context.ts:19,169` —
  inherited-tool boundary. ✓
- `common/src/util/goal-directives.ts:44-53` — directive serialization
  pattern (completionCriterion attr). ✓
→ 6/6 verified.

AUDIT-2 (adversarial):

- A2.1 Can the model ask questions anyway (e.g., via `web_search` output)?
  Tool filtering removes the *ask* affordance; the STRICT contract forbids
  prose asks; the ladder (child 005) routes genuine impasses to terminal
  block instead of asking. Residual risk: a model ignoring the contract —
  blocked by the drive driver refusing to consume non-FID evidence (004).
- A2.2 Revise loop: operator says "Revise" — must not half-lock drive mode.
  Revise returns to Stage 1 (plan draft), never to Stage 3; tested.
- A2.3 What if the operator confirms a plan whose child FIDs don't cover
  the whole scope? Child 003's manifest check closes this (every plan item
  ↔ FID).

### Loop 1 — SELF-CORRECT

- SC1: initial draft routed `/auto` through a new UI component; replaced with
  the existing ask-user machinery (G2, Law 13).
- SC2: initial tool-stripping plan modified the executor; replaced with the
  model-facing `filterToolSet` seam (G3) — executor authorization unchanged
  (defense in depth preserved).

### Missed Questions

1. Should `/auto` accept a pasted spec file path (`/auto spec.md`)? Decision:
   yes — `--spec <path>` bypasses the interview and uses the file as the
   spec input; trivial routing, keeps the clarity check honest.
2. Should the operator be able to edit the plan inline before confirming
   (ask-user text field) vs. Revise-loop only? Decision (revised 2026-08-18,
   operator): both — inline plan editing is in scope (build it out
   completely, no phasing). The confirmation surface gains an editable plan
   field; Revise-loop remains for note-driven re-plans.

### Code Verification Evidence

- All citations verified 2026-08-18 against the working tree (AUDIT-1 6/6).
- `bun run validate:repository` PASS after this file was drafted (see
  master Resolution).

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  9 steps `[x]`, code + unit tests green. Program-level live `/auto` smoke
  stays tracked by master FID-2026-0818-001 (step 8), which closed + archived 2026-08-18.
- **Implementation evidence (2026-08-18):** typecheck ×4 (sdk, common,
  agent-runtime, cli) exit 0; agent-runtime suite 1001 pass / 0 fail;
  `drive-directives.test.ts` 6 pass / 0 fail (round-trip + escaping + stripped
  set); cli-args + registry-gating 26 pass / 0 fail; eslint 0 warnings on all
  touched files; prettier clean.
- **Closure path:** live `/auto` smoke (interview → confirm → lock, incl.
  inline plan editing) → Nova implementation sign-off request → Nova PASS →
  operator closure → archive, per FID-2026-0817-005.
- **Deferred by design (not a silent deferral):** Esc pause/stop + long-session
  observability are child 007; non-TUI `/auto` routing is child 008.

## Lessons Learned

- The approval surface is one widget away: existing ask-user components +
  one directive serialize the entire Law 2 contract.
- Tool filtering belongs at the model-facing boundary, not the executor —
  the harness already draws that line (`loop-context.ts`), drive mode just
  draws it tighter.
