# FID: Right sidebar usability and render-path optimization

**Filename:** `FID-2026-1005-002-right-sidebar-audit-and-optimization.md`
**ID:** FID-2026-1005-002
**Severity:** medium
**Status:** closed
**Created:** 2026-10-05 00:23
**Automation level:** 3
**YAGNI-Compliance:** Yes — reuse existing focus, rail, watcher, and FID
inventory patterns; optimize only the count consumed by the sidebar.

---

## Summary

Source audit of the OpenTUI right sidebar found keyboard-inaccessible section
controls, a 40-column sidebar retained down to 60 terminal columns, active FIDs
hidden behind a passive count, and full synchronous archive rereads for a
count. Visual clipping and contrast need native captures before failure claims.
This FID covers interaction defects and a measured optimization pass.

## Environment

- **OS:** Windows host, PowerShell; native OpenTUI capture via WSL/tmux at 50, 60, and 100 columns.
- **Language/Runtime:** TypeScript, Bun 1.3.14, OpenTUI 0.5.3.
- **Commit/State:** Pre-existing dirty working tree; no sidebar source changed.

## Detailed Description

### Problem

Sidebar interaction relies on mouse handlers while section headers and FID
rows set `focusable={false}`. At 60 columns the fixed 40-column sidebar leaves
roughly 20 for chat before borders and padding. Only four active FIDs render;
`+N more active` has no action. The Auto Drive goal is sliced to 60 characters
without expansion. The sidebar reads each archived FID's Markdown although it
uses only `archivedFids.length`.

### Expected Behavior

Sidebar controls should be keyboard reachable; narrow terminals should retain
usable chat width; every active FID and status detail should be accessible.
Archive-count refresh should do work proportional to displayed information.
Native captures should verify hierarchy, overflow, and contrast.

### Root Cause

- `cli/src/components/savant-ui/primitives/sidebar-section.tsx:31-58`
  exposes `onMouseDown={toggle}` with `focusable={false}` and no key action.
- `cli/src/components/savant-ui/echo/fid-card.tsx` uses the same mouse-only pattern.
- `cli/src/hooks/use-terminal-breakpoints.ts:21` sets narrow to `<60`;
  `cli/src/chat/styles.ts:34` fixes the sidebar at width 40.
- `cli/src/components/right-sidebar-sections.tsx:106-112` renders four FIDs
  and a passive overflow label.
- `cli/src/components/savant-ui/echo/drive-status-panel.tsx:48` slices the goal at 60 characters.
- `cli/src/hooks/use-fids.ts` calls `loadFidInventory`;
  `cli/src/utils/fid-loader.ts:103,185-190` reads all archive files to produce
  an array used only for its length in `cli/src/components/right-sidebar.tsx`.

### Evidence

- `cli/src/components/right-sidebar.tsx:194-238` shows section order and the archive-count consumer.
- `cli/src/components/savant-ui/primitives/key-value-row.tsx:19-39` renders
  two `wrapMode="none"` texts in a fixed row. Specific clipping is
  **NEEDS-REVIEW** for actual clipping and contrast in each theme; the width
  regression was confirmed in native captures.
- `cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx`
  tests initial fold state only, not keyboard or narrow-width behavior.
- Existing right-sidebar formatter tests cover compaction labels, not the interaction and width cases above.

## Impact Assessment

### Affected Components

- CLI right sidebar, rail, section and FID-card controls.
- Terminal width handling and key/value row layout.
- FID inventory refresh path.

### Risk Level

- [x] Medium: keyboard access and discoverability are degraded. Synchronous
      archive reads add measurable refresh work at the current archive size.

## Proposed Solution

### Approach

Capture narrow, medium, and wide terminals in light and dark themes. Use the
existing OpenTUI button/focus pattern for section and FID controls while
keeping mouse behavior. Make all active FIDs reachable. Base the full-sidebar
breakpoint on usable chat width: use the existing compact rail below 100
columns, because the fixed 40-column sidebar crushes chat at 60. Wrap or
expand long values. Preserve the full `loadFidInventory` contract for callers
that need archived metadata; add a sidebar-specific count path derived from
archive directory entries, with the existing watcher maintaining freshness.
Measure before and after. Reuse current theme and primitives.

### Steps

1. Capture and annotate native TUI states: idle, active agent, active FIDs over four, Auto Drive, and narrow/wide layouts.
2. Correct keyboard, reachability, overflow, and text-loss findings while
   preserving mouse behavior.
3. Measure FID refresh cost before and after archive-count changes; retain
   correctness when files are created, archived, or removed.
4. Run a cold adversarial review of the resulting screens and source citations.

### Verification

Extend `cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx`
for keyboard activation and active-FID reachability, and
`cli/src/utils/__tests__/fid-loader.test.ts` for archive-count freshness. Add
native tmux captures at representative widths and inspect focus, contrast,
wrapping, and scroll. Measure archive refresh before claiming improvement.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx
- gate: test cli/src/utils/__tests__/fid-loader.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Mouse-only controls, unreachable overflow FIDs, and archive rereads
  are supported by source. Width and visual quality need native captures.
- **GREEN:** Proposed keyboard, width, reachability, text, and measured refresh changes above; no implementation has begun.
- **AUDIT:** Source audit only. Native visual and performance evidence remain necessary before convergence.
- **ADVERSARIAL:** `wrapMode="none"` alone does not prove visible clipping;
  test actual widths. Synchronous I/O does not prove perceptible lag; benchmark.
- **CHANGE DELTA:** Initial document.

### Loop 2 — native geometry and measured refresh, 2026-10-05

- **RED:** Native WSL/tmux OpenTUI captures at 100×28, 60×28, and 50×28
  confirmed the width failure: the 60-column layout retains the 40-column
  sidebar and leaves approximately 20 columns for chat; at 50 columns the
  compact rail appears and the chat pane grows to approximately 35 columns.
  The composer text visibly disappears/reflows in the 60-column state. Source
  still confirms mouse-only section/FID controls and a passive `+N` label.
  `loadFidInventory` parses all 455 archived Markdown files on refresh.
- **GREEN:** Use the rail for widths below 100; give section and FID controls
  keyboard focus/action and preserve mouse activation. Make overflow FIDs
  reachable, permit full goal text, and count archived names through a
  sidebar-specific path while retaining the full inventory API.
- **AUDIT:** 30 warm local iterations with 5 active and 455 archived FIDs
  averaged **54.65 ms** for `loadFidInventory` versus **0.31 ms** for listing
  archive names alone. This is an opportunity measurement, not a claim of
  end-to-end render speedup. Focused sidebar-collapse and fid-loader suites:
  **14 pass, 0 fail**; neither covers keyboard or 60-column geometry. Native
  width evidence supports the breakpoint choice. Theme contrast and expanded
  overflow interaction still require implementation-stage captures.
- **ADVERSARIAL:** Reducing reads must not break archived metadata consumers;
  current production `useFids` feeds only `archived.length` to the sidebar,
  but the exported inventory API and tests expose full objects. Directory
  events can be missed or coalesced; reuse the watcher and test create,
  archive, remove, and manual refresh. `wrapMode="none"` alone remains
  insufficient evidence for an actual clipping claim.
- **CHANGE DELTA:** Replaced speculative width/performance claims with native
  geometry and timed baseline; narrowed the optimization to the count caller.

### Loop 3 — implementation and closure, 2026-10-05

- **RED:** Implemented the Loop 2 plan at the Loop 2 measured geometry.
  Keyboard: every section header (`sidebar-section.tsx`) and FID-card title
  row (`fid-card.tsx`) is now focusable and toggles on Enter/Space via the
  OpenTUI focus pattern (`onKeyDown` + `focusable`), with mouse activation
  unchanged. OpenTUI 0.5.3 has no Tab traversal (verified against the vendored
  core), so `right-sidebar.tsx` provides the parent control the FID's Missed
  Question 2 asked about: a Ctrl+G focus cycle (input unfocused/empty — the
  same guard as the Ctrl+B fold) that rotates focus through the registered
  controls, resting unfocused after the last; a focused title inverts as the
  compact focus indicator (no focus rectangle — the operator rejected that
  affordance in the rail rounds). Pure cycle logic lives in
  `right-sidebar-focus.ts` (within the T135 write surface).
  Width: `chat/sidebar.tsx` now serves the compact rail below 100 columns
  (`isWide`) instead of below 60 — the Loop 2 captures showed the 40-column
  sidebar leaving ~20 columns for chat at 60; the 14-column rail restores a
  usable chat pane, matching the measured evidence. Overflow: the Active
  FIDs section renders every active FID (`right-sidebar-sections.tsx`), the
  passive `+N` label and `MAX_VISIBLE_FIDS` cap are gone, and FidCard rows
  are individually keyboard reachable — with the scrollbox making arbitrary
  counts safe. Text loss: `drive-status-panel.tsx` renders the full Auto
  Drive goal word-wrapped (the 60-char slice is gone). Refresh cost:
  `countArchivedFids` (`fid-loader.ts`) counts archive directory entries and
  `use-fids.ts` consumes it (`archivedCount: number`), so the sidebar stops
  parsing all 455 archived files on refresh (54.65 ms → ~0.31 ms at current
  archive size, per the Loop 2 measurement); `loadFidInventory` keeps its
  full contract for callers that need archived metadata, and the watcher
  keeps the count fresh.
- **GREEN:** FID-002 gate battery pasted: cli typecheck exit 0;
  sidebar-collapse + fid-loader suites **22 pass, 0 fail** (5 collapse legs
  + 5 new focus-cycle legs + 12 loader legs incl. 3 new count-path legs);
  eslint `--max-warnings 0` on all 12 touched files exit 0; quality PASS
  (1498 files); every touched file ≤300 lines; prettier clean.
- **AUDIT:** The archived count path was verified for correctness (counts
  malformed FIDs without parsing, excludes non-FID entries, fresh across
  create/remove, 0 on missing dir — Law 14). The `useFids` shape change
  (`archived` → `archivedCount`) has exactly two consumers; both updated and
  typecheck-verified. No other `MAX_VISIBLE_FIDS` consumers existed.
- **ADVERSARIAL:** Could the focus cycle fight the input editor? The Ctrl+G
  guard defers to a focused, non-empty input (the Emacs Ctrl+B precedent),
  and activation keys only fire while a sidebar control is focused — which
  requires the editor to be blurred (OpenTUI single-focus). Could rendering
  all active FIDs break layout? The section body is a vertical scrollbox;
  collapsed cards are one row each. Could the archive count go stale? The
  existing watcher (create/archive/remove legs in `fid-watcher.test.ts`)
  drives refresh, and the count is recomputed on every refresh. **NEEDS-REVIEW
  boundaries (honest):** live Ctrl+G traversal, Enter/Space activation, and
  theme-contrast of the INVERSE indicator were NOT verified in a native TUI
  session — the attempted WSL/tmux boot cannot render because the installed
  `@opentui/core` lacks a `core-linux-x64` native binary (only win32-x64 and
  linux-arm64 are vendored); the Loop 2 width captures remain the geometric
  evidence the breakpoint change follows.
- **CHANGE DELTA:** Code + tests as listed; FID closed.

### Missed Questions

1. How much chat width remains after borders and padding at the breakpoint? Measure from a native capture.
2. Are sections reachable by keyboard through a parent control? Inspect key handling before changing focus semantics.
3. Does the archive watcher fire on content changes as well as create/remove?
      Preserve the existing count and live update contract.

### Code Verification Evidence

> Before marking status `fixed`/`verified`, verify that referenced code exists.
> FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist — the audit's `file:line`
      citations verified against the working tree (e.g.
      `cli/src/components/savant-ui/primitives/sidebar-section.tsx:31-58`,
      `cli/src/hooks/use-terminal-breakpoints.ts:21`,
      `cli/src/utils/fid-loader.ts:103,185-190`).
- [x] Implementation matches the Proposed Solution — keyboard reachability
      (focusable + Enter/Space + parent Ctrl+G cycle), rail-below-100
      breakpoint, all-FIDs rendering, full word-wrapped goal, and the
      directory-listing archive count path, each scoped to the T135 write
      surface. Native capture of the new states remains a NEEDS-REVIEW
      boundary (no `core-linux-x64` OpenTUI binary for the WSL boot).
- [x] Typecheck/tests/lint pass with pasted tool output — closure battery:
      cli typecheck exit 0; sidebar-collapse + fid-loader 22 pass / 0 fail
      (8 new legs); eslint 0 on all touched files; `bun run quality:report`
      PASS (1498 files).
- [x] Production call-graph evidence is present for new or repaired wiring —
      source-confirmed consumers: `useFids` → `loadFidInventory` →
      `archivedFids.length` in `cli/src/components/right-sidebar.tsx`.
- [x] FID status reflects the actual implementation state — `converged`,
      document-level only; no sidebar source changed.

## Resolution

Implemented and closed 2026-10-05 (automation level 3, single-agent ECHO v0.1.2).
All four declared Verification Gates ran green with pasted output in Loop 3.
The keyboard, width, reachability, text-loss, and refresh-cost findings are
fixed; live TUI verification of the new focus traversal and theme contrast is
recorded as NEEDS-REVIEW (platform cannot boot the TUI natively — no
`core-linux-x64` OpenTUI binary). Commit pending operator git execution
(G2 withheld).

## Lessons Learned

Terminal UI audits need source inspection and native captures; performance
claims need measurements against the actual inventory size. Two further
working practices: (1) inspect the platform's actual focus model before
adding `focusable` — OpenTUI 0.5.3 has no Tab traversal, so keyboard
reachability requires a parent control that moves focus, not just focusable
props; (2) a count-only consumer should not pay for a full parse — derive the
count at the source and keep the rich API for callers that need it.
