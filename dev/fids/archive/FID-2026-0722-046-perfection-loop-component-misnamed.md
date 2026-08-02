# FID-2026-0722-046 — PerfectionLoop Component Is Misnamed

**Filename:** `FID-2026-0722-046-perfection-loop-component-misnamed.md`
**ID:** FID-2026-0722-046
**Severity:** medium
**Status:** closed
**Created:** 2026-07-22
**Author:** Forge

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0722-046`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

The sidebar component `cli/src/components/savant-ui/echo/perfection-loop.tsx` is titled "Perfection Loop" but it does not display the ECHO Perfection Loop (the FID-bound RED→GREEN→AUDIT→SELF-CORRECT cycle). It actually renders the current ECHO FSM phase and the runtime agent activity from the chat store. The mismatch is confusing and must be corrected so the UI accurately reflects what it shows.

## Environment

- **OS:** Windows 11 / bash shell
- **Language/Runtime:** TypeScript / Bun / OpenTUI
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main after FID-2026-0722-045

## Detailed Description

### Problem

`perfection-loop.tsx` reads `fsmPhase` and `activity` from `chat-store.ts` and renders them under the title "Perfection Loop". According to `ECHO.md`:

> **Perfection Loop**: The iterative fix/verify cycle that runs on the FID document — not the code.
> **Activity**: Runtime indicator surfaced in the sidebar that shows what the agent is doing right now (tool call, model reasoning, sub-agent delegation, research). Distinct from FSM Phase, which tracks Perfection Loop state.

The component is therefore showing the current ECHO phase + runtime activity, not the Perfection Loop. The title and component name are misleading.

### Expected Behavior

The component should be named and titled according to what it actually displays: the current ECHO/agent runtime status (FSM phase + activity).

### Root Cause

The component was named "Perfection Loop" based on the FSM phase data it consumes, but the FSM phase is only one signal; the other is runtime activity. The combined display is more accurately an "Agent Status" or "ECHO Status" surface.

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/echo/perfection-loop.tsx`
- `cli/src/components/savant-ui/index.ts`
- `cli/src/components/right-sidebar.tsx`
- `cli/src/components/savant-ui/echo/phase-indicator.tsx` (comment reference)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: UI label/name is confusing but functionality is unchanged
- [ ] Low

## Proposed Solution

### Approach

Rename the component and its file from `PerfectionLoop`/`perfection-loop.tsx` to `AgentStatus`/`agent-status.tsx`. Update the displayed title from "Perfection Loop" to "Agent Status". Update all imports and the `savant-ui/index.ts` barrel export. Update the comment in `phase-indicator.tsx` that references the old file name.

Leave the actual Perfection Loop FSM/FID lifecycle UI for a future dedicated module; this FID only corrects the existing misnamed surface.

### Steps

1. Create new file `cli/src/components/savant-ui/echo/agent-status.tsx` with the renamed `AgentStatus` component.
2. Delete `cli/src/components/savant-ui/echo/perfection-loop.tsx`.
3. Update `cli/src/components/savant-ui/index.ts` to export `AgentStatus` from `./echo/agent-status`.
4. Update `cli/src/components/right-sidebar.tsx` to import and render `AgentStatus`.
5. Update the comment in `cli/src/components/savant-ui/echo/phase-indicator.tsx`.
6. Run CLI typecheck and ESLint on changed files.
7. Code review.

### Verification

- `cd cli && bun run typecheck` passes.
- `cd cli && bun x eslint <changed files> --max-warnings 0` passes.
- code-reviewer-kimi approves.
- Manual test: launch CLI and confirm the sidebar box is titled "Agent Status".

## Perfection Loop

### Loop 1

- **RED:** The `PerfectionLoop` component name and title do not match the data it displays.
- **GREEN:** Rename to `AgentStatus`, update title, imports, and barrel export.
- **AUDIT:** Typecheck, lint, and code review pass. UI shows the correct label.
- **CHANGE DELTA:** ~3 files, component rename only.

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22
- **Fix Description:** Renamed `PerfectionLoop` component to `AgentStatus`, updated title, imports, and barrel export.
- **Tests Added:** No — rename only.
- **Verified By:** Typecheck, lint, code review.
- **Commit/PR:** 
- **Archived:** 2026-07-22
