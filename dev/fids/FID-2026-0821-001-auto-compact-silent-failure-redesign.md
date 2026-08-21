<!-- markdownlint-disable MD013 -->

# FID: Auto-compact silent-failure redesign — visible, reasoned compaction

**Filename:** `FID-2026-0821-001-auto-compact-silent-failure-redesign.md`
**ID:** FID-2026-0821-001
**Severity:** high
**Status:** created
**Created:** 2026-08-21 15:56
**YAGNI-Compliance:** Pending

---

## Summary

Savant-code's Layer-3 auto-compact is wired end-to-end but fails silently in production: threshold crossings emit no user-visible signal, the context-pruner subagent is doubly silenced (output-stream suppression + HIDDEN_AGENT_IDS), `shouldAutoCompact`'s rejection reason is discarded, an ineffective prune burns anti-thrash strikes until the circuit breaker opens mid-turn with zero degradation surfacing, and BYOK sessions compute trigger/display counts from a ×1.35-inflated estimator while provider-reported usage flows past unused. The operator observes >85% of window with no compaction ever appearing to fire. This FID redesigns the system so every compaction decision point emits an observable, reasoned state — adopting proven patterns from the hermes-agent, codex, and openclaw reference repos under `resources/`.

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14 (pinned)
- **Tool Versions:** savant-code v0.0.27 working tree
- **Commit/State:** main @ 21f7ed52 (+5 unpushed commits; uncommitted 0.0.27 doc-sync files)

## Detailed Description

### Problem

Auto-compact has never visibly fired for the operator despite long BYOK sessions peaking above 85% of the resolved window. Sessions remain coherent (no emergency-truncation symptoms), yet no compaction notice, transcript line, or sidebar transition was ever observed.

### Expected Behavior

When context crosses the auto-compact threshold: the UI shows a warning; a compaction pass runs and announces its outcome (tokens freed or explicitly ineffective/blocked); a pass that does not shrink context escalates instead of silently disabling the subsystem; counts reflect provider-reported truth.

### Root Cause

Six verified defect classes (all read first-hand this session):

1. **Dropped reason (SIGNAL):** `shouldAutoCompact` returns `{shouldCompact:false, reason}` on breaker-open (`packages/agent-runtime/src/context-compactor.ts`), but `prepareStepContext` (`packages/agent-runtime/src/run-agent-step/context-tokens.ts`) never reads `.reason` — blocked states are invisible.
2. **Doubly silenced pruner (SIGNAL):** `spawn-agent-inline.ts` suppresses `writeToClient` for `context-pruner`; `HIDDEN_AGENT_IDS = ['savant-code/context-pruner']` (`cli/src/utils/constants.ts:15`). The existing `CompactionSignal` component (`cli/src/components/compaction-signal.tsx`, wired at `cli/src/chat/panels.tsx:149`) renders only `compacting` in-flight or terminal events that `sidebar-actions.ts` derives solely from `compacting→pruned/warning` transitions — a bare threshold-crossing `warning` produces no transcript signal.
3. **Silent self-disarm (ACTION):** `CIRCUIT_BREAKER_MAX_FAILURES=3` opens the breaker after three ineffective rounds; `getDegradationWarning` is only consulted inside the `shouldCompact===true` branch, so breaker-open is permanently silent for the rest of the turn.
4. **Estimator-as-truth (TRUTH):** BYOK local estimation multiplies by `ANTHROPIC_TOKEN_FUDGE_FACTOR=1.35` (`packages/agent-runtime/src/util/token-counter.ts`) while provider `usage.prompt_tokens` — available on every response — is unused for trigger/display.
5. **No escalation (ACTION):** an ineffective prune just re-burns strikes toward silence; hermes escalates (`_compression_warrants_another_preflight_pass`), codex falls back to a summarizer model.
6. **Dual thresholds (TRUTH):** generator computes `count > maxContextLength*0.8` (`agents/savant/handle-steps-factory.ts`) while the compactor uses `max(W−30_000, 100_000)` — two independent formulas for one concept (the exact drift class FID-2026-0814-006 fixed for display denominators).

### Evidence

```text
context-tokens.ts:  agentState.autoCompactDue = autoCompactCheck.shouldCompact   // .reason dropped
spawn-agent-inline.ts: if (agentType !== 'context-pruner') { writeToClient(chunk) }
cli/src/utils/constants.ts:15: HIDDEN_AGENT_IDS = ['savant-code/context-pruner']
sidebar-actions.ts: if (prev?.phase === 'compacting' && status.phase === 'pruned') recordRun(...)  // only path
token-counter.ts: const ANTHROPIC_TOKEN_FUDGE_FACTOR = 1.35
handle-steps-factory.ts: const proactiveDue = autoCompactDue || agentState.contextTokenCount > maxContextLength * autoCompactRatio
context-compactor.ts: autoCompact: Math.max(this.contextWindow - AUTO_COMPACT_BUFFER, 100_000)
Operator report (this session): BYOK mode; sidebar peaks >85%; zero visible compactions; no truncation symptoms.
References: resources/hermes-agent/agent/context_engine.py (should_compress_info #62625; update_from_response;
  emit_automatic_compaction_status); resources/codex/codex-rs/protocol/src/openai_models.rs
  (auto_compact_token_limit = min(limit, W*9/10)); codex SessionCompactStarted/Complete TUI cells;
  resources/openclaw/src/hooks/bundled/compaction-notifier/handler.ts; openclaw compaction breaker/retry/fallback suites.
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/context-compactor.ts` + `context-compactor/state.ts` + `circuit-breaker.ts`
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts`, `loop-context.ts`
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`
- `agents/savant/handle-steps-factory.ts` (+ regenerated bundled agents)
- `common/src/types/session-state.ts` (CompactionStatus union)
- `cli/src/components/compaction-signal.tsx`, `cli/src/state/chat-store/sidebar-actions.ts`
- NEW: `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`

### Risk Level

- [x] High: Major feature effectively broken from the operator's perspective (silent non-function), no user-facing workaround short of manual `/compact` discipline
- [ ] Critical
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Design principle (validated by hermes #62625, codex event lifecycle, openclaw notifier hook): **every compaction decision point emits an observable, reasoned state.** Three axes: TRUTH (single threshold owner; provider usage authoritative), ACTION (escalation ladder instead of strike-burn-to-silence), SIGNAL (runtime-emitted terminal phases + one-shot warning + completion notice line).

### Steps

1. **P0-1 — Consume `.reason`:** `prepareStepContext` reads `AutoCompactCheck.reason`; ContextCompactor exposes `describeBreaker()`; when blocked at/above threshold, write `compactionStatus {phase:'blocked', reason}`. Reasons enum: `circuit-breaker-open | cooldown | escalation-hold | pruner-unavailable | compaction-disabled`.
2. **P0-2 — Runtime-emitted terminal phases:** `spawn-agent-inline.ts` writes explicit `pruned` (with real tokensSaved from recount) vs `ineffective` at pruner completion — runtime speaks truth, CLI records verbatim.
3. **P0-3 — Single threshold owner:** `resolveThresholds(window, ratio)` = `clamp(W×ratio, 100k, W−30k)` with min-side-wins inversion rule (W=128k → min(102.4k, 98k)=98k; ordering invariant reactiveCompact(W) > force(W−15k) > autoCompact preserved). Generator deletes its independent ratio math and reads stored thresholds.
4. **P1-1 — Phase vocabulary + one-shot warning:** extend union to `idle|warning|compacting|pruned|ineffective|blocked`; `contextWarningIssuedAt` flag cleared on successful prune or −10% hysteresis; CompactionSignal renders all six; legacy `compacted` mapped to `pruned` on read.
5. **P1-2 — Completion notice:** exactly ONE `writeToClient` line per pruner run (success/ineffective). Pruner STAYS hidden — visibility flows through signals, not the verbose subagent transcript.
6. **P1-3 — CLI trusts runtime phases:** `sidebar-actions.ts` prefers runtime-emitted `ineffective`/`blocked`/warning directly; transition-inference kept as back-compat fallback for older paired binaries.
7. **P2-1 — Usage-authoritative count:** stream-finalize captures `lastProviderUsage`; NEW `reconcile-token-count.ts` (<300 lines) makes provider usage authoritative when fresher than last compaction; estimator = pre-first-response fallback only; post-prune local recount invalidates stale usage; hosted mode shares the same reconcile entry point.
8. **P2-2 — Escalation ladder:** standard pass → still ≥threshold ⇒ immediate forced second pass (no cooldown, expanded fold) → still ineffective ⇒ `blocked('escalation-hold')`, re-arm at +5% growth or new turn. Breaker retained as infinite-loop backstop; opening ALWAYS emits `blocked('circuit-breaker-open')` + warn log.

### Verification

Unit tests: clamp/inversion edge (128k window), reason propagation, phase emissions, reconcile precedence. Integration test: synthetic overflow asserts `warning→compacting→{pruned|ineffective|blocked}` sequence AND corresponding UI store events. Gates: `bun run test` workspace suites, typecheck ×11 workspaces, `bun x eslint . --max-warnings 0`.

## Perfection Loop

### Loop 1 — RED

- **RED:** Six defect classes cataloged with file:line evidence (see Root Cause); operator interview pinned BYOK/>85%/no-symptoms; reference repos surveyed.
- **GREEN:** Thinker converged the redesign (5 thoughts, no branches needed); Recorder authored this FID.
- **AUDIT:** Pending.
- **ADVERSARIAL:** Pending.
- **CHANGE DELTA:** n/a (initial authoring)

### Missed Questions

1. **Why did CompactionSignal never render despite being wired?** Because its inputs never arrived: `compacting` flashes only during the synchronous spawn await, terminal events require the compacting→{pruned,warning} transition which requires a completed spawn, and blocked/breaker states were never emitted by anyone. Fixed by P0-1/P0-2/P1-1.
2. **Should the pruner leave HIDDEN_AGENT_IDS?** No. Its raw transcript is noise; codex/hermes surface outcomes, not process. Visibility flows through the phase vocabulary + one completion line.
3. **Does hosted mode need changes?** No behavioral change — the external `/api/v1/token-count` stays authoritative there; both modes share one reconcile entry point so precedence logic cannot fork.
4. **Should the default ratio move to codex's 0.9?** No — 0.8 stands (safer given residual estimate skew pre-P2-1); the ratio remains config-driven.
5. **Is the ×1.35 estimator wrong?** It is intentionally conservative (fires early) and survives as fallback; the defect was treating it as perpetual truth rather than seeding until real usage arrives.

### Implementation Evidence (REQUIRED for `closed`)

> Not yet implemented — this FID targets convergence to `analyzed` (planning approved, code pending). Closure requires the items below.

- [ ] **Commit SHA:** pending implementation
- [ ] **File:line ranges:** pending implementation
- [ ] **Gate output:** pending implementation
- [ ] **Reproducibility:** pending implementation
- [ ] **Step statuses:** Steps 1–8 pending (`implemented`/`blocked`/`deferred` at closure)

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist (verified this session: all paths above read 0-EOF except the new reconcile util)
- [ ] Implementation matches the Proposed Solution — pending
- [ ] Typecheck/tests/lint pass with pasted tool output — pending
- [ ] Production call-graph evidence present for new wiring — pending (Law 4 grep at closure)
- [ ] FID status reflects actual implementation state — status stays `analyzed` until code lands

### Loop 2 — Independent audit and self-correction

- **RED:** Pending AUDIT.
- **GREEN:** Pending.
- **AUDIT:** Pending.
- **ADVERSARIAL:** Pending.
- **CHANGE DELTA:** Pending.

### Loop 3 — Final convergence

- **RED:** Pending.
- **GREEN:** Pending.
- **AUDIT:** Pending.
- **ADVERSARIAL:** Pending.
- **CHANGE DELTA:** Pending.

## Resolution

- **Closed Date:** (pending)
- **Fix Description:** (pending implementation)
- **Tests Added:** (pending)
- **Verification Evidence:** (pending)
- **Archived:** (pending)

## Lessons Learned

A feature whose every failure branch is silent is indistinguishable from a missing feature — and is worse, because it consumes trust. Hermes hit this exact class (#62625) and fixed it by making the decision function return a reason; codex drives visible TUI lifecycle cells from compaction events; openclaw ships a dedicated notifier hook. Adopted here: reasons are payloads, not log lines; the runtime emits terminal truth and the UI records it; safety machinery (breakers/cooldowns) must announce themselves when they fire, not merely when they allow.

{}
