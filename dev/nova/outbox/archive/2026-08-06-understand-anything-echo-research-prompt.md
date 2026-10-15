# Deep Research Prompt: Understand-Anything Integration with ECHO Protocol

**Purpose:** Analyze Understand-Anything's source code, design a superior integration with Savant Code's ECHO Protocol,
and create a complete feature specification.

---

## Research Source 1: Understand-Anything Repository

**Repository:** https://github.com/Egonex-AI/Understand-Anything
**Stars:** 77.7k
**License:** MIT
**Technology:** Static analysis + multi-agent LLM processing

### Architecture (from source analysis)

**Pipeline Phases:**
| Phase | Script | Function |
|-------|--------|----------|
| Project Scanning | scan-project.mjs | File enumeration, .gitignore honors |
| Structural Extraction | extract-structure.mjs | Tree-sitter AST parsing |
| Dependency Mapping | extract-import-map.mjs | Import/export relationship mapping |
| Community Detection | compute-batches.mjs | Louvain algorithm for domain clustering |
| Graph Consolidation | merge-batch.mjs | Merge structural + semantic data |

**Node Schema:**

- Code Nodes: file, function, class, module, concept
- Non-Code Nodes: config, document, service, table, endpoint, pipeline, schema
- Domain/Knowledge Nodes: domain, flow, step, article, entity, claim
- Edges: imports, calls, depends_on, configures, documents, deploys, contains_flow, cites

**Storage:** JSON files in .ua/ directory
**Visualization:** Vite web server on port 5173
**Token Cost:** 30 minutes, burns entire quota on mid-sized codebases

**Known Issues:**

1. LLM-in-the-Loop for deterministic problems (hallucination risk)
2. Silent staleness (graph falls behind HEAD)
3. Monolithic processing (no incremental updates)
4. Platform lock-in (depends on Claude Code's Task tool)
5. Heavy runtime dependencies (Node.js, Vite)

---

## Research Source 2: ECHO Protocol v0.2.0

**Protocol:** ECHO Protocol v0.2.0 — Savant Agent Bootstrap
**Purpose:** Engineering governance for multi-agent coding
**Key Concepts:**

### Agent Roster (9 canonical roles)

| # | Agent | Phase | Responsibility |
|---|-------|-------|----------------|
| 1 | Orchestrator | ALL | Routes work, enforces protocol, spawns agents |
| 2 | Detective | RED | Codebase analysis, grep call-graphs, find issues |
| 3 | Forge | GREEN | Implementation only — writes code from converged FID |
| 4 | Verifier | AUDIT | Independent double-audit, run tests, check call-graph |
| 5 | Recorder | FID | Create, track, archive FIDs. Update CHANGELOG. |
| 6 | Thinker | Planning | Deep sequential reasoning for complex problems |
| 7 | Scout | Explore | Explores files and code to gather context |
| 8 | Researcher | Research | Web search and documentation lookup |
| 9 | Scribe | Docs | Session summaries and knowledge capture |

### Separation of Duties (Non-Negotiable)

- Forge (GREEN) cannot verify its own work — no bash access
- Verifier (AUDIT) cannot write anything — zero tools
- Detective (RED) cannot implement fixes — no write tools
- Recorder controls FID lifecycle exclusively
- Scout/Researcher are read-only

### Perfection Loop FSM

```text
idle → red → green → audit → complete
                ↓         ↑
                self_correct
```text

### The 15 Laws

**Laws 1-4 (Immutable Process — ALWAYS enforced):**

1. Read 0-EOF Before Touch
2. Present Before Act
3. Verify Before Proceed
4. Verify Call-Graph Reachability

**Laws 5-15 (Extended Code — enforced when strict_mode: true):**

5. No pseudo-code, TODOs, or placeholders
6. No type safety shortcuts
7. Search for existing code BEFORE creating new
8. Log intent before coding
9. Generate production-grade documentation
10. Update tracking after every feature
11. Follow discovered patterns EXACTLY
12. Never expose sensitive data in logs/errors
13. Utility-first, universal logic
14. All error paths handled
15. Build stays clean

---

## Research Source 3: Savant Code Architecture

**Repository:** https://github.com/savant0x/savant-code
**Stars:** 1,560+ weekly downloads
**Technology:** TypeScript monorepo, Bun runtime, OpenTUI + React CLI

### Agent System

- 9 canonical agents with restricted tools
- FID-Bound Execution for complex tasks
- Hybrid Mode for direct writes
- Strict Mode for full ceremony

### Existing Features

- Scout agent: Explores files via glob/read_files/list_directory
- Thinker agent: Deep reasoning via sequentialthinking tool
- Verifier agent: Independent code review, test execution
- Knowledge system: knowledge.md files for project conventions
- HTML export: /export writes branded, self-contained HTML reports
- Code search: code_search tool for grep-like pattern matching

---

## Research Questions

### 1. Source Code Analysis

- Analyze Understand-Anything's actual source code structure
- Identify the exact scripts and their dependencies
- Map the data flow from raw code to knowledge graph
- Identify hardcoded assumptions and platform dependencies

### 2. ECHO Protocol Integration

- How does ECHO's separation of duties apply to knowledge graph building?
- Which agent should own graph construction? (Scout? Recorder? New agent?)
- How does the Perfection Loop apply to graph updates?
- How do Laws 1-4 apply to graph operations?

### 3. Deterministic vs Probabilistic

- What parts of Understand-Anything's pipeline are deterministic?
- What parts require LLM inference?
- Can deterministic parts be extracted and run locally?
- How can LLM costs be minimized or eliminated?

### 4. Incremental Updates

- How can the graph update incrementally as code changes?
- What hashing strategy should be used? (XXH3, SHA-256, etc.)
- How does Tree-sitter's incremental parsing help?
- How can stale nodes be detected and updated?

### 5. Agent Integration

- How should Scout interact with the graph during RED phase?
- How should Thinker use blast radius queries during planning?
- How should Verifier cross-reference diffs against the AST?
- How should the graph inform the FID system?

### 6. Storage and Querying

- Why does Understand-Anything use JSON instead of SQLite?
- What are the advantages of SQLite for knowledge graphs?
- How can graph queries be optimized for agent consumption?
- How can MCP tools expose graph data to agents?

### 7. Export and Visualization

- Why does Understand-Anything require a Vite server?
- How can the graph be exported as a single HTML file?
- How can Cytoscape.js be embedded inline?
- How can the export integrate with /export?

### 8. Token Optimization

- How can semantic labeling be done without a separate model?
- How can the main agent handle labeling during existing calls?
- How can batch queries reduce token usage?
- How can structured output minimize wasted tokens?

### 9. Competitive Analysis

- How is this different from Understand-Anything?
- How is this different from Engraphis?
- What is the unique value proposition?
- What are the implementation risks?

### 10. Implementation Strategy

- What is the minimal viable implementation?
- What are the dependencies and risks?
- What is the phased implementation plan?
- How can the feature be tested incrementally?

---

## Output Format

Please provide:

1. **Source Code Analysis** — Detailed breakdown of Understand-Anything's architecture, scripts, and data flow
2. **ECHO Integration Design** — How ECHO's separation of duties, Perfection Loop, and Laws apply
3. **Deterministic Extraction** — Which parts can run locally without LLM
4. **Incremental Update Strategy** — Hashing, differential parsing, staleness detection
5. **Agent Integration Plan** — How each agent interacts with the graph
6. **Storage Architecture** — SQLite schema, MCP tools, query optimization
7. **Export System** — Single-file HTML with embedded Cytoscape.js
8. **Token Optimization** — Main agent labeling, batch queries, structured output
9. **Feature Specification** — Complete spec for implementation
10. **Implementation Plan** — Phased approach with dependencies

---

## Constraints

- Must be compatible with ECHO Protocol v0.2.0
- Must respect separation of duties (no agent can both build and verify the graph)
- Must be zero-cost (no paid dependencies, no separate LLM for semantics)
- Must be MIT/Apache 2.0 compatible
- Must work incrementally (not rebuild from scratch)
- Must integrate with existing agents (Scout, Thinker, Verifier)
- Must export as branded HTML (same as /export)
- Must reduce token cost compared to Understand-Anything