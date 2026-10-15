# Feature Request: Codebase Knowledge Graph

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature request — requires FID creation

---

## Context

I conducted deep research on codebase knowledge graph systems, analyzing:

- **Understand-Anything** (77.7k stars) — turns codebases into interactive knowledge graphs
- **Engraphis** — local-first memory for coding agents
- **Hallmark/Impeccable** — anti-AI-slop design systems

The research output is at: `docs/design/Codebase Knowledge Graph Design.md`

## The Problem

AI coding agents are only as good as the context they receive. Currently, agents read files blindly — they don't
understand the structural relationships between code components. This leads to:

- Hallucinated implementations
- Architectural regressions
- Context window pollution (reading 50 files when 5 would suffice)
- Missing dependency chains

## The Solution

A deterministic, SQLite-backed knowledge graph that:

1. **Builds structurally** — Tree-sitter AST parsing (zero token cost)
2. **Stores relationally** — SQLite database (.savant/graph.db)
3. **Updates incrementally** — XXH3 file hashing, differential parsing
4. **Labels semantically** — Main agent labels clusters (no separate model)
5. **Exports visually** — Single-file HTML with embedded Cytoscape.js

## Key Architecture Decisions

### No Separate LLM for Semantics

Instead of using Ollama or a separate model for semantic tagging, the main agent handles it during existing inference
calls. This eliminates:

- Ollama dependency
- Extra process overhead
- Additional token cost

The agent is already burning tokens on coding tasks. Adding semantic tagging to those calls is marginal cost — batch 10
community clusters into one query, use structured JSON output.

### Deterministic Call Resolution

Instead of using LLM inference to resolve function calls across files, implement a 6-strategy deterministic cascade:

| Strategy | Confidence | Mechanism |
|----------|------------|-----------|
| Import Map | 0.95 | Trace callee prefix against explicit imports |
| Same Module | 0.90 | Check if function is defined in enclosing file |
| Import Map Suffix | 0.85 | Suffix-based match against resolved paths |
| Unique Name | 0.75 | Global reverse index — if only one instance exists |
| Suffix Match | 0.55 | Import-distance scoring for identical names |

### Agent Integration

The knowledge graph integrates directly with the existing 9-agent roster:

| Agent | Integration |
|-------|-------------|
| **Scout** | Triggers background Tree-sitter parsing, builds domain clusters |
| **Thinker** | Queries blast radius before reading files |
| **Verifier** | Cross-references diffs against AST graph |
| **Detective** | Uses graph to find dependency chains during RED phase |
| **Forge** | Receives blast radius context during GREEN phase |

### Export Integration

The graph exports as a single-file HTML artifact using the same pattern as `/export`:

- Embedded Cytoscape.js + Dagre (zero CDN requests)
- Branded with Savant Code visual identity
- Offline-capable, shareable
- CLI: `savant --export-graph`

## Implementation Plan

### Phase 1: Deterministic Engine (Weeks 1-2)

- Embed Tree-sitter binaries and grammar modules (TS, JS, Python, Go, Rust, Java, C++)
- Develop AST walker for node/edge extraction
- Implement SQLite schema (Nodes, Edges, Communities tables)
- Implement 6-strategy call resolution cascade
- Implement XXH3 content hashing for watch daemon

### Phase 2: Protocol Alignment (Weeks 3-4)

- Register MCP tools (get_blast_radius, get_call_hierarchy, get_domain_context)
- Update Scout agent to trigger background parsing
- Update Thinker agent to query blast radius before reading files
- Update Verifier agent to cross-reference diffs against AST

### Phase 3: Semantic Overlay (Week 5)

- Execute Louvain clustering on SQLite data to identify domains
- Wire main agent to label clusters during existing inference calls
- Batch queries: "Here are 10 clusters. Label each with a business domain."
- Use structured JSON output for domain labels

### Phase 4: Export and UI (Week 6)

- Develop standalone HTML template with embedded Cytoscape.js + Dagre
- Wire `--export-graph` command to serialize SQLite to JSON
- Integrate with `/export` command (chat log OR knowledge graph)
- Write documentation and update CLI help menus

## File Paths

### Files to Create

```text
packages/agent-runtime/src/graph/
├── index.ts                    # Public API
├── parser.ts                   # Tree-sitter AST walker
├── sqlite-store.ts             # SQLite schema and queries
├── call-resolution.ts          # 6-strategy deterministic cascade
├── incremental-sync.ts         # XXH3 hashing + differential parsing
├── mcp-tools.ts                # MCP tool definitions
├── domain-labeler.ts           # Main agent semantic labeling
├── html-export.ts              # Cytoscape.js HTML generation
└── types.ts                    # Shared types
```text

### Files to Modify

```text
packages/agent-runtime/src/run.ts              # Integrate graph into agent loop
agents/scavant/scavant.ts                       # Add graph triggers to Scout
agents/scavant/thinker.ts                       # Add blast radius queries
agents/scavant/verifier.ts                      # Add AST cross-reference
cli/src/commands/export.ts                      # Add graph export option
cli/src/commands/graph.ts                       # NEW: graph build/watch/query/analyze
```text

### Data Files

```text
.savant/graph.db                                # SQLite knowledge graph
.savant/graph-meta.json                         # Build timestamp, hash cache
```text

## Competitive Advantage

| Metric | Understand-Anything | Savant Code Graph |
|--------|--------------------|--------------------|
| Token cost | 30 min, burns quota | Zero (deterministic) + marginal (main agent) |
| Incremental updates | Poor (silent staleness) | High (XXH3 hashing) |
| Agent integration | Basic context injection | Native ECHO Protocol integration |
| Call resolution | LLM inference (hallucination risk) | 6-strategy deterministic cascade |
| Visualization | Vite server (Node.js required) | Single-file HTML export (offline) |
| License | MIT | MIT / Apache 2.0 |

## Request

1. **Review** the deep research output at `docs/design/Codebase Knowledge Graph Design.md`
2. **Create a FID** for this feature following ECHO Protocol
3. **Run the Perfection Loop** — RED phase on the design, GREEN phase for implementation plan
4. **Answer missed questions** — What questions should you have asked when this FID was created, but failed to?
5. **Status:** Created → Analyzed (converge the plan before implementation)

This is a medium-severity feature that enhances agent capabilities without breaking existing functionality. The
deterministic engine (Phase 1) can be implemented independently and tested in isolation.

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
