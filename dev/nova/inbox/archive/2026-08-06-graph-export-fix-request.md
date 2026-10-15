# Feature Request: Knowledge Graph Export Interactive Fixes

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Bug fix request — requires FID creation

---

## Context

The knowledge graph export (`savant-graph-2026-08-06T20-00-22.html`) has two issues:

1. **Layout issue** — All nodes are bunched up, not spread out properly
2. **Click not working** — Clicking a node doesn't show its connections

The template at `cli/src/commands/graph-export/template.ts` has all interactive features implemented (fit, colors, search, click, shortest path), but they're not working correctly.

## What to Investigate

1. **Read the export template** — `cli/src/commands/graph-export/template.ts` (0-EOF)
2. **Read the FID** — `dev/fids/archive/FID-2026-0806-002-knowledge-graph-echo-integration.md` (0-EOF)
3. **Read the knowledge graph source** — `packages/knowledge-graph/src/` (all files)
4. **Open the export HTML** — `savant-graph-2026-08-06T20-00-22.html` and test in browser
5. **Check for JavaScript errors** — Browser console

## Issues to Fix

### Issue 1: Layout
The nodes are all bunched up. The Cytoscape layout settings need adjustment:
- Check the `layout` configuration in the template
- Likely needs `name: 'cose'` or `name: 'concentric'` with better spacing
- May need `animate: false` for large graphs

### Issue 2: Click Interaction
Clicking a node should:
1. Highlight the node
2. Show its connections in the status bar
3. Enable Ctrl+click for shortest path

Check:
- Event binding (`cy.on('click', 'node', ...)`)
- JavaScript errors in browser console
- Cytoscape.js initialization timing

## Files to Read

1. `cli/src/commands/graph-export/template.ts` — The HTML template with JavaScript
2. `packages/knowledge-graph/src/export-serializer.ts` — Data serialization
3. `dev/fids/archive/FID-2026-0806-002-knowledge-graph-echo-integration.md` — Original FID
4. `savant-graph-2026-08-06T20-00-22.html` — The broken export

### Issue 3: Missing Sidebar (Source Material Feature)
The source material (Understand-Anything) opens a sidebar when clicking a node, showing:
- Node details (file path, type, cluster)
- Connected nodes (imports, calls, extends)
- Code preview (first N lines of the file)
- Documentation (if available)

Our implementation only shows connections in the status bar. We need a proper sidebar panel.

### Issue 4: Missing Features Compared to Source
Source material has:
- ✅ Interactive graph with zoom/pan
- ✅ Node click → sidebar with details
- ✅ Fuzzy search
- ✅ Cluster color-coding
- ✅ Shortest path highlighting
- ✅ Guided tour mode
- ❌ **We're missing: Sidebar panel, code preview, documentation display**

## Success Criteria

- Graph nodes are properly spaced (not bunched up)
- Clicking a node opens a sidebar with:
  - Node details (file path, type, cluster)
  - Connected nodes list
  - Code preview (first 20 lines)
  - Edge types (imports, calls, extends)
- Ctrl+click works for shortest path highlighting
- Fuzzy search works
- Cluster colors work
- Fit button works
- Sidebar closes when clicking empty space

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
