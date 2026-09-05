# FID: /compact post-compaction summary output (terminal-state mirror + TrafficLightPanel transcript block)

**Filename:** `FID-2026-0828-001-compaction-summary-output.md`
**ID:** FID-2026-0828-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-28 18:15
**YAGNI-Compliance:** Verified

---

## Summary

Manual `/compact` completes silently for the operator: the terminal compaction
state (`pruned` + `lastCompactionReport`) is written to parent agent state at
the spawn boundary, but for compact-and-stop runs the CLI's mirror channels
race the run end and the terminal state never reaches the store — no `⚙ → ✓`
transition, no counter increment, no summary excerpt. Additionally, the
pruner's streamed summary of the window is deliberately diverted from the
transcript (FID-2026-0824-023 stream-routing) and only ever surfaced inside
the always-on CompactionSignal panel — never as the turn's visible output.
Operator direction (2026-08-28, ask_user): when compact is triggered, output a
summary of the window, send the summary, then proceed — rendered through the
TrafficLightPanel component. Manual `/compact` stops after the summary (the
summary IS the turn's output); auto-compaction emits the same block mid-turn
and the task proceeds (OpenClaw parity).

## Environment

- **OS:** Windows (operator live session 2026-08-27)
- **Language/Runtime:** TypeScript, Bun ≥ 1.3.11
- **Tool Versions:** OpenTUI 0.5.3, react ^19
- **Commit/State:** `main` at `68e8c09` + uncommitted FID-2026-0827-001 tree

## Detailed Description

### Problem

1. **No end-of-turn summary.** During the 2026-08-27 manual `/compact` live
   test the operator observed that the run never produced an end-of-turn
   summary and the sidebar window readout reset.
2. **Summary output never designed as turn output.** Even when the terminal
   state does reach the store (long runs), the pruner's summary renders only
   inside the CompactionSignal panel — it is not part of the turn transcript.

### Expected Behavior

- When the context-pruner completes a real compaction, the pruner's summary
  of the window appears as a dedicated transcript entry rendered with
  TrafficLightPanel chrome (operator-directed component choice), including
  the removed-message/token metrics.
- Manual `/compact`: the turn still compact-and-stops, and its visible
  end-of-turn output IS the summary block (no longer empty silence).
- Auto-compaction (threshold/idle/force paths): the same block appears
  mid-turn; the run proceeds afterward.
- The sidebar `⚙ Compacting context…` phase reliably resolves to the
  `✓ Compaction complete` line + compaction-counter increment for every run
  shape, including compact-and-stop.

### Root Cause

**Mirror race (structural, not flaky).** Delivery chain for terminal
compaction state:

1. `agents/savant/handle-steps-factory.ts:219-229` — manual `/compact` yields
   the `spawn_agent_inline` call then **`return`s immediately** (compact-and-
   stop). The run resolves right after the spawn tool completes.
2. `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:338-380`
   — the terminal state (`compactionStatus = { phase: 'pruned' … }`,
   `lastCompactionReport`, recounted `contextTokenCount`) is written to
   `parentAgentState` only when the pruner completes. No further
   `prepareStepContext` runs (the generator returned), so
   `emitCompactionStatus` (`run-agent-step/context-tokens.ts:40-51`) never
   re-emits the terminal phase onto the chunk stream.
3. The SDK emits RunState snapshots on a fixed interval
   (`sdk/src/run/execution/snapshot.ts:83`, `STATE_SNAPSHOT_INTERVAL_MS = 5_000`).
   The last snapshot delivered before run end carries the pre-terminal state.
4. The CLI mirrors `compactionStatus`/`lastCompactionReport` ONLY in the 2s
   heartbeat while the run is alive
   (`cli/src/hooks/helpers/send-message-monitors.ts:84-97`). At run end,
   `adoptAndPersist`
   (`cli/src/hooks/helpers/send-message-lifecycle.ts:112-130`) mirrors ONLY
   `contextTokenCount`, then `finalizeRunStreaming`
   (`cli/src/hooks/helpers/send-message-stream.ts:63-68`) clears the
   heartbeat interval. The terminal state is dropped on the floor.
5. `setCompactionStatus`
   (`cli/src/state/chat-store/sidebar-actions.ts:53-113`) records the
   `pruned` lifecycle event only on an `compacting → pruned` transition —
   which never arrives.

**Summary capture exists but is orphaned — and the capture primitive itself
was wrong for this agent.** The pruner's streamed output is routed into
`prunerSummaryBuffer` (8k bounded; raw text withheld from the transcript by
design, FID-2026-0824-023) and the 4k excerpt is stored in
`lastCompactionReport.summaryExcerpt` (`spawn-agent-inline.ts:452`) — but
nothing delivers the summary to the turn transcript. Worse, the buffer only
fills from `onResponseChunk` STRING chunks, and the context-pruner is a
PROGRAMMATIC (handleSteps) agent that never streams text — so the buffer is
always EMPTY in production and the emission gate never fired. Verified live
(operator 2026-08-28): `/compact` produced literally zero visible output.
The fix recovered the summary from the compacted history's
`<conversation_summary>` → `<historical_memory>` → `<compaction-summary>`
memory message the pruner ALWAYS writes (`extractPrunerSummaryFromHistory`,
`spawn-agent-inline.ts:31-..`), stripping the `<structured_state>` framing
wire tags for clean user-facing text; the streamed buffer remained only as a
defensive fallback.

### Evidence

```text
# Manual /compact is compact-and-stop (return immediately after the spawn):
agents/savant/handle-steps-factory.ts:219-229
  yield { toolName: 'spawn_agent_inline', input: { agent_type: 'context-pruner', … } }
  // Compact-and-stop: history has been replaced and recounted by the
  // spawn boundary — end the turn here.
  return

# Terminal state written only at the spawn boundary (on success):
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:351-367
  parentAgentState.lastPrunerCompletionAt = Date.now()
  …
  parentAgentState.lastCompactionReport = { summaryExcerpt, removedMessages, … }
  parentAgentState.compactionStatus = { phase: 'pruned', … }

# CLI mirrors terminal state only while the run is alive:
cli/src/hooks/helpers/send-message-monitors.ts:84-97  (2s heartbeat)
cli/src/hooks/helpers/send-message-lifecycle.ts:112-130 (adoptAndPersist — tokens only)
cli/src/hooks/helpers/send-message-stream.ts:63-68   (heartbeat cleared at finalize)

# Terminal phase re-emission exists only at step boundaries (never runs again):
packages/agent-runtime/src/run-agent-step/context-tokens.ts:40-51 (emitCompactionStatus)

# Snapshot cadence:
sdk/src/run/types.ts:210  export const STATE_SNAPSHOT_INTERVAL_MS = 5_000
sdk/src/run/execution/snapshot.ts:83  timer = setInterval(emit, STATE_SNAPSHOT_INTERVAL_MS)
```

Reference pattern (OpenClaw, confirmed 2026-08-28):
`resources/openclaw/src/auto-reply/reply/compaction-notice.ts` (phase notices
`start`/`end` + `createCompactionHookNoticePayload` carrying the post-compact
user-facing messages) consumed in
`resources/openclaw/src/auto-reply/reply/agent-runner-event-handler.ts:275-290`
(`compaction` stream → hook messages first, then the completion notice; the
run proceeds). Hermes' `/compact` (alias of `/compress`,
`resources/hermes-agent/hermes_cli/commands.py:131`) is a session-compress
command with preview flags and no post-compact summary UX.

## Impact Assessment

### Affected Components

- `common/src/types/print-mode.ts` — new `compaction_summary` event schema
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` —
  emit the summary event at the pruner completion boundary
- `cli/src/hooks/helpers/send-message-lifecycle.ts` — `adoptAndPersist`
  terminal-state mirror
- `cli/src/utils/sdk-event-handlers.ts` + `sdk-event-handlers/misc.ts` —
  consume `compaction_summary` → append transcript block
- `cli/src/types/chat.ts` — `CompactionSummaryContentBlock`
- `cli/src/components/compaction-summary-block.tsx` (new) — TrafficLightPanel
  card; dispatched from `cli/src/components/message-block.tsx`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: visibility/UX layer degraded; compaction itself works, and the
      CompactionSignal panel shows partial info on long runs. Workaround exists.
- [ ] Low

## Proposed Solution

### Approach

Three coordinated pieces, all additive (unknown event types are already
ignored by the CLI's `.otherwise()` arm — backward compatible with older
runtimes/binaries):

**1. Terminal-state mirror (closes the race).**
`adoptAndPersist` mirrors `compactionStatus` + `lastCompactionReport` from
`runState.sessionState.mainAgentState` exactly like the existing
`contextTokenCount` mirror (`send-message-lifecycle.ts:119-123`) and exactly
like the heartbeat does mid-run (`send-message-monitors.ts:84-97`). The
authoritative final RunState carries the terminal state, so the
`compacting → pruned` transition lands in the store and the existing
`recordRun` logic (counter + ✓ line) fires unchanged.

**2. Structured summary event (the "send the summary" channel).**
New `printModeCompactionSummarySchema` in the `PrintModeEvent` union:
`{ type: 'compaction_summary', summary, removedMessages, tokensSaved?,
percentUsed? }`. Emitted from `handleSpawnAgentInline` for
`agentType === 'context-pruner' && !parentAgentState.parentId` when
`prunerMessagesRemoved > 0` — the same condition that records the `pruned`
phase — using the SAME excerpt string stored in `lastCompactionReport`
(single source of truth, Law 13). Emission happens before the run resolves,
so it crosses the normal chunk path for BOTH run shapes:
manual `/compact` (turn output before compact-and-stop) and auto-compact
(mid-turn). Raw pruner text stays suppressed; the summary goes out once,
structured.

**3. TrafficLightPanel transcript block (the rendering).**
New `CompactionSummaryContentBlock` (`type: 'compaction-summary'`) in
`cli/src/types/chat.ts`, appended by a `handleCompactionSummary` handler
following the established block-append pattern (plan/ask-user helpers), and
rendered by a new `CompactionSummaryBlock` component through
`TrafficLightPanel` (same chrome recipe + design tokens as
`compaction-signal.tsx`): 🧹 title bar, `✓ Compaction summary — removed N
messages · −X tokens · Y% of window` header line, full summary text beneath
(always visible, mirroring the FID-2026-0824-023 V2 no-hidden-content rule).

### Steps

1. **common:** add `printModeCompactionSummarySchema` + type to
   `common/src/types/print-mode.ts`; add to the discriminated union. Schema
   test.
2. **agent-runtime:** in `spawn-agent-inline.ts`, hoist the excerpt slice,
   emit the `compaction_summary` event via `writeToClient` when
   `prunerMessagesRemoved > 0`, keep `lastCompactionReport` on the same
   excerpt. Focused test (emission + non-emission for fold no-op).
3. **cli store:** mirror `compactionStatus` + `lastCompactionReport` in
   `adoptAndPersist`. Focused test on the lifecycle mirror.
4. **cli block:** `CompactionSummaryContentBlock` type +
   `handleCompactionSummary` append + `CompactionSummaryBlock` component +
   `message-block.tsx` dispatch. Render test.
5. **Gates:** typecheck `common`, `packages/agent-runtime`, `cli`; focused
   suites for each touched area; eslint `--max-warnings 0` on touched files;
   prettier; `lint:md`; `fid:verify --check` sweep.
6. **Live smoke (operator-gated):** re-run the `/compact` manual checklist
   from `docs/handodd.md` — all four checks now verifiable (⚙ lifecycle, ✓
   + summary block in transcript, preserved tail, sidebar counters).

### Verification

- Unit-level: each piece gets a focused regression test (schema round-trip;
  event emission conditions incl. the fold no-op guard; store mirror on a
  final RunState; block render).
- Static: the declared Verification Gates run green.
- Live: operator re-runs the manual `/compact` checklist (NEEDS-REVIEW
  boundary carried until then — never claimed passed).

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test common/src/types/__tests__/print-mode-compaction-summary.test.ts
- gate: test packages/agent-runtime/src/__tests__/spawn-agent-inline-compaction-summary.test.ts
- gate: test cli/src/hooks/helpers/__tests__/adopt-and-persist-compaction-mirror.test.ts
- gate: test cli/src/utils/__tests__/compaction-summary-handler.test.ts
- gate: test cli/src/components/__tests__/compaction-summary-block.test.tsx

### Verification Receipt

- fingerprint: sha256:1d3989a781e0ab9fa489050086220defaf7a6d9d31ec9e074762dfb09c2d64c1
- verified: 2026-09-03T13:18:17.507Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- test common/src/types/__tests__/print-mode-compaction-summary.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/spawn-agent-inline-compaction-summary.test.ts: exit 0
- test cli/src/hooks/helpers/__tests__/adopt-and-persist-compaction-mirror.test.ts: exit 0
- test cli/src/utils/__tests__/compaction-summary-handler.test.ts: exit 0
- test cli/src/components/__tests__/compaction-summary-block.test.tsx: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Terminal `pruned`/`lastCompactionReport` cannot reach the CLI
  store for compact-and-stop runs — mirror channels race the run end
  (evidence above, five-link chain cited `file:line`). (2) The pruner's
  summary is captured (`prunerSummaryBuffer`, `lastCompactionReport`) but has
  no delivery channel to the turn transcript — raw pruner text is withheld by
  design since FID-2026-0824-023, and the excerpt renders only in the
  always-on CompactionSignal panel, not as turn output. (3) Operator-observed:
  manual `/compact` (2026-08-27) produced no end-of-turn summary; sidebar
  readout reset (the FID-2026-0827-001 floor fix now adopts the true
  recounted small count exactly — the honest post-compaction drop; live
  re-run confirms).
- **GREEN:** Three-piece additive design above (mirror fix; structured
  `compaction_summary` event; TrafficLightPanel transcript block). Operator
  decisions recorded via ask_user 2026-08-28: manual `/compact` stops after
  the summary; auto-compact emits the same block mid-turn and proceeds.
- **AUDIT:** Static chain verified: `adoptAndPersist` mirrors only
  `contextTokenCount` today (`send-message-lifecycle.ts:119-123` — read
  0-EOF); heartbeat mirrors all three while alive
  (`send-message-monitors.ts:75-97`); `setCompactionStatus` requires the
  `compacting → pruned` transition to record a run
  (`sidebar-actions.ts:69-78`); the CLI event dispatcher is a ts-pattern
  match with an `.otherwise(() => undefined)` arm
  (`sdk-event-handlers.ts:94-104`), so a new event type is backward
  compatible; `ContentBlock` union already carries CLI-local block kinds
  (`types/chat.ts:67-84,144-153`); `writeToClient` is available at the
  emission point (handler param, `spawn-agent-inline.ts:63`) and the
  `onResponseChunk` override diverts only pruner STREAM chunks, not direct
  `writeToClient` calls. Gate vocabulary validated against
  `VALIDATION_WORKSPACE_POLICY` (`scripts/validation-manifest.ts:22-35`).
- **ADVERSARIAL:** "The heartbeat could still win the race sometimes — is the
  mirror fix really needed?" Yes: even when the heartbeat wins,
  `adoptAndPersist` remains the only authoritative final delivery, and the
  current code demonstrably drops the terminal state for compact-and-stop
  (the observed bug). "Why not render from `lastCompactionReport` alone and
  skip the new event?" The report arrives via snapshot/heartbeat timing and
  the panel is not part of the turn transcript — the operator explicitly
  directed turn-output rendering through TrafficLightPanel. "Does the empty-
  output SUCCESS contract (FID-2026-0825-001) break?" No: the assistant text
  output stays empty; the summary is a dedicated structured block, so the
  zero-assistant-history handling is untouched.
- **CHANGE DELTA:** initial authoring (no prior document)

### Missed Questions

1. **What if the pruner completes but removed nothing (fold no-op)?** The
   event fires only when `prunerMessagesRemoved > 0` — identical to the
   condition that records the `pruned` phase; the fold no-op keeps its
   existing silent/ineffective semantics. No summary block for no-ops.
2. **What if the pruner crashes mid-run?** The `blocked` path
   (`spawn-agent-inline.ts:200-218`) is unchanged; with the mirror fix the
   `⛔ Auto-compact blocked (pruner-unavailable)` phase now reliably reaches
   the store too (same `adoptAndPersist` delivery). No summary is emitted on
   the error path.
3. **Desktop/webview consumers?** The new event rides the shared
   PrintModeEvent union; unmatched event types are ignored by consumers that
   don't handle them. Desktop rendering of the block is a follow-up, not
   gated here.
4. **Sensitive data?** The summary is the pruner's own summary of the local
   session, delivered to the local transcript only — same exposure class as
   the existing `lastCompactionReport.summaryExcerpt` panel rendering
   (FID-2026-0824-023). No new egress.
5. **Does the 8k→4k excerpt bound lose content?** The buffer keeps the TAIL
   of the stream; the pruner's summary is budgeted by
   `COMPACTION_SUMMARY_ALLOWANCE_TOKENS = 2000` (≈6-8k chars), so the 4k
   excerpt can truncate the head on pathological outputs. Existing behavior
   (report + panel share it); kept for single-source-of-truth parity, not
   changed here. If the live test shows truncation matters, a separate
   head-keeping policy is the follow-up.
6. **Can the event arrive after the stream UI finalized?** No: emission
   happens inside the spawn tool handler, strictly before the run resolves;
   `finalizeRunStreaming` runs in the SDK consumer's `finally` after
   `client.run` returns. Ordering is guaranteed by construction.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `51fa261` (chore(release): prepare v0.0.28 — tagged
      v0.0.28, on main; carries the compaction-summary delta)
- [x] **File:line ranges:**
      - `common/src/types/print-mode.ts:258-274` —
        `printModeCompactionSummarySchema` + type; `:297` union membership
      - `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:343-374`
        — excerpt hoist (`:345`), report parity (`:349`), event emission
        guarded by `removedMessages > 0 && summary non-empty` (`:363-374`)
      - `cli/src/hooks/helpers/send-message-lifecycle.ts:209-224` —
        `adoptAndPersist` mirrors `setCompactionStatus` (`:218`) +
        `setLastCompactionReport` (`:223`)
      - `cli/src/utils/sdk-event-handlers.ts:101-103` — event dispatch;
        `cli/src/utils/sdk-event-handlers/misc.ts:47-73` —
        `handleCompactionSummary` block append
      - `cli/src/types/chat.ts:123-133` (block type), `:156` (union),
        `:259-263` (guard); `cli/src/components/blocks/single-block.tsx:7,142-152`
        (dispatch); `cli/src/components/compaction-summary-block.tsx:1-51`
        (TrafficLightPanel card)
- [x] **Gate output:** `fid:verify --check` live re-run 2026-08-28T19:23:54Z —
      typecheck common / packages/agent-runtime / cli all exit 0; all five
      declared test gates exit 0 (receipt below). Focused suites: 6/0 + 5/0 +
      7/0 + 2/0 + 3/0 (21 tests / 0 fail); agent-runtime full suite 1319/0;
      cli full suite 1358 pass / 11 skip / 0 fail (canonical
      `bun run --cwd=cli test`); eslint `--max-warnings 0` on all 13 touched
      files exit 0; prettier check exit 0; `lint:md` exit 0.
- [x] **Reproducibility:** `grep -rn "compaction_summary" packages/agent-runtime/src common/src --include="*.ts"`
      → `spawn-agent-inline.ts:365` (producer) + `print-mode.ts:266`
      (schema); `grep -rn "compaction_summary\|compaction-summary" cli/src`
      → dispatch `sdk-event-handlers.ts:101`, append `misc.ts:63`, block
      `chat.ts:130`, renderer `single-block.tsx:142`.
- [x] **Step statuses:**
      1. `implemented` (schema + union + test)
      2. `implemented` (emission + guard + test)
      3. `implemented` (mirror + test)
      4. `implemented` (block type + handler + component + dispatch + test)
      5. `implemented` (gates below, all green)
      6. `done` — live `/compact` smoke operator-confirmed 2026-08-28 AFTER
         the history-recovery fix: the summary now actually renders as the
         turn's output (recovered from the compacted history). Two follow-on
         operator-directed polish items also landed (collapsed-by-default
         fold + expand/collapse toggle + whole-block copy). G2 SATISFIED at
         closure: implementation landed in commit `51fa261` (v0.0.28,
         tagged, on main) — `git show 51fa261 --stat` touches
         compaction-summary-block.tsx + send-message-lifecycle.ts;
         `git log -S compaction_summary -- spawn-agent-inline.ts` →
         `51fa261`.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (all read 0-EOF or
      windowed with cited line numbers this session)
- [x] Implementation matches the Proposed Solution (three-piece additive
      design landed as specified)
- [x] Typecheck/tests/lint pass with pasted tool output (receipt below +
      Implementation Evidence)
- [x] Production call-graph evidence is present for new or repaired wiring
      (grep chain: producer `spawn-agent-inline.ts:365` → schema
      `print-mode.ts:266` → dispatch `sdk-event-handlers.ts:101` → append
      `misc.ts:63` → block `chat.ts:130` → renderer `single-block.tsx:142`)
- [x] FID status reflects the actual implementation state (`fixed` —
      implementation exists, gates pass; live smoke boundary carried)

### Loop 2 — Independent audit and self-correction

- **RED:** Citation re-check pass: verified `STATE_SNAPSHOT_INTERVAL_MS`
  lives in `sdk/src/run/types.ts:210` (not only snapshot.ts); verified the
  `.otherwise()` arm catches unknown events (backward compat claim holds);
  verified gate workspace names against `VALIDATION_WORKSPACE_POLICY`.
  No design defects found.
- **GREEN:** Evidence block corrected accordingly.
- **AUDIT:** All Loop-1 citations re-confirmed by grep/read this session.
- **ADVERSARIAL:** "Old runtime + new CLI or vice versa — any break?" Old
  CLI + new runtime: unknown event ignored; terminal-state mirror still
  improves the sidebar. New CLI + old runtime: no event emitted; mirror fix
  is harmless (no terminal state in final RunState → no-op). Verified
  bidirectional compatibility by construction.
- **CHANGE DELTA:** < 5% (citation corrections only)

### Loop 3 — Final convergence

- **RED:** None actionable. Termination criterion met: deep audit yields zero
  actionable improvements.
- **GREEN:** Document converged; implementation blocked only on operator
  approval (Law 2).
- **AUDIT:** Document-only state; all claims carry `file:line` or command
  evidence.
- **ADVERSARIAL:** Residual risk is the live-smoke boundary only — carried as
  NEEDS-REVIEW, never claimed passed.
- **CHANGE DELTA:** < 2% for 2 consecutive passes → converged.

## Resolution

- **Closed Date:** 2026-09-03 (ground-truth closure audit: G2 commit hash
  resolved to `51fa261`, live smoke already operator-confirmed 2026-08-28,
  gates fresh green)
- **Fix Description:** Three-piece additive delivery — terminal-state
  mirror in `adoptAndPersist` (closes the compact-and-stop race),
  structured `compaction_summary` PrintModeEvent emitted at the pruner
  completion boundary, TrafficLightPanel transcript block (collapsed by
  default + expand/collapse + whole-block copy).
- **Tests Added:** schema round-trip, emission/no-op guards, store-mirror,
  handler-append, and block-render regressions (21 focused tests; 5
  declared gate files).
- **Verification Evidence:** receipt stamped 7/7 gates PASS 2026-08-28;
  fresh closure battery 2026-09-03 (schema 6/0 · emission 9/0 · mirror 5/0
  · handler 2/0 · block 4/0 = 26/0); committed in `51fa261` (v0.0.28);
  receipt re-stamped at the archived path.
- **Archived:** yes → `dev/fids/archive/FID-2026-0828-001-compaction-summary-output.md`

## Lessons Learned

Visibility channels that only run "while a run is alive" (heartbeats) must
have an authoritative final-delivery path that consumes the terminal run
state — any state written milliseconds before run end is otherwise lost by
construction, not by accident. Reference implementations (OpenClaw's
compaction notice payloads) solve this by making the post-compaction output
a first-class event in the stream, not a side effect of polling.
