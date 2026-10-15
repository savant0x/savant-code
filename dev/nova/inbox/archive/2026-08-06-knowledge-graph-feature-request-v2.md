# Feature Request: Codebase Knowledge Graph with ECHO Protocol Integration

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature request — requires FID creation

---

## Context

I conducted deep research on codebase knowledge graph systems, analyzing:

- **Understand-Anything** (77.7k stars) — turns codebases into interactive knowledge graphs
- **ECHO Protocol v0.2.0** — how the graph integrates with your agent system

The full research output is at: `docs/design/ECHO-Protocol-Knowledge-Graph-Integration.md`

**Read that file first.** It contains the complete architecture, storage schema, agent integration plan, and
implementation phases.

## The Request

1. **Read** `docs/design/ECHO-Protocol-Knowledge-Graph-Integration.md` (the research output)
2. **Read** `ECHO.md` (the protocol)
3. **Create a FID** for this feature following ECHO Protocol
4. **Run the Perfection Loop** — RED phase on the design, GREEN phase for implementation plan
5. **Answer missed questions** — What questions should you have asked when this FID was created, but failed to?
6. **Status:** Created → Analyzed (converge the plan before implementation)

## Key Architecture (from research)

### Storage

- SQLite database (`.savant/graph.db`) with WAL mode
- 3 tables: files, nodes, edges
- Recursive CTEs for graph traversal
- XXH3 hashing for incremental updates

### Agent Integration

| Agent | MCP Tool | Purpose |
|-------|----------|---------|
| Detective | query_blast_radius | Find all files affected by a bug |
| Thinker | query_architecture | Understand domain boundaries before planning |
| Verifier | verify_reachability | Mathematical proof of Law 4 compliance |
| Scout | query_node_edges | Navigate graph for context |

### Law 4 Enforcement

The Verifier uses recursive CTEs to mathematically prove a function is reachable from a production entry point. This
transforms Law 4 from heuristic grep to absolute proof.

### Domain Clustering

Louvain algorithm with deterministic edge weighting (CALLS=2.0, IMPORTS=1.0). Zero LLM cost.

### Token Optimization

Ambient Semantic Labeling — agents yield semantic descriptions during normal execution, Scribe aggregates into SQLite.

### Export

Single-file HTML with embedded Cytoscape.js. Same pattern as `/export`.

## Implementation Phases

1. **Phase 1:** Deterministic engine (SQLite + Tree-sitter)
2. **Phase 2:** Algorithmic augmentation (Louvain clustering)
3. **Phase 3:** ECHO Protocol tooling (MCP tools + ambient labeling)
4. **Phase 4:** Portable presentation (HTML export)

## Request

Create the FID, run the Perfection Loop, and converge the plan. Do not implement — just design and verify.

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
