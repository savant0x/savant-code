# FID: Graph-Export Performance — Precomputed Server-Side Layout + Payload/LOD Overhaul

**Filename:** `FID-2026-0806-017-graph-export-performance-precomputed-layout.md`
**ID:** FID-2026-0806-017
**Severity:** high
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

The offline knowledge-graph export (a single self-contained 4.33 MB HTML file opened via `file://`)
freezes the browser 2–3 times for 2+ minutes on load, then renders as a "massive circle of
overlapping circles" with dead interactivity. Root cause is a compounding chain: a 2.6 MB single-line
JavaScript object literal blocks V8 compilation; a 1.2 MB inline Font Awesome CSS block (10 base64
fonts) blocks CSSOM/first paint; a synchronous Cytoscape COSE layout runs an O(n²)-class force
simulation over thousands of nodes on the main thread; and a deterministic cluster-ring seed (up to
18,280 px radius) traps COSE in a local minimum, producing the observed ring-of-blobs artifact. A
third-party deep-research pass (Gemini) independently reached the same diagnosis and recommended
export-time server-side layout precomputation. **Operator decision (2026-08-06): adopt the source
project's primary pattern — ELK layered, container-based two-stage layout with drill-down — not a
flat force layout.** This FID converges research + source analysis into our system: **at export time
in Bun, derive folder/community containers, run ELK (layered) Stage 1 over containers + Stage 2
per-container over children, embed ALL coordinates as Cytoscape `preset` positions, ship data as
inert `<script type="application/json">`, replace Font Awesome with an inline SVG sprite, add
canvas LOD heuristics, and render containers collapsed with expand-on-tap (drill-down)** — zero
layout math and near-zero parse cost in the browser; elkjs runs only in Bun (never shipped; EPL-2.0
build-time dep). The ELK revisit trigger from FID-2026-0806-016 has fired and is resolved by this
design (server-side Option C, ELK adopted; force layout demoted to fallback).

## Environment

- **OS:** Windows 11 (win32, bash)
- **Runtime:** Bun 1.3.14 (CLI / export generator); browser = Chromium (Chrome 120+)
- **Repo state:** v0.0.21 working tree
- **Affected artifact:** `dev/exports/graph/savant-graph.html` (4,454 KB on disk)
- **Source material:** `dev/scratchpad/graph-export-optimization-gemini.md` (third-party deep
  research, 2026-08-06) + `resources/Understand-Anything-main/` reference

## Detailed Description

### Problem

Observed behavior (operator, 2026-08-06, real 6,916-node-class repo index):

1. **Hard freezes ×2–3 during load; 2+ minutes before usable.**
2. **Final render is a "massive circle of overlapping circles"** — 454 small node-blobs pinned on a
   giant ring; nodes not usable.
3. **"Not loading any modules anymore"** — post-load search/sidebar/selection do not respond.

### Expected Behavior

- Export opens and becomes interactive within a few seconds (parse + first paint + graph ready).
- Layout is readable at 2–7k nodes: clusters separated, no global overlap hairball.
- Search, click-to-inspect sidebar, cluster colors, fit, and shortest-path all work after load.
- Stays a single offline self-contained HTML file; deterministic byte-stable output.

### Root Cause

A compounding chain, each stage blocking the main thread:

1. **V8 object-literal parse (first freeze).** `var GRAPH_DATA = {…};` is a 2.6 MB single-line JS
   object literal in a `<script>` (`cli/src/commands/graph-export/template.ts` embeds
   `var GRAPH_DATA = ${graphJson};`). V8 must tokenize + AST-compile it speculatively (getters,
   setters, hidden classes). `JSON.parse()` on the same bytes is a side-effect-free C++ parser and
   measurably faster (≥18–50% for payloads >10 KB per published benchmarks); best practice is an
   inert `<script type="application/json">` + `textContent` + `JSON.parse`.
2. **CSSOM blocking (first freeze, concurrent).** `FONT_AWESOME_ALL_CSS` inlines **10 base64 woff2
   fonts** (~1,259 KB) for ~6 toolbar/search icons. CSSOM must be fully built before first paint;
   1.2 MB of inline binary decodes synchronously on the critical path.
3. **Synchronous COSE (dominant freeze).** `layout: { name: 'cose', … }` runs a force-directed
   simulation over the full node set on the main thread at construction
   (`template.ts` `cytoscape({ … })`). COSE is O(n²)-class per iteration without spatial indexing
   (the literature and COSE docs target ≤500-node graphs); ~2k–7k nodes × dozens–hundreds of
   iterations = billions of pairwise computations → 60–180 s wall time, page unresponsive.
4. **Ring-seed trap (the "circle of circles").** `initGraph()` seeds clusters with
   `angle = i/n·2π`, `radius = 120 + (454−i)·40` → outermost **18,280 px**; each cluster is a tiny
   ±60 px jitter blob. COSE starts there with `randomize: false` and a per-iteration velocity cap,
   so nodes untangle locally but can never traverse the 18k-px ring → ring of blobs, never a
   coherent center.
5. **Interactivity loss.** `requestIdleCallback(initGraph, { timeout: 2000 })` can fire while CSSOM
   is still being built → zero-height container → broken coordinate mapping; if layout exceeds the
   engine's script budget the context can be killed before `bindGraphHandlers()` runs; and even on
   success, 7,874 bezier curves + 6,916 labels redrawn on every interaction saturate the canvas.

### Evidence

Measured artifact composition (`dev/exports/graph/savant-graph.html`):

```text
total:                    4.33 MB
Font Awesome CSS block:   1,259 KB  (10 inline base64 woff2 fonts)
Cytoscape.js 3.30.2:        365 KB
GRAPH_DATA JSON literal:  2,681 KB  (single-line var GRAPH_DATA = {…};)
meta:  files 2038 · nodes 6916 · edges 7874 · clusters 454
```

Code references:

- `cli/src/commands/graph-export/template.ts:130` — `var GRAPH_DATA = ${graphJson};` (JS literal)
- `cli/src/commands/graph-export/template.ts:239-250` — synchronous `name: 'cose'` layout with
  `nodeRepulsion: 10000, idealEdgeLength: 80, componentSpacing: 160, gravity: 0.25,
  randomize: false`
- `cli/src/commands/graph-export/template.ts:157-178` — cluster-ring seeding
  (`radius = 120 + (454−i)·40` → 18,280 px; `±60` jitter)
- `cli/src/commands/graph-export/template.ts:276-281` — `requestIdleCallback(initGraph, {timeout:
  2000})` deferral + fallbacks
- `packages/knowledge-graph/src/export-serializer.ts` — `serializeGraphForExport` emits
  `elements` (file nodes + edges) and `meta` (files/nodes/edges/clusters); previews capped 20
  lines / 2,000 chars, opt-out `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1`
- `cli/src/commands/graph-export.ts:60-90` — writes `dev/exports/graph/savant-graph.html`
  (single-file rotation, FID-2026-0806-016)
- Research: `dev/scratchpad/graph-export-optimization-gemini.md` §7.1 (diagnosis, all four
  hypotheses verified with citations), §7.2 (architecture), §7.3 (deliverables)

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts` — template script + styles (largest change)
- `packages/knowledge-graph/src/export-serializer.ts` — optionally add `position` per node,
  preview default off, shape stays Cytoscape-compatible
- `cli/src/commands/graph-export.ts` — invoke layout at export time (Bun-side)
- New: `cli/src/commands/graph-export/layout.ts` (or `packages/knowledge-graph/…`) — ELK
  two-stage precompute wrapper (containers → Stage 1 → Stage 2)
- New: `cli/src/commands/graph-export/containers.ts` — folder-LCP container derivation with
  community (cluster-id) fallback, mirroring the source's `deriveContainers`
- New dep (CLI workspace): `elkjs` 0.12.0 **exact-pinned** (EPL-2.0, build-time only —
  coordinates embedded, WASM never shipped to the browser). `d3-force` is **not** installed:
  documented fallback engine only (source's own force engine) — removed from deps during
  Loop 3 (YAGNI — never imported)
- `cli/src/constants/fontawesome.ts` + `cli/src/constants/cytoscape.ts` — sprite/trim as needed
- `cli/src/commands/__tests__/graph-export.test.ts` — update assertions for new payload shape
- **`dev/test-prompts/graph-export-e2e.ts`** — asserts `graphHtml.includes('var GRAPH_DATA =')`;
  must be updated for the inert JSON block (AUDIT finding #1)
- **`cli/src/commands/export-conversation/template.ts`** — shares `FONT_AWESOME_ALL_CSS`;
  sprite extraction must not break `/export` (AUDIT finding #2)

### Risk Level

- [x] High: Major feature broken (export unusable), no workaround at scale
- [ ] Critical / [ ] Medium / [ ] Low

## Proposed Solution

### Approach

Adopt the **source project's primary pattern** (ELK layered, container-based two-stage with
load — verified in `resources/Understand-Anything-main/…/graph-layout-scaling-design.md` §2-§3)
and our Option C (export-time precompute) for a static artifact, in five layered changes:

1. **Precompute layout at export time (Bun) — two ELK stages, never in the browser.**
   a. **Container derivation** (`containers.ts`, mirroring source `deriveContainers` §2):
      collect file `path`s → longest-common-prefix strip → group by first path segment after the
      LCP (e.g. `sdk/`, `cli/`, `packages/`); nodes without a path or a degenerate single bucket
      (>70% in one folder, <2 buckets) fall back to **community containers by existing `cluster`
      id** (our DB already has deterministic Louvain-style cluster ids — no new graphology dep).
      Single-child containers flatten to top-level nodes.
   b. **Stage 1:** ELK `layered` over container atoms + ungrouped nodes (direction DOWN,
      `LAYER_SWEEP` crossing min, `ORTHOGONAL` routing, spacing 80/60, padding).
   c. **Stage 2:** ELK `layered` per container over its children (precomputed at export time,
      offset by the container position). All coordinates are embedded — the browser never runs
      ELK, so elkjs WASM is a build-time-only dep (EPL-2.0, coordinates-only embedding).
2. **Inert JSON injection.** Replace `var GRAPH_DATA = {…};` with
   `<script type="application/json" id="savant-graph-data">…</script>`; client reads
   `textContent` + `JSON.parse`. Bypasses V8 speculative compilation; also neutralizes
   `</script>` injection (escape `<`). Payload adds `containerId` + `position` per node.
3. **Inline SVG icon sprite.** Replace the 1.2 MB Font Awesome CSS block with an `<svg><symbol>`
   sprite for the ~6 icons used (search, expand, palette, route, close, corner marks if any) →
   <15 KB. Keep the exact icon glyphs so the design system is unchanged visually.
4. **Cytoscape preset + LOD + drill-down.** Client init: `layout: { name: 'preset' }` (zero
   math), `hideEdgesOnViewport: true`, `textureOnViewport: true`, `min-zoomed-font-size: 12`
   (style property), `pixelRatio: 'auto'`. Render **containers collapsed by default** (children
   `display: none`); expand-on-tap reveals precomputed children (visibility toggle only — no
   relayout). Synchronous init (no `requestIdleCallback` race); handlers bound in `cy.ready()`;
   loading overlay; graceful `try/catch` → text-only fallback on constrained hardware.
5. **Scale-down by default (YAGNI-compliant):** default `preview` OFF — concrete mechanism:
   inverted opt-in `SAVANT_GRAPH_EXPORT_PREVIEWS=1` (default OFF for all exports; existing
   `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` stays honored as a hard-off). Document the ~1.5 MB
   payload saving.

Fallback (documented, not built now): if elkjs fails under Bun (WASM-loading caveat) or hits a
CI memory ceiling, fall back to **d3-force** (the source's own force engine, MIT, deterministic
phyllotaxis seed) computed at export time — same preset delivery, still zero browser math.
Blob-worker client-side layout is the last-resort ranked fallback.

### Steps

1. **Spike first:** verify `elkjs` ^0.9 runs under Bun 1.3.14 (import path
   `elkjs/lib/elk-node.js` or main entry; WASM loading). If Bun chokes, confirm the d3-force
   fallback path (d3-force is pure JS, no WASM). Record the spike result in the FID.
2. Add `elkjs` + `d3-force` to `cli/package.json` (verify EPL-2.0 / MIT licenses + versions).
3. Extend `serializeGraphForExport` options: `includePositions?: boolean`, `includeContainers?`,
   `previewsEnabled` default OFF (inverted opt-in `SAVANT_GRAPH_EXPORT_PREVIEWS=1`; keep
   `_NO_PREVIEW=1` as hard-off), preserving current opt-out semantics. Add `containerId`.
4. New `cli/src/commands/graph-export/containers.ts`: folder-LCP derivation + cluster fallback
   (mirror source `deriveContainers` §2 edge cases: single-child flattens, 2-child dimmed,
   all-rooted falls back flat).
5. New `cli/src/commands/graph-export/layout.ts`: Stage 1 ELK on containers/ungrouped; Stage 2
   ELK per container on children (offset by container pos); round to 1 decimal; attach
   `position` per node. Deterministic (ELK is seed-free; fixed options).
6. Rework `template.ts`: inert JSON block + `JSON.parse`; SVG sprite; preset layout + LOD +
   drill-down (containers collapsed, expand-on-tap = visibility toggle). **Option placement
   (AUDIT #3):** `hideEdgesOnViewport`, `textureOnViewport`, `pixelRatio` are Cytoscape **init
   options**; `min-zoomed-font-size` is a **node style property**. Synchronous init with
   `cy.ready` handler binding; loading overlay; try/catch fallback. **Edges (AUDIT #4):**
   haystack at rest for scale, keep `target-arrow-shape` on `path`/`selected`.
7. Update `graph-export.test.ts` **and `dev/test-prompts/graph-export-e2e.ts`** assertions
   (inert JSON block, preset layout, sprite present, positions + containers embedded, no
   `cdn.jsdelivr`, still offline). Verify `/export` chat template still renders (shared FA
   constant).
8. Validate: typecheck ×4, ESLint, prettier, lint:md, targeted tests, live
   `dev/test-prompts/graph-export-e2e.ts` run; regenerate the real export and re-measure load +
   overlap (browser: node-bbox overlap scan); determinism (`cmp` byte-identical).

### Verification

- `cd cli && bun run typecheck` (+ common, agent-runtime, sdk) → exit 0
- `bun x eslint . --max-warnings 0` → exit 0; `bunx prettier --check .` → clean;
  `bun run lint:md` → exit 0
- `cd cli && bun test src/commands/__tests__/graph-export.test.ts` → green
- Live real-index export regenerated; browser check: page interactive < 10 s; overlap scan
  (18-px bbox grid) reports overlap fraction; compare before/after
- Determinism: export twice, byte-identical (`cmp`)

## Perfection Loop

### Loop 1

- **RED:** Five findings cataloged with evidence (above): V8 literal parse, CSSOM fonts, sync
  COSE, ring-seed trap, interactivity race. Third-party deep research
  (`dev/scratchpad/graph-export-optimization-gemini.md`) independently verified all four
  diagnosis hypotheses with citations (V8/CSSOM freeze; COSE O(n²) wall time 60–180 s; ring-seed
  local minimum; idle-callback race + canvas saturation). ELK revisit trigger (FID-2026-0806-016)
  confirmed fired. Loop 1 resolved it with ForceAtlas2 at server-side Option C (Gemini's pick);
  **Loop 2 superseded that choice** — operator directed source-exact ELK + drill-down (see Loop 2).
- **GREEN:** Five minimal, layered fixes proposed (above). Most robust defaults chosen:
  preset layout (zero browser math), inert JSON, SVG sprite, LOD, preview-off default. Fallback
  (Blob worker) documented, not built.
- **AUDIT (Verifier, code-reviewer-deepseek-flash):** All 8 factual claims **PASS** with
  file:line evidence — (1) `template.ts:130` inline `var GRAPH_DATA`; (2) `template.ts:246-250`
  COSE params; (3) `template.ts:157-178` ring seed (`radius = 120 + (454-i)·40`, ≈±60 jitter);
  (4) `template.ts:276-277` `requestIdleCallback(initGraph, { timeout: 2000 })`;
  (5) `export-serializer.ts` previews 20/2000 + `SAVANT_GRAPH_EXPORT_NO_PREVIEW`; file nodes +
  edges only; (6) `graph-export.ts` default `dev/exports/graph/savant-graph.html`;
  (7) artifact measurements 4.33 MB / 1259 KB FA / 365 KB Cytoscape / 2681 KB JSON / meta
  2038·6916·7874·454; (8) research source present (284 lines). Verifier raised 5 gaps (below).
- **ADVERSARIAL (meta-verification):** 5/5 Verifier findings CONFIRMED/ADJUSTED, 0 REFUTED:
  1. CONFIRMED — `graph-export-e2e.ts` asserts `var GRAPH_DATA =`; must be updated with the
     inert-JSON switch (folded into Affected Components + Step 5).
  2. CONFIRMED — `FONT_AWESOME_ALL_CSS` is shared with the chat export template; sprite
     refactor must not break `/export` (folded into Affected Components + Step 5).
  3. CONFIRMED — `min-zoomed-font-size` is a node **style** property, not an init option;
     `hideEdgesOnViewport`/`textureOnViewport`/`pixelRatio` are init options (Step 4).
  4. ADJUSTED — haystack drops arrowheads; keep `target-arrow-shape` on `path`/`selected`
     so shortest-path stays directional (Step 4).
  5. CONFIRMED — preview-default needs one concrete mechanism: inverted opt-in
     `SAVANT_GRAPH_EXPORT_PREVIEWS=1`, default OFF (Step 2).
- **CHANGE DELTA:** ~8 files, ~300 lines net (est.)
- **NOVA (independent third-party audit, 2026-08-06):** **APPROVED** — root cause 5/5
  verified (`template.ts:130`, `FONT_AWESOME_ALL_CSS`, `template.ts:239-250`,
  `template.ts:157-178`, idle-callback race); solution 5/5 approved (FA2 precompute, inert
  JSON, SVG sprite, preset + LOD, preview opt-in); audit findings 5/5 confirmed; missed
  questions 7/7 answered; YAGNI verified. Evidence:
  `dev/nova/inbox/2026-08-06-fid-017-graph-export-nova-audit-response.md`.
  **Note (Loop 2):** Nova approved the Loop-1 design (FA2 precompute). The layout ENGINE was
  subsequently changed to source-exact ELK + drill-down per operator directive (2026-08-06);
  the shared fixes (inert JSON, SVG sprite, preset + LOD, preview opt-in, e2e/chat-export
  findings) are unaffected. Nova re-audit of the engine change is optional per operator.

### Missed Questions

1. **Rendered node count is 2,038 (file nodes), not the meta's 6,916 (files+symbols) — which
   should the layout optimize for?** → Layout runs over the elements actually emitted
   (`serializeGraphForExport` emits file nodes + edges only; symbol count is meta-only). The
   freeze severity is real but bounded by the emitted set (~2k nodes / ~7.9k edges). Containers
   derive from file `path`s, so 2,038 is the container-relevant count.
2. **Determinism of ELK?** → ELK is deterministic (no randomness in the layered algorithm;
   fixed options ⇒ byte-stable). d3-force fallback uses d3's deterministic phyllotaxis seed when
   x/y are unset (the source relies on this). No `Math.random` in the layout path either way.
3. **Do we need the Blob-worker fallback now?** → No (YAGNI). Bun-side ELK at export time is the
   primary; d3-force is the documented fallback if elkjs WASM fails under Bun; worker layout is
   last-resort only. The export runs in the user's CLI, not CI, so memory is not a real
   constraint.
4. **Is dropping previews by default acceptable?** → Yes; sidebar preview degrades to "no preview"
   text, search/labels unaffected, payload drops ~1.5 MB. Opt-in flag preserves the feature.
5. **Does the SVG sprite change the visual design?** → No — same icon glyphs (extract from the
   bundled Font Awesome), same Neon-Slate tokens; only the delivery mechanism changes.
6. **ELK or FA2 now? (operator decision)** → ELK. The source's primary pattern is container
   two-stage ELK (its own scaling plan replaced dagre with ELK for exactly this reason); force
   layout is the source's KnowledgeGraphView fallback, not the main path. We mirror that.
   ForceAtlas2 (Gemini's pick) is now ranked after d3-force as a fallback, not built.
7. **What if a node has no position (future data)?** → Template assigns missing positions to
   (0,0) then `cy.fit()` — fit handles outliers. Deterministic and simple.
8. **Does elkjs EPL-2.0 block shipping?** → No. elkjs is a **build-time-only** dep: we embed
   numeric coordinates, never the WASM or library code. Same relationship as any vendored
   build tool; the source itself ships elkjs in a MIT-licensed product. License noted for
   review in NOTICE if we ever inline it.
9. **Container strategy: folder or community?** → Folder-LCP primary (readable names like
   `sdk/`, matches the source), community-cluster fallback only for degenerate folder buckets
   (single folder >70%, <2 buckets). Our `cluster` ids already exist — no new community dep.

### Code Verification Evidence

> AUDIT evidence-citation rule (FID-2026-0805-004): every PASS/FAIL cites file:line + quoted code.

- [x] Files referenced in "Affected Components" exist in the codebase (checked in RED/AUDIT —
      all exist; e2e + chat-export references confirmed)
- [x] Implementation matches the proposed solution (Loop 3 — ELK two-stage, inert JSON,
      SVG sprite, preset + LOD, drill-down; d3-force fallback dropped as unneeded)
- [x] Typecheck passes: cli + knowledge-graph → 0 errors; typecheck ×4 (sdk, common,
      agent-runtime, cli) → exit 0
- [x] FID status updated to reflect actual implementation state (implemented, Loop 3)

### Loop 2

- **RED:** Operator asked which layout system the source project uses. Investigation of
  `resources/Understand-Anything-main` revealed the primary pattern is **not** a flat force
  layout: React Flow + **elkjs two-stage container layout** (`docs/superpowers/plans/
  2026-05-03-graph-layout-scaling.md`), folder-LCP containers with Louvain fallback
  (`…/specs/2026-05-03-graph-layout-scaling-design.md` §2-§3), force layout (d3-force worker)
  only for the free-form KnowledgeGraphView. The FID's FA2 pick (from Gemini) did not match the
  source's architecture. **Operator chose: source-exact ELK + drill-down.**
- **GREEN:** Revised approach (above): export-time ELK Stage 1 (containers) + Stage 2
  (children), all coordinates embedded as preset; containers collapsed with expand-on-tap;
  d3-force demoted to documented fallback. Container derivation mirrors source §2 (folder-LCP,
  cluster-id fallback, single-child flatten). Missed questions 8-9 added (license, container
  strategy). Steps updated: spike elkjs-under-Bun FIRST.
- **AUDIT (Verifier, code-reviewer-deepseek-flash):** Source-exact claims verified by grep
  against `resources/Understand-Anything-main/docs/superpowers/specs/
  2026-05-03-graph-layout-scaling-design.md`: `deriveContainers` strategy §2 (LCP strip,
  community fallback), `algorithm: "layered"` + `LAYER_SWEEP` + `ORTHOGONAL` §3, LCP grouping
  and single-child flatten (§2, lines 47/82-83/90-98/108/142-147). Source deps confirmed
  (`elkjs ^0.9.3`, `d3-force ^3` in source package.json).
- **ADVERSARIAL:** Stale ForceAtlas2 references from Loop 1 cleaned (Loop-1 RED now marks the
  FA2 choice as superseded); Nova record notes the layout engine changed post-approval per
  operator directive. 0 findings unresolved.
- **CHANGE DELTA:** ~10 files, ~400 lines net (est.)

### Loop 3 (implementation)

- **SPIKE (Step 1): PASSED.** elkjs 0.12.0 runs under Bun 1.3.14 via a `new Function`
  evaluation of the vendored GWT worker bundle with `self`/`document`/`window` shadowed as
  `undefined` (forces the CJS export branch), handing the extracted in-process fake `Worker`
  to `elkjs/lib/elk-api.js` via `workerFactory`. Verified end-to-end: real ELK layered layout
  on a 3-node graph in 125 ms (probes in `dev/scratchpad/elk-probe*.ts`). Sandboxing audit
  (2026-08-06): `vm.runInNewContext` fails under Bun (`$wnd.goog` needs the host global
  shape); shadowing `process`/`globalThis` also breaks the bundle. Executed source is a
  pinned, vendored dep with a stub `require`; no user data reaches the eval.
- **GREEN (implemented):** `containers.ts` (folder-LCP + cluster fallback, single-child
  flatten, deterministic sort), `layout.ts` (ELK Stage 1 over atoms + Stage 2 composition
  reusing the Stage-1 child layout — single ELK pass per container, halved export time 30 s →
  17 s), `graph-icons.ts` (4-glyph SVG sprite, <15 KB vs 1.2 MB), `template.ts` rework
  (inert JSON block + `JSON.parse`, preset layout + LOD, containers collapsed by default,
  expand-on-tap visibility toggle, sync init, try/catch fallback), serializer extended
  (`position`/`containerId`/`parent`/container atoms, previews opt-in default OFF),
  `graph-export.ts` async, `build-binary.ts` ships `elk-worker.min.js` sibling
  (tree-sitter.wasm precedent). **d3-force removed from deps (YAGNI)** — documented fallback
  only, never imported (Loop-3 ADVERSARIAL); elkjs pinned exact `0.12.0`.
- **AUDIT (Verifier):** Post-implementation code review by code-reviewer-deepseek-flash.
  Resolved: (1) loader sandbox — vm rejected empirically, `new Function` + stub require is
  the working path, source is a pinned vendored dep (documented in layout.ts header);
  (2) binary asset path — verified correct (`SAVANT_CODE_IS_BINARY` flag + sibling copy in
  build-binary.ts:301/352); (3) d3-force dead dep — removed; (4) preview env-var semantics —
  serializer + tests correct, stale doc comment in graph-export.ts:14 fixed;
  (5) cluster-fallback branch — now unit-tested (`containers.test.ts`); (6) test
  brittleness — tightened to structural assertions; (7) inter-container edges — deduped atom
  edges in Stage 1, full edge set still emitted for rendering, drill-down is a visibility
  toggle only.
- **ADVERSARIAL:** All 7 reviewer findings triaged: 6 fixed, 1 already-correct (binary path).
  0 unresolved.
- **Verification evidence (all gates green 2026-08-06):**
  - Typecheck ×4 (sdk, common, agent-runtime, cli) → exit 0; cli + knowledge-graph
    typecheck → 0 errors.
  - `bun x eslint . --max-warnings 0` → 0; `bunx prettier --check .` → clean;
    `bun run lint:md` → 0.
  - `graph-export.test.ts` + `containers.test.ts` + `export-conversation.test.ts` → 21 pass /
    0 fail; knowledge-graph pkg → 17 pass / 0 fail; e2e harness
    (`dev/test-prompts/graph-export-e2e.ts`) → 15 PASS / 0 FAIL.
  - **Real export regenerated** (2,038-file repo index): artifact **496 KB** (was 4,454 KB),
    export wall time **~17 s**, all 2,038 file nodes + 14 containers positioned, **0 node
    bbox overlap collisions** (18 px grid), **deterministic** (byte-identical across runs;
    earlier diff was only the minute-resolution footer timestamp).
  - **Browser load (headless Chrome, real wall clock):** interactive-ready (loading overlay
    hidden + drill-down status set) **80 ms** after script start; entire Chrome process
    (start + load + init + DOM dump) **2.5 s**; zero console errors, 5 canvas layers. The
    FID acceptance criterion (< 10 s interactive) is exceeded by ~100×. Old export: 2–3
    freezes for 2+ minutes.

## Resolution

- **Fixed By:** FID-2026-0806-017 implementation (Loop 3)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Export-time ELK two-stage container layout in Bun (elkjs 0.12.0,
  exact-pinned) replaces the browser's synchronous COSE; all coordinates embedded as
  Cytoscape `preset` positions (zero browser layout math). Payload overhaul: inert
  `<script type="application/json">` + `JSON.parse` (no 2.6 MB object literal), inline
  4-glyph SVG sprite (no 1.2 MB Font Awesome CSS), previews opt-in off by default. Canvas
  LOD (`hideEdgesOnViewport`/`textureOnViewport`/`pixelRatio`/`min-zoomed-font-size`),
  haystack edges with directional arrows on path/selected, sync init (no
  `requestIdleCallback` race), containers collapsed by default with expand-on-tap
  drill-down (visibility toggle only). Result: 4.45 MB → 496 KB artifact, load freezes →
  interactive in ~80 ms, 0 node overlap, deterministic, export wall time ~17 s.
- **Tests Added:** `cli/src/commands/__tests__/containers.test.ts` (5 tests: folder-LCP,
  single-child flatten, cluster-fallback degenerate branch, ungrouped root files,
  70% boundary); `graph-export.test.ts` updated (inert JSON, sprite, preset, positions,
  previews opt-in default + hard-off, HTML-injection escape); e2e harness assertions
  updated (15 checks).
- **Verified By:** Verifier + Adversary (Loop 3) + Nova audit of design (2026-08-06)
- **Commit/PR:** *(pending operator push)*
- **Archived:** 2026-08-09 — operator-accepted historical closure; moved to `dev/fids/archive/` and indexed in `dev/fids/archive/README.md`. Remaining review boundaries were waived and are not claimed passed.

## Lessons Learned

- A deterministic ring-seed is worse than no seed for force-directed layouts at scale: if the seed
  geometry itself is the artifact, no amount of force tuning escapes it.
- Deep-research passes earn their keep when they quantify *where* the time goes (parse vs. CSSOM
  vs. layout) — the freeze breakdown made the fix order obvious (payload first, layout second).
- Browser work is a moving target: the same export that takes 2 minutes on the author's machine
  must be validated with a real load + overlap measurement, not eyeballed.
