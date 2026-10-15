<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0814-002..007 (Goal Engine, Hook System, Harness Frictions + Model Unification, Trust Matrix + Compaction)

**Date:** 2026-08-14
**Scope:** Implementation of the five-child remediation program — durable budgeted goal mode (002), extensible hook system (003), verification-harness frictions + project-wide model unification (004), Trust Matrix auto-resolution (005), compaction status freshness + visible feedback (006) — coordinated by master (007).
**Status:** REQUESTED
**Priority:** High (P0 model unification billing-risk; P0 exit-code compaction; P1 goal/hooks/compaction; P2 trust-matrix)

## Request

Please independently audit the implemented FIDs below and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation sign-off request**. A PASS verifies the implementation; it does **not** authorize closure, archive movement, commit, push, release, publication, or deployment. Operator closure is a separate decision.

## Records under review

All six records now live in `dev/fids/archive/` with status `closed` (Nova planning PASS was recorded for each child before implementation):

- `dev/fids/archive/FID-2026-0814-002-durable-budgeted-goal-mode.md`
- `dev/fids/archive/FID-2026-0814-003-extensible-hook-system.md`
- `dev/fids/archive/FID-2026-0814-004-verification-harness-agent-frictions.md`
- `dev/fids/archive/FID-2026-0814-005-trust-matrix-auto-resolution.md`
- `dev/fids/archive/FID-2026-0814-006-compaction-status-freshness-and-visual-feedback.md`
- `dev/fids/archive/FID-2026-0814-007-master-implementation-plan.md`

## What was implemented

### FID-002 — Durable budgeted goal mode

- `common/src/types/session-state.ts` — `goal` slice on `AgentState` (event-sourced state machine: `active | paused | blocked | complete` + budget counters).
- `common/src/tools/constants.ts`, `common/src/tools/params/tool/{update-goal,get-goal}.ts`, `common/src/tools/list.ts` — `update_goal`/`get_goal` tool names + zod param schemas registered.
- `packages/agent-runtime/src/run-agent-step/goal-engine.ts` — state machine + budget evaluation + `<untrusted_objective>` wrapping (re-exports directive helpers from `common/src/util/goal-directives.ts`).
- `packages/agent-runtime/src/tools/handlers/tool/{update-goal,get-goal}.ts`, `handlers/list.ts` — tool handlers.
- `packages/agent-runtime/src/run-agent-step/goal-driver.ts` — continuation driver (DI-seamed `runGoalTurn` injectable; no module mocking), turns goal turns until complete/block/budget.
- `packages/agent-runtime/src/run-agent-step/loop-context.ts` + `main-prompt.ts` — directive parsing + driver wiring + stale-active demotion.
- `cli/src/commands/goal.ts` — `/goal <objective> [--budget tokens=N turns=N time=MS]` + `status|pause|resume|cancel`.
- `cli/src/components/savant-ui/echo/loop-status-panel.tsx` — durable goal row.

### FID-003 — Extensible hook system

- `common/src/types/hooks.ts` — 17-event hook schema + `HooksConfig`.
- `common/src/util/protocol-config.ts` — `hooks:` block parsing.
- `packages/agent-runtime/src/hooks/{types,runner,engine}.ts` — fail-open bounded runner (JSON-on-stdin shell protocol; only explicit `deny` or exit code 2 blocks) + matcher/engine.
- `packages/agent-runtime/src/tools/tool-executor/native.ts` + `custom.ts` — `PreToolUse` gate composing with EHEL `beforeToolCall`, plus `PostToolUse`/`PostToolUseFailure`.
- `packages/agent-runtime/src/main-prompt.ts` — `SessionStart`/`SessionEnd`.
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` — `SubagentStart`/`SubagentStop` at the `executeSubagent` funnel.

### FID-004 — Harness frictions + model unification

- H-01/H-05/H-06 — `packages/agent-runtime/src/context-compactor.ts` + `context-compactor/state.ts`: exit-code-preserving micro-compaction placeholder; config-driven keep-recent (3→6) with a context-pressure gate and optional floor.
- H-02 — `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts`: quote/character-class-aware shell metachar scanner.
- H-03 — `packages/agent-runtime/src/util/echo-compliance.ts`: code-vs-docs compliance write classification.
- H-07 — `agents/savant/handle-steps.ts` + `agents/savant/savant.ts`: `keepRecentTokens`/`autoCompactRatio`/`forceCompactRatio` threaded from `protocol.config.yaml` as baked literals into the serialized factory (config resolved at prebuild via findUp).
- H-08..H-12 (P0) — `cli/src/state/savant-free-model-store.ts` `resolveActiveModel()` single resolution point; `cli/src/hooks/helpers/send-message-agent.ts` `applySavantCodeModelOverride` reads the store; `cli/src/teacher/forge.ts` paid `deepseek/deepseek-v4-pro` hardcode removed; `agents/thinker/thinker-{gemini,with-files-gemini}.ts` `inheritParentModel:false` escapes removed; `cli/src/headless-run.ts` `resolvedAgent` bypass deleted.

### FID-005 — Trust Matrix auto-resolution

- `packages/agent-runtime/src/provenance/session.ts` — `finalize()` resolves open `pending` receipts to `no_verdict` via a signed system-role close annotation.
- `common/src/types/provenance.ts` — `no_verdict` terminal status.
- `cli/src/components/savant-ui/echo/trust-matrix.tsx` — `awaiting audit` / terminal display + `/attest` export parity.

### FID-006 — Compaction freshness + feedback

- `sdk/src/run/types.ts` + `sdk/src/run/execution.ts` — `contextWindow` + `compression` threaded through the SDK boundary (was silently dropped → runtime always fell back to 200k).
- `packages/agent-runtime/src/run-agent-step/types.ts` + `loop-context.ts` — `LoopAgentStepsParams.compression`; compactor initialized from the resolved window.
- `sdk/src/run/execution/snapshot.ts` — snapshot emits on status/context change (no stale percent).
- `cli/src/components/compaction-signal.tsx` + `cli/src/state/chat-store/types.ts` — in-stream `CompactionSignal` lifecycle block (`⚙ Compacting context…` → `✓ Compaction complete (−N tokens)` → `⚠ Compaction ineffective`), bounded by a 5-event cap.

## Verification evidence (reproduce independently)

- **Typecheck ×4:** `sdk`, `common`, `packages/agent-runtime`, `cli` — all exit 0.
- **Full root suites (Bun 1.3.14):**
  - `sdk` — 475 pass / 1 skip / 0 fail
  - `common` — 610 pass / 4 skip / 0 fail
  - `packages/agent-runtime` — 958 pass / 0 fail
  - `cli` — 3070 pass / 18 skip / 0 fail
- **New focused suites:** `goal-engine.test.ts` + `goal-tools.test.ts` + `goal-driver.test.ts` (30 tests, DI-seamed — no module mocking), `hooks/{runner,engine}.test.ts` + fixtures, `context-compactor-micro.test.ts` (H-05/H-06), `savant-free-model-store.test.ts` (one-model invariant), `context-pruner-phase3.test.ts` (H-07 factory threading), provenance `finalize`→`no_verdict` tests.
- **ESLint** `bun x eslint . --max-warnings 0` — zero warnings. **lint:md** — 0. **Prettier** — clean.
- **`bun run validate:repository`** — PASS (quality-ratchet approved-growth entries for intentionally grown files — raised, never lowered). **fid-ledger** — 5/5.

## Hard questions Nova must verify at source

1. **Goal engine is really wired (FID-002).** `grep -rn "update_goal\|get_goal" common/src/tools/constants.ts common/src/tools/list.ts` and `grep -rn "update-goal\|get-goal" packages/agent-runtime/src/tools/handlers/list.ts` find the registrations; `grep -rn "runGoalTurns\|goal-driver" packages/agent-runtime/src/main-prompt.ts` finds the driver call; `grep -rn "untrusted_objective" common/src/util/goal-directives.ts packages/agent-runtime/src/run-agent-step/goal-engine.ts` finds the injection (goal text is data, never instructions); `grep -rn "update_goal\|get_goal" agents/savant/savant.ts` finds the tools on the main agent template. Confirm the budget check is `>=` so `turns=N` grants exactly N turns.
2. **Hook system composes with EHEL, never bypasses (FID-003).** Confirm `grep -n "PreToolUse\|runPreToolUse" packages/agent-runtime/src/tools/tool-executor/native.ts` and `custom.ts` run the hook gate *in addition to* `enforcement.beforeToolCall` (the hook is an extra gate, not a replacement); confirm the runner fail-open contract (`deny` decision or exit code 2 is the only block path) in `packages/agent-runtime/src/hooks/runner.ts`; confirm `hooks` parsing in `common/src/util/protocol-config.ts` defaults to an empty list on malformed/absent config.
3. **Micro-compaction preserves the exit code (FID-004 H-01).** Confirm `packages/agent-runtime/src/context-compactor.ts` emits an exit-code-preserving placeholder for tool-result slots instead of erasing the exit status; confirm the quote/character-class-aware scanner in `run-readonly-command.ts` no longer blocks legitimate quoted/class-bearing commands; confirm code-vs-docs write classification in `util/echo-compliance.ts`.
4. **H-07 config threading is real and closure-free.** Confirm `agents/savant/handle-steps.ts` bakes `keepRecentTokens`/`autoCompactRatio`/`forceCompactRatio` from `protocol.config.yaml` into the serialized source and the regenerated `cli/src/agents/bundled-agents.generated.ts` contains the literals; confirm the generated source stays closure-free (literals/params/agentState only).
5. **One model project-wide (FID-004 H-08..H-12, P0).** `grep -rn "deepseek/deepseek-v4-pro" cli/src/teacher agents/thinker cli/src/headless-run.ts` returns **no hardcoded paid-model fallback** in the run path (a default constant on an agent definition is acceptable only if `resolveActiveModel()`/`applySavantCodeModelOverride` overrides it before any run); `grep -rn "inheritParentModel" agents/` returns no `false` escape; `grep -rn "resolvedAgent" cli/src/headless-run.ts` returns no bypass; `savant-free-model-store.test.ts` asserts no run path can construct a paid model when the store resolved the free tier.
6. **Trust Matrix auto-resolution (FID-005).** Confirm `packages/agent-runtime/src/provenance/session.ts` `finalize()` resolves open `pending` receipts to `no_verdict` with a signed system-role close annotation; confirm `common/src/types/provenance.ts` declares `no_verdict`; confirm the UI renders `awaiting audit` for live pending rows and a terminal explanation for `no_verdict` (never faking an audit).
7. **Compaction window is no longer dropped (FID-006).** Confirm `contextWindow` + `compression` are destructured in `sdk/src/run/execution.ts` `runOnce` and passed through `callMainPrompt` → `mainPrompt` → `loopAgentSteps` → `createLoopContext` → `ContextCompactor` (no silent 200k fallback when the CLI resolves a real window); confirm `snapshot.ts` emits on status/context change (not only message-identity change); confirm `CompactionSignal` is mounted at the bottom of the chat transcript and is render-only (no history mutation, no tool/write path).
8. **No ECHO law weakened / no new authority.** New tools (`update-goal`/`get-goal`) go through the normal tool-safety registry; hooks are an additional gate that composes with EHEL and fail open (never a bypass); the model-unification change removes paid hardcodes without introducing any new model surface; `CompactionSignal` and the Trust Matrix changes are read-only UI.

## Authorization boundary

This request authorizes no closure, archive movement, commit, push, release, publication, or deployment. Operator closure follows a Nova PASS plus the operator's explicit approval. The FIDs are already physically in `dev/fids/archive/` as working-tree closure evidence; a Nova FAIL would require the records be pulled back to `dev/fids/` and self-corrected.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim (including any count drift, e.g. the exact test totals above).
4. Explicit confirmation this is implementation review only and does not authorize production changes or release activity.
