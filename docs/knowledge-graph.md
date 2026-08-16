<!-- markdownlint-disable MD013 MD033 -->
# Codebase Knowledge Graph

The knowledge graph is a deterministic, incremental, SQLite-backed index of
your codebase's **structure**: files, symbols, and the dependency edges between
them (`IMPORTS`, `CALLS`, `EXTENDS`). It is built in-process (no daemon, no
background process), refreshed on demand, and used both by agents (via
read-only native tools) and by you (via the slash-command suite).

**Structural metadata only.** The graph stores paths, symbol names, hashes, and
edge types — never file contents. No secrets can leak from the graph, its
tools, or its export.

---

## Commands

### `/graph refresh`

Builds or incrementally updates the index for the current project and reports
summary stats (files added/modified/deleted/unchanged, node/edge/cluster
counts).

- First run on a project performs a full index.
- Later runs hash-compare every file (sha256) and re-parse only what changed.
- `/graph refresh --full` (alias `-f`) forces a complete rebuild.

The index lives at `.savant/graph.db` under the project root. It is
gitignored and excluded from the project file tree — it is a regenerable
artifact, never part of the repository.

### `/graph-export`

Serializes the current index into a **self-contained, branded, offline HTML
file** — the Code Universe — rendered with an interactive Sigma.js/Graphology
WebGL canvas:

- Ranked file/system search with a precomputed export-time index (instant
  keystroke response, dropdown aligned under the input)
- Cluster color-coding (deterministic ramps: regions and Louvain domains)
- Fit-space view, draggable document/detail panels, and click-through
  navigation from universe → region → file
- Inline document viewer with copy, minimize, and window controls

The report reuses the exact `/export` design system: real Savant logo (base64),
offline Font Awesome, Neon Slate tokens, corner marks, meta grid, and footer.
Sigma.js + Graphology are inlined, so the file works with zero network
requests.

Usage:

```text
/graph-export              → writes dev/exports/graph/savant-graph.html
                             (single-file rotation — previous export is
                             overwritten, so exports stop cluttering the root)
/graph-export out.html     → writes to the specified path
```

If no index exists yet, the command tells you to run `/graph refresh` first.

---

## Agent Tools

Detective and Scout can call three read-only native tools:

| Tool | Purpose |
| --- | --- |
| `query_blast_radius` | Files transitively reachable from (or reaching) a file, depth-capped |
| `query_node_edges` | Direct edges for a file — inbound, outbound, or both |
| `query_domain_clusters` | Files grouped by Louvain domain cluster id |

The Verifier and Thinker remain zero-tool by contract. The harness computes
reachability evidence (`verify_call_reachability` semantics) and injects it
into their message history — same evidence, unchanged separation of duties.

---

## How It Works

1. **Enumerate** — project files via the ignore-aware file tree
   (`.savant/` itself is always excluded).
2. **Diff** — sha256 hash-compare against the last index; unchanged files skip
   parsing entirely.
3. **Parse** — changed/new files go through `packages/code-map` (tree-sitter
   WASM, 11-language `.scm` tag queries) to extract symbols and call tokens.
4. **Assemble** — `IMPORTS`/`EXTENDS` come from raw source; `CALLS` resolve
   through the persisted call-token layer; edges carry deterministic weights
   (CALLS 2.0, IMPORTS 1.0, cross-directory penalty).
5. **Cluster** — graphology Louvain with a seeded RNG and resolution scaled to
   node count, so clusters are reproducible across runs. Cluster ids are
   written back to `nodes.cluster_id`.
6. **Query** — blast radius uses a recursive CTE with `instr(path)` cycle
   detection and a depth cap (≤ 50).

## Limitations

- Reachability is deterministic proof **over the indexed snapshot** — bounded
  by index freshness and parser-query coverage (dynamic dispatch and aliased
  imports are not resolved).
- Language coverage mirrors `packages/code-map` (TypeScript/JS first-class;
  11 languages total).

## Related

- [`docs/archive/design/ECHO-Protocol-Knowledge-Graph-Integration.md`](archive/design/ECHO-Protocol-Knowledge-Graph-Integration.md)
  — the converged design research (archived)
- [`docs/features.md`](features.md) — full feature list
- [`docs/code-universe-export.md`](code-universe-export.md) — the two export workflows, offline viewer, and Code Universe guide
