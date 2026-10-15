# Knowledge Graph ECHO Integration Closeout — 2026-08-06

**FID:** FID-2026-0806-002  \
**Author:** Savant  \
**Status:** Closed and archived  \
**Mode:** Automation level 3 (autonomous end-to-end)

## Summary

Implemented the codebase knowledge graph feature end-to-end at automation
level 3, exactly per the converged FID design: deterministic incremental
SQLite-backed graph engine, algorithmically augmented with deterministic
Louvain clustering, exposed through native read-only agent tools plus
harness-injected reachability for the zero-tool Verifier/Thinker, and
presented through `/graph refresh` + `/graph-export` commands that reuse the
`/export` design system byte-for-byte.

## What shipped

### Phase 1 — Deterministic engine (`packages/knowledge-graph`)

- Schema: `files` / `nodes` / `edges` / `file_calls` with cascading FKs, WAL
  via `PRAGMA journal_mode = WAL`, schema-version tracking (mirrors
  `packages/database` conventions).
- sha256 `FileHasher` (matches `common/src/reddit-capi.ts` pattern),
  swappable behind the interface.
- Extractors: ignore-aware file enumeration, per-file parse via
  `packages/code-map` (tree-sitter), symbol nodes, and `IMPORTS` / `CALLS` /
  `EXTENDS` edges with deterministic weights (CALLS 2.0, IMPORTS 1.0,
  cross-directory penalty).
- Incremental update: hash-compare, cascade-prune stale subtrees, re-parse
  only mismatches; `--full` forces a rebuild.
- Recursive-CTE queries with `instr(path)` cycle detection + depth cap (≤ 50)
  for blast radius and reachability.
- **Windows path normalization** was the key integration fix: the file-tree
  enumerator returns backslash paths on Windows while every resolver and the
  query API speak forward slashes. Normalizing stored paths to forward
  slashes fixed zero-edge indexing and zero-symbol queries on Windows.

### Phase 2 — Deterministic clustering

- Upgraded `graphology-communities-louvain` 0.2.0 → 2.0.2: the 0.2.0 line is
  incompatible with modern graphology (calls the removed `pgraph.undirected`
  internal API). 2.x ships native `resolution` + injectable seeded RNG,
  giving true cross-run determinism (verified: `{"1":0,"2":0,"3":1,"4":1}`
  stable across runs).
- Removed the obsolete `.d.ts` shim; 2.0.2 ships real types.

### Phase 3 — ECHO tooling

- Native read-only tools `query_blast_radius`, `query_node_edges`,
  `query_domain_clusters` registered through `common/src/tools/{constants,
  safety-registry,params/tool/graph,list}.ts` and agent-runtime handlers
  (adapter-enforced row caps + 30s timeouts mirroring the database tools).
- Detective + Scout gained the three tools; `bundled-agents.generated.ts`
  regenerated; toolNames-validation integration test green.
- Verifier/Thinker: harness-executed graph evidence
  (`packages/agent-runtime/src/util/graph-injection.ts`) injected into child
  message history at spawn — zero-tool contracts unchanged (45 spawn tests
  green).

### Phase 4 — `/graph-export` + `/graph refresh`

- `handleGraphExportCommand` / `handleGraphRefreshCommand` registered in
  `defs/core.ts` and listed in `data/slash-commands.ts` (alias parity with the
  registry enforced by the gating test).
- `/graph refresh` — incremental reindex with stats; `--full` / `-f` forces a
  rebuild.
- `/graph-export` — branded, fully-offline interactive HTML: reuses
  `LOGO_DATA_URI`, `FONT_AWESOME_ALL_CSS`, Neon Slate tokens, corner marks,
  meta grid, footer exactly; Cytoscape.js 3.30.2 (MIT) inlined via
  `cli/scripts/generate-cytoscape.ts`; canvas supports fuzzy search, cluster
  color-coding, and Ctrl+click shortest path. `<`/`\u2028`/`\u2029` escaped in
  the serialized graph JSON.
- Generated-file gate handling: `cli/src/constants/cytoscape.ts` (single
  373 KB template literal) added to `.prettierignore` + eslint config, the
  same category treatment as export HTMLs.

### Docs & hygiene

- `docs/knowledge-graph.md` (new), `docs/features.md`, `docs/index.md`,
  `ARCHITECTURE.md` (roster + helper-library table), `AGENTS.md`, `README.md`.
- `.gitignore` + `.savantignore`: `.savant/` excluded (regenerable index,
  never committed).
- Root `typecheck` / `test` scripts and `protocol.config.yaml` extended to
  the 10-workspace set.
- Version unified to **0.0.23** across all 12 workspaces + `VERSION` +
  `protocol.config.yaml` + README badge; CHANGELOG v0.0.23 entry written.

## Verification

- `packages/knowledge-graph` — 12/12 engine tests, typecheck exit 0.
- `cli` — full suite **2834 pass / 0 fail** (7 new graph-command tests;
  router/registry gating and agent-toolnames validation green).
- `packages/agent-runtime` — 673 pass / 0 fail. The 2 failures noted below
  (`echo-compliance-wiring` law1 receipt, `main-prompt` write_file) were
  verified pre-existing at FID close (they fail identically on the base tree)
  and were subsequently root-caused and fixed in a follow-up session: the
  EHEL Law 1 pre-write gate unconditionally blocked writes to unread paths —
  including new files — short-circuiting the tracker's advisory receipt. The
  gate now exempts new files and is inert in hybrid mode (tracker owns the
  advisory); strict mode still blocks unread existing files. Regression
  tests: `src/echo/__tests__/pre-write-gates.test.ts` (6 tests).
- `common` / `agents` — typecheck exit 0.
- ESLint `--max-warnings 0`, `bunx prettier --check .`, `bun run lint:md`.

## Session notes

- Numerous spawn_agents JSON-escaping failures with heredocs on Windows —
  switched to `write_file` for probes and simple commands for verification.
- Cytoscape minified payload contains legacy octal regex escapes (`\1`, `\2`)
  which TypeScript rejects inside template literals — the generator now
  escapes backslashes first.
- The `/graph refresh` two-word command resolves via the `graph` alias (the
  router parses the first word as the command and the rest as args).
