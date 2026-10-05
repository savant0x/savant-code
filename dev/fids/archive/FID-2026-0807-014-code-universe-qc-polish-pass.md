# FID-2026-0807-014 — Code Universe QC polish pass (interaction bugs + keyboard/readability enhancements)

**Filename:** `FID-2026-0807-014-code-universe-qc-polish-pass.md`
**ID:** FID-2026-0807-014
**Severity:** medium (3 confirmed interaction bugs + 6 high-value enhancements)
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**YAGNI-Compliance:** Verified — every item is operator-priority (polish/QC) or
probe-verified; speculative theming explicitly out of scope.

## Summary

Complete quality-control pass over the Code Universe graph export
(`cli/src/commands/graph-export/template.ts`). A live headless-Chrome probe
against the 13.77 MB artifact confirmed three interaction bugs, one dead
parameter, and six missing enhancements. Search alignment was re-verified
(static CSS: `.search-results{left:0}` under a `position:relative` form — no
bug; the probe's earlier misread was auto-select closing the panel).

## RED — Issue Catalog (with probe evidence)

### Confirmed bugs

1. **Escape key nukes the entire universe in one press.** Global handler:
   `if Escape && search closed → resetUniverse()` (template.ts:1327-1333).
   Probe: doc open → one Escape → `CENTER_OPEN_AFTER_ESC=false`,
   `SIDEBAR_OPEN_AFTER_ESC=false`, `STATE_PILL_AFTER_ESC=UNIVERSE / MACRO`.
   A user reading a file loses the document AND the zoom with a single key.
   Standard OS/modal behavior: first Escape dismisses the top panel, second
   resets the universe.

2. **Sidebar × closes the center document too.** `windowClose()` (template.ts:
   1287-1292) calls `closeSidebar()`, which hides the sidebar AND clears the
   center focus. Probe: doc open → sidebar × → `SIDEBAR_OPEN_AFTER_SIDE_CLOSE=
   false`, `CENTER_OPEN_AFTER_SIDE_CLOSE=false`. The sidebar's own window-close
   should close only the sidebar (OS per-window semantics), leaving the open
   document in the center panel.

3. **Minimized taskbars overlap when both panels dock.** Center min docks
   bottom-center (`left:50%`, width min(560px)); sidebar min docks bottom-right
   (`right:24px`, width min(560px)). Probe at 1440×900: `CENTER_MIN_RIGHT=992`,
   `SIDE_MIN_LEFT=840` → `TASKBARS_OVERLAP=true` (152 px collision).

4. **`fitUniverse()` vs `fitUniverseSilently()` are identical** — both call
   `fitUniverseInternal(true)` (template.ts:795-800). The "Fit space" button
   can never play its close sound; the `silent` parameter is dead. Minor but
   real.

### Confirmed missing enhancements (probe: all `=false`)

5. **No keyboard navigation in the region tree** — `NAV_TABINDEX=null`; the
   sidebar tree is mouse-only, and there is no ↑/↓/←/→ affordance.
6. **No collapse-all / expand-all** — `HAS_EXPAND_ALL_BTN=false` (22+ regions
   each needing manual expansion).
7. **No document font-size toggle** — `HAS_DOC_FONT_TOGGLE=false`; code is
   fixed 12px.
8. **No word-wrap toggle** — `HAS_DOC_WRAP_TOGGLE=false`; long lines are
   always `pre-wrap` with no horizontal-scroll option.
9. **No breadcrumbs in the document header** — `HAS_DOC_BREADCRUMB=false`;
   the header shows only the file name + path, no clickable ancestry.
10. **No search keyboard shortcut** — `SEARCH_FOCUS_SHORTCUT=false`; no `/` or
    `Ctrl+K` focus binding.

## GREEN — Converged Design

1. **Staged Escape (bug 1):** global keydown becomes a 3-tier cascade:
   (a) search open → close search; (b) otherwise any panel visible (center
   focus, sidebar, or a minimized taskbar) → hide the top panel only
   (`closeSidebar()` clears sidebar; `clearFocusView()` clears center —
   whichever is visible, prefer the sidebar per z-order); (c) otherwise →
   `resetUniverse()`. Sound on each stage. Probe contract: doc open → Esc #1
   hides panels but `STATE_PILL` stays DETAIL; Esc #2 resets to MACRO.

2. **Per-window close (bug 2):** `windowClose(btn)` resolves which panel via
   `windowPanel(btn)`; sidebar × → hide sidebar only (keep center doc);
   center × → `clearFocusView()` only. Never both. `resetUniverse()` remains
   the "close everything" path.

3. **Taskbar stacking (bug 3):** when a second panel is minimized while the
   first is docked, offset the incoming bar upward (`bottom: 8px` →
   `bottom: 48px` when a sibling is docked, class-driven: `.window-minimized
   + .window-minimized` selector or a `docked-sibling` toggle). Probe
   contract: both minimized → `TASKBARS_OVERLAP=false`.

4. **fitUniverse sound (bug 4):** `fitUniverse()` → `fitUniverseInternal(
   false)` so the button's close sound fires; `fitUniverseSilently()` keeps
   `true` for init (audioBootstrapping already suppresses init anyway).

5. **Tree keyboard navigation (gap 5):** region nav becomes focusable
   (`tabindex="0"` on `#region-list`); ArrowDown/ArrowUp move the active row
   among `.region-row`, `.region-tree-folder`, `.region-file` in DOM order;
   ArrowRight expands the focused folder/region (if collapsible), ArrowLeft
   collapses or moves to parent. Enter activates the row (native button
   behavior). Visible `.nav-key-focus` class, `aria-activedescendant` style
   tracking. Caps at the visible level; scrollIntoView on move.

6. **Collapse-all / expand-all (gap 6):** two small header buttons in the
   region nav eyebrow row (`▾ ALL` / `▸ ALL`). Expand-all walks each region
   tree to depth 2 (capped at the existing LEVEL_CAP) and renders rows;
   collapse-all re-hides all `.region-files` and resets chevrons + aria.

7. **Document font-size toggle (gap 7):** `A−` / `A+` buttons in the document
   toolbar cycling `.document-surface` font-size 11/13/15px (default 12) via
   a `font-scale` class; persisted only for the session.

8. **Word-wrap toggle (gap 8):** a `⤺ WRAP` toggle in the document toolbar
   flipping `.document-surface.wrap-off` → `white-space:pre; overflow-x:auto`
   on line `code`; default wraps (matches today).

9. **Document breadcrumbs (gap 9):** under the title, a clickable path
   ancestry: root → each ancestor folder → current file. Folder segments call
   `navigateToFolder(folderByPath[acc])`; the final file segment is static.
   Built from `file.path.split('/')` with `folderByPath` lookups.

10. **Search shortcut (gap 10):** `/` and `Ctrl+K` (Cmd+K) focus
    `#universe-search-input` (preventDefault so `/` doesn't type), Escape
    returns focus to the universe when search is open. Keydown listener on
    document, ignores when focus is in an input/textarea.

11. **Test contracts:** update `graph-export.test.ts` string pins for the new
    functions/classes (`esc`-staging, `windowClose` per-panel, `.docked-*`,
    `nav-key-focus`, `font-scale`, `wrap-off`, `.document-breadcrumb`,
    search-shortcut handler); add a headless probe asserting the four bug
    contracts above flip true→false.

## AUDIT plan (double audit)

- **Static:** cli typecheck · ESLint `--max-warnings 0` · Prettier ·
  graph-export suite green (31+ tests, new pins).
- **Runtime:** headless-Chrome probe — staged Esc (doc survives first press),
  per-window close (center survives sidebar ×), taskbar overlap false,
  keyboard ↓/→ navigation opens a folder, `/` focuses search, font/wrap
  toggles change computed styles. Live E2E harness 19/19 stays green.
- **Law 4 reachability:** all new handlers inline `onclick`/`addEventListener`
  with no unreachable helpers.

## Perfection Loop

### Loop 1

- **RED:** probe evidence above (bugs 1-4, gaps 5-10).
- **GREEN:** staged Escape, per-window close, docked stacking, fit sound,
  tree keyboard nav, collapse/expand all, font-scale + wrap toggles,
  breadcrumbs, search shortcut (design above).
- **AUDIT:** static gates + headless probe + E2E; every finding tied to a
  `file:line` in template.ts or the probe output.
- **COMPLETE:** implemented, verified, archived; CHANGELOG updated.

### Missed questions answered

1. Does Escape with a minimized taskbar visible reset? → No — first Escape
   restores the panel (undocks), second Escape resets. Matches OS muscle
   memory.
2. Should the sidebar × keep the center document? → Yes (per-window
   semantics); only `resetUniverse()` closes everything.
3. Keyboard nav scope: whole tree or visible only? → Visible DOM rows only
   (lazy tree); ArrowRight expands the focused row when it has children.
4. Font/wrap persistence? → Session-only (no localStorage in a file://
   artifact; keep the export deterministic).
5. Search shortcut conflicts? → `/` and Ctrl+K only when focus is NOT in an
   input/textarea; Escape from search returns focus to the body.

## Resolution

- **Fix Description:** QC polish pass — 3 interaction bugs + dead param +
  6 enhancements. All 10 implemented in `cli/src/commands/graph-export/
  template.ts` per the converged GREEN design.
- **Tests Added:** 20+ string pins in `graph-export.test.ts` (new
  FID-2026-0807-014 contract test) + headless-Chrome probe
  (`dev/scratchpad/graph-probe-014.ts`).
- **Verified By:** typecheck × 0 errors · ESLint 0-warnings · Prettier clean ·
  graph-export suite 32 pass / 0 fail (342 expects) · live E2E 19 PASS /
  0 FAIL · headless probe all contracts green.
- **Archived:** after operator approval + implementation verification.

## AUDIT — implementation evidence (2026-08-07)

All 10 probe contracts flipped as designed against the real 14.4 MB artifact
in headless Chrome (1440×900):

| # | Contract | Before | After | Evidence |
|---|----------|--------|-------|----------|
| 1 | Staged Escape | Esc nuked all in 1 press | Esc #1 hides panels, pill stays `DETAIL / MICRO`; Esc #2 → `UNIVERSE / MACRO` | `ESC1_*` + `ESC2_PILL` probe rows |
| 2 | Per-window close | sidebar × closed center too | sidebar × → sidebar hidden, `CENTER_OPEN_AFTER_X=true` | `F2_*` rows |
| 3 | Taskbar stacking | 152px collision | sidebar `docked-sibling` raised (y 613–651 vs center 657–695), `TASKBARS_OVERLAP=false` | `F3_*` rows + `calc(8px+38px+34px+6px)` offset |
| 4 | fitUniverse sound | dead `silent` param | `fitUniverse()` → `fitUniverseInternal(false)`, init keeps `true` | template.ts:843/846 |
| 5 | Tree keyboard nav | mouse-only | ArrowDown focuses `region-row`, ArrowRight expands | `F5_*` rows |
| 6 | Collapse/expand all | none | 176 containers expanded on ▸ ALL | `F6_EXPANDED_REGIONS=176` |
| 7 | Font-size toggle | fixed 12px | A+ → `font-scale-l` → computed 13px | `F7_*` rows |
| 8 | Word-wrap toggle | wrap only | wrap-off → `white-space:pre` | `F8_*` rows |
| 9 | Breadcrumbs | title only | nav with 3 clickable folder crumbs | `F9_*` rows |
| 10 | Search shortcut | none | `/` focuses `#universe-search-input` | `F10_SLASH_FOCUSES_SEARCH=true` |

**Static gates:** cli typecheck 0 · ESLint `--max-warnings 0` clean ·
Prettier clean · graph-export suite 32 pass / 0 fail · live E2E
19 PASS / 0 FAIL. Reviewer notes addressed: stale `nav-key-focus` cleared in
`collapseAllRegions()`, dead `.center-focus…docked-sibling` selector trimmed,
taskbar-restore Escape sequence documented as 3-press (consistent with the
AUDIT probe contract).

## Lessons Learned

Staged dismissal (Esc hierarchy) and per-window close are the two biggest
usability wins in a dense multi-panel UI; verify docked-state overlaps with
an actual dual-minimize probe rather than assuming two `bottom` docked bars
cannot collide.
