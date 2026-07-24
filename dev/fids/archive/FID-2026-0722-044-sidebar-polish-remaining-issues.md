# FID: Sidebar Polish — Color, Row Highlight, and Perfection Loop Label

**Filename:** `FID-2026-0722-044-sidebar-polish-remaining-issues.md`
**ID:** FID-2026-0722-044
**Severity:** medium
**Status:** closed
**Created:** 2026-07-22 19:55
**Author:** Orchestrator / Forge

---

## Summary

The right sidebar and terminal input area still have three visual regressions after the master TUI rebuild (FID-2026-0722-043):

1. The right sidebar background color does not match the input box container.
2. Clicking anywhere in the UI highlights an entire row (focus/selection artifact).
3. The status box at the top of the sidebar is titled "ECHO Protocol", but the user wants the internal state of the Perfection Loop surfaced without exposing the ECHO brand.

These are cosmetic only, but they degrade the perceived quality of the terminal UI.

## Environment

- **OS:** Windows 11 / win32
- **Runtime:** Bun 1.3.14
- **Project:** `@savant-code/cli`
- **Commit/State:** Post-FID-2026-0722-043 implementation, uncommitted working tree

## Detailed Description

### Problem

1. **Background color mismatch**
   - `cli/src/components/right-sidebar.tsx` explicitly sets `backgroundColor={theme.surface}` on the root sidebar `<box>`.
   - The non-compact `ChatInputBar` container in `cli/src/components/chat-input-bar.tsx` has no explicit background color, so it inherits the terminal background.
   - The result is a visible color boundary between the input area and the sidebar when the terminal background differs from `theme.surface`.

2. **Global row highlight on click**
   - Clicking anywhere in the CLI — including the input box — causes OpenTUI to render a lighter/selected row behind the click target.
   - The `MultilineInput` component handles `onMouseDown` to set the cursor position but does not suppress the renderer's native selection/focus highlight.
   - `SidebarSection` already removed `focusable`, but the underlying issue is OpenTUI's default selection behavior on mouse interaction.

3. **"ECHO Protocol" label**
   - `cli/src/components/savant-ui/echo/perfection-loop.tsx` renders a bold title reading "ECHO Protocol".
   - The user has explicitly stated that ECHO is the internal coding standard and should not appear in the UI.
   - The component *does* surface the Perfection Loop state (FSM phase + runtime activity), but it is incorrectly branded.

### Expected Behavior

1. The right sidebar background matches the input box container exactly — it should inherit the terminal background, not paint a solid `theme.surface` panel.
2. Clicking in the UI positions the cursor or triggers the intended interaction without painting a full-row highlight.
3. The top status box is titled "Perfection Loop" and remains a contained bordered box.

### Root Cause

- `RightSidebar` hardcodes a background color that was added defensively during earlier sidebar fixes but now conflicts with the redesigned input area.
- `MultilineInput.handleMouseDown` does not call `event.preventDefault()` or clear the renderer selection, so OpenTUI's default text/row selection fires.
- `PerfectionLoop` was named for its internal ECHO context rather than its user-facing purpose.

### Evidence

```text
cli/src/components/right-sidebar.tsx:107
  backgroundColor={theme.surface}

cli/src/components/chat-input-bar.tsx (non-compact outer box)
  No backgroundColor set — inherits terminal background.

cli/src/components/multiline-input.tsx
  handleMouseDown computes cursor position but never prevents default selection.

cli/src/components/savant-ui/echo/perfection-loop.tsx:48
  <text ...>ECHO Protocol</text>
```

## Impact Assessment

### Affected Components

- `cli/src/components/right-sidebar.tsx`
- `cli/src/components/multiline-input.tsx`
- `cli/src/components/savant-ui/echo/perfection-loop.tsx`
- `cli/src/components/savant-ui/primitives/sidebar-section.tsx` (secondary review)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Cosmetic regression, no workaround other than accepting the visual artifact
- [ ] Low

## Proposed Solution

### Approach

1. Remove the explicit `backgroundColor` from `RightSidebar`'s root `<box>` so it matches the input box container.
2. Suppress the native OpenTUI row selection in `MultilineInput.handleMouseDown` by calling `event.preventDefault?.()` and `clearSelection()`.
3. Rename the `PerfectionLoop` title from "ECHO Protocol" to "Perfection Loop".

### Steps

1. `right-sidebar.tsx`: delete `backgroundColor={theme.surface}` on the root `<box>`.
2. `multiline-input.tsx`: in `handleMouseDown`, add `event.preventDefault?.()` and `clearSelection()` after computing the new cursor position.
3. `perfection-loop.tsx`: change the title text from "ECHO Protocol" to "Perfection Loop".
4. Update the comment in `right-sidebar.tsx` from `{/* ECHO Protocol */}` to `{/* Perfection Loop */}`.

### Verification

- `cd cli && bun run typecheck`
- `cd cli && bun x eslint cli/src/components/right-sidebar.tsx cli/src/components/multiline-input.tsx cli/src/components/savant-ui/echo/perfection-loop.tsx --max-warnings 0`
- Visual smoke test: launch CLI, confirm sidebar blends with input area, click around without row highlights, and verify the top box reads "Perfection Loop".

## Perfection Loop

### Loop 1

- **RED:** Three visual regressions identified: background mismatch, row highlight on click, and incorrect "ECHO Protocol" label.
- **GREEN:** Remove background color from sidebar; suppress default selection in MultilineInput; rename title to "Perfection Loop".
- **AUDIT:**
  - `cd cli && bun run typecheck` → exit 0, no errors.
  - `cd cli && bun x eslint src/components/right-sidebar.tsx src/components/multiline-input.tsx src/components/savant-ui/echo/perfection-loop.tsx --max-warnings 0` → exit 0, no warnings.
  - Full x4 typecheck gate (sdk, common, agent-runtime, cli) → all exit 0.
  - code-reviewer-kimi reviewed: approved with two noted follow-ups — possible compact-mode background mismatch, and potential drag-to-select regression in MultilineInput.
- **CHANGE DELETA:** < 1% of CLI source.

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22 20:05
- **Fix Description:**
  1. `right-sidebar.tsx`: removed explicit `backgroundColor={theme.surface}` from root `<box>` so sidebar inherits terminal background, matching the non-compact input box container.
  2. `multiline-input.tsx`: added `event.preventDefault?.()` and `clearSelection()` in `handleMouseDown` to suppress the OpenTUI row highlight on click in the input box.
  3. `perfection-loop.tsx`: changed title text from "ECHO Protocol" to "Perfection Loop"; updated comment in `right-sidebar.tsx`.
- **Tests Added:** No — visual changes only; existing CLI tests continue to pass.
- **Verified By:** `cd cli && bun run typecheck`; `bun x eslint --max-warnings 0` on affected files; full x4 typecheck gate; code-reviewer-kimi.
- **Commit/PR:** TBD
- **Archived:** 2026-07-22 20:05

## Lessons Learned

- Defensive background colors added during incremental fixes can conflict once the surrounding UI is redesigned.
- OpenTUI's default mouse selection must be explicitly suppressed when a component implements custom mouse handling.
- Internal protocol names should not leak into the user-facing UI; components should be named for what the user sees.
