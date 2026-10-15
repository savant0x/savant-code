# FID: Code Universe Document Viewer Polish — Wrap Fix, Toolbar/Header Redesign

**Filename:** `FID-2026-0807-021-code-universe-document-viewer-polish.md`
**ID:** FID-2026-0807-021
**Severity:** medium
**Status:** closed
**Created:** 2026-08-07
**Author:** Savant (Orchestrator)
**YAGNI-Compliance:** Verified

---

## Summary

The `/graph-export` Code Universe document viewer has four UX defects: (1) long
lines such as the README.md provider table **do not word-wrap** and instead
force a horizontal scrollbar; (2) the **A− / A+ document font-size buttons** are
low-value chrome; (3) the **COPY CONTENT button** sits inline in the toolbar
instead of being pinned under the window controls; and (4) the viewer is too
small and the line/byte count sits in the toolbar instead of next to the file
name. This FID fixes all four in `cli/src/commands/graph-export/template.ts`
(the single-source template for the self-contained HTML artifact).

## Environment

- **OS:** Windows 11 (bash shell)
- **Runtime:** Bun 1.3.14, TypeScript strict
- **Artifact:** `dev/exports/graph/savant-graph.html` (self-contained file://)
- **Template:** `cli/src/commands/graph-export/template.ts` (UNIVERSE_CSS +
  app IIFE)
- **Tests:** `cli/src/commands/__tests__/graph-export.test.ts`

## Detailed Description

### Problem

1. **Word wrap broken for long lines.** In the README.md viewer, the row
   `| OpenRouter | \`/provider openrouter\` or ... |` renders un-wrapped with a
   horizontal scrollbar beneath it. The root cause is a CSS Grid intrinsic-size
   blowout: `.document-line` is `display:grid;grid-template-columns:54px 1fr`,
   and grid items default to `min-width:auto`, so the `1fr` track cannot shrink
   below the `<code>` element's min-content width. `word-break:break-word` (a
   legacy alias of `overflow-wrap:break-word`) does **not** affect intrinsic
   sizing — only `overflow-wrap:anywhere` does. README.md line 13 contains
   unbreakable ~110-char badge URLs (~790px at 12px mono) that exceed the
   viewer's ~700px content column, so the track inflates, the line never wraps,
   and `.document-surface` (`overflow-x:auto`) shows a horizontal scrollbar.

2. **Font-size buttons.** The `A−` / `A+` buttons (FID-2026-0807-014 F7)
   cycle 11/12/13/15px text. Low value; clutters the toolbar.

3. **Copy button placement.** `⧉ COPY CONTENT` lives inline in the toolbar,
   pushed right by a flex spacer, instead of being pinned under the min/max/close
   controls in the panel corner.

4. **Viewer size + meta placement.** `.center-focus` is
   `width:min(900px,calc(100% - 480px));height:min(86vh,880px)` — small on wide
   monitors — and the `711 lines · 35340 bytes` meta text sits in the toolbar
   rather than next to the file name in the header.

### Expected Behavior

- Long lines wrap at the container edge with no horizontal scrollbar; long
  unbreakable tokens break anywhere.
- No A−/A+ buttons; word-wrap toggle retained.
- COPY CONTENT pinned to the panel corner, directly under the 3 window controls.
- Viewer wider/taller; `[711 lines · 35340 bytes]` shown inline next to the file
  name in the header (bracketed), not in the toolbar.

### Root Cause

See Problem 1 for the wrap root cause. Items 2–4 are straightforward layout
decisions.

### Evidence

```text
$ grep -oE '.document-line code[^{]*\{[^}]*\}' cli/src/commands/graph-export/template.ts
.document-line code{padding:0 16px;color:#c4e8ff;white-space:pre-wrap;word-break:break-word}

$ sed -n '13p' README.md | head -c 120
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square...
# token length ~110 chars ≈ 790px at 12px mono > ~700px content column

$ sed -n '77p' README.md | head -c 80
| OpenRouter | `/provider openrouter` or `DIRECT_PROVIDER=openrouter` | ...
# un-wrapped in viewer today; horizontal scrollbar on .document-surface
```

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts` (UNIVERSE_CSS + `renderDocumentBody`)
- `cli/src/commands/__tests__/graph-export.test.ts` (QC-contract assertions)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Feature degraded (readability of long markdown/README rows)
- [ ] Low

## Proposed Solution

### Approach

1. **Wrap fix:** `.document-line` → `grid-template-columns:54px minmax(0,1fr)`
   and `.document-line code` → `white-space:pre-wrap;overflow-wrap:anywhere`
   (+ `min-width:0`). `overflow-wrap:anywhere` shrinks the track's intrinsic
   size so long tokens break inside the container; the wrap-off toggle keeps
   `white-space:pre` for users who want horizontal scroll.
2. **Remove font buttons:** drop the `A−`/`A+` button creation, the
   `cycleDocFontScale` function, `DOC_FONT_SCALES`, `docFontScale` state, and the
   `.font-scale-*` CSS. Keep `toggleDocWrap`.
3. **Copy button:** add a `#center-focus-actions` slot as a direct child of
   `#center-focus` (positioned `top:30px;right:0`, under the controls); render
   the copy button into it and clear it on folder re-render.
4. **Viewer size + meta:** widen/taller `.center-focus`
   (`width:min(1120px,calc(100% - 320px));height:min(92vh,940px)`); render the
   meta as a `.document-file-meta` span inside the header `<h2>`, bracketed
   `[...]`, and strip it from the window title-bar text.

### Steps

1. Edit `UNIVERSE_CSS`: grid fix, remove font-scale rules, add
   `.center-focus-actions`, `.document-file-meta`, resize `.center-focus`,
   hide actions when minimized.
2. Edit `buildGraphExportHtml` markup: add the `#center-focus-actions` slot.
3. Edit the app IIFE: remove font-button code; route copy into the slot; move
   meta into the header; fix `updateWindowTitle` to exclude the meta span.
4. Update `graph-export.test.ts` QC contracts (remove font-button assertions,
   add new wrap/copy/meta/size assertions).
5. Regenerate `dev/exports/graph/savant-graph.html`, verify in headless Chrome
   that README.md rows wrap with zero horizontal overflow.

### Verification

- `cd cli && bun run typecheck`
- `cd cli && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts`
- `bun x eslint cli/src/commands/graph-export/template.ts cli/src/commands/__tests__/graph-export.test.ts --max-warnings 0`
- Generated-artifact contract inspection: the regenerated export contains
  `minmax(0,1fr)`, `overflow-wrap:anywhere`, the corner action slot, and the
  bracketed metadata badge; the removed font controls are absent from the
  template source. A full 9 MB file:// DOM dump timed out in this environment,
  so the end-to-end artifact interaction assertion is recorded separately from
  the source-contract evidence.

## Perfection Loop

### Loop 1

- **RED:** Evidence above. Wrap break is intrinsic-size grid blowout
  (`minmax(0,1fr)` + `overflow-wrap:anywhere`); font buttons are removable
  dead-weight chrome; copy button should be pinned under window controls; meta
  belongs beside the file name.
- **GREEN:** Solution above. No new modes/skills. Deterministic artifact
  invariant preserved (no timestamps/dynamic HTML in template).
- **AUDIT:** Confirmed template is the single source for the export; tests
  assert template strings so all four changes require test updates; regenerated
  artifact is git-ignored (`dev/exports/`), so the live file can be refreshed
  without repo noise.
- **ADVERSARIAL:** No refutations. Wrap-off toggle remains functional
  (`white-space:pre`) so the horizontal-scroll escape hatch is preserved;
  removing font buttons removes the only user-facing text-size control but the
  viewer is now larger (F3 mitigates).
- **ADVERSARIAL:** The full artifact browser probe timed out while serializing
  the 9 MB Sigma/WebGL page; therefore the earlier claim of completed
  headless-Chrome verification is withdrawn. A lightweight Chrome layout probe
  against the exact generated CSS is required before final closure.
- **SELF-CORRECT:** Removed the generic `document-font-btn` class from the
  retained wrap toggle and replaced it with `document-wrap-btn`; updated the
  contract test. Full artifact DOM serialization remains too heavy for this
  environment, so the exact generated CSS was exercised in a lightweight
  browser fixture.
- **AUDIT:** Lightweight Chrome probe against the generated export CSS and the
  two representative README long lines passed:
  `surfaceScrollWidth=510`, `surfaceClientWidth=510`, `surfaceOverflow=false`,
  `lineOverflowing=0`, `copyInSlot=true`, `meta=[711 lines · 35340 bytes]`,
  `fontButtons=0`, `wrapButtons=1`.
- **ADVERSARIAL:** The probe uses the exact emitted CSS and representative
  long-line content, but not the full Sigma/WebGL artifact; this limitation is
  retained as evidence scope rather than overstated as full E2E coverage.
- **COMPLETE:** Implementation and scoped browser verification complete.

## Resolution

- **Status:** CLOSED
- **Resolved by:** FID-2026-0807-021
- **Verification:** typecheck, graph-export tests, ESLint, and Prettier pass;
  generated-artifact markers confirm the wrap/layout contract; lightweight
  Chrome probe confirms zero horizontal overflow on representative long lines,
  copy-slot placement, bracketed metadata, and removal of font buttons. A
  responsive CSS fixture was then exercised at desktop, tablet, portrait-tablet,
  mobile, and phone-sized viewports. The tablet header overflow was reproduced
  and fixed with the `max-width:1100px` flex-wrap breakpoint; the rerun reported
  `header overflowX=false`, `windowControlsInBounds=true`, `copyInBounds=true`,
  `titleOverflow=false`, and `navOverflow=false` at every tested viewport. The
  final flex-column shell/main fix also kept `shellInBounds=true`,
  `mainInBounds=true`, and `footerInBounds=true` at 1280, 1024, 800, 640, and
  500 CSS-pixel viewport widths. The overlap invariant was also measured:
  `centerSidebarOverlap=true` at each size, which is intentional window
  stacking—not document overflow—because the sidebar is an independently
  closable/draggable overlay (`z-index:5`) and the center document remains
  independently open (`z-index:4`) by design. The full 9 MB Sigma/WebGL DOM
  dump timed out, so that limitation is explicitly recorded rather than
  presented as full-artifact E2E evidence.
- **Archived:** 2026-08-08
