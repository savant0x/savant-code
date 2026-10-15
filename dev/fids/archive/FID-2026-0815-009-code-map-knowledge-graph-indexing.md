<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: code-map / knowledge-graph indexing speed

**Filename:** `FID-2026-0815-009-code-map-knowledge-graph-indexing.md`
**ID:** FID-2026-0815-009
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — parallelizes existing sequential I/O/parse and
dedups a sort; no new store, no new authority (Law 13). Determinism is preserved
by order-independent Map collection.

**Parent:** FID-2026-0815-002 (finding F-12)

---

## Summary

Both indexing engines are fully **sequential** today: file reads and tree-sitter
parses run one-at-a-time, leaving I/O latency and multi-core CPU on the table
during `/graph refresh` and code-map scoring. Two secondary costs: a redundant
per-call sort in symbol resolution, and a double hash of unchanged-vs-changed
files in the graph updater.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | `getFileTokenScores` iterates files sequentially, awaiting `getLanguageConfig` + tree-sitter parse per file — single-threaded I/O + CPU. | `packages/code-map/src/parse.ts` — `getFileTokenScores`: `for (const filePath of filePaths) { ... await getLanguageConfig(...); await parseTokensForScoring(...) }` |
| E-02 | med | `updateKnowledgeGraph` reads sources (`stat` + `readFile`) and re-parses changed files one-at-a-time in a single loop. | `packages/knowledge-graph/src/update.ts` — `readSource` awaited per file in `for (const filePath of filePaths)`, then `await parseFile(...)` per changed file |
| E-03 | low | `resolveSymbolDefiningFile` sorts the candidate list (`[...candidates].sort(...)`) on every call — repeated O(k log k) for each ambiguous symbol across every call site. | `packages/knowledge-graph/src/extract.ts` — `resolveSymbolDefiningFile`: `return [...candidates].sort((a,b) => a.length - b.length \|\| ...)[0]` |
| E-04 | low | `updateKnowledgeGraph` hashes each file twice (once in the scan loop for skip-detection, again in the upsert loop). | `packages/knowledge-graph/src/update.ts` — `hasher.hash(source)` at scan (`stats.filesUnchanged++` branch) and again in the upsert loop (`hasher.hash(source)`) |

## GREEN — Proposed fix (converged)

1. **E-01/E-02 (parallel I/O + parse):** introduce a small bounded-concurrency
   helper (fixed pool, e.g. 4–8) and run file reads + parses through it,
   collecting results into `Map`s keyed by path. Determinism is preserved
   because collection is order-independent and downstream assembly iterates the
   existing ordered `filePaths` / `fileRows`. Respect the existing
   `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` caps by pre-selecting the
   deterministic candidate set (first N by path order, capped by bytes) before
   fan-out, so cap enforcement stays identical.
2. **E-03:** pre-sort each symbol's candidate list once when building the
   `dbSymbolIndex` (sort by length, then lexicographic), so
   `resolveSymbolDefiningFile` becomes an O(1) pick of the first element.
3. **E-04:** store the computed hash in the scan loop (`Map<path, hash>`) and
   reuse it in the upsert loop instead of re-hashing.

**Net:** indexing wall-clock drops toward `ceil(files/concurrency) × per-file
cost` for the I/O-bound and parse-bound portions; no change to the produced
index (same symbols, edges, clusters, determinism).

## Perfection Loop

### Loop 1 — RED

E-01…E-04 cataloged with `file:line` evidence. **Exit: all issues cataloged.**

### Loop 1 — AUDIT (planning)

- **Determinism invariant (Law 13 / FID-2026-0806-002):** the indexer is
  specified as deterministic. Parallel fan-out collects into path-keyed `Map`s
  and downstream assembly iterates the pre-existing ordered structures, so
  output is byte-identical to the sequential run. A determinism regression test
  (run twice, compare `IndexStats` + sorted node/edge rows) is added.
- **Cap preservation:** `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` are applied
  to the deterministic pre-selected candidate set before fan-out, so the cap
  boundary is identical to today.
- **Law 4:** `resolveSymbolDefiningFile` callers are `extract.ts`
  (`buildAllEdges`, CALLS + EXTENDS loops) — the pre-sort changes only the
  lookup, not the resolved result. `hasher.hash` reuse is internal.
- **Verification plan:** `bun run --cwd=packages/code-map typecheck`,
  `bun run --cwd=packages/knowledge-graph typecheck`; code-map + knowledge-graph
  test suites (including the existing determinism/fixture tests); ESLint
  `--max-warnings 0`; Prettier.
- **AUDIT passes (planning) → SELF-CORRECT (none) → COMPLETE (pending operator
  approval to implement).**

### Missed Questions

1. **Does parallelism change the index output?** No — collection is
   order-independent and assembly iterates ordered structures; the determinism
   test enforces it.
2. **How large a pool?** A bounded pool (4–8) is a tunable; too high risks
   fd/CPU contention, too low loses the win. Chosen during implementation with
   a quick benchmark on this repo, recorded in the FID.
3. **Is the Louvain pass affected?** No — clustering runs after assembly on the
   unchanged edge set.

## Resolution

Implemented 2026-08-15 (operator approved).

- **E-01:** `getFileTokenScores` fans the per-file pipeline (language-config
  lookup + read + parse) out over a bounded pool (concurrency 6), then applies
  the `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` caps in an ordered walk —
  reproducing the prior sequential skip/break semantics exactly (scores are
  byte-identical).
- **E-02/E-04:** `updateKnowledgeGraph` parallelizes the source reads (and the
  changed-file parses) over the same bounded pool; the scan-loop hash is stored
  in `hashByPath` and reused in the upsert loop (no double hash). `sources` /
  `hashByPath` / `parsedFiles` are lookup-only Maps, so parallel insertion order
  cannot affect determinism.
- **E-03:** each symbol's candidate list is pre-sorted once when
  `dbSymbolIndex` is built; `resolveSymbolDefiningFile` is now an O(1) `[0]` pick.
- **Determinism regression:** `update.test.ts` runs two full rebuilds and
  asserts identical IndexStats + semantic node/edge rows (joined on `files.path`;
  `files.id` is AUTOINCREMENT so raw rowids legitimately shift across rebuilds).

Verification: code-map + knowledge-graph typecheck exit 0; code-map 51/0;
knowledge-graph 19/0 (incl. the new determinism test); ESLint `--max-warnings 0`
on all changed files.
