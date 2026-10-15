# Feature Request: Switch Knowledge Graph Export to ELK Layout Engine

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature request — requires FID creation

---

## Context

The current COSE layout produces a hairball at 7k nodes. Nodes are literally stacked on top of each other. The original Understand-Anything repo uses React Flow + ELK (Eclipse Layout Kernel) which produces clean hierarchical layouts.

**Decision:** Switch from COSE to ELK layout engine.

---

## Current State

**File:** `cli/src/commands/graph-export/template.ts`

**Current approach:**
- Cytoscape.js with COSE layout
- Flat node structure (all nodes treated equally)
- Cluster seeding via pseudo-random formula
- Nodes overlap massively at scale

**Problem:** COSE is a force-directed layout that pushes nodes around based on connections. At 7k nodes, it produces an unreadable hairball.

---

## Target State

**Approach:** ELK (Eclipse Layout Kernel) layout engine

**ELK produces:**
- Hierarchical, layered layouts
- No overlap — nodes positioned in layers
- Clean edge routing
- Scalable to thousands of nodes

---

## Implementation Options

### Option A: ELK via Web Worker (Recommended)
- Use `elkjs` (ELK compiled to WASM/JS)
- Run layout in Web Worker (non-blocking)
- Render via Cytoscape.js (keep existing renderer)
- Minimal changes to existing template

### Option B: React Flow + ELK
- Switch to React Flow (like the original)
- Full rewrite of template
- More features (zoom, pan, minimap)
- Higher effort

### Option C: ELK Pre-computation
- Compute ELK layout server-side (Bun)
- Embed positions in export HTML
- No client-side layout computation
- Fastest load time

---

## Recommendation

**Option A** is the best balance:
- Keep Cytoscape.js (already bundled, MIT)
- Add elkjs for layout (also MIT, WASM-based)
- Run layout in Web Worker (non-blocking)
- Minimal template changes

---

## Success Criteria

- Graph loads in < 5 seconds
- Nodes do not overlap
- Hierarchical layout (clusters → files → symbols)
- Edge routing is clean
- Zoom/pan works smoothly
- Sidebar stays within viewport

---

## Files to Modify

- `cli/src/commands/graph-export/template.ts` — Add ELK layout worker
- `packages/knowledge-graph/src/export-serializer.ts` — Add hierarchy metadata

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
