# FID: Session cache-hit tracker in CLI sidebar

**Filename:** `FID-2026-1007-009-sidebar-cache-hit-tracker.md`
**ID:** FID-2026-1007-009
**Severity:** medium
**Status:** closed
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
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:bc3a3581194fb85c109ea69df07de8e587fe9138de1de1a0af4629ef77ca9daa
- verified: 2026-10-07T22:57:35.907Z
- test sdk/src/__tests__/cache-usage-presence.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/cache-session-telemetry.test.ts: exit 0
- test cli/src/components/__tests__/right-sidebar-cache.test.tsx: exit 0
- test packages/agent-runtime/src/util/__tests__/token-telemetry.test.ts: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

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

### Missed Questions

1. Does zero mean miss or unsupported? Preserve the provider field's presence at origin.
2. What does the percentage divide by? Eligible provider-reported input tokens in the defined recent window.
3. Does switching models reset history? Display the active route/model bucket; never blend unlike routes.
4.  Should cache savings be shown? No; provider-specific prices and bill accounting are not established by
   this telemetry.

### Loop 4 — implementation and the corrections it forced

- **RED:** The declared gate list was not declarable. `typecheck root` is
  rejected by `scripts/fid-verify.ts` (`unsafe typecheck workspace "root" — not
  in VALIDATION_WORKSPACE_POLICY`), because the permitted vocabulary is
  `typecheck <workspace>`. The list is corrected to the four workspaces this
  change actually touches — `common`, `sdk`, `cli`, `packages/agent-runtime` —
  and the receipt below is the machine's, not a hand-written claim. This is the
  same defect class T158 exists to catch: a record may only declare gates the
  executor admits.
- **GREEN:** Implemented as specified. The SDK emitter now reports
  `cachedInputTokensReported`; `isCachedTokenCountKnown` lets presence win and
  keeps the legacy `> 0` heuristic when no flag is present, so records that
  predate the flag behave exactly as before (its existing R3 pin still passes
  untouched). A new pure accumulator folds each completed usage into
  `agentState.cacheUsage`, weighted by input tokens, bucketed by provider route
  and model, with unreported / invalid / deduped observations accounted
  separately. The sidebar renders one always-present `Cache` row.
- **AUDIT (call graph):** `run-agent-step/step.ts:151-160` is the only
  production producer of `agentState.cacheUsage`, reached from the always-on
  `onUsage` callback that `createCacheDebugSetup` defines unconditionally
  (`cache-debug.ts:139-145`) — i.e. not behind `CACHE_DEBUG_FULL_LOGGING`, which
  is what the old monitor required. `cli/src/components/right-sidebar.tsx:120-
  123` is the only consumer, selecting
  `runState.sessionState.mainAgentState.cacheUsage`, and passes it into
  `SidebarSession` (`right-sidebar-sections.tsx`), which renders it through
  `formatCacheUsage` (`right-sidebar-format.ts`).
- **ADVERSARIAL:** Three things are recorded rather than smoothed over. (1)
  Adding a field to `AgentState` is not a free edit: the exhaustive
  classification gate in `tools/handlers/tool/spawn-child-fields.ts` failed
  `typecheck` with `Type 'string' does not satisfy the constraint 'never'`
  until `cacheUsage` was classified, and it is classified as
  **not inherited by design** — a child folds its own stream, exactly like
  `lastProviderUsage`. (2) `common/src/types/session-state-agent-state.ts`
  already sat at the 300-line ceiling the quality gate enforces, so the summary
  type lives in its own module (`session-state-cache-usage.ts`) and this file
  needed one line freed for the import; the `@deprecated` marker on `agentId`
  was compacted to one line to pay for it, which loses no information. A
  re-export from the agent-state module was **not** added for the same reason —
  consumers import the new module path directly. (3) The row states
  *reported* reuse on one route and makes no pricing claim; the token
  accounting shape is normalized per provider at the point where presence is
  read, so a provider that counts cached tokens inside `inputTokens` still
  yields a well-formed ratio, but the two conventions are not reconciled into a
  single billing model.
- **CHANGE DELTA:** Gate list corrected from a non-declarable `typecheck root`
  to four workspace typechecks; the presence flag threaded instead of inferring
  support from a model name; the sidebar reads the existing run snapshot rather
  than gaining a second store slice.

### Code Verification Evidence

- [x] Files referenced exist, verified by read:
      `common/src/types/session-state-cache-usage.ts`,
      `common/src/types/session-state-agent-state.ts`,
      `common/src/types/contracts/llm.ts`, `sdk/src/impl/llm/usage.ts`,
      `packages/agent-runtime/src/util/cache-session-telemetry.ts`,
      `packages/agent-runtime/src/util/token-telemetry.ts`,
      `packages/agent-runtime/src/run-agent-step/step.ts`,
      `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts`,
      `cli/src/components/right-sidebar.tsx`,
      `cli/src/components/right-sidebar-sections.tsx`,
      `cli/src/components/right-sidebar-format.ts`
- [x] The failure output is pasted from the actual command, with its exit
      status: the non-declarable gate is the executor's own message, and the
      reverts below are the test runner's
- [x] The RED is reproduced rather than asserted: checking the two seam files
      (`packages/agent-runtime/src/util/token-telemetry.ts` and
      `sdk/src/impl/llm/usage.ts`) out to their pre-fix revisions fails the new
      pins — `9 pass / 1 fail` at the R3 seam and `1 pass / 3 fail` at the SDK
      boundary — and restoring them returns 10 pass and 4 pass
- [x] The received value is traced: the sidebar's `0%`/`Not reported` split is
      decided by `isCachedTokenCountKnown`, which reads the flag the emitter at
      `sdk/src/impl/llm/usage.ts:172-176` now sets from the provider's own field
- [x] Production call-graph evidence: the producer
      (`run-agent-step/step.ts:151-160`) and the single consumer
      (`cli/src/components/right-sidebar.tsx:120-123`) are both named above,
      and the accumulator has no module scope for one chat to leak into another
- [x] The wider suites agree: sdk 597 pass / 0 fail, agent-runtime 1914 pass /
      0 fail, cli 3975 pass / 0 fail, with `bun run typecheck`,
      `bun x eslint . --max-warnings 0`, `bun x prettier --check .`,
      `bun run lint:md` and `quality:report` all exit 0
- [x] FID status reflects reality (`closed`: implemented, the four test gates
      and four workspace typechecks receipted, the gate-list correction and the
      two ceiling-driven decisions recorded rather than left implicit)

## Resolution

- **Closed Date:** 2026-10-07.
- **Fix Description:** Reported provider cache reuse now reaches the CLI
  sidebar truthfully. Presence is carried from the provider field through the
  SDK normalization boundary, a pure always-on accumulator folds it into
  `agentState.cacheUsage` keyed by route and model, and the Session section
  renders `—` / `Not reported` / `N%` for the three meaningfully different
  states, with the token sample and a visible count of rejected samples.
  Implementation commits `8c528f12` and `07fbbbd9`.
- **Tests Added:** `sdk/src/__tests__/cache-usage-presence.test.ts` (4 pins at
  the normalization boundary),
  `packages/agent-runtime/src/util/__tests__/cache-session-telemetry.test.ts`
  (8 pins: weighting, reported zero, unreported, invalid, route/model switch,
  dedupe, unknown-id bucket),
  `cli/src/components/__tests__/right-sidebar-cache.test.tsx` (6 pins,
  including the run-snapshot propagation path), plus one new pin in
  `token-telemetry.test.ts`.
- **Verification Evidence:** The declared gates below, receipted by
  `fid:verify`; the wider suites and repository gates listed in the evidence
  section.
- **Archived:** 2026-10-07 →
  `dev/fids/archive/FID-2026-1007-009-sidebar-cache-hit-tracker.md`.
