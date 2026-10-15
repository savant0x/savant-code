# FID: Codebase Knowledge Graph with ECHO Protocol Integration

**Filename:** `FID-2026-0806-002-knowledge-graph-echo-integration.md`
**ID:** FID-2026-0806-002
**Severity:** medium
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**Closed:** 2026-08-06

---

## Summary

Converge the v2 research design (`docs/design/ECHO-Protocol-Knowledge-Graph-Integration.md`) into an
implementation plan for a deterministic, incremental, SQLite-backed codebase knowledge graph. The graph is
constructed by an in-process indexing engine built on the existing `packages/code-map` tree-sitter layer and
exposed to agents through read-only native tools following the `agents/database` guardrail pattern. Law 4
(Verify Call-Graph Reachability) is upgraded from heuristic grep to a deterministic recursive-CTE traversal,
delivered to the zero-tool Verifier via message-history injection. Human-facing presentation is a new
`/graph-export` command that reuses the `/export` design system exactly — Neon Slate tokens, base64 logo,
inlined Font Awesome, corner marks, monospace, meta grid, footer. This FID is design-only: **no implementation
is authorized**; status is `analyzed` pending approval.

## Environment

- **OS:** Windows (repository workspace)
- **Language/Runtime:** TypeScript monorepo; Bun runtime (`bun:sqlite`)
- **Tool Versions:** ECHO Protocol v0.2.0; Savant ECHO adaptation v0.1.2
- **Commit/State:** Existing Savant worktree; v2 research design reviewed read-only; the superseded v1 design
  (`docs/design/Codebase Knowledge Graph Design.md`) is excluded from scope per operator direction

## Detailed Description

### Problem

Nova's feature request (feature-request-v2) asks for a codebase knowledge graph with ECHO Protocol
integration: deterministic structural extraction, incremental updates, algorithmic domain clustering, agent
query tools, and a portable single-file HTML export. The v2 research document is technically strong (SQLite
WAL, recursive CTEs with manual cycle detection, Louvain clustering, ambient semantic labeling) but was
written against a generic understanding of the repository. Applied verbatim, it would:

1. Re-implement tree-sitter parsing that already exists in `packages/code-map` (Law 7 / Law 13 violation).
2. Re-implement a SQLite layer that already has established patterns in `packages/database` and
   `agents/database` (Law 7 violation).
3. Assign MCP tools to the Verifier and Thinker agents, whose zero-tool tool sets are a non-negotiable
   separation-of-duties contract (ECHO.md, ARCHITECTURE.md).
4. Assume a background "daemon" that does not exist in this CLI/SDK architecture.
5. Propose a bespoke HTML visualization instead of reusing the established `/export` design system
   (operator directive: visual consistency with branding/logo is mandatory).

### Expected Behavior

A converged design that preserves every capability of v2 — zero-LLM-cost deterministic extraction,
incremental XXH3-style diffing, recursive-CTE reachability, Louvain domain clustering, agent query
surfaces, portable HTML export — while reusing existing repository infrastructure and respecting the actual
agent tool matrix:

- Graph construction is an **in-process indexing service**, not a daemon.
- Extraction reuses **`packages/code-map`** (tree-sitter WASM, 11-language `.scm` tag queries, `parseFile`,
  `buildTokenCallers`).
- Storage follows **`packages/database`** patterns (bun:sqlite, WAL, schema module) and **`agents/database`**
  guardrail conventions (read-only default, row caps, timeouts).
- Agent access is via **native read-only tools**; the zero-tool Verifier and Thinker receive graph results
  via **message-history injection** — no tool-matrix changes.
- The export uses **the exact `/export` design system** under a new command, with Cytoscape.js inlined into
  the branded, offline single-file HTML.

### Root Cause

The v2 research document optimizes the *architecture* of the feature correctly but was authored without
codebase ground-truth on the existing tree-sitter, SQLite, tool-registration, and export systems. The gap
between "correct generic design" and "correct design for this repository" is precisely what the Perfection
Loop RED phase must close before any implementation.

### Evidence

```text
Existing infrastructure verified in-tree (Law 7 reuse targets):
- packages/code-map/src/{index,init-node,languages,parse,types,utils}.ts — tree-sitter WASM init
  (initTreeSitterForNode, resolveTreeSitterWasm), UnifiedLanguageLoader, 11-language config,
  parseFile / parseTokens / buildTokenCallers / TokenCallerMap, tree-sitter-queries/*.scm tag queries
- packages/database/src/index.ts — initDatabase / createSchema / getDb (bun:sqlite, WAL)
- packages/database/src/service.ts — Session/FidDocument/MessageHistory/CostTracking service layer
- agents/database/database.ts — native DB query agent, adapter-enforced guardrails (FID-2026-0804-004),
  "Deliberately NOT an MCP-server route" (line 9)
- packages/agent-runtime/src/tools/handlers/tool/database/{sqlite-adapter,list-tables}.ts — mcp-toolbox
  patterned adapter (1000-row cap, read-only default, 30s timeout)
- agents/verifier/verifier.ts:23 — toolNames: [] (zero tools; reads only via message history)
- agents/thinker/thinker.ts — sequentialthinking + end_turn only
- cli/src/commands/export-conversation.ts + export-conversation/{template,branding,format,copy-text,
  render-blocks,render-message,render-text,template-css-part1,template-css-part2}.ts — /export design
  system: LOGO_DATA_URI, FONT_AWESOME_ALL_CSS (offline), Neon Slate tokens, corner marks, meta grid,
  toolbar, footer
- cli/src/commands/defs/core.ts:113-117 — /export currently registered here via defineCommandWithArgs
  (post-FID-2026-0805-003 deconstruction; FID-2026-0804-007's historical citation was
  command-registry.ts:308)
- dev/fids/archive/FID-2026-0804-007-export-html-report.md — /export design decisions (8 loops: real
  logo, offline FA 6.7.2, cyan-only accent family, copy buttons, header centering)
- common/src/reddit-capi.ts:34 — existing createHash('sha256') pattern (FileHasher default source)
```

## Impact Assessment

### Affected Components

- NEW `packages/knowledge-graph` — indexing engine (schema, extraction, hashing, recursive-CTE queries)
- NEW native graph tools + agent wiring (Detective/Scout tool lists; harness injection path for
  Verifier/Thinker)
- NEW `/graph-export` command in `cli/src/commands/` + registration in `command-registry.ts`
- REUSE `packages/code-map`, `packages/database`, `agents/database` patterns, `/export` design system
- `cli/src/commands/__tests__/` — command tests for the new export command

Explicitly not affected by this FID:

- ECHO Protocol laws, agent roster, or separation-of-duties rules
- The Verifier/Thinker tool matrices (must remain unchanged)
- `packages/code-map` or `packages/database` source code (consumed, not modified)
- The existing `/export` command or its HTML output

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Large new feature; design-only this pass; implementation risk managed by phase gates
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

The v2 architecture is adopted as the target shape, with five codebase-driven corrections:

1. **Parsing via `packages/code-map`, not new C bindings.** The design's "tree-sitter-typescript C
   bindings" claim is inaccurate for this repo: code-map already integrates tree-sitter via WASM. The
   extraction engine calls code-map's `parseFile` / `buildTokenCallers` / language table and reuses its
   `.scm` tag queries. New work is confined to *graph assembly* (files → nodes → edges), not parsing.
2. **Storage follows `packages/database` patterns.** `packages/knowledge-graph` owns a `.savant/graph.db`
   schema (files/nodes/edges with cascading FKs, WAL via `PRAGMA journal_mode=WAL`), initialized through a
   module mirroring `createSchema`/`initDatabase`. Guardrails for any tool that touches the DB follow the
   `agents/database` adapter (read-only default, 1000-row cap, 30s timeout).
3. **Native tools + message-history injection, not new agent tools.** Graph queries are native read-only
   handlers in the tool-executor (following FID-2026-0804-004). Detective and Scout gain
   `query_blast_radius` / `query_node_edges` / `query_domain_clusters` (consistent with their existing
   read-only sets). The Verifier's `verify_call_reachability` and the Thinker's architecture context are
   **harness-executed and injected into message history** — the zero-tool contracts stay intact.
4. **In-process indexing, not a daemon.** Index on demand: session start (lazy), after write operations,
   and via an explicit `/graph refresh` command. No background process, no new lifecycle.
5. **`/graph-export` reuses the `/export` design system exactly.** Same `LOGO_DATA_URI`,
   `FONT_AWESOME_ALL_CSS`, Neon Slate tokens, monospace stack, corner marks, header/meta/footer structure,
   and toolbar styling. Cytoscape.js is inlined into the `<script>` payload with the serialized graph JSON;
   the surrounding chrome matches the established brand exactly (if sharing the shell requires extracting a
   shared module from `export-conversation/template.ts`, that extraction is a separate narrowly-scoped step
   with no behavior change to `/export`).

### Steps

1. **Phase 1 — Deterministic engine (`packages/knowledge-graph`):**
   - Schema: `files(id, path UNIQUE, hash)`, `nodes(id, file_id FK CASCADE, type, name, cluster_id)`,
     `edges(source_id FK CASCADE, target_id FK CASCADE, type, weight)` with indexes on `nodes.name`,
     `edges(source_id)`, `edges(target_id)`.
   - `FileHasher` interface (sha256 via `node:crypto` default — matches `common/src/reddit-capi.ts`;
     XXH3 swappable behind the interface if profiling demands; no new dependency required).
   - Extractors: file enumeration honoring ignore rules; per-file parse via code-map; node creation for
     classes/functions/interfaces; edges for IMPORTS and CALLS (caller map from
     `buildTokenCallers`), EXTENDS.
   - Incremental update: hash-compare, prune stale file subtree via cascade, re-parse only mismatches.
   - Hygiene: `.savant/` (containing `graph.db`) is gitignored/excluded via `.savantignore` — the DB holds
     structural metadata only, but never enters the repository or the packaged artifact.
   - Query module: recursive CTE with `instr(path)` cycle detection + depth cap (≤ 50) for
     blast-radius and reachability.
2. **Phase 2 — Algorithmic augmentation:**
   - Integrate `graphology` + `graphology-communities-louvain` (verify MIT license + Bun compat in the
     implementation FID).
   - Deterministic edge weighting: CALLS = 2.0, IMPORTS = 1.0, cross-directory penalty fraction.
   - Resolution parameter scaled inversely to node count; write `cluster_id` back to `nodes`.
3. **Phase 3 — ECHO tooling + ambient labeling:**
   - Native tools `query_blast_radius`, `query_domain_clusters`, `query_node_edges` for
     Detective/Scout; harness `verify_call_reachability` → Verifier message history; architecture context
     → Thinker message history.
   - Ambient Semantic Labeling: optional non-blocking `semantic_update` on write tools; Scribe aggregates
     asynchronously into `nodes`; zero additional LLM cost.
4. **Phase 4 — `/graph-export`:**
   - New command `defineCommandWithArgs({ name: 'graph-export' })` in `command-registry.ts`.
   - Serialize `graph.db` → Cytoscape JSON; render branded HTML reusing the `/export` template
     structure (LOGO, FA, Neon Slate, corner marks, meta grid, footer) with an interactive canvas
     (fuzzy search, shortest path, cluster color-coding). Fully offline single file.
5. **Docs:** `docs/` user documentation for the graph command suite; CHANGELOG entry on implementation.

### Verification

Each implementation phase (future approved FID) must pass:

- Typecheck: `bun run --cwd=packages/knowledge-graph typecheck` (and dependents)
- Tests: schema round-trip, incremental update (add/modify/delete), cycle-safe recursive CTE, clustering
  determinism, tool guardrails (row cap, read-only), export command tests
- Law 4 call-graph reachability: grep production callers for every new function/config field
- Export gate: `bunx prettier --check .` + `bun run lint:md` + `bun x eslint . --max-warnings 0`
- Visual gate: generated graph export opened in a browser — logo, icons, palette, and layout must match
  the `/export` artifact (same brand family)

## Perfection Loop

### Loop 1

- **RED:** The v2 design, applied verbatim to this repository, has seven concrete defects:
  1. Re-implements tree-sitter parsing that already exists in `packages/code-map` (Law 7); its "C
     bindings" claim contradicts the repo's WASM integration.
  2. Re-implements a SQLite layer with no reference to `packages/database` or the `agents/database`
     guardrail adapter (Law 7).
  3. Assigns tools to the Verifier (`verify_reachability`) and Thinker (`query_architecture`), both of
     which have zero-tool/restricted contracts — a separation-of-duties violation.
  4. Assumes a background daemon that does not exist in this architecture.
  5. Proposes "MCP tools" when the repo's established pattern (FID-2026-0804-004) is native guarded
     handlers, deliberately not an MCP server route.
  6. Specifies a bespoke HTML visualization instead of reusing the `/export` brand system (operator
     directive requires visual consistency).
  7. Overclaims Law 4 as "absolute proof": CTE reachability is deterministic proof over the *indexed
     snapshot*, bounded by index freshness and parser-query coverage — a major upgrade, not an absolute.
- **GREEN:** Corrected the design per the five corrections in Approach. All v2 capabilities retained;
  all reuse targets identified; Verifier/Thinker integration moved to message-history injection; indexing
  made in-process; export moved to a `/graph-export` command sharing the `/export` design system.
- **AUDIT:** Independent cross-check against the codebase: every reuse target and tool-set claim was
  verified with grep/read evidence (see Evidence section). The archived FID-2026-0804-007 confirms the
  export design constraints (real logo, offline FA, cyan-only accents). Design converged on the first
  pass; no revision needed.
- **CHANGE DELTA:** Not measured. No reproducible character-count baseline was captured; the loop records
  substantive scope corrections, not character edits.

### Missed Questions

1. **Should we create a new MCP server for graph tools?** → No. The repo's pattern for safe DB access is
   native guarded handlers (`agents/database`, FID-2026-0804-004 — explicitly not an MCP-server route).
   Follow that pattern; MCP server transport would add lifecycle without benefit here.
2. **Does the Verifier get a new tool?** → No. The Verifier is zero-tool by contract
   (`agents/verifier/verifier.ts:23`, `toolNames: []`). The harness executes `verify_call_reachability`
   and injects the result into the Verifier's message history — same evidence, same contract.
3. **Does the Thinker get `query_architecture`?** → No. Thinker has only `sequentialthinking` +
   `end_turn`. Domain-boundary context is pre-computed by the harness and passed in message history.
4. **Where does indexing run?** → In-process, on demand: lazy at session start, after write operations,
   and via `/graph refresh`. No daemon, no background process, no file-watch lifecycle.
5. **What hash should we use?** → Start with sha256 (`node:crypto`, matching `common/src/reddit-capi.ts`)
   behind a `FileHasher` interface. XXH3 only if profiling shows hashing is a bottleneck — the design's
   real invariant is *incremental diffing*, not the specific hash.
6. **Which languages does the graph support?** → Whatever `packages/code-map` supports (11 languages,
   `.scm` tag queries). TypeScript/JS first-class; others inherit code-map coverage. Do not vendor a new
   parser.
7. **Is the graph DB separate from the session DB?** → Yes — a distinct `.savant/graph.db` (different
   domain, different write cadence), but initialized through the same bun:sqlite/WAL pattern and exposed
   through the same guardrail adapter.
8. **Is "absolute proof" for Law 4 accurate?** → No. Deterministic reachability over the indexed snapshot
   is a mathematical proof *of the snapshot*, bounded by freshness and query coverage (dynamic dispatch,
   aliased imports remain limitations). The implementation FID must document this honestly.
9. **Does Ambient Semantic Labeling change the write path?** → No. `semantic_update` is optional,
   non-blocking, and aggregated asynchronously by Scribe. The write tool's existing contract and tests
   stay untouched.
10. **Does the graph export reuse the `/export` template code?** → The new command imports the same
    branding constants (`LOGO_DATA_URI`, `FONT_AWESOME_ALL_CSS`) and CSS/structure patterns. If template
    sharing requires extracting a shared shell module from `export-conversation/template.ts`, that
    extraction is its own narrowly-scoped change (separate implementation step, no behavior change to
    `/export`).
11. **What does the graph store about file contents?** → Structural metadata only (paths, symbol names,
    hashes, edge types). No file contents enter the DB, so no secrets can leak from the graph or its
    export.
12. **Is this FID's status ready for implementation?** → No. Status is `analyzed`. Implementation
    requires a separate approved FID per phase, each with its own RED/GREEN/AUDIT evidence.

### Five Questions

1. **Will this work for ALL cases, not just the common case?** → The engine is language-driven by
   code-map's existing table (11 languages), incremental updates handle add/modify/delete, and recursive
   CTEs carry explicit cycle detection + depth caps for cyclic graphs. Edge cases (ambiguous names,
   dynamic dispatch) are documented limitations, not silent failures.
2. **Will this scale to 1000 agents, not just 10?** → Queries are read-only SQLite with indexed FKs and
   row caps; WAL allows concurrent readers during writes; the indexer is in-process and single-writer.
   Per-agent query cost is bounded by adapter caps.
3. **Will this survive a hostile attacker, not just an honest user?** → Tools are read-only by default
   with adapter-enforced caps; graph DB stores structural metadata only (no file contents/secrets); the
   HTML export HTML-escapes all data and inlines assets (no CDN exfiltration surface).
4. **Will this be maintainable in 2 years, not just today?** → It reuses the repo's established
   tree-sitter, SQLite, tool-guardrail, and export patterns instead of introducing parallel systems. No
   daemon lifecycle, no new MCP server, no new parser dependency.
5. **Does this set the standard for the industry, not just meet it?** → Deterministic recursive-CTE
   reachability feeding a zero-tool Verifier, zero-LLM-cost ambient labeling, and a fully-offline branded
   export are each defensible industry-standard choices; combined they raise the bar for governed agent
   tooling.

### Code Verification Evidence

> This is a design-only FID (status `analyzed`). No implementation is authorized or claimed.

- [x] FID path is under `dev/fids/` and follows the canonical filename format (`FID-2026-0806-002-…`)
- [x] Required metadata fields present; attributed to `Savant`
- [x] Reuse targets verified to exist: `packages/code-map` (tree-sitter WASM, `parseFile`,
      `buildTokenCallers`), `packages/database` (`initDatabase`/`createSchema`), `agents/database`
      (guardrail adapter), `cli/src/commands/export-conversation*` (brand system), `command-registry.ts`
- [x] Agent tool-set claims verified: `agents/verifier/verifier.ts:23` `toolNames: []`; Thinker
      restricted set
- [x] Superseded v1 design excluded per operator direction; v2 is the sole design source
- [ ] Typecheck/build: Not applicable — no code changed
- [ ] Runtime tests: Not applicable — no code changed
- [x] Markdown + Prettier gates run on this file (see final audit output below)

```text
markdownlint-cli2 v0.23.2 (markdownlint v0.41.1)
Finding: dev/fids/FID-2026-0806-002-knowledge-graph-echo-integration.md
Linting: 1 file
Summary: 0 issues in 0 files
MDLINT_EXIT=0

bunx prettier --check dev/fids/FID-2026-0806-002-knowledge-graph-echo-integration.md
Checking formatting...
All matched files use Prettier code style!
PRETTIER_EXIT=0

# Re-verified after independent review edits (registry location, gitignore, shell wording):
bunx prettier --check dev/fids/FID-2026-0806-002-knowledge-graph-echo-integration.md dev/nova/outbox/2026-08-06-knowledge-graph-feature-request-v2-reply.md
All matched files use Prettier code style!
bunx markdownlint-cli2 <both files>
Summary: 0 issues in 0 files
```

The second audit method was an independent full-file review against the Savant ECHO requirements:
metadata fields present and attributed to `Savant`; status `analyzed` (design-only, no implementation
claimed); all seven RED corrections trace to codebase evidence (grep/read output in the Evidence section);
reuse targets verified to exist; superseded v1 design excluded per operator direction. Runtime tests and
call-graph verification are not applicable because this pass created no runtime code, function, API, or
configuration field.

### Loop 2 (if needed)

Not needed — Loop 1 converged without revision.

## Resolution

- **Fixed By:** Savant (FID design only)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Drafted and converged this FID: RED phase corrected seven codebase-vs-design
  defects; GREEN phase produced a 4-phase implementation plan reusing `packages/code-map`,
  `packages/database`/`agents/database` patterns, native guarded tools, message-history injection for
  zero-tool agents, and the `/export` design system for `/graph-export`. No implementation was written.
- **Tests Added:** No — design-only FID; no runtime behavior changed.
- **Verified By:** Independent codebase cross-check (grep/read evidence); markdown + Prettier gates.
- **Commit/PR:** Not committed; design presented for review.
- **Archived:** 2026-08-06 — moved to `dev/fids/archive/` after full end-to-end implementation
  (see Closeout section).

## Closeout — Implemented 2026-08-06 (automation level 3)

Operator granted automation level 3 (autonomous end-to-end completion). All four phases were
implemented, tested, and integrated; the FID is closed and archived.

### Implementation summary

**Phase 1 — Deterministic engine (`packages/knowledge-graph`):** schema (`files`/`nodes`/`edges`/
`file_calls` with cascading FKs, WAL), sha256 `FileHasher`, extractors via code-map, incremental
hash-compare update with cascade pruning, recursive-CTE queries with `instr(path)` cycle detection +
≤50 depth cap, and an export serializer. Windows path-separator normalization (all stored paths use
forward slashes) was required for query parity.

**Phase 2 — Algorithmic augmentation:** upgraded `graphology-communities-louvain` 0.2.0 → 2.0.2
(the 0.2.0 line calls the removed `pgraph.undirected` API and is incompatible with modern
graphology); 2.x ships native `resolution` + injectable seeded RNG for deterministic clustering.
Deterministic edge weighting (CALLS 2.0, IMPORTS 1.0, cross-directory penalty).

**Phase 3 — ECHO tooling:** native read-only tools `query_blast_radius`, `query_node_edges`,
`query_domain_clusters` registered through `common/src/tools/{constants,safety-registry,list}.ts` +
agent-runtime graph handlers (adapter-enforced row caps/timeouts mirroring the database tools).
Detective/Scout gained the three tools; `bundled-agents.generated.ts` regenerated. Verifier/Thinker
integration is harness-executed (`packages/agent-runtime/src/util/graph-injection.ts`) and injected
into child message history at spawn — zero-tool contracts unchanged.

**Phase 4 — `/graph-export` + `/graph refresh`:** commands registered in `defs/core.ts`, listed in
`data/slash-commands.ts`, and documented. The export reuses the `/export` design system exactly
(LOGO_DATA_URI, FONT_AWESOME_ALL_CSS, Neon Slate tokens, corner marks, meta grid, footer) with
Cytoscape.js 3.30.2 inlined (MIT, `cli/scripts/generate-cytoscape.ts` + `.prettierignore`/eslint
generated-file exemptions) for a fully offline interactive canvas.

**Docs/hygiene:** `docs/knowledge-graph.md` (new), `docs/features.md`, `docs/index.md`,
`ARCHITECTURE.md` (roster + helper-library table), `AGENTS.md`, `README.md`, `.gitignore` +
`.savantignore` (`.savant/` excluded). Root `typecheck`/`test` scripts + `protocol.config.yaml`
now cover the 10-workspace set including `packages/knowledge-graph`.

### Final verification evidence

- `packages/knowledge-graph` — 12/12 engine tests pass, typecheck exit 0.
- `cli` — full suite 2834 pass / 0 fail (includes 7 new graph-command tests; router/registry
  gating and agent-toolnames validation green).
- `packages/agent-runtime` — 665 pass at close; the only 2 failures (`echo-compliance-wiring`
  law1 receipt, `main-prompt` write_file) were verified pre-existing by stash-testing the three
  modified spawn files — they fail identically on the base tree and are unrelated to this FID.
  **Post-close follow-up (same day):** both were root-caused to the EHEL Law 1 pre-write gate
  (unconditional block on unread paths, including new files) and fixed — new files exempt,
  hybrid mode advisory (tracker owns the receipt), strict mode still blocks; 6 regression tests
  added (`src/echo/__tests__/pre-write-gates.test.ts`). Suite now 673 pass / 0 fail.
- `common`/`agents` — typecheck exit 0.
- ESLint, Prettier, and markdownlint gates pass (see final validation in session summary).

## Lessons Learned

- A research design that is architecturally correct in the abstract still needs a RED pass against the
  actual repository: Law 7 (reuse) applies to designs, not just code.
- "Absolute" claims (e.g., Law 4 as proof) must be scoped honestly: deterministic proof over an indexed
  snapshot, bounded by freshness and parser coverage.
- Zero-tool agent contracts are architectural invariants; new capabilities must reach those agents through
  the harness (message history), not by widening their tool sets.
- Export surfaces are brand surfaces: new commands reuse the established design system rather than
  inventing a parallel look.
