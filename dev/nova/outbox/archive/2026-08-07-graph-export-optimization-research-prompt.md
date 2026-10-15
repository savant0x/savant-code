# Deep Research Prompt: Code Universe Export — Robustness, Payload, Single-File vs. Framework (Next.js) at 17 MB

**Purpose:** Review the current state of a single-file, fully-offline HTML knowledge-graph
export ("Code Universe", currently ~17.1 MB for a 2,084-file repo) and produce the optimal
design for: (1) payload/size reduction, (2) load + interaction performance, (3) robustness
at scale and under hostile inputs, (4) a decisive answer on whether **staying a single
self-contained HTML file** is still the right architecture — or whether a multi-file / split /
compressed / served structure is now justified — and (5) the strategic question: **should the
static single-file artifact be abandoned entirely in favor of going all-in on a modern web
framework such as Next.js**, and (6) a broader "what else should we improve to make this
feature genuinely complete" sweep. We previously ran this same research round on
the predecessor artifact (2026-08-06, 4.33 MB, Cytoscape); the fixes landed, the file then
grew back to 17.1 MB because of the new inline-documents feature. This round must not
relitigate settled decisions without evidence; it must address the *current* artifact and the
*forward architecture*, with the hard constraint set in §5 treated as *challengeable*, not
sacred.

**Audience model:** Gemini Deep Research. You cannot access my machine or local files;
everything you need is in this document or the public repositories referenced below. Do NOT
assume local paths. Treat every measured number as ground truth; everything else is described
textually.

---

## 1. What we build

A TypeScript/Bun CLI (the "Savant" / "SavantCode" product) that:

1. Indexes a codebase into a deterministic SQLite knowledge graph (files, symbols/nodes,
   import/call edges with integer weight, integer cluster ids from community detection,
   folder hierarchy). Indexing is a separate command; the export consumes the DB.
2. Exports that graph into a **single self-contained HTML file** the user opens locally via
   `file://` — the "graph export" / "Code Universe". It must work with **zero network access**
   (no CDN, no web fonts, no fetch/XHR/module workers).

A **unique** difference vs. typical foreign-force-directed reports: all node coordinates are
**precomputed at export time** in Bun using **ELK layered, container-based two-stage layout**
(Stage 1 over universe-region/container atoms; Stage 2 per container over child nodes),
embedded as preset positions so the **browser performs zero layout math**. The browser
renders with **Sigma.js + Graphology** (WebGL). Since the last research round we added an
**inline-documents** feature (full file contents embedded by default, with budgets) plus
embedded **audio cues** and a **character watermark** — these features are what regrew the
file from 496 KB to 17.1 MB.

**What the artifact's job is today (read this before answering the framework question):**
the export is a CLI-produced deliverable the user **double-clicks to open locally**, shares
**as a file** (email, USB, repo artifact), reads **fully offline**, and can diff/reproduce
because output is deterministic. It is also the product's **public showcase surface** — the
thing a curious developer opens first when they meet the tool. It is *not* a live app, *not*
a multi-user surface, and *not* a hosted page. The Next.js question in §6.2 is really: *does
that job change?*

## 2. The artifact (exact composition, measured 2026-08-07)

Real repo index: **files 2084 · nodes 7022 · edges 7925 · clusters 492 · regions 22 ·
corridors 90 · folders 301**. Real artifact: single HTML, **17,173,885 bytes (~17.1 MB)** on
disk, opened via `file://`. Measured breakdown (Bun `fs` byte counts + structural
inspection of the saved file):

| Section | Size | Notes |
|---|---|---|
| Total | 17.17 MB | single HTML, `file://`, no external refs |
| CSS `<style>` block | ~1.2 MB | includes **~868 KB base64 PNG watermark** (character art) used as page backdrop; rest is the Neon-Slate space theme (stars, planets, tooltips) |
| `savant-graph-data` inert JSON `<script>` | ~15.6 MB chars | **dominant cost** (see below) |
| — `meta` | tiny | files/nodes/edges/clusters counts |
| — `universe` | ~1.5 MB | regions, 2,084 file records, 7,925 edges, 90 corridors, **folders tree** |
| — `documents` | ~12.5 MB | **2,084 file documents: 2,076 text + 2 image + 6 unavailable** — THIS is the growth driver |
| — legacy `elements` | ~1.5 MB | 10,023 Cytoscape-style element rows — **emitted but not read by the current Sigma.js browser; dead weight** |
| `savant-audio-data` inert JSON `<script>` | ~49 KB | 6 Kenney CC0 OGG cues, base64 `data:` URIs |
| `SIGMA_JS` `<script>` | ~0.34 MB | Sigma.js ^3.0.0 + Graphology 0.25.4, minified IIFE bundled at build time |
| app `<script>` (template IIFE) | ~0.17 MB | zoom-state machine, planet effects canvas, search, windows, audio, ARIA |
| Title | — | bug: **"Savant Code Code Universe"** (repeated "Code") |

Document policy (defaults, from the serializer):

- per-file text: `maxTextLines = 500`, `maxTextBytes = 50 KiB`
- per-file image: `maxImageBytes = 2 MiB` (signature-validated PNG/JPEG/GIF/WebP only)
- aggregate: `maxTotalTextBytes = 8 MiB`, `maxTotalMediaBytes = 16 MiB`
- head preview: `headBytes = 8 KiB`, `headTotalBytes = 4 MiB` (for files that exceed caps)
- full text is **inline by default** (opt-out `SAVANT_GRAPH_EXPORT_DOCUMENTS=0` or the
  hard-off `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1`); legacy 20-line/2,000-char `preview`s are
  opt-in in a separate field.

## 3. Current implementation (what the template actually does)

- **Inert payload, not an object literal** (from the 08-06 research): `<script
  type="application/json">` + `textContent` + `JSON.parse`. Only `<`, U+2028/U+2029 escaped.
  The browser `parses the entire ~15.6 MB JSON at load` (before any interaction), then
  builds the Graphology graph (2k+ nodes / 7.9k edges) synchronously and constructs
  `new Sigma(...)` with **zero layout math** (preset positions).
- **Interactivity model:** zoom-state machine (universe → system → neighborhood → detail);
  center "ROOT" planet with logo; region planets; corridor lines; folder tree drill-down;
  fuzzy search (`/`); node details sidebar; frameless draggable windows; ARIA labels;
  `prefers-reduced-motion` honored. Audio: Web Audio API, context unlocked on first gesture,
  6 short Kenney CC0 cues.
- **Robustness already present:** try/catch around Sigma init with a text-only fallback;
  graceful skip of image documents failing signature checks; verifies audio SHA-256 against a
  manifest before inlining; path traversal protection for document reads.
- **Load behavior:** parse 15.6 MB JSON → JSON.parse → build graph → WebGL init all happen
  synchronously on load; then an animated "fly to ROOT". Measured earlier (496 KB stage):
  interactive ~80 ms in headless Chrome — **at 17.1 MB that number is much worse but not yet
  re-measured; it is a unit to optimize**.

## 4. Why it grew: design history (decisions already made — do not relitigate without evidence)

- **2026-08-06 round (FID-2026-0806-017):** predecessor was 4.33 MB Cytoscape.js + COSE
  (client-side force layout, 2-minute freezes, ring-of-blobs). Operator chose **export-time
  ELK two-stage container layout** (elkjs 0.12.0 exact-pinned, EPL-2.0, build-time only WASM
  never shipped) over ForceAtlas2/d3-force (Gemini's original pick, demoted to fallback).
  Inert JSON + SVG icon sprite + preset + LOD + preview-default-opt-in; containers
  collapsed by default with tap-to-expand (visibility toggle, no relayout). Result: 496 KB
  artifact, interactive ~80 ms, ~17 s export wall time.
- **Since then (2026-08-06 → 08-07):** feature additions moved the file back UP:
  - inline file documents by default (FID-2026-0807-011) → ~12.5 MB,
  - 6 audio cues (Kenney CC0, sha256-verified, ~49 KB),
  - ~868 KB character watermark PNG in CSS,
  - region/corridor universe model + "Savant Code Code Universe" title bug,
  - stale references to the old Cytoscape stack remain in source comments and one unused
    constant module (the runtime is Sigma.js now).
- **Governance:** every change ships via a design doc that converges a Perfection Loop
  (RED → GREEN → AUDIT + two-method verification, grep for callers of new `pub fn`s). New
  surfaces require a "Five Questions" verdict: work for ALL cases; scale 1,000×; survive
  hostile inputs; maintainable in 2 years; industry standard.

## 5. Constraints (before you "fix" it, know the walls)

- **Single-file**, `file://`, zero network — **debate this, don't assume it's sacred.**
- **Deterministic output**: same repo → byte-stable export (we already accept one exception:
  minute-resolution footer timestamp; must keep or tighten).
- **No new runtime app build step for the end user** — everything the browser needs is
  embedded at export time or synthesized client-side.
- **No web fonts, no CDN, no external WASM at runtime** — any decompression / codec /
  worker must come from bytes already inside the file (DecompressionStream, embedded
  worker blob, embedded brotli/gzip payloads are all in-scope).
- The export is a **static report**, not a live app; one-time export cost (CLI side) is
  acceptable up to ~30 s.

> **§6.2 is allowed to reject this entire constraint set.** If the framework verdict is
> "go all-in on Next.js", then single-file, `file://`, determinism, and zero-network are
> all on the table as *changed* properties — argue each explicitly instead of assuming
> the walls survive the pivot.

## 6. What we need from this research

### 6.1 The single-file question (decisive verdict required)

We are deliberately opening the "single-file HTML" assumption we made in round 1. Evaluate
and then rule one way or the other, with concrete trade-off analysis:

1. **Lazy/deferred doc loading:** documents are the biggest bucket (12.5 MB). In a
   single-file world, could docs ship compressed (gzip/brotli+base64) and decompress
   on-demand via browser `DecompressionStream` (usable from `file://`)? What are real,
   cited browser support + size ratios? Is a 12.5 MB → ~3 MB win realistic for natural-
   language + code docs? Quantify with real compression tests or published ratios.
2. **Split the payload across inert `<script>` blocks by section** (meta / universe /
   documents) to parse only the universe + lazy-parse documents on first open — does that
   change memory/latency meaningfully? Lazy JSON-per-document blocks? What is the best
   "define/lazy" cut `file://` allows?
3. **Multi-file alternative (open question):** drop the single-file constraint and ship
   `index.html` + `data.json.gz` + `assets/` (sibling files, still offline, still
   zero-network)? What breaks (double-click habits, sharing, emailing)? When is a
   **directory** actually a better artifact? What about a "self-consuming blob"
   (`data:` URL) or a tiny local `--serve` command as an alternative entry point for huge
   repos?
4. **Other formats:** should there be a size/cluster cutoff where the export *changes
   format* (e.g. small repos → single HTML; large repos → gzip directory or
   pre-extracted)? Where is the crossover (5 MB? 50 MB? 2k files? 20k files)?
5. **Response:** deliver ONE recommended architecture for the current 2k-file/17 MB case,
   plus a decision rule for what to do at 10k files / 50 MB.

### 6.2 The full-framework question: should we abandon the static artifact for Next.js?

We are deliberately asking whether the single-file static HTML **model itself** should be
replaced by a full modern web framework (the operator's candidate: **Next.js**). This is a
product-strategy question as much as an engineering one. Decide it decisively; do not hedge.

Context you must weigh (and cite):

- **The job (§1) vs. what a served app changes:** local double-click file → hosted URL;
  share-as-file → share-as-link; fully offline → network-dependent; deterministic snapshot
  → live/mutable; zero hosting cost → deployment + ops + auth. For each change, say whether
  the new property is *worth* what it costs for the showcase surface.
- **Confidentiality is the big one:** the payload carries the **user's actual source code**
  (2,076 inline documents, up to 8 MiB of source text). A local file exfiltrates nothing; a
  hosted app stores/serves the user's proprietary code. Who runs the instance (user,
  product, Vercel)? What is the threat model (auth, SSO, per-org isolation, retention,
  encryption)? If the answer is "we'd never host user source", say so plainly and derive the
  architecture from it.
- **What a framework would actually buy:** enumerate concrete Next.js-enabled features and
  rank by value: server-side full-source search, per-user/private instances, live DB reads
  (no re-export), multi-user, SSO/RBAC, AI-summary endpoints, persistent annotations, API
  surface for the graph. Which of these does the job in §1 actually need?
- **What is already server-independent:** the expensive parts (ELK positions, doc embedding,
  clustering) are computed **at export time in Bun**; the browser client is already a thin
  WebGL renderer. A framework does not move that computation — be explicit that the pivot
  buys *serving*, *state*, and *composition*, not *layout performance*.
- **Middle paths to evaluate (do not skip):**
  (a) **Hybrid:** keep the single-file artifact for report/share/offline AND ship a served
      Next.js "live Code Universe" reusing the same Sigma/Graphology client + serializer
      output as an API — one design system, two delivery modes;
  (b) **Local serve:** a `--serve` command that streams the existing DB over HTTP on
      localhost (no hosting, but live and fast) — does this capture 80% of the framework
      value at 5% of the cost?
  (c) **SSG:** a static-site-generator directory output (still files, but deployable to
      GitHub Pages/Vercel) — middle ground between single-file and full server app;
  (d) **Full pivot:** Next.js App Router app with the graph as a client component, data via
      route handlers/server components.
- **If the verdict is Next.js:** give the concrete recipe — version, App Router vs Pages,
      how Sigma.js/Graphology fits (client component; canvas can't SSR), how the ~15.6 MB
      JSON reaches the client (compressed route handler? edge streaming? client fetch?),
      hosting + auth model, and what happens to the offline story (does the export still
      exist as a downloadable artifact?).
- **If the verdict is "stay static":** give the same depth of evidence for *why* the served
  model fails the §1 job — don't just default to the status quo.

### 6.3 Wasted payload (dead weight we already know about)

1. **Legacy `elements` array (~1.5 MB, 10,023 entries) is never read by the Sigma.js
   browser.** Options: drop from output; keep in a separate optional inert block "for
   tooling"; move behind `SAVANT_GRAPH_EXPORT_TOOLING=1`. Pick one, propose the type change
   (drop from `GraphUniverse` vs keep separate).
2. **~868 KB watermark PNG in CSS.** How cheaply can it be made a no-visual-regression
   cost? (downsize to WebP? drop below 100 KB? keep it as an inline `<img>` but only when
   the page is idle?). Is it worth a “hide watermark on small screens” (mobile memory)?
3. **Title "Savant Code Code Universe"** — double "Code" — trivial fix, note it.
4. **Stale docs/comments** referencing the old Cytoscape stack + one unused bundled
   constant module (`CYTO_JS`) — confirm dead and propose removal safe-range.

### 6.4 Doc + JSON payload engineering

With docs at ~12.5 MB, the strongest levers:

- **Dict/token compression of repeating keys** (`"type":"IMPORTS"`, `"source":"file-N"`,
  `"label"`, `"text"`, … are massively repetitive). Cheap dictionary + index column vs
  brotli+DecompressionStream — which is actually quantified best for this shape?
- **Trim unknown fields** (`preview`, redundant `parent` vs the folder tree, edge fields
  duplicated between `universe.edges` and legacy `elements`).
- **Coordinate precision:** positions are rounded to 1 decimal already — quantify round-to-
  int cost (is 1-decimal essential for readable clusters at deep zoom?).
- **Given docs default-on:** should the default budget be lower (e.g. total text 8→3 MiB,
  docs off for >N files?) with an explicit opt-in per large dirs? What is the default that
  stays "wow" but doesn't silently 17 MB+?

### 6.5 Render-time scale

- Sigma.js/Graphology for 2k→20k nodes: WebGL1 vs WebGL2, node/edge count vs frame rate;
  hide-labels-below-zoom (LOD), edges-per-frame-throttle, WebGL worker offscreen? What are
  the actual Sigma.js tuning knobs for 7.9k edges, and what breaks reliable click targets
  when nodes are 2 px?
- Search index: current solution rebuilds on every keystroke? Propose on-load precompute
  vs lazy.
- Planet effects: a second full-canvas each frame for stars/planets at 60fps — cost at
  low-end mobile; given `prefers-reduced-motion` already honored, is the default
  `requestAnimationFrame` star field worth capping?

### 6.6 Robustness / hostile inputs

- **Paths/labels:** is `JSON.stringify` escaping safe against every injection vector a
  hostile repo can sneak into the payload (`</script`, `<!--`, `<style>`, `</style>`,
  U+2028/U+2029, control chars) once processed through `textContent`?
- **Huge single files:** 1 GB source file under 2 KB budget? We try `lineCount` + cap —
  edge cases (no trailing newline, NUL bytes in text docs, UTF-16/BOM detection, invalid,
  `stat` races while exporting a live tree).
- **Huge graphs:** 200k files? (80 MiB DB?) — where does export fail? Memory ceilings in
  Bun stage; ELK at 200k atom/layer — propose hard limits with graceful degrade (e.g. skip
  Stage 2 beyond N, approximate positions).
- **Platform policy:** What breaks on Windows `file://` (backslashes, long paths,
  `C:\` vs `/`), or on mobile Safari (Web Audio unlock, `DecompressionStream`,
  `OffscreenCanvas`, `WebGL2`) — and what is the safe, checked fallback ladder?

### 6.7 Broader improvements (beyond bytes and frameworks)

The operator asked for "any other improvements we should make to make this work" — sweep
the feature end-to-end for non-payload wins. Cover at least these, plus anything an
industry-standard tool in this class (Sourcegraph, Gephi, Understand, CodeSee,
CodeScene) has that we should adopt:

1. **Interactive contract tests.** Today correctness is asserted by a headless-Chrome
   harness manually + unit tests on the serializer; there is no automated browser test that
   drives the *interactive* surface (zoom states, search, document viewer, windows, audio
   unlock). What is the minimal Playwright/Puppeteer suite that would catch a regression in
   load-time interactivity at CI, and does the zero-network artifact make it hard?
2. **Determinism as a CI gate.** Same repo → byte-stable export is a hard law; is it
   asserted in CI (byte-compare two exports with the timestamp normalization)? Propose the
   exact gate.
3. **Freshness/integration with the CLI.** The export is a snapshot of the index at export
   time; is that the right mental model when the DB changes frequently? Options: versioned
   exports with a diff view, auto-regenerate on re-index, a "indexed at" + staleness hint in
   the footer, or (ties into §6.2) a serve mode that tracks the live DB.
4. **Error-path UX.** If the export fails mid-way (audio sha mismatch, ELK timeout,
   document budget exhaustion producing truncated head-only docs inside a *working* export),
   what does the user see? Are the truncated-doc banners (which already exist as static
   text) enough, or should there be a summary pane of "N files truncated / M images
   skipped"?
5. **Accessibility completeness.** ARIA labels exist; is keyboard navigation complete
   (focus trap in windows, escape-to-close, tab order across the drill-down tree), and are
   the drag/window interactions reachable without a mouse?
6. **Search quality.** Fuzzy search currently matches path/label; should it index document
   *contents* (head text) for the 2k-file case, and what latency does that add vs the
   always-parse current JSON?
7. **Binary/runtime packaging.** `SIGMA_JS` is generated at build time (a checker script
   exists); if the sigma/graphology versions bump, is regeneration automatic in the binary
   build path, or is a stale vendored runtime possible?
8. **Two-year maintenance view.** Which current choices smell like debt: the vendored
   `elkjs` GWT-worker `new Function` sandbox, the deduped legacy `elements` dual-format
   serialization, the "Code Code" title, the unused `CYTO_JS` constant. Recommend a
   consolidation pass.

### 6.8 Deliverables

1. **A decisive "single-file vs split/compressed/served" verdict** for the 17 MB / 2,084-file
   case + a scale-out decision rule.
2. **A size-byte plan (the expected 17.1 MB → ?)** as a one-row table per lever with byte
   deltas (docs-compression, doc-budget default, watermark, dead elements, key-dict,
   position rounding), and the recommended combination.
3. **One primary implementation sketch** (Bun/pipeline + browser changes) with exact
   versions. Keep it honest about which parts are CLI-side vs browser-side.
4. **Where each computation happens today vs proposed** (export time vs load vs lazy).
5. **Buster of deferred-loading inside a 1-file, 0-network constraint**, including lazy JSON/
   block parsing strategies that stop synchronous 15.6 MB parse.
6. **"Five Questions" evaluation** of your primary recommendation (ALL cases / 1,000× /
   hostile / 2-year maintainability / industry standard) — each scored.
7. **Risks & pitfalls** (browser quirks now-cited, memory ceilings, debug hash shipping).
8. **A single-line framework verdict** (§6.2): stay-static / hybrid / local-serve / full-
   Next.js — plus, if not "stay static", the concrete recipe (version, delivery of the
   15.6 MB payload, hosting + auth + confidentiality model, what the offline story
   becomes). If "stay static", the falsifiable evidence for why served fails the §1 job.
9. **A ranked improvement backlog** (§6.7): each item scored effort × impact, with the
   top 5 recommended as the immediate next work items, and the CI/test-gate additions
   spelled out as concrete commands/assertions.

## 7. Response format

- Structured markdown with sections matching §6.1–§6.8; put the **single-line verdicts**
  first (VERDICT: …), then evidence, then plan.
- Every recommendation cites a real library/repo (name, version, license) — e.g. Sigma.js,
  Graphology, elkjs, brotli/gzip libs, `brotli-wasm`, `DecompressionStream`
  compatibility tables, Electron/Chromium WebAudio limits.
- Be decisive: one primary architecture, ranked alternatives as fallback only.
- Flag all that cannot be verified without machine access (e.g., benchmark of my 17 MB
  parse — give the method to measure it myself).

---

**Sign-off:** Prepared for a Gemini Deep Research pass, 2026-08-07. Local facts above are
measured from the actual current artifact (17,173,885 bytes; 2,084 files / 7,022 nodes /
7,925 edges / 22 regions / 301 folders / 2,076 inline docs; watermark, audio, legacy
elements explained; title bug quoted verbatim). The 2026-08-06 round is summarized in §4 to
avoid relitigating, per the ECHO protocol's "design history" rule. Scope for this round,
per operator: §6.2 (full-framework Next.js question) and §6.7 (broader improvements) are
explicit additions beyond the payload/robustness scope of the 08-06 round.