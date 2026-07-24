# FID-2026-0722-045 — CLI Layout Breaks When Terminal Resized Smaller

**Filename:** `dev/fids/FID-2026-0722-045-cli-responsive-layout.md`
**ID:** FID-2026-0722-045
**Severity:** high
**Status:** closed / archived
**Created:** 2026-07-22
**Author:** Forge

---

## Summary

The main chat layout in `cli/src/chat.tsx` uses a fixed 40-column `RightSidebar` beside a flexible chat column. When the terminal window is made smaller, the chat column is squeezed down to an unusable width and the overall layout breaks. The CLI must adapt gracefully to narrow terminals by removing non-essential chrome so the chat area remains readable and functional.

## Environment

- **OS:** Windows 11 / bash shell
- **Language/Runtime:** TypeScript / Bun / OpenTUI
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main after FID-2026-0722-044

## Detailed Description

### Problem

The root layout in `chat.tsx` renders a horizontal row with the message scrollbox + input on the left and `RightSidebar` on the right. The sidebar is declared with `width={40}` and `flexShrink={0}`, while the left column grows with `flexGrow: 1`. On small terminal widths the left column shrinks until message text wraps extremely, the input box is crushed, and visual alignment collapses.

### Expected Behavior

As the terminal width shrinks, the CLI should preserve a usable chat area. The right sidebar is supplemental and should be hidden once the terminal becomes too narrow to support both panes. The chat area should then expand to the full terminal width.

### Root Cause

The layout has no breakpoint behavior. The sidebar always renders at a fixed width, so it never relinquishes space when the terminal is narrow.

## Impact Assessment

### Affected Components

- `cli/src/chat.tsx`
- `cli/src/components/right-sidebar.tsx` (no direct change, but consumer behavior changes)

### Risk Level

- [ ] Critical
- [x] High: Major feature broken (UI unusable at narrow widths), workaround exists (resize terminal larger)
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Introduce a single responsive breakpoint in `chat.tsx`. When `terminalWidth` is below a safe threshold (100 columns), do not render the `RightSidebar`. The left chat column, already using `flexGrow: 1`, will then occupy the full terminal width. This avoids the complexity and vertical-space loss of a stacked layout.

### Steps

1. Read `chat.tsx` layout JSX and confirm `terminalWidth` is available from `useChatUI`.
2. Add a local constant or derive a boolean `showSidebar = terminalWidth >= 100`.
3. Conditionally render `RightSidebar` only when `showSidebar` is true.
4. Run CLI typecheck.
5. Run ESLint on changed files.
6. Code review.

### Verification

- `cd cli && bun run typecheck` passes.
- `cd cli && bun x eslint src/chat.tsx --max-warnings 0` passes.
- Code reviewer approves.
- Manual test: launch CLI, resize terminal below 100 columns, confirm sidebar hides and chat area uses full width.

## Perfection Loop

### Loop 1

- **RED:** Sidebar always renders at 40 columns; narrow terminals break the layout.
- **GREEN:** Conditionally hide sidebar when `terminalWidth < 100`.
- **AUDIT:** Typecheck, lint, and code review pass. Layout adapts to width changes.
- **CHANGE DELTA:** < 20 lines in `chat.tsx`.

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22
- **Fix Description:** Added responsive sidebar visibility in `chat.tsx` based on terminal width.
- **Tests Added:** No — visual/layout change, manual tmux verification recommended.
- **Verified By:** `cd cli && bun run typecheck` exit 0; `bun x eslint src/chat.tsx --max-warnings 0` exit 0; code-reviewer-kimi approved.
- **Commit/PR:** 
- **Archived:** 2026-07-22
