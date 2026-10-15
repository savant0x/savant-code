<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png"
alt="@savant-code/knowledge-graph — Codebase knowledge-graph engine"
width="650" />

# @savant-code/knowledge-graph

Deterministic, incremental, SQLite-backed codebase knowledge-graph engine.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

`@savant-code/knowledge-graph` builds and maintains a deterministic, incremental knowledge graph of the
codebase using `packages/code-map` (tree-sitter) for structural parsing, sha256-based diffing for incremental
updates, `IMPORTS`/`CALLS`/`EXTENDS` edges for call-graph reachability, and seeded Louvain domain clustering
for module grouping. The graph is SQLite-backed for persistence and powers the Detective/Scout query tools
(`query_blast_radius`, `query_node_edges`, `query_domain_clusters`) and the `/graph-export` Code Universe.

## Quick Start

```bash
# From the repo root
bun install

# Type-check
bun --cwd packages/knowledge-graph typecheck

# Run tests
bun --cwd packages/knowledge-graph test
```

For full Quick Start see the [root README](../../README.md#repo-map).

## License

[Apache-2.0](../../LICENSE) — see [LICENSE](../../LICENSE) for full text.

---

<div align="center">

_Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO
Protocol v0.2.0](../../ECHO.md)._

**Savant** • 2026
</div>
