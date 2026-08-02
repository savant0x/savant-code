# FID: Fold Sidebar Options on Startup

**Filename:** `FID-2026-0801-001-sidebar-folded-on-startup.md`
**ID:** FID-2026-0801-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-01 10:24
**Author:** Buffy

---

## Summary

When the CLI agent loads, right-sidebar options could render expanded on the
first paint. The expanded session, status, loop, tools, files, history, and
active-FID content consumed sidebar height and made the visual layout noisy.
The active-FID cards had the same first-render problem because both the section
and card components defaulted to expanded. The fix changes both existing UI
primitive defaults to folded while preserving explicit expansion and existing
user toggles.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript, React, OpenTUI, Bun
- **Tool Versions:** Bun 1.3.14; FreeBuff ECHO Protocol v0.1.2; Savant harness ECHO v0.2.0
- **Commit/State:** Existing working-tree modifications preserved; no pre-existing changes were overwritten

## Detailed Description

### Problem

The right sidebar is composed from collapsible `SidebarSection` instances. The
primitive initialized its local state from `defaultExpanded`, whose default was
`true`. Production callers omitted the prop, so every rendered section started
open. The active FID list rendered `FidCard` instances without an `expanded`
prop, and `FidCard` likewise defaulted its initial state to `true`.

### Expected Behavior

On each fresh agent/sidebar mount:

1. Every right-sidebar section renders folded with a closed chevron and without
   its body occupying layout space.
2. Every active-FID card renders folded with a closed chevron and without its
   full summary occupying layout space.
3. A user can still expand and collapse a section or FID card through its
   existing mouse interaction.
4. Explicit `defaultExpanded={true}` and `expanded={true}` props continue to
   opt a component into an initially expanded state.
5. Transcript message collapse state, model-picker state, ask-user accordions,
   tree-view defaults, persisted chat data, and runtime agent behavior remain
   unchanged.

### Root Cause

Two independent UI primitives used expanded-by-default initialization:

- `cli/src/components/savant-ui/primitives/sidebar-section.tsx` set
  `defaultExpanded = true` and initialized `useState(defaultExpanded)`.
- `cli/src/components/savant-ui/echo/fid-card.tsx` set
  `expanded: initialExpanded = true` and initialized `useState(initialExpanded)`.

The production path is:

```text
cli/src/chat.tsx
  -> <RightSidebar />
  -> <AgentStatus /> / <LoopStatusPanel /> / <PerfectionLoop />
  -> <SidebarSection />
  -> <FidList />
  -> <FidCard />
```

### Evidence

```text
Production callers of SidebarSection:
- cli/src/components/right-sidebar.tsx: Active Agents, Session, Tools,
  Files Changed, Active FIDs, History
- cli/src/components/savant-ui/echo/agent-status.tsx: Agent Status
- cli/src/components/savant-ui/echo/loop-status-panel.tsx: Loop
- cli/src/components/savant-ui/echo/perfection-loop.tsx: Perfection Loop

Production caller of FidCard:
- cli/src/components/savant-ui/echo/fid-list.tsx: sorted.map(... <FidCard />)

RightSidebar production mount:
- cli/src/chat.tsx: <RightSidebar ... />

Implemented defaults:
- sidebar-section.tsx: defaultExpanded = false; useState(defaultExpanded)
- fid-card.tsx: expanded: initialExpanded = false; useState(initialExpanded)
```

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/primitives/sidebar-section.tsx`
- `cli/src/components/savant-ui/echo/fid-card.tsx`
- `cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx`

### Not Affected

- `cli/src/components/right-sidebar.tsx` layout structure and data flow
- `cli/src/chat.tsx` startup wiring
- `cli/src/utils/collapse-helpers.ts` and transcript message state
- `cli/src/utils/message-block-helpers.ts` and agent/tool auto-collapse
- Model selector, ask-user accordion, tree view, terminal command display, and persisted settings
- Agent execution, FID loading, FID parsing, and user data

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The change is UI-local, reversible, and does not change data or execution state.

## Proposed Solution

### Approach

Change the default initial state of the two existing collapsible UI primitives to
folded, preserving their existing props and toggle handlers. This establishes
the invariant at the reusable primitive boundary, covers nested sidebar callers,
and avoids a sidebar-specific reset store, mount effect, persistence field, or
duplicate collapse utility. Explicit expansion remains available for intentional
exceptions.

### Implemented Steps

1. Changed `SidebarSection`'s implicit `defaultExpanded` fallback from `true` to
   `false`.
2. Changed `FidCard`'s implicit `expanded` fallback from `true` to `false`.
3. Added server-render regression tests for folded defaults and explicit expanded
   opt-in for both primitives.
4. Added a `FidList` regression test confirming every card is folded on initial
   render.
5. Re-read all changed source and test files after formatting.
6. Verified production call-graph reachability from `Chat` through `RightSidebar`
   and nested sidebar/FID components.

### Verification

- Focused test command:
  `bun test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx`
  → **5 passed / 0 failed**, exit code 0.
- CLI typecheck:
  `bun run --cwd=cli typecheck` → **passed**, exit code 0.
- Focused Prettier check → **passed**, all changed files formatted.
- Focused ESLint with `--max-warnings 0` → **passed**, zero warnings/errors.
- `git diff --check` on changed implementation/test files → **passed**.
- Production call-graph grep confirmed `Chat → RightSidebar`, all sidebar
  `SidebarSection` callers, `FidList`, and `FidCard`.
- Independent code review → **approved** after correcting one import-order warning
  in the new test.
- Independent design audit → **approved**; all sidebar sections fold by default,
  matching the explicit request that all options be folded.
- Interactive CLI visual smoke test → **deferred**; no interactive result is
  claimed as passing.

## Perfection Loop

### Loop 1 — RED

- Identified the expanded-on-startup sidebar defect.
- Traced all production callers and found the two independent default-expansion
  boundaries.
- Confirmed transcript collapse utilities were outside this sidebar scope.
- Confirmed no `2026-0801` FID collision before assigning this ID.
- Cataloged the missing focused startup-render tests.

### Loop 1 — GREEN

- Reused the existing primitive props and state initialization.
- Changed only the two implicit defaults and added focused regression coverage.
- Preserved explicit expanded opt-in and existing mouse toggles.
- Added no persistence, global reset state, new API, external service, or utility.
- Kept transcript, model-picker, ask-user, tree-view, and persisted state out of scope.

### Loop 1 — AUDIT

**Design and implementation audit result: PASS.**

- Scope is limited to the actual startup expansion boundaries.
- The implementation matches the converged FID plan.
- Explicit expansion remains backward-compatible.
- Focused tests, typecheck, formatting, lint, whitespace, and call-graph checks
  all passed with tool output evidence.
- The initial reviewer warning about test import order was corrected; the final
  ESLint run passed with zero warnings.
- Interactive smoke remains deferred and is not used to certify completion.

### CHANGE DELTA

- Runtime source: 2 existing default values changed.
- Tests: 1 new focused regression file with 5 tests.
- Documentation: FID and changelog closeout records updated.

### Missed Questions

1. **Does “all options” mean the transcript too?** → No. The requested visual
   defect is the right sidebar's section and nested FID-card state; transcript
   blocks have separate collapse semantics.
2. **Should every caller receive an explicit `false` prop?** → No. The reusable
   primitive defaults establish the invariant for current and future callers;
   explicit `true` remains available for intentional exceptions.
3. **Should collapsed state be persisted?** → No. The request was a startup visual
   default, and storage would create an unnecessary new state contract.
4. **Should a startup effect forcibly collapse mounted components?** → No. Initial
   state is the defect boundary; a reset effect could overwrite user expansion
   after remounts.
5. **Should both the Active FIDs section and each card fold?** → Yes. Otherwise
   reopening the parent would reveal expanded summaries.
6. **Should explicit expanded props be removed?** → No. Preserving them avoids
   breaking intentional callers and keeps the primitive reusable.
7. **What if visual smoke testing is unavailable?** → Source, focused tests,
   typecheck, lint, formatting, and call-graph evidence remain valid; interactive
   evidence is recorded as deferred rather than implied.

### Code Verification Evidence

- [x] FID path follows the canonical `dev/fids/` location.
- [x] Filename uses the canonical `FID-YYYY-MMDD-NNN-kebab-case-title.md` format.
- [x] Required metadata fields are present.
- [x] Existing relevant production files were read 0–EOF before implementation.
- [x] Production callers and call graph were searched before implementation.
- [x] Existing collapse utilities and test gaps were inspected.
- [x] Runtime implementation exists and matches the proposed solution.
- [x] Focused tests pass: 5/5.
- [x] CLI typecheck passes.
- [x] Focused lint and formatting checks pass with zero warnings/errors.
- [x] Call-graph reachability is confirmed.
- [~] Interactive startup smoke evidence is deferred; no unsupported pass claimed.

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-08-01 10:31
- **Fix Description:** Changed `SidebarSection` and `FidCard` to start folded by
  default, preserved explicit expansion, and added focused regression tests for
  both primitives and the `FidList` path.
- **Tests Added:** Yes — `sidebar-collapse.test.tsx`, 5 tests, all passing.
- **Verified By:** Independent code review and design audit; focused tests; CLI
  typecheck; focused ESLint; Prettier; diff check; production call-graph grep.
- **Commit/PR:** Working tree only; no commit or push authorized
- **Archived:** 2026-08-01 10:31 (moved to `dev/fids/archive/`)

## Lessons Learned

- A reusable component's default prop is part of the product's visual contract;
  callers that omit it inherit the startup behavior.
- Sidebar density bugs can originate at multiple nested expansion boundaries;
  fixing only the parent section would leave expanded FID detail on reopen.
- Source call-graph evidence is necessary before changing a default so the fix
  reaches every production surface without broad unrelated state changes.
- A server-render regression test is sufficient to lock down first-paint state,
  while interactive smoke remains a separate visual-evidence concern.
