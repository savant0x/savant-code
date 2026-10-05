# FID: Code Universe — WebGL Spatial Knowledge Graph Renderer

**Filename:** `FID-2026-0807-002-code-universe-webgl-renderer.md`
**ID:** FID-2026-0807-002
**Severity:** high
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant 
**YAGNI-Compliance:** Verified

---

## Summary

The knowledge-graph export is technically valid but fails the product requirement. It currently presents a collapsed
set of directory atoms and root files as sparse rows of circles, while hiding the exact relationships that make the
repository understandable. The operator has repeatedly specified a different target: an explorable **Code Universe**
where directory systems feel like planets or regions, dependency corridors visibly connect them, files appear as stars
and information objects, and camera movement flows from architecture space into local neighborhoods and file detail.

This FID replaces the prior conservative renderer decision with a WebGL-first spatial experience. The export data model
becomes renderer-neutral and multiscale; export-time graph computation produces deterministic coordinates, communities,
metrics, aggregate relationships, and boundary relationships; and the offline HTML renderer uses Sigma.js/Graphology or
the smallest equivalent WebGL stack that satisfies the contract. The primary visual experience includes deep-space
atmosphere, depth cues, region halos, glowing importance, animated camera transitions, connected relationship corridors,
and semantic zoom. `prefers-reduced-motion` changes motion behavior but does not remove spatial hierarchy, topology,
  glow,
or visual identity.

The Perfection Loop completed before implementation approval. Automation level 3 then authorized the implementation pass;
production and test changes are recorded below. The GPU visual gate remains explicitly open until the final artifact is
reviewed in a WebGL-capable browser.

## Environment

- **OS:** Windows 11 (`win32`); target browser Chrome/Chromium
- **Language/Runtime:** TypeScript, Bun 1.3.14, single self-contained `file://` HTML export
- **Current renderer:** Sigma.js + Graphology embedded in the export template; Cytoscape is historical context only
- **Current export layout:** export-time ELK/preset coordinates; no browser-side force simulation is allowed
- **Current graph scale:** 2,084 files, 7,022 total graph nodes, 7,925 exact edges, 54 regions, and 90 aggregate
  corridors in the regenerated real export
- **Existing graph packages:** `cli/package.json:40` contains `"elkjs": "0.12.0"`;
  `packages/knowledge-graph/package.json:31-32`
  contains `graphology` and `graphology-communities-louvain`. These are existing dependencies, not proof that a new
  WebGL renderer or all proposed metrics already exist.
- **Existing graph-export tests/callers:** `cli/src/commands/__tests__/graph-export.test.ts:14-15` imports the export
  command and `computeGraphLayout`; tests at `:171`, `:259`, and `:357` cover export output, layout contracts, and
  hostile graph data. The live harness enters through `dev/test-prompts/graph-export-e2e.ts:21` and `:131-134`.
- **Design input:** public-source research and the local research record
  `docs/research/Codebase Knowledge Graph Redesign.md`; external claims remain cited by public URLs in this FID

## Detailed Description

### Problem

The current artifact is a page containing a graph engine, not an explorable knowledge space:

1. Collapsed compound containers hide child files.
2. Exact file-to-file edges therefore have hidden endpoints and disappear from the first view.
3. Visible container atoms have no aggregate relationship corridors.
4. ELK's orderly disconnected layout produces rows/grid-like placement when the visible graph has little topology.
5. Directory containers do not communicate territory, scale, density, or coupling.
6. The interface lacks a spatial visual hierarchy: no meaningful depth, planet/system metaphor, connected corridors, or
   flow through the architecture.
7. The sidebar and search experience do not make the full repository-relative path the primary identity.
8. Earlier fixes optimized for technical validity and loading safety but did not satisfy the user's explicit visual
  goal.

### Product target: Code Universe

The first viewport must read as a connected information universe, not a file list or diagram. The user should be able
  to:

- pan through a deep-space environment containing architectural systems;
- see directory/package regions as large planetary or stellar territories;
- see aggregate dependency corridors connecting related systems;
- zoom from the repository universe into a system, then a neighborhood, then individual files;
- observe community structure through color, local constellations, density, and attraction;
- recognize high-degree or high-importance files as brighter/larger information stars;
- select a region and travel into it with a smooth camera transition;
- select a file and see its full path, role, metrics, neighbors, and active dependency paths;
- focus a path or neighborhood while preserving dimmed global context;
- use search to travel to a uniquely identified file or region;
- open the same artifact offline with no network requests and no browser-side physics freeze.

The visual metaphor is not decoration. Space, proximity, scale, glow, corridors, and movement are the information
encoding. A design that passes functional tests but still looks like two rows of disconnected circles fails this FID.

### Acceptance language

The following phrases are binding product requirements:

- **Universe:** an overview with connected systems, atmosphere, scale, and visible topology.
- **Planet/system:** a directory or package region with a visible territory, label, metrics, and local information
  field.
- **Flow:** camera travel, focus transitions, path highlighting, and progressive detail reveal.
- **Visual data:** node size, glow, color, density, corridor weight, region scale, and labels must encode graph facts.
- **Wow factor:** the first viewport and primary interactions must feel intentionally designed as an information-space
  experience, not merely decorated after a conventional graph is rendered.

## Evidence

### Local implementation evidence

```text
packages/knowledge-graph/src/export-serializer.ts:72
  export interface GraphUniverse

cli/src/commands/graph-export/template.ts:30-32
  generated shooting-star streaks and irregular space-stars markup

cli/src/commands/graph-export/template.ts:97
  <canvas id="planet-effects" class="planet-effects" aria-hidden="true"></canvas>

cli/src/commands/graph-export/template.ts:183
  sigma.getCamera().on('updated', function () { updateZoomState(); drawPlanetEffects(); });

cli/src/commands/graph-export/template.ts:267-276
  visibilitychange handler cancels hidden-tab animation frames and redraws after resume

cli/src/commands/graph-export/template.ts:279-319
  reduceNode/reduceEdge/isContextNode preserve dimmed global context during focus

cli/src/commands/graph-export/template.ts:372-379
  neon scrollbar styling and reduced-motion CSS policy
```

### Independent observation

The counts and behavior below are recorded from the real-export probe documented in the preceding graph-export work and
must be regenerated and rechecked during implementation. They are planning evidence, not a substitute for the final
browser audit.

```text
2,098 graph nodes
7,925 exact edges
approximately 50 initial visible objects
0 useful visible exact edges in the collapsed overview
rows/dots rather than connected regions or spatial neighborhoods
```

### Public design references

- Sigma.js: https://github.com/sigmajs/sigma.js and https://www.sigmajs.org/
- Graphology: https://graphology.github.io/
- Cytoscape.js: https://js.cytoscape.org/
- Understand Anything: https://github.com/Egonex-AI/Understand-Anything
- Emerge: https://github.com/glato/emerge
- Uncharted multiscale visualization: https://uncharted.software/research/multi-scale-community-visualization/
- Gephi: https://gephi.org/

The public sources support multiscale rendering, community-aware exploration, and GPU-oriented network rendering. They
do not by themselves prove a specific frame rate, layout quality, or successful offline bundle. Those are implementation
acceptance gates below, not assumed facts.

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/export-serializer.ts` — renderer-neutral regions, exact edges, aggregate edges,
  boundary relationships, metrics, paths, and safe metadata
- `packages/knowledge-graph/package.json` — export-time graph/layout dependencies if required
- `cli/package.json` and lockfile — WebGL renderer and offline bundling dependencies
- `cli/src/commands/graph-export/containers.ts` — deterministic region membership and spatial metadata
- `cli/src/commands/graph-export/layout.ts` — deterministic macro geography and constrained local placement
- `cli/src/commands/graph-export/template.ts` — Code Universe renderer, camera, semantic zoom, interaction, and
  offline asset embedding
- generated graph-export bundle/constants — only if the existing generation pipeline requires new bundled assets
- `cli/src/commands/__tests__/graph-export.test.ts` — data, bundle, interaction, and safety contracts
- `dev/test-prompts/graph-export-e2e.ts` — real fixture export, browser/HTML assertions, and performance capture
- real generated export — regenerated only after implementation and verification; never hand-edited

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Primary visualization feature fails its intended user experience
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue or cosmetic edge case

## Proposed Solution

### Architecture decision

Adopt a **renderer-neutral multiscale data model with a WebGL-first renderer**.

- Sigma.js plus Graphology is the default implementation target because the product requires a rich spatial scene at
  graph scale and the existing Cytoscape compound model has already produced the wrong first-view information model.
- The implementation must not assume Sigma automatically provides clusters, semantic zoom, shaders, or offline
  bundling. Those are explicit application responsibilities and must be implemented and tested.
- Sigma may be substituted only if a prototype/build gate shows that its bundled runtime cannot satisfy the offline
  artifact contract, required interactions, or measured performance budget. The substitute must be named in the FID,
  preserve the same serialized data and acceptance contracts, and receive explicit operator approval before code is
  changed. A failed prototype must never silently restore the old collapsed Cytoscape view.
- Cytoscape is not the target renderer for the final Code Universe artifact. Existing Cytoscape behavior may be used as
  a migration reference, but preserving compound-node mechanics is not a reason to preserve the failed visual model.
- No client-side force simulation is permitted. All topology metrics, communities, coordinates, region envelopes, and
  aggregate relationships are computed during export.

### Renderer-neutral graph contract

The serialized model must contain flat, typed records that can be rendered by WebGL without compound-node geometry:

#### Region records

Each directory/package/root region contains:

- stable repository-relative region ID;
- safe display path and label;
- macro position and reserved envelope;
- file count, exact-edge count, inbound/outbound coupling, and community summary;
- visual color family and importance scale derived from graph data;
- list or index of child file IDs;
- disconnected-component status when applicable.

Regions are visible spatial objects at macro scale. Their territory is represented by a region field/halo/orbit
  treatment,
not by hidden children being responsible for parent geometry.

#### File records

Each file contains:

- stable repository-relative file ID;
- basename and complete repository-relative path;
- region ID and community ID, with deterministic fallback when unavailable;
- export-time x/y position within the reserved region envelope;
- in-degree, out-degree, weighted degree, and normalized importance;
- safe type/language metadata and optional preview according to existing preview policy.

#### Exact edges

Exact file-to-file edges remain canonical and retain source, target, type, direction, and weight. They are rendered at
micro scale or during focused exploration, never replaced by aggregate records.

#### Aggregate corridors

For every directed cross-region relationship group, emit one deterministic aggregate corridor:

```text
id: aggregate:<encoded-source-region>:<encoded-target-region>
sourceRegion: string
targetRegion: string
edgeCount: number
totalWeight: number
typeCounts: Record<string, number>
underlyingEdgeIds: string[]
```

Every cross-region exact edge contributes to exactly one aggregate. Intra-region edges are not invented as aggregate
self-loops. Aggregate totals conserve the cross-region exact-edge count and weight, while internal exact relationships
remain available in meso/micro views. Root files use a deterministic `region:root` region. No relationship is invented
for disconnected components.

#### Boundary relationships

When a focused region exposes a file whose neighbor remains outside the focused detail set, emit or derive a boundary
relationship that terminates at the neighboring region's macro anchor. It must carry count/type/weight context and must
never point to a hidden or stale child coordinate.

### Export-time spatial computation

1. Normalize exact graph nodes and edges from the existing serializer.
2. Derive deterministic regions, root fallback, and disconnected components.
3. Compute community assignments using the existing graphology/Louvain capability when graph data supports it; use a
   deterministic fallback community when it does not.
4. Compute degree/importance metrics needed for visual encoding. Do not add expensive metrics that are not rendered or
   tested.
5. Build aggregate corridors before layout so relationship mass influences geography.
6. Compute a deterministic macro layout with connected regions attracted by aggregate weight and disconnected regions
   placed as bounded peripheral systems. Use deterministic initial coordinates and a bounded iteration/time budget.
7. Compute constrained local file coordinates inside each region's reserved envelope. Community membership influences
  local
   constellation placement without allowing files to escape their region.
8. Validate finite coordinates, envelope padding, deterministic repeatability, and aggregate conservation before HTML is
   emitted.
9. Serialize the result as inert JSON inside the single HTML artifact. No graph value may become executable JavaScript.

ForceAtlas2/Barnes-Hut or another export-time algorithm may be used where it produces better measured results, but the
algorithm is subordinate to deterministic bounds, overlap tests, disconnected fallback, and reproducibility. The FID
does not claim that any algorithm automatically produces a good universe.

### Code Universe visual system

The primary renderer must implement the following, not merely expose CSS hooks:

- **Deep-space scene:** dark radial space background with layered, subtle star fields and depth/parallax cues behind the
  graph; no network assets.
- **Systems/planets:** region territories rendered as large soft fields, cores, rings/orbits, labels, and metric badges;
  visual scale must reflect region size/importance rather than arbitrary identical circles.
- **Information stars:** file nodes sized by degree/importance, colored by community/type, with a visible halo/glow that
  makes hubs distinguishable from leaves.
- **Relationship corridors:** aggregate edges are visibly connected, weighted, curved or visually routed where
  supported,
  and use restrained transparency so coupling reads as flow instead of a hairball.
- **Flow:** camera travel uses eased transitions between universe, system, and neighborhood; selected paths receive an
  event-driven directional pulse or moving highlight, while unrelated topology dims but remains spatially present.
- **Semantic zoom:** macro shows systems/corridors; meso shows selected systems plus files and boundary relationships;
  micro shows file neighborhoods, exact edges, labels, and path detail. Thresholds use hysteresis and transitions are
  batched per animation frame.
- **Navigation:** region navigator/minimap, reset-universe control, fit-system control, search-to-travel, keyboard
  focus,
  and escape-to-return behavior are required if they can be implemented without obscuring the scene.
- **Identity:** the sidebar always makes the complete repository-relative path primary, with basename as a title and a
  copy action. Search results show enough parent path to disambiguate same-named files.
- **Accessibility:** focus rings, keyboard controls, text alternatives/metrics for selected objects, adequate contrast,
  and a `prefers-reduced-motion` mode that keeps topology, depth cues, glow, and hierarchy while disabling parallax,
  pulses, and eased travel. This is an alternate motion policy, not a reduction of the primary Code Universe visual
  target.

Continuous decorative animation is not required. The primary experience is allowed to be visually rich; motion is
  limited
only where it would obscure topology, harm accessibility, or violate measured performance. “Reduced motion” is an
alternate motion policy, not a downgrade to a plain page.

### Interaction state machine

Use explicit typed states with hysteresis:

- **Universe:** regions, aggregate corridors, region labels, atmospheric depth.
- **System:** selected region territory, local files, inbound/outbound boundary relationships, neighboring systems.
- **Neighborhood:** selected file and one/two-hop neighborhood, exact edges, path highlighting, dimmed context.
- **Detail:** selected file identity, full path, metrics, connections, preview, and related navigation actions.

Camera zoom, explicit selection, search, corridor click, and escape/back actions must transition through one shared
  state
machine. The implementation must not have separate incompatible code paths for search, click, and zoom.

### Offline artifact and security contract

- The output remains one self-contained HTML file opened by `file://`.
- Renderer code, fonts/icons, shader/program code, graph JSON, and visual assets are bundled or inlined; no CDN, fetch,
  WebSocket, worker URL, or network request is required at runtime.
- The implementation must define one reproducible CLI bundle step that emits the renderer/runtime assets into the
  export template. The command, source entry, generated constant/file, and template import point must be named in the
  implementation FID update; a generic “bundle it” step is not sufficient. The real artifact must record byte size for
  HTML, graph payload, renderer payload, and visual assets; the initial target is under 5 MB, with any exception
  documented in the implementation audit.
- The browser harness must instrument `window.fetch`, `XMLHttpRequest`, WebSocket construction, and resource loads, then
  assert zero network requests after opening the artifact from `file://`. Static `file://` loads are checked by
  inspecting
  the artifact for external URLs and by recording the browser's resource/network log; an uninstrumentable browser event
  must be marked `NEEDS-REVIEW`, never assumed to be zero.
- Inert JSON remains the data boundary. Labels, paths, IDs, and previews are rendered through text/typed renderer APIs,
  never unsanitized `innerHTML` or executable interpolation.
- Malformed or hostile paths must not break IDs, HTML, WebGL buffers, search, or sidebar rendering.
- If WebGL initialization fails or the context is lost, show a useful text/metrics fallback and preserve search/path
  access rather than leaving a blank page.

## Implementation Steps

1. Add and verify the renderer-neutral graph types and region/aggregate/boundary data contract.
2. Refactor region derivation and export-time layout around deterministic macro envelopes and community-aware local
   placement.
3. Add aggregate corridor construction and conservation tests.
4. Add the WebGL renderer bundle and offline asset generation/embedding path.
5. Implement the Code Universe scene, region systems, node importance, corridors, camera state machine, semantic zoom,
   focus paths, and full-path sidebar.
6. Add reduced-motion, keyboard, WebGL-fallback, hostile-input, and disconnected-graph behavior.
7. Update unit tests and the live fixture harness for structural, visual-contract, offline, and performance assertions.
8. Generate the real repository export and inspect it in Chrome at actual scale. Capture screenshots/metrics for
  universe,
   system, neighborhood, and detail states.
9. Run independent code review, typechecks, tests, lint, markdownlint, and browser verification before marking the FID
   fixed.

## Verification and Acceptance Gates

### Static and contract gates

- `cd cli && bun run typecheck`
- `cd packages/knowledge-graph && bun run typecheck`
- graph-export unit tests pass
- knowledge-graph unit tests pass
- changed-file ESLint passes with zero warnings
- Prettier check passes
- FID markdownlint passes
- production call-graph searches prove the new renderer, aggregation, layout, and state-machine entry points are wired

### Data correctness gates

- Every exact cross-region edge maps to exactly one aggregate corridor.
- Aggregate cross-region counts and weights equal the sums of their underlying exact edges.
- No aggregate self-loop is emitted for an intra-region edge.
- All nodes receive a region, including root-only and disconnected cases.
- Coordinates are finite, deterministic across two exports, inside their declared envelopes, and non-overlapping within
  the documented padding tolerance.
- No boundary relationship references a hidden child coordinate.
- Hostile labels and paths remain inert and searchable without HTML/script execution.

### Spatial experience gates

- The real export's first viewport contains visible connected regions and aggregate corridors whenever cross-region
  edges exist; a row of isolated dots is an explicit failure.
- At least one region visibly reads as a territory/system with scale, halo/ring/depth treatment and a meaningful label.
- Hub files are visually distinguishable from leaves by measured graph metrics.
- Browser evidence records screenshots or equivalent captured visual artifacts for Universe, System, Neighborhood, and
  Detail states. Each capture must show the expected state label, connected topology, and the relevant visual encoding;
  a subjective claim without captured evidence is `NEEDS-REVIEW`, not PASS. The rubric is: Universe shows at least two
  distinct region territories and one visible weighted corridor; System shows one selected territory plus a local file
  constellation and neighboring boundary relationship; Neighborhood shows a selected file, visible exact relationships,
  dimmed context, and a path/highlight treatment; Detail shows the complete path, metrics, connections, and safe preview
  state. Every capture must show that no layout/physics progress indicator or blank canvas is present.
- A human visual review must confirm that the artifact communicates a spatial information universe rather than rows of
  circles. The review is explicitly part of AUDIT and cannot be replaced by unit-test counts. The reviewer must record
  PASS/FAIL for territory, topology, depth, flow, visual data encoding, and identity; any failed category returns the
  FID
  to SELF-CORRECT.
- A corridor click, region click, search result, and file click all enter the same shared navigation state machine.
- Universe → system → neighborhood → detail transitions preserve spatial context and do not trigger browser-side layout.
- Exact file relationships become visible in focused views without exposing the entire graph as a hairball.
- Full repository-relative paths are visible, copyable, and disambiguate repeated basenames.
- Reduced-motion mode retains topology, visual hierarchy, and depth cues while disabling parallax/pulse/eased motion.

### Runtime and performance gates

Targets are measured on the real export and recorded; they are not assumed from library marketing:

- first meaningful universe render target: under 2.5 seconds on the test desktop;
- no synchronous browser layout or multi-second main-thread physics stall;
- interactive panning/zooming remains usable at approximately 2,000 files and 8,000 edges;
- no repeated multi-second freezes during universe/system/neighborhood transitions;
- offline artifact makes zero network requests after opening;
- no non-GPU browser console errors;
- WebGL fallback remains usable when context creation fails.

If the chosen WebGL renderer cannot meet the contract or offline constraints, the implementation must record the
  measured
failure and propose the smallest renderer change in a follow-up FID. It must not silently revert to the old collapsed
Cytoscape view.

## Perfection Loop

### Loop 1 — RED

- **Finding:** The existing collapsed compound-node model hides exact endpoints and produces approximately 50 visible
  objects with no useful macro topology. Evidence: `cli/src/commands/graph-export/template.ts:293-294` contains the
  collapsed-child `display: none` selector; `template.ts:349` uses preset layout; the real export observation records
  2,098 nodes, 7,925 edges, and zero useful initial visible edges.
- **Finding:** Existing exact edge rows already contain source, target, type, and weight. Evidence:
  `packages/knowledge-graph/src/export-serializer.ts:194-198` contains the edge query.
- **Finding:** Existing layout is a production entry point but is not sufficient for the requested visual model.
  Evidence:
  `cli/src/commands/graph-export/layout.ts:220` exports `computeGraphLayout`; `template.ts:70` consumes it.
- **Finding:** The current package graph has Graphology/Louvain capability but no Sigma renderer dependency. This is a
  real dependency/bundle task, not a CSS-only change.
- **Finding:** The previous FID over-weighted renderer continuity and explicitly rejected the visual atmosphere, depth,
  and
  movement that the operator identified as core requirements. That scope decision is corrected here.
- **Call graph:** Existing production entry points are the graph export command, serializer, layout, template, tests,
  and
  live harness. The new renderer and state machine must be wired through those paths; compilation alone is insufficient.

### Loop 1 — GREEN

- **Selected architecture:** renderer-neutral flat multiscale graph data plus WebGL-first Code Universe renderer.
- **Selected visual priority:** atmosphere, systems, corridors, information stars, flow, and semantic zoom are required
  behavior, not optional polish.
- **Selected computation boundary:** metrics, communities, aggregate corridors, envelopes, and coordinates are computed
  at export time; the browser renders and navigates without physics.
- **Selected compatibility boundary:** Cytoscape compound parents are not preserved as the final visual model. Region
  records are independent spatial objects so their territory does not disappear when children are hidden.
- **Selected safety boundary:** reduced motion, hostile-input safety, offline fallback, and WebGL failure handling are
  mandatory alternate modes, not reasons to remove the primary visual experience.
- **Rejected shortcut:** adding only glow, stars, or CSS to the existing collapsed rows. It cannot restore missing
  topology.
- **Rejected shortcut:** showing every exact edge and every label at once. It recreates the hairball and fails
  exploration.
- **Rejected shortcut:** browser-side force simulation. It recreates the original freeze.
- **Rejected shortcut:** claiming Sigma/WebGL guarantees a frame rate without measuring the real artifact.

### Missed Questions and Answers

1. **Have we already made the visual target clear enough?** → Yes. “Code Universe” is now a binding acceptance
   requirement, with universe, planet/system, flow, visual data, and wow-factor definitions.
2. **Is atmosphere optional polish?** → No. Background depth, region fields, hubs, corridors, and movement encode graph
   meaning and are required.
3. **Does reduced motion justify removing the experience?** → No. It disables motion-specific effects while preserving
   topology, depth cues, glow, and hierarchy.
4. **Must Sigma be used even if it cannot satisfy offline constraints?** → No. WebGL-first is binding; the renderer may
  be
   the smallest equivalent self-contained implementation if it preserves the contract and records the decision.
5. **What is the atomic visual object?** → A file is an information star; a directory/package is a system/territory;
   aggregate and exact relationships are corridors/paths.
6. **How do we avoid false planet metaphors?** → Region size, color, glow, labels, and corridor weight must derive from
   actual file counts, communities, degree, and edge weights. No purely decorative random sizing.
7. **How are disconnected regions shown?** → Bounded peripheral systems/orbits with explicit disconnected status; never
   invented edges.
8. **What happens if a graph has no communities?** → Deterministic fallback community/color assignment keeps the scene
   coherent without inventing semantic meaning.
9. **Can all 8,000 exact edges be visible?** → Only in a focused/filtered neighborhood when measured legibility permits;
   aggregate corridors represent global coupling.
10. **What must survive a WebGL failure?** → Search, full paths, metrics, relationship summaries, and a usable text
  view;
    never a blank artifact.
11. **How do we prevent stale coordinates after navigation?** → Coordinates are immutable export data; camera/state
    changes do not mutate layout or recompute physics.
12. **How do we prove the wow factor rather than self-report it?** → Browser acceptance captures the real export in all
    four states and records visible-region/edge counts, transitions, console output, offline requests, and visual review
    evidence. A technically passing export that still looks like rows fails.
13. **What is the renderer migration boundary?** → This FID authorizes the WebGL-first renderer work. Any fallback or
    replacement must preserve the same serialized contract and acceptance gates; no silent regression to the old view.
14. **What is out of scope?** → Live editing, online services, invented AST symbol data, continuous particle simulation,
    and a promise of a fixed FPS independent of hardware. The spatial experience itself is not out of scope.

### Loop 1 — AUDIT

- **PASS — ECHO workflow:** This FID is design-only; no production code or generated export is changed before
  convergence.
  The complex architecture meets FID-bound execution criteria from ECHO.md.
- **PASS — current call graph:** `cli/src/commands/graph-export/template.ts:46` exports
  `buildGraphExportHtml`; `cli/src/commands/graph-export/layout.ts:220` exports `computeGraphLayout`; the existing
  tests import `computeGraphLayout` and the template consumes it. New entry points must retain this reachability.
- **PASS — data source:** `packages/knowledge-graph/src/export-serializer.ts:194-198` provides the exact edge fields
  required for aggregate construction.
- **PASS — visual scope:** The FID explicitly requires the user's universe/planet/flow experience and does not classify
  those requirements as optional aesthetic over-engineering. The binding definitions appear in `Problem` and `Product
  target: Code Universe`; implementation review remains required for the subjective visual result.
- **PASS — existing dependency evidence:** `cli/package.json:40` shows the current `elkjs` dependency;
  `packages/knowledge-graph/package.json:31-32` shows Graphology and Louvain; these citations support the dependency
  inventory only, not the existence of Sigma or a completed WebGL pipeline.
- **PASS — test/harness reachability:** `cli/src/commands/__tests__/graph-export.test.ts:14-15` imports the production
  graph-export command and layout; `dev/test-prompts/graph-export-e2e.ts:21` imports the command and `:131-134` invokes
  `/graph-export`. The implementation audit must add equivalent callers for new renderer/data entry points.
- **ADJUSTED — renderer claim:** Public library descriptions support WebGL capability, but not an unconditional 60 FPS
  guarantee. The FID therefore uses measured runtime targets and a fallback contract instead of a marketing claim.
- **ADJUSTED — force layout claim:** ForceAtlas2/Barnes-Hut is permitted but not treated as automatically deterministic
  or visually correct. Deterministic seeds/initial positions, bounded iterations, finite-coordinate checks, and fallback
  layouts are acceptance requirements.
- **ADJUSTED — renderer substitution gate:** Sigma.js is the default target. A substitute renderer requires a measured
  prototype failure against the offline bundle, interaction, or performance gates plus explicit operator approval; it is
  not an informal implementation-time preference.
- **ADJUSTED — aggregate conservation:** Conservation is defined for cross-region exact edges only; intra-region edges
  remain exact and do not become aggregate self-loops.
- **NEEDS-REVIEW — live browser wow-factor:** The design contract is explicit, but visual quality, actual frame
  behavior,
  and WebGL context fallback cannot be proven until the implementation and real export are run in Chrome. This is an
  implementation gate, not a reason to reject the FID. The required evidence is now defined as four state captures plus
  a human visual review in the Spatial experience gates.

### Loop 1 — ADVERSARIAL

- **CONFIRMED:** The previous plan was too conservative relative to the operator's repeated product direction. The new
  FID makes the Code Universe experience binding.
- **CONFIRMED:** Aggregate relationships and multiscale data are required to avoid both disconnected dots and a
  hairball.
- **CONFIRMED:** Export-time computation and inert JSON preserve the performance and security constraints from FID-017.
- **ADJUSTED:** “WebGL solves performance” is rejected as an unsupported absolute claim; measured targets and fallback
  behavior are required.
- **ADJUSTED:** “Cytoscape is impossible” is not required to justify the migration. The product failure is sufficient:
  the final renderer must satisfy the Code Universe contract, and the current collapsed compound model does not.
- **CONFIRMED:** `prefers-reduced-motion` is an alternate motion policy, not a reason to remove atmosphere, hierarchy,
  topology, or visual identity.
- **CONFIRMED:** The offline contract now requires a reproducible bundle path, payload accounting, and instrumented
  zero-
  network evidence rather than the vague phrase “bundled or inlined.”
- **OMISSION CHECK:** The FID includes data correctness, offline bundling, hostile inputs, disconnected graphs, shared
  navigation state, visual acceptance, reduced motion, WebGL failure, call-graph reachability, and real-export review.
  No actionable omission remains for design convergence.

### FID implementation verdict

The implementation pass is complete for the measurable data, offline, export, fallback, and code-quality gates. The real
export was regenerated at `C:\\Users\\spenc\\dev\\savant-code\\dev\\exports\\graph\\savant-graph.html` and measured
at 3.23 MB with 2,084 files, 7,925 exact edges, 54 regions, and 90 aggregate corridors. The live fixture harness passes
16/16; focused graph-export tests pass 16/16; the knowledge-graph package passes 17/17; both typechecks, ESLint,
Prettier, and FID markdownlint pass. Chrome loaded the file, removed the loading state, and emitted zero console errors.
The available browser runs have alternated between WebGL unavailable and WebGL available; the final GPU scene, four-state
visual captures, and human wow-factor review remain `NEEDS-REVIEW` until captured against the final regenerated artifact.

## Code Verification Evidence

- [x] ECHO.md reread before FID creation and planning.
- [x] Existing FID-2026-0807-001 reviewed; its conservative renderer decision is superseded by this FID's explicit
  product-direction correction.
- [x] Existing graph-export production entry points and consumers identified.
- [x] Exact edge source and current collapsed rendering behavior cited.
- [x] Public sources used for external renderer/design claims; no local path is presented as an external URL.
- [x] RED, GREEN, AUDIT, and ADVERSARIAL sections completed.
- [x] Missed questions surfaced and answered.
- [x] Production implementation, tests, bundle generation, and real export completed under automation level 3.
- [x] FID-only markdownlint passed after final formatting: `MD_STATUS=0`; rerun after any FID edit.
- [x] Final measured evidence recorded: focused tests 16/16; knowledge-graph tests 17/17; live harness 16/16;
  CLI and knowledge-graph typechecks 0; changed-file ESLint 0 warnings; changed-file Prettier 0 errors.
- [x] Browser file:// load verified with zero console errors and usable fallback; final WebGL scene audit remains
  `NEEDS-REVIEW` until captured against the regenerated artifact.

## Resolution

- **Fixed By:** Savant  (automation level 3)
- **Fixed Date:** 2026-08-07
- **Fix Description:** Implemented renderer-neutral Code Universe serialization, export-time region/file layout, aggregate
  corridors, Sigma/Graphology offline bundle, spatial navigation states, search-to-travel, copyable full-path sidebar,
  reduced-motion toggle, multi-edge support, optimized export metrics, and WebGL fallback. Follow-up polish added a
  cyberpunk ambient layer: irregular drifting stars, cyan/magenta shooting-star streaks, dark neon scrollbars, and
  canvas-rendered system halos with inner strokes, broken orbital rings, pulsing beacons, and reduced-motion-safe
  camera synchronization. Selection now preserves dimmed global context instead of hiding all unrelated topology.
- **Tests Added:** Updated graph-export contract tests and live fixture harness; focused 16/16, knowledge-graph 17/17,
  live harness 16/16.
- **Verified By:** Independent implementation review; typecheck/lint/format gates; live fixture harness 16/16;
  Chrome file:// load with zero console errors from the prior renderer pass. The latest real export regenerated at
  3,255,756 bytes in 14.56 seconds. The browser visual gate for the final cyberpunk layer and all four states remains
  `NEEDS-REVIEW` until the regenerated artifact is captured in a WebGL-capable Chrome session.
- **Commit/PR:** Pending operator push
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

When an operator repeatedly describes the desired interaction as a universe, the metaphor is a product requirement, not
optional decoration. Safety constraints should shape the implementation and provide fallback modes; they should not
silently reduce the requested experience to a technically safe but visually failed diagram.
