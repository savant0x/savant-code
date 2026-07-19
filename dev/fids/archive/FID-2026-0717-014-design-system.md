# FID: Design System — Savant-UI Component Library

**Filename:** `FID-2026-0717-014-design-system.md`
**ID:** FID-2026-0717-014
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 20:00
**Author:** Spencer Howell

---

## Summary

The terminal UI has no reusable component library. Every component is built from scratch using OpenTUI primitives. There are no tables, no steppers, no badges, no toast notifications, no command palettes, no timelines. The ECHO Perfection Loop has no visual feedback — agents describe phases in text but don't show them visually. This FID creates `@savant-ui`, a comprehensive React component library for OpenTUI.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2 (React frontend, Zig engine, Bun FFI)
- **Theme:** Neon Slate (`#18faf9` cyan primary, `#020617` near-black bg)

## Detailed Description

### Problem

1. **No reusable components** — Every UI element built from primitives. Right sidebar manually constructs key-value pairs. Status bar manually builds indicators.
2. **No visual ECHO feedback** — Perfection Loop described in text only. Users can't see phases, FID progress, or agent activity.
3. **No design consistency** — Colors, spacing, borders hardcoded per-component. No shared tokens.
4. **No compound components** — Tables, steppers, trees, command palettes rebuilt from scratch each time.
5. **No input components** — Select, search, toggles all built inline per-use.
6. **No overlay system** — Modals, popovers, toasts all ad-hoc.
7. **No animation** — No typewriter effect, no pulse indicators, no transitions.
8. **No real-time visualization** — No cost tracking, no token meters, no timeline.

### Root Cause

No component library was designed. The codebase grew organically. The Neon Slate redesign improved colors but didn't create reusable components.

## Impact Assessment

- [x] High: No visual feedback for ECHO processes. Users can't see what the agent is doing.

## Proposed Solution

### Component Library Structure

```
cli/src/components/savant-ui/
├── index.ts                        # Barrel export
├── theme.ts                        # Design tokens
│
├── primitives/
│   ├── stack.tsx                   # Flexbox wrapper (direction, gap, align)
│   ├── panel.tsx                   # Bordered container with title
│   ├── separator.tsx               # Horizontal/vertical divider
│   └── spacer.tsx                  # Fixed-size gap
│
├── layout/
│   ├── split-pane.tsx              # Resizable side-by-side panels
│   ├── header.tsx                  # Fixed header with title + actions
│   ├── grid.tsx                    # Responsive multi-column grid
│   └── masonry.tsx                 # Variable-height grid
│
├── data-display/
│   ├── table.tsx                   # Row/column grid with headers, alignment, zebra striping
│   ├── key-value.tsx               # Label-value pairs with consistent formatting
│   ├── badge.tsx                   # Status tags (OPEN, CRITICAL, etc.)
│   ├── tag.tsx                     # Categorical labels
│   ├── code-block.tsx              # Code display with language label
│   ├── tree-view.tsx               # Hierarchical expand/collapse display
│   ├── timeline.tsx                # Chronological event log
│   └── sparkline.tsx               # Mini inline chart (token usage over time)
│
├── input/
│   ├── select.tsx                  # Dropdown picker (model, agent selection)
│   ├── search-input.tsx            # Filtered input with results
│   ├── checkbox.tsx                # Boolean toggle
│   ├── toggle.tsx                  # On/off switch
│   └── command-palette.tsx         # Fuzzy search command runner (Cmd+K)
│
├── feedback/
│   ├── progress-bar.tsx            # Block-character progress with color thresholds
│   ├── spinner.tsx                 # Animated loading indicator
│   ├── toast.tsx                   # Floating notification with auto-dismiss
│   ├── alert.tsx                   # Status message (info/warning/error)
│   └── cost-tracker.tsx            # Real-time cost visualization with trend
│
├── overlay/
│   ├── modal.tsx                   # Centered overlay with backdrop
│   ├── popover.tsx                 # Anchored tooltip/dropdown
│   └── drawer.tsx                  # Slide-in panel from edge
│
├── navigation/
│   ├── stepper.tsx                 # Multi-step wizard with phase indicators
│   ├── tabs.tsx                    # Tab panels
│   ├── breadcrumb.tsx              # Path navigation
│   └── pagination.tsx              # Page navigation
│
├── animation/
│   ├── typewriter.tsx              # Character-by-character text reveal
│   ├── pulse.tsx                   # Pulsing indicator for active agent
│   └── transition.tsx              # Fade/slide between states
│
└── echo/
    ├── fid-card.tsx                # FID summary card with badges
    ├── phase-indicator.tsx         # Current FSM phase display
    ├── perfection-loop.tsx         # Visual loop progress with iteration counter
    ├── agent-stack.tsx             # Agent hierarchy with active indicator
    ├── token-meter.tsx             # Context window usage gauge
    └── fid-list.tsx                # FID list with filtering and sorting
```

### Design Tokens (theme.ts)

```typescript
export const tokens = {
  spacing: { xs: 1, sm: 2, md: 3, lg: 4, xl: 6 },
  borders: { single: 'single', rounded: 'rounded', none: 'none' },
  radius: { none: 0, sm: 1, md: 2, lg: 3 },
  colors: {
    success: theme.success,
    error: theme.error,
    warning: theme.warning,
    info: theme.info,
    muted: theme.muted,
    primary: theme.primary,
    surface: theme.surface,
  },
  badges: {
    open: { fg: '#18faf9' },
    closed: { fg: '#22c55e' },
    critical: { fg: '#ef4444' },
    high: { fg: '#f59e0b' },
    medium: { fg: '#3b82f6' },
    low: { fg: '#6b7280' },
  },
  phase: {
    idle: { fg: '#6b7280', label: 'IDLE' },
    red: { fg: '#ef4444', label: 'RED' },
    green: { fg: '#22c55e', label: 'GREEN' },
    audit: { fg: '#eab308', label: 'AUDIT' },
    self_correct: { fg: '#f97316', label: 'FIX' },
    complete: { fg: '#06b6d4', label: 'DONE' },
  },
}
```

### Component Specifications

#### Layout

**`<Stack direction="vertical" gap={2} align="stretch">`**
- Flexbox wrapper. Replaces manual `<box flexDirection="column">` patterns.
- Props: `direction`, `gap`, `align`, `justify`, `wrap`

**`<Panel title="Session Stats" border="rounded">`**
- Bordered container with optional title bar.
- Props: `title`, `border`, `padding`, `height`

**`<SplitPane left={<Sidebar />} right={<Chat />} split={30}>`**
- Resizable side-by-side panels. Currently the sidebar is fixed at 30ch.
- Props: `left`, `right`, `split` (percentage), `resizable`

**`<Header title="SAVANT" actions={[{ label: '/fids', onClick }]} />`**
- Fixed header with title and action buttons.

#### Data Display

**`<Table columns={[{ key: 'name', label: 'Name', align: 'left' }]} rows={data} />`**
- Row/column grid with headers, alignment, zebra striping, borders.
- Props: `columns`, `rows`, `border`, `striped`, `emptyMessage`

**`<KeyValue items={[{ label: 'Model', value: 'opus-4.8' }]} />`**
- Label-value pairs with consistent formatting. Replaces manual sidebar KV.
- Props: `items`, `separator`, `labelWidth`

**`<Badge variant="critical">HIGH</Badge>`**
- Colored status tags. Predefined variants: open, closed, critical, high, medium, low.
- Props: `variant`, `children`, `pulse` (animated)

**`<Timeline events={[{ time: '14:30', label: 'Phase: RED → GREEN', color }]} />`**
- Chronological event log. For session history, FID lifecycle.
- Props: `events`, `maxItems`, `showTime`

**`<Sparkline data={[10, 25, 40, 35, 60]} width={20} />`**
- Mini inline chart using Unicode block characters. For token usage, cost trends.
- Props: `data`, `width`, `color`, `label`

**`<TreeView nodes={[{ label: 'src', children: [{ label: 'app.ts' }] }]} />`**
- Hierarchical expand/collapse display. For file trees, agent stacks.
- Props: `nodes`, `defaultExpanded`, `onSelect`

#### Input

**`<Select options={[{ label: 'Opus 4.8', value: 'opus' }]} value={model} onChange={setModel} />`**
- Dropdown picker. For model selection, agent selection.
- Props: `options`, `value`, `onChange`, `placeholder`, `disabled`

**`<SearchInput placeholder="Search commands..." onSearch={handleSearch} />`**
- Filtered input with results. For command palette, file search.
- Props: `placeholder`, `onSearch`, `results`, `onSelect`

**`<CommandPalette commands={[{ id: 'fids', label: '/fids', description: 'List FIDs' }]} onSelect={handleCommand} />`**
- Fuzzy search command runner. Replaces inline slash command logic.
- Props: `commands`, `onSelect`, `open`, `onClose`

**`<Toggle checked={strictMode} onChange={setStrictMode} label="Strict Mode" />`**
- On/off switch with label. For settings.
- Props: `checked`, `onChange`, `label`, `disabled`

#### Feedback

**`<ProgressBar value={75} max={100} label="Context" />`**
- Block-character progress with color thresholds. Refactored from ContextBar.
- Props: `value`, `max`, `label`, `showPercent`, `color`

**`<Spinner size="sm" label="Loading skills..." />`**
- Animated loading indicator. Refactored from ShimmerText.
- Props: `size`, `label`, `variant` (dots, spin, pulse)

**`<Toast type="success" message="FID-006 closed" autoDismiss={3000} />`**
- Floating notification. For FID updates, phase transitions.
- Props: `type`, `message`, `autoDismiss`, `onDismiss`

**`<Alert type="warning" title="Circuit Breaker" message="Max iterations reached" />`
- Status message with icon and title. For errors, warnings, info.
- Props: `type`, `title`, `message`, `actions`

**`<CostTracker cost={0.45} trend={[0.1, 0.2, 0.35, 0.45]} model="opus-4.8" />`**
- Real-time cost visualization with trend sparkline. For sidebar cost display.
- Props: `cost`, `trend`, `model`, `budget`

#### Overlay

**`<Modal open={showModal} onClose={close} title="Settings">`**
- Centered overlay with backdrop. For settings, confirmations.
- Props: `open`, `onClose`, `title`, `children`, `width`

**`<Popover trigger={<Button>Help</Popover>} content={<HelpPanel />}>`**
- Anchored tooltip/dropdown. For help text, tooltips.
- Props: `trigger`, `content`, `position`, `open`

#### Navigation

**`<Stepper steps={['RED', 'GREEN', 'AUDIT', 'COMPLETE']} current={2} />`**
- Multi-step wizard with phase indicators. For Perfection Loop visualization.
- Props: `steps`, `current`, `status` (per-step: pending/active/done/error)

**`<Tabs tabs={[{ id: 'fids', label: 'FIDs' }]} activeTab={tab} onChange={setTab}>`**
- Tab panels. For switching between views.
- Props: `tabs`, `activeTab`, `onChange`, `children`

**`<Breadcrumb items={[{ label: 'FIDs', path: '/fids' }, { label: '006' }]} />`**
- Path navigation. For FID hierarchy, file paths.
- Props: `items`, `onNavigate`

#### Animation

**`<Typewriter text="Analyzing codebase..." speed={30} />`**
- Character-by-character text reveal. For agent responses.
- Props: `text`, `speed`, `onComplete`, `cursor`

**`<Pulse color="#22c55e" label="Agent active" />`**
- Pulsing indicator. For active agent, streaming status.
- Props: `color`, `label`, `interval`

#### ECHO-Specific

**`<PerfectionLoop phase="green" iteration={3} maxIterations={10} fids={[...]} />`**
- Visual phase progress with iteration counter, circuit breaker status.
- Subscribes to Zustand store for real-time phase updates.

**`<FidCard id="006" status="closed" severity="critical" summary="Create Detective agent" onClick={showDetails} />`**
- Compact FID summary with badges. Clickable to expand.
- Props: `id`, `status`, `severity`, `summary`, `onClick`, `expanded`

**`<PhaseIndicator phase="audit" />`**
- Single-line phase display with color coding.

**`<AgentStack agents={[{ name: 'Orchestrator', active: true }, { name: 'Forge' }]} />`**
- Agent hierarchy with active agent highlighted.

**`<TokenMeter used={45000} max={128000} label="Context Window" />`**
- Context window usage gauge. Replaces inline ContextBar.
- Props: `used`, `max`, `label`, `warningThreshold` (default 0.7)

**`<FidList fids={[...]} filter="open" sortBy="severity" />`**
- FID list with filtering and sorting. For `/fids` command output.
- Props: `fids`, `filter`, `sortBy`, `onSelect`

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | Evidence |
|---|-------|----------|
| 1 | No reusable component library | Every component built from scratch |
| 2 | No visual ECHO feedback | Perfection Loop described in text only |
| 3 | No design tokens | Colors/spacing hardcoded per-component |
| 4 | No compound components | Tables, steppers, trees rebuilt each time |
| 5 | No input components | Select, search, toggles built inline |
| 6 | No overlay system | Modals, popovers, toasts ad-hoc |
| 7 | No animation | No typewriter, pulse, transitions |
| 8 | No real-time visualization | No cost tracking, token meters, timelines |
| 9 | No command palette | Slash commands have inline fuzzy search |
| 10 | Right sidebar manually builds KV pairs | `right-sidebar.tsx:118-132` |
| 11 | Status bar manually builds indicators | `status-bar.tsx:63-277` |
| 12 | ContextBar not reusable | Inline in right-sidebar only |

### GREEN Phase — Proposed Fixes

**Fix 1: Create component library directory** — `cli/src/components/savant-ui/` with 8 subdirectories.

**Fix 2: Define design tokens** — `theme.ts` with spacing, borders, colors, badges, phase colors.

**Fix 3: Build primitives** (4 components) — Stack, Panel, Separator, Spacer.

**Fix 4: Build layout** (4 components) — SplitPane, Header, Grid, Masonry.

**Fix 5: Build data display** (8 components) — Table, KeyValue, Badge, Tag, CodeBlock, TreeView, Timeline, Sparkline.

**Fix 6: Build input** (5 components) — Select, SearchInput, Checkbox, Toggle, CommandPalette.

**Fix 7: Build feedback** (5 components) — ProgressBar, Spinner, Toast, Alert, CostTracker.

**Fix 8: Build overlay** (3 components) — Modal, Popover, Drawer.

**Fix 9: Build navigation** (4 components) — Stepper, Tabs, Breadcrumb, Pagination.

**Fix 10: Build animation** (3 components) — Typewriter, Pulse, Transition.

**Fix 11: Build ECHO** (6 components) — PerfectionLoop, FidCard, PhaseIndicator, AgentStack, TokenMeter, FidList.

**Fix 12: Refactor existing** — right-sidebar → KeyValue+Badge+Panel. status-bar → PhaseIndicator+Badge. thinking.tsx → Panel+collapsible.

### AUDIT Phase — Verification

| # | Check | Method |
|---|-------|--------|
| 1 | Components render correctly | Visual inspection in terminal |
| 2 | Theme tokens consistent | All components import from `theme.ts` |
| 3 | Reusable | Same component used in 2+ places |
| 4 | Typecheck passes | `bun run --cwd=cli typecheck` |
| 5 | No heavy deps | Pure React components, no new packages |
| 6 | ECHO components reactive | Subscribe to Zustand stores |
| 7 | Keyboard navigation | All interactive components use `useKeyboard` |
| 8 | Empty states handled | All data components accept `emptyMessage` |

### SELF-CORRECT Phase

**Finding:** 37 components is too many for one FID.

**Correction:** Phase into 4 sub-FIDs:
- **Phase 1:** Design tokens + primitives + layout (12 components) — foundation
- **Phase 2:** Data display + input (13 components) — core building blocks
- **Phase 3:** Feedback + overlay + navigation (12 components) — interaction layer
- **Phase 4:** Animation + ECHO (9 components) — domain-specific polish

**Finding:** The `<SplitPane>` needs resize handling. OpenTUI doesn't have native resize events.

**Correction:** Start with fixed split (percentage). Add resize in Phase 3 if needed. The current 30ch sidebar works fine for now.

**Finding:** `<CommandPalette>` needs fuzzy search. No fuzzy search library in the codebase.

**Correction:** Implement simple contains-match for v1. Upgrade to fuzzy later if needed. The slash command system already has basic filtering.

**Finding:** `<Typewriter>` animation needs `setInterval` — same pattern as `ShimmerText` and `InputCursor`.

**Correction:** Consistent with existing animation pattern. No new animation API needed.

**Finding:** `<CostTracker>` needs historical data. Currently cost is a single number in Zustand.

**Correction:** Extend Zustand store to track cost history array (last N data points). The sparkline component needs this data.

**Finding:** `<FidList>` needs to read FID files from disk. Components shouldn't do filesystem I/O.

**Correction:** FID data flows through Zustand store (populated by CLI at boot). Component just renders store data.

**Finding:** How do components handle the Neon Slate theme? The theme system uses `useTheme()` which returns `ChatTheme`.

**Correction:** Design tokens reference `theme.*` properties. Components call `useTheme()` internally. Tokens are computed from the active theme.

**Finding:** Should components be documented? A component library without docs is useless.

**Correction:** Add JSDoc comments to each component. Create `cli/src/components/savant-ui/README.md` with usage examples. Low priority — docs can follow implementation.

**Finding:** What about testing components? Visual testing in a terminal is hard.

**Correction:** Unit test rendering logic (props → output). Skip visual regression testing for now. Manual testing via `bun dev`.

### COMPLETE Phase

FID converged. 37 components across 8 categories. Phased into 4 sub-FIDs for manageable implementation.

## Blind Spots (Questions I Should Have Asked)

1. **Should the component library be a separate package?** — No. Keep in `cli/src/components/savant-ui/` for now. Extract to package only if other projects need it.

2. **How do components handle terminal resize?** — OpenTUI flexbox handles this. Components use `width: '100%'` and flex properties. No explicit resize handling needed.

3. **Should components be pure or stateful?** — Most pure (Table, Badge, KeyValue). Stateful only for feedback (Spinner, Toast, CostTracker) and interactive (Select, Toggle, CommandPalette).

4. **How do ECHO components get real-time data?** — Subscribe to Zustand stores via React hooks. `useChatStore` for fsmPhase, cost, agent stack.

5. **What about accessibility?** — Terminal accessibility = keyboard navigation via `useKeyboard`. Screen reader support out of scope.

6. **Should design tokens be customizable?** — Yes. `theme.ts` exports defaults. Theme override via `useTheme()`.

7. **How do components handle empty states?** — Each data component accepts `emptyMessage` prop.

8. **What about loading states?** — `<Spinner>` handles this. Components accept `loading` prop.

9. **How do components handle error states?** — `<Alert type="error">` for error messages. Components can accept `error` prop.

10. **Should the library follow a naming convention?** — Yes. PascalCase for components. `screaming-snake` for props. Consistent with React conventions.

11. **What about internationalization?** — Terminal UI is inherently English-only. No i18n needed.

12. **How do components handle very long text?** — `<text wrapMode="word">` for wrapping. `<span>` with `truncate` for overflow. Components should handle this internally.

13. **Should the library include icons?** — Terminal icons are limited. Use Unicode symbols (✓, ✗, ●, ◆, etc.) and badge colors instead.

14. **What about dark/light theme?** — Neon Slate is dark-only. Light theme would require a separate theme. Out of scope for now.

15. **How do components handle focus?** — Interactive components use `useKeyboard` for key handling. Focus management is implicit via tab order.

## Resolution

- **Fixed By:** Pending
- **Fixed Date:** Pending
- **Fix Description:** Pending
- **Tests Added:** Pending
- **Verified By:** Pending
- **Commit/PR:** Pending
- **Archived:** Pending

## Lessons Learned

- Component libraries should be designed holistically — not built one component at a time
- Design tokens are the foundation — without them, every component is inconsistent
- ECHO-specific components need real-time data binding (Zustand subscriptions)
- Terminal UI components are simpler than web — no CSS, no DOM, just flexbox + text
- Phase the work — foundation first, then building blocks, then interaction, then domain-specific
- Command palettes and fuzzy search are essential for CLI UX — don't skip them
- Animation in terminals is manual (setInterval) — keep it simple
- Cost visualization needs historical data — extend stores early
