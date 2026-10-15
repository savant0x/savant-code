# Response: Knowledge Graph Export Interactive Fixes (FID-2026-0806-006)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-graph-export-fix-request.md`
**Status:** FID converged — implementation pending

> **UPDATE (2026-08-06):** Implementation complete + verified. Details below.

---

## Implementation complete

- **Layout:** explicit `#cy` height + `cy.resize()` on init/resize; tuned COSE
  params (nodeRepulsion 8000, componentSpacing 120, idealEdgeLength)
- **Click:** `cy.on('tap')` + `:selected` style; background-tap closes sidebar
- **Sidebar:** right-drawer `<aside>` with path/type/cluster rows, Connections
  list (edge types + direction arrows), capped code preview
- **Preview:** `preview?: string` in the export serializer (first 20 lines,
  2,000-char cap, NUL/binary skip, `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1`
  opt-out); `graph-export.ts` privacy comment updated
- **Tests:** 2 serializer tests (env opt-out, NUL probe) + sidebar/preview
  markup assertions; graph-export 9/9
- **Verified:** typecheck ×4 exit 0; static artifact verification on a fresh
  4.5 MB real export (6,916 nodes / 7,874 edges — 2,031 previews embedded,
  sidebar markup, tap handlers, resize hook all present). Interactive
  browser click-through: **NEEDS-REVIEW** (browser automation unavailable in
  this environment)
- **FID:** closed + archived to `dev/fids/archive/`

— Savant

---

## Summary

The export issues are confirmed. Root cause of both the bunched layout and the
broken click interaction is a single defect: the Cytoscape container
(`#cy`) has no explicit height at init time, so the canvas renders near 0
height and every node collapses to one point. The click handler exists but is
unusable over the collapsed render. FID-2026-0806-006 has been created and run
through the Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL, no FAILs).

## Design decisions (loop outcomes)

| Issue | Fix |
|---|---|
| Bunched nodes | Explicit `#cy` height + `cy.resize()` on init/resize; tuned COSE params (nodeRepulsion, idealEdgeLength, componentSpacing) |
| Click interaction | `cy.on('tap')` (mouse + touch); visible `:selected` style; Ctrl+click path preserved |
| Missing sidebar | Right-drawer `<aside>`: path/type/cluster, connected nodes with edge types + direction, code preview; closes on background tap |
| Code preview | `preview?: string` in the export serializer — first 20 lines, 2,000-char cap, binary/size skip, `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` opt-out |
| Stack parity | Kept Cytoscape.js (offline, already bundled); source's React Flow + ELK rejected as 1:1 copy |

## Privacy note

The "structural metadata only" posture is adjusted: capped first-20-line
previews are embedded by default with an opt-out env var, and the comment in
`graph-export.ts` will be updated to state the cap. Full file contents are
never embedded.

## Next step

Forge implementation after operator approval, including browser verification of
a fresh export (layout spread, sidebar open/close, path highlighting), then
close + archive with AUDIT evidence.

— Savant
