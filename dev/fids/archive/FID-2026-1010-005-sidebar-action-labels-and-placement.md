# FID: Sidebar action naming matrix and persistent placement for tool actions

**Filename:** `FID-2026-1010-005-sidebar-action-labels-and-placement.md`
**ID:** FID-2026-1010-005
**Severity:** medium
**Status:** created
**Created:** 2026-10-10 22:30
**Automation level:** 2
**YAGNI-Compliance:** Pending

---

## Summary

The sidebar surfaces agent tool actions (for example `suggest_followups`) as raw
snake_case identifiers, and the row for an action appears and then disappears as
the activity changes instead of holding a fixed place. The operator asked for a
naming matrix so every tool has one canonical display name (`Suggest followup`
rather than `suggest_followups`), and for actions to occupy a persistent,
non-transient location on the sidebar.

## Environment

- **OS:** Windows 10/11, Git Bash shell
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** OpenTUI (`@opentui/core`, `@opentui/react`)
- **Commit/State:** working tree on `main`, uncommitted sidebar changes from
  FID-2026-1010-003 and this session

## Detailed Description

### Problem

Two defects, both observed live by the operator:

1. Tool identifiers are shown verbatim. `suggest_followups` appears in the
   sidebar instead of a human label.
2. The row for a tool action appears and disappears with the activity state
   rather than holding a stable position.

### Expected Behavior

- Every tool has one entry in a single naming matrix that maps its identifier to
  a sentence-case display name (`suggest_followups` -> `Suggest followup`).
- A tool action occupies a fixed, persistent location in the sidebar for the
  duration it is relevant, and does not flicker out.

### Root Cause

Traced 2026-10-10. The `suggest_followups` tool renders in the **chat transcript**,
not the sidebar:

- `cli/src/components/tools/suggest-followups.tsx` defines `SuggestFollowupsComponent`
  (`toolName: 'suggest_followups'`), which returns the followup cards as chat content.
- `cli/src/state/chat-store/find-followup.ts` (`getLatestFollowupToolCallId`) finds the
  newest `suggest_followups` block. Only that block is active; every older block
  renders as `PastFollowupsToggle`.

The appear-then-hide behavior is therefore the chat transcript collapsing an older
followup block into a toggle each time a new turn produces one. The sidebar grep
(`grep -rn suggest_followups cli/src`) returns no sidebar reference, so the sidebar
is not the surface that shows the raw identifier.

Open question for the operator: confirm whether the raw `suggest_followups` text is
seen in the chat transcript or the sidebar. The chat-block path is the one with code
evidence; the sidebar path has none.

The agent prompt that drives this tool also names it directly
(`cli/src/agents/bundled-agents.generated-data/32-savant.ts`), so the raw identifier
may come from model output text rather than from a renderer.

### Evidence

Operator report, this session: "there is still an item that keeps popping up and
then hiding, I seen `suggest_followups`... needs a naming matrix ... persistent
... it should not be hidden."

```text
Observed: sidebar shows "suggest_followups"; row appears and disappears.
Requested: "Suggest followup", persistent placement.
```

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/echo/agent-status.tsx` (activity row rendering)
- `cli/src/components/tools/registry.ts` (tool registry; candidate home for the
  naming matrix)
- `cli/src/components/tools/suggest-followups.tsx` (the tool's own render)
- `cli/src/components/right-sidebar-sections.tsx` (section placement)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: cosmetic and placement defect; the underlying data is correct
- [ ] Low

## Proposed Solution

### Approach

1. Add one naming matrix (identifier -> display name) as the single source of
   truth. Utility-first per Law 13: one map, consumed everywhere a tool name is
   shown.
2. Route every sidebar tool label through the matrix. Unknown identifiers fall
   back to a deterministic sentence-case transform (Law 14).
3. Give tool actions a persistent sidebar location that does not tie visibility
   to the transient activity state.

### Steps

1. Trace the display path for a tool action and record the root cause of the
   disappearing row, with evidence.
2. Author the naming matrix in one module and pin it with a unit test.
3. Replace raw identifier rendering in the sidebar with the matrix lookup.
4. Move the tool-action row to a persistent location and pin it with a render
   test.
5. Verify with typecheck, lint, and the sidebar suites.

### Verification

Typecheck, eslint with `--max-warnings 0`, and the sidebar test suites, plus a
render test that asserts `Suggest followup` appears and `suggest_followups` does
not.

## Verification Gates

> Declared once the work is implemented. Not stamped yet.

## Perfection Loop

### Loop 1 — RED

- **RED (sidebar root cause, traced by source):** the sidebar displays the raw tool name
  through two paths, both confirmed in code.
  1. Tool-call recording: `onToolCall(toolName)` in `cli/src/utils/sdk-event-handlers/subagents.ts:206-207`
     forwards `event.toolName` unchanged. `cli/src/hooks/helpers/send-message-sidebar.ts:23-26` calls
     `addToolUsed(toolName)` and `addToolHistory(toolName)` with that raw identifier.
  2. Rendering: `cli/src/components/right-sidebar-sections.tsx:62` renders `toolsUsed` as
     `${glyph('statusActive')} ${tool}` with no label mapping, and `:141-144` renders
     `toolHistory` through `formatToolHistoryEvent` (`label: call.name`). Both carry
     `suggest_followups` verbatim into the sidebar.
  The chat-transcript finding from the earlier trace (`find-followup.ts`) is a separate
  surface and is not the sidebar defect.
- **RED (persistence, UNVERIFIED HYPOTHESIS):** the sidebar Tools section lists `toolsUsed`
  (a set that only grows), and History shows `toolHistory.slice(-5)` (a rolling window).
  Neither is tied to the transient activity state, per source. Whether the History window
  causes the operator's pop-in/hide is an inference from the slice, not a verified cause:
  no live render, probe, or log has reproduced it. Treat as unverified until a render shows it.
- **RED (Verifier audit, 2026-10-10):** 5 PASS, 0 FAIL, 2 NEEDS-REVIEW at first pass.
  Both open items are now resolved from source:
  - `formatToolHistoryEvent` (`cli/src/components/right-sidebar-format.ts:176-184`) returns
    `{ time: \`${hours}:${minutes}\`, label: call.name }`. The label is the raw `call.name`
    with no mapping, which confirms the History claim.
  - `cli/src/components/right-sidebar-sections.tsx:62` is
    `const used = [...new Set(toolsUsed)].sort((a, b) => a.localeCompare(b))`. It dedupes and
    sorts with no label mapping; the raw name renders at line 75. This confirms the Tools claim.
  The History-window pop-in cause remains an UNVERIFIED HYPOTHESIS, as the Verifier agreed.
- **RED (suggest_followups reaches the sidebar, VERIFIED):** `isHiddenToolName` (`cli/src/utils/
  sdk-event-handlers/guards.ts`, `hiddenToolNames`) lists only `spawn_agent_inline`, `end_turn`,
  `spawn_agents`, `render_ui`. `suggest_followups` is not hidden, so it reaches `onToolCall`
  and the sidebar Tools and History lists.
- **GREEN:** not started.
- **AUDIT:** not started.
- **ADVERSARIAL:** not started.
- **CHANGE DELTA:** RED evidence recorded (new FID; no prior loop).

### Missed Questions

1. Should the matrix cover every registered tool or only sidebar-visible ones?
   Default: every registered tool, so no identifier leaks.
2. Where does persistence live: sidebar state or derived from the tool history?
   Default: derived from history with a fixed slot, so it survives activity
   changes.

### Code Verification Evidence

Added by FID-2026-1010-004 (release-readiness repair) to satisfy the
repository's FID structural contract. This record is still `created`, so nothing
below is verified and no box is checked.

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state

## Resolution

- **Archived-Declined:** operator-approved 2026-10-11 — "alright so im not
  doing the deck, the sidebar was canclled as well because we could not
  complete it. I tried it earlier today and it failed."
- **Disposition:** Operator cancelled the remaining sidebar-action work after
  reporting that the sidebar attempt failed. The naming/placement code and
  tests present in the working tree are not claimed as successfully accepted;
  this FID is archived as declined, not completed.

- **Closed Date:** not closed (operator-declined 2026-10-11)
- **Unaccepted working-tree implementation (not completion evidence):** Naming matrix implemented. `TOOL_DISPLAY_NAMES` and
  `toolDisplayName()` in `cli/src/components/right-sidebar-format.ts` map
  `suggest_followups` to `Suggest followup` and sentence-case any other identifier.
  `formatToolHistoryEvent` and the Tools list in
  `cli/src/components/right-sidebar-sections.tsx` both route through `toolDisplayName`.
Placement (operator choice: "Keep in History, no window"): `SidebarHistoryTimeline` in
  `right-sidebar-sections.tsx` now renders the full `toolHistory` with no `slice(-5)` window
  and no `maxItems` cap, so no tool action drops off the sidebar. This removes the
  History-window cause as a source of disappearing rows. The pop-in cause is NOT reproduced
  by a live render, so the root cause remains an unverified hypothesis.
- **Tests Added:** `toolDisplayName` pin block in
  `cli/src/components/__tests__/right-sidebar-format.test.ts` (mapped, fallback, empty,
  separator-only, punctuation-only). `cli/src/components/__tests__/sidebar-rail-navigation.test.tsx`
  assertion updated from raw `read_files` to display name `Read files`, since the naming
  matrix changed the rendered label.
- **Verification Evidence:** typecheck `cli` exit 0; eslint `--max-warnings 0` clean on the
  changed sidebar files and test files; sidebar suites (single-home, phase-color, responsive,
  rail-navigation, format) 25/25 pass, 0 fail.
- **Archived:** 2026-10-11 as operator-declined; no completion claim

## Lessons Learned

Pending closure.
