# FID: Graph Export — Fit the Visible Collapsed Overview

**Filename:** `FID-2026-0806-018-graph-export-visible-overview-fit.md`
**ID:** FID-2026-0806-018
**Severity:** medium
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant 
**YAGNI-Compliance:** Verified

---

## Summary

The FID-2026-0806-017 graph-export overhaul successfully loads Cytoscape and
renders the offline artifact, but the operator sees a blank or effectively empty
canvas on first open. The new drill-down behavior hides file children by adding
`collapsed` to every container, while the initial camera and toolbar Fit command
call `cy.fit(undefined, 60)`, which fits all graph elements rather than only the
visible overview. On the real export, 2,098 nodes are positioned but only 50 are
visible initially; fitting the full approximately 43,613 × 45,020 coordinate
extent makes the visible container overview microscopic. The first attempted
fix was a small shared visible-element fit path, but the real-artifact browser
audit proved that visibility scoping alone is insufficient:
visible container atoms still span tens of thousands of layout units because
Stage-1 ELK sizes them from their fully expanded child extents. The converged
revision is **compact export-time overview coordinates plus preserved drill-down
child offsets**. The export will retain the per-container ELK child geometry,
run a second deterministic ELK pass over fixed-size container/root atoms, emit
compact center positions for the collapsed overview, and emit center-frame child
offsets plus a stable overview anchor. The browser will apply offsets on both
click and search expansion without running layout math; initial and toolbar Fit
will target the compact visible overview.

## Environment

- **OS:** Windows 11 (`win32`), Chromium/Chrome
- **Language/Runtime:** TypeScript, Bun 1.3.14; Cytoscape.js 3.30.2 inlined in the export
- **Tool Versions:** `elkjs` 0.12.0 exact-pinned for export-time layout; repository version 0.0.21
- **Commit/State:** Existing FID-2026-0806-017 implementation in the working tree; generated artifact at `dev/exports/graph/savant-graph.html`

## Detailed Description

### Problem

The generated file is structurally valid and initializes successfully, but the
operator reports that opening it is "completely blank." Browser inspection of
the exact `file://` artifact found no console errors, `window.cy` exists, the
loading overlay is hidden, and Cytoscape creates canvas layers. The failure is
visual: the camera is fitted to hidden child positions instead of the visible
collapsed overview.

The current template has three relevant behaviors:

1. `cli/src/commands/graph-export/template.ts:305` adds `collapsed` to every
   container after Cytoscape is ready:

   ```js
   cy.nodes('[?container]').addClass('collapsed');
   ```

2. `cli/src/commands/graph-export/template.ts:316` fits the complete graph in
   the first animation frame:

   ```js
   cy.fit(undefined, 60);
   ```

3. `cli/src/commands/graph-export/template.ts:319` gives the toolbar Fit action
   the same all-elements behavior:

   ```js
   function fitGraph() { if (cy) cy.fit(undefined, 60); }
   ```

The search path is intentionally different at
`cli/src/commands/graph-export/template.ts:345`: it fits only the matching
collection. Container expansion is also intentionally different at
`template.ts:367`, where it fits the expanded container itself.

Runtime evidence from the exact generated artifact:

```text
Artifact: C:\Users\spenc\dev\savant-code\dev\exports\graph\savant-graph.html
Payload: 2,098 nodes, 7,925 edges, 14 container nodes; all 2,098 nodes have finite positions
Initially visible: 50 nodes
Position extent: approximately x=12..43,613 and y=12..45,020
Browser: 0 console errors, Cytoscape instance present, loading overlay hidden
Observed result: visible overview is too small to perceive and is reported as blank
```

### Expected Behavior

- The initial page shows the collapsed container/overview nodes at a readable
  scale immediately after load.
- The toolbar Fit action fits the current visible graph, not hidden children.
- Clicking a container expands it without relayout and fits the selected
  container as before.
- Search continues to expand matching containers and fit the matching nodes.
- The export remains a single self-contained offline HTML file with the ELK
  precomputed positions and FID-017 performance characteristics unchanged.
- If a future or degenerate export has no visible nodes, fitting must fail
  safely without throwing or leaving the page in an unrecoverable state.

### Root Cause

FID-017 introduced collapsed compound containers, but its camera operations and
coordinate model were not designed for a compact overview. First,
`cy.fit(undefined, padding)` targeted hidden child coordinates. FID-018's first
implementation changed that to `cy.nodes(':visible')`, but the real artifact
still rendered at the minimum zoom because visible container atoms themselves
were positioned using Stage-1 ELK dimensions derived from full child extents.
Second, the current layout exposes one position map with no declared coordinate
frame: ELK child coordinates are top-left positions while Cytoscape node
positions are centers. Finally, compound parents may resize/reposition when
children become visible, so expansion cannot use a live parent position as a
stable anchor. The fix is therefore a layout/serialization/browser-coordinate
contract correction, not just a camera-fit change.

## Evidence

Static evidence:

```text
cli/src/commands/graph-export/template.ts:305
  cy.nodes('[?container]').addClass('collapsed');

cli/src/commands/graph-export/template.ts:316
  cy.fit(undefined, 60);

cli/src/commands/graph-export/template.ts:319
  function fitGraph() { if (cy) cy.fit(undefined, 60); }

cli/src/commands/graph-export/template.ts:345
  if (matches.length > 0) cy.animate({ fit: { eles: matches, padding: 60 }, duration: 250 });

cli/src/commands/graph-export/template.ts:367
  cy.fit(node, 80);

cli/src/commands/__tests__/graph-export.test.ts:195-196
  expect(html).toContain('collapsed')
  expect(html).toContain('node[?container].collapsed > node')
```

Independent runtime evidence from the exact artifact:

```text
Cytoscape initialized: true
Console errors: 0
Loading overlay: hidden
Total nodes: 2,098
Visible nodes at initial state: 50
Total edges: 7,925
Containers: 14
All nodes with finite positions: 2,098
```

The blank appearance is therefore reproducible as a camera-scale failure even
though the page's JavaScript runtime is healthy.

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts` — initial and toolbar camera-fit calls
- `cli/src/commands/__tests__/graph-export.test.ts` — static contract assertions for visible-fit behavior
- `dev/test-prompts/graph-export-e2e.ts` — offline export contract and optional live behavior checks
- `dev/exports/graph/savant-graph.html` — regenerated artifact after implementation; not a source change

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (manual zoom/Fit may not reliably recover the overview)
- [ ] Low: Minor or cosmetic issue

## Proposed Solution

### Approach

Use two deterministic coordinate products from the export-time layout, with
explicit coordinate-frame semantics:

1. **Child/detail pass:** retain the existing ELK per-container child layout.
   Normalize each child from ELK's top-left coordinates into a center-frame
   offset relative to the child-layout bounding-box center. Round offsets to one
   decimal place. This preserves internal ELK spacing and avoids shipping a
   second full absolute position for every child.
2. **Compact overview pass:** run ELK over container atoms and ungrouped root
   files using fixed small atom sizes (container `120 × 36`, file
   `FILE_NODE_W × FILE_NODE_H`), not child-derived bboxes. Convert ELK's
   top-left atom coordinates to Cytoscape center coordinates. This pass provides
   compact positions for all initially visible containers and root files.
3. **Serializer contract:** extend the export element data with a typed child
   offset and container overview-anchor field. Container/root nodes receive
   compact center positions. Child nodes receive their parent assignment and
   center-frame offset; their initial position may be the parent's compact anchor
   because children are hidden, but expansion must always set their positions
   from the stored anchor plus offset before revealing them.
4. **Shared browser expansion helper:** create one private helper used by both
   container taps and search auto-expansion. It reads the container's stored
   overview anchor, batches `child.position({ x: anchor.x + offset.x, y: anchor.y +
   offset.y })`, then removes `collapsed`, allowing Cytoscape to recalculate
   compound bounds before fitting the container. Collapse hides children and
   restores the stored overview anchor; it never invokes a layout algorithm.
5. **Camera behavior:** initial and toolbar Fit call the visible-node helper;
   search continues fitting matches; expansion continues fitting the selected
   container after the batch/style update. Empty collections are no-ops.

This keeps all expensive layout work in Bun, avoids a new exported API or
runtime dependency, preserves the FID-017 ELK architecture, and makes the
collapsed overview compact by construction.

### Steps

1. Extend the layout result with compact overview center positions, typed
   center-frame child offsets, and stable container overview anchors. Keep the
   existing child ELK pass and add a fixed-size atom overview pass.
2. Extend the serializer's element data/options to emit the offset and anchor
   fields without changing the existing `parent`/`containerId` relationship.
3. Update the template with one shared expansion helper for click and search,
   batched child position application, collapse anchor restoration, and visible
   overview fitting. Preserve match-only search fitting and selected-container
   fitting.
4. Update unit/static assertions for the coordinate contract, shared expansion
   path, preset layout, and unchanged offline/security behavior.
5. Extend the live harness or a temporary Chrome probe to assert compact initial
   bounds, zoom above the configured floor, no console errors, click expansion,
   search expansion, collapse restoration, and stable child offsets.
6. Regenerate the real export and measure artifact size, export time,
   deterministic output, initial overview bounds, internal child overlap, and
   edge behavior in collapsed and expanded states.

### Verification

- `cd cli && bun run typecheck`
- `cd cli && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts`
- `cd cli && bun ../dev/test-prompts/graph-export-e2e.ts`
- `bun x eslint . --max-warnings 0`
- `bunx prettier --check .`
- `bun run lint:md`
- Open `file:///C:/Users/spenc/dev/savant-code/dev/exports/graph/savant-graph.html`
  in Chrome and verify: no console errors, loading overlay hidden, visible
  overview readable, toolbar Fit readable, container expansion works, and
  search still reveals matching nodes.
- Runtime assertions: initial compact overview bounds stay below the agreed
  acceptance ceiling and `cy.zoom()` is above the configured minimum; no console
  errors; click and search use the same expansion helper; collapse restores the
  stored overview anchor; child offsets produce the same relative geometry on
  repeated exports; internal expanded-child overlap remains zero on the real
  graph; and collapsed/expanded edge behavior is explicitly recorded.

## Perfection Loop

### Loop 1

- **RED:** Confirmed the generated artifact is healthy but visually blank because
  the camera fits all positioned nodes while FID-017 hides most children. Static
  evidence is `template.ts:305`, `:316`, and `:319`; search and expansion already
  use intentional narrower scopes at `template.ts:345` and `:367`. Runtime
  evidence confirms 2,098 positioned nodes versus 50 initially visible nodes,
  with zero console errors. Existing tests cover the presence of collapse markup
  (`graph-export.test.ts:195-196`) but do not assert that initial/toolbar Fit
  uses visible nodes.
- **GREEN:** Converged on a minimal template-local `fitVisibleGraph` helper used
  by the initial overview and toolbar Fit. Keep search and container expansion
  fit scopes unchanged. Add static assertions and a live/browser check. Do not
  alter ELK, serialized positions, container derivation, collapse semantics,
  payload format, or the SVG sprite. This is a camera-scope correction, not a
  second layout redesign.
- **AUDIT (Verifier, code-reviewer-luna):** **PASS for the design; runtime
  evidence captured.** The verifier confirmed `template.ts:305` collapses
  containers before the `requestAnimationFrame` fit at `:313-317`, confirmed the
  all-elements fit defect at `:316`, confirmed the duplicate toolbar path at
  `:319`, and confirmed the intentionally narrow search and expansion scopes at
  `:345` and `:365-367`. It also confirmed that the existing test only checks
  collapse markup at `graph-export.test.ts:195-196`, not visible-fit semantics.
  The verifier marked the live browser claim NEEDS-REVIEW until runtime evidence
  was captured; the parent session's independent Chrome inspection supplied it:
  the exact `file://` artifact loaded with zero console errors, Cytoscape
  initialized, the loading overlay hid, 2,098 nodes and 7,925 edges were present,
  and only 50 nodes were visible initially. The audit therefore accepts the
  proposed fix but requires implementation-time browser assertions for readable
  visible bounds.
- **ADVERSARIAL (read-only meta-audit):** **PASS with one clarification.** No
  omitted production fit caller was found beyond the Fit button's
  `onclick="fitGraph()"` at `template.ts:114` and the implementation at `:319`.
  The visible-fit helper must be evaluated after collapse, must no-op for an empty
  visible collection, and must not replace the match-only search fit or the
  expanded-container fit. Clarification folded into Missed Questions: toolbar
  Fit intentionally resets to the current visible graph after search auto-expands
  a parent; search itself remains match-only. No new exported API or dependency
  is warranted.
- **CHANGE DELTA:** FID-only design change; the first implementation pass was
  intentionally limited to the approved helper/test scope, but runtime evidence
  below shows that scope is insufficient for the real ELK geometry.

### Loop 2 — Self-Correction After Runtime Failure

- **RED:** The visible-fit helper was implemented and independently exercised on
  the regenerated real artifact. Targeting `cy.nodes(':visible')` changed the
  fit collection from all 2,098 nodes to 50 nodes, but did not make the overview
  readable. The 14 visible container atoms still span approximately
  `24,833 × 43,085` layout units, and 36 ungrouped root files extend the visible
  bounds to approximately `26,905 × 43,128`. Chrome reports `zoom: 0.05`, the
  configured minimum, with container nodes rendered as sub-pixel points. The
  exact runtime probe reported:

  ```text
  nodes=2098, edges=7925, visible=50, loading=none, console errors=0
  zoom=0.05
  visible bounding box={x1:-21,y1:1.5,x2:26884.95,y2:43129.5,w:26905.95,h:43128}
  ```

  Therefore the original GREEN hypothesis — that visibility scoping alone
  solves the blank appearance — is **refuted by runtime evidence**. The helper
  itself is correct but insufficient.
- **GREEN (revised design pending operator choice):** The robust fix must make
  the collapsed overview spatially compact, not merely fit a large hidden-aware
  collection. Three options were evaluated:

  1. **Export-time overview coordinates (recommended):** keep the ELK child
     coordinates for drill-down, but compute a second deterministic compact
     overview position for each container and ungrouped root node at export time.
     The browser uses overview positions while collapsed and restores the
     precomputed drill-down positions on expansion. This preserves the
     source-exact ELK layout and keeps all geometry decisions out of the browser,
     at the cost of a small serialized overview-position field and a state
     toggle.
  2. **Export-time atom-size/spacing correction:** cap or normalize Stage-1 ELK
     container atom dimensions so the container positions are compact, then
     offset child coordinates consistently. This changes the existing ELK
     geometry globally and risks invalid parent extents or child overlap unless
     remeasured at scale.
  3. **Browser-only camera crop/zoom:** fit containers, then impose a readable
     minimum zoom and allow some overview nodes to fall outside the viewport.
     This is the smallest code change but does not provide a complete overview
     and violates FID-017's zero-layout/faithful-overview intent; it is rejected
     as a final architecture.

  Default: option 1, unless the operator selects another option. No further
  production edits should occur until this revised scope is approved.
- **AUDIT:** The first implementation audit passed the helper's local logic but
  failed the real-artifact acceptance criterion. Static gates remained green:
  graph-export tests 10/10, CLI typecheck clean, e2e 15/15, ESLint/Prettier/
  markdownlint clean. Runtime audit failed readability, so FID status remains
  `analyzed` and the partial helper change is not considered complete.
- **ADVERSARIAL:** Confirmed the runtime failure is substantive rather than a
  console/runtime failure: Cytoscape initializes with zero errors, but the
  visible overview's coordinate extent forces the minimum zoom. The Adversary
  rejects declaring the FID fixed based only on node visibility count.
- **CHANGE DELTA:** Self-correction adds the compact-overview architecture
  decision; no additional production code is authorized until selected.

### Missed Questions

1. **Should Fit include hidden children for a global map, or only visible nodes?**
   → Only visible nodes. The initial UX is explicitly a collapsed overview;
   fitting hidden coordinates makes that overview unreadable. Users can expand
   containers or search to inspect child regions.
2. **Should initial fit and toolbar Fit behave identically?**
   → Yes. Both represent the overview-fit action and must use the same helper;
   divergence would recreate the bug after the user clicks Fit.
3. **Should container expansion continue fitting the container rather than all
   visible nodes?** → Yes. The existing `cy.fit(node, 80)` is intentional and
   gives drill-down focus. It must not be replaced by the overview helper.
4. **Should search fit all visible nodes after auto-expansion?** → No. Search
   already fits the matched collection, which is the least surprising behavior
   and avoids zooming to unrelated overview nodes.
5. **What if there are no visible nodes?** → The helper must be a no-op. The
   loading/status UI remains usable, and no empty Cytoscape collection should
   cause a runtime exception.
6. **Could `:visible` include edges or hidden descendants unexpectedly?** → Use
   the node collection (`cy.nodes(':visible')`) for the overview because the
   camera target is node geometry; edges remain incidental to the viewport.
7. **Does this change alter the FID-017 performance guarantees?** → No. It is a
   single collection query and camera fit; it does not invoke a layout algorithm,
   alter payload size, or add a dependency.
8. **Do we need to change the pre-generated HTML artifact in source control?**
   → No source artifact should be hand-edited. Regenerate it through
   `/graph-export` after implementation; generated export output remains
   regenerable and ignored according to the repository policy.
9. **Is a new exported utility warranted?** → No. The behavior is specific to
   the self-contained generated template; a private template-local helper is
   sufficient and avoids API surface.
10. **What should toolbar Fit do after search auto-expands a parent?** → It
    should fit the current visible graph, intentionally resetting from the
    search-match camera to the visible overview. Search remains match-only and
    continues to fit its own result collection.
11. **Is fitting visible nodes alone sufficient at real-repository scale?** → No.
    The runtime probe shows that visible container atoms can still be tens of
    thousands of layout units apart because Stage-1 ELK sizes atoms from their
    full child extents. The overview needs compact export-time positions or a
    deliberately accepted cropped camera; the former is the robust default.
12. **Should compact overview coordinates replace drill-down coordinates?** → No.
    Preserve both coordinate systems: compact overview center positions plus
    center-frame child offsets. This avoids relayout and keeps the expensive
    layout entirely at export time.
13. **What coordinate frame is serialized?** → All Cytoscape `position` values
    and child offsets are center coordinates. ELK top-left output is converted by
    adding half the relevant node width/height before serialization. Child
    offsets are measured from the child-layout bounding-box center, including
    ELK padding in the bounding-box calculation.
14. **Can expansion trust `node.position()` as the anchor?** → No. Compound
    parent bounds can change when children become visible. Serialize a stable
    `overviewPosition` on every container and use that stored value before
    revealing children; collapse restores it. Runtime tests must assert no
    cumulative drift across expand/collapse cycles.
15. **Are nested containers supported?** → No nested containers are emitted by
    the current folder-LCP/cluster derivation; the implementation must assert a
    flat parent relationship. If nested input ever appears, fail the export with
    a clear error or create a follow-up FID rather than applying an incorrect
    one-level offset rule.
16. **What happens to collapsed inter-container edges?** → Existing edges are
    file-to-file and hidden when both endpoints are hidden. Do not invent a new
    edge aggregation layer in this FID; record this as an accepted drill-down
    behavior and test that edges reappear correctly when their endpoint
    containers are expanded. A future container-edge overview is a separate FID.
17. **How are empty/single-child containers handled?** → Reuse
    `deriveContainers`'s current flatten/omission behavior. Only emitted
    containers with at least one serialized child receive an overview anchor;
    root files remain direct overview nodes.
18. **How are style/bounds updates ordered?** → Set child positions inside a
    Cytoscape batch, remove `collapsed` in the same batch, then schedule the
    container fit after the batch/style update. Never fit before children become
    visible, or the parent bounding box may be stale.

### Code Verification Evidence

- [x] `ECHO.md`, `AGENTS.md`, `protocol.config.yaml`, TypeScript standards, and
      `templates/FID-TEMPLATE.md` reread before FID authoring.
- [x] Existing FID-017 and its Nova audit response reread; this FID is a narrow
      post-implementation follow-up and does not reopen FID-017's architecture.
- [x] Current production call sites found: `buildGraphExportHtml` is the only
      template builder caller; the affected camera calls are in the generated
      browser script and are covered by the template's HTML contract tests.
- [x] Implementation target files exist and match the current call graph:
      `cli/src/commands/graph-export/template.ts`,
      `packages/knowledge-graph/src/export-serializer.ts`,
      `cli/src/commands/graph-export/layout.ts`,
      `cli/src/commands/__tests__/graph-export.test.ts`, and
      `dev/test-prompts/graph-export-e2e.ts`.
- [x] Implementation files contain the compact-overview coordinate contract:
      `layout.ts` `computeGraphLayout` returns `overviewPositions` /
      `overviewAnchors` / `childOffsets` (compact fixed-size ELK pass +
      center-frame offsets); `export-serializer.ts` emits `overviewPosition` /
      `overviewAnchor` / `childOffset` and omits absolute positions on children;
      `template.ts` shares one `expandContainer`/`collapseContainer` helper used
      by both tap and search expansion, positions children at anchor + offset
      inside a batch, and fits visible nodes on initial load and toolbar Fit.
- [x] Typecheck passes: `cd cli && bun run typecheck` → 0 errors;
      `cd packages/knowledge-graph && bun run typecheck` → 0 errors.
- [x] Targeted tests pass: `graph-export.test.ts` → 11 pass / 0 fail (incl. the
      new FID-018 coordinate-contract test); `dev/test-prompts/graph-export-e2e.ts`
      → 15 pass / 0 fail. ESLint `--max-warnings 0` clean; Prettier clean.
- [x] Current artifact runtime baseline independently captured: Chrome loaded
      `file://.../savant-graph.html` with zero console errors, Cytoscape present,
      loading hidden, 2,098 nodes, 7,925 edges, and 50 initially visible nodes.
- [x] Post-fix browser probe (headless Chrome, real artifact): initial zoom
      **0.39** (was clamped at 0.05), visible bbox **1,337 × 764** (was
      26,905 × 43,128); container expand reveals all 21 children with no drift
      across collapse/re-expand; zero console errors.
- [x] FID status reflects actual state: `fixed` (implementation + independent
      verification evidence recorded in Loop 5 / Resolution).

### Loop 3 — Revised Design Convergence

- **RED:** Re-read the failed FID-018 implementation, `layout.ts`,
  `containers.ts`, `export-serializer.ts`, `template.ts`, graph-export tests,
  and the live-export harness. The failure is confirmed as geometry, not
  initialization: fitting visible nodes still includes 14 widely separated
  container atoms and 36 root files. Current code still emits compound
  `data.parent` links at `packages/knowledge-graph/src/export-serializer.ts:205`,
  and current expansion fitting remains intentionally scoped to
  `template.ts:375` (`cy.fit(node, 80)`).
- **GREEN:** Converged on two export-time coordinate products: a compact,
  fixed-atom ELK overview plus preserved per-container child geometry encoded as
  center-frame offsets and stable overview anchors. The browser will apply
  offsets in a shared click/search expansion helper, restore the anchor on
  collapse, and never run a layout algorithm. Nested containers are explicitly
  rejected by invariant; collapsed file-to-file edge aggregation remains out of
  scope.
- **AUDIT (Verifier):** **PASS for design convergence, with implementation
  acceptance gates retained.** The revised FID explicitly defines ELK
  top-left-to-Cytoscape-center conversion, padding/bounding-box treatment,
  stable-anchor semantics, flat-container handling, empty/single-child behavior,
  batch/style ordering, and unchanged search/container fit scopes. The final
  read-only call-graph audit confirmed the existing paths: compound parent
  linkage at `export-serializer.ts:205`, initial collapse at
  `template.ts:314`, match-only search fit at `template.ts:355`, and selected
  container fit at `template.ts:375`. Markdownlint passed with `MD_STATUS=0` and
  `FID_REVISED_STRUCTURE=PASS`.
- **ADVERSARIAL:** **PASS — no remaining omission found in the revised plan.**
  The adversarial search found no additional production `fit` caller, no
  contradiction with the current parent/child serializer shape, and no need for
  a new exported API or dependency. It confirms that the implementation must
  treat compound parent position as unstable after child visibility changes and
  use the serialized overview anchor instead. Runtime readability, expansion,
  collapse-drift, and real-scale overlap remain implementation-time verification
  gates rather than unearned static claims.
- **FID verdict:** **CONVERGED / IMPLEMENTATION-READY.** Status remains
  `analyzed` because no revised production implementation has been performed.
  The prior helper-only code is not declared a complete fix until the compact
  coordinate contract is implemented and the live artifact passes the stated
  acceptance checks.

### Loop 5 — Implementation Verification

- **FORGE:** Implemented the converged FID-018 scope (Hybrid Mode):
  - `cli/src/commands/graph-export/layout.ts` — `computeGraphLayout` now runs a
    second deterministic ELK pass over the same atom set with fixed container
    sizes (120 × 36), converts ELK top-left output to Cytoscape center
    coordinates (`overviewPositions`), and derives `overviewAnchors` (the
    container's compact overview center, so expanded children center on the
    container) plus `childOffsets` (child center minus child-layout bbox
    center). The legacy FID-017 `positions` map is unchanged.
  - `packages/knowledge-graph/src/export-serializer.ts` — new optional
    `overviewPositions`/`overviewAnchors`/`childOffsets` options; emits
    `overviewPosition` + `overviewAnchor` on containers, `childOffset` on
    children (no absolute position), and overview positions on ungrouped roots.
  - `cli/src/commands/graph-export/template.ts` — shared `expandContainer` /
    `collapseContainer` helpers used by both container taps and search
    auto-expansion; children positioned at `anchor + offset` inside
    `cy.batch(...)` before `collapsed` is removed; initial and toolbar Fit use
    `fitVisibleGraph()`.
  - `cli/src/commands/__tests__/graph-export.test.ts` — multi-directory fixture
    + new coordinate-contract test (emitted fields, no absolute child
    positions, determinism).
- **AUDIT (Verifier):** Independent review of the implementation: **PASS** with
  one applied correction — the expansion anchor was changed from the
  child-layout bbox center to the container's compact overview center so
  expanded children center on the container itself (finding 1); the remaining
  notes (bbox assumes non-negative ELK coords; test extraction robustness) were
  evaluated and accepted, with a finite-coordinate assertion added to the
  contract test.
- **ADVERSARIAL:** Runtime evidence is decisive — the real artifact's initial
  view is compact and readable. Independent headless-Chrome probe of the exact
  regenerated export: zoom `0.3900523560` (min 0.05), visible bbox
  `{x1:-71.75, y1:-23, x2:1265, y2:741, w:1336.75, h:764}`, 50 visible nodes
  (14 containers + 36 roots), first container `.agents` expands all 21
  children with a stable container position, collapse → re-expand reproduces
  the identical child position `(602, 26)` — zero drift, zero console errors.
  Regenerated artifact: 1.92 MB, 2,084 file nodes, 14 containers, 36
  positioned overview nodes, overlap scan 0 collisions, byte-identical
  deterministic output.
- **FID verdict:** **FIXED** — the converged design is implemented, verified
  by static gates and an independent browser probe of the real artifact.

### Loop 4 — Final Pre-Implementation Convergence

- **RED:** Confirmed via fresh call-graph audit before coding: `computeGraphLayout`
  is consumed only by `cli/src/commands/graph-export/template.ts:60-66`
  (production) and `dev/scratchpad/debug-layout.ts:22` (scratchpad).
  `serializeGraphForExport` is consumed only by `template.ts:57,63` in
  production. Current template paths: `fitVisibleGraph` at `template.ts:185`,
  initial collapse at `template.ts:314`, initial fit in the rAF at
  `template.ts:322`, tap-expand `cy.fit(node, 80)` at `template.ts:375`, and
  search auto-expand (parent `removeClass('collapsed')`) at `template.ts:351-352`.
- **GREEN:** Final converged plan — layout gains a compact fixed-size ELK
  overview pass + center-frame child offsets + stable anchors; serializer
  emits `overviewPosition`/`overviewAnchor`/`childOffset`; template uses one
  shared expand/collapse helper for tap and search.
- **AUDIT (Verifier):** **PASS with three corrections folded in.**
  1. Anchor/offset math must use a single coordinate frame (top-left or
     center, applied uniformly) — the plan's `childPos − bbox-center` and
     `anchor = bbox-center` are frame-consistent when `measureBbox`
     (`layout.ts:314`) and the bbox center are computed in the same frame;
     mixing frames scatters children on expand. Implementation uses center
     frame throughout (Q13).
  2. Container overview position diverges from the child-layout bbox center;
     children are placed around the anchor while the collapsed atom sits at
     its overview position — the browser probe must assert expanded children
     land predictably around the expanded container, not just zoom.
  3. Tests must assert the new emitted fields (`childOffset`/`overviewAnchor`/
     `overviewPosition`) and the absence of absolute positions on children;
     the shared expansion helper must appear in the emitted script. Fit must
     run after child positions + `collapsed` removal are batched (Q18).
- **ADVERSARIAL:** **PASS — no omitted caller or path found.** All current
  production fit/expand/search paths confirmed at the cited lines; no new
  public API or dependency required; no production caller would break from
  the additive serializer fields.
- **FID verdict:** **CONVERGED — implementation authorized by operator.**
  Status advances past `analyzed` only after implementation + verification
  evidence is recorded below.

## Resolution

- **Fixed By:** Savant  (Hybrid Mode, approved FID-018 scope)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Compact export-time overview coordinates (fixed-size ELK
  pass) with center-frame child offsets and stable container anchors; shared
  browser expand/collapse helper for tap + search; visible-node fitting for
  initial load and toolbar Fit; serializer emits the new contract and omits
  absolute child positions.
- **Tests Added:** Yes — `graph-export.test.ts` new FID-018 coordinate-contract
  test (11/11 pass); e2e harness 15/15 pass; typecheck ×2 clean; ESLint +
  Prettier clean; independent headless-Chrome runtime probe on the real export.
- **Verified By:** Independent code review + headless-Chrome probe of the
  regenerated artifact (zoom 0.39, bbox 1,337 × 764, no drift, 0 errors).
- **Commit/PR:** Pending operator push
- **Archived:** 2026-08-09 — operator-accepted historical closure; moved to `dev/fids/archive/` and indexed in `dev/fids/archive/README.md`. Remaining review boundaries were waived and are not claimed passed.

## Lessons Learned

When a visualization introduces hidden elements, every camera operation must
explicitly declare whether it targets all data, visible data, a selected region,
or a search result. Layout correctness and camera correctness are separate
contracts. A healthy renderer can still appear blank when the viewport is fit to
non-rendered coordinates.
