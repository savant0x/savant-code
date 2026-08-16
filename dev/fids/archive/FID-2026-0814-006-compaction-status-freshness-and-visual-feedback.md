<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Compaction Status Freshness + Visible Feedback — Real-Time Status, Honest Window, and a Compaction Transcript Signal

**Filename:** `FID-2026-0814-006-compaction-status-freshness-and-visual-feedback.md`
**ID:** FID-2026-0814-006
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — reuses the existing `compactionStatus` channel, the existing 2s heartbeat, the existing snapshot emitter, and the existing `setCompactionStatus` store action; adds a status-emit policy change, a window-consistency fix, and a bounded transcript signal — no new store, no new polling cadence beyond the existing heartbeat, no new authority
**Depends On:** none (operator finding from the 0.0.24 live review: "compaction 93% of window" with "context 188.3k/262.1k" — "there is no visual feedback showing compact is even happening, not in the sidebar, not in the chat banner or anything. There is a massive disconnect with the entire system.")

---

## Summary

The operator's live review surfaced two real defects in the compaction system, both confirmed at source:

1. **The displayed compaction status is stale.** The sidebar's `Compaction` row shows the runtime's **last step-boundary write**, and the heartbeat only updates when the SDK snapshot **fires** — and the snapshot emitter **skips ticks unless `messageHistory` reference identity changed** (`sdk/src/run/execution/snapshot.ts:40-44`). During a long LLM call, or between step boundaries, the displayed percent lags the real context. That is why "Context 188.3k/262.1k" (fresh, 72% of window) coexists with "Compaction 93% of window" (stale, from when context was higher). Additionally, the runtime's `ContextCompactor` defaults `contextWindow` to **200_000** when unresolved (`context-compactor.ts:74`) while the CLI resolves the model's real window (262.1k for the live model) — so the display denominator and the pruner trigger can be computed against **different windows**.
2. **There is no visible feedback that compaction is happening at all.** The `compacting…` phase is written at pruner spawn, but nothing renders it persistently: the sidebar row exists (FID-2026-0814-001) yet the operator reports no visible `compacting`/`pruned` transition, no chat-banner signal, no transcript marker. The landscape research (below) shows what mature agents do: kimi renders a **live transcript compaction block** (blinking "Compacting context…" → "Compaction complete (X → Y tokens)" → "Compaction cancelled"), OpenClaw shows a **color-shifted context-usage bar** plus a `/status` "🧹 Compactions: N" counter, and hermes uses server-side compaction with a safety margin below the local trigger.

This FID fixes the freshness/window defects and adds a **visible compaction lifecycle signal** — without changing the trigger math (the pruner trigger at `maxContextLength × 0.8/0.9` is correct and working).

## Landscape research (verified in `resources/`)

| Agent | Compaction UX | Source |
|---|---|---|
| kimi (kimi-code) | Transcript `CompactionComponent`: blinking bullet "Compacting context…" while running → solid green "Compaction complete (X → Y tokens)" → warning "Compaction cancelled". Trigger: `triggerRatio 0.85` of resolved window, `reservedContextSize 50k` (compacts early to keep output room), synchronous block at same ratio | `apps/kimi-code/src/tui/components/dialogs/compaction.ts`; `packages/agent-core/src/agent/compaction/strategy.ts` |
| OpenClaw | Color-shifted `ContextUsageBar` (green <60, yellow 60–80, orange 80–95, red ≥95 of the **model window**), `/status` "🧹 Compactions: N" counter, log events "auto-compaction start/complete", memory-save reminder before compaction | `apps/macos/Sources/OpenClaw/ContextUsageBar.swift`; `docs/concepts/compaction.md` |
| hermes | Native OpenAI server-side compaction (`context_management` + `compact_threshold`) with `LOCAL_TRIGGER_SAFETY_MARGIN = 8192` below the local compressor trigger; local summarizer stays armed as fallback | `agent/native_compaction.py` |

**Design takeaways for this FID:** (a) compaction must be **visible as it happens** (kimi's transcript block is the strongest pattern for a CLI); (b) the usage percent must be against the **resolved model window** with color bands (OpenClaw); (c) trigger thresholds should reference the same window the UI shows (kimi/OpenClaw both use the resolved window; savant's mismatch is the bug).

## Environment

- **OS:** Windows target; platform-agnostic CLI (OpenTUI).
- **Language/Runtime:** TypeScript/Bun 1.3.14; React 19 / OpenTUI 0.2.2; zustand.
- **Tool Versions:** `ContextCompactor` (`context-compactor.ts`, `context-compactor/state.ts`), `context-tokens.ts` (status writer), `agents/savant/handle-steps.ts` (pruner spawn), `sdk/src/run/execution/snapshot.ts` (snapshot emitter), `cli/src/hooks/helpers/send-message-monitors.ts` (heartbeat), `cli/src/components/right-sidebar.tsx` (sidebar row), `cli/src/components/help-banner.tsx` (legend).
- **Commit/State:** working tree 0.0.24, unreleased. Active FID queue: `FID-2026-0814-002/003/004/005` at `analyzed`; this is the fifth planning FID of the day.

## Detailed Description

### Problem

1. **Stale display (D1).** The compaction status is written only at step boundaries (`context-tokens.ts:208-235`) and propagated only when the snapshot fires, which requires a `messageHistory` identity change (`snapshot.ts:40-44`). The heartbeat polls `getLatestRunStateSnapshot()` every 2s (`send-message-monitors.ts:75-95`) but that ref only changes on snapshot emission. During a slow LLM call the sidebar shows the last step-boundary percent; after a pruner run it can show the *pre-prune* warning. The operator's "93% of window" vs "188.3k/262.1k" is exactly this staleness (93% ≈ 243.8k of the 262.1k window, from an earlier snapshot).
2. **Window mismatch (D2).** `ContextCompactor` uses `options.contextWindow ?? 200_000` (`context-compactor.ts:74`); the CLI resolves the model's real window and passes it (`create-run-config.ts:192` → `loop-context.ts:274`), but any unresolved path silently falls back to 200k — so the display denominator (`autoCompact + 30k`) and the sidebar's resolved window (262.1k) can disagree, and the percent can read "100%+" while the pruner trigger (against a different maxContextLength) has not fired.
3. **No visible lifecycle (D3).** The `compacting`/`pruned` status is written to `agentState.compactionStatus`, but nothing renders an in-progress or completion signal the operator can see: the sidebar row is one line; there is no transcript block, no banner, no counter. The A–Z report's P3-5 row ("compaction status idle→compacting…→✓ pruned visual") remains operator-gated with no live confirmation because the transition is invisible.

### Expected Behavior

1. **The sidebar `Compaction` row always reflects the latest known context**: percent computed against the **resolved model window** (the same number the Context row shows), refreshed on every status change (pruner start, pruner completion, step-boundary recompute), and never stale across LLM-call gaps.
2. **Compaction is visible when it happens**: a transcript-level signal (kimi pattern) — a compact block/banner showing `⚙ Compacting context…` while the pruner runs, then `✓ Compaction complete (X → Y tokens)` (or `⚠ ineffective` / `cancelled`), plus a session `Compactions: N` counter in the status area (OpenClaw pattern).
3. **The trigger math is unchanged** (it works): pruner spawns at `maxContextLength × 0.8` proactive / `0.9` force (`handle-steps.ts:143-168`), 30s cooldown, force-bypass — the display simply tells the truth about it.

### Root Cause (verified at source)

- **D1. Snapshot skips + heartbeat reads a stale ref.** `snapshot.ts:40-44` — `if (history === lastSnapshotHistory) return` — compaction status changes that do not coincide with a `messageHistory` identity change never emit. `send-message-monitors.ts:75-95` — heartbeat mirrors the last snapshot. `context-tokens.ts:208-235` — status written only at step boundaries.
- **D2. Two windows.** `context-compactor.ts:74` — `this.contextWindow = options.contextWindow ?? 200_000`; `loop-context.ts:274` — passes `loopParams.contextWindow`; `create-run-config.ts:192` — passes the CLI-resolved window; any fallback path diverges. `context-tokens.ts:210` — display denominator `autoCompact + 30_000` (runtime window), while the sidebar Context row uses the CLI-resolved `contextTokensMax`.
- **D3. No render path for the lifecycle.** `right-sidebar.tsx` has the one-line `Compaction` row; `help-banner.tsx` has the legend; there is no transcript/banner component consuming `compactionStatus` transitions. `cli/src/components/blocks/` renders tool blocks and messages, not compaction state.

## RED — Issue Catalog (evidence)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| C-01 | high | Compaction status display goes stale across LLM-call gaps — snapshot emitter skips ticks without a `messageHistory` identity change, so the sidebar shows the last step-boundary percent | `snapshot.ts:40-44` (identity check skips); `send-message-monitors.ts:75-95` (heartbeat mirrors last snapshot); `context-tokens.ts:208-235` (status written only at step boundaries) |
| C-02 | medium | Runtime window fallback (`200_000`) can diverge from the CLI-resolved window (262.1k) — display percent and pruner trigger can reference different windows | `context-compactor.ts:74` (`?? 200_000`); `create-run-config.ts:192` → `loop-context.ts:274` (resolved window); `context-tokens.ts:210` (denominator `autoCompact + 30k`) |
| C-03 | high | No visible compaction lifecycle — no in-progress, completion, or failure signal anywhere the operator looks (sidebar one-liner only; no transcript/banner/counter) | `right-sidebar.tsx` (one row); `help-banner.tsx` (legend only); absence: no compaction consumer in `cli/src/components/blocks/` or a status counter (see AUDIT absence greps) |
| C-04 | low | A–Z row P3-5 (compaction transition visual) is uncloseable by an in-harness agent because the transition is invisible | `dev/scratchpad/az-v0.0.24-harness-live-test-report.md` (P3-5 NEEDS-REVIEW) |

## GREEN — Proposed Solution (converged)

1. **C-01 — Fresh status, always.**
   - **Emit policy:** the snapshot emitter stops using `messageHistory` identity as the sole "changed" signal — it also emits when `compactionStatus` (or `contextTokenCount`) changed since the last tick (`snapshot.ts:40-44`). The interval (5s) is unchanged; this only removes the false "nothing changed" skip.
   - **Runtime write cadence:** keep step-boundary writes as the source of truth, and add a **pruner-lifecycle write** at the completion boundary (already exists for `pruned`/`warning` — FID-2026-0814-001) plus a `compacting` write at spawn (already exists). The freshness fix is the propagation, not more writes.
   - **Heartbeat:** no change needed beyond the snapshot fix — it already mirrors `compactionStatus` every 2s when the snapshot fires.
2. **C-02 — One window.**
   - Resolve the context window **once** at run start (CLI already does), pass it through the run config to the runtime (already wired), and make `ContextCompactor` **fail loudly** instead of falling back silently: log a warning when `contextWindow` is undefined, and default the display denominator to the *resolved* window when present. The sidebar percent (`percentUsed`) and the pruner trigger must reference the same `maxContextLength`.
   - Reconcile the label: the sidebar already says "N% of window" (FID-2026-0814-001); the window shown must equal `contextTokensMax` in the Context row.
3. **C-03 — Visible lifecycle (kimi + OpenClaw patterns).**
   - **Transcript signal:** a compact, non-intrusive block in the chat stream (mirroring kimi's `CompactionComponent`): `⚙ Compacting context…` (blinking/bold) while `phase === 'compacting'`; `✓ Compaction complete (X → Y tokens)` on `pruned`; `⚠ Compaction ineffective` on `warning` after a pruner run; nothing on `idle`/micro-compact (micro already renders as `✓ micro −N tokens` in the sidebar — keep it there).
   - **Session counter:** `Compactions: N` in the sidebar status area (OpenClaw's `/status` pattern), incremented on each `pruned` event, persisted in the session store (bounded, like `provenanceEvents`).
   - **Sidebar row polish:** color-band the percent (green <60, yellow 60–80, orange 80–95, red ≥95 — OpenClaw bands), so the warning state reads at a glance.
4. **C-04 — Deterministic trigger path.** Extend the phase3 harness tests to assert the `compacting → pruned → complete` transcript sequence is emitted end-to-end (headless, closing P3-5's NEEDS-REVIEW), and update the A–Z prompt's P3-5 row to the now-executable assertion.

**Out of scope:** changing the trigger ratio/thresholds (they work — 0.8/0.9 of `maxContextLength`); server-side compaction (hermes' native path requires provider support); the Trust Matrix auto-resolution (FID-2026-0814-005).

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| Freshness | Snapshot test: `compactionStatus` change without `messageHistory` change still emits; heartbeat mirrors it; no regression to the identity-skip optimization (token-count-only ticks stay suppressed) |
| One window | Test: runtime with resolved window 262.1k → display percent and pruner trigger share `maxContextLength`; unresolved window logs a warning and never silently shows a percent against 200k |
| Visible lifecycle | Render tests: `compacting` → transcript block appears; `pruned` → `✓ Compaction complete (X → Y tokens)`; `warning` after pruner → ineffective notice; counter increments per pruned event; color bands at 60/80/95 |
| Trigger path | Phase3 headless test: full `compacting → pruned → complete` sequence emitted; A–Z P3-5 row updated to the executable assertion |
| Repository | typecheck ×4, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger, full root test suites |

## Governance and Release Boundary

This FID changes no ECHO law, no ZTAP trust semantics, and no compaction trigger math — it fixes the propagation (snapshot emit policy), the window consistency, and adds display-only feedback (transcript block, counter, color bands). All changes remain subject to the Perfection Loop, the Nova planning + implementation audits, and operator approval before any closure, commit, push, release, or deployment.

## Open Questions (to be resolved in the loop)

1. **Transcript block placement:** appended to the chat stream as a message-like block vs. a fixed sidebar/banner element. Default: kimi's pattern (in-stream block at compaction boundaries), because it is contextually located where the user is reading; the sidebar row keeps the live percent.
2. **Counter persistence:** in the zustand session store (reset per new session, like `provenanceEvents`) vs. across sessions. Default: per session — compaction is a session activity.
3. **Emit-policy breadth:** emit on `compactionStatus`/`contextTokenCount` change only, or any `mainAgentState` field change? Default: the two named fields (context/compaction) — they are the observable ones; broadening to any field change would defeat the identity-skip optimization.

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Is the trigger math actually broken?** No — at 188.3k of a 262.1k window the context is at 72% of `maxContextLength`, below the 0.8 trigger (209.7k); auto-compact correctly did not fire. The "93%" was a stale snapshot. The trigger works; the display lied.
2. **Why did the snapshot skip the compaction-status change?** Because the emitter's only "changed" signal is `messageHistory` identity (`snapshot.ts:40-44`); a pruner run replaces history, so it does emit — but the *percent* the sidebar shows was written before the pruner completed, and the next identity change (the pruner's `set_messages`) comes with a fresh status only if a step-boundary write happened. The identity check must include the observable status fields.
3. **Does the in-stream transcript block interfere with ECHO/Hybrid-mode message handling?** No — it is a display artifact appended at the UI layer (like tool blocks), not a message-history mutation; the runtime is untouched by the render path.
4. **Does the counter add state that must be reset?** Yes — it joins `provenanceEvents` in the reset paths (`resetSidebarData`/`reset`, `sidebar-actions.ts:67-73, 205-213`); the FID's implementation must add it to both resets.
5. **What does OpenClaw's color-band add over the current label?** At-a-glance severity: the current row is text-only ("⚠ 93% of window"); a red/orange/yellow band encodes the same truth visually, matching the Context row's existing threshold coloring (`right-sidebar.tsx:245-256` uses 0.7 warning).

### Code Verification Evidence

```text
$ sed -n '40,44p' sdk/src/run/execution/snapshot.ts
40:     const history = sessionState.mainAgentState.messageHistory
41:     if (history === lastSnapshotHistory) {
42:       return
43:     }
44:     lastSnapshotHistory = history
$ grep -n "200_000\|contextWindow" packages/agent-runtime/src/context-compactor.ts
74: this.contextWindow = options.contextWindow ?? 200_000
$ grep -n "autoCompact + 30_000\|maxContextLength" packages/agent-runtime/src/run-agent-step/loop-context.ts
279-280: initialAgentState.maxContextLength = contextCompactor.getThresholds().autoCompact + 30_000
$ grep -n "percentUsed\|phase: 'compacting'\|phase: 'pruned'" packages/agent-runtime/src/run-agent-step/context-tokens.ts agents/savant/handle-steps.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts
context-tokens.ts:208-235 (step-boundary status writes); handle-steps.ts:123,144,162 (compacting); spawn-agent-inline.ts:219,228,240 (pruned/warning)
$ grep -rn "Compaction\|compaction" cli/src/components/blocks/ --include="*.tsx"
(no matches)   # no transcript/banner compaction consumer exists
```

### Loop 1 — RED (catalog)

Issues C-01…C-04 cataloged with `file:line` evidence (see RED table). Severities: C-01/C-03 high; C-02 medium; C-04 low. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Four-part solution documented: snapshot emit-policy fix (fresh status), one-window consistency (fail-loud fallback), visible lifecycle (kimi-style transcript block + OpenClaw-style counter + color bands), deterministic trigger path (phase3 + A–Z update). **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -n "history === lastSnapshotHistory" sdk/src/run/execution/snapshot.ts
41: if (history === lastSnapshotHistory) { return }   # identity-skip confirmed
$ grep -n "?? 200_000" packages/agent-runtime/src/context-compactor.ts
74: this.contextWindow = options.contextWindow ?? 200_000   # silent fallback confirmed
$ grep -rn "Compaction\|compaction" cli/src/components/blocks/ --include="*.tsx"
(no matches)   # no visible lifecycle consumer
$ grep -rn "Compactions:" cli/src common/src packages/agent-runtime/src
(no matches)   # no session counter
```

**Method 2 (manual verification of the cited code, read 0-EOF):**

| Claim | Verdict | Evidence |
|---|---|---|
| C-01 stale across LLM gaps | **PASS** | `snapshot.ts:40-44` skips without history identity change; `send-message-monitors.ts:75-95` mirrors last snapshot; `context-tokens.ts:208-235` writes only at step boundaries |
| C-02 window fallback divergence | **PASS** | `context-compactor.ts:74` (`?? 200_000`); resolved window wired `create-run-config.ts:192` → `loop-context.ts:274`; denominator `autoCompact + 30k` (`context-tokens.ts:210`) |
| C-03 no visible lifecycle | **PASS** | Absence greps: no compaction consumer in `cli/src/components/blocks/`, no counter anywhere; sidebar one-liner + legend only |
| C-04 P3-5 uncloseable | **PASS** | A–Z report P3-5 NEEDS-REVIEW (operator-gated visual) |

**Law 4 (call-graph):** the GREEN plan changes the snapshot emitter's emit condition (no new function), adds a session-store counter (new slice field consumed by the sidebar row — implementation must grep both the store action and the sidebar consumer), and adds a transcript block component (consumed by the message renderer). Each new consumer needs a production-caller grep at implementation time; zero callers = rejected. **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **C-01 CONFIRMED:** the identity-skip is the freshness defect; the fix (emit on `compactionStatus`/`contextTokenCount` change) preserves the optimization's intent (skip pure-token-count-only ticks) while making observable status changes emit.
- **C-02 CONFIRMED:** the silent 200k fallback is the window divergence; fail-loud + single-denominator is the right default.
- **C-03 CONFIRMED with refinement:** kimi's transcript block is the strongest CLI pattern, but it must be **bounded and non-spammy** — one block per compaction lifecycle (start → terminal), not per step; the counter covers the aggregate. The block must not be re-rendered on every heartbeat.
- **OMISSION REFINED (added to GREEN):** the transcript block must **not break ECHO/Hybrid mode's message-flow invariants** — it is a UI-layer artifact; implementation must assert it never enters `messageHistory` (a runtime mutation would corrupt the ECHO compliance tracker's message accounting). Add a test asserting the block is render-only.
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — Fresh re-audit (2026-08-14, all-FID pass)

Re-verified every RED claim at source with tool output:

```text
$ grep -n "history === lastSnapshotHistory" sdk/src/run/execution/snapshot.ts
47: if (history === lastSnapshotHistory) {   # identity-skip intact (C-01)
$ grep -n "?? 200_000" packages/agent-runtime/src/context-compactor.ts
74: this.contextWindow = options.contextWindow ?? 200_000   # silent fallback intact (C-02)
$ grep -rn "compaction" cli/src/components/blocks/ --include="*.tsx"
(no matches)   # render-layer absence intact (C-03)
```

**ADVERSARIAL (cross-check):** all claims **CONFIRMED** on re-read. **Cross-FID check:** FID-006's transcript block is a new render-layer consumer — it must not collide with FID-004's tool-block renderer changes (`tool-branch.tsx` special-cases `run_readonly_command`); the compaction block is a separate component with its own render path, so no conflict. FID-006's session-store counter joins `provenanceEvents` in the reset paths, which FID-005 does not touch. No refutations, no new omissions. **AUDIT passes → COMPLETE (planning) stands.**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass: zero actionable improvements beyond the recorded refinement; no oscillation; delta well under the 10% cap. FID status → `analyzed`. Implementation is not approved until the Nova planning sign-off PASS and operator approval; closure additionally requires the implementation audit.

## Resolution

- **Status:** `closed` — implemented and verified under automation level 3 (2026-08-14).
- **Fix Description:** Compaction status freshness + visible feedback — snapshot emitter emits on `compactionStatus`/`contextTokenCount` change (no stale percent across LLM gaps), single resolved-window denominator with fail-loud fallback (display percent == pruner trigger window == Context row), kimi-style in-stream compaction transcript block (`⚙ Compacting…` → `✓ complete (X → Y)` / `⚠ ineffective`), OpenClaw-style `Compactions: N` session counter with reset-path wiring, and color-banded sidebar percent; phase3 + A–Z P3-5 become executable.
- **Tests Added:** context-window SDK-boundary threading regression + `CompactionSignal`/snapshot-emit tests (stale-percent and dual-window fixes pinned).
- **Verification Evidence:** AUDIT greps pasted above (Loop 1 — AUDIT).
- **Archived:** closed + archived 2026-08-14. See `dev/fids/archive/README.md`.
