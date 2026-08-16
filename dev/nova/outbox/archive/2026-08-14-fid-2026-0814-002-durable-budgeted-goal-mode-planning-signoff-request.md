<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0814-002 (Durable Budgeted Goal Mode)

**Date:** 2026-08-14
**Scope:** Planning review of a feature FID that ports kimi-code's durable goal engine to savant: an event-sourced goal state machine (`active`/`paused`/`blocked` + transient `complete`), token/turn/wall-clock budgets, a runtime continuation driver over the existing step loop, `update-goal`/`get-goal` model tools, `<untrusted_objective>` data-boundary injection, and `/goal pause|resume|cancel|status`.
**Status:** REQUESTED
**Priority:** High (feature gap; free-tier cost-leak class if left as a marker-regex prompt)

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0814-002-durable-budgeted-goal-mode.md` — status `analyzed` (planning-converged via the Perfection Loop with AUDIT + ADVERSARIAL + a fresh Loop-2 re-audit).

## What the FID claims (verify each at source)

| ID | Claim | Cited source |
|---|---|---|
| G-01 (high) | `/goal` is a one-shot prompt injection; there is no durable goal record, status, or resumability | `cli/src/commands/goal.ts:37-62` (builds `<goal condition="…">` text); `packages/agent-runtime/src/run-agent-step/loop-context.ts:256-264` (regex parse into `agentState.goalCondition`); `common/src/types/session-state.ts:220` (`goalCondition?: string` only) |
| G-02 (high) | Goal evaluation is a fragile marker regex at turn end; no typed completion | `packages/agent-runtime/src/run-agent-step/goal-evaluation.ts:15-38` (`GOAL_SATISFIED`/`GOAL_NOT_SATISFIED` regexes); `step.ts:338` (single call site) |
| G-03 (high) | No continuation driver — goals cannot span autonomous multi-turn runs | `loop.ts:140` (`while (true)` is intra-turn); `step.ts:319-338` (end-turn decision is per-turn only) |
| G-04 (medium) | No model-facing goal tools (`update-goal`/`get-goal`) — completion is a text-marker convention | `tools/handlers/list.ts:116` (only `task_completed`); `echo/enforcement.ts:649` (end-turn contract) |
| G-05 (medium) | No budget (tokens/turns/wall-clock) anywhere — runaway-goal cost risk | Absence grep: `budget`/`overBudget` in `run-agent-step` + `session-state.ts` → 0 matches |
| G-06 (medium) | Objective is injected as instructions — prompt-injection exposure | `goal.ts:38-50` (objective inside the instruction block); absence grep: `untrusted_objective` → 0 matches |
| G-07 (low) | No pause/resume/cancel surface; no restart normalization | `goal.ts` has no subcommands; no `normalizeAfterReplay` equivalent in the runtime |

## Hard questions Nova must verify at source

1. **`/goal` is a prompt, not a state record.** Confirm `goal.ts:37-62` builds `<goal condition>` text and `loop-context.ts:256-264` regex-extracts it into `goalCondition?: string` (`session-state.ts:220`). If any structured goal object exists elsewhere, G-01 is wrong.
2. **Evaluation is a marker regex.** Confirm `goal-evaluation.ts:15-38` tests `GOAL_SATISFIED`/`GOAL_NOT_SATISFIED` on the raw response, with the single call site at `step.ts:338`.
3. **No continuation driver.** Confirm `loop.ts:140`'s `while (true)` is the *intra-turn* step loop and nothing at the turn boundary starts a new turn with a continuation prompt.
4. **No goal tools.** Confirm `grep -rn "update-goal\|get-goal\|UpdateGoal\|GetGoal" packages/agent-runtime/src | grep -v test` → 0 matches, and `tools/handlers/list.ts:116` registers only `task_completed`.
5. **No budget machinery.** Confirm the absence grep for `budget`/`overBudget` in `packages/agent-runtime/src/run-agent-step` and `common/src/types/session-state.ts` → 0 matches.
6. **Injection exposure.** Confirm `grep -rn "untrusted_objective" packages/agent-runtime/src cli/src common/src` → 0 matches, and the objective text sits inside the *instruction* block at `goal.ts:38-50`.
7. **Driver composition with ECHO circuit breakers.** Confirm the GREEN plan's claim that the continuation driver wraps the existing step loop without disabling the runtime's existing step/iteration caps (GREEN point 3 + the ADVERSARIAL refinement).

## Adversarial checks already run in the FID's Perfection Loop

- The `goalCondition` compatibility path must stay (existing tests pin it: `cli/src/hooks/__tests__/run-outcome.test.ts:85`, `use-loop-scheduler.test.ts`); GREEN supersedes it, never removes it.
- The continuation driver lives in the runtime, not in a serialized agent; any serialized part must stay closure-free (literal-only prompts).
- Wall-clock accounting must fold `now − wallClockResumedAt` only when leaving `active` (kimi's `applyStatus` pattern) — the FID copies this verbatim.
- Goal budgets are **additive** to circuit breakers, never a replacement (implementation gate).
- No new session store, no new scheduler — the driver reuses the existing step-loop turn machinery.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
