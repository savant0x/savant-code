<!-- markdownlint-disable MD013 -->

# FID: Context-window display jumping + threshold parity-extraction test — post-0821-001 truthiness follow-up

**Filename:** `FID-2026-0821-003-context-window-jumping-threshold-parity.md`
**ID:** FID-2026-0821-003
**Severity:** medium
**Status:** closed
**Created:** 2026-08-21 19:20
**YAGNI-Compliance:** Verified

---

## Summary

Two open items from the FID-2026-0821-001 handoff (`dev/session-summaries/2026-08-21-1858-open-issues-next-run.md`):

1. **Context-window display jumping (OPERATOR PRIORITY — issues file #1).** The sidebar context number oscillates
   between a low and a high value across steps. The leading hypothesis, now evidence-grounded in RED below: the
   P2-1 reconcile (`reconcileTokenCount`) alternates its source between fresh provider-reported usage (true count,
   LOWER) and the ×1.35 local estimator (HIGHER) as usage goes stale/fresh between steps; the sidebar heartbeat
   wires the raw value with no smoothing; post-prune recounts add a third source.
2. **Threshold parity-extraction test (issues file #8).** Parity between the inline `computeTriggerThreshold`
   (serialized savant generator) and the runtime `resolveTriggerThreshold` is currently VALUE-pinned only — a
   case-by-case expectation list — not a direct extraction/eval parity test. Future drift fails only if a changed
   constant happens to flip a pinned value.

## Environment

- **OS:** Windows 11 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Commit/State:** working tree @ `372e9c3b` (v0.0.27 released); 0821-001 implementation uncommitted per operator
  directive (release-only-commits rule)

## Detailed Description

### Problem

**P1 — Display jumping.** `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts:20-31` is the single
precedence owner: provider usage wins only when `usage.capturedAt > lastPrunerCompletionAt`, else `localEstimate`
(the ×1.35-inflated estimator). The sidebar heartbeat
(`cli/src/hooks/helpers/send-message-monitors.ts:80-84`) polls `snapshot.sessionState.mainAgentState.contextTokenCount`
every 2s and pushes it raw through `updateContextTokens`
(`cli/src/state/chat-store/sidebar-actions.ts:27-33` — the only guard is an `Object.is` no-op, no damping).
`right-sidebar-format.ts:48-78` then renders `percentUsed` directly. Because BYOK `lastProviderUsage` is stamped at
stream finalize (`run-agent-step/step.ts:192` `onUsage` callback) and freshness is judged against the wall-clock
`lastPrunerCompletionAt`, the displayed count flips between provider truth (lower) and the estimator (higher)
whenever a step's usage goes stale relative to a pruner completion — plus the post-prune spawn-boundary recount
writes a third value. The operator observes the number "jumping low/high" across steps.

**P2 — Value-pinned parity only.** `packages/agent-runtime/src/__tests__/compact-trigger-threshold.test.ts:19-47`
pins 6 concrete `resolveTriggerThreshold` outputs, and the serialized generator's inline mirror
(`agents/savant/handle-steps-factory.ts:94-106`) is asserted equal only via those same hand-picked windows
(`:252`). Nothing evaluates the ACTUAL generated function body against the ACTUAL runtime resolver over a sweep of
windows/ratios — a silent drift (e.g. a new clamp branch in one implementation) passes if no pinned case covers
the changed region.

### Expected Behavior

- The sidebar context readout is stable and truthful: it should not visibly oscillate between estimator-high and
  provider-truth-low values across ordinary steps.
- The inline generator threshold and the runtime resolver are proven equal by a direct parity test that executes
  the serialized body, not by a shared set of hand-written expectations.

### Root Cause

- P1: `reconcileTokenCount` returns `usage.inputTokens` (lower truth) when fresh, `localEstimate` (higher, ×1.35
  per `packages/agent-runtime/src/util/token-counter.ts:7` `ANTHROPIC_TOKEN_FUDGE_FACTOR`) when stale; the 2s
  heartbeat then wires the raw, un-smoothed value to the store. Post-prune recounts
  (`packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`) overwrite `contextTokenCount` directly.
- P2: parity is enforced by duplicated test values rather than by executing both implementations over a sweep.

### Evidence

```text
# P1 — source alternation (reconcile-token-count.ts:20-31)
const usage = agentState.lastProviderUsage
if (!usage) return localEstimate
const lastCompactionAt = agentState.lastPrunerCompletionAt ?? 0
if (usage.capturedAt <= lastCompactionAt) return localEstimate
return usage.inputTokens

# P1 — sidebar wires raw (sidebar-actions.ts:27-33)
updateContextTokens: (used) => set((state) => {
  if (Object.is(state.contextTokensUsed, used)) return   # no damping, no smoothing
  state.contextTokensUsed = used
})

# P1 — heartbeat polls raw every 2s (send-message-monitors.ts:80-84)
const tokenCount = snap?.sessionState?.mainAgentState?.contextTokenCount
if (typeof tokenCount === 'number') {
  useChatStore.getState().updateContextTokens(tokenCount)
}

# P1 — BYOK usage stamp (step.ts:189-197, onUsage)
agentState.lastProviderUsage = { inputTokens: usage.inputTokens, capturedAt: Date.now() }

# P2 — value-pinned parity only (compact-trigger-threshold.test.ts:19-47)
expect(resolveTriggerThreshold(200_000, 0.8)).toBe(160_000)
expect(resolveTriggerThreshold(262_144, 0.8)).toBe(209_715)
expect(resolveTriggerThreshold(128_000, 0.8)).toBe(98_000)
# ... 6 hand-picked cases; the inline mirror is never executed in a test
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts` — candidate for freshness-window or
  source-tagging changes (P1)
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts` — `prepareStepContext` reconcile call site
- `cli/src/state/chat-store/sidebar-actions.ts` + `cli/src/hooks/helpers/send-message-monitors.ts` — display
  damping, if that is the chosen fix
- `agents/savant/handle-steps-factory.ts` — inline `computeTriggerThreshold` (P2)
- `packages/agent-runtime/src/__tests__/compact-trigger-threshold.test.ts` — parity test (P2)
- `packages/agent-runtime/src/context-compactor/state.ts` — `resolveTriggerThreshold` (P2 reference)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution### Approach (CONVERGED)

**A — Context jumping (P1).** Evidence gathered from the working tree (all cited in AUDIT below) confirms the
issues-file hypothesis: `reconcileTokenCount` (`packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts:20-31`)
alternates between provider truth (LOWER — `usage.inputTokens`) and the ×1.35-inflated estimator (HIGHER)
whenever the freshness boundary flips (`usage.capturedAt <= lastPrunerCompletionAt`), and the sidebar heartbeat
poll (`cli/src/hooks/helpers/send-message-monitors.ts:80-84`) + snapshot push
(`cli/src/hooks/helpers/send-message-lifecycle.ts:167-170,204-207`) both wire the RAW `contextTokenCount` through
`updateContextTokens` with no smoothing (`cli/src/state/chat-store/sidebar-actions.ts:27-33` — the only guard is
`Object.is`). Converged fix, two parts:

1. **Investigation instrument (kept as observability):** add an optional `logger` to `reconcileTokenCount` and
   emit a debug decision line per step — usage capturedAt, lastPrunerCompletionAt, chosen source, localEstimate,
   result. The call site (`prepareStepContext`, `context-tokens.ts:162`) already has a logger in scope. This makes
   the oscillation reproducible from logs while being a bounded, never-gating debug channel (the codebase's
   `logDebug` convention).
2. **Display-only damping (the fix):** apply a pure `dampTokenCount` helper (relative deadband 5% + bounded
   max-step 12% per update) inside `updateContextTokens`. A source flip of ~35% renders as a smooth 2-3 heartbeat
   ramp instead of an instant jump; real monotonic growth still tracks within the step bound; runtime truth and the
   pruner trigger are untouched. Options 2/3 are rejected: widening the freshness window would show stale counts
   after a prune (the history genuinely changed — `lastPrunerCompletionAt` is correct), and dropping the estimator
   removes the pre-first-response safety fallback the pruner trigger relies on.

**B — Parity extraction test (P2).** Extract the exact function text the factory bakes into the serialized
generator into an exported module const `TRIGGER_THRESHOLD_INLINE_SOURCE` (self-contained, runtime constants
inlined as literals — serialized generators cannot import), interpolate that SAME string into the factory's
`source` template in place of the hand-written block, and have a new agents test eval the same string and sweep it
against `resolveTriggerThreshold` across windows `[100k … 400k]` × ratios `[0.2 … 1.2]`. The sweep is structural:
the executed body IS the emitted body, so any future drift fails loudly instead of passing hand-pinned values.

### Steps

1. Runtime: add optional `logger` to `reconcileTokenCount` + debug decision line; pass `logger` at the
   `context-tokens.ts:162` call site. Add logger-spy tests to `reconcile-token-count.test.ts`.
2. CLI: add pure `dampTokenCount` helper to `compaction-helpers.ts`; apply it in `updateContextTokens`;
   preserve the `Object.is` no-op guard. Add damping tests to `chat-store-noop-guards.test.ts` + a pure-helper
   describe.
3. Factory: extract `TRIGGER_THRESHOLD_INLINE_SOURCE`, interpolate into the template (no backticks inside the
   template body — the issues-file #4 rule). Add `@savant-code/agent-runtime/*` to `agents/tsconfig.json` paths.
4. New parity test `agents/__tests__/trigger-threshold-parity.test.ts`: eval `TRIGGER_THRESHOLD_INLINE_SOURCE`,
   sweep windows × ratios against `resolveTriggerThreshold`, assert equality everywhere.
5. Verify: typecheck ×4 (sdk, common, agent-runtime, cli) + agents; `bun test` for agent-runtime, agents, cli
   suites; eslint `--max-warnings 0` on every changed file; `bun run lint:md`.

### Verification

- Sidebar readout no longer jumps on source flips: `dampTokenCount` unit tests prove a 35% flip renders as a
  bounded ramp and sub-deadband changes no-op (tool output). Live BYOK confirmation is the operator smoke-test
  (handoff next-run #4) — recorded, not claimed here.
- `TRIGGER_THRESHOLD_INLINE_SOURCE` (executed) === `resolveTriggerThreshold` across the sweep in the parity test
  (tool output).
- Grep (Law 4): `reconcileTokenCount` ← `prepareStepContext` (`context-tokens.ts:162`) ← `loop-iteration.ts`;
  `updateContextTokens` ← heartbeat (`send-message-monitors.ts:83`) + snapshot (`send-message-lifecycle.ts:167`);
  `dampTokenCount` ← `updateContextTokens`; `TRIGGER_THRESHOLD_INLINE_SOURCE` ← factory template + parity test.
- Typecheck ×4 + agents + eslint 0 + lint:md PASS.

## Perfection Loop

### Loop 1 — RED

- **RED:** (P1) `reconcile-token-count.ts:20-31` alternates provider-truth vs ×1.35 estimator on the freshness
  boundary; heartbeat `send-message-monitors.ts:80-84` + `sidebar-actions.ts:27-33` wire the raw value with no
  smoothing; (P2) `compact-trigger-threshold.test.ts:19-47` value-pins 6 cases and never executes the inline
  generator body.
- **GREEN (CONVERGED):** (A) optional `logger` on `reconcileTokenCount` + per-step debug decision line
  (investigation instrument, kept as bounded observability) AND pure `dampTokenCount` (5% deadband + 12%
  max-step) applied in `updateContextTokens` (display-only fix). (B) `TRIGGER_THRESHOLD_INLINE_SOURCE` extracted
  from the factory template into an exported const, interpolated back into the template, and evaled in a new
  agents parity test swept against `resolveTriggerThreshold`.
- **AUDIT (self, against the working tree):**
  - Reconcile alternation is real: `reconcile-token-count.ts:26-31` — `if (!usage) return localEstimate`;
    `if (usage.capturedAt <= lastCompactionAt) return localEstimate`; else `return usage.inputTokens`.
  - Estimator inflation is `ANTHROPIC_TOKEN_FUDGE_FACTOR = 1.35` (`packages/agent-runtime/src/util/token-counter.ts:7`),
    applied inside `countTokens` (`token-counter.ts:16-19`), so the local estimate is structurally ~35% above
    provider truth — the "LOW vs HIGH" gap.
  - Sidebar path is raw end-to-end: heartbeat `send-message-monitors.ts:80-84` reads
    `snapshot.sessionState.mainAgentState.contextTokenCount` and calls `updateContextTokens`; snapshot handler
    `send-message-lifecycle.ts:166-170` does the same; `sidebar-actions.ts:27-33` stores it with only an
    `Object.is` guard; `right-sidebar-sections.tsx:189-199` renders `formatTokens(tokensUsed)` directly.
  - Cap is set once at run start (`send-message-monitors.ts:53`) and the heartbeat intentionally does NOT refresh
    it (`send-message-monitors.ts:73-75` "cost-flicker" comment) — the visible jumping is the used count, not the
    cap.
  - Post-prune recount is a third source: `spawn-agent-inline.ts:112-116` stamps `lastPrunerCompletionAt` and
    writes `contextTokenCount = countTokensMessagesCached(...)` (×1.35) directly.
  - Inline mirror: `agents/savant/handle-steps-factory.ts:90-106` (`const minTriggerTokens = 100000`,
    `autoCompactBuffer = 30000`, `computeTriggerThreshold`), consumed at `:252`; runtime resolver
    `state.ts:85-95` with `MIN_TRIGGER_TOKENS = 100_000` / `AUTO_COMPACT_BUFFER = 30_000` (`state.ts:70-71`);
    value-pinned only in `compact-trigger-threshold.test.ts:19-47`.
  - `reconcileTokenCount` call site has `logger` in scope (`context-tokens.ts` — `logger` is a function param),
    so the optional-logger addition is a pure signature widening (tests call it without a logger — must stay
    optional).
  - Law 4: `reconcileTokenCount` ← `prepareStepContext` (`context-tokens.ts:162`) ← `loop-iteration.ts`;
    `updateContextTokens` ← 3 production call sites (heartbeat, snapshot, adoptAndPersist).
- **ADVERSARIAL (fresh, read-only):**
  1. **Could display damping hide a real over-limit condition?** No — the pruner consumes the raw
     `contextTokenCount`; only the sidebar readout is smoothed; `blocked`/`warning`/`pruned` phases (CompactionSignal
     panel + sidebar band) all still fire on raw runtime values. The damping is bounded (12% max step) so a real
     crossing renders within 1-2 heartbeats, and the deadband (5%) is below the smallest meaningful band boundary.
  2. **Is the oscillation maybe the cap changing instead of the used value?** Refuted: the cap is set once at run
     start and never refreshed by the heartbeat (evidence above) — the jumping is the used count, confirming the
     reconcile-alternation hypothesis.
  3. **Is the post-prune high blip actually correct?** The recount IS the correct local truth after history
     replacement; its ×1.35 scale vs the next provider truth is the same estimator-vs-truth gap — the damping
     smooths exactly that boundary. No runtime change is warranted (the trigger must stay conservative).
  4. **Does eval'ing the shared source string pin the factory contract?** Yes — the string is interpolated into
     the emitted template, so the test executes the same text the factory bakes. If the emitted text ever changes,
     the test's eval of the exported const still matches the emitted text (same const), and the sweep pins behavior
     against the runtime resolver. Value-pinned cases are kept as documentation and augmented, not replaced.
  5. **Does `dampTokenCount` break the existing `Object.is` no-op guarantee?** No — damping is applied BEFORE the
     guard; a damped value equal to the current value (deadband hit) short-circuits exactly like today, so the
     no-op subscription test (`chat-store-noop-guards.test.ts:10-23`) still passes.
  6. **Is the agents→agent-runtime import for the parity test a new dependency cycle?** No — agent-runtime does
     not import agents; agents already imports common at runtime via workspace symlink
     (`node_modules/@savant-code/agent-runtime`), and the agents tsconfig gains the path mapping. Verified with
     `bun -e import('@savant-code/agent-runtime/context-compactor/state')` → resolves (function).
- **CHANGE DELTA:** N/A (first converged pass).

### Missed Questions (answered at convergence)

1. **Should the fix change runtime truth, not just the display?** → No. The pruner trigger must stay on the raw
   count (conservative-by-design ×1.35); only the readout is damped. Wider-freshness and drop-estimator options
   are rejected (post-prune usage is genuinely stale; pre-first-response safety fallback must survive).
2. **Is a 2s heartbeat poll part of the oscillation?** → The heartbeat is the render path, not the source; the
   source alternation is the reconcile freshness boundary. Damping at the store action covers heartbeat AND
   snapshot AND finalize pushes uniformly (all three call `updateContextTokens`).
3. **Should the parity sweep replace the 6 value-pinned cases?** → No — keep the concrete cases (they document
   intent) and ADD the structural sweep. Both are cheap.
4. **Is the jumping BYOK-only?** → Hosted runs stamp endpoint counts into the same `lastProviderUsage` channel
   (`context-tokens.ts:144-148`), so the same alternation mechanism exists there; the damping fix is mode-agnostic
   (CLI store, not runtime source selection).
5. **Could the fix be deferred to the next release?** → Operator priority per the issues file; the display is
   misleading daily UX. Lands in the next release sweep with the rest of the uncommitted 0821 work.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working-tree implementation (commit pending operator approval / release-only-commits rule)
- [x] **File:line ranges:**
  - A1 — `reconcileTokenCount` optional logger + decision line:
    `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts:47-92` (logger param `:39`, decision log `:65-89`);
    call-site wiring `packages/agent-runtime/src/run-agent-step/context-tokens.ts:164-169` (`logger` passed `:168`)
  - A2 — `dampTokenCount` + wiring: `cli/src/state/chat-store/compaction-helpers.ts:29-61`;
    `cli/src/state/chat-store/sidebar-actions.ts:27-44` (damped readout `:38-44`)
  - B1 — `TRIGGER_THRESHOLD_INLINE_SOURCE`: `agents/savant/handle-steps-factory.ts:29-49`,
    interpolated into the generated template `:115`; path mapping
    `agents/tsconfig.json` (`@savant-code/agent-runtime/*`)
  - B2 — parity sweep: `agents/__tests__/trigger-threshold-parity.test.ts` (sweep `:33-57`)
  - Tests — reconcile logger-spy `packages/agent-runtime/src/__tests__/reconcile-token-count.test.ts:86-150`;
    damping `cli/src/state/__tests__/chat-store-noop-guards.test.ts:95-165`
- [x] **Gate output:** typecheck ×4 (sdk/common/agent-runtime/cli) + agents all clean;
      `bun test` agent-runtime 1147/1147, agents 89/89, cli state 82/82;
      reconcile 7/7, parity 3/3, damping 7/7; eslint `--max-warnings 0` on all 8 changed TS files clean;
      lint:md zero non-handoff errors
- [x] **Reproducibility:** `grep -rn reconcileTokenCount packages/agent-runtime/src` →
      `context-tokens.ts:165` (call site); `grep -rn dampTokenCount cli/src` → `sidebar-actions.ts:38`;
      `grep -rn TRIGGER_THRESHOLD_INLINE_SOURCE agents/` → factory `:115` + parity test `:25`;
      `grep -rn updateContextTokens cli/src` → 3 production call sites
      (`send-message-monitors.ts:83`, `send-message-lifecycle.ts:167,204`)
- [x] **Step statuses:** steps 1-5 all `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (A1 logging + A2 damping; B1 extraction + B2 sweep — all landed)
- [x] Tests/lint pass with pasted tool output (see Implementation Evidence)
- [x] Production call-graph evidence: `reconcileTokenCount` ← `prepareStepContext`
      (`context-tokens.ts:165`) ← `loop-iteration.ts`; `dampTokenCount` ← `updateContextTokens`
      (`sidebar-actions.ts:38`) ← heartbeat (`send-message-monitors.ts:83`) + snapshot
      (`send-message-lifecycle.ts:167`) + adopt (`:204`); `TRIGGER_THRESHOLD_INLINE_SOURCE`
      ← factory template (`handle-steps-factory.ts:115`) + parity test
- [x] FID status reflects the actual implementation state (`closed` — implementation in working tree,
      gates green)

## Resolution

- **Closed Date:** 2026-08-21
- **Fix Description:** (A) `reconcileTokenCount` now emits an optional per-step debug decision line (chosen
  source, usage capturedAt, lastPrunerCompletionAt, localEstimate, result — a throwing logger never breaks the
  count), and the CLI store damps the sidebar readout with `dampTokenCount` (5% deadband + 12% max-step) so the
  estimator↔truth alternation renders as a bounded ramp instead of an instant jump; runtime truth and the pruner
  trigger are untouched. (B) `TRIGGER_THRESHOLD_INLINE_SOURCE` is now the single source the factory bakes into the
  serialized generator, and the new parity test evals that same string against `resolveTriggerThreshold` over a
  7-window × 5-ratio sweep — structural parity, so drift fails loudly.
- **Tests Added:** Yes — reconcile logger-spy (3 cases, incl. throwing-logger guard), dampTokenCount unit (5
  cases) + store damping (2 cases), trigger-threshold parity sweep (3 cases)
- **Verification Evidence:** typecheck ×5 clean; agent-runtime 1147/1147, agents 89/89, cli state 82/82; eslint
  0 warnings; lint:md zero non-handoff errors
- **Archived:** 2026-08-21 (moved to `dev/fids/archive/`)

## Lessons Learned

- The estimator↔truth alternation is structural (×1.35 fudge vs provider truth), not a bug in a single source —
  the durable fix is at the display boundary (damping) plus an observability channel (decision logging), leaving
  the pruner's conservative runtime semantics untouched.
- Structural parity beats value-pinned parity: extracting the EXACT emitted source into a shared const and
  eval'ing it in the test turns "the test and the code agree" into "the test executes the code".
- A JSON tsconfig cannot carry comments — the first edit attempt added one and was reverted before any gate ran
  (caught by review, not by the tooling).
