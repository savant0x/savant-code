# FID: FSM Phase in UI

**Filename:** `FID-2026-0717-011-fsm-phase-ui.md`
**ID:** FID-2026-0717-011
**Severity:** medium
**Status:** closed
**Created:** 2026-07-17 18:00
**Author:** Pending

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0717-011`. Backfilled fields: Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

The FSM phase is tracked in `agentState.fsmPhase` but not visible in the UI. The user has no way to know which phase the Perfection Loop is in. The right sidebar shows tokens, tools, files, cost — but not FSM phase.

## Evidence

- `agentState.fsmPhase` — tracked in runtime
- `cli/src/components/right-sidebar.tsx` — no FSM phase display
- `cli/src/components/status-bar.tsx` — no FSM phase display

## Proposed Solution

### Steps

1. Add FSM phase to the right sidebar — show current phase (idle/red/green/audit/self_correct/complete)
2. Color-code: red=RED, green=GREEN, yellow=AUDIT, etc.
3. Add to `useChatStore` zustand state — expose `fsmPhase` from agent state
4. Display in right sidebar below model info

### Verification

- Right sidebar shows FSM phase
- Phase updates as transitions happen
- Typecheck passes

### Missed Questions

1. **Should the phase be in the status bar instead?** — Both. Status bar for quick glance, sidebar for detail.
2. **Should phase transitions be logged in the chat?** — Yes, as system messages. "FSM: idle → red" helps the user track Perfection Loop progress.
3. **Where does the FSM phase come from in the UI?** — `agentState.fsmPhase` is in the runtime. The CLI needs to expose it via the Zustand store. The `useChatStore` or a new `useFsmStore` would hold it.
4. **How does the UI get updated on transitions?** — The `transition_phase` tool handler already mutates `agentState.fsmPhase`. The CLI reads this via `onStateSnapshot` or a similar callback. Need to verify the data flow.
5. **What colors for each phase?** — idle: gray, red: red, green: green, audit: yellow, self_correct: orange, complete: cyan.
6. **Should the phase be a badge or text?** — Text with color. Simple, consistent with existing sidebar design.
7. **What about the status bar?** — Add a small phase indicator next to the status text. E.g., "streaming [GREEN]" or "waiting [AUDIT]".
8. **Should the phase transition be animated?** — No. Static text that updates on transition. Animation is distracting.

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | `agentState.fsmPhase` exists in runtime | `session-state.ts:58` — `fsmPhase?: FsmPhase` |
| 2 | Right sidebar reads from Zustand | `right-sidebar.tsx` uses `useChatStore` |
| 3 | Status bar reads from Zustand | `status-bar.tsx` uses `useChatStore` |
| 4 | Phase transitions mutate `agentState` | `transition-phase.ts:44` — `agentState.fsmPhase = phase` |

### SELF-CORRECT Phase

**Finding:** The data flow from runtime `agentState.fsmPhase` to UI needs investigation. The CLI gets state updates via `onStateSnapshot` callback.

**Correction:** Add `fsmPhase` to the snapshot data that flows from runtime to CLI. The `useChatStore` should receive it and expose it to components.

**Finding:** Logging transitions in chat requires access to the message list from the tool handler.

**Correction:** The tool handler can't directly add messages to the chat. Instead, the transition response message (already returned by `handleTransitionPhase`) can include the phase info. The CLI can parse it and display as a system message.

### COMPLETE Phase

FID converged. Add `fsmPhase` to Zustand store, display in right sidebar and status bar, log transitions in chat via tool response messages.

## Resolution

- **Fixed By:** Pending
- **Archived:** Pending
