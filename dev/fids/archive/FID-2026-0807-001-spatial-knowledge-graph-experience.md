# FID: Spatial Knowledge Graph Experience — Hybrid Code Universe

**Filename:** `FID-2026-0807-001-spatial-knowledge-graph-experience.md`
**ID:** FID-2026-0807-001
**Severity:** high
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant 
**YAGNI-Compliance:** Verified

---

## Summary

The current knowledge-graph export is technically interactive but does not communicate a spatial knowledge graph. The
  collapsed overview shows roughly 14 container atoms and 36 root files while hiding the file-to-file edges whose
  relationships give the graph meaning. The visible nodes appear as sparse rows or isolated dots rather than an
  explorable information space; the sidebar identifies files primarily by basename rather than full path; and the dark
  Neon Slate styling lacks spatial hierarchy, region context, and meaningful relationship visibility. This FID defines
  a new multiscale spatial experience: a **hybrid map** in which directory/package regions provide the macro geography
  while existing community assignments influence placement, color, and density; **aggregated macro edges** summarize
  inter-region coupling; and exact file/symbol edges progressively appear at meso/micro zoom levels or focused
  exploration. The design preserves the self-contained offline artifact and export-time layout principle while
  replacing the current collapsed-only presentation with semantic zoom, visible relationship proxies, full-path
  identity, and a dark-space/constellation visual language.

## Environment

- **OS:** Windows 11 (`win32`), Chromium/Chrome
- **Language/Runtime:** TypeScript, Bun 1.3.14; self-contained offline HTML; Cytoscape.js currently embedded in the
  export
- **Current graph scale:** Approximately 2,084 file nodes, 2,098 total graph nodes, and 7,925 exact edges in the real
  export; 14 derived directory containers and 36 root files are initially visible
- **Current state:** FID-2026-0806-018 fixed the microscopic camera by adding compact overview coordinates, but the
  operator reports that the resulting view still looks like disconnected rows of dots rather than a spatial graph
- **Public research sources:**
  - Understand Anything: https://github.com/Egonex-AI/Understand-Anything
  - Understand Anything overview: https://understand-anything.com/
  - Cytoscape.js: https://github.com/cytoscape/cytoscape.js and https://js.cytoscape.org/
  - Sigma.js: https://github.com/sigmajs/sigma.js and https://www.sigmajs.org/
  - Emerge: https://github.com/glato/emerge
  - Gephi: https://gephi.org/
  - Uncharted multi-scale community visualization:
  https://uncharted.software/research/multi-scale-community-visualization/
  - Neo4j codebase knowledge graph discussion: https://neo4j.com/blog/developer/codebase-knowledge-graph/

## Detailed Description

### Problem

The operator's live export shows approximately 20 visible dots representing files such as `.env.example` and
  `bunfig.toml`, with no visible connected file set. The graph appears as two rows of circles with large gaps, not as
  a connected network. This is not merely a color or padding issue:

1. Collapsed containers hide child files.
2. File-to-file edges are incident to hidden children and therefore do not render in the collapsed overview.
3. Directory containers are rendered as isolated nodes rather than visible spatial regions with relationship
  corridors.
4. The current layout is a layered ELK arrangement, which produces orderly rows but not organic network neighborhoods.
5. There is no macro-level edge representation between visible regions.
6. Labels and sidebar identity are insufficient for codebase exploration because the basename alone is ambiguous.
7. The current visual treatment has dark colors but lacks spatial depth, region boundaries, density cues, focus
  neighborhoods, and relationship animation.

The result is a valid HTML page with a graph engine, not an understandable interactive knowledge space.

### Expected Behavior

On initial load, the operator should see a connected, spatially legible architecture universe:

- Major directory/package regions are visible as softly bounded territories.
- Existing community assignments influence node color, local attraction, and density without overriding directory
  geography.
- Weighted macro edges visibly connect regions; a repository with relationships should not look like isolated dots.
- Root files remain visible but do not dominate the scene as an unrelated row.
- Zooming changes semantic detail: regions → files → symbols/edge details, not merely the scale of the same row
  layout.
- Selecting or hovering a region reveals coupling strength and representative paths.
- Selecting a file reveals its full repository-relative path, file type, cluster/community, inbound/outbound
  connections, and preview when enabled.
- Focus mode highlights a selected file's one-hop/two-hop neighborhood while preserving a dimmed global context.
- The experience remains self-contained and offline, with no client-side force simulation or multi-second blocking
  layout.
- The page remains usable at approximately 2,000 files and 8,000 edges on ordinary desktop hardware.

### Root Cause

FID-2026-0806-018 solved the first camera-scale failure but retained the wrong information model. Its serializer emits
  compound containers and child offsets; its template collapses containers by hiding child nodes; and its visible-fit
  helper fits only those container/root elements. That makes the initial viewport compact, but it also removes the
  exact relationships that communicate graph structure. Public graph-visualization research consistently treats this
  scale as a multiscale problem: macro views use clusters/regions and summarized relationships; meso views reveal
  groups and files; micro views reveal exact dependencies. The current export has only a collapsed macro node set
  without macro relationship proxies, so it cannot visually express a connected architecture.

### Evidence

Local code evidence (ground truth for implementation planning):

```text
packages/knowledge-graph/src/export-serializer.ts:194-198
  SELECT source_id, target_id, type, weight FROM edges

packages/knowledge-graph/src/export-serializer.ts:240-250
  file children receive parent/containerId and childOffset;
  collapsed children do not receive an absolute position

cli/src/commands/graph-export/template.ts:293-294
  selector: 'node[?container].collapsed > node'
  style: { 'display': 'none' }

cli/src/commands/graph-export/template.ts:302
  'curve-style': 'haystack'

cli/src/commands/graph-export/template.ts:398-399
  search expansion removes the collapsed class on a parent

cli/src/commands/graph-export/template.ts:480-488
  sidebar reads the selected node data and renders `.sb-path`

cli/src/commands/graph-export/template.ts:482
  sb-path.textContent = d.path || d.label || ''
```

Independent live export observation:

```text
2,098 Cytoscape nodes
7,925 edges
50 initially visible nodes (14 containers + 36 root files)
0 visible edges in the collapsed overview because exact endpoints are hidden
Visible elements appear as sparse rows/dots rather than connected regions
```

Public research findings:

- Uncharted's multi-scale community-visualization research supports hierarchical levels of detail for large graph
  exploration: https://uncharted.software/research/multi-scale-community-visualization/
- Cytoscape.js provides compound nodes, collection/event APIs, and stylesheet-driven rendering, but does not
  automatically produce semantic edge aggregation; proxy data must be prepared by the application:
  https://js.cytoscape.org/ and https://github.com/cytoscape/cytoscape.js
- Understand Anything publicly demonstrates code exploration through graph views, drill-down, and dependency path
  finding: https://github.com/Egonex-AI/Understand-Anything
- Sigma.js and Graphology are public examples of GPU-oriented graph rendering with application-defined camera/cluster
  behavior: https://github.com/sigmajs/sigma.js
- Emerge publicly demonstrates code-specific dependency visualization with community/hull-oriented presentation:
  https://github.com/glato/emerge

### Five Questions

1. **Will it work for all cases?** It must support empty graphs, a single region, disconnected components, root files,
  highly dominant hubs, large dense directories, and repositories with weak or missing community assignments. The FID
  requires deterministic fallback regions and edges for every case.
2. **Will it scale to 1,000 agents?** The graph export itself is one artifact, but the architecture must be
  data-driven: regions, aggregates, LOD thresholds, and styling metadata are generated from typed graph data rather
  than hard-coded directory names or hand-authored visual exceptions.
3. **Will it survive hostile inputs?** All labels, paths, region names, and edge metadata remain inert JSON and
  textContent-rendered. Proxy IDs must be deterministic and escaped; no user-controlled graph value may become HTML or
  executable JavaScript.
4. **Will it be maintainable in two years?** Keep layout/aggregation in export-time TypeScript; keep browser logic
  limited to camera state, LOD visibility, selection, and interaction. Do not introduce a second client-side physics
  engine without a new FID.
5. **Does it set a strong industry standard?** A hybrid directory geography plus community-influenced placement,
  semantic zoom, weighted macro edges, exact micro edges, and full-path identity is a stronger code-exploration model
  than a collapsed tree or undifferentiated hairball.

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/containers.ts` — region and hierarchy metadata
- `cli/src/commands/graph-export/layout.ts` — macro/meso spatial coordinates and deterministic region layout
- `packages/knowledge-graph/src/export-serializer.ts` — proxy region nodes, aggregate edges, exact edges, path
  metadata
- `cli/src/commands/graph-export/template.ts` — semantic zoom, region styling, edge LOD, focus mode, full-path
  sidebar, spatial effects
- `cli/src/commands/__tests__/graph-export.test.ts` — contract and behavior tests
- `dev/test-prompts/graph-export-e2e.ts` — live artifact checks at fixture scale
- Generated export output — regenerated only after implementation; never hand-edited

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Primary visualization feature is technically functional but fails its user-facing purpose
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor or cosmetic issue

## Proposed Solution

### Approach

Build a three-level spatial graph while retaining export-time computation:

#### Level 1 — Architecture space

- Use directory/package-derived regions as the macro geography.
- Represent each region with a visible hull/territory or compound visual treatment, a label, file count, community
  summary, and coupling metrics.
- Compute deterministic region centers and spacing so regions form an organic architecture map rather than a layered
  row.
- Use existing cluster IDs as a secondary signal: color, local subregion placement, and density influence. Directory
  geography remains the stable primary coordinate frame.
- Keep root files in a dedicated `Root / repository` region or place them near the regions they connect to, instead of
  rendering them as a detached row.

#### Level 2 — Module/file space

- Render representative file nodes inside visible regions, with visibility governed by zoom/focus rather than an
  unconditional hidden-child state.
- Use node radius/halo for degree or importance, and restrained color for community/type.
- Reveal file labels only at a readable semantic zoom threshold; region labels remain at macro scale.
- Keep exact file nodes spatially related to their region and community neighborhood.

#### Level 3 — Detail space

- Reveal exact file-to-file edges when a region is focused or the camera reaches the file-level threshold.
- Keep exact edge type, direction, and weight available for hover/selection.
- Leave symbol-level detail as a data contract extension only if the current index contains symbol nodes/edges; do not
  invent symbol data in the renderer.

#### Dual edge model

- Generate deterministic aggregate edges between regions from exact file edges. Each aggregate ID is
  `aggregate:<source-region>:<target-region>:<direction>`, with region IDs escaped/encoded before embedding. Its data
  includes `sourceRegion`, `targetRegion`, `direction`, `edgeCount`, `totalWeight`, `typeCounts`, and a compact sorted
  `underlyingEdgeIds` list.
- Normalize aggregation direction as directed source-region → target-region. Preserve self-region exact edges
  separately; do not emit an aggregate self-loop unless a future FID defines a deliberate intra-region summary.
- At macro zoom, render only aggregate edges as visible weighted corridors. Their width/opacity communicates coupling
  without producing a hairball.
- At meso/micro zoom or region focus, hide or fade aggregate edges for the focused relationship and reveal exact file
  edges for the relevant regions. Never show both representations for the same relationship in the same LOD state.
- Aggregate edges are conservation-checked: every exact edge crossing two assigned regions contributes to exactly one
  aggregate; root/unassigned endpoints use the deterministic `region:root` region; disconnected components still
  retain their internal exact edges and have no invented cross-component aggregate.
- Aggregate edges are interactive: hover shows “N relationships between A and B”; click focuses the two regions and
  reveals the underlying edges through the lookup IDs.
- Exact edges remain the source of truth. Aggregates are derived presentation data, never a replacement for exact
  topology.

#### Expanded-space geometry and boundary relationships

- Keep the compact macro map independent from expanded local geometry. Each
  region receives a deterministic expanded-space envelope computed from its
  child layout, including padding for labels and interaction targets.
- When a region enters meso/micro, its children are placed in the region's
  reserved envelope rather than simply overwriting neighboring macro space.
  Adjacent expanded regions must be tested together on the real graph for
  envelope overlap; if they collide, the browser keeps the second region in
  focus+context mode or pans/zooms to a deterministic local view instead of
  silently stacking both layouts.
- An exact edge from a focused region to a collapsed region is represented by a
  boundary stub terminating at the collapsed region's macro anchor. The stub
  carries the exact edge count/type summary and can be clicked to expand the
  other endpoint. It must not render as an orphan edge to a hidden child.
- A focused region's exact internal edges may be visible while its outbound
  boundary stubs remain visible; aggregate corridors are suppressed only for
  the pair currently represented by exact/stub edges.

#### Semantic zoom and focus

- Maintain a throttled camera LOD state: `macro`, `meso`, `micro`, with hysteresis so transitions do not flicker:
  enter meso at zoom `>= 0.75`, return to macro below `0.65`; enter micro at zoom `>= 1.8`, return to meso below
  `1.55`. These are initial typed defaults and must be calibrated against the real artifact.
- Macro: visible region parents + aggregate edges + region labels; file children and exact file edges are hidden.
- Meso: visible region parents + file children for the focused/visible regions + selected exact edges + aggregate
  context; unrelated exact edges stay hidden.
- Micro: focused region/neighborhood + exact file edges + readable file labels and full paths in the sidebar.
- Apply LOD changes through one debounced/batched state transition per animation frame; do not mutate thousands of
  elements on every raw zoom event.
- Selection uses focus+context: selected node and one/two-hop neighborhood are bright; unrelated graph elements dim
  but remain spatially present.
- Search focuses the matching path/region and reveals its exact relationship neighborhood through the same LOD
  transition, not merely by removing a collapsed class.

#### Spatial visual language

- Keep the Neon Slate foundation but add a restrained space metaphor: deep radial background, subtle stars/particles,
  region halos, soft node glows, faint edge corridors, and animated pulses only for selected/active paths.
- Avoid decorative effects that obscure topology or cause continuous expensive redraws. Motion must be event-driven
  and respect reduced-motion preferences.
- Add a compact legend for region, community, node type, edge type, and LOD state.
- Add a minimap or region navigator only if the implementation can remain lightweight and keyboard/mouse accessible.

#### Full-path identity

- Sidebar path must show the complete repository-relative path, not only the basename.
- Preserve the basename as a title, but display the path as a copyable breadcrumb/code line with wrapping and a copy
  action.
- Region selection should show directory/package path, file count, community distribution, inbound/outbound coupling,
  and representative connected regions.
- Search results should include the full path and disambiguate same-named files.

### Steps

1. Extend the export data contract with region metadata, aggregate edges, LOD thresholds, degree/importance metrics,
  and full repository-relative path identity.
2. Refactor container derivation into explicit macro regions and deterministic region membership; preserve current
  flat-container fallback for degenerate repositories.
3. Add an export-time macro spatial layout and file placement strategy. Prefer a deterministic region layout plus
  community-influenced local placement; do not run a client-side force simulation.
4. Add aggregate region-edge generation from exact file edges, retaining a compact underlying-edge lookup for
  interaction.
5. Update the template renderer with macro/meso/micro LOD state, region visuals, aggregate/exact edge visibility,
  focus+context behavior, and full-path sidebar presentation.
6. Add tests for empty/single/disconnected/dense graphs, aggregate-edge conservation, deterministic coordinates, LOD
  transitions, full-path rendering, escaping, and no orphaned aggregate references.
7. Run the live fixture harness and the real export. Capture macro visible node/edge counts, initial bounds, zoom
  thresholds, region overlap, aggregate conservation, expansion behavior, search behavior, and browser console errors.
8. Perform independent code review and browser verification before marking the FID fixed.

### Verification

Static:

- `cd cli && bun run typecheck`
- `cd packages/knowledge-graph && bun run typecheck`
- `cd cli && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts`
- `cd cli && bun ../dev/test-prompts/graph-export-e2e.ts`
- ESLint with `--max-warnings 0` on changed files
- Prettier check on changed files
- FID-only markdownlint

Contract/runtime:

- Every exact edge belongs to zero or one aggregate region edge per defined aggregation key; aggregate counts/weights
  equal the sum of underlying exact relationships.
- Macro view contains connected region/aggregate-edge context whenever graph edges exist; it must not reduce to a
  detached row of root dots.
- Region rectangles/hulls do not overlap beyond the explicit padding allowance.
- Expanded-space envelopes for any two simultaneously opened regions do not
  overlap beyond the explicit padding allowance; a collision triggers the
  documented focused-local-view fallback.
- Boundary stubs represent every exact edge from an expanded region to a
  collapsed region and terminate at the collapsed region anchor.
- Initial macro view has bounded camera extent and no hidden-child coordinate leakage.
- Meso and micro transitions reveal exact relationships for the focused region without relayout or browser freeze.
- Search selects the full path, focuses the relevant region, and reveals its relationship neighborhood.
- Sidebar displays complete repository-relative path, type, cluster/community, metrics, connections, and safe preview
  fallback.
- Hostile labels/paths remain inert; no script or HTML injection.
- Empty, single-region, disconnected, root-only, and dense-hub fixtures remain usable.
- Real artifact opens from `file://` with zero non-GPU console errors and remains interactive after macro/meso/micro
  transitions.
- Respect `prefers-reduced-motion`; no continuous animation is required for topology correctness.

## Perfection Loop

### Loop 1 — RED

- **Finding:** The existing export's visible set is approximately 14 containers + 36 root files, while exact children
  and their edges are hidden. This produces a sparse row/dot view and no visible connected macro relationship layer.
- **Finding:** `export-serializer.ts` already has exact edge rows with source, target, type, and weight, so aggregate
  edges can be derived without changing the database schema.
- **Finding:** `containers.ts` derives directory/cluster containers but exposes only node membership; it does not
  currently provide region metrics, aggregate inter-region edges, or community density metadata.
- **Finding:** `template.ts` has a single collapsed selector and exact-edge style, but no macro proxy-edge model,
  camera LOD state, focus+context system, region hull/halo, or full-path copy/breadcrumb interaction.
- **Finding:** The sidebar currently uses `d.path || d.label`, but the operator experience indicates the rendered
  identity is still basename-dominant; the revised design must make the full path the primary disambiguating field and
  verify it in the live artifact.
- **Call graph:** `computeGraphLayout` is consumed by the graph export template; `serializeGraphForExport` is consumed
  by the template and existing tests/harness. New aggregate data must be wired through those same production entry
  points and tested for reachability.
- **External evidence:** Public multiscale graph research and public tools (Understand Anything, Emerge, Sigma.js,
  Cytoscape.js, Gephi) converge on clustering, semantic zoom, focus+context, and scale-dependent rendering rather than
  a single undifferentiated node layer.

### Loop 1 — GREEN

- **Selected architecture:** hybrid directory-region geography + community-influenced local placement; both aggregate
  macro edges and exact micro edges.
- **Rejected shortcut:** simply unhide all children and run a force layout in the browser. It would restore edges but
  recreate the performance risk that FID-017 was designed to eliminate.
- **Rejected shortcut:** add only glow/particles/CSS. Styling cannot solve missing macro relationships or the row
  layout.
- **Rejected shortcut:** replace the renderer immediately with Sigma.js. Sigma may improve raw WebGL rendering, but
  the current export already has Cytoscape interaction/compound behavior; a renderer migration should be a separate
  FID unless implementation evidence proves Cytoscape cannot meet the target.
- **Converged default:** keep Cytoscape.js as the renderer, generate all macro spatial coordinates and aggregates at
  export time, and implement browser-only state transitions and visibility/style changes.

### Missed Questions

1. **What is the macro geography?** → Hybrid: directory/package regions are the stable map; community assignments
  influence local placement, color, and density.
2. **What relationships are visible when children are collapsed?** → Aggregate region edges are visible at macro
  scale; exact edges appear progressively at meso/micro scale or focus.
3. **Should all 2,000 files be visible on first load?** → No. Start with regions and aggregate edges; reveal files
  based on zoom/focus. The first view must show connected architecture, not every label.
4. **Should root files form a row?** → No. Put them in a repository/root region or near connected regions, with a
  deterministic fallback for isolated roots.
5. **Are proxy edges authoritative?** → No. Exact edges remain canonical; aggregates carry underlying IDs/keys and
  conserved counts/weights.
6. **Which layout engine runs in the browser?** → None. Export-time TypeScript/Bun computes macro and local
  coordinates; browser only applies preset positions and LOD state.
7. **Should community assignments override directories?** → No. Directories provide geography; communities influence
  local arrangement and visual encoding.
8. **What is the first implementation boundary for symbols?** → Only if the current exported graph contains
  symbol-level nodes/edges. Otherwise implement file-level detail and create a follow-up FID for symbol expansion.
9. **How are dense hubs handled?** → Degree/importance affects node scale and focus priority; macro edges aggregate
  hub traffic; exact hub edges appear only in focus/micro views.
10. **How do users understand the space?** → Region labels, legend, minimap/region navigator if lightweight, hover
  summaries, selection focus+context, and full-path sidebar identity.
11. **What does “space effects” mean operationally?** → Event-driven halos, restrained glow, region boundaries, edge
  corridors, and selected-path pulses; no continuous expensive particle simulation.
12. **What happens for disconnected components?** → Treat each component as a separate deterministic island within the
  macro map and label it as disconnected; never force unrelated components into a false relationship.
13. **How are LOD thresholds selected?** → Derive thresholds from rendered node density and viewport size, begin with
  measured defaults, and expose them as typed constants so real-browser calibration can revise them without changing
  graph data.
14. **Can aggregate edges overlap?** → They may cross, but must be routed/curved and opacity-limited; region-level
  corridors should remain legible, and underlying exact edges must be available on focus.
15. **How is path identity presented?** → Full repository-relative path is always available in sidebar/search results;
  basename is a secondary title, not the only identifier.
16. **Does a visible region need to be a true Cytoscape compound parent?** → Yes for the first implementation. Reuse
  the existing compound parent relationship so region selection, child membership, and existing interaction APIs
  remain coherent. Macro parents stay visible while children/exact edges are hidden; meso/micro reveals children. Do
  not add a separate canvas-hull renderer in this FID.
17. **What is the exact aggregate-edge contract?** → One directed aggregate per ordered region pair and edge
  direction; deterministic ID, sorted underlying edge IDs, edge count, total weight, and type counts. Root files
  belong to `region:root`; unassigned/disconnected nodes never create invented relationships.
18. **How do macro and exact edges avoid double-rendering?** → LOD state owns visibility: macro = aggregate only; meso
  = aggregate context plus exact edges only for focused regions; micro = exact focused neighborhood. Every transition
  is batched and conservation-tested.
19. **How are expanded regions prevented from colliding?** → Each region receives a deterministic expanded-space
  envelope from its child layout. Adjacent-region expansion is tested at real scale; collision falls back to a focused
  local view or deterministic pan/zoom rather than stacking children.
20. **How are boundary edges represented?** → Exact edges from focused to collapsed regions become boundary stubs at
  the collapsed region anchor, with summary metadata and an expand action. They never point at hidden child
  coordinates.
21. **What is the renderer migration threshold?** → Keep Cytoscape for this FID. Create a separate
  renderer-performance FID only if measured macro/meso/micro interaction fails at the real graph after LOD and edge
  aggregation.
22. **What is explicitly out of scope?** → New database schema, LLM-generated semantics, online services, full symbol
  graph invention, continuous particle simulation, canvas-hull rendering, and renderer migration.

### Loop 2 — Self-Correction After AUDIT

- **RED:** The first audit found three implementation blockers: region representation was underspecified;
  aggregate-edge IDs/direction/conservation/root behavior were not concrete; and LOD thresholds/hysteresis plus
  full-path acceptance were not explicit.
- **GREEN:** Resolved by reusing Cytoscape compound parents for regions, defining deterministic directed aggregate IDs
  and conservation rules, adding `macro`/`meso`/`micro` thresholds with hysteresis and batched transitions, and making
  full-path visibility/copy behavior a runtime acceptance gate. The current renderer remains Cytoscape; no proxy
  canvas layer or renderer migration is introduced.
- **AUDIT:** The second independent audit passes the corrected region, aggregate, and LOD design. Implementation gates
  remain for deterministic root assignment, exact aggregate typing, live full-path usability, and real-scale LOD
  behavior. The thinker review additionally identified expanded-region collision and boundary-edge representation as
  required cases; both are now explicit in the approach, missed questions, and verification contract.
- **ADVERSARIAL:** The adversarial search confirms the current exact edge source, compound-parent linkage,
  collapsed-child selector, sidebar path field, layout caller, and graph-export tests/harness. No omitted production
  entry point was found. NEEDS-REVIEW remains only for implementation evidence, not the design contract.
- **FID verdict:** Design is converged for implementation planning; production code remains untouched until operator
  approval.

### Code Verification Evidence

- [x] Public external sources are cited by public URLs only; no local file path is used as external research evidence.
- [x] Current exact-edge data includes source, target, type, and weight in the export serializer.
- [x] Current container derivation and export layout are the production entry points for region membership and
  coordinates.
- [x] Current template has a collapsed-child selector, exact edge styles, search expansion, and sidebar path field.
  The FID targets these surfaces rather than inventing a parallel export.
- [x] Operator decisions recorded: hybrid directory/community map; both aggregate and exact edge levels.
- [x] Region representation resolved: Cytoscape compound parents for the first implementation; no separate hull
  renderer.
- [x] Aggregate contract resolved: deterministic directed region-pair IDs, type counts, weights, sorted underlying
  edge IDs, root fallback, and conservation checks.
- [x] LOD contract resolved: macro/meso/micro with hysteresis and batched/debounced transitions.
- [ ] Implementation pending; no production code changed by this FID authoring pass.
- [x] FID-only markdownlint passes:
  `bun x markdownlint dev/fids/FID-2026-0807-001-spatial-knowledge-graph-experience.md` → `MD_STATUS=0`.

## Resolution

- **Fixed By:** Superseded — design folded into FID-2026-0807-002
- **Fixed Date:** 2026-08-07
- **Fix Description:** Design-only FID; no production code changed. The
  conservative Cytoscape-compound region representation and the
  macro/meso/micro LOD contract were superseded by FID-2026-0807-002's
  renderer-neutral Sigma.js/Graphology universe (systems with aggregate +
  exact edge levels, spatial navigation states, search-to-travel).
- **Tests Added:** None (design-only)
- **Verified By:** RED/GREEN/AUDIT/ADVERSARIAL convergence; markdownlint clean
- **Commit/PR:** Pending operator push
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

A graph can be technically valid and still fail as a knowledge interface. The user must see relationships at every
  scale: aggregate relationships at the architecture level, exact relationships during focused exploration, and full
  identity for every selected information node. A dark theme and a working canvas are not substitutes for spatial
  semantics.
