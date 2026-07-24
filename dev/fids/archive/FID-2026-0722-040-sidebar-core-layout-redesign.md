# FID-2026-0722-040 — Right Sidebar Core Layout & Visual System Redesign

**Filename:** `dev/fids/FID-2026-0722-040-sidebar-core-layout-redesign.md`
**ID:** FID-2026-0722-040
**Severity:** high
**Status:** analyzed
**Created:** 2026-07-22 18:00
**Updated:** 2026-07-22 18:45
**Author:** ECHO Orchestrator

---

## Summary

Redesign the core layout and visual system of the right sidebar so it looks professional, uses native OpenTUI layout primitives consistently, and eliminates the ASCII box-drawing characters and manual string-padding that currently make it appear unfinished. All existing information sections (ECHO Protocol, Session, Tools, Files Changed, Agent Stack, Active FIDs, History) are preserved; only their presentation is modernized.

---

## Environment

- **OS:** Windows 11 / cross-platform TypeScript CLI
- **Language/Runtime:** TypeScript 5.5, Bun 1.3.14
- **Tool Versions:** `@opentui/core` 0.2.2, React 19
- **Commit/State:** main branch, v0.0.4 prep; supersedes aspects of FID-036 and FID-037

---

## Detailed Description

### Problem

`cli/src/components/right-sidebar.tsx` currently builds the sidebar from hand-drawn ASCII characters:

```tsx
const W = 40
const topBorder = '┌' + '─'.repeat(W - 2) + '┐'
const midBorder = '├' + '─'.repeat(W - 2) + '┤'
const botBorder = '└' + '─'.repeat(W - 2) + '┘'
```

Section headers and data rows are rendered as plain `<text>` elements with hardcoded space padding:

```tsx
<text fg={theme.muted}>{`    cost    ${formatCost(cost)}`}</text>
```

This produces a number of visual problems:
1. **Inconsistent borders:** ASCII dividers compete with any native `<box border>` used by child components (see FID-038).
2. **No visual hierarchy:** every row has the same weight and color; scanning is difficult.
3. **Brittle layout:** alignment depends on monospace width and manual padding, which breaks when labels or values change.
4. **Unprofessional appearance:** the sidebar looks hand-drawn rather than part of a coherent design system.

### Expected Behavior

The sidebar should use native OpenTUI flexbox and border primitives:

- A single native left border on the sidebar root (`borderLeft`) separates it from the chat area.
- Each section is wrapped in a collapsible `SidebarSection` primitive with a bold primary header and `▶`/`▼` chevron.
- Key/value rows use a `KeyValueRow` primitive with `justifyContent="space-between"` instead of manual spacing.
- Spacing and alignment are driven by `paddingLeft`, `gap`, and `flexDirection`, not string concatenation.

### Root Cause

The sidebar was implemented early in the project before the Savant-UI primitive system existed. It predates `flexDirection`, `justifyContent`, and native border props, so the author fell back to string-based box drawing and space padding. Subsequent redesign phases added new sections without refactoring the layout foundation, compounding the problem.

### Evidence

- `cli/src/components/right-sidebar.tsx:79-86` defines `topBorder`, `midBorder`, `botBorder`, and `centerLine()`.
- `cli/src/components/right-sidebar.tsx:160-203` renders section headers and data rows with manual spacing.
- `cli/src/components/savant-ui/primitives/` contains no `SidebarSection` or `KeyValueRow` primitive.

---

## Impact Assessment

### Affected Components

- `cli/src/components/right-sidebar.tsx`
- `cli/src/components/savant-ui/primitives/sidebar-section.tsx` (new)
- `cli/src/components/savant-ui/primitives/key-value-row.tsx` (new)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

Replace the ASCII-based layout with native OpenTUI primitives. Introduce two reusable components: `SidebarSection` (collapsible section wrapper) and `KeyValueRow` (label/value flex row). Keep all existing data and sections; only change presentation.

### Steps

1. **Create `SidebarSection` primitive**
   - Props: `title: string`, `defaultExpanded?: boolean`, `children: ReactNode`.
   - Renders a `<box flexDirection="column" gap={1}>`.
   - Header row: `<box flexDirection="row" gap={1}>` with chevron `▶`/`▼`, bold `theme.primary` title.
   - `onMouseDown` toggles expansion; children wrapped with `makeTextUnselectable`.
   - Body: `<box flexDirection="column" paddingLeft={2}>` when expanded.

2. **Create `KeyValueRow` primitive**
   - Props: `label: string`, `value: ReactNode`, `valueColor?: string`.
   - Renders `<box flexDirection="row" justifyContent="space-between">`.
   - Label uses `theme.muted`; value uses `valueColor ?? theme.foreground`.

3. **Rewrite `right-sidebar.tsx` layout**
   - Remove `W`, `inner`, `topBorder`, `midBorder`, `botBorder`, `centerLine()`.
   - Root: `<box flexDirection="column" width={40} borderLeft borderStyle="single" borderColor={theme.border} paddingTop={1} gap={1}>`.
   - Header section: keep bold "SAVANT" / tagline, centered with native alignment.
   - Wrap every data section in `SidebarSection`.
   - Replace manual strings with `KeyValueRow`.
   - Remove the explicit bottom border line; the native left border is sufficient.

4. **Verify no regression**
   - `cd cli && bun run typecheck`
   - `bun x eslint cli/src/components/right-sidebar.tsx cli/src/components/savant-ui/primitives/sidebar-section.tsx cli/src/components/savant-ui/primitives/key-value-row.tsx --max-warnings 0`
   - Visual inspection in tmux: all sections still render, no double-bar artifacts.

### Verification

1. `cd cli && bun run typecheck` — zero errors.
2. `bun x eslint cli/src/components/right-sidebar.tsx cli/src/components/savant-ui/primitives/sidebar-section.tsx cli/src/components/savant-ui/primitives/key-value-row.tsx --max-warnings 0` — zero warnings.
3. `tmux-cli` visual check: sidebar shows native left border only, sections collapsible, data rows aligned without ASCII dividers.

---

## Perfection Loop

### Loop 1

- **RED:**
  - ASCII box-drawing and manual padding in `right-sidebar.tsx` create an unprofessional appearance and conflict with child components that use native borders.
  - No reusable primitives exist for sidebar sections or key/value rows.
  - Existing FID-036 and FID-037 attempted partial fixes but never addressed the root layout system.
- **GREEN:**
  - Adopt native OpenTUI layout: `flexDirection`, `justifyContent`, `gap`, `paddingLeft`, `borderLeft`.
  - Introduce `SidebarSection` and `KeyValueRow` primitives.
  - Preserve all existing sections and data.
- **AUDIT:**
  - Design reviewed against OpenCode `sidebar/files.tsx` and `sidebar/todo.tsx` patterns — collapsible section + flex row layout matches reference.
  - Scope confirmed: only `right-sidebar.tsx` and two new primitive files.
  - Verification commands identified.
- **CHANGE DELTA:** ~25% of `right-sidebar.tsx`; two new small primitive files.

### Missed Questions (folded back into the FID)

- **Q1: What happens when the terminal is narrower than the 40-char sidebar width?**
  - The sidebar has a fixed `width={40}` today. The redesign preserves this width. If the terminal is narrower, OpenTUI clips the sidebar just as it does today. Future FID can address responsive width.
- **Q2: Are the new primitives theme-aware for both dark and light modes?**
  - Yes. `SidebarSection` and `KeyValueRow` use `theme` tokens only (`primary`, `muted`, `foreground`, `border`). They do not hardcode colors.
- **Q3: How do keyboard users interact with collapsible sections?**
  - `SidebarSection` will accept focus and respond to Enter/Space via `onMouseDown` and a future `onKeyDown`. For this FID, mouse toggling is primary; keyboard navigation is a future enhancement.
- **Q4: Are existing FID-036 and FID-037 affected?**
  - FID-040 supersedes their visual-layout aspects. They will be closed as superseded when FID-040 is archived.

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

1. **Build primitives before ad-hoc rendering.** If `SidebarSection` and `KeyValueRow` had existed from the start, the sidebar would never have accumulated ASCII art.
2. **Native layout beats string math.** OpenTUI's flexbox engine handles alignment, truncation, and terminal resizing more reliably than manual spaces.
3. **Supersede, don't patch.** FID-036 and FID-037 chased symptoms; FID-040 addresses the underlying layout foundation.

---

## Linked Documents

- [FID-2026-0721-036](./FID-2026-0721-036-right-sidebar-fid-enhance.md) — prior FID display enhancement (partially superseded)
- [FID-2026-0721-037](./FID-2026-0721-037-right-sidebar-stroke-artifact.md) — prior stroke artifact fix (partially superseded)
- [FID-2026-0722-038](./FID-2026-0722-038-sidebar-fidcard-native-border-collision.md) — FidCard border collision
- [FID-2026-0722-041](./FID-2026-0722-041-terminal-components-redesign.md) — sibling FID for other terminal components
- [FID-2026-0722-042](./FID-2026-0722-042-fidcard-fidlist-redesign.md) — sibling FID for FID card/list
- [FID-2026-0722-043](./FID-2026-0722-043-master-sidebar-terminal-redesign.md) — Master FID
