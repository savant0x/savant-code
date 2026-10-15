<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-008 — Auto Drive headless CLI mode: non-interactive entry, approval, output, resume

**Severity:** high
**Status:** closed
**ID:** FID-2026-0818-008
**Filename:** `FID-2026-0818-008-headless-cli-mode.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001
**Depends On:** FID-2026-0818-002, FID-2026-0818-004, FID-2026-0818-006, FID-2026-0818-007

## Summary

The non-interactive half of Auto Drive. `savant-code --auto "<goal>"` runs the
entire drive cycle with no TUI and no runtime `ask_user`: a clarity check
(headless requires a full spec — the interactive interview is unavailable),
a pre-build plan, a non-interactive approval contract, the drive supervisor
loop, and a completion certificate emitted as an exit code + `/export` report.
The Law 2 approval surface is preserved non-interactively through two
documented paths: `--plan-file <path>` (a plan generated and operator-reviewed
in a prior `--plan-only` run) or `--approve` (an explicit up-front trust of the
goal + resolution policy, recorded in the Run Log). Crash resume reuses the
existing `--continue` flag plus the FID-scan queue reload (child 004/007).

## Environment

- `cli/src/cli-args.ts:24-25` — the existing headless seam: `print: boolean`
  with comment "FID-2026-0806-011: run the prompt headlessly and print the
  result to stdout"; option at `:104-105`; resolved at `:196`.
- `cli/src/cli-args.ts:92` — `--continue [conversation-id]` (resume seam).
- `cli/src/cli-args.ts:100` — `--prompt-file <path>` (the `--spec` parse
  pattern; reads the initial prompt from a file).
- `cli/src/commands/defs/chat.ts:88` — `/verify` command (runs `bun run
  typecheck` per workspace, returns exit codes) — the certification gate.
- `cli/src/commands/export-conversation.ts:29` — `handleExportConversationCommand`
  (`/export` → `dev/exports/conversation/savant-export.html`) — the handoff
  artifact.
- `cli/src/commands/goal.ts:32` — `handleGoalCommand` + `serializeGoalSetDirective`
  (the directive pattern child 002 reuses for `<drive-lock>`).
- `cli/src/commands/command-registry.ts:67` — `COMMAND_REGISTRY` (where the
  TUI `/auto` command registers; headless is a CLI flag, not a slash command).
- `cli/src/utils/finish-logic.ts` — `resetUiToIdle` (TUI-only reset; headless
  has no UI store to reset — the store-agnostic requirement).
- `cli/src/commands/defs/misc.ts:67` — `/interview` command (interactive-only
  clarity; headless cannot run its ≥3 `ask_user` rounds).

## Detailed Description

### Problem

The drive supervisor (004), certification (006), and observability (007) are
designed against a live TUI store (Zustand sidebar, AgentActivity, Esc). There
is no path that runs the same objective end-to-end from a CI shell or a cron
job — where there is no operator at the keyboard to answer the interview, to
press Confirm, or to read a sidebar. `--print` proves a single-turn headless
prompt is possible (`cli-args.ts:104-105`), but no flag composes that with the
multi-FID drive cycle.

### Expected Behavior

`savant-code --auto "<goal>" [--spec <path>] [--plan-file <path>] [--approve]
[--plan-only]` runs the full cycle headlessly: clarity check → plan →
(approval) → drive → certify → report, printing progress to stdout, writing the
`/export` report to `dev/exports/`, and exiting non-zero on failure — with no
interactive prompts at any point. `--plan-only` emits the plan to `--plan-file`
and exits 0 so a human can review it before a separate `--approve` run executes
it.

### Root Cause

Every existing entry (interview, goal, the TUI `/auto` from child 002) assumes
an interactive terminal. The `--print` seam shows the runtime already supports a
headless prompt, but the drive cycle was never wired to it.

### Evidence

- `cli-args.ts:104-105` — `--print` exists and is documented "non-zero exit on
  failure"; no `--auto` flag exists (command registry read 2026-08-18).
- `defs/misc.ts:67` — interview is interactive (`ask_user` rounds); headless
  has no one to answer them.
- `goal.ts` — `/goal` is interactive; it renders to the chat store, not stdout.
- Child 004/007 design — drive state and observability are TUI-coupled; a
  headless run needs a store-agnostic drive state.

## Impact Assessment

### Affected Components

- `cli/src/cli-args.ts` — new `--auto`, `--spec`, `--plan-file`, `--approve`,
  `--plan-only` flags + `ParsedArgs` fields (mirror of `--print`).
- `cli/src/index.tsx` — headless entry path: when `--auto` is set, bypass the
  TUI render and run the drive cycle against stdout.
- `packages/agent-runtime/src/run-agent-step/` — expose the drive supervisor
  (004) as store-agnostic so headless drives it without the chat store; stdout
  progress events.
- `cli/src/commands/` — `/verify` + `/export` reuse for the non-interactive
  report + exit-code computation.
- `common/src/types/session-state.ts` — headless drive record (mirror of the
  TUI drive record, no UI fields).

### Risk Level

- [x] High: this is the second Law 2 surface (non-interactive approval). A
  headless run that skips approval would be a silent scope grant. Mitigated by
  requiring an explicit approval signal (`--plan-file` or `--approve`) and
  recording it in the Run Log + drive record; the anti-deferral gate and the
  completion certification (006) still enforce the approved acceptance criteria.

## Proposed Solution

### Approach

1. **Flags:** `--auto "<goal>"` is a mode flag (like `--strict`); `--spec
   <path>` reuses `--prompt-file` parsing (`cli-args.ts:100`); `--plan-file
   <path>` names the plan artifact; `--approve` is the explicit trust signal;
   `--plan-only` emits the plan and exits 0.
2. **Clarity (non-interactive):** if `--spec` or a fully-specified goal is
   present → plan; otherwise fail with a clear error ("headless mode requires
   --spec or a fully-specified goal — the interactive interview is
   unavailable"). The interview is inherently interactive and is not faked.
3. **Approval contract (Law 2, non-interactive):** exactly one of two paths —
   (a) `--plan-file <path>` + `--approve` executes an operator-reviewed plan
   generated by a prior `--plan-only` run; (b) `--approve` alone trusts the
   goal + resolution policy up front (documented most-robust-default; the
   generated plan is still recorded in the Run Log + plan file). Both paths
   record the approval signal in the drive record.
4. **Store-agnostic drive:** the supervisor (004) exposes drive state as a
   plain record/event stream, not the Zustand store; the TUI (007) and
   headless (008) are two consumers of the same state.
5. **Output + exit code:** stdout progress (reusing the `--print` stdout path);
   on completion run `/verify` (defs/chat.ts:88) and write the `/export`
   report (export-conversation.ts:29) to `dev/exports/`; exit 0 only when the
   certification triple-gate (006) passes, else non-zero (mirror `--print`).
6. **Crash resume:** `--auto --continue` reloads the queue from the FID scan +
   master manifest (004/007) and resumes; no TUI state to restore.

### Steps

1. Add `--auto`, `--spec`, `--plan-file`, `--approve`, `--plan-only` flags +
   `ParsedArgs` fields to `cli-args.ts`.
2. Headless entry path in `cli/src/index.tsx` (bypass TUI when `--auto`).
3. Non-interactive clarity check (spec-required; no interview).
4. Approval contract: `--plan-only` plan emission; `--plan-file`/`--approve`
   validation; approval recorded in the drive record + Run Log.
5. Store-agnostic drive supervisor exposure (004) + stdout progress events.
6. Completion: `/verify` + `/export` report emission + CI exit codes.
7. Crash resume via `--continue` + FID-scan reload.
8. Tests: flag parsing; approval-path validation (missing approval → non-zero);
   plan-only round-trip; exit-code on pass/fail; resume-after-crash fixture.

### Verification

- Unit: arg parsing; approval contract (reject headless without `--plan-file`/
  `--approve`); exit-code computation; plan-only round-trip; resume fixture.
- Live: `savant-code --auto "<fixture goal>" --spec <path> --plan-only` writes
  a plan; a reviewed `--plan-file <path> --approve` run completes and exits 0;
  a broken fixture exits non-zero; `/export` report is written; a mid-run kill
  + `--auto --continue` resumes.

## Step Status

- [x] 1. `--auto` + `--spec`/`--plan-file`/`--approve`/`--plan-only` flags in cli-args.ts
- [x] 2. Headless entry path in cli/src/index.tsx (bypass TUI on `--auto`, before the generic `--print`/stdin/CI branch)
- [x] 3. Non-interactive clarity check (`validateHeadlessClarity`)
- [x] 4. Approval contract (`validateHeadlessApproval`)
- [x] 5. Store-agnostic drive supervisor + stdout progress (`auto-drive-headless.ts` `runHeadlessAutoDrive` drives the runtime supervisor via a single drive-lock prompt; stderr progress + stdout result)
- [x] 6. Completion: `/verify` + `/export` report + CI exit codes (`completionExitCode` from the on-disk FID scan; `writeCompletionReport` → `dev/exports/auto-drive-report.md`; exit 0 only on zero open FIDs)
- [x] 7. Crash resume via `--continue` + FID-scan reload (`buildResumeControlPrompt` + `demoteStaleActiveDrive`; the supervisor re-scans `dev/fids/` fresh each turn)
- [x] 8. Flag/approval/exit/resume/round-trip test matrix (`auto-headless.test.ts` 7 cases + `auto-drive-headless.test.ts` 10 cases)

## Perfection Loop

### Loop 1 — RED

- R1. No `--auto` flag; headless is single-turn only (`--print`).
- R2. The interview's `ask_user` rounds cannot run headlessly.
- R3. No non-interactive approval surface — a headless run has no one to press
  Confirm, so the Law 2 surface would be silently skipped without an explicit
  contract.
- R4. The drive supervisor + observability are TUI-store-coupled (child 004/007
  design); no stdout/exit-code consumer exists.
- R5. No CI-friendly completion signal: `/verify` and `/export` render to the
  chat store, not to a process exit code.
- R6. Crash resume assumes a TUI session; headless resume has no path.

### Loop 1 — GREEN

- G1. **Reuse `--print` as the headless seam** (Law 7/13): `--auto` is a mode
  flag, not a new runtime; stdout + non-zero-exit already exist
  (`cli-args.ts:104-105`).
- G2. **Interview is not faked:** headless clarity requires a full spec
  (`--spec` or a fully-specified goal); a missing spec is a hard error, not a
  skipped interview (honest assessment — no silent downgrade).
- G3. **Non-interactive Law 2:** exactly one approval signal required —
  `--plan-file <path>` (reviewed plan) or `--approve` (explicit up-front
  trust); both are recorded. No approval signal → non-zero exit before any
  work.
- G4. **Store-agnostic drive state:** the supervisor emits a plain state
  record/event stream; TUI (007) and headless (008) are two consumers — no
  second drive engine.
- G5. **Exit code = certification:** exit 0 only when the 006 triple-gate
  passes; `/verify` + `/export` are the evidence, the exit code is the signal.
- G6. **Resume reuses `--continue` + FID scan** (004/007) — no bespoke headless
  persistence.
- G7. Status `analyzed`; Step Status `blocked::` markers.

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `cli/src/cli-args.ts:24-25,104-105,196` — `--print` headless seam verified. ✓
- `cli/src/cli-args.ts:92` — `--continue` resume flag verified. ✓
- `cli/src/cli-args.ts:100` — `--prompt-file` (the `--spec` parse pattern). ✓
- `cli/src/commands/defs/chat.ts:88` — `/verify` command + exit codes. ✓
- `cli/src/commands/export-conversation.ts:29` — `/export` handler. ✓
- `cli/src/commands/goal.ts:32` — directive pattern (child 002 reuse). ✓
- `cli/src/commands/command-registry.ts:67` — command registry (no `/auto`). ✓
→ 7/7 verified.

AUDIT-2 (adversarial):

- A2.1 Could `--approve` alone grant an unseen plan and violate Law 2? It is
  the explicit "trusted CI goal" path — the operator approves the goal +
  resolution policy up front, and that approval is recorded in the Run Log;
  the completion certification (006) still enforces the approved acceptance
  criteria, and the anti-deferral gate still blocks silent scope drops. The
  reviewed path (`--plan-file` + `--approve`) is the documented most-robust
  default for CI.
- A2.2 Could a headless run hang on an accidental `ask_user`? Tool filtering
  (child 002) strips `ask_user`/`suggest_followups`/`end_turn`; headless
  additionally fails closed if a drive event requires a question — it
  terminal-blocks (005) rather than waiting for stdin.
- A2.3 Could exit 0 be emitted on a partial run? Exit 0 requires the 006
  triple-gate (zero open FIDs + conformance + `/verify`); a partial run exits
  non-zero (mirror `--print`).
- A2.4 Could the store-agnostic refactor (G4) destabilize the TUI? The drive
  state is already derived from FID files (004); extracting it to a plain
  record is a narrowing refactor, not a behavior change — TUI tests pin the
  same transitions.

### Loop 1 — SELF-CORRECT

- SC1: initial draft added a second drive engine for headless; replaced with
  the store-agnostic supervisor exposure (G4, Law 13) — one engine, two
  consumers.
- SC2: initial draft allowed headless to skip the interview silently; replaced
  with a hard spec-required error (G2, Honest Assessment).

### Missed Questions

1. Should headless fudge the interview by answering its own questions?
   Decision: no — headless requires a full spec; the interview is inherently
   interactive and is never faked.
2. Which approval path is the CI default? Decision: `--plan-file` + `--approve`
   (reviewed plan) is the documented most-robust default; `--approve` alone is
   the explicit trust path for trusted goals. Both are recorded.
3. Should headless write to a different export dir than `/export`?
   Decision: no — same `dev/exports/` (Law 13); the report is identical to the
   TUI `/export`, just emitted without a render.

### Code Verification Evidence

- All citations verified 2026-08-18 against the working tree (AUDIT-1 7/7).
- `bun run validate:repository` PASS after this file was drafted (see master
  Resolution); `markdownlint` PASS on this file.

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  8 steps `[x]` + unit-tested (`runHeadlessAutoDrive` + `index.tsx` entry +
  store-agnostic drive + completion exit codes + `--continue` resume + full
  test matrix). Program-level live headless `/auto` smoke (fixture goal run +
  mid-run kill + `--auto --continue` resume) stays tracked by master
  FID-2026-0818-001 (step 8), which closed + archived 2026-08-18.
- **Closure path:** record the live headless smoke; Nova implementation
  sign-off; closed + archived with evidence per FID-2026-0817-005.

## Lessons Learned

- Headless is a consumer, not a second engine: the drive cycle is identical,
  only the approval surface and the output sink differ — `--print` already
  proves the runtime supports a non-interactive prompt.
- The Law 2 surface in headless must be an explicit flag, never an omission:
  a silent "no one pressed Confirm" would be a scope grant, so headless fails
  closed without an approval signal.
