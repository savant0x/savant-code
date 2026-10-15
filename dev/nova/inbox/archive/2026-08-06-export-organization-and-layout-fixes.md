# Feature Request: Export Organization + Performance + Layout Fixes

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature request — requires FID creation

---

## Context

Export files are cluttering the project root, taking 2+ minutes to load, and the knowledge graph layout is broken (nodes overlapping, sidebar forcing scroll).

**Affected files:**
- `savant-graph-2026-08-06T23-10-04.html` — Knowledge graph export
- `savant-export-2026-08-06T23-17-44.html` — Conversation export

---

## Issues

### Issue 1: Export Files Cluttering Root
**Problem:** Exports are placed in the project root, accumulating over time.
**Fix:** Organized folder with single-file rotation.

```
dev/exports/
├── graph/        (rotate: savant-graph.html)
├── conversation/ (rotate: savant-export.html)
└── archive/      (old exports)
```

### Issue 2: Export Files Take 2+ Minutes to Load
**Problem:** HTML files are massive (3MB+) and freeze the browser on open.
**Fix:** Lazy-load graph data, defer Cytoscape initialization, compress JSON.

### Issue 3: Sidebar Forces Scrolling
**Problem:** Node details sidebar is positioned off-screen, forcing page scroll.
**Fix:** Fixed-position sidebar within viewport, responsive layout.

### Issue 4: Graph Nodes Massively Overlapping
**Problem:** 6,916 nodes bunched together, unreadable.
**Fix:** Better COSE layout params, zoom-to-fit on load, cluster-based positioning.

---

## Implementation Plan

### Phase 1: Export Organization
- Create `dev/exports/` directory structure
- Modify export commands to write to organized paths
- Implement single-file rotation (overwrite previous export)
- Add `--archive` flag for preserving old exports

### Phase 2: Performance
- Lazy-load graph JSON (don't block initial render)
- Defer Cytoscape initialization until DOM ready
- Compress JSON payload (gzip or lazy decompression)
- Add loading indicator during initialization

### Phase 3: Layout Fixes
- Fixed-position sidebar within viewport
- Responsive layout for different screen sizes
- Better COSE params for large graphs
- Zoom-to-fit on initial load
- Cluster-based positioning to reduce overlap

---

## Success Criteria

- Exports write to `dev/exports/graph/` and `dev/exports/conversation/`
- Single-file rotation (no accumulation)
- Export loads in < 5 seconds
- Sidebar stays within viewport
- Graph nodes are readable (no mass overlap)
- Zoom-to-fit works on load

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
