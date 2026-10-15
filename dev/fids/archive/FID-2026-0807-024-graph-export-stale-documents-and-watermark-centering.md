# FID: Graph Export Stale Documents and Watermark Centering

**Filename:** `FID-2026-0807-024-graph-export-stale-documents-and-watermark-centering.md`
**ID:** FID-2026-0807-024
**Severity:** medium
**Status:** closed
**Created:** 2026-08-07 00:00
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

The Code Universe export can show `DOCUMENT UNAVAILABLE` for a normal text FID because `/graph-export` opens an existing knowledge-graph database and serializes its file rows without first reconciling the snapshot against the current project tree. A deleted or moved FID therefore remains indexed; the serializer then correctly reports `unreadable` because the path no longer exists. Separately, the character watermark uses a percentage-sized absolutely positioned pseudo-element; although mathematically centered, its containing/paint surface makes the mark appear top-weighted in the document panel. The export must refresh its existing index before serialization and render the watermark from a full-panel centered background layer, without weakening path containment or changing the offline artifact model.

## Environment

- **OS:** Windows development environment
- **Language/Runtime:** TypeScript, Bun, self-contained HTML/CSS/inline JavaScript export
- **Tool Versions:** Existing repository versions from `package.json` and `bun.lock`
- **Commit/State:** Working tree after FID-2026-0807-023 branded tooltip completion

## Detailed Description

### Problem

A current export contains a stale database row for:

```text
dev/fids/FID-2026-0806-017-graph-export-performance-precomputed-layout.md
```

The current filesystem path does not exist. Serializing with `documents: true` produces:

```json
{"kind":"unavailable","byteCount":null,"unavailableReason":"unreadable"}
```

The same reproduction confirms the resolved path is inside the project root; it is simply absent. The document viewer consequently displays `DOCUMENT UNAVAILABLE — The document could not be read safely from the project root.`

The current export path is:

```text
/graph-export → openGraphDatabase(projectRoot) → serializeGraphForExport(...)
```

while stale-row deletion exists only in `updateKnowledgeGraph`, reached by `/graph refresh`.

The watermark currently relies on `.center-focus::after` as a percentage-sized pseudo-element. The visual request is for the character logo to be optically and geometrically centered in the complete document panel, including when the panel is resized or the document surface is scrolled.

### Expected Behavior

1. Exporting a graph reconciles the existing index with the current project tree before the final serialization. Deleted or moved FID rows are removed; current FID files are embedded as text documents when they are present and readable.
2. The containment/symlink safety boundary remains intact. A path outside the root or an unsafe symlink remains unavailable; export must not fall back to arbitrary filesystem reads.
3. The document watermark is centered in the complete `.center-focus` panel, remains behind the content, and does not move with document scrolling.
4. Export progress identifies the refresh stage so the additional reconciliation work is visible rather than appearing frozen.
5. A direct serializer call retains its existing behavior and safety semantics; freshness is guaranteed at the command/export orchestration boundary.

### Root Cause

`handleGraphExportCommand` checks only whether `.savant/graph.db` exists, then `buildGraphExportHtml` serializes the database twice. It never calls `updateKnowledgeGraph`/`refreshKnowledgeGraph`; therefore the database can be stale after FID archival, file deletion, or renaming. `resolveContainedPath` and `fileDocument` are not the root defect: their `unreadable` result is accurate for a missing path.

The watermark pseudo-element is positioned with `left/top:50%`, a percentage width/height, and `translate(-50%,-50%)`. This is fragile for optical centering across the panel's padding, responsive dimensions, and layered document surface. A full-panel pseudo-element with `inset:0` and explicit `background-position:center center`/bounded `background-size` gives one stable containing surface.

### Evidence

```text
Reproduction against the current database:
ROOT C:\Users\spenc\dev\savant-code
ROWS [..., {"id":14198,"path":"dev/fids/FID-2026-0806-017-graph-export-performance-precomputed-layout.md"}, ...]
DOC dev/fids/FID-2026-0806-017-graph-export-performance-precomputed-layout.md
{"kind":"unavailable","byteCount":null,"unavailableReason":"unreadable"}
RESOLVED C:\Users\spenc\dev\savant-code\dev\fids\FID-2026-0806-017-graph-export-performance-precomputed-layout.md false false

Current call path:
cli/src/commands/graph-export.ts: graph DB existence check → buildGraphExportHtml
cli/src/commands/graph-export/template.ts: openGraphDatabase → serializeGraphForExport
cli/src/commands/graph-refresh.ts: updateKnowledgeGraph (the only stale-row reconciliation path)
packages/knowledge-graph/src/update.ts: stalePaths = existingRows.filter(!filePathSet.has(row.path)); DELETE FROM files
packages/knowledge-graph/src/export-serializer.ts: fileDocument → resolveContainedPath → statSync → unreadable for missing path

Current watermark:
cli/src/commands/graph-export/template.ts: .center-focus::after uses left:50%, top:50%, percentage width/height, translate(-50%,-50%), background center/contain
```

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export.ts`
- `cli/src/commands/graph-export/template.ts`
- `cli/src/commands/__tests__/graph-export.test.ts`
- `packages/knowledge-graph/src/update.ts` (existing reconciliation behavior; no safety weakening)
- `dev/fids/FID-2026-0807-024-graph-export-stale-documents-and-watermark-centering.md`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround in the export command without manual refresh
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

At the export orchestration boundary, run one incremental `updateKnowledgeGraph` pass against the already-open graph database before the first serialization. Add a visible `Refreshing the project index…` progress stage. The indexer already enumerates the project with ignore rules, normalizes separators, deletes stale rows, and preserves the safe serializer's root/symlink checks. Do not add a serializer fallback that reads arbitrary alternate paths or silently weakens containment. The second serialization remains the source of truth for document embedding.

Replace the watermark pseudo-element's percentage-sized containing box with a full-panel layer (`inset:0`) whose only background image is centered with an explicit bounded size. Keep `pointer-events:none`, the existing low opacity and radial mask, and add explicit stacking: watermark below the grid/content, content above the watermark, controls above both. This is a CSS-only rendering correction and does not affect document scroll position.

### Steps

1. Add the graph-refresh reconciliation call and progress stage before layout serialization.
2. Replace the watermark positioning declarations with a full-panel centered background layer.
3. Add regression coverage for stale-row removal/current FID inclusion, refresh progress ordering, preserved outside-root behavior, and centered watermark CSS. Update DB-only hostile-path tests so they exercise the direct serializer safety boundary rather than relying on rows that the fresh export intentionally removes.
4. Run knowledge-graph and CLI typechecks/tests, ESLint, and Prettier.
5. Perform an independent implementation audit and an adversarial review; keep any live-browser visual claim as `NEEDS-REVIEW` unless a real artifact probe verifies it.

### Verification

- A test seeds a stale DB row, removes the file, adds a current FID/text file, runs graph export, and asserts stale rows are absent while current files serialize as text.
- Existing traversal and symlink containment tests remain green; no `..` fallback or alternate-root read is introduced.
- Progress-stage test includes `Refreshing the project index…` before `Serializing the graph…`.
- Generated HTML contract asserts `inset:0`, `background-position:center center`, bounded background size, and watermark pointer/opacity/mask rules.
- CLI and knowledge-graph typechecks, focused tests, ESLint, and Prettier provide independent static/runtime evidence.
- Browser visual centering is `NEEDS-REVIEW` unless a live `file://` artifact probe measures the rendered image bounds.

## Perfection Loop

### Loop 1 — RED → GREEN → AUDIT → ADVERSARIAL

- **RED:** Reproduced the issue against `.savant/graph.db`: the stale `dev/fids/FID-2026-0806-017-...md` row resolves inside the project root but `fs.existsSync` is false; `fileDocument` therefore returns `unreadable`. Call-graph inspection confirms `/graph-export` opens/serializes without `updateKnowledgeGraph`, while `/graph refresh` owns stale-row deletion. Watermark inspection confirms a percentage-sized pseudo-element rather than a full-panel background layer.
- **GREEN:** Converged on orchestration-boundary refresh, not serializer path relaxation. The refresh uses existing ignore rules and stale deletion, preserving containment and symlink protection. Add one visible refresh progress stage. Convert only the watermark layer to `inset:0` + explicit centered background positioning; preserve opacity, radial mask, and pointer isolation. No new dependency or alternate filesystem lookup.
- **AUDIT:** PASS with exact independent evidence. `cli/src/commands/graph-export/template.ts:1-7` imports `updateKnowledgeGraph` and `withGraphOperationLock`; `:97-110` acquires the operation lock, refreshes the index, reports refresh/serialization stages, and serializes the graph only after refresh. `:1878` emits the watermark with `inset:0`, `z-index:0`, centered background positioning, and bounded size; the same declaration places the watermark behind the grid/content layers defined in that CSS block. `cli/src/commands/__tests__/graph-export.test.ts:530-543` asserts the refresh stage appears before serialization, and `:1315-1386` covers real-file breakout escaping plus the direct hostile-path serializer boundary. `packages/knowledge-graph/src/store.ts:95-117` contains the keyed operation queue/release path; `packages/knowledge-graph/src/__tests__/schema.test.ts:109-137` verifies ordering and release after rejection. Knowledge-graph typecheck + 18/18 tests, CLI typecheck + 41/41 focused graph-export tests (428 assertions), ESLint zero warnings, and Prettier all pass. Exact fallback audit found no alternate filesystem lookup.
- **ADVERSARIAL:** PASS after correction. Confirmed stale rows are removed only at the fresh export boundary, direct serializer containment remains unchanged (`packages/knowledge-graph/src/export-serializer.ts:340-359,493-510`), and graph operations are serialized within the current Bun process by `withGraphOperationLock` (`packages/knowledge-graph/src/store.ts:95-117`) for both `/graph refresh` and export. The lock does not claim to coordinate separate CLI processes; SQLite remains the source of truth at that boundary. Added lock ordering/release regression in `packages/knowledge-graph/src/__tests__/schema.test.ts:109-137`. The real-file plain-mode test proves breakout escaping; browser visual centering remains `NEEDS-REVIEW` because source tests do not measure rendered pixels.
- **CHANGE DELTA:** Implementation touched the export orchestration/template, refresh orchestration, graph store lock, focused graph-export tests, knowledge-graph lock tests, and this FID; no serializer safety code was relaxed.

### Missed Questions

1. **Should the serializer itself search for renamed files?** No. A serializer must honor the indexed path and safety boundary; rename discovery belongs to the index refresh.
2. **Should export always perform a full rebuild?** No. Use the existing incremental update; it deletes stale rows and hashes unchanged files without unnecessary reparsing.
3. **What if the database exists but is corrupt?** Preserve current failure behavior and surface the export error; do not silently replace it with an empty graph.
4. **Could refresh reintroduce ignored `.savant` files?** No. `updateKnowledgeGraph` already filters `.savant/` after `getProjectFileTree` ignore processing.
5. **What if an FID is a symlink outside the root?** It remains `outside-root` through `resolveContainedPath`; refresh must not weaken that check.
6. **Does watermark centering need DOM/JS changes?** No. The panel is already the containing block; a full-panel CSS background is sufficient and lower risk.
7. **How will we distinguish stale rows from unsafe reads in the UI?** The fix removes stale rows before export; remaining unavailable reasons continue to render as designed cards and retain their reason in the payload.
8. **Does export progress need a separate user-facing refresh message?** Yes. The refresh can take measurable time and must be represented in the staged status sequence.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Stale-row/current-FID regression passes: graph-export focused suite 41/41
- [x] Existing safety/containment regression passes: direct serializer and plain-mode breakout tests pass; containment code unchanged
- [x] Progress ordering regression passes
- [x] Knowledge-graph typecheck and tests pass: 18/18
- [x] CLI typecheck and focused tests pass: 41/41, 428 assertions
- [x] ESLint and Prettier pass
- [x] FID status updated to reflect actual implementation state
- [ ] Browser visual centering: NEEDS-REVIEW until live artifact measurement

> **Pre-implementation adversarial adjustment:** export-time refresh intentionally removes DB-only synthetic rows. Hostile path/XSS tests must therefore call `serializeGraphForExport` directly (or create a real filesystem fixture where valid) when they are testing serializer behavior, while command-level export tests cover freshness and stale-row removal.

> **AUDIT evidence-citation rule (FID-2026-0805-004):** every PASS and every FAIL in the AUDIT phase cites `path/to/file.ts:LINE` with the quoted code that justifies it; absence-shaped checks paste the exact search (NO-MATCH). Out-of-reach evidence is marked `NEEDS-REVIEW` naming the screen/system a human must check — never converted to PASS.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** Export now reconciles the project index under a shared per-project, in-process graph-operation lock before serialization, removing stale FID rows and embedding current files. Progress reports the refresh stage. The document character watermark is a full-panel, centered, z-ordered background layer that remains behind the grid and document content.
- **Tests Added:** Yes — stale-row/current-FID export regression, refresh-stage ordering, centered watermark HTML contract, hostile direct-serializer/real-file breakout coverage, and graph-operation lock ordering/release regression.
- **Verified By:** Independent basher gates: knowledge-graph typecheck + 18/18 tests; CLI typecheck + 41/41 focused graph-export tests (428 assertions); ESLint zero warnings; Prettier clean; source safety/fallback audit; final adversarial review. Browser pixel centering remains NEEDS-REVIEW.
- **Commit/PR:** Not committed
- **Archived:** 2026-08-08

## Lessons Learned

An offline export is a snapshot of both graph metadata and filesystem content. Reusing a stale snapshot without a reconciliation step produces misleading document failures even when the reader's safety checks are correct. Freshness belongs at the command boundary; safety belongs at the serializer boundary. CSS watermark artwork should use a stable full-panel containing surface when optical centering must survive responsive resizing.
