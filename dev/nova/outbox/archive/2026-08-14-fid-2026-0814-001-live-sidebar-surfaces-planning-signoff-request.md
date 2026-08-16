<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0814-001 (Live Sidebar Surfaces Remediation)

**Date:** 2026-08-14
**Scope:** Planning review of a three-workstream remediation FID covering the compaction-status lifecycle (never-emitted `compacting` phase, divergent display/trigger thresholds, silent re-spawn loop), the Trust Matrix live session signal + deterministic trigger path, and the teacher panel double-spacing + dropped terminal state (`/learn cancel` invisible).
**Status:** REQUESTED
**Priority:** High (P1 compaction feedback + teacher terminal state; P2 trust-matrix live signal)

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0814-001-live-sidebar-surfaces-remediation.md` — status `analyzed` (planning-converged via a 1-pass Perfection Loop with AUDIT + ADVERSARIAL).

## What the FID claims (verify each at source)

| Workstream | Claim | Cited source |
|---|---|---|
| A-01 (high) | `phase: 'compacting'` is **never emitted** in the runtime; the sidebar `compacting…` label is dead code, so the promised `idle → compacting… → compacted` transition (0.0.24 test row V024-P3-5 / AV-04) cannot render | `packages/agent-runtime/src/run-agent-step/context-tokens.ts:208-220` (only `warning`/`compacted`/`idle`); `common/src/types/session-state.ts:133` (type allows it); `cli/src/components/right-sidebar.tsx:92-94` (dead case); absence grep: `'compacting'` in `packages/agent-runtime/src` → 0 emit sites |
| A-02 (high) | The context-pruner spawn (`agents/savant/handle-steps.ts:133-157`) writes no `compactionStatus` — the sidebar is stuck on stale `warning` while the pruner runs or silently fails | `handle-steps.ts:133-157`; `cli/src/hooks/helpers/send-message-monitors.ts:80-91` (2s poll of the last step-boundary status) |
| A-03 (medium) | Displayed percent uses the `ContextCompactor` threshold (`contextWindow − 30k`) while the pruner trigger uses `maxContextLength × 0.8` (`= contextWindow × 0.8`) — "102% of auto threshold" ≈ 90% of the model window and is unrelated to the trigger | `context-compactor.ts:80,189-190`; `loop-context.ts:279-280`; `handle-steps.ts:133,147`; `right-sidebar.tsx:84` |
| A-04 (medium) | The pruner re-spawns **every step** above 80% (`while (true)` generator re-yields); ineffective summaries score a failure and re-arm — a silent re-compaction loop that reads as "compaction too aggressive" with zero feedback | `handle-steps.ts:147`; `context-compactor.ts:222-238` |
| B-01 (medium) | Trust Matrix is purely event-sourced (write/verdict events only) with **no live session signal** — static between events; read-only sessions show the placeholder forever; V024-P3-3 has no deterministic trigger path | `native.ts:681-700`; `spawn-agents.ts:275`; `spawn-agent-inline.ts:178`; `right-sidebar.tsx:276-284`; `trust-matrix.tsx:106-117`; `dev/scratchpad/az-v0.0.24-harness-live-test-report.md` V024-P3-3 |
| C-01 (medium) | Teacher panel double-spacing: `LearnOverlay` root `gap={1}` column with up to 25 text children (incl. 20 event rows, each its own row with `  • ` prefix) — inconsistent with compact `KeyValueRow` sections | `learn-overlay.tsx:61-62,86-91`; `key-value-row.tsx` |
| C-02 (high) | `/learn cancel` is invisible in the panel: `right-sidebar` drops `phase`/`completionState`; `cancelTeacherExercise()` sets `completionState='cancelled'` **without** a `result` event — the panel stays mounted showing the last live phase with no completion badge | `right-sidebar.tsx:261-268` (mount `:261-262`, props `:263-268`); `learn-overlay.tsx:44-49`; `cli/src/teacher/runtime.ts:237,275-282`; `dev/scratchpad/az-export-text.txt:9011-9012` |

## Hard questions Nova must verify at source

1. **`compacting` is truly never emitted.** Confirm `grep -rn "'compacting'" packages/agent-runtime/src common/src cli/src/state | grep -v test` yields **only** the type union at `common/src/types/session-state.ts:133`, and `grep -rn "'compacting'" cli/src | grep -v test` yields **only** the dead sidebar case at `right-sidebar.tsx:92`. If any emit site exists, A-01 is wrong.
2. **Pruner spawn writes no status.** Confirm `grep -n "compactionStatus" agents/savant/handle-steps.ts` → **0 matches**, and that the `while (true)` generator at `handle-steps.ts:128-158` re-yields the `spawn_agent_inline` every iteration while `contextTokenCount > maxContextLength * 0.8`.
3. **Threshold divergence is real.** Confirm `autoCompact = max(contextWindow − 30_000, 100_000)` (`context-compactor.ts:80`), `percentUsed = round(context/autoCompact × 100)` (`:189-190`), `maxContextLength = autoCompact + 30_000` (`loop-context.ts:279-280`), pruner spawn at `maxContextLength × 0.9`/`× 0.8` (`handle-steps.ts:133,147`), and the label `⚠ N% of auto threshold` (`right-sidebar.tsx:84`). For a 262k window the warning reads 100% at 232k while the pruner fires at 209.6k — confirm the arithmetic.
4. **Anti-thrash re-arm loop.** Confirm `scoreCompactionEffectiveness` (`context-compactor.ts:222-238`) records a failure when the post-pruner count stays over threshold, so the next step re-arms a fresh spawn — the "too aggressive" silent loop.
5. **Trust Matrix has no live writer besides events.** Confirm the only `provenance_receipt` emit sites are write receipts (`native.ts:681-700`) and verdict bindings (`spawn-agents.ts:275`, `spawn-agent-inline.ts:178`), and that `right-sidebar.tsx:276-284` mounts the panel only when `provenanceEvents.length > 0` — i.e., no timer/heartbeat feeds the matrix.
6. **Teacher terminal state.** Confirm `runtime.ts:237` sets `completionState` only on `event.type === 'result'`, `cancelTeacherExercise()` (`runtime.ts:275-282`) sets `'cancelled'` with **no** event push, and `right-sidebar.tsx:261-268` (mount `:261-262`, props `:263-268`) passes no `phase`/`completionState` to `LearnOverlay` (which re-derives both from events at `learn-overlay.tsx:44-49`).

## Adversarial checks already run in the FID's Perfection Loop

- The `compacting` absence scan must stay absence-shaped (exact `'compacting'` literal, non-test) — never a weak match promoted to PASS.
- The GREEN status writes must respect the **serialized-`handleSteps` constraint**: the generated source (`handle-steps.ts:78-160`) is `.toString()`/eval'd and must stay closure-free — the `compacting` write must be literal-only (the same pattern as the existing `maxContextLength`/`forceRatio` literals), while the pruner-result write lands at the non-serialized `parentAgentState` boundary in `spawn-agent-inline.ts:196-200` (confirmed reachable at source).
- The `compacted` phase is shared by micro-compact (`context-tokens.ts:212-216`) — the plan must split micro vs full-pruner outcomes so "✓ cleared −N tokens" cannot falsely imply a full summarization.
- No new store slice, no new polling cadence (reuse the 2s heartbeat), no control/write authority added to any sidebar surface.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
