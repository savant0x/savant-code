# Deep Research Prompt: Offline Knowledge-Graph Export Performance & Layout at ~7k Nodes

**Purpose:** Diagnose why a single-file, fully-offline HTML knowledge-graph export (Cytoscape.js,
6,916 nodes / 7,874 edges) freezes the browser 2–3 times for 2+ minutes on load and renders as a
"massive circle of overlapping circles", then design the optimal fix architecture that keeps the
hard single-file offline constraint. Run the Perfection Loop on the research before recommending.

**Audience model:** Gemini Deep Research. You cannot access my machine or local files; everything you
need is in this document or the public repositories linked below. Do NOT assume local paths.

---

## 1. What we build

A TypeScript/Bun CLI (the "Savant" / "SavantCode" product) that indexes a codebase into a
deterministic SQLite knowledge graph (structural metadata only: files, symbols/nodes, import/call
edges, and integer cluster ids from community detection), then serializes that graph into a
**single self-contained HTML file** the user opens locally via `file://` — the "graph export". It
must work with **zero network access** (no CDN, no fonts from the web, no fetch/XHR). The same
export system also produces a branded chat-session HTML report; both share a Neon-Slate dark design
system with inlined Font Awesome icons.

## 2. The artifact (exact composition, measured)

The graph export is a single 4.33 MB HTML file. Measured breakdown (Bun `fs` + byte counts):

| Component | Size | Notes |
|---|---|---|
| Total HTML | 4.33 MB | opened via `file://` |
| Font Awesome 6.7.2 CSS (`<style>` block) | 1,259 KB | includes **10 inline base64 woff2 fonts** (`url(data:font/woff2;base64,…)`) |
| Cytoscape.js 3.30.2 (`<script>` block) | 365 KB | full library inlined as one minified string |
| `var GRAPH_DATA = {…};` JSON literal | 2,681 KB | **one giant single-line JSON** in a `<script>` tag |
| Logo, CSS, markup | remainder | branded header/meta/toolbar/sidebar |

`GRAPH_DATA.meta` for the real repo index: **files 2038 · nodes 6916 · edges 7874 · clusters 454**.
Each node carries `{ id, label, path, type, cluster, preview? }` (preview = first 20 lines of file
source, capped 2,000 chars, binary/oversized skipped); edges carry `{ id, source, target, type
('IMPORTS'|'CALLS'), weight }`. Data is embedded verbatim (only `<`, U+2028/U+2029 escaped).

## 3. The problem (observed behavior)

1. **The page freezes 2–3 separate times on load** and takes 2+ minutes before it becomes usable.
   Each freeze is a hard main-thread stall (page unresponsive, tab may show "not responding").
2. **When it finally renders, the layout is a massive circle of overlapping circles** — a hairball.
   The user's words: *"it's still a massive circle of overlapping circles"* and *"not loading any
   modules anymore"* (post-load interactivity appears broken — search/sidebar/selection do not
   respond).
3. Earlier attempts (already shipped): deferring Cytoscape construction via
   `requestIdleCallback` + cluster-seeded starting positions + boosted COSE params. **None fixed it.**

## 4. Current implementation (what the template actually does)

The HTML is generated from a TypeScript template literal. The page script:

1. Parses the **2.6 MB single-line `GRAPH_DATA` JSON literal** at script evaluation (browser must
   tokenize/escape a 2.6 MB string in one pass).
2. Defers `initGraph()` via `requestIdleCallback(initGraph, { timeout: 2000 })` (fallback:
   DOMContentLoaded + 50 ms).
3. In `initGraph()`: builds cluster groups, then **seeds initial positions in a giant ring**:
   - `angle = (i / numClusters) * 2π`, `radius = 120 + (numClusters − i) * 40` → with 454
     clusters (i = 0) the outermost radius = **18,280 px**; each cluster's nodes get a tiny
     ±60 px deterministic jitter. Net effect: 454 small blobs on a huge circle — the observed
     "circle of circles".
4. Constructs `cytoscape({ elements: GRAPH_DATA.elements, … })` with:
   - `layout: { name: 'cose', animate: false, padding: 40, nodeRepulsion: 10000,
     idealEdgeLength: 80, componentSpacing: 160, gravity: 0.25, randomize: false }`
   - node style: 18×18 px disks, labels `data(label)` at 9 px, bezier edges with arrowheads
   - `minZoom: 0.05, maxZoom: 4`
   - **COSE runs synchronously on the main thread** for 6,916 nodes / 7,874 edges (O(n²)-ish
     force-directed iterations) — this is the dominant freeze.
5. After layout: `cy.fit()` + status update; tap handlers bound for sidebar (node details +
   connected edges + code preview), Ctrl+click shortest path (Dijkstra), fuzzy search over
   path/label, cluster colors, fit/reset buttons.

## 5. Hard constraints (non-negotiable)

- **Single self-contained HTML file opened via `file://`.** Zero network. No CDN, no external
  fonts, no XHR/fetch. Any Web Worker must work from `file://` (blob workers only — module workers
  from `file://` fail in Chromium; a worker via `new Worker(URL.createObjectURL(blob))` works but
  can't easily import large bundled libs without duplicating them inline).
- **No new runtime build step** for the end user — the export is generated by our CLI at export
  time. Anything the browser needs must be embedded in the file (or synthesized at generation time
  on the Bun/Node side).
- **Deterministic output** — same repo ⇒ byte-stable export (we hash files, community ids are
  stable integers). Layout must not be random across regenerations.
- Structural metadata only; full file contents are never embedded (only the 2,000-char previews).
- The export is a **static report**, not a live app — slow one-time layout is acceptable *only* if
  it does not block interactivity; but the current multi-minute freeze is not acceptable.

## 6. Design history (decisions already made — do not relitigate without evidence)

- **Governance:** the project is governed by an internal engineering protocol ("ECHO") whose
  laws require deterministic outputs, YAGNI (no speculative surfaces), utility-first shared
  logic, strict quality gates (typecheck ×4, zero-warning lint, format + markdown lint), and a
  "Five Questions" evaluation (works for ALL cases, scales to 1000x, survives hostile inputs,
  maintainable in 2 years, industry standard) before any design ships. Every change runs a
  Perfection Loop (RED → GREEN → AUDIT → COMPLETE) on a design doc before code is written.
- **FID (knowledge-graph integration):** chose Cytoscape.js 3.30.2 inlined into the artifact —
  deliberately **not** a 1:1 port of the source project's stack.
- **Source project:** **Understand Anything** by Egonex (originally Lum1104):
  **https://github.com/Egonex-AI/Understand-Anything** — uses **React Flow + ELK** (Eclipse Layout
  Kernel) for its interactive dashboard. We vendored a copy for reference; we did NOT adopt React
  Flow + ELK wholesale (would bloat the offline artifact and be a verbatim copy).
- **ELK decision:** when a Nova (third-party auditor) request asked to switch to ELK, we deferred:
  *cluster-seeded COSE is the retrofit; server-side ELK positions embedded as a Cytoscape
  `preset` layout ("Option C") is the fallback — **revisit if the real 6,916-node export still
  overlaps**.* That revisit trigger has now fired (circle of circles confirmed at real scale).
- **YAGNI stance:** no speculative new surfaces (e.g., no new "mode" toggles, no second layout
  engine shipped until the problem is proven).

## 7. What we need from this research

### 7.1 Diagnosis (verify/refute these hypotheses)
1. **2.6 MB single-line JSON literal** in a `<script>` — how much of the first freeze is
   tokenizing/escaping that string vs. parsing the 1.2 MB CSS with 10 base64 fonts? Quantify.
2. **Synchronous COSE on 6,916 nodes / 7,874 edges** — expected wall time, memory, and whether
   COSE fundamentally cannot untangle ~7k nodes in reasonable time (vs. just parameter tuning).
3. **Cluster-ring seeding + `randomize: false`** — confirm the 454-blob-on-a-giant-ring seed
   explains the "circle of circles", and that COSE starting from that seed cannot escape it.
4. **Post-load interactivity loss** — is a long main-thread stall (or an exception during layout)
   the likely cause of search/sidebar/selection not responding after load? Consider also the
   deferred-init path: `requestIdleCallback(initGraph, { timeout: 2000 })` + handler binding after
   `cytoscape()` construction — if construction throws or the idle callback fires before the
   container is sized, does that leave an exception window where handlers never bind? What would
   a robust implementation do so a failed/aborted layout still leaves the page interactive?

### 7.2 Architecture recommendation — the single best approach
Evaluate and then recommend **one primary architecture** (with a concrete plan), plus ranked
alternatives, for a 6–7k node / 8k edge offline single-file graph that must (a) load fast enough to
feel responsive, (b) render a readable, non-overlapping layout, (c) stay interactive, (d) honor
every constraint in §5. Please cover, with specifics:

- **Server-side precomputed layout (Option C):** compute final positions **at export time** in
  Bun/Node (ELK? `dagre`? `fcose`-style? custom?) and embed them as Cytoscape `preset` positions so
  the browser does **zero layout math**. Trade-offs: export-time cost, embedding size, determinism,
  quality at 7k nodes, library availability in Node vs browser.
- **Client-side alternatives:** Web-Worker layout (blob worker viability from `file://`, bundling
  the worker inline, message-passing positions back), `cose-bilkent`, `fcose`, `euler`, `spread`,
  `dagre`/`elkjs` in the browser, progressive/chunked layout with `requestAnimationFrame` yields.
- **Rendering/interaction at 7k nodes:** canvas LOD — hide labels below a zoom threshold,
  aggregate/decimate edges, cluster-collapse drill-down (render 454 cluster nodes first, expand on
  demand), `texture-on-zoom` style tricks, edge bundling or straight edges at low zoom, node sizing
  so labels only appear when the node is large enough. Which Cytoscape-native techniques actually
  work at this scale, and which are marketing?
- **Payload reduction:** is 1.2 MB of Font Awesome (10 base64 fonts) justified for ~6 icons?
  Replace with inline SVGs? Compress the JSON (the data is highly repetitive paths/labels — what
  about a cheap token dictionary or just dropping `preview` by default)? Does a smaller payload
  meaningfully cut the parse freeze?
- **Layout quality at scale:** what does ELK actually produce for a 7k-node graph with 454
  communities (layered vs. force-directed vs. compound)? How do real projects (e.g., the source
  repo's own dashboards) handle 5–10k nodes? Cite concrete repos/libraries with versions and
  licenses, and note which run in Node (for Option C) vs. browser-only.

### 7.3 Concrete deliverables
1. **Root-cause verdict** with numbers (expected time contributions per freeze stage).
2. **One recommended architecture** — enough detail to implement: exact libraries + versions
   (Node-side and/or browser-side), where each computation happens (export time vs. load time vs.
   lazy), data-shape changes to `GRAPH_DATA` (e.g., adding `position` per node), code-level
   sketches of the hot paths (seed→layout→render), and a loading/status UX that never freezes.
3. **Fallback plan** if the primary choice fails (e.g., ELK WASM size blows the file, or worker
   fails from `file://`).
4. **A "Five Questions" evaluation** of your recommendation: works for all graph sizes (1k → 10k+),
   survives hostile inputs (degenerate/cyclic graphs, 200k edges), maintainable in 2 years,
   industry-standard (does it match what the best graph tools do?).
5. **Risks & pitfalls** — known Cytoscape-at-scale bugs, ELK-on-Node caveats, file:// worker
   restrictions, memory ceilings, and how to fail gracefully so the page is never a frozen tab.

## 8. Response format

- Structured markdown, sections matching 7.1–7.3.
- Every recommendation cites a real repository/package (name, URL, version, license).
- Be decisive: pick ONE primary architecture. Ranked alternatives are for the fallback only.
- Flag anything you cannot verify (no local access) so we can validate it ourselves.

---

**Sign-off:** Prepared for a Gemini Deep Research pass. All local facts above are measured from the
actual artifact (4.33 MB export, 2,038 files / 6,916 nodes / 7,874 edges / 454 clusters; Font
Awesome 6.7.2; Cytoscape 3.30.2; COSE params and seeding math as listed).
