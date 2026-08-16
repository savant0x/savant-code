<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Durable Budgeted Goal Mode — Event-Sourced Goal State Machine + Continuation Driver

**Filename:** `FID-2026-0814-002-durable-budgeted-goal-mode.md`
**ID:** FID-2026-0814-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — reuses the existing `agentState`, the existing step-loop turn machinery, the existing `task_completed`/`end_turn` completion contract, and the existing EHEL enforcement gate; adds a goal state slice, two model tools, and a continuation driver rather than a new session store or new scheduler
**Depends On:** none (feature gap found during the kimi-code deep audit, `dev/scratchpad/kimi-code-deep-audit-and-idea-farming.md`; modeled on kimi's `GoalMode`/`TurnFlow.driveGoal`, ported to savant's step-loop architecture)

---

## Summary

Savant's current `/goal <condition>` (`cli/src/commands/goal.ts`) is a **one-shot prompt injection**: the condition is wrapped in `<goal condition="…">` text, parsed by the runtime into `agentState.goalCondition` (`loop-context.ts:256-264`), and evaluated once per turn by scanning the final response for `GOAL_SATISFIED`/`GOAL_NOT_SATISFIED` markers (`goal-evaluation.ts:20-38`). There is **no durable goal record, no budget (tokens/turns/wall-clock), no pause/resume, no continuation driver, and no model-facing goal tools** — a goal that survives a restart, or runs for more than one turn, or costs more than the user intended is unsupported by design.

This FID ports the verified architecture of kimi-code's durable goal engine (`resources/kimi-code/packages/agent-core/src/agent/goal/index.ts` + `agent/turn/index.ts` → `TurnFlow.driveGoal` + `agent/injection/goal.ts`) to savant's runtime: an event-sourced goal state machine owned by `agentState`, a continuation driver that runs goal turns until completion/block/budget, and `UpdateGoal`/`GetGoal` model tools — with the `<untrusted_objective>` injection pattern so goal text is treated as data, never instructions.

## Environment

- **OS:** Windows target; platform-agnostic CLI (OpenTUI).
- **Language/Runtime:** TypeScript/Bun 1.3.14; React 19 / OpenTUI 0.2.2; zustand (immer middleware).
- **Tool Versions:** agent runtime `packages/agent-runtime/` (step loop, `loop.ts`, `step.ts`, `goal-evaluation.ts`, `loop-context.ts`), CLI `cli/src/commands/goal.ts`, common `common/src/types/session-state.ts` (`AgentState`).
- **Commit/State:** working tree 0.0.24, unreleased. Active FID queue empty; this is the first of two new feature FIDs (goal mode + hook system) from the kimi-code audit.

## Detailed Description

### Problem

1. **No durable goal.** A `/goal` set in one session is gone after restart; there is no record, no status, no resumability. `normalizeAfterReplay`-style crash semantics do not exist.
2. **No budget.** The user cannot cap a goal by tokens, turns, or wall-clock. A runaway goal iterates until its own markers stop it — expensive and dangerous for free-tier users (the same leak class as the paid-model fallback defect fixed earlier this cycle).
3. **No continuation driver.** The goal is evaluated only inside one turn (`step.ts:338`). The runtime's `while (true)` step loop keeps *that* turn going, but there is no turn-boundary driver that re-injects the goal and starts a fresh turn — so goals cannot span the multi-turn, autonomous work kimi's driver provides.
4. **No model-facing tools.** The model cannot mark a goal complete/blocked or read its own budget; completion is a text-marker convention (`GOAL_SATISFIED` regex) that is fragile and untyped.
5. **Prompt-injection exposure.** The objective is embedded as *instruction* text in the user/system message with no `<untrusted_objective>`-style data boundary; hostile objective text can steer the agent.

### Expected Behavior

1. `/goal <objective> [--budget tokens=T turns=N time=MS]` creates a **durable, event-sourced goal** owned by `agentState`: status `active | paused | blocked` (persisted) + transient `complete`; counters `turnsUsed`/`tokensUsed`/`wallClockMs`; budget limits with live `remaining*` and `overBudget` computation.
2. The runtime **drives continuation turns** while the goal is `active`: each goal turn is a normal step-loop turn; at the turn boundary the driver checks status (complete → stop, blocked → stop, paused → stop, budget over → mark blocked + stop) and otherwise starts a fresh continuation turn with the goal re-injected once per turn.
3. The model can `UpdateGoal('complete' | 'blocked' | 'paused', reason)` and `GetGoal`; completion requires the documented audit (verified end-state, no weak evidence); `blocked` requires a genuine impasse repeated across ≥3 consecutive goal turns.
4. Pause/resume/cancel are first-class: `/goal pause`, `/goal resume`, `/goal cancel`; a restart demotes a stale `active` goal to `paused` (never silently resumes work).
5. Goal text is injected as **data** (`<untrusted_objective>`), never as instructions, and can never override system/developer/tool-schema/permission rules.

### Root Cause (verified at source)

- **R1. `/goal` is a text injection, not a state record.** `cli/src/commands/goal.ts:37-62` builds `<goal condition="…">` text; `loop-context.ts:256-264` regex-extracts it into `agentState.goalCondition`; `common/src/types/session-state.ts:220` declares `goalCondition?: string`. No structured goal object exists.
- **R2. Evaluation is a marker regex at turn end.** `goal-evaluation.ts:15-38` — `evaluateGoalCondition` only runs `if (!shouldEndTurn || !goalCondition)` and regex-tests `GOAL_SATISFIED` on the raw response. No counters, no budgets, no status.
- **R3. No continuation loop at the turn boundary.** `step.ts:338` calls `evaluateGoalCondition` inside the per-turn step loop; the loop is `while (true)` (`loop.ts:140`) within one turn. There is no outer driver that starts a *new* turn with a continuation prompt.
- **R4. No goal tools in the tool registry.** `tools/handlers/list.ts:116` registers `task_completed`; no `UpdateGoal`/`GetGoal`. (Reference: `echo/enforcement.ts:649` — `task_completed`/`end_turn` are the recognized end-turn tools.)
- **R5. No budget accounting surfaces.** Token accounting exists for context (`context-tokens.ts`) but nothing counts goal-attributable tokens/turns/wall-clock.

## RED — Issue Catalog (evidence)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| G-01 | high | `/goal` is a one-shot prompt injection; no durable goal record, status, or resumability | `cli/src/commands/goal.ts:37-62` (text injection); `loop-context.ts:256-264` (regex parse); `session-state.ts:220` (`goalCondition?: string` only) |
| G-02 | high | Goal evaluation is a fragile marker regex at turn end; no typed completion | `goal-evaluation.ts:15-38` (`GOAL_SATISFIED` / `GOAL_NOT_SATISFIED` regexes); `step.ts:338` (single call site) |
| G-03 | high | No continuation driver — goals cannot span autonomous multi-turn runs | `loop.ts:140` (`while (true)` is intra-turn); `step.ts:319-338` (end-turn decision is per-turn only) |
| G-04 | medium | No model-facing goal tools (`UpdateGoal`/`GetGoal`) — completion is text-marker convention | `tools/handlers/list.ts:116` (no goal tools); `echo/enforcement.ts:649` (only `task_completed`/`end_turn` recognized) |
| G-05 | medium | No budget (tokens/turns/wall-clock) — runaway-goal cost risk, esp. free tier | No `budget`/`overBudget` anywhere in `packages/agent-runtime/src/run-agent-step` or `common/src/types/session-state.ts` (absence grep, see AUDIT) |
| G-06 | medium | Objective injected as instructions — prompt-injection exposure | `cli/src/commands/goal.ts:38-50` (objective inside the *instruction* block); no `<untrusted_objective>`-style data boundary anywhere in the runtime |
| G-07 | low | No pause/resume/cancel surface; no restart normalization | `cli/src/commands/goal.ts` has no pause/resume/cancel subcommands; no `normalizeAfterReplay` equivalent |

## GREEN — Proposed Solution (converged)

1. **Durable goal state slice in `AgentState`** (`common/src/types/session-state.ts`):
   - `goal?: { goalId, objective, completionCriterion?, status: 'active'|'paused'|'blocked', turnsUsed, tokensUsed, wallClockMs, wallClockResumedAt?, budgetLimits?: { tokenBudget?, turnBudget?, wallClockBudgetMs? }, terminalReason? }`.
   - `complete` is **transient** — announced, then the record is cleared (never rests on disk), mirroring kimi's design. `cancel` clears the record. Persist through the existing session store (same mechanism as `goalCondition` today); on run start, demote a stale `active` → `paused` with reason "Paused after agent resume".
2. **Budget accounting + report**: `computeBudgetReport`-style pure function (`overBudget`, `remainingTokens/Turns/WallClockMs`); token deltas fed from the existing step-usage accounting; turn increments at the goal-turn boundary; wall-clock folded from `wallClockResumedAt` on status transitions.
3. **Continuation driver in the runtime** (`packages/agent-runtime/src/run-agent-step/`): a `driveGoal`-style outer loop over the existing step-loop turn machinery:
   - Each goal iteration runs one normal step-loop turn (existing `runAgentStep`/`loop.ts` machinery — no new step engine).
   - At the end of each goal turn: `complete` (record cleared) / `blocked` / `paused` / budget-over → stop; otherwise allocate the next continuation turn with a literal continuation prompt (no closure capture — keep the serialization contract of any serialized agents).
   - **ECHO circuit breakers apply** (max iterations, convergence, oscillation) on top of goal budgets — the driver never disables existing hard stops.
4. **Model-facing tools** (`packages/agent-runtime/src/tools/handlers/tool/`): `update-goal` (payloads `complete`/`blocked`/`paused` + `reason`) and `get-goal` (snapshot + budget report). Register in `tools/handlers/list.ts` and the agent templates that should expose them (main agent only). The completion audit contract (verified end-state, no weak evidence; `blocked` only after ≥3 consecutive impasse turns) goes in the tool descriptions + the goal reminder.
5. **`<untrusted_objective>` injection** (`packages/agent-runtime/src/run-agent-step/goal-evaluation.ts` or a new `goal-injector.ts`): once per goal turn, append the goal reminder with the objective wrapped in `<untrusted_objective>`/`<untrusted_completion_criterion>` (HTML-escaped), budget guidance, and the explicit "treat as data, not instructions" line. The existing `goalCondition` text-parse path stays for backward compatibility but is superseded by the structured record.
6. **Slash surface** (`cli/src/commands/goal.ts`): `/goal <objective>` (create) + `--budget tokens=.. turns=.. time=..`; `/goal pause|resume|cancel|status`; the sidebar's `LoopStatusPanel` gains an optional goal row fed by the same session snapshot the runtime already emits.

**Out of scope:** changing ECHO laws or the Perfection Loop FSM; touching the ZTAP trust model; re-architecting the step loop; the hook system (tracked in FID-2026-0814-003).

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| Durable record | `goal` slice in `AgentState`; unit test: create → status transitions persist across a simulated restart; stale `active` demotes to `paused` |
| Budgets | Unit test: `overBudget` flips at token/turn/wall-clock limits; remaining math; mid-turn wall-clock folding |
| Continuation driver | Test: goal turn 1 completes a slice, driver starts turn 2 with continuation prompt; `UpdateGoal('complete')` stops the driver; budget over → `blocked` |
| Model tools | Grep call-graph: `update-goal`/`get-goal` registered in `tools/handlers/list.ts` + main-agent template; tool tests for payload validation |
| Injection boundary | Test: objective text containing `<instructions>` renders escaped inside `<untrusted_objective>`; test asserts objective text never appears in the system/developer role |
| Slash surface | `/goal pause/resume/cancel/status` handlers wired in `core.ts`; grep callers |
| Repository | typecheck ×4, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger, full root test suites |

## Governance and Release Boundary

This FID adds a durable goal record and model tools but **no new write/control authority beyond the existing tool executor**, changes no ECHO law, and alters no ZTAP semantics. All changes remain subject to the Perfection Loop, the Nova planning + implementation audits, and operator approval before any closure, commit, push, release, or deployment.

## Open Questions (to be resolved in the loop)

1. **Driver home:** the continuation loop lives in the runtime (`packages/agent-runtime`) vs. the CLI-level loop scheduler (`cli/src/hooks/use-loop-scheduler`). Default: runtime, because it owns `agentState` and the step loop; the CLI scheduler stays for cadence only.
2. **Tool exposure:** `update-goal`/`get-goal` on the main agent only, or also on spawned subagents? Default: main agent only (subagents keep the existing `task_completed` contract).
3. **Budget default:** no default budget (explicit `--budget` only) vs. a generous cap. Default: explicit only — never silently impose a limit the user did not set.

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Does the continuation driver conflict with the existing intra-turn `while (true)` loop?** No — `loop.ts:140` is the step loop *within* a turn; the driver wraps it, running one full turn per iteration and allocating a new one at the boundary. The step loop is untouched.
2. **Is the marker-regex path a compatibility contract?** Yes — removing `goalCondition` parsing would break the existing `dev/test-prompts` goal tests (e.g. `run-outcome.test.ts:85`). GREEN keeps the parse for backward compatibility while the structured record supersedes it.
3. **Which agents get the goal tools?** The main agent only — subagents already terminate via `task_completed` (`echo/enforcement.ts:649`) and a goal tool there would entangle FID-bound execution.
4. **Can the driver run inside a serialized (`.toString()`/eval) agent?** The driver lives in the runtime, not in a serialized agent; the continuation prompt must be literal-only if any part is serialized.
5. **Is wall-clock accounting correct across pause/resume?** Only fold `now − wallClockResumedAt` when leaving `active`; anchor on entering `active` — copied verbatim from kimi's `applyStatus` (`goal/index.ts`), which is already unit-tested upstream.

### Code Verification Evidence

```text
$ grep -n "goalCondition" packages/agent-runtime/src/run-agent-step/*.ts common/src/types/session-state.ts
loop-context.ts:256-264 (parse <goal condition=...> into agentState.goalCondition)
step.ts:338 (evaluateGoalCondition call)
goal-evaluation.ts:15-38 (GOAL_SATISFIED / GOAL_NOT_SATISFIED marker regexes)
session-state.ts:220 (goalCondition?: string — the only goal field)
$ grep -rn "budget\|overBudget" packages/agent-runtime/src/run-agent-step common/src/types/session-state.ts | grep -v test
(no matches)   # no budget machinery exists
$ grep -n "update-goal\|get-goal\|UpdateGoal\|GetGoal" packages/agent-runtime/src/tools/handlers
(no matches)   # no model-facing goal tools
$ grep -rn "untrusted_objective" packages/agent-runtime/src cli/src common/src
(no matches)   # no untrusted-data injection pattern exists
$ grep -n "task_completed\|end_turn" packages/agent-runtime/src/echo/enforcement.ts
649: return toolName === 'end_turn' || toolName === 'task_completed'   # existing end-turn contract
```

### Loop 1 — RED (catalog)

Issues G-01…G-07 cataloged with `file:line` evidence (see RED table). Severities: G-01/G-02/G-03 high; G-04/G-05/G-06 medium; G-07 low. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Six-part solution documented: durable `goal` slice, budget accounting, runtime continuation driver, model tools, `<untrusted_objective>` injection, slash surface. **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -rn "goalCondition" packages/agent-runtime/src common/src cli/src | grep -v test
cli/src/commands/goal.ts:37-62        # injection site
packages/agent-runtime/src/run-agent-step/loop-context.ts:256-264   # regex parse
packages/agent-runtime/src/run-agent-step/step.ts:338               # evaluation call
packages/agent-runtime/src/run-agent-step/goal-evaluation.ts:15-38  # marker regex
common/src/types/session-state.ts:220 # goalCondition?: string — only goal field
$ grep -rn "budget\|overBudget" packages/agent-runtime/src/run-agent-step common/src/types/session-state.ts | grep -v test
(no matches)
$ grep -rn "UpdateGoal\|update-goal\|GetGoal\|get-goal" packages/agent-runtime/src | grep -v test
(no matches)
$ grep -rn "untrusted_objective" packages/agent-runtime/src cli/src common/src
(no matches)
```

**Method 2 (manual verification of the cited code, read 0-EOF):**

| Claim | Verdict | Evidence |
|---|---|---|
| G-01 `/goal` is text injection, no durable record | **PASS** | `goal.ts:37-62` builds `<goal condition>` text; `loop-context.ts:256-264` regex-extracts to `goalCondition?: string` (`session-state.ts:220`); no structured object |
| G-02 marker-regex evaluation | **PASS** | `goal-evaluation.ts:15-38`; single call site `step.ts:338`; no typed completion |
| G-03 no continuation driver | **PASS** | `loop.ts:140` `while (true)` is intra-turn; `step.ts:319-338` end-turn decision is per-turn |
| G-04 no model tools | **PASS** | `tools/handlers/list.ts:116` registers only `task_completed`; grep for goal tools → 0 |
| G-05 no budgets | **PASS** | Absence grep across runtime + session-state → 0 matches |
| G-06 objective-as-instructions injection | **PASS** | `goal.ts:38-50` puts objective inside the instruction block; `untrusted_objective` grep → 0 |
| G-07 no pause/resume/cancel/restart | **PASS** | `goal.ts` has no subcommands; no `normalizeAfterReplay` equivalent in runtime |

**Law 4 (call-graph):** the GREEN plan adds two new tools (`update-goal`, `get-goal`) and a new optional `goal` slice in `AgentState` — both require production caller greps during implementation: tool registration in `tools/handlers/list.ts` + main-agent template, and the `goal` slice written by the driver and read by the slash command / sidebar snapshot. Zero callers at implementation time = FID rejected. **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **G-01 CONFIRMED:** the only goal state is a regex-extracted string; nothing survives restart.
- **G-02 CONFIRMED:** marker regexes on raw response text are untyped and provider-fragile (a provider that wraps markers in tags would break evaluation).
- **G-03 CONFIRMED:** no turn-boundary driver exists — the step loop cannot be the driver because it is the *turn*.
- **G-05 CONFIRMED with severity rationale:** budget absence is elevated to medium because it compounds the free-tier cost-leak class already fixed this cycle (paid-model fallback); a runaway `/goal` on a free provider would burn credits with no cap.
- **G-06 CONFIRMED:** the injection exposure is real — the objective is inside the *instruction* block; kimi's `<untrusted_objective>` fix is the robust default and is already in GREEN.
- **OMISSION REFINED (added to GREEN):** the driver must not bypass ECHO's circuit breakers — max-iterations/convergence/oscillation hard stops apply *on top of* goal budgets; GREEN point 3 already states this, but it must also be an implementation gate (a goal cannot exceed the runtime's existing step/iteration caps).
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — Fresh re-audit (2026-08-14, all-FID pass)

Re-verified every RED claim at source with tool output after the companion FIDs (003-006) were filed:

```text
$ grep -n "goalCondition" packages/agent-runtime/src/run-agent-step/loop-context.ts packages/agent-runtime/src/run-agent-step/step.ts
loop-context.ts:256-263 (regex parse into agentState.goalCondition — unchanged)
step.ts:338 (evaluateGoalCondition call — unchanged)
$ grep -rc "overBudget" packages/agent-runtime/src/run-agent-step common/src/types/session-state.ts
(0 matches in every file)          # budget absence still holds
$ grep -n "task_completed" packages/agent-runtime/src/tools/handlers/list.ts packages/agent-runtime/src/echo/enforcement.ts
list.ts:116 (task_completed handler — no goal tools)
enforcement.ts:649 (end_turn/task_completed contract — unchanged)
```

**ADVERSARIAL (cross-check):** all claims **CONFIRMED** on re-read. **Cross-FID check:** FID-006 also touches `loop-context.ts` (context compactor init) but at a different boundary (`:271-280` vs the goal parse at `:256-264`) — no conflict; implementation order is independent. No refutations, no new omissions. **AUDIT passes → COMPLETE (planning) stands.**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass: zero actionable improvements beyond the recorded refinement; no oscillation; delta well under the 10% cap. FID status → `analyzed`. Implementation is not approved until the Nova planning sign-off PASS and operator approval; closure additionally requires the implementation audit.

## Resolution

- **Status:** `closed` — implemented and verified under automation level 3 (2026-08-14).
- **Fix Description:** Durable budgeted goal mode — event-sourced goal state machine (`active/paused/blocked` + transient `complete`), token/turn/wall-clock budgets, runtime continuation driver over the existing step loop, `update-goal`/`get-goal` model tools, `<untrusted_objective>` data-boundary injection, and `/goal pause|resume|cancel|status` slash surface.
- **Tests Added:** 30 focused tests — `goal-engine.test.ts`, `goal-tools.test.ts`, `goal-driver.test.ts` (DI-seamed, no module mocking).
- **Verification Evidence:** AUDIT greps pasted above (Loop 1 — AUDIT).
- **Archived:** closed + archived 2026-08-14. See `dev/fids/archive/README.md`.
