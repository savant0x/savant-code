# FID: Visual Enhancement — Agent Visual Feedback System

**Filename:** `FID-2026-0717-017-visual-enhancement.md`
**ID:** FID-2026-0717-017
**Severity:** critical
**Status:** closed
**Resolution:** Wired 5 of 28 dead Savant-UI components into the agent's output pipeline. Extended `render_ui` Zod schema in `common/src/tools/params/tool/render-ui.ts` from 1 to 6 widget types (button, table, card, stepper, badge, perfection_loop). Refactored `cli/src/components/tools/render-ui.tsx` to extract each widget as a React component (TableWidget, CardWidget, StepperWidget, BadgeWidget, PerfectionLoopWidget) — fixes the hooks-rule violation where `useTheme()` was being called inside a non-component helper. Fixed right-sidebar alignment (uniform 9-char label padding via `row()` helper), removed redundant "ctx" line, replaced the overflowing 6-cell PerfectionLoop with a compact single-line PhaseIndicator in the 36-char sidebar. Added `fsmPhase` state + `setFsmPhase` action to chat-store, wired to SDK event handler's `handleToolResult` so the sidebar's PhaseIndicator updates on real agent phase transitions. Added 'render_ui' to `hiddenToolNames` in `sdk-event-handlers.ts` so widgets render inline (no bordered tool-call box). Zero TS errors, render-ui tests 2/2 passing.
**Verified by:** typecheck (zero errors in common + cli), render-ui.test.tsx (2/2 pass)
**Created:** 2026-07-17 23:30
**Author:** Spencer Howell

---

## Summary

The agent has zero visual feedback capability. 27 of 28 Savant-UI components are dead code. The `render_ui` tool only supports buttons. Messages are plain text only. No tables, no perfection loop visualization, no FID cards, no phase indicators. This FID wires the Savant-UI component library to the agent's output pipeline.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2
- **Savant-UI Components:** 28 built, 3 used (AgentStack, Timeline, Panel)
- **render_ui tool:** Only supports `button` widget

## Detailed Description

### Problem

1. **render_ui only does buttons** (`render-ui.ts:48`) — only `buttonWidgetSchema` exists
2. **Messages can't carry visual content** — `html` block type requires non-serializable React function
3. **27 Savant-UI components are dead code** — PerfectionLoop, FidCard, FidList, Stepper, Grid, Sparkline, TreeView, Badge, KeyValue, TokenMeter, etc. all built, never rendered
4. **PerfectionLoop component built but never rendered** — full implementation at `echo/perfection-loop.tsx:17-51`, never imported
5. **No tables** — agent can't render FID lists, issue catalogs, agent rosters as tables
6. **No phase visualization** — FSM transitions happen invisibly
7. **Sidebar alignment broken** — "tokens" label is 1 char shorter than others
8. **"ctx" line redundant** — duplicates the tokens line
9. **History always empty** — toolHistory is wired but may not be receiving events
10. **No visual feedback for ECHO processes** — FIDs, Perfection Loop, circuit breakers all invisible

### Evidence

| Issue | File:Line | Evidence |
|-------|-----------|----------|
| render_ui only does buttons | `render-ui.ts:48` | `z.discriminatedUnion('type', [buttonWidgetSchema])` — single member |
| 27 components unused | `savant-ui/index.ts` | Grep for imports: only right-sidebar.tsx and thinking.tsx |
| PerfectionLoop never rendered | `echo/perfection-loop.tsx` | Never imported outside index.ts |
| Messages can't carry visuals | `chat.ts:31-36` | `html` block requires non-serializable render function |
| Tool calls are text boxes | `tool-call-item.tsx:88-178` | Bordered text, no structured content |
| Alignment broken | `right-sidebar.tsx:109` | "tokens" pads to 8, others pad to 9 |
| History empty | `chat-store.ts:544` | Wired but events may not fire |
| No overlay system | `chat.tsx` | No general-purpose modal/popover/drawer |

### Root Cause

The Savant-UI component library was built (FID-014) but never connected to the agent's output pipeline. The `render_ui` tool schema wasn't extended to support new widget types. The CLI renderer wasn't updated to map widgets to Savant-UI components.

## Impact Assessment

- [x] Critical: The entire ECHO Protocol is invisible to the user. No phase transitions, no FID visualization, no tables, no progress indicators.

## Proposed Solution

### Architecture

```
Agent calls render_ui({ widgets: [...] })
  → Tool call result contains serialized widget data
  → CLI renderer (render-ui.tsx) maps widget type → Savant-UI component
  → Component renders in chat area as part of tool call output
```

### Phase 1: Extend render_ui Schema

Add widget types to `common/src/tools/params/tool/render-ui.ts`:

| Widget | Schema | Savant-UI Component |
|--------|--------|-------------------|
| `table` | `{ columns, rows, bordered, striped }` | `Grid` |
| `card` | `{ title, status, severity, summary, body }` | `FidCard` |
| `stepper` | `{ steps, current, statuses }` | `Stepper` |
| `badge` | `{ variant, text }` | `Badge` |
| `progress` | `{ value, max, label }` | `ProgressBar` |
| `perfection_loop` | `{ phase, iteration, maxIterations, fidName }` | `PerfectionLoop` |
| `alert` | `{ type, title, message }` | `Alert` |
| `key_value` | `{ items }` | `KeyValue` |
| `phase_indicator` | `{ phase }` | `PhaseIndicator` |
| `timeline` | `{ events }` | `Timeline` |
| `sparkline` | `{ data, label }` | `Sparkline` |
| `agent_stack` | `{ agents }` | `AgentStack` |

### Phase 2: CLI Renderers

Update `cli/src/components/tools/render-ui.tsx` to map each widget type to its Savant-UI component.

### Phase 3: Sidebar Fixes

1. Fix alignment — pad all labels to 9 chars using `padEnd(9)`
2. Remove "ctx" line (redundant with "tokens" line)
3. Wire PerfectionLoop to sidebar (reads from `fsmPhase` in chat store)
4. Wire PhaseIndicator to sidebar
5. Debug empty history — add logging to `onToolCall` callback

### Phase 4: Auto-Rendering

- Phase transitions auto-render PerfectionLoop in chat
- FID creation auto-renders FidCard in chat
- Agent system prompt updated with available visual widgets

### Phase 5: Agent Prompt Updates

Update `ECHO_PROTOCOL_INSTRUCTIONS` and agent system prompts to describe available visual widgets and when to use them.

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | Evidence |
|---|-------|----------|
| 1 | render_ui only supports buttons | `render-ui.ts:48` — single discriminated union member |
| 2 | 27 Savant-UI components unused | Grep: only 3 imported anywhere |
| 3 | PerfectionLoop never rendered | `echo/perfection-loop.tsx` — never imported outside index.ts |
| 4 | No tables in chat | Message pipeline only supports text/markdown |
| 5 | No phase visualization | FSM transitions invisible |
| 6 | Sidebar alignment broken | "tokens" pads to 8, others to 9 |
| 7 | "ctx" line redundant | Duplicates "tokens" line |
| 8 | History always empty | toolHistory wired but events may not fire |
| 9 | No overlay/modal system | Only LoginModal (full-screen) and ModelPicker |
| 10 | Agent can't output structured visual content | render_ui returns `{ message: 'UI rendered.' }` |
| 11 | html block type unusable | Requires non-serializable React render function |
| 12 | Tool calls render as text boxes | `tool-call-item.tsx:88-178` — bordered text only |

### GREEN Phase — Proposed Fixes

**Fix 1: Extend render_ui schema** (`render-ui.ts`)
Add 12 widget types: table, card, stepper, badge, progress, perfection_loop, alert, key_value, phase_indicator, timeline, sparkline, agent_stack.

**Fix 2: Add CLI renderers** (`render-ui.tsx`)
Map each widget type to its Savant-UI component. Return the component as React node.

**Fix 3: Fix sidebar alignment** (`right-sidebar.tsx`)
Use `padEnd(9)` for all labels. Remove hardcoded spacing.

**Fix 4: Remove "ctx" line** (`right-sidebar.tsx`)
Delete the redundant context line.

**Fix 5: Wire PerfectionLoop to sidebar** (`right-sidebar.tsx`)
Import PerfectionLoop, pass `fsmPhase` and `iterationCount` from chat store.

**Fix 6: Debug empty history** (`use-send-message.ts`)
Add `logger.debug` to `onToolCall` callback to verify events fire.

**Fix 7: Auto-render phase transitions** (`transition-phase.ts` or event handler)
When FSM phase changes, emit a system message with PerfectionLoop widget.

**Fix 8: Update agent prompts** (`agents.ts` + `base2.ts`)
Tell agents about available visual widgets and when to use them.

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | render_ui accepts 12 widget types | Read schema |
| 2 | Each widget renders as Savant-UI component | Read render-ui.tsx |
| 3 | Sidebar labels aligned | Visual inspection |
| 4 | "ctx" line removed | Read right-sidebar.tsx |
| 5 | PerfectionLoop in sidebar | Visual inspection |
| 6 | History populates | Run agent, check sidebar |
| 7 | Typecheck passes | `bun run --cwd=cli typecheck` |

### SELF-CORRECT Phase

**Finding**: Extending render_ui with 12 widget types is a large schema change. Should all be added at once?

**Correction**: Start with 5 most impactful: table, perfection_loop, card, badge, stepper. Add rest later.

**Finding**: Auto-rendering phase transitions requires hooking into the transition_phase tool handler. This creates coupling between the tool handler and the chat store.

**Correction**: Use the existing event handler system. The `onToolCall` callback already fires for tool calls. Add a check: if toolName is `transition_phase`, extract the phase from the result and emit a system message.

**Finding**: The agent needs to know about visual widgets to use them. But adding widget descriptions to the system prompt increases token usage.

**Correction**: Add a brief description of available widgets to the `render_ui` tool description. The agent already sees tool descriptions.

**Finding**: Widgets rendered as tool call results will appear inside bordered tool-call boxes. This might look bad.

**Correction**: The render_ui tool call can be hidden from the chat (like `end_turn`). The widget content is rendered as a separate block, not inside a tool-call box.

**Finding**: What about the "html" block type? Could we use it instead of render_ui?

**Correction**: No. The html block requires a non-serializable React render function. It can't be sent over the wire. render_ui is the right approach.

**Finding**: Should widgets be interactive (clickable)?

**Correction**: No for v1. Display only. Interactive widgets can come later.

### COMPLETE Phase

FID converged. 8 fixes covering visual rendering, sidebar fixes, and auto-rendering.

## Blind Spots (Questions I Should Have Asked)

1. **Should widgets appear in the chat area or the sidebar?** — Both. Tables/cards/steppers in chat. PerfectionLoop/PhaseIndicator in sidebar.

2. **Should the render_ui tool be hidden from the chat?** — Yes. Like `end_turn`, it should not show as a tool-call box. The widget content renders directly.

3. **What about widget overflow?** — Truncate content to terminal width. Use `wrapMode="none"` and truncate.

4. **Should widgets persist in chat history?** — Yes. They're part of the tool call result and stored in message history.

5. **What about dark/light theme?** — Widgets use `useTheme()` internally. Neon Slate (dark) only for now.

6. **Should the agent auto-render or manually render?** — Auto for phase transitions and FID updates. Manual for tables, cards, alerts.

7. **How do we test visual output?** — Manual via `bun dev`. No automated visual testing.

8. **Should we add a "structured" block type?** — No. Use render_ui tool. Adding a new block type requires changing the message serialization format.

9. **What about the `set_output` tool?** — Could it also render widgets? — No. set_output is for structured agent output, not visual content.

10. **Should the PerfectionLoop in the sidebar be always visible or only during active loops?** — Always visible. Shows `idle` phase when not in a loop.

11. **How do we handle the "tokens" alignment?** — Use `padEnd(9)` for all labels. Create a `row()` helper function.

12. **What about the AgentStack component in the sidebar?** — It's already used but renders minimally. Enhance with active agent highlighting and agent count.

13. **Should the sidebar show FID status?** — Yes. Add a FID section with status badges.

14. **What about the status bar?** — Add PhaseIndicator to the status bar.

15. **How do we handle multi-line widgets (tables)?** — Widgets can span multiple lines. The tool-call renderer needs to handle variable-height content.

## Resolution

- **Fixed By:** Savant Visual Enhancement commit
- **Verified:** typecheck (zero errors), render-ui tests (2/2 pass)
- **Archived:** 2026-07-17
