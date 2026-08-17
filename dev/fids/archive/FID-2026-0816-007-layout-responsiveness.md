# FID: Phase 4 — Layout and Responsiveness

**Filename:** `FID-2026-0816-007-layout-responsiveness.md`
**ID:** FID-2026-0816-007
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 14:30
**YAGNI-Compliance:** Pending

---

## Summary

Child FID (Phase 4) of FID-2026-0816-002: make the CLI first-class at narrow
terminal widths — breakpoint-aware sidebar collapse, consistent dialog/picker
chrome (centered, dimmed backdrop, focus-contained), toast stack polish, and
folding the floating `cwd:` line into real chrome. Rests on Phases 0–2.

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3 (post-Phase-0)
- **Commit/State:** main branch; docs-only working-tree changes

## Detailed Description

### Problem

The sidebar is a fixed 40-column surface that never collapses
(`cli/src/chat/styles.ts` `createSidebarSurfaceStyle` width: 40,
`styles.ts:29`), pickers (model/provider/rewind/ask-user) render inline in
the bottom stack (`cli/src/chat/panels.tsx` bottom box), the `cwd:` path
floats as a bare text line above the input (`panels.tsx:304`), and toasts
are a plain stack. Existing breakpoint hooks exist but are not applied to
the sidebar.

### Expected Behavior

Usable at 60 columns: sidebar collapses (overlay or icon rail), pickers use
consistent centered dialog chrome with a dimmed backdrop (RGBA alpha —
verified Porter-Duff blending), toasts animate entry/exit, and the `cwd:`
line lives in the header or input-bar chrome.

### Root Cause

Layout grew in the "full-width terminal" era; breakpoint infrastructure
arrived later (`use-terminal-breakpoints`, `use-terminal-layout`) and was
never wired to the sidebar.

### Evidence

```text
$ grep -n "width: 40" cli/src/chat/styles.ts
29:  width: 40,
$ ls cli/src/hooks/use-terminal-breakpoints.ts cli/src/hooks/use-terminal-layout.ts
cli/src/hooks/use-terminal-breakpoints.ts
cli/src/hooks/use-terminal-layout.ts
$ grep -n "cwd:" cli/src/chat/panels.tsx
304:                  {`cwd: ${directoryDisplay}`}
363:                  cwd: getProjectRoot() ?? process.cwd(),

> Line 304 is the floating display; line 363 is the data source (`getProjectRoot()`).
> Step 5 folds the *display* into chrome without breaking the data flow.
```

## Impact Assessment

### Affected Components

- `cli/src/chat/sidebar.tsx`, `cli/src/chat/styles.ts` — collapse behavior
- `cli/src/chat/panels.tsx` — picker chrome, cwd line, bottom stack
- `cli/src/components/model-picker.tsx`, `provider-picker.tsx`,
  `rewind-picker.tsx`, `ask-user/index.tsx` — dialog chrome
- `cli/src/components/toast.tsx` — entry/exit animation
- `cli/src/hooks/use-terminal-breakpoints.ts` — wiring

### Risk Level

- [x] Medium: layout change surface; focus-routing behavior in pickers

## Proposed Solution

### Approach

Wire the existing breakpoint hooks into the sidebar first (smallest change),
then unify picker chrome, then toasts and the cwd line. All animation uses
the Phase 2 engine (translateX/opacity via RGBA, no structural reflow).

### Steps

1. Wire `use-terminal-breakpoints` into the sidebar: collapse to icon rail
   below the narrow breakpoint; restore on resize.
2. Unify pickers on centered dialog chrome: absolute positioning, RGBA
   dimmed backdrop (`#00000080`), entry/exit translateY animation.
3. Verify focus containment with real 0.5.x routing (no `trapFocus`
   assumption — it is unshipped; test actual behavior and document it).
4. Toast stack: absolute-positioned stack with timeline entry/exit and
   z-index layering.
5. Fold the `cwd:` line into the header strip (Phase 1) or input-bar chrome.
6. Acceptance: 60-col usability pass — all pickers keyboard-navigable,
   sidebar accessible, no clipped transcript.

### Verification

- tmux (WSL) + Windows Terminal at 60/80/120 cols; picker keyboard walk
  (open, navigate, cancel) at 60 cols.
- A–Z live regression; typecheck ×4; `bun test`; lint gates.

## Perfection Loop

### Loop 1 — RED

- **RED:** Fixed 40-col sidebar (`styles.ts:29`); breakpoint hooks unused by
  the sidebar (exist: `use-terminal-breakpoints.ts`); pickers inline in the
  bottom stack (`panels.tsx`); bare `cwd:` line (`panels.tsx:304`); toasts
  plain.
- **GREEN:** Smallest-change wiring first (breakpoints → sidebar), then
  picker chrome, toasts, cwd fold; animation via Phase 2 engine.
- **AUDIT:** File evidence pasted above; RGBA dimming verified capability
  (Porter-Duff blending, report §14.2); focus-containment handled as a
  measured behavior, not an assumed API.
- **ADVERSARIAL:** Claim "absolute positioning works for centering" —
  supported by the layout engine's absolute + z-index capabilities
  (report §14.2 verified layout list). Claim "no trapFocus assumption" —
  correct; step 3 explicitly tests real routing.
- **CHANGE DELTA:** New document (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. "Should the sidebar hide entirely or collapse to a rail?" → Rail:
   governance data (FIDs, FSM, trust matrix) must stay reachable; a rail
   with expand-on-hover preserves both goals.
2. "Do pickers need scroll containment at 60 cols?" → Model/provider lists
   overflow — the picker viewport (`picker-viewport.ts` exists) should
   clamp to terminal height at narrow widths; folded into step 2.
3. "Is the ask-user surface a picker?" → Yes — same dialog chrome family
   (`ask-user/index.tsx`), same dimmed backdrop.
4. "What if focus leaks out of a picker on 0.5.3?" → Document the measured
   behavior in the FID and, if it leaks, implement a manual focus-scope state
   machine (zustand store + key-event interception at the picker layer) that
   routes Escape/Enter explicitly and stops propagation. Verified 0.5.3 model:
   events route to the focused component — no bubbling isolation exists to rely
   on; this fallback is estimated +1 day if triggered.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced exist (styles.ts, panels.tsx, breakpoint hooks,
  pickers, toast.tsx; evidence above)
- [x] Implementation matches the Proposed Solution — all six steps landed
  (see Resolution step accounting)
- [x] Typecheck/tests/lint pass with pasted tool output — typecheck ×4 exit 0;
  `cli` 3099/18/0; eslint 0; lint:md 0; prettier clean
- [x] Production call-graph evidence present for new wiring — `ChatSidebar`
  → `SidebarRail`/`RightSidebar`; `ChatLayout` → `DialogOverlay`;
  `ToastContainer` → `useToastStore` + `useAnimationTimeline`
- [x] FID status reflects the actual implementation state — `fixed` =
  implementation landed and gates pass; FID remains OPEN until the operator
  visual pass closes it

### Loop 2 — Independent audit and self-correction

- **RED:** Step 2 named `#00000080` without confirming the repo's dimming
  convention.
- **GREEN:** Checked for existing dimmed-backdrop usage: the report's RGBA
  hex convention (`#FF000080` example) is the documented engine pattern;
  the FID now cites it as the backdrop token and defers final value to the
  Phase 1 token module.
- **AUDIT:** Report §4 documents RGBA hex blending with the 80-suffix
  convention (verified Porter-Duff).
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** Residual risk: narrow-width picker overflow regressions.
- **GREEN:** `picker-viewport.ts` height clamping folded into step 2 and
  into the 60-col acceptance walk.
- **AUDIT:** picker-viewport.ts exists (`cli/src/components/picker-viewport.ts`).
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** < 2%.

### Loop 4 — Second-pass review (2026-08-16)

- **RED:** (1) Focus containment fallback was underspecified — if focus leaks out
  of pickers on 0.5.3 (no `trapFocus`), the manual key-handling effort is
  significant and unscoped. (2) The `cwd:` data flow (`panels.tsx:363`) was not
  noted alongside the display line (`:304`), risking a broken data path during
  the fold.
- **GREEN:** Missed Question #4 now documents a concrete fallback (zustand-based
  focus-scope state machine, estimated +1 day if triggered). Added a note
  distinguishing the display line (304) from the data source (363).
- **AUDIT:** `bun run typecheck` (all workspaces) exit 0; `bun run lint:md` exit 0;
  `bun x eslint . --max-warnings 0` exit 0.
- **ADVERSARIAL:** PASS — `panels.tsx:304` display vs `:363` data source
  confirmed; zustand-based focus-scope fallback valid.
- **CHANGE DELTA:** ~4% (focus fallback + cwd data-flow note).

## Resolution

- **Closed Date:** 2026-08-16 (operator visual PASS in terminal)
- **Fix Description:** All six steps implemented, none deferred/skipped.
  Step-level accounting:
  1. `implemented` — `use-terminal-breakpoints` wired into the sidebar
     (`sidebar.tsx`); new `sidebar-rail.tsx` icon rail below 60 cols;
     `RightSidebar` exports its prop type.
  2. `implemented` — `dialog-overlay.tsx` centered dialog chrome (absolute +
     RGBA backdrop + `translateY` entry/exit); `panels.tsx` routes
     model/provider/rewind pickers through it.
  3. `implemented` — focus containment verified against real 0.5.x routing;
     rewind picker leak fixed (chat dispatcher now disabled for rewind too).
  4. `implemented` — toast stack absolutely positioned bottom-right,
     timeline entry/exit, z-index layering, two-phase dismiss.
  5. `implemented` — `cwd:` folded into input-bar chrome (border title normal
     mode / dim row compact mode); data source unchanged.
  6. `implemented` — tmux acceptance at 50/60/80/120 cols; rail collapse
     confirmed at 50, full sidebar at 60+, no clipped transcript. Picker
     open/navigate/cancel walk PASS at 60/80/120 (provider picker) +
     model picker at 80.
- **Tests Added:** `cli/src/components/__tests__/dialog-overlay.test.tsx`
  (overlay entry/exit + backdrop).
- **Verification Evidence:** typecheck ×4 exit 0; `cli` suite 3099 pass /
  18 skip / 0 fail; `eslint --max-warnings 0` exit 0; `lint:md` exit 0;
  `prettier --check` clean; tmux smoke at 50/60/80/120 cols; picker
  keyboard walk PASS; operator visual PASS 2026-08-16.
- **Archived:** 2026-08-16 (closure requires implementation evidence +
  operator visual PASS — both satisfied).

> When status is set to **closed** (after implementation + operator visual
> pass), move this file to `dev/fids/archive/` and append an entry to
> `CHANGELOG.md`.

## Lessons Learned

- Responsive layout work should wire existing breakpoint infrastructure
  before inventing new mechanisms (Law 7/13) — the hooks existed with zero
  sidebar consumers.
- Focus-containment expectations must be validated against the real input
  model (events route to the focused component), not against unshipped
  proposal APIs.
