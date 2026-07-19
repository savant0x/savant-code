# Orchestrator Report — FID-2026-0718-009 Complete

**Date:** 2026-07-18
**FID:** FID-2026-0718-009 — FSM Activity Indicator (UX Confluence Correction)
**Status:** COMPLETE — all must-fix issues resolved, typechecks pass, FID archived

---

## Summary

Adds a parallel `AgentActivity` sub-state to `AgentState`, distinct from `FsmPhase`.
The sidebar now shows TWO rows under "ECHO Protocol":
- `phase` (existing) — Perfection Loop state (idle | red | green | audit | self_correct | complete)
- `work` (NEW) — Runtime activity (idle | thinking | tool | subagent | researching)

When Savant is doing non-FID work (research, exploration, scratchpad, dev-mode, audit-prompt
execution), the work indicator now reflects what it's actually doing — fixing the UX
confluence where the FSM phase stayed `idle` even during active runtime work.

---

## Resolution: 10 Files + 1 Accessor Touch

| File | Change |
|------|--------|
| `common/src/types/session-state.ts` | Added `AgentActivity` discriminated union + `AgentState.activity?` + `AgentState.activityIdleTimer?` (internal). |
| `common/src/types/print-mode.ts` | Added `printModeActivitySchema` as `z.union` of 5 strict variants matching `AgentActivity` exactly. |
| `packages/agent-runtime/src/util/activity-tracking.ts` (NEW) | Three exports: `setActivity(state, activity, onChunk?)`, `bumpActivityIdleTimer(state)`, `extractAllowlistedTarget(toolName, input)`, `toolActivity(state, toolName, input, onChunk?)`. Allowlist hardcoded for ~30 tools. Idle fast-path clears pending timer on `idle` transition. |
| `packages/agent-runtime/src/tools/tool-executor.ts` | M1 — `toolActivity(...)` before `tool_call` emit. M2 — `setActivity('thinking')` before `tool_result` emit. M6 — research tools (web_search, read_docs, researcher, websearch_with_date, web_search_simple) set `'researching'` kind. |
| `packages/agent-runtime/src/run-agent-step.ts` | M4 — `setActivity('thinking')` before `getAgentStreamFromTemplate` call. M5 — `setActivity('idle')` after `await processStream(...)` resolves. |
| `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` | M3 — `setActivity('subagent')` on sub-agent handoff (before `executeSubagent`). M8 — `setActivity('thinking')` after `Promise.allSettled` resolves (parent resumes thinking). |
| `cli/src/state/chat-store.ts` | Added `activity: AgentActivity` field; `setActivity(activity)` action; `reset()` and `resetSidebarData()` restore `initialState.activity`; `onNewUserMessage` resets `activity` to idle. |
| `cli/src/utils/sdk-event-handlers.ts` | New matcher: `.with({ type: 'activity' }, (e) => chatStore.setActivity(e.activity))` after `finish` handler. Wired via `useChatStore.getState().setActivity(...)`. |
| `cli/src/components/right-sidebar.tsx` | Added `ACT_INFO` map (5 activity kinds with color/icon). Renders new `work` row directly below `phase` row in the ECHO Protocol section. |
| `ECHO.md` | Added `Activity` row to the Vocabulary table. |

---

## Verification Results

**Typecheck (all 3 packages, zero errors):**
- ✅ `common/` — PASS
- ✅ `packages/agent-runtime/` — PASS
- ✅ `cli/` — PASS

**Call-graph reachability (ECHO Law 4):**
- ✅ All 8 set points (M1–M8) `setActivity()` writes emit a chunk event with `type: 'activity'`
- ✅ Chunk event matches `printModeActivitySchema` against each `AgentActivity` variant
- ✅ Chunk event flows through `stream-parser` → `sdk-event-handlers.ts` → `chat-store.setActivity` → `right-sidebar.tsx` re-render
- ✅ `agentState.activityIdleTimer` clears when transitioning to `idle` (bounded memory-leak fix)

**Code review (round 2):**
- Initial review found: type narrowing unsafe, idle-timer leak, M8 dead code.
- All 3 issues addressed: schema tightened to strict variants of AgentActivity; idle-fast-path added; M8 invocation placed correctly post-Promise.allSettled.
- Round-2 verdict: 1 must-fix (dead `_afterSubagents` closure) → fixed and re-verified.
- Final verdict: shippable.

**Security hardening (defensive display):**
- Allowlist hardcoded for bash, run_terminal_command, write_file, str_replace, apply_patch,
  propose_write_file, propose_str_replace, code_search, grep, find_files, glob,
  list_directory, web_search, read_docs, read_files, read_subtree, read_url, etc.
- Missing in allowlist → fall back to `toolName` only (no leaky target). Safe default.
- Free-form fields (`content`, `notes`, `description`, etc.) NEVER displayed.
- Hard truncation: 30 chars + `…` suffix.

**rebug round: M8 invocation location**
- Was originally a hoisted closure `_afterSubagents` declared but never invoked (dead code).
- Round-2 reviewer flagged as must-fix. Resolved by inlining `setActivity(thinking)` call
  immediately before `const reports = await Promise.all(...)` (after `Promise.allSettled`
  of sub-agents resolves). Single setActivity call per spawn-agents invocation.

---

## Live Behavior

After this FID, when the user sends an audit prompt like "Run an A-Z test of all tools":

1. **Immediately on user message:** `fsmPhase` stays at `idle` (no FID-bound work). `activity` resets to `idle`. (`onNewUserMessage`)
2. **Model starts reasoning:** `activity` → `thinking` (M4)
3. **Tool call dispatched (e.g. `bash`):** `activity` → `tool: bash: pnpm typecheck` (M1 + M6 for research tools)
4. **Tool result streamed:** `activity` → `thinking` (M2)
5. **Sub-agent spawned (e.g. `detective`):** `activity` → `subagent: detective` (M3)
6. **Sub-agent tool call resolves:** `activity` → still `subagent` until parent resumes (M8 fires after all sub-agents complete: `activity` → `thinking`)
7. **Model stream completes:** `activity` → `idle` (M5)

> **Visible improvement:** previously, every step above showed `phase: idle` in the sidebar. Now the `work` row shows: `thinking`, `tool: bash: pnpm typecheck`, `thinking`, `subagent: detective`, `thinking`, `idle`. The user knows what's happening in real-time.

---

## Files Changed (10 + 1 NEW)

```
common/src/types/session-state.ts           (modified, +30 lines)
common/src/types/print-mode.ts              (modified, +50 lines)
packages/agent-runtime/src/util/activity-tracking.ts       (NEW, 220 lines)
packages/agent-runtime/src/tools/tool-executor.ts          (modified, +12 lines)
packages/agent-runtime/src/run-agent-step.ts               (modified, +18 lines)
packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts  (modified, +14 lines)
cli/src/state/chat-store.ts                                 (modified, +14 lines)
cli/src/utils/sdk-event-handlers.ts                         (modified, +10 lines)
cli/src/components/right-sidebar.tsx                        (modified, +30 lines)
ECHO.md                                                     (modified, +2 lines)
```

---

## CHANGELOG Entry (already added)

`## FID-2026-0718-009 — medium — FSM Activity Indicator (UX Confluence Correction)`

---

## Future Considerations (logged, not implemented)

- **Idle timer full cleanup:** A `disposeAgentState()` lifecycle hook would eliminate the bounded leak. Logged as a follow-up FID.
- **z.discriminatedUnion swap:** The current `z.union` matches the AgentActivity shape correctly, but `z.discriminatedUnion` gives stricter runtime guarantees. Deferrable.
- **Per-tool schema metadata:** Replace the hardcoded allowlist with metadata exported from each tool's schema. Reduces maintenance burden as tools are added.

---

## Nova Audit Request

For your independent verification:

1. **Type narrowing alignment:** Does `printModeActivitySchema` variant union match `AgentActivity` exactly? Check `common/src/types/print-mode.ts` lines ~210-240 vs `common/src/types/session-state.ts` lines ~30-50.
2. **Call-graph reachability:** Trace `setActivity(...)` calls in `tool-executor.ts`, `run-agent-step.ts`, `spawn-agents.ts` → chunk emit → `sdk-event-handlers.ts` matcher → `chat-store.ts` setter → `right-sidebar.tsx` render.
3. **Idle fast-path:** Verify `bumpActivityIdleTimer` is only called when `activity.kind !== 'idle'` in `setActivity` (packages/agent-runtime/src/util/activity-tracking.ts).
4. **Allowlist defensive default:** Confirm `extractAllowlistedTarget` returns `undefined` for any tool not in `ALLOWLISTED_TARGET_FIELDS`. Should fall back to toolName-only display.

If you find any regressions not covered above, please flag with file:line and I will follow up.
