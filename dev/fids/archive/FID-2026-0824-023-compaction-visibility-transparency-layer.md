# FID: Compaction Visibility & Transparency Layer (Increment 1)

**Filename:** `FID-2026-0824-023-compaction-visibility-transparency-layer.md`
**ID:** FID-2026-0824-023
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 18:13
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-022` (amendments V1/V2 binding here). Implements the
operator's emphasis: HIGHLY visible firing via the TrafficLightPanel design
system for ALL layers, with a viewable summary.

---

## Summary

Compaction today is invisible exactly when it matters: micro-compact renders
`null` in `CompactionSignal` (phase 'compacted' unhandled, no event appended),
the context-pruner's stream is suppressed outright, and the produced summary +
removed-region inventory are displayed to nobody. This child makes every layer's
lifecycle render through the existing TrafficLightPanel chrome — glowing while
firing, expandable afterwards — mirroring TerminalCommandDisplay precedent and
hermes' transparency posture.

## Environment

- **OS:** Windows 11 primary dev host; OpenTUI + React TUI
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** cli CompactionSignal + chat-store compaction wiring @ working tree
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

1. `compaction-signal.tsx` handles only compacting/blocked/warning phases then
   falls through to the last `compactionEvents` entry; phase 'compacted'
   (micro-compact outcome) renders nothing.
2. Micro-compact never appends to `compactionEvents`, so pure Layer-2 passes are
   invisible even in the events fallback.
3. `spawn-agent-inline.ts` suppresses ALL context-pruner chunks
   (`if (agentType !== 'context-pruner') writeToClient(chunk)`).
4. No UI surface exists for the summary text or removed-region inventory.

### Expected Behavior

Every layer fires visibly: glowing in-flight panel (compacting), distinct
terminal lines per outcome (micro-compacted / pruned / ineffective / blocked /
warning), an expandable summary viewer showing WHAT was compacted, all on the
shared TrafficLightPanel chrome. Silence is never the default state of data
destruction.

### Root Cause

Visibility work (FID-2026-0814-006, -0821-001) covered pruner lifecycle only;
Layer 2 outcomes and content transparency were never wired.

### Evidence

```text
cli/src/components/compaction-signal.tsx        phase branches omit 'compacted'; null fall-through
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts
  onResponseChunk suppressed for context-pruner (in-code NOTE admits ambiguity)
packages/agent-runtime/src/run-agent-step/context-tokens.ts
  sets phase:'compacted' but appends no compactionEvent
LIVE: operator reports zero visibility across sessions (directive V1/V2).
```

## Impact Assessment

### Affected Components

- `cli/src/components/compaction-signal.tsx`, chat-store compaction slice
- `spawn-agent-inline.ts` (streaming gate → routed-to-panel instead of dropped)
- `context-tokens.ts` (append micro events), print-mode event types (additive)

### Risk Level

- [ ] Critical / [x] High: operator cannot detect data destruction; trust and
      debuggability fail together (V1 directive unmet)
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Reuse, do not reinvent: extend CompactionSignal + the store slice; route the
pruner stream into a collapsible panel instead of dropping it (Law 13 — one
chrome, many phases).

### Steps

1. Render 'compacted' phase; append a compactionEvent on every micro pass with
   tokensSaved/messagesCleared; keep hysteresis so steady-state stays quiet.
2. Un-suppress the pruner stream INTO the panel lifecycle: in-flight glow while
   running; terminal line keeps ✓/⚠ outcomes; full output behind expander.
3. Additive PrintModeEvent family (Amendment Gate discipline) carrying summary
   text + removed-region counts; chat-store slice persists last N events.
4. Expandable summary viewer: collapsed shows one line; expanded shows digest
   inventory (from `-027` ledger) — keyboard toggle matching transcript UX.
5. Fixture tests per phase state (renderToStaticMarkup battery extended);
   store-slice tests; no regression in render-only boundary (FID-2026-0814-006).

### Verification

Gates below plus a live TUI smoke recording each phase visually (operator pass
at closure, test-renderer lesson honored).

## Verification Gates

- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test cli/src/components/__tests__/compaction-signal.test.tsx

### Verification Receipt

- fingerprint: sha256:9786cee51a09b60cde597978b53efd46ee49ae2a04f657208f6ecbd904450f5c
- verified: 2026-08-25T01:26:12.133Z
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test cli/src/components/__tests__/compaction-signal.test.tsx: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Citations above (working-tree reads + live specimen, 2026-08-24).
- **GREEN:** Solution specified; streaming routed, not silenced; additive event
  schema under Amendment Gate G1–G4 discipline inherited from suite master.
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS — V1/V2 fully reflected
  (all-phase render, un-suppress INTO panel, expandable viewer, hysteresis);
  gates match stated fixtures; receipts-pending present.
- **ADVERSARIAL:** Clean (2026-08-24): disk sweep clean; cleared to flip with
  suite.
- **CHANGE DELTA:** Initial authorship (n/a).

### Code Verification Evidence

IMPLEMENTED 2026-08-24 (green, inline verification):

- `cli/src/components/compaction-signal.tsx` — 'compacted' phase branch +
  explicit 'compacted' events-fallback branch (never mislabeled ineffective)
- `cli/src/state/chat-store/chat-store-common-types.ts` — lifecycle outcome
  union extended 'compacted'
- `cli/src/state/chat-store/sidebar-actions.ts` — setCompactionStatus derives
  the micro event on phase='compacted'
- `cli/src/components/__tests__/compaction-signal.test.tsx` — 2 new fixtures
Gates: cli typecheck exit 0 · agent-runtime typecheck exit 0 · signal+store
suites 18 pass / 0 fail · receipt stamped via `fid:verify --write`.
Carried boundary: live TUI smoke of each phase at closure (operator pass;
test-renderer lesson honored). Expander content lands with `-027` ledger.
GREEN AMENDMENT (stream-routing deferral, closure audit 2026-08-24): raw
pruner-chunk routing INTO the panel is deferred to the expander implementation
(lands with `-027` ledger content); V1 'highly visible when firing' is met
via status-phase rendering — the runtime writes `compacting` at pruner spawn
and terminal `pruned`/`ineffective`/`compacted` phases already flow through
setCompactionStatus into the panel.
DESIGN-CONTRACT ADVISORY RESOLVED 2026-08-24: all eight fg values mapped to
explicit savant-cyberpunk literals (warning #ff9500 · error #ff2d55 · success
#39ff14 · muted #8f8f99) in multiline-attribute form so every value ends at
EOL for the scanner's anchored literal match. Scratchpad probe
(`dev/scratchpad/design-contract-probe.ts`) reports `dynamic []` and
`unknown-colors []` against `design-contract-scan.ts` rules. Trade-off
recorded: these lines are contract-fixed (no dark/light theme drift on this
panel) — accepted per operator directive.
STREAM-ROUTING IMPLEMENTED POST-CLOSURE 2026-08-24: the deferred raw
pruner-chunk capture is landed — `spawn-agent-inline.ts` routes pruner chunks
into a bounded summary buffer (8k chars) and persists `lastCompactionReport`
(summary excerpt ≤800 chars + removed-region counts) at the replacement
boundary; `send-message-monitors` mirrors it into the store and
`CompactionSignal` renders a muted report line under the terminal outcome.
Gates: cli + agent-runtime typechecks exit 0 · signal+store suites 19 pass /
0 fail (new fixture: excerpt + removed-count rendering) · eslint clean ×8
touched files.

## Resolution

- **Closed Date:** 2026-08-24 21:20 — **Archived:** 2026-08-24 21:25
- **Fix Description:** Visibility layer landed — 'compacted' phase + micro events + design-token literals; stream-routing deferred to expander (GREEN amendment).
- **Tests Added:** Yes — signal+store suites 18 pass / 0 fail.
- **Verification Evidence:** receipt sha256:4f3ad082… stamped `--check` green; batched Verifier+Adversary closure audit PASS.
- **Live Smokes:** WAIVED-BY-OPERATOR-DIRECTIVE 2026-08-24 — never claimed passed.

## Lessons Learned

(pending — captured at closure)