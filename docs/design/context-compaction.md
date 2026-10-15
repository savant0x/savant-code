# Context Compaction System

FID-2026-0821-001 (closed, archived) — implemented 2026-08-21. This document
describes the shipped system; the FID (dev/fids/archive/) holds the full
design record and evidence.

## Overview

Progressive context management in four layers:

| Layer | Name | Trigger | Mechanism |
|---|---|---|---|
| L1 | Manual | `/compact` command | Force pruner spawn → compact-and-stop |
| L2 | Micro-compact | Every step (zero-cost) | Clears stale tool results, keeps N most recent |
| L3 | Auto-compact | Token threshold | Context-pruner subagent summarizes older turns |
| L4 | Reactive | Provider prompt-too-long error | Emergency truncation (system + last 20% + preserved) |

## Trigger Math (single threshold owner)

One canonical resolver — `resolveTriggerThreshold(window, ratio)` in
`packages/agent-runtime/src/context-compactor/state.ts`:

    autoCompact = Math.floor(clamp(W × ratio, 100_000, W − 30_000))

with min-side-wins when the clamp range inverts at small windows
(W=128k, ratio 0.8 → min(102400, 98000) = 98000). Ordering invariant:
`reactiveCompact(W) > force(W − 15k) > autoCompact`. The serialized savant
generator mirrors this formula inline (`computeTriggerThreshold` in
`agents/savant/handle-steps-factory.ts`); parity is pinned by
`compact-trigger-threshold.test.ts`. Ratio comes from
`protocol.config.yaml` → `compression.autoCompactRatio` (default 0.8),
threaded via `loop-context.ts`.

## Phase Vocabulary

`agentState.compactionStatus` (canonical type in
`common/src/types/session-state.ts`):

| Phase | Emitted by | Meaning |
|---|---|---|
| `idle` | prepareStepContext | Below trigger |
| `warning` | prepareStepContext | At/above trigger, one-shot stamped (`contextWarningIssuedAt`, −10% hysteresis clear) |
| `compacting` | handleSteps generator | Pruner spawn in flight |
| `pruned` | spawn-agent-inline (P0-2) | Pruner completed, history shrank (real recount) |
| `ineffective` | spawn-agent-inline (P0-2) | Pruner completed, removed nothing material |
| `blocked` | prepareStepContext / ladder | Compaction could not run — `blockReason` says why: `circuit-breaker-open · cooldown · escalation-hold · pruner-unavailable · compaction-disabled` |
| `compacted` | micro-compact (legacy) | Micro-compact cleared tool results |

Runtime emits terminal truth; the CLI records it verbatim
(`sidebar-actions.ts` direct-trust branch, transition-inference kept only
as a legacy fallback).

## Visibility

- **Transcript panel:** `CompactionSignal`
  (`cli/src/components/compaction-signal.tsx`) renders a bordered panel
  styled after `TerminalCommandDisplay` — rounded chrome on
  `theme.surface`/`theme.border` with the right-aligned glowing
  `TrafficLights` title bar (animation budget suspends it off-screen).
  Priority: compacting → blocked → warning → last terminal event.
- **Sidebar row:** percent-of-window + compaction phase via the snapshot
  heartbeat; the store (`chat-store/sidebar-actions.ts`) trusts runtime
  phases directly and keeps a bounded 5-event lifecycle history.
- The context-pruner subagent itself stays hidden — visibility flows
  through phases and the completion notice, not its verbose transcript.

## Token Count Precedence

One owner: `reconcileTokenCount()`
(`packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`).

1. Provider-reported usage (`agentState.lastProviderUsage`, stamped from
   the existing `onCacheDebugUsageReceived` hook in step.ts) wins when it
   is FRESHER than the most recent history replacement — wall-clock compare
   against `lastPrunerCompletionAt`. Provider truth beats every estimate.
2. Otherwise the local estimate stands: the ×1.35 estimator before the
   first response of a run, or the post-prune local recount written by the
   spawn boundary (stale usage loses to the fresher prune stamp).

Hosted runs stamp the accurate endpoint count into the same channel, so
BYOK and hosted converge through one entry point.

## Escalation Ladder (no more silent self-disarm)

Generator-local, fresh per turn (handle-steps-factory.ts):

    standard pass → still ≥ trigger ⇒ forced retry (bypasses cooldown)
                → still ineffective ⇒ blocked('escalation-hold'),
                                     re-arm at +5% growth or new turn

The circuit breaker remains as an infinite-loop backstop; opening it now
ALWAYS surfaces `blocked('circuit-breaker-open')` — never silence.

## Manual /compact

Registered in `cli/src/data/slash-commands.ts`; dispatches the literal
prompt. The savant generator intercepts it once per run (trailing
USER_PROMPT === '/compact'): force context-pruner spawn (cooldown
bypassed) → compact-and-stop (generator return; no LLM summary pass).
Manual invocation overrides escalation-hold and breaker-open (user
agency); the outcome still surfaces via terminal phases. Legacy
interception in run-agent-step/step.ts remains the fallback for agents
without handleSteps.

## Visibility

- **Transcript panel:** `CompactionSignal`
  (`cli/src/components/compaction-signal.tsx`) renders a bordered panel
  styled after `TerminalCommandDisplay` — rounded chrome on
  `theme.surface`/`theme.border` with the right-aligned glowing
  `TrafficLights` title bar (animation budget suspends it off-screen).
  Priority: compacting → blocked → warning → last terminal event.
- **Sidebar row:** percent-of-window + compaction phase via the snapshot
  heartbeat; the store (`chat-store/sidebar-actions.ts`) trusts runtime
  phases directly and keeps a bounded 5-event lifecycle history.
- The context-pruner subagent itself stays hidden — visibility flows
  through phases and the completion notice, not its verbose transcript.

## Token Count Precedence

One owner: `reconcileTokenCount()`
(`packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`).

1. Provider-reported usage (`agentState.lastProviderUsage`, stamped from
   the existing `onCacheDebugUsageReceived` hook in step.ts) wins when it
   is FRESHER than the most recent history replacement — wall-clock compare
   against `lastPrunerCompletionAt`. Provider truth beats every estimate.
2. Otherwise the local estimate stands: the ×1.35 estimator before the
   first response of a run, or the post-prune local recount written by the
   spawn boundary (stale usage loses to the fresher prune stamp).

Hosted runs stamp the accurate endpoint count into the same channel, so
BYOK and hosted converge through one entry point.

## Escalation Ladder (no more silent self-disarm)

Generator-local, fresh per turn (handle-steps-factory.ts):

    standard pass → still ≥ trigger ⇒ forced retry (bypasses cooldown)
                → still ineffective ⇒ blocked('escalation-hold'),
                                     re-arm at +5% growth or new turn

The circuit breaker remains as an infinite-loop backstop; opening it now
ALWAYS surfaces `blocked('circuit-breaker-open')` — never silence.

## Manual /compact

Registered in `cli/src/data/slash-commands.ts`; dispatches the literal
prompt. The savant generator intercepts it once per run (trailing
USER_PROMPT === '/compact'): force context-pruner spawn (cooldown
bypassed) → compact-and-stop (generator return; no LLM summary pass).
Manual invocation overrides escalation-hold and breaker-open (user
agency); the outcome still surfaces via terminal phases. Legacy
interception in run-agent-step/step.ts remains the fallback for agents
without handleSteps.
