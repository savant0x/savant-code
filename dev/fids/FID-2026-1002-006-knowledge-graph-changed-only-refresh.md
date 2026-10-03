# FID: Incremental-import knowledge-graph refresh reads only changed files

**Filename:** `FID-2026-1002-006-knowledge-graph-changed-only-refresh.md`
**ID:** FID-2026-1002-006
**Severity:** medium
**Status:** verified
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Every `updateKnowledgeGraph` pass reads and retains the full corpus in
memory — sources, per-file hashes, and regex extraction inputs — regardless
of how many files changed. On this repository that is ~5,110 tracked files
/ ~28 MB per refresh, even for a clean tree. The fix: persist per-file
import/extend tokens at change time (mirroring the existing `file_calls`
pattern), derive IMPORTS/EXTENDS from persisted tokens plus DB path-shape
knowledge, and add an mtime+size pre-filter so unchanged files are not even
re-read between passes.

## Environment

- **OS:** Windows (audit session), Bun 1.3.14
- **Language/Runtime:** TypeScript strict monorepo
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October 2
  work; no commit authorized (G2)

## Detailed Description

### Problem

`update-scan.ts` reads every file under the 1 MB cap into `sources` and
hashes each one on every pass (`update-scan.ts:155-168`, over
`filePaths.length` with zero mtime pre-filtering). `update.ts:197-217` then
feeds ALL database file rows into `buildAllEdges`, consuming `sources` for
the IMPORTS/EXTENDS regex extraction for unchanged files too
(`extract.ts:151-156`). The CALLS layer already rebuilds from persisted
tokens for exactly this reason (the incremental-invariant comment at
`update.ts:158-162`); the IMPORTS/EXTENDS layers do not.

### Expected Behavior

An incremental refresh with zero changed files performs near-zero file IO:
no content reads (mtime+size pre-filter), no source materialization, and
edge derivation from persisted per-file tokens. First builds and changed
files behave exactly as today.

### Root Cause

The IMPORTS/EXTENDS derivation is regex-over-raw-source, which was acceptable
when the graph was a one-shot builder but contradicts the incremental
design now that refresh is a standing command (`/graph refresh`) and a
post-write hook.

### Evidence

Measured in the T113 audit: ~5,110 tracked files, ~28 MB corpus
(`git ls-files` + byte total). Source-confirmed in
`dev/session-summaries/2026-10-02-full-data-flow-audit.md` (O1).

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/update-scan.ts` (read path, stats shape)
- `packages/knowledge-graph/src/update.ts` (edge-derivation inputs)
- `packages/knowledge-graph/src/extract.ts` (token extraction from a
  single source — the per-file primitive)
- `packages/knowledge-graph/src/schema.ts` (new token table)
- CLI graph-refresh/export resilience unchanged (they consume `stats` and
  the DB, not scan internals)

### Risk Level

- [x] Medium: index-freshness semantics for the IMPORTS/EXTENDS layers
  change (token-based derivation must reproduce the regex-extraction
  results exactly); a wrong derivation silently degrades graph edges.

## Proposed Solution

### Approach

One source of truth for per-file structure: extend the `file_calls` pattern
to imports and extends. A changed file's import specifiers and
extends-parent names are extracted once at parse time and persisted; the
edge pass consumes only DB rows and the changed files' in-memory sources.

### Steps

1. **Schema:** add `file_imports(file_id, token)` +
   `file_extends(file_id, parent)` tables with the same
   PK/FK-cascade shape as `file_calls`; a lightweight backfill migrations
   block in `applyGraphSchema` (CREATE IF NOT EXISTS is naturally
   idempotent; legacy DBs get empty tables and one full rebuild backfills).
2. **Scan phase (`update-scan.ts`):**
   - Map files by path to their existing DB row (mtimeMs + size read via
     `fs.stat` during enumeration — no content read).
   - Read content only for files that are new/changed per the mtime+size
     pre-filter OR have no baseline row; unchanged-baseline files are not
     read. (Baseline = last indexed stat; store `mtimeMs` + `bytes` in
     `files`.) If the DB predates stat columns, treat every file as
     changed once (backfill) exactly like today's first pass.
   - Keep `sources` materialization limited to changed files; drop the
     all-files read.
   - Return `changes` = the set of files whose content was read (new or
     possibly-changed).
3. **Token persistence (in `update.ts`, inside the existing per-change
   transaction):** for each changed file, extract import specifiers +
   extends parents via the existing `extractRelativeImportSpecifiers` /
   `extractExtendsRelations` and upsert the token rows; unchanged files
   keep their existing token rows.
4. **Edge pass (`update.ts` step 5, replacing the `sources` consumption):**
   - IMPORTS: for each `file_imports` token, resolve the relative specifier
     against the current path set (`resolveRelativeImport` — unchanged
     semantics; resolution is against the CURRENT index state, not the
     snapshot at extraction time, so deleted/new targets re-resolve
     correctly).
   - EXTENDS: for each `file_extends` parent, resolve via the sorted
     symbol index (`resolveSymbolDefiningFile`).
   - CALLS: unchanged — rebuild from `file_calls`.
   - Cross-directory penalty: unchanged.
   The semantic result is identical to today's derivation (same extractors,
   same resolvers, same weights) — only the INPUT moves from in-memory
   regex-over-all-sources to persisted tokens.
5. **Determinism:** keep the ordered walk, pre-sorted symbol index, and
   deterministic edge-key iteration. Edge INSERT order derives from stable
   DB row iteration plus no-rehash; identical corpora produce identical
   edge sets.
6. **Backfill:** when `files` lacks stat columns or token tables are
   empty-but-files-exist, run one full pass (fullRebuild: true) inside the
   same update call — automatic, no CLI flag.
7. **Tests:**
   - Update `update.test.ts` unchanged-behavior tests (idempotence,
     determinism, clusterCount, blast-radius) — they must keep passing
     (semantic identity is the whole point).
   - New tests: (a) unchanged-second-pass performs zero content reads —
     assert via a `readSource` spy counter; (b) IMPORTS edges survive when
     the target file is deleted then re-added (token re-resolution);
     (c) EXTENDS edges persist across an unchanged-target incremental pass;
     (d) legacy DB (empty token tables) backfills correctly; (e) stat-based
     skip: a file rewritten with IDENTICAL content keeps its edges via
     persisted tokens (no parse needed).

### Verification

All existing update/queries suites pass unmodified;
new changed-only assertions pass; declared gates below.

> Contract rule (FID-2026-0918-006): new test artifacts name their paths
> and are covered by `- gate: test` entries below.

## Verification Gates

- gate: typecheck packages/knowledge-graph
- gate: test packages/knowledge-graph/src/__tests__/update.test.ts
- gate: test packages/knowledge-graph/src/__tests__/update-queries.test.ts
- gate: test packages/knowledge-graph/src/__tests__/schema.test.ts
- gate: test packages/knowledge-graph/src/__tests__/changed-only.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:02492e645fe614217df962d5ced9593b1dd90b2f458e422712b3f8dc4c579844
- verified: 2026-10-03T03:14:20.992Z
- typecheck packages/knowledge-graph: exit 0
- test packages/knowledge-graph/src/__tests__/update.test.ts: exit 0
- test packages/knowledge-graph/src/__tests__/update-queries.test.ts: exit 0
- test packages/knowledge-graph/src/__tests__/schema.test.ts: exit 0
- test packages/knowledge-graph/src/__tests__/changed-only.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

O1 evidence: full-corpus read+hash per pass, edge pass consumes all-sources
(`update-scan.ts:155-168`, `update.ts:197-217`, `extract.ts:151-156`),
~28 MB measured. CALLS-layer precedent proves the persisted-token pattern
is already trusted for this exact purpose (`update.ts:158-162`).

### GREEN

The import/extend token tables extend an existing, proven persistence
pattern (`file_calls`). The derivation contract is unchanged: same
extractors, same resolvers, same weights, same penalty, applied to the
same logical inputs (each file's structure) — only the delivery mechanism
for unchanged files moves from "re-read + re-regex everything" to
"persisted at last mutation".

### AUDIT

Resolution timing equivalence: today, an unchanged file's IMPORTS edges
re-resolve against the CURRENT path set on every pass (a target file added
or removed since the last pass changes the edges even without touching the
importer). Persisted tokens keep that property — resolution stays
against the current path set; only extraction is cached. The EXTENDS
resolution via the sorted symbol index matches today's
`resolveSymbolDefiningFile` flow exactly.

### Missed Questions

1. Could persisted tokens go stale relative to source (edit adds an import,
   hash check says unchanged)? No — any content edit changes the sha256
   hash, which re-reads and re-extracts; tokens are re-persisted on every
   content change.
2. Why not resolved-target persistence (store `file_id` instead of the
   raw token)? Target resolution must see the CURRENT path set (a target
   file added or removed since the last pass changes the edges even
   without touching the importer); storing the token and resolving each
   pass preserves today's freshness semantics exactly.
3. What about non-relative imports (bare specifiers, aliases like `@/`)?
   Today's extractor already only returns relative specifiers
   (`extract.ts:31-45`) and the resolver only handles relative paths; this
   FID does not change that intent — the persisted tokens are the same
   relative specifiers the regex pass would have found.
4. Should `sources` be dropped entirely from the return shape? No: changed
   files' sources are still needed (their extraction just produced the
   tokens), and edge derivation needs the changed files' tokens anyway.
   The return shape keeps `sources` but it now holds changed files only.
5. Is the mtime+size pre-filter sound? Windows/Postgres-style caveats: a
   same-size rewrite preserving mtime granularity would be missed by stat
   alone — but the sha256 hash comparison REMAINS the truth: the pre-filter
   only skips the READ, and any file whose stat matches the baseline is
   also verified against the stored hash (content changed but stat
   coincidentally identical is an accepted-sub-second-mtime risk, the
   same class the enforcement worktree baseline accepts
   `worktree-capture.ts` sizing conventions). Wait — the enforcement
   baseline hashes everything; this plan charts a different course: stat
   skip + persisted tokens + hash-as-truth-on-read. The residual risk is
   bounded to "a file whose stat is unchanged but content changed in
   place" — realistically parser-relevant edits always change size or
   mtime in practice; document the boundary honestly.

### Convergence

The persistence pattern is precedent-backed (`file_calls`), the derivation
contract is unchanged, and the freshness semantics are preserved. Ready for
implementation at level 3.

## Implementation Evidence

### Code Verification Evidence

Implementation decomposed under the 300-line quality ceiling across four
modules (all read 0-EOF, direct file edits):

- `packages/knowledge-graph/src/schema.ts` — `SCHEMA_VERSION = 2`; v2
  schema adds `files.mtime_ms` / `files.bytes` stat columns and the
  `file_imports(file_id, token)` / `file_extends(file_id, parent)` tables
  (same FK-cascade shape as `file_calls`); `applyGraphSchema` ALTERs the
  stat columns in place on v1 databases via the repo-standard
  `PRAGMA table_info` probe (`schema.ts:87-119`).
- `packages/knowledge-graph/src/index-path-plan.ts` (new) — the changed-set
  planner: bounded stat fan-out (`statAll`), the stat pre-filter
  (`canSkipRead` in `planChanges`), and the deterministic changed-set walk
  with per-file status counts.
- `packages/knowledge-graph/src/update-scan.ts` — reads ONLY planned
  targets (`update-scan.ts:169-176`); re-plans after the reads so the
  changed set derives from real content evidence; returns the live
  `statByPath`, `needsBackfill`, and the executed `wasFullRebuild` flag.
- `packages/knowledge-graph/src/edges-from-tokens.ts` (new) — the edge
  engine over persisted tokens (`buildEdgesFromTokens`): identical weights
  (2.0/1.0/1.0), penalty (0.5), resolvers, and self-edge rule as the
  previous `buildAllEdges` flow; IMPORTS resolve against the CURRENT path
  set via the lexical resolver (`resolveImportToken`), preserving the
  freshness semantics.
- `packages/knowledge-graph/src/update.ts` — forces one full pass when
  `needsStatBackfill` (legacy rows, `update.ts:63`); persists import/extend
  tokens inside the existing change transaction (`update.ts:186-193`); the
  edge pass consumes zero sources (`rebuildEdges`, `update.ts:221-260`).
- Reachability (Law 4): `updateKnowledgeGraph` remains the sole production
  entry (CLI `graph-refresh.ts`, `build-graph-export.ts`, evals fixture
  generator — call-graph unchanged); the new modules are its internals.
- Tests: `changed-only.test.ts` (new, 5 tests) — zero-read second pass via
  a counting fs seam; token-driven IMPORTS/EXTENDS survival across stat
  churn with identical content; token re-persistence on modification;
  legacy-null backfill restoring baselines + tokens. Pre-existing 19
  update/queries/schema tests pass unmodified (semantic identity).

### Step Status

- [x] Steps 1–2 (schema + scan) — implemented (`schema.ts`,
      `index-path-plan.ts`, `update-scan.ts`).
- [x] Steps 3–5 (tokens, token-driven edges, determinism) — implemented
      (`update.ts`, `edges-from-tokens.ts`).
- [x] Step 6 (backfill) — implemented (`needsStatBackfill` + forced full
      pass; regression-pinned in `changed-only.test.ts`).
- [x] Step 7 (tests) — implemented; all declared gates exit 0.

## Resolution

- **Fix Description:** graph refresh reads/holds only changed files; the
  IMPORTS/EXTENDS edge layers derive from persisted tokens; legacy v1
  databases backfill automatically on the next pass.
- **Tests Added:** Yes — `changed-only.test.ts` (5) + the pre-existing
  suites green unmodified.
- **Verification Evidence:** receipt stamped by the project verifier; all
  six declared gates exit 0.
- **Commit SHA:** pending — commit authority is operator-owned (G2); no
  commit made.
