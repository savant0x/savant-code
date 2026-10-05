# FID: Code Universe architecture evaluation — payload, render-time, and CI hardening

**Filename:** `FID-2026-0807-020-code-universe-architecture-evaluation.md`
**ID:** FID-2026-0807-020
**Severity:** medium
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant
**YAGNI-Compliance:** Pending

---

## Summary

A third-party architecture evaluation of the offline Code Universe graph export
(`docs/Code Universe Architecture Evaluation.md`) was reconciled against the
current codebase. The single-file, zero-network paradigm and the rejections of
multi-file output and a hosted Next.js pivot are **confirmed and adopted**.
Most of the evaluation's UI/UX and safety items are already implemented
(FIDs 007/008/012/014/019), and the evaluation's §6.4 proposal to reintroduce
default text caps is **rejected** because FID-2026-0807-019 converged on
unlimited text documents by default. This FID covers the remaining actionable
engineering backlog as one converged design:

1. **Payload purge** — drop the legacy `elements` array (~1.5 MB), fix the
   duplicated `<title>` string, and remove stale Cytoscape-era comments.
2. **Compression + lazy block loading** — gzip/Base64 documents with the native
   `DecompressionStream` API so the heavy document payload is deferred without
   re-introducing text caps (solves the 22.3 MB artifact).
3. **Render-time scale** — Graphology `forEachNode`/`forEachEdge` iteration,
   integer coordinate rounding, precomputed search index, and existing LOD /
   reduced-motion behavior retained and asserted.
4. **CI hardening** — deterministic double-export hash gate and a Playwright
   `file://` zero-network interactive suite.
5. **Deferred backlog** — `savant serve` local daemon for >10,000-file
   repositories (separate FID; design note recorded here).

## Environment

- **OS:** Windows 11 host
- **Language/Runtime:** TypeScript, Bun, generated self-contained HTML, Chrome
- **Tool Versions:** Repository-pinned Bun/OpenTUI/Sigma/Graphology stack
- **Commit/State:** Working tree contains implemented FID-2026-0807-019
  (unlimited text documents, explicit-cap messaging, responsive navigation,
  quieter watermark at opacity .06) and archived FIDs 007–016

## Detailed Description

### Problem

The generated artifact is **22,265,667 bytes** (measured after FID-019). A
third-party evaluation correctly identified that a large share of that payload
is dead weight or compressible:

1. The serialized payload still contains the legacy `elements` array — ground
   truth: `serializeGraphForExport` returns `elements` with **10,023 entries**
   while the Sigma runtime consumes only `universe`. No external tooling reads
   it; the SQLite DB is the authoritative structural source.
2. The `<title>` renders **"Savant Code Code Universe"** — the template
   concatenates `brandName` (`Savant Code`) with `" Code Universe"`.
3. The document watermark is an **868 KB base64 PNG** inlined in CSS
   (`CHARACTER_WATERMARK_DATA_URI`).
4. Text documents are unlimited by default (FID-019) and can dominate the
   payload on mid-sized repositories; the evaluation's proposed answer (default
   caps + head previews) contradicts the converged product decision.
5. `GraphExportElement`-shaped iteration uses `graph.nodes().filter(...)`
   allocations in the browser; coordinates are rounded to 1 decimal via
   `round1(...)` in `layout.ts` (int round is cheaper to parse and render).
6. The search index is rebuilt at runtime in `buildSearchIndex()` from
   `universe` data; a precomputed index removes main-thread work on load.
7. No automated interactive test exercises the `file://` artifact or asserts
   the zero-network invariant (Playwright is not present in any package).

### Expected Behavior

- Payload: no legacy `elements`; correct single-word title; watermark
  footprint below ~60 KB with no visual regression; text documents remain
  **full and unlimited by default**, but the heavy payload is gzip-compressed
  and lazily decoded so the graph paints before documents parse.
- Render-time: no per-frame array-allocating graph iteration; integer
  coordinates; a precomputed search index; labels/edges already hidden during
  camera motion and reduced-motion honored (asserted, not reworked).
- CI: a deterministic double-export SHA-256 gate and a Playwright `file://`
  suite that fails on any network request.
- Scale: >10,000-file repositories route to a future `savant serve` local
  daemon; the single-file artifact remains the default for everything below.

### Root Cause

The export accumulated features across many FIDs: Cytoscape-era serialization
shapes were retained for compatibility after the Sigma migration, the brand
name was concatenated into a title that already contains a product word, the
watermark shipped as the original raster asset, and runtime work (search index
build, full graph iteration, parse of an un-compressed JSON block) was never
moved into the CLI phase. FID-019 removed default text caps, which raised the
uncompressed document payload, making payload compression the correct lever
instead of re-introducing caps.

### Evidence

Ground truth measured 2026-08-07:

```text
dev/exports/graph/savant-graph.html
  bytes: 22,265,667
  <title>Savant Code Code Universe</title>

packages/knowledge-graph/src/export-serializer.ts
  GraphExport interface retains elements: GraphExportElement[]
  serializeGraphForExport() returns { generatedAt, meta, elements, universe }
  payload top-level keys: ['elements', 'generatedAt', 'meta', 'universe']
  elements entries in artifact: 10,023

cli/src/commands/graph-export/template.ts
  line ~113: <title>${escapeHtml(brandName)} Code Universe</title>
  uses graph.nodes().filter(...) for node iteration
  var searchIndex = []; buildSearchIndex() runs at load

cli/src/commands/graph-export/layout.ts
  positions rounded with round1(child.x) (1 decimal)

cli/src/commands/graph-export/character.ts
  CHARACTER_WATERMARK_DATA_URI — full character art (868 KB) base64 PNG

Already implemented (not re-scoped here):
  embedded Kenney CC0 audio + gesture unlock (FID-2026-0807-007)
  ranked kind-aware search + / and Ctrl/Cmd+K (FID-2026-0807-008)
  window controls, drag, minimize, staged Escape, focusable nav (012/014)
  \u003c/U+2028/U+2029 escaping + inert JSON parse (tested)
  unlimited text + explicit-cap messaging + binary probing (FID-2026-0807-019)
```

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/export-serializer.ts`
- `cli/src/commands/graph-export/template.ts`
- `cli/src/commands/graph-export/layout.ts`
- `cli/src/commands/graph-export/character.ts` (+ new SVG/WebP asset generation)
- `cli/src/commands/__tests__/graph-export.test.ts`
- New: `scripts/` or `evals/` Playwright suite + determinism gate
- Generated output under `dev/exports/graph/`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature degraded, workaround exists but conflicts with the
      intended full-document workflow
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

**A. Payload purge (low effort, ~1.5 MB +)**

1. Remove the `elements` array from the serialized `GraphExport` shape and from
   `serializeGraphForExport`'s return. `computeGraphLayout` already accepts the
   layout inputs directly (it reads `elements` for derivation only — keep the
   function signature but feed it an internal layout-only view, or switch it to
   consume `universe.files` + `universe.regions` + `containers`; chosen at
   implementation time to minimize churn). The `GraphExportElement` type may be
   deleted once `layout.ts` no longer needs it.
2. Fix the title to `${escapeHtml(brandName)} Universe` (drop the duplicated
   "Code") or normalize `brandName` before concatenation — assert
   `"Code Code"` never appears.
3. Delete stale Cytoscape-era comments/constants in graph-export source
   (verify `CYTO_JS` no longer exists — confirmed; sweep comments only).

**B. Compression + lazy block loading (high impact)**

1. Serializer emits the document map as a separate compressed block:
   `gzipSync(JSON.stringify(documents))` → base64 (Bun has `gzipSync`).
   Keep `universe` (regions/files/edges/folders) uncompressed (or gzip too if
   measurement favors it) so the graph bootstraps synchronously.
2. Embed blocks as inert `<script type="text/plain" id="savant-docs-payload">`
   (binary-safe base64; still escape `<`).
3. Browser decode path: `Uint8Array.fromBase64` → `DecompressionStream("gzip")`
   → `Response(stream).json()`.
4. Load order: parse universe + build Graphology/Sigma immediately; decode and
   parse documents in a microtask/`requestIdleCallback` after first paint;
   `renderDocument` awaits the docs promise.
5. Feature-detection ladder: if `DecompressionStream` or `fromBase64` is
   missing, fall back to an uncompressed inline block (serializer emits both
   when the compressed block is enabled, or the CLI conditionally emits the
   uncompressed variant) so the artifact never blank-screens on older browsers.
6. **No default text caps.** `documentPolicy` remains `null`-limit by default;
   explicit operator limits still work. The 22 MB artifact is solved by
   compression, not by re-introducing `HEAD PREVIEW` walls.

**C. Render-time scale**

1. Replace `graph.nodes()` / `graph.edges()` array allocations with
   `graph.forEachNode` / `graph.forEachEdge` in the hot paths (nav reveal,
   selection, search result routing). Assert no `graph.nodes().filter` remains.
2. Round coordinates to integers in `layout.ts` (`Math.round`) and in the
   serializer fallback paths; verify visually against the 1-decimal baseline in
   the browser probe.
3. Precompute the search index at export time (fold into the universe block or
   a small side block): emit `searchIndex` records (id/kind/label/path) from
   Bun; the browser builds no index at runtime, only filters the shipped array.
4. Keep and assert the existing Sigma config: `hideEdgesOnMove` /
   `hideLabelsOnMove` equivalents, label render-size threshold, 30 FPS starfield
   cap, and `prefers-reduced-motion` pause — the evaluation requested these;
   verify each exists or add the missing one.

**D. CI hardening**

1. Determinism gate: run the export twice on a stable fixture, normalize the
   volatile timestamp, `shasum -a 256` both files, fail on mismatch. Wire into
   an existing script (`scripts/` or a bun test that calls
   `buildGraphExportHtml` twice).
2. Playwright suite (new devDependency in `evals/` or `cli/`):
   `page.goto('file:///...')` with `page.route('**/*', route => route.abort())`
   globally; assert WebGL canvas init, wheel zoom, `/` search focus + results,
   and zero console errors. Mark network attempts as test failures.

**E. Deferred (design note, not built here)**

- `savant serve` local HTTP daemon streaming the SQLite DB for live analysis
  and >10,000-file repositories. Approved as the escape hatch; a separate FID
  owns the implementation.

### Steps

1. Update this FID through RED/GREEN/AUDIT/ADVERSARIAL (current pass).
2. Payload purge: drop `elements`, fix title, sweep comments.
3. Compression: serializer gzip/base64 blocks + template embed + browser decode
   with fallback ladder.
4. Render-time: forEachNode/forEachEdge, integer coords, precomputed index,
   verify LOD/reduced-motion contracts.
5. CI: determinism gate + Playwright `file://` zero-network suite.
6. Update focused tests, regenerate the artifact, run Chrome `file://` probe at
   desktop + narrow widths.
7. Independent review; archive FID + CHANGELOG entry.

### Verification

- `cd packages/knowledge-graph && bun run typecheck && bun test`
- `cd cli && bun run typecheck && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts`
- `bun x eslint <changed files> --max-warnings 0`; `bunx prettier --check .`;
  `bun run lint:md`
- Determinism: double export on a fixture → identical SHA-256 after timestamp
  normalization
- Playwright: `file://` suite green with all routes aborted
- Chrome probe: graph paints before documents parse; docs open full; watermark
  opacity unchanged; no console errors

## Perfection Loop

### Loop 1

- **RED:** Ground-truth audit confirmed the evaluation's dead-weight findings
  (elements 10,023 rows; duplicated title; 868 KB raster watermark), the
  render-time opportunities (node-array iteration, 1-decimal coords, runtime
  search index build), and the missing CI gates (no Playwright; no determinism
  test). The evaluation's §6.4 default caps were confirmed to contradict the
  converged FID-019 policy and were excluded from scope.
- **GREEN:** A single converged design: payload purge + gzip/DecompressionStream
  lazy loading (keeping text unlimited) + render-time refactors + CI gates;
  >10,000-file `savant serve` deferred to its own FID.
- **AUDIT:** All eight RED claims verified with file:line evidence (see Loop 2).
- **ADVERSARIAL:** Design converged with three adjustments (see Loop 2).

### Loop 2

- **RED:** Independent AUDIT re-verified every claim in the FID against current
  source — all PASS with citations: `elements` in payload
  (`export-serializer.ts:192`, `:956`; artifact contains 10,023 entries); title
  duplication (`template.ts:113`); `round1` 1-decimal coords
  (`layout.ts:477`); `graph.nodes().filter` (`template.ts:584`);
  `buildSearchIndex()` at load (`template.ts:239`, `:944`); reduced-motion +
  label-threshold contracts (`template.ts:215`, `:1737`); no Playwright in any
  package (NO-MATCH); `computeGraphLayout` callers
  (`layout.ts:220`, `template.ts:77`, `graph-export.test.ts:549`).
- **GREEN:** Design converged on the layout-view decision and fallback
  semantics: `GraphExportElement[]` remains an internal layout input built
  from `fileRows`/`edgeRows`/`containers`, but is never serialized into the
  artifact payload; `bun:zlib` `gzipSync` verified available for the documents
  block; browser decode uses `Uint8Array.fromBase64` + `DecompressionStream`
  with an uncompressed inline fallback; `renderDocument` awaits the docs-ready
  promise; Playwright lands in `evals/` only.
- **AUDIT:** PASS — see RED above; baseline gates all green (knowledge-graph
  typecheck + 17 tests, CLI typecheck + 34 graph-export tests, FID prettier +
  markdownlint).
- **ADVERSARIAL:** Three adjustments adopted:
  1. **Elements removal scope:** the array is removed from the *serialized
     payload* only; the internal layout view stays so ELK edge routing keeps
     its inputs — no layout re-derivation risk.
  2. **Compression fallback:** serializer emits *either* the compressed block
     *or* the uncompressed fallback (conditional, never both) so the 22 MB
     artifact is not double-stored; no `<` escaping needed for base64.
  3. **Coordinate rounding:** integers must pass the existing determinism
     gate (double export, normalized timestamp, SHA-256) and a visual diff
     against the 1-decimal baseline in the browser probe.
  Final adversarial verdict: **ADJUSTED / COMPLETE for analysis** — production
  behavior pending implementation and re-verification.

### Missed Questions

1. **Should the default text caps from the evaluation be adopted?** No.
   FID-2026-0807-019 explicitly removed default caps and their preview walls;
   the artifact-size problem is solved with compression instead.
2. **What happens on browsers without `DecompressionStream`/`fromBase64`?** The
   serializer keeps an uncompressed fallback block (or the CLI conditionally
   embeds one); the artifact must never blank-screen. No polyfill is shipped.
3. **Do we keep `GraphExportElement`?** No — once `layout.ts` consumes
   `universe` + `containers` directly, the type and the payload array are
   deleted together to avoid drift.
4. **Does integer rounding change visual output?** A 1-px coordinate rounding
   is below visual threshold for a 7,000-node WebGL canvas, but a browser probe
   must diff the layout (same camera) before/after as acceptance.
5. **Should the search index ship in the universe block or its own block?** Its
   own small block (or folded into universe) — whichever measures smaller after
   gzip; the runtime contract is "no index construction in the browser".
6. **Is Playwright a hard dependency of the CLI package?** No — it lives in
   `evals/` (or a dedicated scripts workspace) so the product packages stay
   lean; CI runs it.
7. **What about the evaluation's `savant serve`?** Approved as the scale
   escape-hatch and recorded here; implementation is a separate FID because it
   is a new subcommand with its own surface.
8. **Does dropping `elements` from the payload break the layout?** No —
   `computeGraphLayout` keeps receiving a layout-only view (same shape) built
   at export time from `fileRows`/`edgeRows`/`containers`; only the serialized
   payload drops the array.
9. **Should the fallback embed both compressed and uncompressed docs?** No —
   that would double the artifact; the serializer emits one or the other.
10. **Does the determinism gate survive integer coordinate rounding?** Yes —
    the gate is a double-export SHA-256 compare with timestamp normalization;
    `Math.round` is deterministic across runs, so the gate validates the
    rounding itself.

### Code Verification Evidence

> Perfection Loop evidence recorded 2026-08-07 (analysis phase — production
> implementation is intentionally not started).

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] All RED claims independently verified with file:line citations (Loop 2)
- [x] `bun:zlib` `gzipSync` availability verified in the knowledge-graph package
- [x] FID Prettier and markdownlint pass
- [x] Baseline gates green: knowledge-graph typecheck + 17/17 tests; CLI
      typecheck + 34/34 graph-export tests
- [x] Implementation matches the proposed solution
- [x] Post-implementation typecheck/test/probe evidence
- [x] FID status updated to reflect actual implementation state

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** Implemented the full architecture-evaluation backlog with
  unlimited text preserved. Payload purge: legacy `elements` array dropped from
  the serialized payload (layout view retained internally), duplicated title
  fixed, stale Cytoscape comments swept. Compression: documents ship as a
  gzip+base64 block (`savant-docs-payload`) decoded lazily in the browser via
  `Uint8Array.fromBase64` + `DecompressionStream("gzip")` with a plain-mode
  export knob and `</script>` breakout escaping on both paths. Render-time:
  integer coordinate rounding (`roundCoord`), precomputed export-time search
  index, `forEachNode`/`forEachEdge` iteration instead of array allocation,
  LOD/reduced-motion contracts verified. CI: byte-determinism gate (double
  export, timestamp normalization, SHA-256) and a Playwright `file://`
  zero-network suite in `evals/` asserting WebGL init, search, and a clean
  console with every external route aborted. Artifact shrank 22.3 MB → 10.1 MB.
- **Tests Added:** FID-020 lean-payload contract test (elements absent, search
  index present, gzip docs block decode), byte-determinism SHA-256 gate,
  plain-mode `</script>` breakout-escaping regression test, plus the evals
  Playwright `file://` zero-network suite (`@playwright/test` devDependency).
- **Verified By:** Independent code review (code-reviewer-deepseek-flash),
  knowledge-graph 17/17, graph-export 37/37, evals typecheck, ESLint/Prettier
  clean, Playwright suite 1/1, and a real-artifact Chrome probe (WebGL mount,
  docs open, search alignment, 900px narrow viewport, zero console errors).
- **Commit/PR:** Pending
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

External architecture reviews are most valuable when triaged against ground
truth: several of this evaluation's sections describe work that already shipped
(audio, search, escaping, window controls) or propose changes that contradict
recent converged decisions (default text caps). The actionable remainder is
payload engineering (dead weight + compression), render-time iteration, and CI
gates — which this FID consolidates into one coherent backlog rather than
adopting the review wholesale.
