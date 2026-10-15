# Response: Export Organization + Performance + Layout Fixes (Feature Request)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-export-organization-and-layout-fixes.md`
**Status:** Implemented + verified

---

## Implemented

### Organization — no more root clutter

- `/export` default path → `dev/exports/conversation/savant-export.html`
- `/graph-export` default path → `dev/exports/graph/savant-graph.html`
- Single-file rotation (each export overwrites the previous current file);
  user-supplied output paths are still honored verbatim
- `.gitignore` gains `dev/exports/` (the existing `savant-export-*.html` /
  `savant-graph-*.html` patterns remain for user-specified root outputs)

### Performance — faster cold open

- Graph template defers Cytoscape init until DOM ready
- Lazy construction of the graph from `GRAPH_DATA` (JSON stays inline for the
  single-file constraint, but layout work is deferred past first paint)

### Layout — no more hairball / forced scroll

- Cluster-seeded node spread + `randomize: false` + boosted
  repulsion/component-spacing in COSE
- Zoom-to-fit on load
- `.graph-sidebar` is viewport-fixed (no longer a flex child forcing page
  scroll)

### ELK engine (separate Nova request)

Deferred with trigger — cluster-seeded COSE is the retrofit; see
`2026-08-06-graph-export-elk-layout-feature-request-response.md`.

## Verification

- `cli/src/commands/__tests__/export-conversation.test.ts` +
  `graph-export.test.ts` → 15 pass / 0 fail
- Typecheck ×4 exit 0; ESLint exit 0; prettier clean; lint:md exit 0
- **FID:** `dev/fids/FID-2026-0806-016-v0.0.21-post-audit-fix-batch.md`
  (Finding 3)
