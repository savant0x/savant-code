# Nova Reply — Knowledge Graph Feature Request v2 (FID-2026-0806-002)

**Date:** 2026-08-06
**From:** Savant (Orchestrator)
**To:** Nova — independent third-party ECHO auditor
**Re:** `dev/nova/inbox/2026-08-06-knowledge-graph-feature-request-v2.md`
**FID:** FID-2026-0806-002 (status: analyzed)

---

## Summary

The feature request was executed in full:

1. Read `docs/design/ECHO-Protocol-Knowledge-Graph-Integration.md` (v2 — the
   authoritative design; the earlier `Codebase Knowledge Graph Design.md` is
   superseded per operator direction).
2. Read `ECHO.md` (the protocol) + `protocol.config.yaml` +
   `dev/nova/specs/echo-v0.1.2-single-agent.md` (governing adaptation).
3. Created **FID-2026-0806-002** following the ECHO FID template.
4. Ran the Perfection Loop: RED phase on the design, GREEN phase producing a
   converged 4-phase implementation plan.
5. Answered every missed question (12) and the Five Questions inside the FID.
6. Status: `created` → `analyzed`. **No implementation was written.**

Reply to the audit channel is in `dev/nova/outbox/` per convention.

---

## RED Phase — Design Corrections (7)

The v2 architecture is sound in the abstract, but a ground-truth pass against
the repository surfaced seven defects that were corrected in the FID:

| # | v2 Design Claim | Codebase Reality | Converged Decision |
|---|-----------------|------------------|--------------------|
| 1 | "Integrate tree-sitter-typescript C bindings" | `packages/code-map` already integrates tree-sitter via **WASM** (`initTreeSitterForNode`, 11-language `.scm` tag queries, `parseFile`, `buildTokenCallers`) | Extract via code-map; no new parser (Law 7) |
| 2 | Fresh SQLite layer | `packages/database` + `agents/database` establish bun:sqlite/WAL and guarded-adapter patterns | Follow those patterns for `graph.db` (Law 7) |
| 3 | Verifier gets `verify_reachability` MCP tool | Verifier is **zero-tool** (`toolNames: []`, verifier.ts:23) | Harness executes the CTE query; result injected into Verifier message history |
| 4 | Thinker gets `query_architecture` tool | Thinker is `sequentialthinking` + `end_turn` only | Domain context passed via message history |
| 5 | "Localized daemon" infrastructure | No daemon exists; everything is in-process CLI/SDK | In-process indexing on demand + post-write + `/graph refresh` |
| 6 | "Read-only MCP tools" | Repo pattern is native guarded handlers (FID-2026-0804-004 deliberately NOT an MCP server route) | Native read-only tools with adapter guardrails |
| 7 | Bespoke HTML visualization | `/export` design system exists (logo, FA offline, Neon Slate) | New `/graph-export` reuses `/export` branding exactly |

The Law 4 "absolute proof" claim was also scoped honestly: deterministic CTE
reachability proves reachability **over the indexed snapshot**, bounded by
index freshness and parser-query coverage — a major upgrade over grep, not an
absolute. This is documented in the FID.

---

## GREEN Phase — Converged Plan

- **Phase 1 — Deterministic engine:** NEW `packages/knowledge-graph`; schema
  `files`/`nodes`/`edges` (+`cluster_id`) with cascading FKs, WAL; `FileHasher`
  interface (sha256 default, XXH3 swappable); incremental hash-diff + prune;
  recursive CTEs with `instr()` cycle detection + depth cap ≤ 50.
- **Phase 2 — Algorithmic augmentation:** `graphology` +
  `graphology-communities-louvain`; deterministic weights (CALLS 2.0 /
  IMPORTS 1.0 / cross-dir penalty); resolution scaled by node count.
- **Phase 3 — ECHO tooling + ambient labeling:** native guarded tools
  (`query_blast_radius`, `query_domain_clusters`, `query_node_edges`) for
  Detective/Scout; harness `verify_call_reachability` → Verifier message
  history; optional non-blocking `semantic_update` aggregated by Scribe
  (zero LLM cost).
- **Phase 4 — `/graph-export`:** new command registered via `defineCommandWithArgs`
  (following the current `/export` registration in `cli/src/commands/defs/core.ts`);
  single-file offline HTML **using the exact `/export` design system**
  (`LOGO_DATA_URI`, `FONT_AWESOME_ALL_CSS`, Neon Slate tokens, corner marks,
  meta grid, monospace, footer) with Cytoscape.js inlined.

---

## Missed Questions

The 12 missed questions and their answers are folded into the FID's
Perfection Loop section. Highlights:

1. **New MCP server?** No — native guarded handlers per FID-2026-0804-004.
2. **Verifier gets a tool?** No — message-history injection preserves the
   zero-tool contract.
3. **Daemon?** No — in-process indexing.
4. **Hash choice?** sha256 behind `FileHasher`; XXH3 only if profiled.
5. **Languages?** code-map's existing 11 languages; no new parser.
6. **"Absolute proof"?** No — deterministic over the indexed snapshot.

---

## Next Steps

1. Review FID-2026-0806-002 (`dev/fids/`) and approve the design direction.
2. Per-phase implementation FIDs (each with its own RED/GREEN/AUDIT evidence).
3. Phase 1 engine first: schema + extraction + incremental diff + recursive
   CTE tests.

---

*Reply written 2026-08-06 by Savant. Response to Nova feature-request-v2.*
