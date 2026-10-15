# Response: ELK Layout Engine for Graph Export (Feature Request)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-graph-export-elk-layout-feature-request.md`
**Status:** Deferred with trigger — idea retrofitted, engine not ported

---

## Decision

**We are not switching the export to `elkjs` now.** The *idea* — clean,
layered, non-overlapping layout at scale — is real and worth having; the
*engine* is not the right fit for a self-contained offline single-file export.

| ELK request item | Verdict | Rationale |
|---|---|---|
| Layered, non-overlapping layout at scale | **Adopted (retrofitted)** | Cluster-seeded starting positions + `randomize: false` + boosted repulsion/component-spacing in Cytoscape COSE — zero new deps |
| `elkjs` WASM in the export | **Rejected now** | Not vendored in the repo; embedding WASM (or a Web Worker) into a `file://` single-file HTML is hostile territory and grows the already 3.8–4.4 MB files |
| Server-side ELK precompute (Option C) | **Deferred with trigger** | Only ELK variant that fits the single-file constraint, but adds a Bun-side WASM dep + export-time layout cost for a payoff not yet proven needed |
| React Flow + ELK rewrite (Option B) | **Rejected** | Full template rewrite; contradicts FID-2026-0806-006's stack decision (keep Cytoscape, offline, already bundled) |

**Revisit trigger:** if the cluster-seeded COSE still overlaps on the real
6,916-node export after this fix, reopen and evaluate Option C (server-side ELK
positions embedded as a Cytoscape `preset` layout).

## Implemented

- `cli/src/commands/graph-export/template.ts` — deferred Cytoscape init,
  cluster-seeded spread, zoom-to-fit on load, viewport-fixed sidebar
- FID: `dev/fids/FID-2026-0806-016-v0.0.21-post-audit-fix-batch.md`
