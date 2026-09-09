---
title: Eval-runner model override + usage telemetry (Savant Bench measurement substrate)
date: 2026-09-08
author: —
status: planning
requested_by: Spencer (Savant Bench — savant-eval-fame, FID-2026-0908-008)
consumed_by: (unassigned — any savant-code session with Recorder role; FID-2026-0908-002 draft exists at dev/scratchpad/active/)
source_research: FULL SPEC EMBEDDED BELOW — canonical benchmark contract in the requesting repo: C:\Users\spenc\dev\savant-eval-fame\dev\fids\FID-2026-0908-008-harness-integrated-gate-engine.md. This document is self-contained by design; no cross-repo reads are required to implement it.
fids_emitted: []
---

# BO-2026-09-08-eval-runner-model-override-and-usage-telemetry

## Overview

Savant Bench (the lane benchmark) measures lanes = [Model + Provider + Configuration]
by executing real agent runs against deterministic tasks and grading **only on gate
exit codes**. The measurement substrate is this harness (`evals/v2/`). Two additive
capabilities are missing from the eval runner; both are optional-config additions with
zero behavior change when absent:

1. **Per-run model override** — `RunnerConfig.model?: string`. A benchmark lane must
   be able to execute a task against an explicitly supplied model WITHOUT mutating
   `agents/` definitions on disk.
2. **Usage telemetry** — per-run token split (input / output / cached) and the model
   actually used, surfaced on the trace, so the board can report lane economics
   without synthesizing numbers.

Requesting side (Savant Bench) consumes ONLY the public shapes added here
(`RunnerConfig.model`, `TraceMetadata.usage`, `TraceMetadata.model`), via the
published `@savant-code/sdk` / workspace evals exports — no other coupling.

### Non-negotiable constraints

- **Additive + optional only.** When `model` is unset and no usage fields are read,
  every existing code path is byte-identical. The full existing test suite passing
  UNCHANGED is a closure gate.
- **No disk mutation of `agents/`.** The override is an inline agent-definition
  variation at the SDK `run()` boundary. `resolveAgentIdentity`
  (`sdk/src/run/execution/session-state.ts:23-40`) already appends (clones) inline
  agent objects — verified. Use that; do not write to disk.
- **No LLM-judge, no scoring changes.** `DeterministicVerifier` and
  `MetricAggregator` behavior is untouched.
- **No new dependencies.**
- Working dir boundary: this build order is executed exclusively inside savant-code.

## Research Foundation (all grep-verified 2026-09-08 by the requesting side)

- `evals/v2/src/runner.ts` — `RunnerConfig` has `agentId`, `agentDefinitions`,
  `maxAgentSteps`, `env`, `permissionMode`; no `model`, no usage hook.
- `evals/v2/src/runners/savant.ts` — `SavantAgentRunner.executePrompt` calls
  `this.client.run({ agent, prompt, cwd, ... })` with no model override.
- `evals/v2/src/trace.ts` — `finalize()` already lifts `creditsUsed` /
  `directCreditsUsed` / `contextTokenCount` from
  `sessionState.mainAgentState` into `TraceMetadata`; the token split is the
  missing piece.
- `common/src/types/print-mode.ts` — PrintMode union has NO usage event today
  (`finish` carries only `totalCost`; `subagent_finish` carries no cost).
- `packages/agent-runtime/src/run-agent-step/step.ts` (~line 133) — the runtime
  ALREADY receives the full per-LLM-call usage
  `{ inputTokens, outputTokens, cachedInputTokens, totalTokens }` via the
  always-on `onUsage` hook in `createCacheDebugSetup`
  (`run-agent-step/cache-debug.ts:61-79,154`; live since FID-2026-0821-001). It
  currently only stamps `agentState.lastProviderUsage`. The data exists; it is
  simply not emitted to hosts.
- `packages/agent-runtime/src/main-prompt.ts:84-92` — `finish` fires ONCE for the
  main agent (`totalCost = mainAgentState.creditsUsed`); subagent ends emit
  `subagent_finish` (no cost) via `execute-subagent.ts:167-175`.
- `common/src/types/session-state-agent-state.ts` — `AgentState.subagents:
  AgentState[]` is recursive; each child carries its own `creditsUsed`, so
  run-total cost = main + recursive subagent sum, computed from the final
  RunState.
- SDK usage-callback precedent: `sdk/src/impl/llm/usage.ts:158-179`
  (`emitCacheDebugUsage`) already passes exactly the 4-field usage shape to a
  callback — but only along the cache-debug path inside the LLM layer.

## Design Decision (recommended, already adjudicated on the requesting side)

The original plan — thread a host-facing `onUsage` callback through
`RunOptions → runOnce → agent-runtime-impl → AgentRuntimeDeps →
RunAgentStepParams → step.ts` + subagent propagation — touches ~8 files across 4
packages and trips every blast-radius discipline here.

**Recommended mechanism: a new `usage` PrintMode event** — the same host-facing
channel as `finish`/`activity`:

1. `common/src/types/print-mode.ts`: add `printModeUsageSchema` =
   `{ type: 'usage', inputTokens: number, outputTokens: number,
      cachedInputTokens: number, totalTokens: number, agentId?: string }`
   and append to `printModeEventSchema`. (PrintModeEvent is zod-discriminated
   on `type`; additive members are the established compat mechanism.)
2. `packages/agent-runtime/src/run-agent-step/step.ts`: inside the EXISTING
   `onUsage` hook body, additionally emit the event via `onResponseChunk`
   (one emission per LLM call — the hook already fires exactly once per call;
   subagent steps emit their own, tagged with their agentId).
3. Downstream, every consumer gets it for free: SDK `handleEvent`, the eval
   runner, and the NDJSON delegation transport (which taps `handleEvent`).

Then the eval-runner surface:

4. `evals/v2/src/runner.ts`: `RunnerConfig` gains `model?: string` and
   `onUsage?: (sample: UsageSample) => void` (exported `UsageSample` type =
   the 4 fields).
5. `evals/v2/src/runners/savant.ts`:
   - When `config.model` is set, override the agent sent to `client.run()`:
     pass an inline agent definition `{ ...baseDefinition, model: config.model }`
     (clone of the resolved definition with the model swapped). If no
     definition resolves for `agentId`, fail fast with a clear error naming it.
   - In `handleEvent`, on `type === 'usage'`: call `config.onUsage?.(sample)`
     and accumulate the sum for the trace.
6. `evals/v2/src/trace.ts`: `TraceMetadata` gains `usage?: UsageSample`
   (summed across all calls incl. subagents) and `model?: string` (the
   effective model: override if set, else the resolved template's model).
   `finalize()` fills both; also compute `cost_usd` fallback as today.
7. `evals/v2/src/cli.ts`: optional `--model <slug>` flag → `RunnerConfig.model`
   (evaluate mode). Help text + validation only; no default change.
8. Unit tests (new suite, e.g. `evals/v2/tests/`): usage accumulation sums
   correctly across multiple samples + subagent-tagged samples; inline model
   override reaches the SDK options without touching `agents/` (assert via
   injected `savantClient` mock — `SavantAgentRunnerConfig.savantClient`
   already supports injection); trace metadata carries usage/model; absence of
   both options → identical defaults.

## Out of scope

- Provider-routing options beyond the model slug (lane providers are recorded
  on the requesting side; a rejected provider surfaces as a run error there).
- Cost-table / billing changes (`cost_usd` = credits/100 stays as-is).
- Any CLI TUI surface changes (headless/eval only).

## Acceptance Gates

1. `bun x tsc --noEmit` — full type_check chain per `protocol.config.yaml`.
2. `bun test` — ALL existing suites green, unchanged (no-behavior-change proof).
3. New unit tests green (usage accumulation, model override, trace fields,
   absence-of-options parity).
4. `bun x eslint . --max-warnings 0` on touched files.
5. Law 4: `model` consumed by `SavantAgentRunner.executePrompt`; `usage` emitted
   from `step.ts` and consumed by `trace.ts`.
6. No diff outside the named files (`print-mode.ts`, `step.ts`, evals v2
   runner/runner-savant/trace/cli + one test file).
