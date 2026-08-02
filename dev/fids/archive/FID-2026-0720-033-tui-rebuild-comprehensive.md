# FID: Comprehensive TUI Rebuild — Theme, Layout, Components & ECHO Integration

**Filename:** `FID-2026-0720-033-tui-rebuild-comprehensive.md`
**ID:** FID-2026-0720-033
**Severity:** critical
**Status:** closed
**Created:** 2026-07-20 23:45
**Author:** ECHO Agent (plan), Spencer Howell (execution via glm-5.2 agent)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived (superseded by 033a-033e phases)`; Original ID: `FID-2026-0720-033`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

The current CLI UI is a pre-fork default inherited from the original template. The logic layer has been heavily customized for ECHO Protocol (9-agent roster, Perfection Loop FSM, FID-bound execution, tool-phase gating, activity tracking, sub-agent spawning), but the view layer hasn't caught up. This FID defines a comprehensive, incremental rebuild of the TUI in 5 phases — theme system, glyph/icon system, tool & message rendering, layout & navigation, and polish — while preserving every existing capability and adding bespoke ECHO component surfaces. **View layer only: zero changes to agent-runtime, sdk/impl, common, agents, or ECHO.md.**

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **UI Framework:** OpenTUI v0.2.2 (`@opentui/core` + `@opentui/react`, React 19)
- **Reference (MIT):** opencode-dev `packages/tui/` theme system (1089 lines, 30+ JSON themes)
- **Current Theme:** 41-line `theme.ts` with 7 hardcoded colors
- **ChatTheme type:** 144-line `types/theme-system.ts` with ~40 semantic tokens
- **ECHO components:** 6 exist in `savant-ui/echo/` (PhaseIndicator, PerfectionLoop, FidCard, FidList, AgentStack, TokenMeter) — partially wired
- **Tool renderers:** 21 in `components/tools/`, 6 widget types in render_ui handler

---

## Detailed Description

### Problem

1. **Theme system is minimal** — 41 lines, 7 hardcoded colors (`#22c55e`, `#ef4444`, `#f59e0b`, `#3b82f6`, `#6b7280`, `#18faf9`, `#0f172a`). No dark/light switching, no terminal auto-detection, no reference resolution, no plugin system. opencode-dev has 1089 lines, 30+ JSON themes, `resolveTheme()` with reference chains, `generateSystem()` for terminal detection, `generateSyntax()` for tree-sitter highlighting.

2. **Right sidebar is a box-drawing artifact** — 40-char fixed width, manual `┌─┐├─┤└─┘` borders, inline `<span>` children for mixed colors (because OpenTUI forbids nesting `<text>` inside `<text>`). Data wiring exists but uses hardcoded values in many places. No theme token integration.

3. **Tool renderers are inconsistent** — 21 tool-renderer components exist but vary in quality. Some use theme tokens, some use hardcoded colors. render_ui supports 6 widget types (button, table, card, stepper, badge, perfection_loop) but the schema defines 14. No diff viewer, no reasoning blocks, no context-tool grouping.

4. **No command palette** — Slash commands work via inline menu triggered by `/`. No overlay, no filtering UI, no keyboard-driven selection beyond arrow keys. opencode-dev has a proper command palette overlay.

5. **No dialog/toast system** — ask-user, feedback, publish confirmation, model picker, review screen all use ad-hoc input mode switching. No reusable modal system. No ephemeral notifications.

6. **ECHO components are partially wired** — `AgentStack` and `Timeline` are used in sidebar. `PhaseIndicator` is used inline (not as component, due to OpenTUI nesting limitation). `PerfectionLoop` exists but is only rendered via `render_ui` widget. `FidCard` and `FidList` exist but are not wired to live FID data. No sub-agent tree visualization. No activity indicator in sidebar (FID-009 design converged but not implemented).

7. **Dead component risk** — FID-017 proved that 27 of 28 Savant-UI components were dead code. Current `savant-ui/` has 6 ECHO components + 20+ primitives/layout/data-display/input/feedback/navigation/animation components. Must verify each is wired before building new ones.

### Expected Behavior

A polished, theme-aware TUI that:

- Automatically detects and applies dark/light themes from terminal, IDE, or OS
- Shows ECHO Protocol state (FSM phase + runtime activity) as two distinct signals in the sidebar
- Renders all 42 tool types with consistent, expandable card UI
- Provides a command palette overlay for slash commands
- Uses modal dialogs for ask-user, feedback, publish, model picker, review
- Shows toast notifications for ephemeral feedback (clipboard copy, file changes)
- Renders sub-agent spawning trees with live progress
- Uses Nerd Font icons with ASCII fallback
- Has zero hardcoded colors — all values from theme tokens
- Has zero dead components — every exported component is wired to a render pipeline

### Root Cause

The UI was inherited from the original CLI template and never redesigned for ECHO Protocol. The theme system was a quick 7-color stub. The sidebar was a hand-built box-drawing layout. Tool renderers were added incrementally without a unified design system. The ECHO components were built speculatively (FID-017) without wiring.

### Evidence

#### Agent-Runtime Feature Inventory (42 tools)

| Category | Tools | UI Surface Needed |
|---|---|---|
| File-writing (GREEN-gated) | write_file, str_replace, apply_patch, propose_write_file, propose_str_replace, create_plan | Diff view, success/error card |
| File-reading | read_files, read_subtree, read_url, read_docs | Code block, tree visualization, rendered URL, research panel |
| Search/exploration | glob, find_files, list_directory, code_search, gravity_index | File list, search results, recommendation panel |
| Web/research | web_search | Research panel with query + source badge |
| Terminal (AUDIT-gated) | run_terminal_command | Terminal output panel (stdout/stderr, exit code) |
| Sub-agent spawning | spawn_agents, spawn_agent_inline | Sub-agent tree with nested progress |
| Thinking | sequentialthinking, think_deeply | Thinking steps visualization, logged thought |
| Agent context | add_subgoal, update_subgoal, add_message, set_messages | Subgoal tracker, internal message ops |
| Output/completion | set_output, task_completed, end_turn, suggest_followups, write_todos | Turn indicator, followup chips, todo list |
| UI rendering | render_ui | 14 widget types (6 implemented, 8 missing) |
| Interactive | ask_user | Modal dialog with options |
| Skill | skill | Skill content display |
| ECHO FSM | transition_phase | Phase indicator update with reason |
| Lookup | lookup_agent_info | Agent info card |
| Browser | browser_logs | Console log display |
| Composio | composio_* (4 tools) | External tool integration panels |
| File hooks | run_file_change_hooks | Hook execution results |

#### FSM Phase Gating

| Phase | Write tools | Terminal | sequentialthinking |
|---|---|---|---|
| idle | BLOCKED | BLOCKED | Thinker only |
| red | BLOCKED | BLOCKED | Thinker only |
| green | ALLOWED | BLOCKED | Thinker only |
| audit | BLOCKED | ALLOWED | Thinker only |
| self_correct | BLOCKED | BLOCKED | Thinker only |
| complete | BLOCKED | BLOCKED | Thinker only |

Error messages returned: `"Tool \`{name}\` is only available during the GREEN phase..."`, `"Tool \`{name}\` is only available during the AUDIT phase..."`, etc.

#### Activity Tracking (5 kinds)

| Kind | Fields | UI Rendering |
|---|---|---|
| idle | `since: number` | "Idle" or duration |
| thinking | `model?: string, startedAt: number` | "Thinking..." + model + spinner |
| tool | `toolName, startedAt, target?: string` | "write_file → src/index.ts" + spinner |
| subagent | `agentType, startedAt, prompt?: string` | "Running {agentType}..." + nested indicator |
| researching | `query, startedAt, source: 'web'\|'docs'` | "Researching '{query}'..." + source badge |

Security: Free-form text fields NEVER included in activity (prevents PII/secret leaks). 30-char truncation on targets, 60-char on research queries.

#### Streaming Events (11 types)

| Event | Payload | UI Surface |
|---|---|---|
| start | `{ agentId?, messageHistoryLength }` | Session start indicator |
| text | `{ text: string, agentId? }` | Streaming text display |
| tool_call | `{ toolCallId, toolName, input, agentId?, parentAgentId? }` | Tool call card |
| tool_result | `{ toolCallId, toolName, output, parentAgentId? }` | Tool result card |
| error | `{ message: string }` | Error banner/toast |
| finish | `{ agentId?, totalCost: number }` | Turn completion + cost |
| subagent_start | `{ agentId, agentType, displayName, onlyChild, parentAgentId? }` | Tree node creation |
| subagent_finish | `{ agentId, agentType, displayName, onlyChild, parentAgentId? }` | Tree node completion |
| reasoning_delta | `{ text, ancestorRunIds, runId, agentId }` | Reasoning panel (collapsible) |
| activity | `{ activity: AgentActivity, agentId?, parentAgentId? }` | Activity bar / status indicator |
| download | `{ version, status }` | Download progress |

#### Render-UI Widget Types (14 defined, 6 implemented)

Implemented: button, table, card, stepper, badge, perfection_loop
Missing: diff, chart, image, markdown, file-tree, alert, tabs, form, progress

#### Archived FID Lessons

1. **FID-015 (TUI Refactor):** Fix type errors FIRST. Theme-first approach works. 10 pre-existing errors fixed before visual work.
2. **FID-016 (Sidebar Visual):** 30-char sidebar hard constraint. Single-line TokenMeter. 20-char model truncation. Uniform section borders.
3. **FID-017 (Visual Enhancement):** 27 of 28 Savant-UI components were dead code. Don't build before wiring. Extended render_ui schema from 1 to 6 widget types.
4. **FID-009 (FSM Activity Indicator):** Two-signal design — FsmPhase (Perfection Loop state) ≠ AgentActivity (runtime activity). Must show both as separate rows.
5. **FID-011 (FSM Phase UI):** Data flow pattern: runtime `agentState.fsmPhase` → `onStateSnapshot` → Zustand store → sidebar component.
6. **FID-ui-redesign (Neon Slate):** Theme-first palette swap propagates to 280+ consumers. 30+ hex codes across 28+ files. Three-panel layout added. Near-black `#020617` caveat.
7. **FID-sidebar-data-wiring:** All data sources already existed — only needed wiring. Zustand store is the hub. Context bar: green 0-40%, yellow 40-70%, red 70-100%.

---

## Impact Assessment

### Affected Components

- `cli/src/types/theme-system.ts` — extend ChatTheme with missing tokens
- `cli/src/hooks/use-theme.tsx` — integrate resolveTheme, generateSystem
- `cli/src/utils/theme-system.ts` — new file (port from opencode-dev)
- `cli/src/components/savant-ui/theme.ts` — replace with token bridge
- `cli/src/components/savant-ui/echo/*` — upgrade 6 existing + add new ECHO components
- `cli/src/components/right-sidebar.tsx` — redesign with theme tokens
- `cli/src/components/status-bar.tsx` — add activity indicator
- `cli/src/components/tools/*.tsx` — upgrade 21 tool renderers
- `cli/src/components/chat-input-bar.tsx` — integrate command palette
- New: `cli/src/utils/glyphs.ts` — icon system
- New: `cli/src/components/command-palette.tsx` — overlay
- New: `cli/src/components/dialog.tsx` — modal system
- New: `cli/src/components/toast.tsx` — notification system
- New: `cli/src/components/tools/diff-viewer.tsx` — unified diff
- New: `cli/src/components/tools/reasoning-block.tsx` — thinking panel

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (view-only scope means logic is untouched; risk is visual regression)
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

5-phase incremental rebuild. Each phase is self-contained and verifiable. All phases are implemented together as a single FID deliverable. View layer only — zero changes to runtime logic.

### Phase 1: Theme System (port from opencode-dev)

Port opencode's theme system (MIT licensed, `resources/opencode-dev/packages/tui/src/theme/`):

1. **Copy 30+ JSON theme files** — pure data, no SolidJS dependency. Files: `resources/opencode-dev/packages/tui/src/theme/assets/*.json` → `cli/src/themes/assets/*.json`
2. **Port `resolveTheme()`** — takes base theme + reference resolution + terminal overrides + custom colors + plugins. Builds complete `ChatTheme` from JSON. Located at `resources/opencode-dev/packages/tui/src/theme/index.ts:resolveTheme()`.
3. **Port `generateSystem()`** — auto-detects terminal colors via OSC, IDE theme, platform dark mode. Already have `detectSystemTheme()` in `use-theme.tsx` — extend with opencode's richer detection.
4. **Port `generateSyntax()`** — generates ~50 tree-sitter syntax highlight rules. For TUI, map to `ChatTheme.markdown` overrides.
5. **Extend `ChatTheme`** — add missing tokens: `surfaceHover`, `aiLine`, `userLine`, `agentToggleHeaderBg`, `agentToggleExpandedBg`, `agentFocusedBg`, `agentContentBg`, `inputFg`, `inputFocusedFg`, mode toggle colors, image card, markdown overrides.
6. **Replace `theme.ts`** — the 41-line stub becomes a bridge that imports from the new theme system.

**Files touched:** `cli/src/types/theme-system.ts`, `cli/src/hooks/use-theme.tsx`, `cli/src/utils/theme-system.ts` (new), `cli/src/themes/` (new directory), `cli/src/components/savant-ui/theme.ts`

**Risk:** LOW — additive to existing theme, no logic changes.

### Phase 2: Glyph/Icon System

1. **Create `cli/src/utils/glyphs.ts`** — icon map with 30-40 Nerd Font icons for phases, tools, agents, status indicators.
2. **Detect Nerd Font availability** — character width probing (extend existing terminal dimension detection).
3. **Fallback chain** — Nerd Font → Unicode → ASCII. Graceful degradation.
4. **Box-drawing characters** — test across terminals (lessons from FID-016, FID-ui-redesign).

**Icons needed:**
- FSM phases: `○` idle, `●` active, `✓` complete, `✗` error
- Activity: `⚡` thinking, `⚙` tool, `◆` subagent, `◇` researching
- Tools: `📄` read, `✏️` write, `🔍` search, `🌐` web, `💻` terminal, `🧠` thinking
- Status: `●` active, `○` inactive, `◐` partial
- Navigation: `←` back, `→` forward, `↑` up, `↓` down

**Files touched:** `cli/src/utils/glyphs.ts` (new), update sidebar components

**Risk:** LOW — additive.

### Phase 3: Tool & Message Rendering

1. **ToolCard** — expandable card for each tool call. Shows tool name, input summary, result preview, timing. Collapsible by default. Uses theme tokens.
2. **Context-tool grouping** — group consecutive tool calls by context (e.g., read_files → grep → glob as "exploration cluster").
3. **Error-as-card** — FSM gating errors, permission errors, validation errors rendered as styled cards with suggested actions and phase indicator.
4. **Diff viewer** — unified diff rendering for write_file, str_replace, apply_patch, propose_write_file, propose_str_replace. Syntax-highlighted additions/deletions.
5. **Reasoning blocks** — collapsible panel for `reasoning_delta` events. Shows Thinking model's chain-of-thought. Expandable.
6. **render_ui widgets** — upgrade 6 existing widget renderers with new theme tokens. Add 8 new widget types: diff, chart, image, markdown, file-tree, alert, tabs, form.

**Files touched:** `cli/src/components/tools/*.tsx` (21 files), `cli/src/components/message-block.tsx`, new `cli/src/components/tools/diff-viewer.tsx`, new `cli/src/components/tools/reasoning-block.tsx`

**Risk:** MEDIUM — touches message rendering, but read-only display changes.

### Phase 4: Layout & Navigation

1. **Command palette** — `/` triggers a filterable overlay (replaces current inline slash menu). Keyboard-driven: arrow keys, Enter to select, Escape to dismiss.
2. **Dialog system** — reusable modal overlays for ask-user, feedback, publish confirmation, model picker, review screen. Replaces ad-hoc input mode switching.
3. **Toast notifications** — ephemeral notifications for clipboard copy, file changes, errors. Auto-dismiss after timeout.
4. **Status bar upgrade** — add activity indicator (from FID-009's two-signal design), queue status, connection status. Theme-aware.
5. **Right sidebar redesign** — keep 40-char width constraint (FID-016). Use theme tokens. Proper section borders. Dynamic content. Sections:
   - ECHO Protocol: FSM phase (FsmPhase) + runtime activity (AgentActivity) as two distinct rows
   - Session: tokens/cost/model/mode/agent
   - Tools: used (●) + available (○) with rolling window
   - Files Changed: modified/added/deleted
   - Agent Stack: nested tree with activity per agent
   - History: last 5 tool calls via Timeline

**Files touched:** `cli/src/components/right-sidebar.tsx`, `cli/src/components/status-bar.tsx`, `cli/src/components/chat-input-bar.tsx`, new `cli/src/components/command-palette.tsx`, new `cli/src/components/dialog.tsx`, new `cli/src/components/toast.tsx`

**Risk:** MEDIUM — layout changes, but additive (no removal of existing functionality).

### Phase 5: Polish

1. **Animations** — Typewriter (exists), Pulse (exists), new: phase transition animation, progress bar smooth update.
2. **Text effects** — shimmer text (exists), gradient text via ANSI sequences.
3. **Syntax highlighting** — tree-sitter based code highlighting in CodeBlock and diff viewer.
4. **Markdown upgrade** — enhanced markdown rendering with theme-aware code blocks, tables, blockquotes.

**Files touched:** `cli/src/components/savant-ui/animation/*`, `cli/src/components/savant-ui/data-display/code-block.tsx`, markdown renderer

**Risk:** LOW — cosmetic.

### Steps

1. Fix any pre-existing type errors (baseline from FID-015)
2. Phase 1: Port theme system from opencode-dev
3. Phase 2: Build glyph/icon system
4. Phase 3: Upgrade tool renderers + add missing widget types
5. Phase 4: Build command palette, dialogs, toasts, redesign sidebar
6. Phase 5: Polish animations, syntax highlighting, markdown
7. Verify: grep all new components to confirm wiring (no dead components)
8. Verify: zero hardcoded hex colors in components
9. Verify: typecheck passes

### Verification

After each phase:
1. `bun run typecheck` in cli/ — zero errors
2. Manual verification in terminal: all screens render correctly
3. `grep -rn <new-component> cli/src/` — confirmed wired to render pipeline (no dead components — lesson from FID-017)
4. Theme token usage: `grep -rn '#[0-9a-fA-F]\{6\}' cli/src/components/` should show zero hardcoded colors after Phase 1
5. For new functions/components: `grep -rn <symbol> cli/src/` — zero callers = not wired, reject completion

---

## Scope Constraints

| DO | DO NOT |
|---|---|
| Enhance `cli/src/` view layer only | Touch `packages/agent-runtime/` logic |
| Port theme system from opencode-dev (MIT) | Touch `sdk/src/impl/` |
| Add new components to `savant-ui/` | Touch `common/src/` types |
| Upgrade existing tool renderers | Touch `agents/` definitions |
| Redesign right sidebar | Modify ECHO.md or protocol rules |
| Add command palette, dialogs, toasts | Change tool execution logic |
| Wire existing data sources to new UI | Add new runtime events (unless rendering requires it) |

---

## Perfection Loop

### Loop 1

- **RED:** [Issues identified]
- **GREEN:** [Fixes applied]
- **AUDIT:** [Verification results]
- **CHANGE DELTA:** [Percentage of code changed]

### Loop 2 (if needed)

- **RED:** [Remaining issues]
- **GREEN:** [Additional fixes]
- **AUDIT:** [Verification results]
- **CHANGE DELTA:** [Percentage]

---

## Resolution

- **Fixed By:** [Pending — glm-5.2 agent]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** [Pending]
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending]

---

## Lessons Learned

### Folded from Archived FIDs

1. **Build + wire together** (FID-014 + sidebar-data-wiring): Don't create layout FIDs separate from data wiring FIDs. This FID includes both.
2. **Zero type errors baseline** (FID-015): Start from a clean typecheck. Fix pre-existing errors before visual work.
3. **Two signals, not one** (FID-009): FsmPhase (Perfection Loop state) ≠ AgentActivity (runtime activity). Sidebar must show both as separate rows.
4. **Theme-first is high-leverage** (FID-ui-redesign): Single palette swap propagates to 280+ consumers with zero logic changes.
5. **No dead components** (FID-017): Wire each component immediately. Don't build before wiring. 27 built-but-unused components proved this.
6. **Grep call-graph mandatory** (FID-ui-redesign): Every theme color, data source, event handler traced to consumers. Initial RED phase is never complete without comprehensive grep.
7. **Box-drawing needs testing** (FID-016, FID-ui-redesign): Some terminals render box-drawing chars with different widths.
8. **Near-black caveat** (FID-ui-redesign): `#020617` is almost indistinguishable from pure black on some monitors.
9. **Data sources already exist** (sidebar-data-wiring): This FID only connects them to the UI. No new APIs needed.
10. **Context bar color coding** (sidebar-data-wiring): Green 0-40%, yellow 40-70%, red 70-100%.

### From This FID

- [To be filled during implementation]
