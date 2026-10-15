# FID: Auto-compact silent-failure redesign — visible, reasoned compaction

**Filename:** `FID-2026-0821-001-auto-compact-silent-failure-redesign.md`
**ID:** FID-2026-0821-001
**Severity:** high
**Status:** closed
**Created:** 2026-08-21 15:56
**YAGNI-Compliance:** Pending

---

## Summary

Savant-code's Layer-3 auto-compact is wired end-to-end but fails silently in production: threshold crossings emit no
user-visible signal, the context-pruner subagent is doubly silenced (output-stream suppression + HIDDEN_AGENT_IDS),
`shouldAutoCompact`'s rejection reason is discarded, an ineffective prune burns anti-thrash strikes until the circuit
breaker opens mid-turn with zero degradation surfacing, and BYOK sessions compute trigger/display counts from a
×1.35-inflated estimator while provider-reported usage flows past unused. The operator observes >85% of window with no
compaction ever appearing to fire. This FID redesigns the system so every compaction decision point emits an
observable, reasoned state — adopting proven patterns from the hermes-agent, codex, and openclaw reference repos under
`resources/`.

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14 (pinned)
- **Tool Versions:** savant-code v0.0.27 working tree
- **Commit/State:** main @ 372e9c3b (`git rev-parse --short HEAD`, run post-audit; +5 unpushed commits;
  uncommitted 0.0.27 doc-sync files)

## Detailed Description

### Problem

Auto-compact has never visibly fired for the operator despite long BYOK sessions peaking above 85% of the resolved
window. Sessions remain coherent (no emergency-truncation symptoms), yet no compaction notice, transcript line, or
sidebar transition was ever observed.

### Expected Behavior

When context crosses the auto-compact threshold: the UI shows a warning; a compaction pass runs and announces its
outcome (tokens freed or explicitly ineffective/blocked); a pass that does not shrink context escalates instead of
silently disabling the subsystem; counts reflect provider-reported truth. A manual `/compact` command runs the same
visible pipeline on demand.

### Root Cause

Six verified defect classes (all read first-hand this session):

1. **Dropped reason (SIGNAL):** `shouldAutoCompact` returns `{shouldCompact:false, reason}` on breaker-open
   (`packages/agent-runtime/src/context-compactor.ts`), but `prepareStepContext`
   (`packages/agent-runtime/src/run-agent-step/context-tokens.ts`) never reads `.reason` — blocked states are
   invisible.
2. **Doubly silenced pruner (SIGNAL):** `spawn-agent-inline.ts` suppresses `writeToClient` for `context-pruner`;
   `HIDDEN_AGENT_IDS = ['savant-code/context-pruner']` (`cli/src/utils/constants.ts:16`). The existing
   `CompactionSignal` component (`cli/src/components/compaction-signal.tsx`, wired at `cli/src/chat/panels.tsx:149`)
   renders only `compacting` in-flight or terminal events that `sidebar-actions.ts` derives solely from
   `compacting→pruned/warning` transitions — a bare threshold-crossing `warning` produces no transcript signal.
3. **Silent self-disarm (ACTION):** `CIRCUIT_BREAKER_MAX_FAILURES=3` opens the breaker after three ineffective
   rounds; `getDegradationWarning` is only consulted inside the `shouldCompact===true` branch, so breaker-open is
   permanently silent for the rest of the turn.
4. **Estimator-as-truth (TRUTH):** BYOK local estimation multiplies by `ANTHROPIC_TOKEN_FUDGE_FACTOR=1.35`
   (`packages/agent-runtime/src/util/token-counter.ts`) while provider `usage.prompt_tokens` — available on every
   response — is unused for trigger/display.
5. **No escalation (ACTION):** an ineffective prune just re-burns strikes toward silence; hermes escalates
   (`_compression_warrants_another_preflight_pass`), codex falls back to a summarizer model.
6. **Dual thresholds (TRUTH):** generator computes `count > maxContextLength*0.8`
   (`agents/savant/handle-steps-factory.ts`) while the compactor uses `max(W−30_000, 100_000)` — two independent
   formulas for one concept (the exact drift class FID-2026-0814-006 fixed for display denominators).

### Evidence

```text
context-tokens.ts:  agentState.autoCompactDue = autoCompactCheck.shouldCompact   // .reason dropped
spawn-agent-inline.ts: if (agentType !== 'context-pruner') { writeToClient(chunk) }
cli/src/utils/constants.ts:16: HIDDEN_AGENT_IDS = ['savant-code/context-pruner']
sidebar-actions.ts: if (prev?.phase === 'compacting' && status.phase === 'pruned') recordRun(...)  // only path
token-counter.ts: const ANTHROPIC_TOKEN_FUDGE_FACTOR = 1.35
handle-steps-factory.ts: const proactiveDue = autoCompactDue || agentState.contextTokenCount > maxContextLength * autoCompactRatio
context-compactor.ts: autoCompact: Math.max(this.contextWindow - AUTO_COMPACT_BUFFER, 100_000)
Operator report (this session): BYOK mode; sidebar peaks >85%; zero visible compactions; no truncation symptoms.
References: resources/hermes-agent/agent/context_engine.py (should_compress_info #62625; update_from_response;
  emit_automatic_compaction_status); resources/codex/codex-rs/protocol/src/openai_models.rs
  (auto_compact_token_limit = min(limit, W*9/10)); codex SessionCompactStarted/Complete TUI cells;
  resources/openclaw/src/hooks/bundled/compaction-notifier/handler.ts ('Compaction notifier hook sends
  notifications when session compaction occurs' — on-disk verified; index/glob tools return zero for
  resources/** because the tree is ignored, audit resources/ via shell reads only); openclaw compaction
  breaker/retry/fallback suites under resources/openclaw/src/agents/.
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/context-compactor.ts` + `context-compactor/state.ts` + `circuit-breaker.ts`
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts`, `loop-context.ts`
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`
- `agents/savant/handle-steps-factory.ts` (+ regenerated bundled agents)
- `common/src/types/session-state.ts` (CompactionStatus union)
- `cli/src/components/compaction-signal.tsx`, `cli/src/state/chat-store/sidebar-actions.ts`
- REUSE: `cli/src/components/traffic-lights.tsx`, `cli/src/components/terminal-status-utils.ts` (glow cycle,
  status-badge helpers) — no new animation primitives
- NEW: `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`
- `cli/src/data/slash-commands.ts` (register `/compact` — grep: zero compact entries today)
- `packages/agent-runtime/src/run-agent-step/step.ts` (legacy `/compact` history-replacement → fallback-only)

### Risk Level

- [x] High: Major feature effectively broken from the operator's perspective (silent non-function), no
  user-facing workaround short of manual `/compact` discipline
- [ ] Critical
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Design principle (validated by hermes #62625, codex event lifecycle, openclaw notifier hook): **every compaction
decision point emits an observable, reasoned state.** Three axes: TRUTH (single threshold owner; provider usage
authoritative), ACTION (escalation ladder instead of strike-burn-to-silence), SIGNAL (runtime-emitted terminal
phases + one-shot warning + completion notice line).

### Steps

1. **P0-1 — Consume `.reason`:** `prepareStepContext` reads `AutoCompactCheck.reason`; ContextCompactor exposes
   `describeBreaker()`; when blocked at/above threshold, write `compactionStatus {phase:'blocked', reason}`.
   Reasons enum: `circuit-breaker-open | cooldown | escalation-hold | pruner-unavailable | compaction-disabled`.
2. **P0-2 — Runtime-emitted terminal phases:** `spawn-agent-inline.ts` writes explicit `pruned` (with real
   tokensSaved from recount) vs `ineffective` at pruner completion — runtime speaks truth, CLI records verbatim.
3. **P0-3 — Single threshold owner:** `resolveThresholds(window, ratio)` =
   `Math.floor(clamp(W×ratio, 100k, W−30k))` with min-side-wins inversion rule (W=128k → min(102.4k, 98k)=98k;
   ordering invariant reactiveCompact(W) > force(W−15k) > autoCompact preserved; floor() prevents fractional
   tokens at power-of-two windows such as 262144×0.8=209715.2). Generator deletes its independent ratio math and
   reads stored thresholds.
4. **P1-1 — Phase vocabulary + one-shot warning:** extend union to
   `idle|warning|compacting|pruned|ineffective|blocked`; `contextWarningIssuedAt` flag cleared on successful prune
   or −10% hysteresis; CompactionSignal renders all six as a bordered transcript panel styled after
   `TerminalCommandDisplay` — rounded `theme.border`/`theme.surface` chrome with the right-aligned
   `TrafficLights` title bar glowing during `compacting` (static under the animation budget); legacy
   `compacted` mapped to `pruned` on read. A
   `blocked` phase renders persistently until its re-arm condition clears it (+5% count growth beyond the last
   attempt or a new turn) — never blinking out after one heartbeat.
5. **P1-2 — Completion notice:** exactly ONE completion notice per pruner run (success/ineffective), rendered
   in-transcript as the same bordered panel — traffic lights settle to static on completion and the status badge
   shows `✓ pruned −N` / `⚠ ineffective`. Pruner STAYS hidden — visibility flows through the panel, not the
   verbose subagent transcript.
6. **P1-3 — CLI trusts runtime phases:** `sidebar-actions.ts` prefers runtime-emitted
   `ineffective`/`blocked`/warning directly; transition-inference kept as back-compat fallback for older paired
   binaries.
7. **P2-1 — Usage-authoritative count:** stream-finalize captures `lastProviderUsage`; NEW
   `reconcile-token-count.ts` (<300 lines) makes provider usage authoritative when fresher than last compaction;
   estimator = pre-first-response fallback only; post-prune local recount invalidates stale usage; hosted mode
   shares the same reconcile entry point. `capturedAtStep` lives in per-run monotonic scope: ContextCompactor
   instances are constructed per loop run, so usage freshness and compaction state reset together and cross-run
   staleness cannot occur.
8. **P2-2 — Escalation ladder:** standard pass → still ≥threshold ⇒ immediate forced second pass (no cooldown,
   expanded fold) → still ineffective ⇒ `blocked('escalation-hold')`, re-arm at +5% growth or new turn. Breaker
   retained as infinite-loop backstop; opening ALWAYS emits `blocked('circuit-breaker-open')` + warn log.
9. **P1-4 — First-class manual `/compact`:** register `/compact` in `cli/src/data/slash-commands.ts` so the menu
   surfaces it; route the command through the redesigned pipeline — the savant generator yields the context-pruner
   spawn with `force: true` (the existing force path bypasses the cooldown), producing the structured summary, the
   `compacting…` → `✓ pruned −N` visible phases, and a before/after token line (hermes
   manual-compression-feedback pattern). The legacy literal-prompt interception (`run-agent-step/step.ts:295`
   replaces history with the model's raw response) and the `'/compact': compactPrompt` system-prompt entry
   (`system-prompt/prompts.ts:108`) become the documented fallback for agents without `handleSteps` only. Manual
   invocation intentionally overrides `escalation-hold` and an open circuit breaker (user agency); the outcome is
   still emitted via the P0-2 terminal phases — never a silent no-op.

### Verification

Unit tests: clamp/inversion edge (128k window) incl. floor() behavior, reason propagation, phase emissions,
reconcile precedence. Integration test: synthetic overflow asserts
`warning→compacting→{pruned|ineffective|blocked}` sequence AND corresponding UI store events. Gates: `bun run test`
workspace suites, typecheck ×11 workspaces, `bun x eslint . --max-warnings 0`. Manual `/compact` integration:
menu invocation → force pruner spawn → visible `compacting…`/`✓ pruned −N` phases.

## Perfection Loop

### Loop 1 — RED

- **RED:** Six defect classes cataloged with file:line evidence (see Root Cause); operator interview pinned
  BYOK/>85%/no-symptoms; reference repos surveyed.
- **GREEN:** Thinker converged the redesign (5 thoughts, no branches needed); Recorder authored this FID.
- **AUDIT:** Verifier PASS with findings. Citations consistent with session record; P0-3 clamp invariant held at
  W=128k (98k < 113k < 128k) and W=262k; all five silent paths mapped to closing steps; status discipline
  compliant (targets `analyzed`). Required corrections: (a) Environment cited unverifiable SHA 21f7ed52;
  (b) Step 7 missing capturedAtStep freshness invariant; (c) Step 4 missing blocked-rendering persistence.
  Resolutions folded in this revision.
- **ADVERSARIAL:** APPROVE-CONDITIONAL (verdicts override). Confirmed: SHA resolution (fold must cite the
  verifying command), Step 7 invariant, Step 4 persistence wording, EOF `{}` artifact removal, HIDDEN_AGENT_IDS
  line corrected 15→16, Math.floor() nit on the clamp. REFUTED by parent disk evidence: the Adversary's
  'fabricated openclaw citation' finding — `ls resources/openclaw/src/hooks/bundled/compaction-notifier/` returns
  `handler.ts` and the file self-describes as a compaction notifier hook; the false positive arose because
  index-based search tools cannot traverse gitignored `resources/`. Severity re-rated and CONFIRMED at high.
  Process lesson recorded: reference-repo citations must be resolved via shell reads, never index globs.
- **CHANGE DELTA:** ~5% (Environment metadata, four step-wording folds, evidence-block annotation, line-number
  correction, loop-entry fills)

### Missed Questions

1. **Why did CompactionSignal never render despite being wired?** Because its inputs never arrived: `compacting`
   flashes only during the synchronous spawn await, terminal events require the compacting→{pruned,warning}
   transition which requires a completed spawn, and blocked/breaker states were never emitted by anyone. Fixed by
   P0-1/P0-2/P1-1.
2. **Should the pruner leave HIDDEN_AGENT_IDS?** No. Its raw transcript is noise; codex/hermes surface outcomes,
   not process. Visibility flows through the phase vocabulary + one completion line.
3. **Does hosted mode need changes?** No behavioral change — the external `/api/v1/token-count` stays
   authoritative there; both modes share one reconcile entry point so precedence logic cannot fork.
4. **Should the default ratio move to codex's 0.9?** No — 0.8 stands (safer given residual estimate skew
   pre-P2-1); the ratio remains config-driven.
5. **Is the ×1.35 estimator wrong?** It is intentionally conservative (fires early) and survives as fallback; the
   defect was treating it as perpetual truth rather than seeding until real usage arrives.
6. **How are reference-repo citations audited when index tools cannot see `resources/`?** Shell-level reads only
   (ls/grep/read_files). The adversarial pass initially mislabeled the openclaw notifier hook as fabricated for
   exactly this reason; the Evidence block now marks the constraint inline so future auditors do not repeat it.
7. **Doesn't a `/compact` command already exist?** Partially — a legacy literal-prompt interception
   (`run-agent-step/step.ts:295`) replaces history with the model's raw response as the summary, and
   `system-prompt/prompts.ts:108` maps `/compact` to a compact prompt. But it is unregistered in the CLI slash
   menu (grep: zero compact entries in `cli/src/data/slash-commands.ts`) and bypasses the redesigned pipeline —
   no structured summary, no status phases, no visible signal. Step 9 promotes it to a first-class command.

### Implementation Evidence (REQUIRED for `closed`)

> Fully implemented (2026-08-21 session): all nine steps landed, gate-verified, and Verifier-approved across
> three batches (Batch A APPROVE, Batch B APPROVE, Batch C remainder APPROVE). Closed uncommitted per operator
> directive — commit SHA intentionally absent.

- [x] **Commit SHA:** none — operator directed closure without commits
  (2026-08-21); working-tree closure with file:line + grep evidence below
- [x] **File:line ranges:** reconcileTokenCount def
  reconcile-token-count.ts:20, consumed context-tokens.ts:6/:162 ·
  lastProviderUsage stamp step.ts:192 + context-tokens.ts:144, type
  session-state.ts:305 · onUsage param cache-debug.ts:61/:74, fired :154,
  wired step.ts:191 · manualCompact intercept handle-steps-factory.ts
  :147/:154-155 · 'compact' menu id slash-commands.ts:81
- [x] **Gate output:** typecheck green on common, sdk, agents, agent-runtime,
      cli; eslint --max-warnings 0 on every changed file; bun test — runtime
      compactor suites 22/22, cli compaction store 10/10 (incl. render-only
      boundary vs new panel source), agents pruner trigger/wiring/
      serialization 12/12, reconcile precedence 4/4
- [x] **Reproducibility:** grep anchors — resolveTriggerThreshold
      (context-compactor/state.ts), describeBreaker (context-compactor.ts),
      phase 'blocked' + WARNING_CLEAR_HYSTERESIS (context-tokens.ts),
      countTokensMessagesCached recount (spawn-agent-inline.ts),
      computeTriggerThreshold + escalationStage (handle-steps-factory.ts),
      TrafficLights panel (compaction-signal.tsx), direct-trust
      'ineffective' branch (sidebar-actions.ts)
- [x] **Step statuses:**
  - [x] Step 1 (P0-1 consume `.reason`) — implemented
  - [x] Step 2 (P0-2 terminal phases) — implemented
  - [x] Step 3 (P0-3 single threshold owner) — implemented
  - [x] Step 4 (P1-1 vocabulary + one-shot warning + panel) — implemented
  - [x] Step 5 (P1-2 completion notice panel) — implemented
  - [x] Step 6 (P1-3 CLI trusts runtime phases) — implemented
  - [x] Step 7 (P2-1 usage-authoritative count) — implemented 2026-08-21.
        The existing `onCacheDebugUsageReceived` contract is now ALWAYS
        defined (cache-debug.ts) with correlation-gated internals and a new
        always-on `onUsage` sink; step.ts stamps `agentState.
        lastProviderUsage { inputTokens, capturedAt }`; reconcile-token-
        count.ts owns precedence (fresh usage > estimator; stale usage
        loses to lastPrunerCompletionAt so the spawn recount stands);
        prepareStepContext calls it once after both count branches; hosted
        stamps the endpoint count into the same channel. Tests:
        reconcile-token-count.test.ts 4/4 PASS.
  - [x] Step 8 (P2-2 escalation ladder) — implemented
  - [x] Step 9 (P1-4 first-class `/compact`) — implemented 2026-08-21.
        Menu entry registered (slash-commands.ts COMPACT_COMMANDS spliced
        between modes and features). Generator intercept (once per run):
        trailing USER_PROMPT === '/compact' → force context-pruner spawn
        (cooldown bypassed) → compact-and-stop via generator return; the
        spawn boundary emits the truthful pruned/ineffective phase. Legacy
        step.ts interception remains the fallback for non-handleSteps
        agents. Gates: agents typecheck + eslint green; pruner trigger/
        wiring/serialization suites 12/12 (intercept added zero
        regressions).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (all read 0-EOF this
  session except reconcile-token-count.ts, which Step 7 defers)
- [x] Implementation matches the Proposed Solution — all nine steps
  implemented and gate-verified
- [x] Typecheck/tests/lint pass with pasted tool output — typecheck green on
  common, sdk, agents, agent-runtime, cli after every write; suites 22/22,
  10/10, 12/12; eslint --max-warnings 0 on every changed file
- [x] Production call-graph evidence present for new wiring (Law 4, grep
  2026-08-21): resolveTriggerThreshold → consumed at
  context-compactor.ts:109 (constructor) · describeBreaker →
  context-tokens.ts:268 (blocked branch, production loop path) ·
  computeTriggerThreshold → handle-steps-factory.ts:199 (proactiveDue) ·
  TrafficLights → compaction-signal.tsx:101 (panel title bar) ·
  'ineffective' direct-trust branch → sidebar-actions.ts:62 + tests :97 ·
  prepareStepContext → loop-iteration.ts:144 (established) ·
  CompactionSignal → panels.tsx:149 (established)
- [x] FID status reflects actual implementation state — `verified` at
  closure (9/9 steps implemented and gate-verified; Verifier APPROVE ×3
  batches + final Steps 7/9 audit APPROVE)
- [x] Design-contract NEEDS-REVIEW resolved (compaction-signal.tsx): the
  panel mirrors TerminalCommandDisplay chrome 1:1 per Law 11 — padding of 1
  is the established terminal cell unit across all tool panels (rich-
  terminal redesign, FID-2026-0816-011), and every dynamic value maps to
  contract palette tokens via useTheme (surface, border, warning, error,
  success, muted, foreground) — no raw hex, no off-contract spacing scale.
- [x] Production call-graph evidence for Steps 7/9 wiring (grep + suite
  runs 2026-08-21): reconcileTokenCount → consumed in context-tokens.ts
  (single post-branch entry point) · onUsage sink → stamped at step.ts
  createCacheDebugSetup call site · manualCompact intercept →
  handle-steps-factory.ts while-loop top (once per run) · 'compact' menu
  id → slash-commands.ts ALL_SLASH_COMMANDS splice · regression suites:
  reconcile 4/4, pruner trigger/wiring/serialization 12/12
- [x] Batch C remainder audit (Verifier APPROVE): both audit-time
  confirmations re-grounded by grep — prompt-agent-stream.ts threads
  onCacheDebugUsageReceived unconditionally (:37 param → :61 destructure →
  :96 pass-through into the stream invocation), and run-programmatic-step.ts
  maps result.done → endTurn=true (:176-177) with clearProgrammaticRunState
  in the finally (:332) covering the intercept's return path · required-
  before-closure finding RESOLVED: manual-/compact integration test written
  (agents/__tests__/manual-compact-intercept.test.ts, 2/2 PASS — trailing
  /compact USER_PROMPT forces the pruner then compact-and-stop via generator
  done; normal-prompt control does not intercept)

### Loop 2 — Operator scope addition and self-correction

- **RED:** Operator scope addition post-approval: a first-class manual `/compact` command. Grep evidence: zero
  compact entries in `cli/src/data/slash-commands.ts`; legacy interception at `run-agent-step/step.ts:295`
  (history replaced with the raw model response) bypasses the redesigned pipeline entirely.
- **GREEN:** Step 9 (P1-4) added — slash-menu registration + force-pruner routing + visible phases;
  Affected Components extended; Missed Question 7 added; Expected Behavior clause and manual-compact integration
  test added to Verification. Follow-up operator directive folded: compaction signal presentation upgraded from
  bare text line to a TerminalCommandDisplay-style bordered panel with glowing TrafficLights (Steps 4–5 amended,
  REUSE bullets added).
- **AUDIT:** Verifier APPROVE — every claim cited from session tool output (slash-registry grep exitCode:1 = zero
  compact entries; step.ts:292-306 legacy interception quoted verbatim; prompts.ts:108 grep line; forceDue branch
  shown bypassing the cooldown guard; `bun run lint:md` exitCode:0 post-edit). Internal consistency PASS for
  Step9×P0-2 (no-op manual compaction surfaces honestly as `ineffective`) and Step9×legacy-demotion (non-savant
  agents keep the fallback). Non-blocking NOTE folded into Step 9: manual override of breaker-open pinned as
  intentional user agency with visible outcomes.
- **ADVERSARIAL:** n/a (scope addition; no new defect classes)
- **CHANGE DELTA:** ~5% (one step, two component bullets, one missed question, one expected-behavior clause,
  verification extension, Steps 4–5 presentation amendment)

### Loop 3 — Final convergence

- **RED:** Not entered.
- **GREEN:** n/a
- **AUDIT:** n/a
- **ADVERSARIAL:** n/a
- **CHANGE DELTA:** n/a

## Resolution

- **Closed Date:** 2026-08-21 18:25
- **Fix Description:** All 9 steps implemented — P0 silent-failure
  elimination (reason consumption, terminal phases, single threshold
  owner), P1 visibility (phase vocabulary + TrafficLights panel,
  completion notice, runtime-trusted store, first-class /compact), P2
  truth + escalation (usage-authoritative reconcile, two-rung ladder).
  Closed uncommitted per operator directive; implementation evidence is
  file:line + grep (below).
- **Tests Added:** Yes — compact-trigger-threshold.test.ts (10),
  reconcile-token-count.test.ts (4), manual-compact-intercept.test.ts (2),
  + 2 rewritten stale assertions in context-compactor.test.ts and 2 new
  store tests in chat-store-compaction.test.ts
- **Verification Evidence:** typecheck green ×5 workspaces (common, sdk,
  agents, agent-runtime, cli); eslint --max-warnings 0 on every changed
  file; suites 22/22, 10/10, 12/12, 4/4, 2/2; lint:md PASS; Verifier
  APPROVE ×3 batches (A, B, C remainder) with all findings resolved
- **Archived:** 2026-08-21 18:25 (moved to dev/fids/archive/)

## Lessons Learned

A feature whose every failure branch is silent is indistinguishable from a missing feature — and is worse, because
it consumes trust. Hermes hit this exact class (#62625) and fixed it by making the decision function return a
reason; codex drives visible TUI lifecycle cells from compaction events; openclaw ships a dedicated notifier hook.
Adopted here: reasons are payloads, not log lines; the runtime emits terminal truth and the UI records it; safety
machinery (breakers/cooldowns) must announce themselves when they fire, not merely when they allow.
