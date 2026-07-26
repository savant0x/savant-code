# FID-2026-0722-042 — FidCard and FidList Visual Redesign

**Filename:** `dev/fids/FID-2026-0722-042-fidcard-fidlist-redesign.md`
**ID:** FID-2026-0722-042
**Severity:** high
**Status:** closed
**Created:** 2026-07-22 18:10
**Updated:** 2026-07-22 18:45
**Author:** ECHO Orchestrator

---

## Summary

Redesign the `FidCard` and `FidList` components used by the right sidebar's Active FIDs section. The current card uses hardcoded indentation strings and inline badge spans that do not match the new sidebar visual language. The redesign removes string-based indentation, uses flex-based layout, adds a clear expand/collapse chevron, and presents severity/status as small pill badges without square brackets.

---

## Environment

- **OS:** Windows 11 / cross-platform TypeScript CLI
- **Language/Runtime:** TypeScript 5.5, Bun 1.3.14
- **Tool Versions:** `@opentui/core` 0.2.2, React 19
- **Commit/State:** main branch, v0.0.4 prep; supersedes FID-038

---

## Detailed Description

### Problem

The current `FidCard` in `cli/src/components/savant-ui/echo/fid-card.tsx`:

```tsx
const titleRow = (
  <text fg={theme.foreground} attributes={TextAttributes.BOLD}>
    {`    FID-${shortId}`}
  </text>
)
```

```tsx
<span fg={severityColor}>{`    [${severity}]`}</span>
{' '}
<span fg={statusColor}>{`[${statusLabel}]`}</span>
```

Issues:
1. **Hardcoded indentation** (`    FID-...`) ties the card to the sidebar's internal padding.
2. **Square-bracket badges** look busy and inconsistent with modern pill-style badges.
3. **No expand/collapse affordance** — it is not obvious the card is interactive.
4. **Inline span string** makes the component fragile to OpenTUI text nesting rules.

`FidList` also lacks a clear empty state and uses a plain `<text>No FIDs found</text>` without theme context.

### Expected Behavior

- `FidCard` renders as a self-contained card with no hardcoded indentation.
- Title row shows an expand/collapse chevron (`▶`/`▼`) and the short FID ID in bold.
- Badges are small, rounded (via style if supported, otherwise simple padding), and use the severity/status color without square brackets.
- Summary is shown only when expanded.
- Clicking the card toggles expansion without leaving a selected-text artifact (`makeTextUnselectable`).

### Root Cause

`FidCard` was written as a quick presentational component during FID-033c Phase C. It was patched in FID-038 to remove a native border collision, but its visual design was never revisited. It still carries the layout assumptions of the old ASCII sidebar.

### Evidence

- `cli/src/components/savant-ui/echo/fid-card.tsx:70-90` — hardcoded 4-space prefix and inline badge spans.
- `cli/src/components/savant-ui/echo/fid-list.tsx:44-48` — empty state with no theme.

---

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/echo/fid-card.tsx`
- `cli/src/components/savant-ui/echo/fid-list.tsx`
- `cli/src/components/right-sidebar.tsx` (consumer, minor padding adjustments)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

*High severity because the Active FIDs section is a core ECHO Protocol surface; poor visual design undermines trust in the protocol status.*

---

## Proposed Solution

### Approach

Rewrite `FidCard` as a flex-based component with clear interactive affordances. Keep `FidList` as the list container but update its empty state and spacing.

### Steps

1. **Rewrite `FidCard`**
   - Props remain: `id`, `status`, `severity`, `summary`, `onClick?`, `expanded?`.
   - Remove hardcoded 4-space prefixes; let the parent `FidList` provide padding if needed.
   - Title row:
     ```tsx
     <box flexDirection="row" gap={1} alignItems="center">
       <text fg={theme.muted}>{expanded ? '▼' : '▶'}</text>
       <text fg={theme.foreground} attributes={TextAttributes.BOLD}>
         FID-{shortId}
       </text>
     </box>
     ```
   - Badge row:
     ```tsx
     <box flexDirection="row" gap={1}>
       <Badge variant={severity}>{severity}</Badge>
       <Badge variant={status}>{status}</Badge>
     </box>
     ```
   - Summary row: shown only when expanded, with `theme.muted`.
   - Wrap the whole card in `makeTextUnselectable` and attach `onMouseDown={handleToggle}`.

2. **Update `FidList`**
   - Keep `gap={1}` between cards.
   - Update empty state to use `theme.muted`.
   - Remove any padding; the card should be layout-agnostic.

3. **Verify**
   - `cd cli && bun run typecheck`
   - `bun x eslint cli/src/components/savant-ui/echo/fid-card.tsx cli/src/components/savant-ui/echo/fid-list.tsx --max-warnings 0`
   - Visual inspection: chevron toggles, badges are pills, no selectable-text artifacts.

### Verification

1. Typecheck passes.
2. ESLint passes on both files.
3. Visual check: Active FIDs section renders clean cards with chevrons and pill badges.

---

## Perfection Loop

### Loop 1

- **RED:**
  - `FidCard` uses hardcoded indentation and inline badge spans.
  - Square-bracket badges look busy and inconsistent with the redesigned system.
  - No expand/collapse affordance.
- **GREEN:**
  - Convert `FidCard` to a flex-based card with chevron, title, pill badges, and expandable summary.
  - Remove hardcoded indentation from the card; let parent control spacing.
  - Update `FidList` empty state.
- **AUDIT:**
  - Design reviewed against OpenCode `TodoItem` and `files.tsx` list item patterns.
  - Border collision risk re-evaluated: card will use no native border, only flex rows — compatible with FID-040's native left-border sidebar.
  - Verification commands identified.
- **CHANGE DELTA:** ~40% of `fid-card.tsx`; minor `fid-list.tsx` changes.

### Missed Questions (folded back into the FID)

- **Q1: What happens when a FID summary is very long?**
  - The summary `<text>` uses `wrapMode="wrap"` and is constrained to the parent width. Long summaries wrap, and the card expands vertically.
- **Q2: What if there are no active FIDs?**
  - `FidList` already renders a "No FIDs found" empty state. The redesign updates this state to use `theme.muted`.
- **Q3: Does the chevron toggle conflict with the card's `onClick`?**
  - No. The entire card is clickable. The chevron is purely visual feedback and does not have its own handler.
- **Q4: Should the card be keyboard-focusable?**
  - For this FID, focus is handled by the surrounding `SidebarSection`. A future FID can add explicit tabIndex and keyboard handlers to `FidCard`.
- **Q5: How do pill badges look in the light theme?**
  - They use theme tokens (severity/status color for text, no background). They remain readable in both light and dark modes.

---

## Resolution

- **Fixed By:** [Pending — Forge]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** [Pending]
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending]

---

## Lessons Learned

1. **Presentational components should be layout-agnostic.** Hardcoded padding in `FidCard` made it impossible to reuse outside the sidebar.
2. **Affordances matter.** Without a chevron, users could not tell the card was interactive.
3. **Badge style should match the design system.** Square brackets were a leftover from early prototyping.

---

## Linked Documents

- [FID-2026-0722-038](./FID-2026-0722-038-sidebar-fidcard-native-border-collision.md) — prior border collision fix (partially superseded)
- [FID-2026-0722-040](./FID-2026-0722-040-sidebar-core-layout-redesign.md) — sidebar core layout redesign
- [FID-2026-0722-041](./FID-2026-0722-041-terminal-components-redesign.md) — terminal components redesign
- [FID-2026-0722-043](./FID-2026-0722-043-master-sidebar-terminal-redesign.md) — Master FID
