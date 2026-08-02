# FID-2026-0723-063 — Right Sidebar TUI Polish

**Filename:** `FID-2026-0723-063-sidebar-tui-polish.md`
**ID:** FID-2026-0723-063
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23
**Author:** Savant Orchestrator

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0723-063`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

**Filename:** `FID-2026-0723-063-sidebar-tui-polish.md`  
**ID:** FID-2026-0723-063  
**Severity:** medium  
**Status:** closed / archived  
**Created:** 2026-07-23  
**Author:** Savant Orchestrator  
**Closed:** 2026-07-23  

## Summary

During the latest comprehensive A-Z test run several right-sidebar/TUI polish issues were observed in the CLI. This FID tracks them as a single coherent polish pass so they can be fixed, verified, and released together.

## Issues Observed

### 1. Context window still shows 200k
- **Location:** `cli/src/components/right-sidebar.tsx` (Tokens row), `cli/src/chat.tsx` (`resolveContextWindowForModel`), model context pipeline.
- **Description:** The sidebar reports a hardcoded-looking 200k context window even though the model metadata should be pulled from the OpenRouter gateway catalog.
- **Expected:** The context-window value is derived from the live gateway catalog for the currently selected model.
- **Related work:** FID-062 already addressed the reactive catalog wiring; this issue indicates the display value is still stale or a fallback is being used.

### 2. Agent Status shows two entries (IDLE + active activity)
- **Location:** `cli/src/components/savant-ui/echo/agent-status.tsx`
- **Description:** The section renders a static `IDLE` phase line while also rendering the active activity/tool line. This is confusing because the agent is clearly doing work.
- **Expected:** When the runtime activity is non-idle, suppress the `IDLE` phase row or merge the two rows into a single, clear status. Document the design intent if the current behavior is deliberate.

### 3. Directory/filepath above the input box should move to the right sidebar
- **Location:** `cli/src/components/chat-input-bar.tsx`, `cli/src/components/status-bar.tsx`, `cli/src/chat.tsx`
- **Description:** The current directory/filepath indicator is rendered above the chat input box. User feedback requests it be relocated under the Session section in the right sidebar (near session timer / `[esc]` hints).
- **Expected:** Remove the input-area directory indicator and add a compact project-path row inside the right sidebar.

### 4. Token value hardcoded to 200k
- **Location:** Same as #1.
- **Description:** `Tokens` row shows `.../200k` regardless of the actual model.
- **Expected:** Use the reactive gateway catalog to display the real context-window limit.

### 5. Agent Status and Perfection Loop sections are not collapsible
- **Location:** `cli/src/components/savant-ui/echo/agent-status.tsx`, `cli/src/components/savant-ui/echo/perfection-loop.tsx`
- **Description:** Both sections render their own bordered box and are not using `SidebarSection`, unlike `Session`, `Tools`, `Files Changed`, etc.
- **Expected:** Refactor both components to use the shared `SidebarSection` primitive so they are collapsible and visually consistent with the other sidebar sections.

### 6. Entire list should be in alphabetical order
- **Location:** `cli/src/components/right-sidebar.tsx` section ordering, possibly `Tools` list and other enumerated UI rows.
- **Description:** The user requests the sidebar list(s) be alphabetically ordered.
- **Expected:** Decide the ordering rule (sections, tool names, file-change labels, etc.) and apply it consistently. Clarify which list is in scope during RED if ambiguous.

### 7. Double spaces / empty space between values
- **Location:** `cli/src/components/savant-ui/primitives/sidebar-section.tsx` and related sidebar primitives.
- **Description:** There is excessive vertical whitespace causing a sparse layout, particularly an empty line after every collapsible section header (e.g., "▼ Agent Status"). A prior attempt to fix this accidentally removed `alignSelf="flex-start"`, which made the entire row clickable and caused the whole header to highlight.
- **Expected:** Audit all sidebar primitives (`KeyValueRow`, `SidebarSection`, `AgentStatus`, `PerfectionLoop`, etc.) and remove extra `gap`, `padding`, and margin that produce the double-space effect, while preserving `alignSelf="flex-start"` on the header so the click/highlight area stays limited to the header text.

### 8. Tools history should limit to 5 entries as a sliding window
- **Location:** `cli/src/components/right-sidebar.tsx` (`toolHistory.slice(-5)`), `cli/src/state/chat-store.ts` (or wherever `toolHistory` is appended).
- **Description:** The display currently slices to 5, but the underlying history may grow unbounded. Over a long session this is a memory/perf concern.
- **Expected:** Enforce a sliding window of 5 at the source (store) so the history never exceeds the visible limit.

### 9. Version still shows 0.0.4
- **Location:** `VERSION` file vs `cli/package.json`.
- **Description:** `VERSION` contains `0.0.4` while `cli/package.json` already shows `0.0.5`. The CLI reads the version from `VERSION` via `cli/src/utils/version.ts`.
- **Expected:** Update `VERSION` to `0.0.5` so the sidebar and `--version` flag are consistent.

## Acceptance Criteria

- [x] Context window is no longer hardcoded to 200k; it reflects the selected model's actual context length from the gateway catalog.
- [x] Agent Status section uses `SidebarSection` and collapses consistently with other sections.
- [x] Perfection Loop section uses `SidebarSection` and collapses consistently with other sections.
- [x] `IDLE` phase text is not duplicated/confusing when an active tool/subagent is running.
- [x] Directory/filepath indicator moved from above the input to the right sidebar Session area.
- [x] Tools list is alphabetically sorted and capped to 5 visible entries.
- [x] Excess whitespace/double spaces removed; layout is compact and aligned.
- [x] Tool history is capped to 5 entries at the store level.
- [x] Active FIDs section is compact, shows only the FID name, and displays the full summary.
- [x] `VERSION` file reads `0.0.5`.
- [x] All affected files pass `cd cli && bun run typecheck` and targeted tests.

## Affected Files (preliminary)

- `cli/src/components/right-sidebar.tsx`
- `cli/src/components/savant-ui/echo/agent-status.tsx`
- `cli/src/components/savant-ui/echo/perfection-loop.tsx`
- `cli/src/components/savant-ui/primitives/sidebar-section.tsx`
- `cli/src/components/savant-ui/primitives/key-value-row.tsx`
- `cli/src/components/chat-input-bar.tsx`
- `cli/src/components/status-bar.tsx`
- `cli/src/chat.tsx`
- `cli/src/state/chat-store.ts`
- `cli/src/utils/version.ts`
- `VERSION`

## Perfection Loop

### RED — Issue Analysis & Root Causes

1. **Context window still shows 200k**
   - `cli/src/state/chat-store.ts` line 281 initializes `contextTokensMax: 200_000` as a fallback.
   - `cli/src/chat.tsx` lines 267-272 derive `maxTokens` via `resolveContextWindowForModel(sidebarModel)` whenever the model or gateway catalog changes.
   - `cli/src/utils/openrouter-models.ts` `resolveContextWindowForModel` (line 328) prefers the cached gateway catalog, but the TokenRouter and OpenCode Go hardcoded catalogs (lines 419-497) do **not** set `contextLength`. For those models it falls back to `getContextWindowForModel`, which returns `200_000` as the default.
   - Root cause: fallback heuristic defaults to 200k for models whose catalog entry lacks `contextLength`.

2. **Agent Status shows two entries (IDLE + active activity)**
   - `cli/src/components/savant-ui/echo/agent-status.tsx` always renders the phase row and only hides the activity row when **both** phase and activity are idle.
   - When `fsmPhase === 'idle'` but a tool/subagent is active, the user sees `IDLE` plus the activity line.
   - Root cause: the component never suppresses the idle phase row when real activity is happening.

3. **Directory/filepath above the input box should move to the right sidebar**
   - `cli/src/chat.tsx` lines 1774-1782 render `Directory <path>` directly above the chat input.
   - The right sidebar `Session` section already contains `Agent`, `Cost`, `Mode`, `Model`, and `Tokens` rows.
   - Root cause: the directory indicator was placed in the chat column instead of the session metadata surface.

4. **Token value hardcoded to 200k**
   - Same root cause as #1: the fallback value and hardcoded gateway models without `contextLength`.

5. **Agent Status and Perfection Loop sections are not collapsible**
   - `cli/src/components/savant-ui/echo/agent-status.tsx` and `cli/src/components/savant-ui/echo/perfection-loop.tsx` each render their own `borderStyle="single"` box.
   - Other sidebar sections use `cli/src/components/savant-ui/primitives/sidebar-section.tsx`, which provides a collapsible header.
   - Root cause: these two sections were built before `SidebarSection` existed and were never migrated.

6. **Entire list should be in alphabetical order**
   - The `Tools` section in `cli/src/components/right-sidebar.tsx` renders `toolsUsed` in insertion order and then appends available tools.
   - The user also reported the list "expanding unbounded".
   - Interpretation: the **Tools** list should be alphabetically sorted and limited to a sliding window of 5 visible entries.

7. **Double spaces / empty space between values**
   - `right-sidebar.tsx` uses `gap={1}` on the root box and many nested boxes.
   - `agent-status.tsx` and `perfection-loop.tsx` add their own `padding`/`gap` inside their bordered boxes.
   - `KeyValueRow` already uses `justifyContent="space-between"` but adds a `gap={1}`.
   - Root cause: cumulative gaps/padding from multiple layers plus the non-unified section wrappers.

8. **Tools history should limit to 5 entries as a sliding window**
   - `cli/src/state/chat-store.ts` lines 601-608 already cap `toolHistory` to 5 in `addToolHistory`.
   - `right-sidebar.tsx` also slices `toolHistory.slice(-5)` and passes `maxItems={5}` to `Timeline`.
   - The visible `Tools` section, however, renders every tool in `toolsUsed` with no limit.
   - Root cause: the displayed **Tools** list is unbounded, while the `toolHistory` array is already capped.

9. **Version still shows 0.0.4**
   - `VERSION` file contains `0.0.4`; `cli/package.json` already has `0.0.5`.
   - `cli/src/utils/version.ts` reads from `VERSION`.
   - Root cause: the root `VERSION` file was not bumped.

### GREEN — Proposed Fixes

1. **Dynamic context window / no hardcoded 200k**
   - Add `contextLength` to every model in `TOKENROUTER_CATALOG` and `OPENCODE_GO_CATALOG` in `cli/src/utils/openrouter-models.ts`.
   - Update `resolveContextWindowForModel` to prefer `topProvider.contextLength` when the main `contextLength` is missing.
   - Keep the `200_000` chat-store fallback as a safe default, but document it as a fallback only.

2. **Agent Status single-row status**
   - In `agent-status.tsx`, suppress the phase row when `activity.kind !== 'idle'` and the phase is `idle`; render only the activity row.
   - When both are idle, render a single `IDLE` line.

3. **Move directory indicator**
   - Remove the `Directory <path>` text from `chat.tsx` (lines 1774-1782).
   - Pass `projectRoot` to `RightSidebar` and add `<KeyValueRow label="Directory" value={formatCwd(projectRoot)} />` inside the `Session` section.

4. **Collapsible Agent Status & Perfection Loop**
   - Refactor `agent-status.tsx` and `perfection-loop.tsx` to accept `children` or be rendered inside `SidebarSection`.
   - Remove `borderStyle`, `borderColor`, and outer padding from both components; let `SidebarSection` own the collapsible wrapper.

5. **Alphabetical + bounded Tools list**
   - Sort `toolsUsed` alphabetically before rendering.
   - Combine available tools (excluding already-used) and sort them alphabetically.
   - Limit the rendered list to 5 total entries (sorted window), mirroring the tool-history cap.

6. **Whitespace cleanup**
   - Audit and reduce gaps in `right-sidebar.tsx`, `agent-status.tsx`, and `perfection-loop.tsx`.
   - Keep `gap={1}` at the section-body level but remove duplicate padding from the now-unified section wrappers.
   - Ensure no extra blank lines are rendered between rows.

7. **Version bump**
   - Update `VERSION` to `0.0.5`.

### AUDIT — Evidence from RED

| Check | Command / Source | Result |
|-------|------------------|--------|
| Context fallback default | `grep -n 'contextTokensMax: 200_000' cli/src/state/chat-store.ts` | `Line 281:   contextTokensMax: 200_000,` — fallback is 200k. |
| Directory above input | `grep -n 'Directory' cli/src/chat.tsx` | `Line 1775: Directory{' '}` rendered above input box. |
| Agent Status / Perfection Loop borders | `grep -n 'borderStyle="single"' ...` | Both `agent-status.tsx` and `perfection-loop.tsx` contain `borderStyle="single"`. |
| Tool history already capped | `grep -n 'toolHistory.length > 5' cli/src/state/chat-store.ts` | `Line 605: if (state.toolHistory.length > 5)` — store already enforces sliding window. |
| VERSION stale | `cat VERSION` | `0.0.4` |
| Context length field exists | `grep -n 'contextLength' cli/src/utils/openrouter-models.ts` | Present in `OpenRouterModel` type and `formatModelInfo`, but missing from hardcoded TokenRouter/OpenCode Go catalog entries. |

### AUDIT — Verification Results

- [x] `cd cli && bun run typecheck` passes with zero errors.
- [x] `cd cli && bun test src/utils/__tests__/openrouter-models.test.ts` passes (14/14).
- [x] `grep -n 'borderStyle="single"' cli/src/components/savant-ui/echo/agent-status.tsx cli/src/components/savant-ui/echo/perfection-loop.tsx` returns no matches.
- [x] `grep -n 'Directory' cli/src/chat.tsx | grep -v 'import\|comment'` no longer shows the input-area directory line.
- [x] `cat VERSION` outputs `0.0.5`.
- [x] Hardcoded TokenRouter / OpenCode Go catalogs now carry inferred `contextLength` via `inferContextLength()` in `cli/src/utils/openrouter-models.ts`.

## Notes

- This FID bundles UI polish only; no behavior changes to the agent runtime, ECHO FSM, or provider routing.
- The alphabetical-order requirement is interpreted as applying to the **Tools** list. If the user intended section ordering, it can be revisited during GREEN.
