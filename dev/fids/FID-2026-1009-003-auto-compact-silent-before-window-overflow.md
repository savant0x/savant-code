# FID: Auto-compact does not fire before the context window overflows

**Filename:** FID-2026-1009-003-auto-compact-silent-before-window-overflow.md
**ID:** FID-2026-1009-003
**Severity:** high
**Status:** verified
**Created:** 2026-10-09
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

In a long session the run hard-fails with
`RequestInputBudgetError: Request input estimate 1004611 leaves no output
headroom within the 1000000 token context window`
(`sdk/src/impl/model-provider/request-budget-policy.ts`). Auto-compact never
fired before the wall; a manual `/compact` recovered the session. The
compaction trigger chain evaluates `agentState.contextTokenCount` at every
step, and that count can be silently zeroed or stale, disabling every trigger
while the true request grows past the window. One root cause is already fixed
by FID-2026-1009-002 Layer 3 (uncommitted); three residual failure modes
remain.

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint` (`--max-warnings 0`)
- **Commit/State:** follows FID-2026-1009-001 + FID-2026-1009-002 (combined
  commit pending operator G2)

## Detailed Description

### Problem

Operator report (2026-10-09): "auto compact is not firing, i ran a long
session randomly started getting this error … Request input estimate 1004611
leaves no output headroom within the 1000000 token context window … i then
compacted and it fixed it's self."

The safety architecture for a 1M-token window (all values derived below):

- proactive auto-compact trigger: `resolveTriggerThreshold(1M, 0.8)` = **800k**
- force-compact trigger: count > window − `forceCompactOffset` (15k) = **985k**
- reactive-compact (window itself): **1M**
- budget-policy hard wall: window − reserve (min(4096, 1% of window)) =
  **~995,904** — throws `RequestInputBudgetError`

The failing estimate (1,004,611) sits **8,707 tokens past the wall**, so at
dispatch time no trigger had seen a count ≥ 985k. Either the count was
invalid, or it lagged the true request size.

### Root Cause

**PRIMARY — `reconcileTokenCount` accepts a 0/undefined provider usage as
truth (fixed by FID-2026-1009-002 Layer 3, uncommitted).**
`packages/agent-runtime/src/run-agent-step/step.ts` stamps
`agentState.lastProviderUsage = { inputTokens: usage.inputTokens, capturedAt: Date.now() }`
from the stream `onUsage`, and the upstream usage shape is
`inputTokens?: number`
(`packages/agent-runtime/src/provider-boundary/identity-observation.ts`).
The OLD `reconcileTokenCount` set
`choseProviderUsage = Boolean(usage && usage.capturedAt > lastCompactionAt)`
with no value check, so a provider usage reporting `inputTokens: 0` or an
unset value made `agentState.contextTokenCount = 0` (or `undefined`). With
the count zeroed, every trigger evaluates false for the rest of the run:
`shouldAutoCompact(history, 0)` → `0 >= autoCompact` false →
`autoCompactDue` never set; `count > compactTrigger` false; `forceDue`
false. The session silently never compacts until the budget policy throws.
FID-2026-1009-002 Layer 3 (positivity guard: provider truth wins only when
`typeof inputTokens === 'number' && inputTokens > 0`, else the local estimate
stands) fixes this variant — it is implemented, tested, and receipt-stamped,
but **uncommitted**, so the operator's running build may not include it.

**RESIDUAL R1 — the budget policy hard-throws instead of triggering
compaction.** `budgetModelRequest`
(`sdk/src/impl/model-provider/request-budget-policy.ts`) knows the true
next-request size (`countRequestInputTokens` over the final SDK prompt —
messages + tools + per-message overhead, same `countTokens` base as the
runtime estimator) but has no path to request compaction; it throws and the
run dies. When the internal count underestimates the true request — e.g. the
count is the provider-reported `inputTokens` of the LAST completed request
while the next request adds a large tool result — the request is dispatched
over the wall with no trigger evaluation in between.

**RESIDUAL R2 — the force-compact margin is small relative to single-step
growth.** `forceCompactOffset` is 15k
(`protocol.config.yaml` → `compression.forceCompactOffset`; mirrored in the
savant handleSteps generator). `contextTokenCount` is recomputed once per
step (`prepareStepContext`), but a single large tool result can add more than
15k between the last count and the next dispatch, jumping from below 985k to
past the wall.

**RESIDUAL R3 — the escalation hold blocks proactive compaction when the
pruner is ineffective.** After two judged-ineffective proactive passes the
savant handleSteps generator arms `escalationHold` and suppresses proactive
spawns until the count grows ≥ 5% past the held baseline; only `forceDue`
(985k) remains. If the pruner cannot fold the session's content (huge tool
results, non-foldable evidence), the system oscillates between hold and
force, and the force margin (R2) can be jumped before it fires.

### Expected Behavior

Before any request can exceed the window, compaction has fired: the
proactive trigger (800k) compacts early; the force trigger (985k) compacts
under any hold; and a request that would still overflow triggers a forced
compaction-and-retry instead of a hard failure.

### Evidence

- `sdk/src/impl/model-provider/request-budget-policy.ts` —
  `budgetModelRequest`: `headroom = contextWindow - inputTokens - reserve`;
  `if (headroom < 1) throw new RequestInputBudgetError(...)`; reserve =
  `Math.min(4096, ceil(contextWindow * 0.01))`. The operator's trace
  (`request-budget-policy.ts:86` ← `request-budget.ts:76`
  `dispatchBudgetedRequest`) is this first budget check — the throw happens
  BEFORE dispatch, with no retry path (`correctRejectedBudget` only handles
  provider-side rejections, not our own throw).
- `sdk/src/impl/model-provider/request-token-count.ts` —
  `countRequestInputTokens`: counts the final SDK prompt (per-message
  overhead, text/reasoning/tool-call/tool-result/file parts, tools JSON,
  responseFormat) with the same `countTokens` base as the runtime estimator.
- `packages/agent-runtime/src/context-compactor/state.ts` —
  `resolveTriggerThreshold(W, ratio) = floor(clamp(W × ratio, 100k, W − 30k))`;
  for W=1M: **800k**. `AUTO_COMPACT_BUFFER = 30_000`,
  `MIN_TRIGGER_TOKENS = 100_000`.
- `cli/src/agents/bundled-agents.generated-data/32-savant.ts` (savant
  handleSteps) — `compactTrigger = computeTriggerThreshold(maxContextLength, 0.8)`;
  `forceDue = agentState.contextTokenCount > maxContextLength - forceCompactOffset`
  (15k); `proactiveDue = (autoCompactDue || count > compactTrigger) && !escalationHold`;
  `prunerCooldownMs = 30_000`; escalation ladder (stage 2 → hold until
  `count >= holdBaseline * 1.05`); force path bypasses the hold and cooldown.
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts` —
  `prepareStepContext` writes `agentState.contextTokenCount` (estimator) then
  `reconcileTokenCount` (provider usage wins when fresh); `autoCompactCheck =
  contextCompactor.shouldAutoCompact(history, count)`.
- `packages/agent-runtime/src/context-compactor.ts` — `shouldAutoCompact`:
  `percentUsed = count / thresholds.autoCompact * 100`; compacts when
  `count >= thresholds.autoCompact`.
- `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts` —
  pre-FID-002 `choseProviderUsage` had no value check (the PRIMARY cause);
  the FID-2026-1009-002 Layer 3 guard
  (`typeof usage?.inputTokens === 'number' && usage.inputTokens > 0`) is the
  fix, with 3 regression pins in
  `packages/agent-runtime/src/__tests__/reconcile-token-count.test.ts`.
- `packages/agent-runtime/src/run-agent-step/step.ts` — `onUsage` stamps
  `lastProviderUsage = { inputTokens: usage.inputTokens, capturedAt }`.
- `packages/agent-runtime/src/provider-boundary/identity-observation.ts` —
  upstream usage shape `inputTokens?: number` (optional; 0/unset possible).
- Symptom consistency: manual `/compact` recovered the session because the
  manual path forces the pruner (`force: true`, `keepRecentTokens: 16384`,
  compact-and-stop) regardless of the automatic gates — proving the pruner
  CAN compact this session and the automatic trigger chain was the blocker.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`
  (PRIMARY — fixed by FID-2026-1009-002 Layer 3)
- `sdk/src/impl/model-provider/request-budget-policy.ts` +
  `request-budget.ts` (R1 — hard-throw with no compaction seam)
- `common/src/util/protocol-config.ts` /
  `protocol.config.yaml` compression block (R2 — forceCompactOffset margin)
- `cli/src/agents/bundled-agents.generated-data/32-savant.ts` +
  `agents/savant/handle-steps.ts` (R2/R3 — trigger evaluation, escalation
  hold; regenerating the bundled copy after any handle-steps change)

### Risk Level

- [x] High: the run hard-fails mid-session with a hard error; workaround
      exists (manual `/compact`) but every long session risks hitting it;
      proactive compaction is silently disabled whenever the count is
      invalid.

## Proposed Solution

### Approach

Four layers (operator-approved 2026-10-09):

1. **L1 — DONE (FID-2026-1009-002 Layer 3):** the reconcile positivity guard
   fixes the PRIMARY cause — the count can no longer be zeroed by a 0/unset
   provider usage, so every trigger evaluates a real number. Verify this is
   in the operator's build after the combined commit.
2. **L2 — budget-aware overflow (SDK):** when `budgetModelRequest` would
   throw `RequestInputBudgetError`, do not hard-fail — expose an overflow
   seam (e.g. an `onContextOverflow` option on `withRequestTokenBudget`)
   that the runtime wires to a forced context-pruner spawn + one retry.
   Failing the run stays the fallback when no seam is wired.
3. **L3 — margin calibration:** make `forceCompactOffset` proportional to
   the window (e.g. `max(15k, 2% of window)` = 20k at 1M) so a single large
   tool result cannot jump the force margin; and/or evaluate `forceDue`
   against the budget policy's true-request estimate rather than only the
   internal count.
4. **L4 — escalation-hold release near the force margin:** when the count is
   within the force margin, bypass `escalationHold` (the hold exists to
   avoid wasteful respawns; near the wall, a forced attempt is always
   cheaper than a hard failure).

### Steps

1. Verify L1 in the operator's build (post-commit rebuild + a long-session
   run).
2. L2: add the overflow seam to `request-budget.ts` /
   `request-budget-policy.ts`; wire the runtime side (forced pruner spawn +
   retry-once contract); tests for both the wired and unwired paths.
3. L3: proportional `forceCompactOffset` in the config + the handleSteps
   mirror; regenerate bundled agents; parity test update.
4. L4: hold-bypass condition in the handleSteps generator + regeneration.
5. Full gate set.

### Verification

L1 is already gate-verified under FID-2026-1009-002 (its 7-gate receipt
covers the reconcile positivity guard). L2-L4 are gate-verified by this
record's receipt below.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck sdk
- gate: typecheck agents
- gate: test sdk/src/impl/model-provider/__tests__/request-overflow-recovery.test.ts
- gate: test agents/__tests__/handle-steps-force-margin.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:da6b0187ef27da22a83565915fd23e175549f3b99e03ca18c3fe7e4281841ea3
- verified: 2026-10-09T17:13:32.466Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck sdk: exit 0
- typecheck agents: exit 0
- test sdk/src/impl/model-provider/__tests__/request-overflow-recovery.test.ts: exit 0
- test agents/__tests__/handle-steps-force-margin.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) PRIMARY — `reconcileTokenCount` accepts a 0/undefined
  provider usage as truth, zeroing the count and silently disabling every
  compaction trigger (fixed by FID-2026-1009-002 Layer 3, uncommitted).
  (2) R1 — the budget policy hard-throws at the true request size with no
  compaction-and-retry path. (3) R2 — the 15k force margin can be jumped by
  a single large tool result between count updates. (4) R3 — the escalation
  hold blocks proactive compaction when the pruner is ineffective, leaving
  only the (jumpable) force margin.
- **GREEN:** pending operator approval of L2-L4 (L1 already implemented
  under FID-2026-1009-002).
- **AUDIT:** pending.
- **ADVERSARIAL:** Would L2's retry loop risk infinite compaction? No —
  exactly one retry per dispatch; the pruner either reduces the count or the
  original error is rethrown. Does L3's wider margin compact too eagerly?
  It compacts earlier (20k vs 15k before the wall) — strictly safer, and the
  proactive trigger (800k) still fires first in the normal case. Does L4
  bypassing the hold defeat the anti-thrash design? Only within the force
  margin, where a failed compaction is still cheaper than a hard failure;
  the force path already bypasses the hold by design.
- **CHANGE DELTA:** n/a (analyzed, not implemented)

### Loop 2 — implementation pass (2026-10-09, operator-approved L2-L4)

- **GREEN (L2):** `request-budget-policy.ts` gains `trimPromptToFit` —
  drop the oldest non-system turns until the re-estimated input fits with
  headroom (system and the final current turn always kept; byte-for-byte
  prompt reuse when the prompt already fits; null when even the minimal
  prompt cannot fit) — and `RequestInputBudgetError` gains
  `inputTokens`/`contextWindow` fields. `request-budget.ts` gains
  `budgetOrRecover`: on a budget throw it invokes the host seam (a
  throwing seam is logged and never blocks recovery), trims, and retries
  exactly once; a prompt that cannot fit even trimmed rethrows the
  original error. The seam is threaded through `types.ts`
  (`ModelRequestParams.onContextOverflow`), `apply-request-budget.ts`, and
  the runtime: `step.ts` passes a callback that arms
  `agentState.autoCompactDue` (so the handleSteps generator's next trigger
  evaluation force-compacts the shared session state),
  `prompt-agent-stream.ts` and `stream-request-setup.ts` forward it, and
  the `PromptAiSdkStreamFn` contract type carries it. The n-parameter path
  keeps the unwired trim-recovery fallback.
- **GREEN (L3):** `handle-steps-template-body-b.ts` computes
  `forceMargin = Math.max(forceCompactOffset,
  Math.floor(maxContextLength * 0.02))` — 20k at 1M, the configured 15k
  floor preserved at small windows — and `forceDue` reads the
  proportional margin. Bundled agents regenerated (13 generated files).
- **GREEN (L4):** the force path resets the escalation ladder
  (`escalationStage = 0; holdBaselineCount = 0`). A forced compaction
  drops the count far below the held baseline, so the hold release (count
  ≥ baseline × 1.05) can never re-cross it and proactive passes would
  stay blocked for the rest of the session.
- **AUDIT:** pending.
- **ADVERSARIAL:** Would L2's retry loop risk infinite compaction? No —
  exactly one retry per dispatch; the pruner either reduces the count or
  the original error is rethrown. Does L3's wider margin compact too
  eagerly? It compacts 5k earlier (20k vs 15k before the wall) — strictly
  safer; the proactive trigger (800k) still fires first in the normal
  case. Does L4 resetting the ladder defeat the anti-thrash design? Only
  on the force path, where a failed compaction is still cheaper than a
  hard failure; the force path already bypassed the hold by design.

### Missed Questions

1. **Why didn't the proactive trigger (800k) fire ~200k before the wall?**
   With a valid count it would — the session reaching 1,004,611 implies the
   count was invalid (PRIMARY) or held by R3 with the force margin jumped
   (R2). Both are covered by L1 + L3/L4.
2. **Is the provider's `inputTokens` ever legitimately 0?** A real LLM
   request always has input tokens (there is always a prompt). 0/unset is
   "no reading" — the same conclusion as FID-2026-1009-002's reconcile
   guard.
3. **Could the budget estimate diverge from the runtime estimator enough to
   matter on its own?** Both count with the same `countTokens` base; the
   budget adds per-message overhead and counts the final materialized
   prompt. At 1M scale a small divergence is possible, which L3's wider
   margin absorbs; the primary failure is the invalid count, not the
   divergence.

## Resolution

- **Closed Date:** pending
- **Fix Description:** verified (L2-L4; L1 under FID-2026-1009-002)
- **Tests Added:**
  `sdk/src/impl/model-provider/__tests__/request-overflow-recovery.test.ts`
  (6 pins: a wired seam is invoked with the overflow facts, then the
  oldest turns are trimmed and the request retries once; without a wired
  seam the trim recovery still retries once; a throwing seam is swallowed
  and never blocks recovery; the stream path recovers identically; a
  request that fits never invokes the seam and dispatches the prompt
  unchanged; an untrimmable overflow invokes the seam once and rethrows
  the original error) and
  `agents/__tests__/handle-steps-force-margin.test.ts` (3 pins: a 1M
  window force-compacts inside the old 15k margin band; the 15k floor
  governs a 200k window below and at the boundary; a forced pass resets
  the escalation ladder so proactive compaction resumes).
- **Verification Evidence:** 26/26 tests across the five touched/adjacent
  suites (6 new SDK, 3 new generator, 10 existing budget, 4 existing
  compact-interceptor, 3 threshold-parity), typecheck ×4 (common,
  packages/agent-runtime, sdk, agents), eslint clean on all touched
  files, prettier clean.
- **Archived:** pending

### Code Verification Evidence

Status is `verified` — L2-L4 implemented and gate-verified by this record's
receipt; L1 (the reconcile positivity guard) is gate-verified under
FID-2026-1009-002's receipt (uncommitted, pending the operator's combined
G2 commit). Closure waits for the combined commit per G2.