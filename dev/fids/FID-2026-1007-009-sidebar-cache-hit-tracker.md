# FID: Session cache-hit tracker in CLI sidebar

**Filename:** `FID-2026-1007-009-sidebar-cache-hit-tracker.md`
**ID:** FID-2026-1007-009
**Severity:** medium
**Status:** converged
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

The CLI sidebar does not show provider cache hits, even though the SDK emits usage and the runtime has a
`CacheHitRateMonitor`. Wire real, model-attributed usage into session state and render a truthful cache row
with an explicit unavailable state. This is an observability feature; it must not change provider calls or
quote speculative dollar savings.

## Environment and evidence

-  `sdk/src/impl/llm/usage.ts:157-177` converts absent `cachedInputTokens` to zero when emitting
  `CacheDebugUsageData`, losing the difference between unreported and a reported cache miss.
-  `packages/agent-runtime/src/util/token-telemetry.ts:55-57` treats only values greater than zero as known,
  so a real reported zero is also discarded.
-  `packages/agent-runtime/src/run-agent-step/cache-debug.ts:127,147-158` constructs a monitor for each step
  and feeds it only after `cacheDebugCorrelation` exists; that correlation is enabled by
  `CACHE_DEBUG_FULL_LOGGING` at line 80. Ordinary runs stamp `lastProviderUsage` through the callback but
  never accumulate a visible session ratio.
-  `packages/agent-runtime/src/run-agent-step/step.ts:137-141` stamps only input tokens and capture time.
  `common/src/types/session-state-agent-state.ts:144` stores that shape.
-  `cli/src/components/right-sidebar-sections.tsx:167-228` renders Session rows for context and compaction but
  no cache row. Search `rg -l 'CacheHitRateMonitor|cacheHitRate|cachedInputTokens|token-telemetry' cli/src`
  found no CLI consumer.
-  Existing token telemetry's hard-coded price estimates are not verified per provider. The sidebar must not
  display them as savings.

## Problem and expected behavior

Users cannot tell whether a selected model reports cache reuse. A zero shown for a provider that omitted cache
metadata would be misleading; combining usage from different models or routes would be misleading too. The row
should distinguish `unreported`, `reported 0`, and `reported positive`, and should update after completed
turns with a clear denominator.

## Proposed solution

1.  Preserve cache-field presence at the SDK normalization boundary. Use an optional cached-token count or an
   explicit report-presence flag through `CacheDebugUsageData`; ensure a provider-reported `0` stays known and
   omitted data stays unknown. Audit provider adapters that populate usage, including OpenAI-compatible and
   Anthropic forms; do not infer support from a model name alone.
2.  Aggregate at the owning session/run state from every completed provider usage callback, independent of
   debug snapshot logging. Use input-token-weighted `sum(cached input tokens) / sum(eligible input tokens)`
   for a fixed recent-turn window, with numerator and denominator shown or available for verification. Exclude
   unreported records from the ratio and track their count. Reject invalid/negative counts and clamp
   impossible cached-over-input records as invalid rather than silently treating them as success.
3.  Key the aggregate by actual provider route and model ID. Reset or switch to the corresponding bucket when
   `/model` or provider changes; never mix child-agent traffic with the owning chat's row unless attribution
   is explicit. Avoid duplicate counting on retries, replay, stream re-finalization, or session restore.
4.  Carry a small serializable cache summary across the runtime → SDK snapshot → CLI chat state path. Render a
   `Cache` Session row in the right sidebar: `—` or `Not reported` before valid data, `0%` for a known zero,
   otherwise rounded percentage with sample/eligible token context. Respect narrow sidebar layout and update
   on turn completion. No debug mode prerequisite and no pricing claim.
5.  Add source-to-sidebar integration coverage and focused edge-case tests; preserve current cache debug logs
   as diagnostic opt-in. Keep all raw prompts and provider credentials out of persisted metrics.

## Verification plan and gates

-  Add `sdk/src/__tests__/cache-usage-presence.test.ts` for reported zero versus missing cache fields at the
  normalization boundary.
-  Add `packages/agent-runtime/src/util/__tests__/cache-session-telemetry.test.ts` for weighted aggregation,
  mixed model routes, unknown/invalid records, retries, and restore behavior.
-  Add `cli/src/components/__tests__/right-sidebar-cache.test.tsx` for unavailable, zero, positive, model
  switch, and narrow rendering; include a production state propagation assertion rather than a prop-only
  snapshot.
-  Re-run `packages/agent-runtime/src/util/__tests__/token-telemetry.test.ts` and relevant SDK/CLI suites from
  their workspace roots. Run root typecheck, lint, Markdown lint, and quality gate before receipt stamping.
  Capture actual file:line call graph and tool output at implementation audit.

## Verification Gates

- gate: test sdk/src/__tests__/cache-usage-presence.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/cache-session-telemetry.test.ts
- gate: test cli/src/components/__tests__/right-sidebar-cache.test.tsx
- gate: test packages/agent-runtime/src/util/__tests__/token-telemetry.test.ts
- gate: typecheck root
- gate: quality

## Perfection Loop

### Loop 1 — RED, GREEN, AUDIT, ADVERSARIAL

-  **RED:** Missing SDK cache data becomes zero; real zero is treated as unknown; monitor is per-step and
  debug-gated; sidebar has no consumer.
- **GREEN:** Specified tri-state reporting, always-on aggregation, state transport, and truthful sidebar rendering.
- **AUDIT:** The evidence lines above locate each break in the production path. No UI or runtime change is claimed yet.
-  **ADVERSARIAL:** A simple mean of per-turn percentages would overweight tiny calls. Input-token-weighted
  ratio and explicit eligible denominator avoid that error.
- **CHANGE DELTA:** Initial design with denominator correction.

### Loop 2 — independent challenge and correction

-  **RED:** Retries, model switches, and child agents could contaminate a session value; a debug-only callback
  could make the UI appear stale.
-  **GREEN:** Specify one accounting event per completed physical usage, route/model buckets, owning-chat
  attribution, and no debug dependency.
- **AUDIT:** Edge cases are named in test plan and gates.
-  **ADVERSARIAL:** Some adapters may synthesize zero; presence must be audited at adapter origin rather than
  inferred downstream.
- **CHANGE DELTA:** Added attribution and source-presence requirements.

### Loop 3 — final convergence

- **RED:** Provider usage semantics may count cached tokens inside or outside `inputTokens` differently.
-  **GREEN:** Normalize each adapter against its documented accounting shape and make eligibility explicit;
  invalid totals are unavailable, not zero.
- **AUDIT:** Every promised test file appears as a gate. Status is pre-implementation `converged`.
-  **ADVERSARIAL:** A UI percentage will only describe reported usage for the active route and window, not a
  guaranteed bill discount.
- **CHANGE DELTA:** Final semantics and gate alignment.

### Missed questions

1. Does zero mean miss or unsupported? Preserve the provider field's presence at origin.
2. What does the percentage divide by? Eligible provider-reported input tokens in the defined recent window.
3. Does switching models reset history? Display the active route/model bucket; never blend unlike routes.
4.  Should cache savings be shown? No; provider-specific prices and bill accounting are not established by
   this telemetry.

## Resolution

Open. This FID specifies the work and verification; no implementation or sidebar behavior is claimed.
