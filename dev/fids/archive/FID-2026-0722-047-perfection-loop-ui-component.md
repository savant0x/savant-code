# FID-2026-0722-047 — Build Real Perfection Loop UI Component

**Filename:** `FID-2026-0722-047-perfection-loop-ui-component.md`
**ID:** FID-2026-0722-047
**Severity:** medium
**Status:** closed
**Created:** 2026-07-22
**Author:** Forge

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0722-047`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

Build a real **Perfection Loop** UI component that reads the active FID state
from `dev/fids/` and visualizes the ECHO loop phases:
**RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE**.

The old `PerfectionLoop` component was recently renamed to `AgentStatus`
because it actually showed runtime FSM phase + activity, not the FID-bound
Perfection Loop. This FID creates a new, correctly named component that
tracks FID document states and renders the loop progress in the right sidebar.

## Environment

- **OS:** Windows 11 / bash shell
- **Language/Runtime:** TypeScript / Bun / OpenTUI
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main after FID-2026-0722-046

## Detailed Description

### Problem

There is currently no UI surface that shows the true ECHO Perfection Loop
progress. The component formerly called `PerfectionLoop` has been renamed to
`AgentStatus` because it displayed `fsmPhase` + runtime `activity`. The actual
Perfection Loop is a FID-bound state machine, and its state can be derived
from the active FIDs in `dev/fids/`.

### Expected Behavior

A sidebar component reads active FIDs via `useFids()`, derives the current
loop phase, and renders a compact vertical phase list with:

- RED
- GREEN
- AUDIT
- SELF-CORRECT
- COMPLETE

The active phase is highlighted, completed phases show a done marker, and
pending phases are dimmed. When no active FIDs exist, the loop shows
COMPLETE / idle.

### Root Cause

The Perfection Loop was never given a dedicated UI component. The only loop-
related UI was the misnamed runtime status box, which has now been corrected
to `AgentStatus`.

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/echo/perfection-loop.tsx` (new file)
- `cli/src/components/savant-ui/index.ts` (barrel export)
- `cli/src/components/right-sidebar.tsx` (mount new component)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: new UI component, but no existing behavior is changed
- [ ] Low

## Proposed Solution

### Approach

1. Introduce a new component `PerfectionLoop` in
   `cli/src/components/savant-ui/echo/perfection-loop.tsx`.
2. The component uses `useFids()` to load active FIDs.
3. Map FID status to loop phase:
   - `created` → `red`
   - `analyzed` → `green`
   - `fixed` → `audit`
   - `verified` → `self-correct`
   - `closed` → `complete`
   - other/unknown → `red`
4. Derive the displayed phase as the most advanced phase among all active FIDs.
5. Render a compact vertical phase list inside a bordered box, using theme
   tokens, `glyph()`, and `resolveThemeColor()`.
6. Export `PerfectionLoop` from `savant-ui/index.ts`.
7. Mount the component in `right-sidebar.tsx` below `AgentStatus`.

### Steps

1. Create `cli/src/components/savant-ui/echo/perfection-loop.tsx`.
2. Update `cli/src/components/savant-ui/index.ts`.
3. Update `cli/src/components/right-sidebar.tsx`.
4. Run CLI typecheck and ESLint.
5. Code review.

### Verification

- `cd cli && bun run typecheck` passes.
- `cd cli && bun x eslint <changed files> --max-warnings 0` passes.
- code-reviewer-kimi approves.
- Manual test: launch CLI and confirm the sidebar shows "Perfection Loop"
  with phase progress.

## Perfection Loop

### Loop 1

- **RED:** No UI exists for the true ECHO Perfection Loop; the old component
  was misnamed.
- **GREEN:** Create a `PerfectionLoop` component that reads active FIDs and
  renders RED→GREEN→AUDIT→SELF-CORRECT→COMPLETE.
- **AUDIT:** Typecheck, lint, and code review pass. Component is mounted in
  the sidebar.
- **CHANGE DELTA:** ~3 files, new component + wiring.

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22
- **Fix Description:** Created `PerfectionLoop` component, exported it from `savant-ui/index.ts`, and mounted it in the right sidebar below `AgentStatus`.
- **Tests Added:** No — component reads live FID data and renders theme tokens; visual verification only.
- **Verified By:** Typecheck, lint, code-reviewer-kimi.
- **Commit/PR:** 
- **Archived:** 2026-07-22
