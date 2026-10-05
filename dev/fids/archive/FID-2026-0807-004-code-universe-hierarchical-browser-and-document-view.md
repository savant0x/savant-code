<!-- markdownlint-disable MD013 -->

# FID: Code Universe Hierarchical Browser and Document View

**Filename:** `FID-2026-0807-004-code-universe-hierarchical-browser-and-document-view.md`
**ID:** FID-2026-0807-004
**Severity:** high
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant 
**YAGNI-Compliance:** Verified

---

## Summary

The current Code Universe center focus view is a selected-object card, but it is not yet a filesystem explorer. The requested
experience is hierarchical: a folder with multiple children should become a spacious cyberpunk grid, the first card should navigate up
to the parent, nested folders should drill down until a file is reached, and a file should become a large document surface showing its
exported contents. This FID adds that interaction without replacing Sigma, changing the graph schema, or embedding every repository file by
default. Metadata-only export remains the default; document content is a capped, explicit opt-in payload.

## Environment

- **OS:** Windows (`win32`); target Chrome/Chromium and offline `file://` HTML
- **Language/Runtime:** TypeScript, Bun 1.3.14, self-contained HTML export
- **Renderer:** Sigma.js + Graphology embedded in `cli/src/commands/graph-export/template.ts`
- **Serializer:** `packages/knowledge-graph/src/export-serializer.ts`
- **Related FID:** `FID-2026-0807-003-graph-universe-post-click-navigation-and-comet-physics.md`
- **Current state:** center focus overlay exists, but only renders selected object metadata; previews are opt-in and capped

## Detailed Description

### Problem

The current center card is too small and has no hierarchy browser. It cannot show all children of a selected folder, navigate to a
parent, drill through nested folders, or present a file as a document. The existing serializer emits file paths and optional capped
`preview` values, but `GraphExport.universe.files` does not carry document content and the browser has no repository-relative tree model.

### Expected Behavior

1. Selecting a system/folder opens a large center browser surface rather than a small metadata card.
2. If the current folder has multiple children, show a responsive neon grid of child folder/file cards.
3. The first grid card is always an explicit **UP / BACK** card when a parent exists. Clicking it returns to the parent level.
4. Clicking a folder replaces the current grid with that folder's children. Nested paths continue to work.
5. A folder with exactly one child may show a large single-child presentation, but it must still provide the same parent/back action.
6. Clicking a file replaces the grid with a large cyberpunk document viewer containing the file's path, language/extension identity, line-numbered content, and a back-to-folder action.
7. The graph remains visible behind the center browser; navigation changes the center browser state without clearing Sigma selection or the right metadata drawer unless explicitly requested.
8. File content is never interpreted as HTML. It is inserted with `textContent` or safely escaped into a preformatted document surface.
9. Default exports remain metadata-only. Document payloads are emitted only when an explicit opt-in flag is enabled and remain capped per file.
10. Missing, binary, unreadable, oversized, hostile, or non-exported content displays an explicit unavailable state instead of crashing or exposing arbitrary disk data.

## Root Cause

### 1. Center view is object metadata, not a tree browser

`cli/src/commands/graph-export/template.ts` currently has `#center-focus` and `renderFocusView(n, kind)`, but the function renders one
selected object and a bounded connection list. There is no child grouping, current-folder state, parent card, or document mode.

### 2. Export payload has no hierarchical browser model

`packages/knowledge-graph/src/export-serializer.ts` currently defines `UniverseRegion[]`, `UniverseFile[]`, edges, and corridors. File
paths exist, and legacy elements carry `parent`/`containerId` plus optional `preview`, but the browser does not receive a normalized folder
index. Deriving the tree at runtime from paths is possible, but a deterministic export-time tree payload is clearer, faster, and easier to
validate for large repositories.

### 3. Full contents are intentionally not embedded

`readFilePreview()` is capped and guarded against binary files, oversized files, unreadable paths, and project-root escapes. Previews are
off by default through `SAVANT_GRAPH_EXPORT_PREVIEWS=1`; full file contents are explicitly not currently embedded. The requested document
view therefore requires a new, separate opt-in document payload contract rather than silently weakening the existing preview policy.

## Evidence

```text
Current serializer contract (packages/knowledge-graph/src/export-serializer.ts):
- UniverseFile carries id, label, path, regionId, cluster, position, size, and importance.
- GraphExportElement.data optionally carries preview, parent, and containerId.
- readFilePreview(projectRoot, relativePath, maxLines, maxChars) rejects root escapes,
  non-files, files over 1 MiB, unreadable files, and NUL-detected binary content.
- serializeGraphForExport enables previews only when
  SAVANT_GRAPH_EXPORT_PREVIEWS=1 and SAVANT_GRAPH_EXPORT_NO_PREVIEW is not 1.
- The source documentation states full file contents are never embedded.

Current center contract (cli/src/commands/graph-export/template.ts):
- #center-focus is a single selected-object surface.
- renderFocusView(n, kind) writes one title, one path, metrics, and connections.
- clearFocusView() hides the surface.
- navigateToObject() calls renderFocusView() for a selected region or file.
- No folder-child grid, parent/up card, tree cursor, document viewer, or line-numbered file view exists.

Current validation:
- Existing focused graph-export tests and structural harness validate emitted HTML
  contracts, but do not exercise hierarchical folder navigation or a document view.
```

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/export-serializer.ts` — opt-in capped document payload and normalized hierarchy data
- `packages/knowledge-graph/src/types.ts` — export-facing hierarchy/document types if shared types are required
- `cli/src/commands/graph-export/template.ts` — center browser state, grid, parent navigation, document view, and styling
- `cli/src/commands/__tests__/graph-export.test.ts` — serializer/template contracts and opt-in safety tests
- `dev/test-prompts/graph-export-e2e.ts` — structural export and navigation contracts
- Real export: `dev/exports/graph/savant-graph.html` — regenerate after implementation
- This FID must not rewrite the historical evidence in FID-2026-0807-003.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Core exploration workflow is incomplete and document inspection is unavailable
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue or cosmetic edge case

## Proposed Solution

### Exact Data Contract

Add the following proposed export-facing types in `packages/knowledge-graph/src/export-serializer.ts` (these fields do not exist in the current serializer yet):

```ts
interface UniverseFolder {
  id: string // `folder-${stableHash(relativePath)}`; root is `folder-root`
  label: string
  path: string // `''` for root, slash-normalized repository-relative path otherwise
  parentId: string | null
  childIds: string[] // folders first, then files; deterministic path sort
}

interface UniverseDocument {
  text: string
  lineCount: number
  byteCount: number
  truncated: boolean
  unavailableReason?: 'binary' | 'oversized' | 'unreadable' | 'outside-root'
}
```

Extend the proposed `GraphUniverse` with `folders: UniverseFolder[]`, `rootFolderId: string`, `documents: Record<string, UniverseDocument>`,
and `documentPolicy: { enabled: boolean; maxLines: number; maxBytes: number }`. `GraphUniverse.documents` is the one canonical document
location, keyed by file ID; do not duplicate documents on `UniverseFile`. These proposed fields are absent from the current production
serializer until implementation. The browser indexes `folders` by ID and resolves `childIds` without scanning all paths on every click.
When `documentPolicy.enabled` is false, the viewer deterministically displays the disabled state for every file not present in `documents`.

Add a proposed `readFileDocument(projectRoot, relativePath, maxLines, maxBytes): UniverseDocument` helper separate from the existing
`readFilePreview(): string | undefined`. In enabled mode, emit one `documents[fileId]` entry for every file: safe text has `text`,
line/byte counts, and `truncated`; unsafe/unreadable files have `text: ''`, `lineCount: 0`, `byteCount: 0`, and exactly one
`unavailableReason`. In disabled mode, emit no document entries and rely on `documentPolicy.enabled === false` for the viewer state.

### Exact Document Policy

- `SAVANT_GRAPH_EXPORT_DOCUMENTS` defaults to off.
- When enabled, read only regular files inside the resolved project root, reject NUL-detected binaries, and cap each document at 500
  lines and 50 KiB of UTF-8 text. Set `truncated: true` when either cap cuts content.
- `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` is a hard-off for both preview and document bodies; it wins over both opt-ins.
- `SAVANT_GRAPH_EXPORT_PREVIEWS=1` continues to control the existing small sidebar preview independently.
- If document mode is off, `documents` is empty and the viewer displays a disabled-content state from `documentPolicy.enabled === false`.
- If document mode is enabled, every file receives either a safe capped document or an explicit unavailable reason; the serializer never
  throws the export or reads outside root.

### Approach

Extend the existing export payload with a deterministic, normalized hierarchy and a capped opt-in entry in `GraphUniverse.documents`, keyed by file ID. Add a single center
browser state machine that can render `folder-grid`, `single-child`, and `document` modes while preserving the existing selection state,
Sigma canvas, right drawer, ambient effects, and explicit reset behavior.

The default remains metadata-only. A separate opt-in such as `SAVANT_GRAPH_EXPORT_DOCUMENTS=1` enables a larger but bounded document
payload (recommended default cap: 500 lines and 50 KiB per file). This is intentionally separate from the existing 20-line/2,000-character
sidebar preview flag. The implementation must preserve project-root containment and binary detection before reading content.

### Steps

1. Add export-facing hierarchy data: deterministic folder IDs, normalized parent IDs, child descriptors, root ID, and file references.
   Preserve repository-relative paths and sort children deterministically by folder-before-file, then path.
2. Add an opt-in capped document entry to `GraphUniverse.documents`, keyed by file ID. Keep document entries absent by default, reject binary/oversized/unreadable/path-
   escaping files, and use a visible unavailable state when a document is not present.
3. Replace the current one-card center rendering with a browser state model containing the current folder ID, parent ID, child list, and
   optional document file ID. Keep one universal `renderCenterBrowser()` path so folder, file, back, reset, and selection transitions do
   not create divergent state.
4. Render a large single-child surface for a folder/file when appropriate. Render a responsive child grid when there are multiple
   children. Prepend an unmistakable neon **UP / BACK** card whenever the current folder has a parent.
5. Make folder cards keyboard reachable and use `textContent` for labels and paths. Clicking a folder updates the browser cursor and
   keeps the graph context focused; clicking a file switches to document mode.
6. Render a large document surface with a header (file name, full path, language/extension, line count), a line-number gutter, and
   safely inserted document text. Use a clear back-to-folder action and an unavailable-content state when opt-in content is absent.
7. Keep the browser overlay from blocking Sigma/sidebar interaction except for its own explicit controls. Ensure Universe, Escape, close,
   and the browser's back action clear or restore state intentionally; camera updates must never reset the hierarchy cursor.
8. Add static tests for hierarchy payload determinism, root/parent/child relationships, folder-before-file sorting, document opt-in/off,
   binary/path safety, center modes, back-card wiring, document rendering, and hostile content using `textContent` rather than HTML.
9. Extend the live structural harness with center-browser markers and document-mode contracts. If browser automation becomes available,
   click a real system, a folder, the up card, and a file in the regenerated `file://` artifact; otherwise record the runtime gate as
   `NEEDS-REVIEW`.
10. Regenerate the real export with the default metadata-only policy and separately exercise the opt-in document payload in a fixture;
    do not ship a massive full-content export accidentally.

### Verification

Static:

- `cd packages/knowledge-graph && bun run typecheck` (or the configured package typecheck command)
- `cd cli && bun run typecheck`
- `NODE_ENV=production bun test packages/knowledge-graph/src cli/src/commands/__tests__/graph-export.test.ts`
- `bun x eslint packages/knowledge-graph/src cli/src/commands/graph-export/template.ts cli/src/commands/__tests__/graph-export.test.ts dev/test-prompts/graph-export-e2e.ts --max-warnings 0`
- `bunx prettier --check` on changed files
- `bun x markdownlint dev/fids/FID-2026-0807-004-code-universe-hierarchical-browser-and-document-view.md`
- Call-graph search proving `renderCenterBrowser`, folder navigation, parent navigation, and document rendering have production callers.

Runtime/browser:

- Open the regenerated `file://` export in Chrome.
- Select a system with multiple children and verify the large center grid appears.
- Verify the first card is UP/BACK, click a nested folder, and verify the child set changes.
- Click UP/BACK and verify the previous folder returns.
- Click a file and verify the document view, path, line numbers, content/unavailable state, and back-to-folder action.
- Verify Sigma remains visible, no loading overlay returns, no console error occurs, and explicit Universe reset returns to the graph overview.
- Verify default export omits document bodies and opt-in fixture export includes only capped safe content.

## Perfection Loop

### Loop 1 — RED

- **CONFIRMED:** The center focus is currently a single metadata surface, not a hierarchy browser. Evidence: `template.ts` contains one
  `#center-focus` surface and `renderFocusView(n, kind)` writes one title/path/metrics/connection list.
- **CONFIRMED:** No normalized repository tree is exposed to the center browser. Evidence: `packages/knowledge-graph/src/export-serializer.ts:72-77`
  defines `GraphUniverse` as `regions`, `files`, `edges`, and `corridors`; `:43-52` defines `UniverseFile` without parent/child fields.
- **CONFIRMED:** Full contents are not available in the export. Evidence: `packages/knowledge-graph/src/export-serializer.ts:132-138` exposes
  only preview limits; `:461-463` gates previews behind `SAVANT_GRAPH_EXPORT_PREVIEWS=1`.
- **CONFIRMED:** The existing safe file reader is reusable for the preview path. Evidence: `packages/knowledge-graph/src/export-serializer.ts:412-450`
  rejects unsafe, unreadable, binary, and oversized content before returning a capped string; a new classified document reader is still required
  because the current return type is only `string | undefined`.
- **CONFIRMED GAP:** Existing center rendering is a single object surface. Evidence: `cli/src/commands/graph-export/template.ts:112-122` contains
  one center card and `:409-441` renders one title/path/metrics/connection list; tests at `cli/src/commands/__tests__/graph-export.test.ts:378-413`
  cover preview flags but not folder grid, parent card, document mode, or center content safety.

### Loop 1 — GREEN

- **Fix:** Add deterministic hierarchy payload plus a separate capped opt-in document payload; do not embed all repository contents by
  default.
- **Fix:** Add one center-browser state machine with folder grid, single-child mode, parent/up card, and document mode.
- **Fix:** Use folder-before-file deterministic ordering and explicit empty/unavailable states.
- **Fix:** Use `textContent`/preformatted text for all paths and file content; never inject file content with `innerHTML`.
- **Robust defaults:** root has no back card; every non-root folder has exactly one back card; folder cards show child counts; document
  mode shows an unavailable message when document opt-in is off; a one-child folder uses the large single-item layout; multiple children
  use the grid; empty folders show an explicit empty state.
- **Scale boundary:** every grid page has exactly 120 card slots maximum, including navigation cards. A non-root page reserves one slot
  for UP/BACK and, when more children remain, one slot for MORE/NEXT; therefore it renders up to 118 child cards. A root page without a
  next page renders up to 120 children; a root page with a next page renders 119 children plus MORE/NEXT. Page navigation advances by
  the number of child slots used and retains the same parent card at the front. This avoids a DOM explosion without adding a dependency.
- **Security boundary:** document reads reuse project-root containment, regular-file, size, unreadable, and NUL/binary guards.

### Missed Questions and Answers

1. **Should the current center card be replaced or coexist with the grid?** → Replace its body through the same center surface; retain the
   existing visual frame and graph behind it to avoid competing panels.
2. **What counts as a folder?** → Every non-empty repository-relative path prefix becomes a deterministic folder node; root is a virtual
   repository node. Existing graph regions remain graph context, not the sole filesystem hierarchy.
3. **What does the first card do at root?** → Root has no parent, so it starts directly with its children; non-root folders prepend one
   UP/BACK card that navigates to the immediate parent.
4. **What if a folder contains one child?** → Use the large single-child presentation, but do not auto-enter it. The child remains a
   keyboard/focusable clickable card; the UP/BACK action stays first and returns to the parent.
5. **What if a folder is empty or only has unsupported files?** → Render an explicit empty/unavailable state; never show a blank center.
6. **Should full file contents be embedded by default?** → No. Use a separate explicit opt-in with a 500-line/50 KiB cap per file;
   metadata-only remains the safe default for large repositories.
7. **What if a file is larger than the cap?** → Show the capped content only when the serializer marks it as safely truncated; otherwise
   show an unavailable/truncated document state with the full path and size metadata.
8. **How are hostile paths/content handled?** → Reject paths escaping the project root; reject binary/NUL files; render labels, paths, and
   content through `textContent`/text nodes; never evaluate or parse document content as HTML or JavaScript.
9. **How does Back interact with graph selection?** → Back changes only the center browser cursor and camera framing; it preserves the
   selected region context and right drawer until an explicit Universe/close action. Browser tests use `[data-browser-action="up"]`,
   `[data-folder-id]`, `[data-file-id]`, and `[data-browser-action="document-back"]` selectors.
10. **What is out of scope?** → No Sigma replacement, WebGL rewrite, live filesystem access from `file://`, network fetch, full unbounded
    repository embedding, or unrelated ambient animation changes.

### Loop 1 — AUDIT

- **PASS — serializer evidence:** `packages/knowledge-graph/src/export-serializer.ts:412-450` contains the project-root, regular-file, size, binary,
  and capped-text guards. Quoted source: `return capped.length > 0 ? capped : undefined`. This is a foundation, not proof that the new document
  contract exists yet.
- **PASS — UI evidence:** `cli/src/commands/graph-export/template.ts:112-122` contains the current center surface, and `:409-441` contains
  `function renderFocusView(n, kind)` with DOM text updates. This is the integration point, not evidence that the requested browser exists.
- **NEEDS-REVIEW — new hierarchy/document schema:** the proposed fields and classified reader are now specified above, but none exist in production yet.
- **NEEDS-REVIEW — runtime hierarchy behavior:** no production code has been changed yet, so folder/back/document interactions cannot be
  runtime-verified at this phase.
- **PASS — FID checks:** raw command output from the independent documentation gate:

  ```text
  Checking formatting...
  All matched files use Prettier code style!
  FORMAT=0
  MARKDOWNLINT=0
  ```
- **NEEDS-REVIEW — Recorder routing:** the Recorder role is unavailable in this tool roster; the Orchestrator is documenting the
  exception and will not claim Recorder verification.

### Loop 1 — ADVERSARIAL

- **CONFIRMED:** A right drawer or single center card cannot satisfy a recursive folder explorer or document endpoint.
- **CONFIRMED:** Full-content-by-default would be a scale regression for a multi-thousand-file export; capped opt-in is required.
- **ADJUSTED:** Unavailable content is represented by an enabled-mode document entry with an explicit reason; disabled mode uses the global
  policy flag and no entries. This removes the prior ambiguity between absent entries and per-file unavailable reasons.
- **REFUTED:** A renderer migration is not necessary for this feature; hierarchy state and document rendering can live in the existing
  offline center surface.
- **OMISSION CHECK:** The plan covers root, nested folders, one child, multiple children, empty folders, parent/back, unsupported files,
  default/off and opt-in document payloads, path/content safety, large exports, reset semantics, and browser verification.
- **VERDICT:** The FID converged as implementation-ready, was approved, and is now implemented. The exact schema, flag precedence, cap,
  deterministic ordering, large-folder policy, one-child behavior, and browser test selectors are implemented and covered by source tests
  and the live export harness.

## Code Verification Evidence

- [x] Existing serializer, graph types, center template, tests, and harness inspected.
- [x] RED findings include payload, content-policy, hierarchy, and test gaps.
- [x] GREEN answers the folder/back/document and scale questions.
- [x] AUDIT separates source evidence from unimplemented runtime claims.
- [x] ADVERSARIAL checks scope, security, and payload-size omission risks.
- [x] Operator approval for implementation (`code` instruction).
- [x] Production implementation and focused tests.
- [x] Regenerated export and static/live artifact evidence.
- [ ] Direct Chrome interaction evidence (browser helper navigation unavailable; recorded as NEEDS-REVIEW).

## Resolution

- **Fixed By:** Savant 
- **Fixed Date:** 2026-08-07
- **Fix Description:** Added deterministic folder hierarchy and capped opt-in document payloads; implemented the center folder grid,
  explicit parent/back navigation, paging, file-to-document drill-down, line-numbered safe document rendering, preview wiring, symlink
  containment, and UTF-8-safe byte caps.
- **Tests Added:** Serializer document-policy coverage, center-browser HTML contracts, live graph-export harness contracts, and full-scale
  export measurement.
- **Verified By:** Focused Bun tests (17/17), CLI typecheck, ESLint, Prettier, live harness (18/18), independent code review PASS.
- **Real Export:** `C:\Users\spenc\dev\savant-code\dev\exports\graph\savant-graph.html` — 3.19 MB; 2,084 universe file positions;
  14 containers; deterministic minus timestamps; full-scale 18px scan: 1,455 occupied-cell collisions, maximum occupancy 5.
- **Browser Runtime:** NEEDS-REVIEW. The browser helper could not navigate the local `file://` artifact because its navigation tool was
  unavailable in-session; no browser PASS is claimed.
- **Commit/PR:** Pending operator push
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

A spatial graph can provide topology without providing navigation. A useful code-universe experience needs a second, explicit
hierarchical information surface: graph context for relationships, a folder grid for traversal, and a document surface for inspection.
