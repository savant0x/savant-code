# FID-2026-0807-015 — Code Universe usability: oversized-document head previews + draggable windows

**Filename:** `FID-2026-0807-015-code-universe-head-previews-and-draggable-windows.md`
**ID:** FID-2026-0807-015
**Severity:** medium (2 user-reported usability gaps: 646-file dead-end wall + non-draggable panels)
**Status:** closed
**Created:** 2026-08-07
**Author:** Savant
**YAGNI-Compliance:** Verified — both items are user-reported; no speculative theming.

## Summary

Two user-reported Code Universe (`/graph-export`) usability gaps:

1. **The "FILE TOO LARGE FOR EXPORT" wall is a dead end.** 646 of 650
   unavailable documents in the current export are `oversized`, i.e. the
   8 MB aggregate text budget exhausts mid-repo and every later file renders
   a card with **zero content** regardless of its own size. The hint then
   suggests `SAVANT_GRAPH_EXPORT_DOCUMENT_BYTES`, which cannot fix a
   total-budget exhaustion — misleading copy on top of a wall.
2. **Windows cannot be dragged.** The panel title bar is `display:none`
   unless minimized (`template.ts` `.window-title-bar{display:none}`), and
   both panels are position-anchored (center `left:50%/top:50%/translate`,
   sidebar `right:24px/top:24px`), so there is no way to move them — no
   OS-style drag affordance.

## RED — Issue Catalog (with evidence)

### F1 — Oversized-document wall (646 files)

- Artifact audit (`dev/exports/graph/savant-graph.html`, 2,084 files indexed):
  `"kind":"text"` × 1432 · `"kind":"unavailable"` × 650 · `"kind":"image"` × 2.
  Unavailable breakdown: `unavailableReason:"oversized"` × **646**,
  `"unreadable"` × 4.
- Root cause in `packages/knowledge-graph/src/export-serializer.ts`:
  `DEFAULT_DOCUMENT_TOTAL_TEXT_BYTES = 8 MB` (line 247); `fileDocument`
  returns `unavailableDocument('oversized', stat.size)` when
  `budget.textBytes + embeddedBytes > maxTotalTextBytes` (line 470-471) —
  so once the running total passes 8 MB, **every** remaining text file is
  emitted with no content, regardless of how small it is.
- A second, independent wall: `DOCUMENT_MAX_SOURCE_BYTES = 1 MB` (line 243)
  skips any source file > 1 MB at line 429 — also a zero-content card.
- The hint in `template.ts` (`renderDocument`) is misleading for the common
  case: it offers `SAVANT_GRAPH_EXPORT_DOCUMENT_BYTES` (a per-file cap) when
  the actual limiter is the aggregate total, and gives no actionable command.
- `eslint.config.js` (7,169 B / 214 lines) is actually embedded — the wall
  depends on iteration order, so the user hits it on whichever file lands
  after the budget is exhausted. "I keep hitting this wall" = 31% of the
  repo is unreadable inline.

### F2 — Panels cannot be dragged

- `template.ts`: `.window-title-bar{...display:none...}` is shown only via
  `.center-focus.window-minimized .window-title-bar, .graph-sidebar.window-minimized .window-title-bar{display:flex}`.
  Open panels have no visible drag handle.
- `.center-focus` anchors with `left:50%;top:50%;transform:translate(-50%,-50%)`;
  `.graph-sidebar` with `right:24px;top:24px`. No pointer handlers exist for
  moving either panel (only `windowMinimize/Maximize/Close/Restore`).

## GREEN — Converged Design

### F1 — Bounded head-preview tier (kill the wall, keep the budget)

**Serializer** (`packages/knowledge-graph/src/export-serializer.ts`):

- New options with env knobs:
  - `documentHeadBytes` — `SAVANT_GRAPH_EXPORT_HEAD_BYTES`, default `8192`.
  - `documentHeadTotalBytes` — `SAVANT_GRAPH_EXPORT_HEAD_TOTAL_BYTES`,
    default `4 * 1024 * 1024` (bounded artifact growth: ≤ ~4 MB of heads for
    a 2,084-file repo, tunable).
  - `DocumentBudget` gains `headBytes` accumulator; `documentPolicy` gains
    `headBytes` + `headTotalBytes` so the UI can render accurate copy.
- Both oversized paths now emit a **head preview** instead of a bare card:
  - **> 1 MB source (line 429):** bounded read of the first
    `documentHeadBytes + 1` bytes (never load the whole giant file), trim to
    the last whole line, emit `{ kind:'text', text: head, lineCount,
    byteCount: stat.size, truncated: true, preview: true }`.
  - **Total-budget exhausted (line 470):** the already-capped candidate
    (`maxLines`/`maxBytes` truncated) is further truncated to
    `documentHeadBytes` and emitted with `preview: true` — same shape.
  - Head bytes are charged to `budget.headBytes` against
    `documentHeadTotalBytes` (separate pool — main-budget accounting
    unchanged). If the head pool is also exhausted → fall back to the
    existing `unavailableDocument('oversized', …)` (rare).
- `binary` / `unreadable` / `unsupported-image` / `malformed-image` /
  `outside-root` behavior unchanged.
- Determinism preserved: previews are a fixed head-of-file slice using the
  same UTF-8-safe `truncateUtf8` helper.

**Template** (`cli/src/commands/graph-export/template.ts`, `renderDocument`):

- `doc.kind === 'text' && doc.preview === true` renders:
  - a `.document-preview-banner` strip: "⚠ HEAD PREVIEW — file is
    `formatBytes(doc.byteCount)` · first N lines shown · re-run
    `/graph-export` with `SAVANT_GRAPH_EXPORT_TOTAL_TEXT_BYTES=67108864` to
    embed the full file";
  - the head lines in the normal line renderer (real content — the wall is
    gone);
  - meta line suffix "· head preview"; the COPY button copies the head.
- The `'oversized'` unavailable-card hint (only reachable when the head pool
  is exhausted) is rewritten to name the real knob:
  `SAVANT_GRAPH_EXPORT_TOTAL_TEXT_BYTES=67108864` (+ `HEAD_TOTAL_BYTES` if
  heads are off), and no longer suggests the misleading per-file var alone.

### F2 — Draggable windows (OS-style title-bar drag)

**Template:**

- `.window-title-bar` becomes always-visible chrome on open panels:
  `display:flex;height:24px` (left, `right:96px` to clear the controls),
  `cursor:grab`. It keeps its 38 px taskbar role when minimized and is the
  drag handle in both states. `updateWindowTitle()` is also called when a
  panel opens so the strip is always labelled.
- Pointer-based drag (works for mouse + touch):
  - `windowDragStart(bar, event)` on `pointerdown` (only left button /
    primary): if minimized → `windowRestore(bar)`; if maximized →
    un-maximize (OS behavior); setPointerCapture; store start point.
  - `windowDragMove(event)`: once movement exceeds a 3 px threshold, add
    `.window-dragging`; compute the panel's rect and switch it to explicit
    inline `left/top` (center: clear the centering `transform`; sidebar:
    clear the `right` anchor), then translate by the pointer delta. Clamp so
    ≥ 48 px of the panel stays inside the viewport.
  - `windowDragEnd(event)`: remove `.window-dragging`, release capture.
  - A click with no movement on a minimized taskbar still restores (existing
    `onclick="windowRestore(this)"` untouched).
- Positions are **session-only** (runtime inline styles) — export
  determinism unaffected, no persistence in the file:// artifact.

**CSS:**

- `.window-title-bar{cursor:grab}` (minimized taskbar too).
- `.window-dragging{transition:none!important;user-select:none;cursor:grabbing}`.
- `.graph-sidebar{padding-top:26px}` (was 22) so the always-visible 24 px
  strip never overlaps the eyebrow; the center panel's existing 26 px top
  padding already clears its strip. Minimized padding:0 behavior unchanged.

### Test contracts

- **Serializer tests** (`packages/knowledge-graph`): budget-exhausted file →
  head preview with `preview:true` + correct head/byteCount; > 1 MB file →
  bounded head preview; head-pool exhaustion → falls back to
  `unavailable`; `documentPolicy` exposes `headBytes`/`headTotalBytes`;
  existing budget/truncation tests unchanged.
- **Template pins** (`graph-export.test.ts`): `document-preview-banner`,
  `windowDragStart`/`windowDragMove`/`windowDragEnd` + window exports,
  `.window-dragging` CSS, always-visible `.window-title-bar` rule.
- **Headless probe:** open an oversized file → banner present + text lines
  rendered + copy button; dispatch pointer drag on the title bar → panel
  rect left/top changed + clamped; minimized-bar click (no move) still
  restores.

## AUDIT plan (double audit)

- **Static (Method 1):** knowledge-graph typecheck + tests · cli typecheck ·
  ESLint `--max-warnings 0` · Prettier · graph-export suite + new pins.
- **Runtime (Method 2):** headless-Chrome probe (preview content + drag
  movement + taskbar-click restore) · live E2E harness 19/19 stays green.
- **Law 4 reachability:** `windowDragStart/Move/End` exported on window for
  inline handlers; serializer options threaded from
  `buildGraphExportHtml` env reads to `fileDocument`.

## Perfection Loop

### Loop 1

- **RED:** probe/artifact evidence above (646 oversized walls; zero-content
  cards; no drag affordance).
- **GREEN:** head-preview tier (bounded, deterministic, env-tunable) +
  always-visible draggable title bars with OS semantics (design above).
- **AUDIT:** static gates + headless probe + E2E; every finding tied to
  `file:line` in the serializer/template or probe output.
- **COMPLETE:** implemented, verified, archived; CHANGELOG updated.

### Missed questions answered

1. Do head previews count against the 8 MB text budget? — No; a separate
   4 MB head pool keeps main-budget accounting byte-identical.
2. Do > 1 MB files get previews? — Yes, via a bounded head read (never
   loads the whole file into memory).
3. Determinism? — Yes; head slice uses the same `truncateUtf8` helper.
4. Drag persistence? — No; session-only inline styles (keeps the export
   deterministic).
5. Drag while maximized/minimized? — Maximized un-maximizes first; a
   minimized taskbar restores then drags; click-without-move still restores.
6. Artifact size impact? — Bounded by `HEAD_TOTAL_BYTES` (≤ ~4 MB on this
   repo) and tunable; the wall becomes readable previews.

## Resolution

- **Fix Description:** head-preview tier for oversized documents (646-file
  wall becomes readable heads) + OS-style draggable panel title bars.
- **Implementation corrections:** independent aggregate-budget head reads;
  UTF-8 byte-aware and exact-cap-safe line trimming; containing-block drag
  coordinates; deferred drag styles so a no-op title-bar click preserves
  responsive anchoring.
- **Tests Added:** serializer head-preview/budget tests + exact-cap UTF-8
  regression + template pins + runtime browser probe contracts.
- **Verified By:** KG typecheck (0) + 17 KG tests / 0 fail; CLI typecheck (0)
  + 37 graph-export tests / 0 fail; ESLint 0 warnings; Prettier clean; small
  real Chrome export probe 6/6 PASS (preview banner/content/wall absence and
  title-bar visibility/drag movement/clamp); deterministic full artifact
  regeneration; graph-export E2E 19 PASS / 0 FAIL.
- **Full-artifact probe note:** the 2,084-file / ~17 MB artifact exceeded the
  available headless-Chrome dump window and timed out before DOM capture; no
  pass is claimed for that run. The smaller real export probe completed.
- **Archived:** after implementation and independent static/runtime audit.

## Lessons Learned

A total-budget cap that silently converts files to zero-content cards reads
as "this file is too big" even when the file is 7 KB — always distinguish
aggregate-budget exhaustion from per-file size in both the data model
(`preview` tier) and the UI copy. Drag affordances need a visible handle in
the resting state, not only in a hover/minimized state.
