# FID-2026-0807-012 — Code Universe window controls (minimize / maximize / close)

**Filename:** `FID-2026-0807-012-code-universe-window-controls.md`
**ID:** FID-2026-0807-012
**Severity:** medium
**Status:** closed (implemented + verified + archived)
**Created:** 2026-08-07
**YAGNI-Compliance:** Verified — operator-requested; multi-window/docking
themes explicitly out of scope.

## Summary

The Code Universe export's center document panel and right details sidebar
each expose a single close button (`.center-focus-close` / `.sidebar-close`).
The operator wants real OS-style window controls — minimize, maximize, close —
flush in the top-right corner, with minimize docking the open document into a
taskbar-style bar while the file stays open.

## Environment

- **OS:** Windows (headless Chrome probes) — file:// self-contained export.
- **Runtime:** `cli/src/commands/graph-export/template.ts` (single-file HTML
  template, inline CSS + IIFE script), knowledge-graph serializer.
- **State:** working tree after FID-2026-0807-011.

## Detailed Description

### Problem

1. **Single floating close affordance.** Both panels render exactly one ×
   button (`template.ts:128` center-focus, `template.ts:138` sidebar-close).
   Even flush at the corner it reads as a floating chip, not window chrome.
   Operator: "it needs a proper re-design like other programs, 3 button
   controls min/max/close, placed in the top right corner, not floating."
2. **No minimize / taskbar.** Closing the panel calls `closeSidebar()`
   (`template.ts` `closeSidebar`), which clears the open document. There is
   no way to keep a file open while returning to the universe. Operator:
   "add a minimize button, that will allow the user to keep a file open but
   minimize it in the ui to a 'taskbar' type feature."
3. **No maximize.** The document panel is capped at `min(86vh,880px)`
   (`template.ts` `.center-focus` rule); large files cannot be expanded.

### Expected Behavior

A standard three-button window-control cluster (minimize `—`, maximize `□`,
close `×`) flush to each panel's top-right corner. Minimize docks the panel
to the viewport bottom as a taskbar-style bar that keeps the open document
alive and restores it on click. Maximize expands the panel near-fullscreen
and toggles back. Close keeps today's semantics.

### Root Cause

The panels were styled as modal overlays with bespoke close chips rather
than as windows with standard title-bar chrome; no state machine existed for
docked/minimized/maximized panel geometry.

### Evidence

- `cli/src/commands/graph-export/template.ts:128` —
  `<button class="center-focus-close" ... onclick="closeSidebar()">×</button>`
- `cli/src/commands/graph-export/template.ts:138` —
  `<button class="sidebar-close" type="button" onclick="closeSidebar()">×</button>`
- `template.ts` `.center-focus-close{position:absolute;right:0;top:0;width:34px;...}`
- `template.ts` `.center-focus{...height:min(86vh,880px);...}`

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts` (HTML markup, UNIVERSE_CSS,
  window-control JS functions)
- `cli/src/commands/__tests__/graph-export.test.ts` (string contracts)
- Regenerated export artifact (`dev/exports/graph/savant-graph.html`)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium — UI behavior change in an interactive export; no data path.
- [ ] Low

## Proposed Solution

### Approach — converged design

**W1 — Reusable window-control cluster (Law 13).** One `.window-controls`
group rendered in BOTH panels, `position:absolute; top:0; right:0` (flush,
not floating), three square 30×30 buttons: minimize `—`, maximize `□`,
close `×`. Flat dark chrome, `border-radius:0`, left/bottom hairline
borders. Close hover = magenta/red (standard close affordance); min/max
hover = cyan glow. `role="group" aria-label="Window controls"`, per-button
`aria-label`s. Content clearance: `.document-toolbar`, `.browser-heading`,
`.graph-sidebar h2`, `.graph-sidebar .eyebrow` right-padding grows to ~96px
so nothing slides under the 90px cluster.

**W2 — Minimize → taskbar.** `windowMinimize(btn)` toggles
`.window-minimized` on the panel (`btn.closest('.center-focus,
.graph-sidebar')`). Docked geometry: `.center-focus.window-minimized{
top:auto; bottom:8px; transform:translateX(-50%); height:38px;
width:min(560px,calc(100% - 20px)); padding:0; overflow:hidden}`; content
hidden except a `.window-title-bar` (the open file/folder label, populated
from the current heading) + the controls. The sidebar docks bottom-right as
the same slim bar. **Minimize never calls `closeSidebar()`** — the open
document (`browserDocumentId`) stays alive; the whole bar is the restore
button (`windowRestore`), and `—` toggles restore too. Sound + status
feedback via existing `playSound`/`setStatus`.

**W3 — Maximize.** `windowMaximize(btn)` toggles `.window-maximized`:
`.center-focus.window-maximized{left:20px; top:20px; width:calc(100% - 40px);
height:calc(100% - 40px); transform:none}`; sidebar `width:46%`. Maximizing
clears minimized and vice versa (mutually exclusive classes enforced in JS).

**W4 — Close.** `windowClose(btn)` keeps `closeSidebar()` semantics (hide +
clear focus) and resets both state classes.

**JS surface (one set of functions):** `windowMinimize`, `windowMaximize`,
`windowClose`, `windowRestore` — all resolve the panel via `closest()`,
exposed on `window` alongside the existing handlers (Law 4 reachability:
inline `onclick` in emitted HTML + `window.*` exports).

**Edge cases / Five Questions:**

- Both panels minimized at once → independent classes; center bar + right
  bar coexist (OS-like). 
- Minimize while maximized → clears maximized, docks (matches OS).
- Restore after close → controls are hidden with the panel; no-op path.
- Reduced motion → instant state swap (no animation).
- Mobile ≤800px → taskbar bars go full-width; maximize still applies.
- Multiple documents → single center-focus panel is the current scope;
  multi-window docking is explicitly YAGNI.

### Steps

1. Replace both lone close buttons with the `.window-controls` cluster +
   `.window-title-bar` markup in the template HTML.
2. Replace `.center-focus-close`/`.sidebar-close` CSS with
   `.window-controls`/`.window-btn`/docked/maximized/title-bar rules; widen
   the content-clearance paddings.
3. Add `windowMinimize`/`windowMaximize`/`windowClose`/`windowRestore` +
   title-bar population; expose on `window`; update the positioning
   exclusion rule (`.center-focus>*:not(...)`).
4. Update string-contract tests (cluster markup, functions, CSS classes);
   add click-through probe.
5. Regenerate artifact; verify via headless Chrome (classes, computed
   styles, doc preserved across minimize/restore).

### Verification

- **Method 1 (static):** cli typecheck exit 0, ESLint `--max-warnings 0`
  clean, Prettier clean, `graph-export.test.ts` **31/31 pass (306 expects)**
  including the window-control cluster + taskbar contract tests.
- **Method 2 (runtime):** headless-Chrome probe all green —
  `CONTROL_GROUPS=2` (center + sidebar), `CONTROLS_RIGHT=0px`,
  `CONTROLS_TOP=0px`, `BTN_COUNT=3`, `BTN_RADIUS=0px`; minimize →
  `MINIMIZED=true`, `TITLE_BAR_VISIBLE=flex`, `TITLE_BAR_TEXT=.bun-version`,
  **`DOC_KEPT_ALIVE=true`** (document survives minimize); restore →
  `RESTORED=true` + `DOC_AFTER_RESTORE=true` (same file back); maximize →
  `MAXIMIZED=true` then `MAXIMIZE_OFF=true`; close → `CLOSED=true` +
  `CLOSE_RESETS_STATE=true`. Live E2E harness 19/19. Deterministic
  13.77 MB artifact regenerated.
- **Law 4:** `window.windowMinimize` etc. present in emitted script +
  referenced by inline `onclick` (`WINDOW_FN_EXPORTED=true`).

## Perfection Loop

### Loop 1

- **RED:** single floating close chip on both panels (no min/max), no way
  to keep a document open while returning to the universe, fixed 86vh cap.
- **GREEN:** shared `.window-controls` cluster, docked taskbar minimize that
  preserves `browserDocumentId`, near-fullscreen maximize, close unchanged;
  mutual-exclusion state machine in four small window functions.
- **AUDIT:** static contracts + runtime click-through probe (see
  Verification); reachability greps on `window.windowMinimize`.
- **CHANGE DELTA:** < 4% (template.ts ~3.5k lines, +~90).

### Missed Questions

1. Does minimize preserve the open document? → Yes; that is the operator's
   explicit requirement ("keep a file open"). Minimize must NOT call
   `closeSidebar()`.
2. Does the right details sidebar get the cluster too? → Yes; it shares the
   same window chrome; its taskbar docks bottom-right.
3. What does the taskbar bar show? → The current document/folder label via
   `.window-title-bar`, populated at minimize time from the active heading.
4. Should restore require the button only, or the whole bar? → The whole
   bar is clickable (`windowRestore`), matching OS taskbar muscle memory.
5. Is multi-window (several docs minimized at once) in scope? → No; the
   export has a single center-focus panel. YAGNI-debt recorded.

### Code Verification Evidence

- [ ] Files referenced exist: `cli/src/commands/graph-export/template.ts`,
      `cli/src/commands/__tests__/graph-export.test.ts`
- [ ] Implementation matches the proposed solution after IMPLEMENT
- [ ] Typecheck + probe evidence pasted at implementation close

## Resolution

- **Fix Description:** window-control cluster + taskbar minimize + maximize
  (implemented after operator approval of this converged FID).
- **Tests Added:** yes — string contracts + headless-Chrome click-through.
- **Verified By:** typecheck + ESLint + Prettier + browser probe + E2E.
- **Archived:** after operator approval + implementation verification.

## Lessons Learned

Standard window chrome beats bespoke control chips: match OS conventions
(min/max/close placement and affordance) and the interaction model is
immediately understood. Minimize is a dock-state change, not a close — keep
the document state machine separate from panel visibility.
