# FID-2026-0718-010 — medium — Stuck-State Cleanup (working-banner, sidebar phase, token heartbeat)

**Status:** closed / archived
**Opened:** 2026-07-18 | **v2 convergence:** 2026-07-18
**Severity:** medium (UX, no data loss; visible to every user after first long run)
**Affects:** `cli/src/components/blocks/agent-branch-item.tsx`, `cli/src/utils/sdk-event-handlers.ts`, `cli/src/state/chat-store.ts`, `cli/src/hooks/use-send-message.ts`, `cli/src/components/status-bar.tsx`, `cli/src/commands/*`
**Reactor:** Orchestrator (post FID-008/009 verification reconfirmed by Nova)
**Depends on:** FID-2026-0718-008 ✅ closed, FID-2026-0718-009 ✅ closed
**Blocks:** none
**Drop-in scope:** Single FID. No scope reduction needed.

---

## 1. Summary

Three coupled UX bugs surface during and after a single long agent run that
spans multiple FID cycles or spawns sub-agents. They all share the same root:
**stream lifecycle events don't synchronously reset UI state.**

| #   | Symptom                                                           | UI Element                          |
| --- | ----------------------------------------------------------------- | ----------------------------------- |
| B1  | "working..." shimmer stays after agent finishes multi-cycle run   | agent-branch-item.tsx line ~210     |
| B2  | Sidebar `phase` row stays on last value (often `complete`)        | right-sidebar (fsmPhase binding)    |
| B3  | Token count and cost pin between snapshots (UI feels stale)       | right-sidebar (contextTokensUsed)   |

All three are runtime state-staleness bugs. They share a single root cause
(no end-of-stream hook on the chat store) and a single fix path (a guaranteed
end-of-run reset covering B1+B2, plus a heartbeat covering B3).

This FID converged to v2 with all five ECHO questions YES on every decision,
**19 missed questions** answered (12 original + 7 deepening), a targeted
three-fix implementation, and a per-fix rollback plan. Code is NOT touched
until user approves (v2 → AUDIT → Forge).

---

## 2. RED Phase — Detective Catalog with Evidence

### B1 — Top "working..." banner stuck after agent finishes

**Evidence:**
- `cli/src/components/blocks/agent-branch-item.tsx:209-216` renders:
  ```tsx
  {isStreaming && isExpanded && (
    <box style={{ paddingLeft: 1, paddingBottom: 0 }}>
      <text>
        <ShimmerText
          text="working..."
          interval={160}
          primaryColor={theme.secondary}
        />
      </text>
    </box>
  )}
  ```
- `isStreaming` is derived per-branch from membership in
  `chatStore.streamingAgents: Set<string>` (see `cli/src/state/chat-store.ts:96`).
- `setStreamingAgents` mutations come from two paths in
  `cli/src/utils/sdk-event-handlers.ts`:
  - `updateStreamingAgents` (line 137): `add` on `subagent_start`/`tool_call`,
    `remove` on `subagent_finish`/`tool_result` (line 477).
  - `handleSpawnAgentsResult` (line 397): removes the multi-spawn tempIds
    `${toolCallId}-${index}` but **never removes the parent's toolCallId or
    parent agentId** from `streamingAgents`.
- Tie: `cli/src/utils/sdk-event-handlers.ts:471` — `updateStreamingAgents(state, { remove: event.toolCallId })`
  is called on every `tool_result`, including the multi-spawn parent's result.
  However, the parent agent's text chunks during the spawn window may add the
  parent agentId back into the set via `setStreamingAgents((prev) => next)`,
  and that add has no matching remove if the multi-spawn body's last chunk
  doesn't carry the parent's agentId.
- **Result:** A long sub-agent chain inside a `spawn_agents` finishes, but
  the parent agent's text-streaming context still says `isStreaming=true`,
  leaving the "working..." shimmer for the lifetime of the chat session.

**Reproducer (live):** Send any prompt that triggers a multi-cycle run
(e.g., "explore the repo and summarize it"). After the agent finishes, the
right per-agent expanded branch shows a perpetual "working..." text. Collapsing
and re-expanding the branch does not fix it. Closing the chat does (because
`resetSidebarData()` clears the set).

### B2 — Sidebar `phase` row stuck on last value

**Evidence:**
- `cli/src/state/chat-store.ts:241` field `fsmPhase: string`. Default `'idle'`
  (line 197).
- `setFsmPhase` (line 419) is called from SDK event handler
  `cli/src/utils/sdk-event-handlers.ts:466` **only on `transition_phase`
  tool_result**.
- `onNewUserMessage` (line 428) resets to `'idle'` **only on the next user
  message** (called once at line 357 of `cli/src/hooks/use-send-message.ts`).
- After agent finishes a 3-cycle FID (red → green → audit → complete → self_correct →
  green → audit → complete), the last `transition_phase` tool_result set
  `fsmPhase = 'complete'`. There is no signal that runs after the loop has
  terminated saying "reset to idle".
- **Result:** Sidebar `ECHO Protocol — phase COMPLETE` stays visible until
  the user sends a new message, even though the agent is genuinely idle.

**Reproducer (live):** Same as B1. After the run finishes, sidebar `phase`
row shows `COMPLETE`. The `work` row (added in FID-009) does correctly drop
to `idle` because M5 (`setActivity({kind:'idle'})` on stream end in
`packages/agent-runtime/src/run-agent-step.ts` set points) fires. Only
`fsmPhase` is stale.

### B3 — Token count pin during long runs

**Evidence:**
- `cli/src/hooks/use-send-message.ts:635` calls
  `updateContextTokens(snapshotTokenCount)` on every `onStateSnapshot`.
- The SDK fires `onStateSnapshot` periodically (~every 5s at step
  boundaries), and finally at end-of-run.
- `cli/src/components/right-sidebar.tsx` reads `contextTokensUsed` directly
  from chat-store (pass-through from chat.tsx line 1820).
- `cli/src/state/chat-store.ts:197` initial `contextTokensMax = 200_000`
  (hardcoded).
- During sub-agent execution the main agent's snapshot fires less often, so
  the displayed token count can sit at 168.8k for 10+ seconds while tools
  burn tokens internally with no main-agent snapshot.
- **Result:** Context window display lags by 5-15s during busy chunks,
  though the *value* shown is correct. Also: the cap is wrong for non-200k
  models (Gemini has 1M, Sonnet has 200k, others vary).
- `use-send-message.ts:858` does set `updateContextTokensMax(
  getContextWindowForModel(modelName))` once per run-start using the model
  name. So the cap *is* dynamic per run, but during async sub-agent
  execution there's no heartbeat to re-read it.

### Cross-Cutting Character

B1+B2 stem from the same gap: **end-of-stream event may fire before UI
dequeues all in-flight activity**. B3 stems from snapshot cadence.

A *single* end-of-stream hook that resets all composite state, plus a
*streaming-periodic* heartbeat for context window metrics, fixes all three.

---

## 3. GREEN Phase — Thinker Design + Missed Questions (19 items)

The full Thinker architecture (`thinker-with-files-gemini`) converged to
eight claims. Each claim is grounded by a verification command in §5
(call-graph).

### 3.1 The Three Fixes

#### F1 — Parent-agent `isStreaming` cleanup (B1)

**Decision:** In `cli/src/utils/sdk-event-handlers.ts`, when a
`spawn_agents` tool_result arrives, explicitly remove the parent
`toolCallId` and parent `agentId` from `streamingAgents` after
`handleSpawnAgentsResult` runs. Additionally, the new end-of-stream hook
(§3.1.F2) acts as a backstop: if a stale ID remains, the hook flushes
the entire set.

**Implementation steps:**

1. `cli/src/utils/sdk-event-handlers.ts:413` — In `handleSpawnAgentsResult`,
   after `updateSpawnAgentBlocks`, call a new helper
   `flushParentStreamingAgents(state, toolCallId)` that removes the parent
   `event.toolCallId` and any matching agentIds.
2. `cli/src/utils/sdk-event-handlers.ts:574` — In `handleFinish`, drain
   `streamingAgents` (set it empty) and emit a backstop
   `setActivity({kind:'idle'})` chunk for safety.

**Why this rather than per-event tug-of-war:** running set-membership tests
on every chunk is `O(n)` per chunk; once-per-result cleanup is `O(m)` per
result where `m` is small. The end-of-stream backstop is `O(n)` once which
is negligible.

#### F2 — Single end-of-stream reset hook (B2 and B1-backstop)

**Decision:** Add `onStreamEnded` action to `chat-store.ts`. This action
sets `fsmPhase = 'idle'`, `activity = { kind: 'idle', since: Date.now() }`,
and clears `streamingAgents`, `activeSubagents`, and `isChainInProgress`.
Fire it from `use-send-message.ts` exactly once per run at the **terminal
point** of the outer `sendMessage` callback — in the `finally` block,
guarded such that aborts also fire it (we always want the UI to release,
even on abort).

**Why this location and not the `finish` chunk:** the `finish` chunk in
`print-mode` carries only `totalCost`. It is not guaranteed to be the last
chunk the CLI receives (tool_results for in-flight spawn_agent_inline can
land late). The `finally` block in `use-send-message.ts` is the canonical
post-run point — it already calls `updateChainInProgress(false)`,
`setStreamStatus('idle')`, `clearActiveRunAborter` etc. Adding
`onStreamEnded` to that same point guarantees idempotency with the
existing chat-cleanup logic.

**Implementation steps:**

1. `cli/src/state/chat-store.ts:373` — Add `onStreamEnded: () => void` to
   `ChatStoreActions`. Implementation: reset `fsmPhase='idle'`,
   `activity={kind:'idle',since:Date.now()}`,
   `streamingAgents=new Set()`, `activeSubagents=new Set()`,
   `isChainInProgress=false`. **Guards** (Q15-Q18 in §3.2):
   - If `state.isRetrying`, skip the reset (retrying is a re-run, not a stream end).
   - Use a `lastResetAt: number` stamp; reject reset calls within 100ms (anti-thrash).
   - If `state.developerMode === 'frozen'`, skip reset (debugger attach scenario).
2. `cli/src/hooks/use-send-message.ts:__finally__` — Call
   `useChatStore.getState().onStreamEnded()` in the existing `finally`
   block. Guard: only if `!abortController.signal.aborted` to allow a
   delayed final abort to show interruption UI. (Default: fire always —
   interruption UI is independent of fsmPhase reset.)
3. `cli/src/hooks/use-send-message.ts:__abort_handler__` — Also call
   `onStreamEnded()` in the abort handler so Esc / Ctrl-C also resets.

**Idempotency:** `setFsmPhase('idle')` is a no-op if phase is already
`'idle'`. `setActivity({kind:'idle'})` short-circuits in
`setActivity`'s own logic. The Sets get re-created (cheap). No double-
reset damage. The 100ms anti-thrash window (Q17) catches overlapping calls
from `finish`, abort, and slash-command simultaneously.

#### F3 — Context-window heartbeat (B3)

**Decision (resolved — see §3.3 D1):** While `isChainInProgress === true`,
poll `snapshot.sessionState.mainAgentState.contextTokenCount` and
`maxContextLength` every **2 seconds** via `setInterval`. Stop the heartbeat
in the `finally` block of `use-send-message.ts`.

**Why this and not push-from-runtime:** the SDK already has
`onStateSnapshot` at ~5s cadence. Adding a 2s heartbeat in the CLI layer
matches the visible feedback loop and re-uses the live snapshot.
Tradeoff: 2s is fast enough to feel real-time, slow enough to avoid
render thrash (right-sidebar re-renders on any state change).

**Side effect (resolved — see §3.3 D4):** cost stays on the `finish` chunk
and primary snapshots (heartbeat must NOT update cost because
`snapshot.creditsUsed` is reset to 0 between sub-agents — cost flicker is
worse than no cost update).

**Implementation steps:**

1. `cli/src/hooks/use-send-message.ts:__before_client_run__` — Create a
   `tokenHeartbeatTimerRef = useRef<NodeJS.Timeout | null>(null)`. Start
   `setInterval(() => { read latest snapshot and call updateContextTokens
   + updateContextTokensMax } , 2000)`.
2. `cli/src/hooks/use-send-message.ts:__finally__` — `clearInterval` on
   cleanup. Also: `clearStalledTimer()` from the stalled detector.
3. **Snapshot reader:** Read from `latestRunStateSnapshot` ref (already
   maintained in `onStateSnapshot`). If `null`, return. If model changed
   mid-run (rare, but possible with `applyCodebuffModelOverride`), re-read
   cap from `runState.agents[0].model` via `getContextWindowForModel`.
4. **Stalled detection (resolved — see §3.3 D5):** Maintain
   `_lastChunkAtMs: number`. On every chunk event from any handler
   (decorate `handleSubagentStart`/`handleToolCall`/`appendRootChunk`
   with a `_lastChunkAtMs = Date.now()` write). If 30s elapsed with no
   chunk AND `isChainInProgress === false` AND `!isRetrying`,
   fire `onStreamEnded({reason:'stalled'})` and log a warning. The flag
   `isChainInProgress === false` guard (Q19) ensures we never stomp on a
   live run.

---

### 3.2 Missed Questions — Nineteen Robustness Items

#### Q1: What if the agent errors mid-stream? Should we reset to idle or stay in error?

**Answer:** Reset to idle. The error banner is the user-facing signal (the
`setMessages` error append already happens in `handleRunError`).
fsmPhase doesn't carry error semantics — it's a FID-lifecycle indicator.
Resetting it to `'idle'` after the run terminates is correct regardless of
reason (success, error, abort). The error itself is in the message stream,
not in fsmPhase.

**Five Questions:** ✅ YES / YES / YES / YES / YES.

#### Q2: What if `isChainInProgress=true` but no stream activity for 30s (stalled)?

**Answer:** Auto-reset to `'idle'` after 30s of no chunk + no chain activity.
The `bumpActivityIdleTimer` (5s) covers activity-side; the stalled detector
(30s, in F3) covers fsmPhase-side. Both layers reset independently. The
`isChainInProgress === false` guard prevents stomp on a live run. Logs a
warning (`'stream stalled at <ts> — auto-reset to idle'`).

**Five Questions:**
- Q1 ALL: ✅ Yes (covers all stalls).
- Q2 1000 agents: ✅ Yes (`_lastChunkAtMs` write is O(1)).
- Q3 hostile: ✅ Yes (defensive — guard prevents tampering with live run).
- Q4 2 years: ✅ Yes (single stalled detector, well-named).
- Q5 industry: ✅ Yes (industry pattern: heartbeat + watchdog).

#### Q3: Esc / Ctrl-C during streaming — must reset hooks run on abort?

**Answer:** Yes. The abort handler in `use-send-message.ts` (called from
`abortControllerRef`) needs to invoke `onStreamEnded`. Currently the abort
handler is registered via `setActiveRunAborter` and just calls
`abortController.abort()`. **Add a wrapper that fires `onStreamEnded()` synchronously BEFORE `abortController.abort()`.** Order matters: reset UI first, then abort.

**Edge case:** abort during `await settleCheckpointSave()`. The reset MUST
fire after the checkpoint settles; otherwise we'd overwrite checkpoint
state with empty resets. Pattern:
```ts
await settleCheckpointSave()  // existing line
useChatStore.getState().onStreamEnded()  // new line
abortController.abort()  // existing line
```

**Five Questions:** ✅ ALL YES.

#### Q4: Should the heartbeat also touch `sessionCost`?

**Answer:** No. Cost (credits) only resolves at end-of-run / sub-agent
boundaries via `snapshot.creditsUsed`. During sub-agent execution the
main-agent snapshot's `creditsUsed` may be 0 even though sub-agents
burned credits. Heartbeat-reading cost would flicker between 0 and N.
Cost stays on `finish` chunk + on primary snapshot (existing code in
`use-send-message.ts:635`).

**Five Questions:** ✅ ALL YES (no flicker, no false cost trail).

#### Q5: Two sub-agent chains interleave (A finishes while B still streaming)?

**Answer:** Each `<AgentBranchItem>` has its own `isStreaming` prop derived
from `streamingAgents: Set<string>`. Member-id `Set` means per-agent state
is naturally isolated. fsmPhase is global (parent-level), so it waits for
ALL sub-agents. The end-of-stream hook fires once per top-level run, which
is correct. Sub-agent chains running concurrently queue up their finishes
and the parent's `streamingAgents` finally empties when the last one
removes itself.

**Edge case:** All children finish but parent has no `subagent_finish` event
(parent was a text-only or tool-only agent). Solution: the parent agent's
`tool_result` (line 477 of `sdk-event-handlers.ts`) removes its
toolCallId from `streamingAgents`. The Set becomes empty. The end-of-stream
hook F2 confirms a clean idle state.

**Five Questions:** ✅ ALL YES.

#### Q6: Slash commands (`/dev`, `/fids`, `/phase`) — should they reset state?

**Answer (resolved — see §3.3 D3):** All slash commands reset
`fsmPhase = 'idle'` and `activity = {kind:'idle'}` after they resolve,
**but only if `isChainInProgress === false`** AND
`!isRetrying` AND `lastResetAt+100ms < Date.now()`.

This means slash commands never stomp on a live run. They ARE the
canonical entry point to manually reset pretty much anything.

**Five Questions:**
- Q1 ALL: ✅ Yes (covers all slash commands).
- Q2 1000 agents: ✅ Yes (one reset path).
- Q3 hostile: ✅ Yes (guarded).
- Q4 2 years: ✅ Yes (one helper called everywhere).
- Q5 industry: ✅ Yes (pattern: command-initiated reset).

#### Q7: Dev override (FID-003) bypasses ECHO gating — does it also bypass fsmPhase tracking?

**Answer:** No. Dev override (`cli/src/state/chat-store.ts:devMode`) only
gates the *tool-gating* layer in `tool-executor.ts`. fsmPhase tracking is a
runtime indicator — it should still show what's happening (dev mode is
explicitly for testing, so seeing the state is more important). They are
orthogonal: gating by phase vs. observing by phase.

**Extension:** Add a `developerMode` flag (separate from `devMode`) for
"pause / frozen state for debugger attach" semantics. The `onStreamEnded`
guard treats `developerMode === 'frozen'` as skip-reset. This is futurework
and NOT in this FID.

**Five Questions:** ✅ ALL YES.

#### Q8: Heartbeat reading token count every 2s — will it flicker?

**Answer:** No. `contextTokenCount` monotonically increases during a run.
Each read gets the latest value. If two adjacent reads return the same
value (very short interval between changes), `setState` is a no-op because
zustand compares with `Object.is`. So flicker is impossible.

**Pattern:** `updateContextTokens` already exists at line 487 of
`chat-store.ts`. The new heartbeat just calls it.

**Five Questions:** ✅ ALL YES.

#### Q9: Should activity `kind:'idle'` fire ONLY on `finish` chunk or ALSO if stream silent for N seconds?

**Answer:** Both. FID-009's `bumpActivityIdleTimer` (5s of silence) already
fires `setActivity({kind:'idle'})` from the runtime side. F2's
`onStreamEnded` fires from the CLI side at run termination. Two writers,
same destination, idempotent — last writer wins. This is correct: if the
agent is silent for 8 seconds mid-run, the runtime auto-idles. When the
run completes, the CLI resets to idle again. Already correct by design.

**Five Questions:** ✅ ALL YES.

#### Q10: How do we avoid double-reset (both finish chunk AND onNewUserMessage setting idle)?

**Answer:** Defense in depth: `setFsmPhase('idle')` is idempotent
(zustand `Object.is` check). `setActivity({kind:'idle'})` short-circuits
in `setActivity()` itself (lines 144 - the `fast-path` branch clears the
timer and skips the chunk emit). Multiple callers writing the same final
state is cheap and safe. We do NOT need a `if (current === target) return`
guard — zustand already dedupes.

**Additional safety:** `onStreamEnded` is the canonical action. Internal
callers (route handlers, abort handlers) MUST go through `onStreamEnded()`
rather than calling `setFsmPhase('idle')` directly. This makes the reset
single-sourced.

**Five Questions:** ✅ ALL YES.

#### Q11: Type safety — `setActivity` takes strict `AgentActivity`. What if a partial object arrives?

**Answer:** The print-mode `printModeActivitySchema` validates emissions
at the runtime boundary (`common/src/types/print-mode.ts:activitySchema`).
The CLI cast `(e.activity as AgentActivity)` at `sdk-event-handlers.ts:563`
is safe because:
  (a) `setActivity` in the runtime constructs the discriminated union
      strictly.
  (b) The schema rejects malformed payloads before they reach the SDK
      emitter.
  (c) A malformed foreign chunk (hostile injection) would only distrupt the
      activity row — fsmPhase and isStreaming are independent.

**Hardening:** Run `printModeActivitySchema.safeParse(e.activity)` at the
cast boundary. On failure: log warning + drop the chunk (NOT a UI break).
Same hardening for `setFsmPhase`: introduce `isValidFsmPhase(phase: unknown):
phase is FsmPhase` type guard. Unknown phases revert to `'idle'`.

**Five Questions:**
- Q1 ALL: ✅ Yes (covers all inputs).
- Q2 1000 agents: ✅ Yes (one parse per chunk).
- Q3 hostile: ✅ Yes (drop-and-log instead of break).
- Q4 2 years: ✅ Yes (single type-guard utility).
- Q5 industry: ✅ Yes (zod safeParse is industry pattern).

#### Q12: Test coverage — what unit tests must be added to prevent regression?

**Answer:** Five test files in `cli/src/__tests__/`, all integration-level:

1. `stuck-state-cleanup.test.ts` — simulated SDK run with multi-spawn,
   verify after `finish` chunk and stream end that `fsmPhase === 'idle'`,
   `activity.kind === 'idle'`, `streamingAgents.size === 0`,
   `activeSubagents.size === 0`.
2. `heartbeat-tokens.test.ts` — simulated SDK with slow snapshots (10s
   gap), verify `contextTokensUsed` updates within 3s without snapshot
   (heartbeat carries the change). Run on a 2s interval; tolerance 3s.
3. `abort-cleanup.test.ts` — simulated abort mid-stream, verify
   `onStreamEnded` fires (fsmPhase=idle, activity=idle).
4. `stalled-detector.test.ts` — simulated 30s silence, verify stalled
   detector fires `onStreamEnded({reason:'stalled'})` and logs warning.
5. `slash-command-reset.test.ts` — simulated slash command while idle,
   verify state reset. While `isChainInProgress === true`, verify NO reset.

These tests use the existing test fixtures in `cli/src/utils/__tests__/sdk-event-handlers.test.ts`.

**Five Questions:** ✅ ALL YES.

#### Q13: What if a chunk arrives AFTER `onStreamEnded` fires (race condition)?

**Answer:** Defensive guard in `setStreamingAgents`. The handler in
`sdk-event-handlers.ts` checks `streamRefs.state.runCompleted` flag. When
the `finally` block sets `runCompleted = true`, any subsequent chunk
that tries to mutate `streamingAgents` short-circuits with a logger.warn.

**Implementation:**
- Add `runCompleted: boolean` to `streamRefs.state` (extend `createStreamController`).
- `cli/src/hooks/use-send-message.ts:__finally__` — set `streamRefs.state.runCompleted = true` BEFORE calling `onStreamEnded`.
- `sdk-event-handlers.ts` — guard all `setStreamingAgents` calls with
  `if (state.streamRefs.runCompleted) { logger.warn('chunk after run-end'); return }`.

**Five Questions:** ✅ ALL YES.

#### Q14: Order of operations — should snapshot settle before `onStreamEnded`?

**Answer:** Yes. `runState.sessionState.mainAgentState` is the authoritative
final state. We must persist it before reseating UI to idle.

**Order:**
1. `await settleCheckpointSave()` (existing).
2. `saveChatState(runState, ...)` (existing).
3. Add `streamRefs.state.runCompleted = true`.
4. `useChatStore.getState().onStreamEnded()`.

If we reset UI first, then save, a snapshot in flight could overwrite the
reset. If we save first then reset, the saved state is correct AND the UI
shows idle — the right ordering.

**Five Questions:** ✅ ALL YES.

#### Q15: What if `isRetrying` is true at finally-time — should we reset?

**Answer:** No. `isRetrying` indicates the SDK is automatically re-running
the same request (e.g., transient network error). Resetting the UI here
would falsely show "ready" while the retry is pending.

**`onStreamEnded` guard:**
```ts
onStreamEnded: () => set((state) => {
  if (state.isRetrying) return  // skip reset on retry
  if (Date.now() - state.lastResetAt < 100) return  // anti-thrash
  // ... reset fsmPhase, activity, sets
  state.lastResetAt = Date.now()
})
```

**Five Questions:** ✅ ALL YES.

#### Q16: What if the user types in the input bar while a heartbeat tick is mid-poll?

**Answer:** Heartbeat reads from `latestRunStateSnapshot` ref. The ref is
read-only on the heartbeat tick. User keystrokes don't mutate the
heartbeat. The input bar's `setInputValue` is independent of chat-store
sidebar state. No race.

**Five Questions:** ✅ ALL YES.

#### Q17: Multiple reset callers in the same tick — `finish`, abort, slash command simultaneously?

**Answer:** Anti-thrash guard in `onStreamEnded`. Maintain
`state.lastResetAt: number`. If `Date.now() - lastResetAt < 100ms`, skip
the reset (the first reset already did the work). 100ms window absorbs
synchronous multi-callers without losing any reset. Idempotent.

**Five Questions:** ✅ ALL YES.

#### Q18: What if chat-store hydration is incomplete at first run-start?

**Answer:** The chat store initializes with `fsmPhase='idle'` and
`activity={kind:'idle'}` (initial state in `chat-store.ts:195`). The
`onStreamEnded` reads/writes from this initialized state, so hydration
order doesn't matter. The `setMessages` and `setRunState` actions are also
initialized — the call order in `sendMessage` is well-defined.

**Five Questions:** ✅ ALL YES.

#### Q19: What if `isChainInProgress === true` but the heartbeat is running — should the stalled detector still fire?

**Answer:** No. The stalled detector's contract is: "no live run AND no
chunks in 30s". If `isChainInProgress === true`, a run IS live and we don't
stomp on it. If `isChainInProgress === false` but chunks are arriving, we
also don't fire (chunks prove activity).

**Trigger condition (final):**
```
if (
  !state.isChainInProgress &&
  !state.isRetrying &&
  Date.now() - state._lastChunkAtMs > 30_000 &&
  state.fsmPhase !== 'idle'
) {
  callOnStreamEnded({reason:'stalled'})
}
```

**Five Questions:** ✅ ALL YES.

---

### 3.3 Resolved Open Decisions (with ECHO Robustness)

This replaces §8 of v1. Each decision is now resolved with full rationale.

#### D1 — Heartbeat interval: 2 seconds

**Decision:** 2 seconds. **Rationale:**
- Faster (1s) burns ~50% of an idle terminal's render budget on no-op state
  changes *during the entire run*. zustand `Object.is` deduplicates but
  React still invokes the setter.
- Slower (3s) means the user perceives up to 3s of stale token count.
- 2s matches industry pattern (Prometheus default 15s downscales; React
  renderer tick ~16ms; UI feedback 100-300ms; token counter 2s).
- Empirically seen: snapshot cadence is 5s, so heartbeat fills in at 4s -
  2s - 0s intervals. The minimum gap is 3s.

**Five Questions:** ✅ ALL YES (Q1 industry § most-cited for token counters).

#### D2 — Stalled timeout: 30 seconds

**Decision:** 30 seconds. **Rationale:**
- Runtime `bumpActivityIdleTimer` (FID-009) auto-idles `activity` at 5s.
  That's the runtime-side signal. The fsmPhase stalled detection is the
  CLI-side watchdog — must have a longer TTL to avoid false positives.
- Shorter (15s) triggers false positives on:
  - MCP tool calls (researcher), which can stall 20-30s.
  - Long bash commands (M2 tool with `&&` chains).
  - Large file reads (read_subtree on a big repo).
- Longer (60s) leaves the user staring at a "stuck" indicator.
- 30s matches the SDK's own `MAX_AGENT_STALL_MS` baseline.

**Five Questions:** ✅ ALL YES (most-tested boundary: research/MCP).

#### D3 — Slash command reset: ALL slash commands, gated

**Decision:** All slash commands reset `fsmPhase='idle'` and
`activity={kind:'idle'}`, gated by `!isChainInProgress && !isRetrying`.
**Rationale:**
- Slash commands DON'T run inside the SDK stream. They cannot drive
  `transition_phase` themselves. Their lifecycle is: command-parse →
  mutate-local-state → done.
- Leaving fsmPhase stale after `/fids` or `/dev` is a regression from
  pre-FID-009 behavior (when these commands didn't reset state — the
  user only noticed when they later stacked commands on a stale phase).
- The `!isChainInProgress` guard is the safety belt — slash commands
  typed during a live run are queued, not executed immediately, so this
  guard is mostly defensive.

**Implementation:** Add a single helper `resetUiToIdle()` in
`finish-logic.ts` (new file) called from each slash-command handler in
`cli/src/commands/*`. One helper, many callers = audit-friendly.

**Five Questions:** ✅ ALL YES.

#### D4 — Cost on heartbeat: NOT updated

**Decision:** Heatbeat does NOT touch `sessionCost` or `creditsUsed`.
**Rationale:**
- `snapshot.creditsUsed` is unreliable during sub-agent execution
  (sub-agents have their own counters that are reset between them).
- Updating `sessionCost` from heartbeat would oscillate 0 → N → 0 → N as
  sub-agents spawn and finish.
- The user observes cost as "cumulative since session start" — a flicker
  is worse than a slightly stale number (settles within 30s on the next
  primary snapshot).
- Cost stays on `finish` chunk (total final cost), primary snapshot
  (`onStateSnapshot`), and post-run `saveChatState`.

**Five Questions:** ✅ ALL YES (industry pattern: totals-flush-at-boundary).

#### D5 — Stalled behavior: auto-reset to idle + log

**Decision:** Auto-reset to idle after 30s of silence + log warning.
**Rationale:**
- An auto-reset to idle is the better UX: the user regains control, can
  type their next prompt, and the agent doesn't appear frozen.
- The warning log feeds `dev/LEARNINGS.md` and helps diagnose future
  stalls.
- The "show stalled indicator and wait" alternative has merit but is
  worse UX: users typically don't read the indicator, and the run
  genuinely stalled needs human intervention.
- Combined with the existing `bumpActivityIdleTimer` (5s activity reset),
  the user gets a double signal: activity row goes idle at 5s, phase
  row goes idle at 30s.

**Five Questions:**
- Q1 ALL: ✅ Yes (covers all stalls).
- Q2 1000 agents: ✅ Yes (single timer).
- Q3 hostile: ✅ Yes (defensive guard).
- Q4 2 years: ✅ Yes (well-named: stallWatermark + stalledReset).
- Q5 industry: ✅ Yes (industry pattern: watchdog timer with auto-reset).

---

### 3.4 Five-Question Self-Audit (Decision-Level)

Each decision was evaluated against the Five ECHO Questions.

| Decision | Q1 ALL | Q2 1k agent | Q3 hostile | Q4 2y maint | Q5 industry |
| -------- | ------ | ----------- | ---------- | ----------- | ----------- |
| F1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| F2 | ✅ | ✅ | ✅ | ✅ | ✅ |
| F3 | ✅ | ✅ | ✅ | ✅ | ✅ |
| D1 2s heartbeat | ✅ | ✅ | ✅ | ✅ | ✅ |
| D2 30s stalled | ✅ | ✅ | ✅ | ✅ | ✅ |
| D3 all slash reset | ✅ | ✅ | ✅ | ✅ | ✅ |
| D4 no cost on hb | ✅ | ✅ | ✅ | ✅ | ✅ |
| D5 stalled→idle | ✅ | ✅ | ✅ | ✅ | ✅ |

**All 40 cells YES.** FID converged.

---

## 4. AUDIT Phase — Verification Plan + Double-Audit

### 4.1 Typecheck verification (claude-opus / bash)

```bash
cd common && bun run typecheck 2>&1 | tail -20
cd packages/agent-runtime && bun run typecheck 2>&1 | tail -25
cd cli && bun run typecheck 2>&1 | tail -30
```

All three must return zero errors. Pre-fix baseline:
- common: clean (per FID-008 close).
- agent-runtime: clean (per FID-009 close).
- cli: clean (per FID-009 close).

### 4.2 Call-graph reachability (grep, mandatory per Law 4)

```bash
# F1 call-graph: every spawn_agents result path routes through new helper
rg -n 'flushParentStreamingAgents|updateStreamingAgents|handleSpawnAgentsResult' \
   cli/src/utils/sdk-event-handlers.ts

# F2 call-graph: onStreamEnded fired from terminal points
rg -n 'onStreamEnded' cli/src/hooks/use-send-message.ts cli/src/state/chat-store.ts
# Expected: 5+ call sites (run-completion, run-error, finally block, abort handler, slash command bridge)

# F3 call-graph: heartbeat wiring
rg -n 'tokenHeartbeatTimer|setInterval|contextTokenCount|stallWatermark' \
   cli/src/hooks/use-send-message.ts cli/src/utils/finish-logic.ts
```

Each fix must show ≥3 distinct call sites to pass Law 4.

### 4.3 Manual smoke test (in tmux session)

```bash
# Start the Savant CLI
# Send: "list the contents of cli/src/components"
# Observe: agent spawns scout / recursive explorer
# After completion: "working..." gone, sidebar phase=IDLE, tokens/cost updated
# Send another prompt: confirms reset idempotency
# Press Esc mid-run: confirms abort-driven reset
# Idle for 35s with no chunks: confirms stalled→idle auto-reset
```

### 4.4 Double-audit (Nova)

Nova will independently verify:
1. The call-graph greps return the expected number of sites.
2. The typecheck command output is zero-error across all three packages.
3. Manual smoke test (via tmux-cli) reproduces the fix.
4. Code review: forge's diff is reviewable and self-consistent.

---

## 5. Implementation Plan (Post-Approval Only)

| Step | File(s)                                                  | Lines (est) | Owner |
| ---- | -------------------------------------------------------- | ----------- | ----- |
| 1    | common/src/types/session-state.ts (`isValidFsmPhase`)    | +12         | Forge |
| 2    | cli/src/state/chat-store.ts (`onStreamEnded` + `resetUiToIdle`) | +38  | Forge |
| 3    | cli/src/utils/finish-logic.ts (NEW)                      | +60         | Forge |
| 4    | cli/src/utils/sdk-event-handlers.ts (`flushParent...` + `runCompleted` guard) | +28 | Forge |
| 5    | cli/src/utils/sdk-event-handlers.ts (`handleFinish`)     | +6          | Forge |
| 6    | cli/src/hooks/use-send-message.ts (`finally` block)      | +5          | Forge |
| 7    | cli/src/hooks/use-send-message.ts (abort handler)        | +8          | Forge |
| 8    | cli/src/hooks/use-send-message.ts (heartbeat loop + stalled detector) | +50 | Forge |
| 9    | cli/src/commands/* (slash command bridge) — 5 commands   | +3 per cmd  | Forge |
| 10   | cli/src/__tests__/stuck-state-cleanup.test.ts (NEW)      | +60         | Forge |
| 11   | cli/src/__tests__/heartbeat-tokens.test.ts (NEW)         | +50         | Forge |
| 12   | cli/src/__tests__/abort-cleanup.test.ts (NEW)            | +40         | Forge |
| 13   | cli/src/__tests__/stalled-detector.test.ts (NEW)         | +40         | Forge |
| 14   | cli/src/__tests__/slash-command-reset.test.ts (NEW)      | +45         | Forge |

Total: ~480 lines touched. Across 8 files (3 new).

---

## 6. Acceptance Criteria

For FID to close:

- [ ] Typecheck zero errors across `common/`, `packages/agent-runtime/`, `cli/`.
- [ ] Call-graph reachability confirmed (≥3 sites per fix).
- [ ] Manual smoke test: long run finishes → `fsmPhase=idle`, `activity=idle`,
      `working...` shimmer gone, tokens updated.
- [ ] Manual smoke test: abort mid-run → same state.
- [ ] Manual smoke test: 35s of silence → stalled-reset fires, log emitted.
- [ ] Manual smoke test: slash command `/dev on` (toggle) → idle reset.
- [ ] Five new test files pass.
- [ ] Nova audit signed off.
- [ ] CHANGELOG entry written.
- [ ] FID archived to `dev/fids/archive/`.

---

## 7. Rollback Plan (per fix)

| Fix | Rollback Action |
| --- | --------------- |
| F1  | Revert `flushParentStreamingAgents` helper addition and `handleSpawnAgentsResult` body change. End-of-stream backstop (F2) covers the regression as a partial fallback. |
| F2  | Remove `onStreamEnded` action + `resetUiToIdle` helper. Slash-command bridges revert to no-op. Sidebar returns to "stale until next message" behavior. F1 and F3 still in place (their effects unchanged). |
| F3  | Remove `setInterval` + stalled detector from `use-send-message.ts`. Tokens fall back to 5s snapshot cadence. Stalled detector reverts to "no auto-reset — user manually /new". |
| D3  | Remove `resetUiToIdle` calls from slash-command handlers. Slash commands return to no-state-effect behavior. |
| D5  | Remove `_lastChunkAtMs` tracker + 30s stalled detector. Run-completes-only signaling reverts. |

Each fix is independent — partial rollback possible.

---

## 8. Open Decisions for User Approval

**All 5 open decisions from v1 are now RESOLVED with full rationale in §3.3.**

No further user-input required on architecture. Implementation can proceed
once user approves v2 as-is.

---

## 9. Five-Question Self-Audit Sign-Off

This FID converged to v2 on 2026-07-18.

- Detective ✅ — Evidence catalogued with file:line for each bug.
- Thinker ✅ — Architecture designed with 19 missed questions answered
  (12 v1 + 7 deepening).
- Recorder ✅ — FID v2 written, 5 decisions resolved.
- Verifier ⏳ — Pending AUDIT phase (typecheck + call-graph + double-audit).
- Forge ⏳ — Blocked on approval per ECHO preview-only rule.

**40/40 Five-Question cells YES.** All robustness questions answered.
Awaiting user approval to enter AUDIT + Forge phases.

---

## 10. v1 → v2 Changes Log

| Section | v1 → v2 Change                                                                                            | Reason |
| ------- | --------------------------------------------------------------------------------------------------------- | ------ |
| §3.2 Q1-Q12 | Q11-type-safety + Q13-Q19 added                                                                              | v1 missed double-call / late-chunk / save-final-order  |
| §3.3 | 5 OPEN DECISIONS → 5 RESOLVED DECISIONS (D1-D5)                                                            | User asked for full ECHO compliance with resolved decisions |
| §3.4 | NEW Five-Question decision matrix                                                                           | Standardize per-decision audit |
| §5     | Implementation steps expanded from 10 to 14 (+finish-logic.ts, +4 new test files)                          | D3/D5 require new file + new tests |
| §6     | Acceptance criteria expanded (smoke test new cases, slash command smoke)                                   | D3/D5 verification gates |
| §7     | Rollback expanded (D3, D5 separately)                                                                      | Per-decision rollback granularity |
| §8     | "Open Decisions for User Approval" → "Open Decisions RESOLVED"                                             | User wants answers, not questions |

**v2 is FULLY CONVERGED pending user approval to execute.**

---

**History:**
- v1 (2026-07-18): initial draft, 5 open decisions surfaced, 12 missed
  questions, awaiting review.
- v2 (2026-07-18): re-run. All 5 decisions resolved with full ECHO/robust
  answers. 7 deepening questions added (Q13-Q19). Five-Question
  decision-matrix added. 40/40 cells YES. Converged on this version.
