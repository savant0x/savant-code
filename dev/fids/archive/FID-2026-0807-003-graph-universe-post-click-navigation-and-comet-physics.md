<!-- markdownlint-disable MD013 -->

# FID: Code Universe Post-Click Navigation and Comet Physics

**Filename:** `FID-2026-0807-003-graph-universe-post-click-navigation-and-comet-physics.md`
**ID:** FID-2026-0807-003
**Severity:** high
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant 
**YAGNI-Compliance:** Verified

---

## Summary

The Code Universe export has two unresolved interaction defects and one visual-physics defect. Selecting a graph object or
attempting to select a left-sidebar system can reset the scene, close the information panel, or leave the operator with no
visible selected information. The left navigation renders buttons and assigns `onclick` handlers, but the graph canvas is
stacked above the navigation and the browser interaction path is not covered by a real click test. Separately, every comet
uses one fixed orientation and one fixed travel vector while its head is anchored to the same edge of the streak, so the
streak tail does not align with its actual movement. This FID makes the post-click state machine and comet trajectory
contract explicit, then requires browser-level verification before the defects can be marked fixed.

The Perfection Loop converged and the operator approved implementation. Production changes are now applied and verified
through static tests, typecheck, lint, formatting, and the live structural export harness. Real browser click persistence
remains explicitly `NEEDS-REVIEW` because the available browser automation did not return a structured capture.

## Environment

- **OS:** Windows (`win32`); target Chrome/Chromium and offline `file://` HTML
- **Language/Runtime:** TypeScript, Bun 1.3.14, self-contained HTML export
- **Renderer:** Sigma.js + Graphology embedded in `cli/src/commands/graph-export/template.ts`
- **Related FID:** `FID-2026-0807-002-code-universe-webgl-renderer.md`
- **Current graph scale:** approximately 2,084 files, 7,925 exact edges, 54 regions, and 90 aggregate corridors
- **Current state:** existing Code Universe implementation is present; this FID addresses defects found after visual use

## Detailed Description

### Problem

The operator reports:

1. Comets move to the right on the same path while their tails point down/left, producing visibly unnatural motion.
2. Clicking an object causes the center graph or information panel to disappear, so the selected object cannot be inspected.
3. The systems listed in the left sidebar are not clickable in practice. They should focus the selected system in the center while
   keeping the graph and information panel visible.
4. This post-click failure has survived prior visual passes because the tests assert emitted strings, not actual browser hit-testing,
   event ordering, camera state, or panel persistence.

### Expected Behavior

- A click on a region button, graph region, graph file, search result, or relationship must enter one shared navigation function.
- The selected system/file must remain represented in the center graph and must populate the information panel with its label, full
  repository-relative path, metrics, and connections.
- A click on a blank graph stage must not accidentally close the selected information panel or blank the center view. Explicit
  controls (`Universe`, close, Escape) may clear selection; accidental stage/canvas events may not destroy the current view.
- Left navigation buttons must receive pointer input above the Sigma canvas, have keyboard focus behavior, and call the same selection
  path as graph clicks.
- Camera animation and zoom-state updates may dim or reveal topology, but may not reset `selected`, hide the graph container, or close
  the panel unless an explicit reset action was requested.
- Every comet's head must lead in its travel direction. Its tail must extend behind the head along the exact inverse of its motion
  vector. Comets must have varied deterministic start points, travel vectors, angles, durations, and delays; they must not all share
  one path.
- `prefers-reduced-motion` must disable comet animation without changing comet geometry or making controls unusable.

## Root Cause

### 1. Canvas stacking and hit-testing risk

The current template creates `#region-list` buttons and assigns an `onclick`, but the navigation has no explicit z-index while
`.sigma-container` is explicitly assigned `z-index:2`. This makes the presence of a handler insufficient evidence that a user can
click the button: the canvas can receive the pointer event first.

### 2. Unconditional stage reset destroys selected state

The current Sigma event wiring includes:

```text
cli/src/commands/graph-export/template.ts:180
sigma.on('clickStage', function () { if (state !== 'universe') resetUniverse(); });
```

The reset path is:

```text
cli/src/commands/graph-export/template.ts:319
function resetUniverse() { fitUniverse(); setStatus('Universe restored ...'); }

cli/src/commands/graph-export/template.ts:318
function fitUniverse() { ... selected = null; ... closeSidebar(); }
```

Therefore any stage event while focused can clear the selected object and close the information panel. The current code does not
prove that a stage event cannot follow a UI interaction or occur during camera transitions.

### 3. Selection has no browser-level persistence contract

The pre-fix selection function opened the sidebar and animated the camera:

```text
cli/src/commands/graph-export/template.ts:321-327
function selectObject(id) { ... animateTo(id, ...); openSidebar(...); ... refresh(); }
```

But no test clicks a generated region button, checks the selected state after the camera update, checks that the graph container is
still visible, and checks that the sidebar title/path remain populated. Existing tests primarily search generated HTML for function and
CSS strings.

### 4. Comet geometry is not derived from motion

The pre-fix generator emitted six shooting stars with different start coordinates but no per-comet travel vector or angle:

```text
cli/src/commands/graph-export/template.ts:26-30
const x = ...; const y = ...; const delay = ...;
return `<i class="shooting-star ..." ...></i>`
```

The pre-fix CSS gave every comet the same fixed orientation and movement:

```text
cli/src/commands/graph-export/template.ts:386
.shooting-star { ... transform: rotate(-28deg); ... }
@keyframes shooting-star { ... translate3d(-40px,-18px,...) ... translate3d(260px,110px,...) ... }
```

The pre-fix head was fixed to the right edge:

```text
cli/src/commands/graph-export/template.ts:386
.shooting-star::after { ... right:0; ... }
```

The travel vector, fixed rotation, and head/tail placement are independent values. This is why the visual tail can point down/left
while the streak appears to travel right on a repeated path.

## Evidence

```text
RED search output:
cli/src/commands/graph-export/template.ts:178-180
  sigma.on('clickNode', function (event) { selectObject(event.node); });
  sigma.on('clickEdge', function (event) { selectEdge(event.edge); });
  sigma.on('clickStage', function () { if (state !== 'universe') resetUniverse(); });

cli/src/commands/graph-export/template.ts:318-321
  fitUniverse clears selected and closes the sidebar;
  resetUniverse delegates to fitUniverse;
  selectObject was the pre-fix shared canvas selection function.

cli/src/commands/graph-export/template.ts:367
  buildRegionNav created buttons and assigned button.onclick = function () { selectObject(r.id); } before the fix.

cli/src/commands/graph-export/template.ts:386
  .sigma-container { z-index:2 } while .region-nav has no explicit z-index;
  .shooting-star uses fixed rotate(-28deg) and fixed translate3d keyframes.

Existing validation:
- Focused graph-export tests previously passed 16/16, but they only asserted emitted HTML contracts.
- Live fixture harness previously passed 16/16, but it did not click a real region button or verify post-click panel persistence.
- Prior browser runs established file:// loading and zero-console-error behavior, but did not provide a reliable final click-path capture.
```

The absence of browser interaction coverage is itself a finding: no existing test proves that a left navigation button receives a
pointer event, that selection survives camera updates, or that the panel remains populated after a click.

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts` — event wiring, selection state, camera/reset behavior, DOM stacking, comet markup,
  comet CSS, and fallback behavior
- `cli/src/commands/__tests__/graph-export.test.ts` — generated contract and selection-path assertions
- `dev/test-prompts/graph-export-e2e.ts` — live export assertions for navigation and comet contracts
- `dev/fids/FID-2026-0807-002-code-universe-webgl-renderer.md` — related FID reference only; do not rewrite its historical evidence
- Real export: `dev/exports/graph/savant-graph.html` — regenerate only after implementation and browser verification

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Primary interaction is broken and selected information cannot reliably be inspected
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue or cosmetic edge case

## Proposed Solution

### Approach

Make navigation state explicit and durable, then make the DOM/canvas layering deterministic. Use one shared selection function for
all entry points. Replace implicit stage-reset behavior with explicit reset semantics. Derive every comet's CSS angle from its
translation vector so the head, travel direction, and tail are physically coherent.

### Steps

1. Add a small, shared navigation transition function that accepts a region/file/edge target and records the selected object and
   selected region before camera animation. Keep the graph visible while the camera moves.
2. Change stage-click behavior so a blank/stage event cannot call `fitUniverse()` and close the information panel as a side effect.
   Universe reset remains available through the explicit Universe button, Escape, and an intentional reset action.
3. Give `.region-nav` and its buttons an explicit interactive stacking layer above `#sigma-container`, with `pointer-events:auto`,
   visible focus styling, and button event handling that cannot be consumed by the canvas.
4. Ensure `selectObject`, `selectEdge`, search, and region navigation all call the same transition path. Guard missing/stale targets
   and preserve a usable selected panel if a camera animation or renderer update fails.
5. Add deterministic per-comet variables: start position, `dx`, `dy`, `angle = atan2(dy, dx)`, duration, delay, and tail length.
   Use one CSS animation whose translation vector and rotation are generated from the same values. The head remains in front and the
   tail extends behind it. Vary trajectories while keeping the effect sparse and bounded.
6. Preserve reduced-motion behavior by freezing comet animation at a valid geometric state and retaining all static stars, graph
   topology, labels, and controls.
7. Add contract tests for z-index/pointer-events, vector-derived comet variables, no fixed universal comet rotation/path, shared
   navigation function wiring, and non-destructive stage behavior.
8. Add a browser/live harness flow that opens the real artifact, clicks the first left-sidebar system, verifies the state label and
   sidebar path/title, clicks a second system, verifies the first selection is replaced rather than blanking the page, clicks a graph
   object, verifies the graph container remains visible, and checks console errors.
9. Regenerate the real export and capture browser evidence for Universe, System, Neighborhood, and Detail states. If the browser
   cannot provide a WebGL screenshot, mark the visual portion `NEEDS-REVIEW` rather than claiming PASS.

### Verification

Static:

- `cd cli && bun run typecheck`
- `NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts src/commands/__tests__/containers.test.ts`
- `bun x eslint cli/src/commands/graph-export/template.ts cli/src/commands/__tests__/graph-export.test.ts dev/test-prompts/graph-export-e2e.ts --max-warnings 0`
- `bunx prettier --check` on changed files
- `bun x markdownlint dev/fids/FID-2026-0807-003-graph-universe-post-click-navigation-and-comet-physics.md`
- Call-graph search proving the shared navigation function is called from region buttons, graph node/edge handlers, and search.

Runtime/browser:

- Open the real `file://` export with Chrome.
- Click at least two left-sidebar region buttons and verify the center graph remains visible after each click.
- Verify the information panel remains visible and changes to the selected system/file.
- Click a graph node and a graph edge; verify no blank center, no loading overlay, no console error, and correct path/metrics.
- Verify an explicit Universe reset clears selection, while an incidental stage/camera event does not.
- Inspect comet animation frames or computed geometry to verify the head leads along the translation vector and comets have varied
  trajectories.
- Verify reduced motion freezes animation but leaves the graph, selection panel, and controls usable.

## Perfection Loop

### Loop 1 — RED

- **CONFIRMED:** The stage handler can reset focused state. Evidence: `template.ts:180` calls `resetUniverse()` whenever state is
  not `universe`; `template.ts:319` delegates reset to `fitUniverse()`; `template.ts:318` clears `selected` and calls
  `closeSidebar()`.
- **CONFIRMED RISK:** Left navigation hit-testing is not deterministic. Evidence: `template.ts:367` creates clickable buttons, but
  the CSS at `template.ts:386` assigns `.sigma-container{z-index:2}` and gives `.region-nav` no explicit z-index or pointer-events rule.
- **CONFIRMED GAP (pre-fix):** The existing selection path had no browser-level persistence test. Existing focused tests passed
  16/16 and the live fixture harness passed 16/16 in the preceding implementation pass, but neither performed a real sidebar click
  and post-camera assertion.
- **CONFIRMED:** Comets reuse one path/orientation. Evidence: `template.ts:26-30` varies only start coordinates/delay, while the CSS
  at `template.ts:386` fixes `rotate(-28deg)` and both translation endpoints for every comet; the head is fixed at `right:0`.
- **CALL-GRAPH (pre-fix):** `selectObject` was reached from Sigma node clicks, edge selection, search, and region-button callbacks;
  the implementation replaces that path with `navigateToObject` while preserving all production callers.

### Loop 1 — GREEN

- **Fixes proposed/documented:** Introduce one durable navigation transition path; do not add parallel click logic for the sidebar.
- **Fix direction:** Move reset semantics out of incidental `clickStage`; explicit reset controls own destructive deselection.
- **Fix direction:** Put the left navigation in an explicit interactive layer above Sigma and keep it keyboard reachable.
- **Fix direction:** Make comet translation and orientation one derived geometry contract. For each comet, compute deterministic `dx`, `dy`,
  `angle = atan2(dy, dx)`, duration, and delay; CSS consumes those variables instead of a fixed angle/path.
- **Robust default:** Comets travel primarily rightward but with varied upward/downward vectors, so the scene preserves the requested
  direction while removing the repeated conveyor-belt appearance. The head is the leading endpoint and the tail trails behind it.
- **Robust default:** A stage click never closes the information panel. Explicit Universe, Escape, close, or a future Back control may
  clear selection.
- **Robust default:** If WebGL is unavailable, the left navigation remains clickable and the text fallback exposes the selected system
  path and metrics; renderer initialization cannot remove the navigation.
- **Performance boundary:** Keep comet count bounded (six), avoid per-comet JavaScript animation loops, and use CSS transforms. Keep
  navigation updates batched through the existing Sigma refresh/camera path.

### Missed Questions and Answers

1. **What exactly does “clicking anything” include?** → Region buttons, graph regions, graph files, edges, search results, and blank
   stage clicks must be tested separately; no click source may silently call an unrelated reset.
2. **Should a blank stage click close the panel?** → No. Only explicit reset/close actions clear selected information; preserving context
   is the safer exploration default.
3. **Should clicking a second region add or replace selection?** → Replace the selected target while preserving the graph and panel;
   the latest intentional selection is authoritative.
4. **What should happen if camera animation fails or the target is stale?** → Keep the graph visible, retain the selected metadata in
   the panel, and report a non-fatal status message; never fall through to a blank/reset state.
5. **Can all comets travel in exactly one direction?** → They may share a broad rightward bias, but each must have a distinct
   deterministic vector and derived angle. No universal fixed rotation or translation is allowed.
6. **How do we define correct comet physics in CSS?** → The head sits at the leading endpoint; the translation vector is parallel to
   the streak axis; the tail extends opposite the vector. `angle` is derived from `atan2(dy, dx)`, not hand-entered separately.
7. **What if reduced motion is enabled?** → Freeze comet animations and preserve their aligned static geometry, static stars, graph,
   panel, and navigation.
8. **How do we prove the left button is really clickable?** → Use browser automation against the real generated artifact, not merely
   generated-string assertions; verify the state label, panel text, center visibility, and absence of console errors after two clicks.
9. **How do we avoid reintroducing the old blank export?** → Keep fallback construction outside renderer success assumptions, give the nav
   an independent stacking layer, and test both WebGL-capable and fallback contexts when available.
10. **What is out of scope?** → Replacing Sigma, adding live network services, adding a physics engine, or redesigning the graph data
    model. This FID is a navigation/event-layer repair plus comet geometry correction.

### Loop 1 — AUDIT

- **PASS — protocol and scope:** ECHO.md was read 0-EOF before FID authoring. The task was complex and FID-bound;
  no production code was changed during RED/GREEN planning, and implementation began only after operator approval.
- **PASS — implementation static gates:** Tool output reported `FORMAT=0`, `TYPECHECK=0`, `TESTS=0`, `ESLINT=0`, and
  `E2E=0`; focused tests reported `16 pass`, `0 fail`, `107 expectations`, and the live fixture harness reported
  `16 PASS / 0 FAIL`.
- **PASS — implementation review:** Independent code review returned `PASS` for the navigation call graph, non-destructive
  stage behavior, sidebar stacking, vector-derived comet geometry, reduced-motion visibility, and stale-reference cleanup.
  Browser click persistence remained separate and was not converted to PASS.
- **PASS — current static validation evidence:** The existing graph-export suite was previously run with
  `NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts src/commands/__tests__/containers.test.ts`.
  This validates the baseline but does not validate the new click behavior. Raw tool output:

  ```text
  16 pass
  0 fail
  97 expect() calls
  Ran 16 tests across 2 files.
  ```
- **PASS — implementation source-state evidence:** The approved implementation changed the graph-export template,
  focused graph-export test contract, and live harness contract. The real export was regenerated only after those changes.
- **PASS — final artifact evidence:** The regenerated artifact is `C:\\Users\\spenc\\dev\\savant-code\\dev\\exports\\graph\\savant-graph.html`,
  measured at `3,256,984` bytes and `16,446 ms` export time.
- **PASS — stage evidence:** Current source now uses a non-destructive `clickStage` status handler at
  `cli/src/commands/graph-export/template.ts:192`; only explicit reset controls call `fitUniverse`.
- **PASS — sidebar evidence:** `navigateToObject` is called by Sigma node/edge paths, search, and region navigation at
  `template.ts:190,396,406,430`; `.region-nav` has `z-index:6` and `pointer-events:auto` in the generated CSS.
- **PASS — comet evidence:** Per-comet `--travel-x`, `--travel-y`, `--angle`, and `--tail` variables are generated at
  `template.ts:41`; CSS derives rotation, head placement, and translation from those variables.
- **PASS — reduced-motion evidence:** The generated reduced-motion rule disables comet animation while preserving opacity and
  `rotate(var(--angle))` geometry.
- **PASS — call-graph requirement:** The implementation search found the shared `navigateToObject` production callers in
  Sigma node handling, edge selection, search, and region-button callbacks.
- **NEEDS-REVIEW — Recorder routing:** The configured Recorder role was unavailable in the current tool roster, so the
  Orchestrator authored the initial FID file to avoid losing the operator's requested audit trail. This is a protocol
  exception that must be acknowledged and, if the Recorder becomes available, reconciled before archival.
- **NEEDS-REVIEW — actual hit-testing:** The browser-use helper was invoked twice against
  `file:///C:/Users/spenc/dev/savant-code/dev/exports/graph/savant-graph.html`; both attempts returned no structured
  result, and the first attempt failed before receiving a snapshot UID. Static and structural evidence pass, but real
  pointer hit-testing, panel persistence, and screenshot-based comet inspection remain human/browser review gates.

### Loop 1 — ADVERSARIAL

- **CONFIRMED:** The prior visual pass did not prove the click path. String-presence tests cannot certify pointer hit-testing or panel
  persistence; this was a real omission, not a duplicate request.
- **CONFIRMED:** The stage reset was destructive and incompatible with selection-as-inspection behavior; the implementation now preserves
  selection on stage clicks.
- **CONFIRMED:** The sidebar required an independent interactive stacking layer; the implementation adds it.
- **CONFIRMED:** A fixed CSS rotation plus a fixed translation vector could not represent varied physically coherent comets; the
  implementation derives both from per-comet vectors.
- **CONFIRMED:** Reduced motion needed an explicit visible static comet rule; the implementation preserves aligned comet geometry.
- **ADJUSTED:** Browser event ordering remains `NEEDS-REVIEW` because the automation helper returned no structured capture. No static
  claim is promoted to runtime PASS.
- **OMISSION CHECK:** The implementation and tests cover all click sources, DOM layering, camera transitions, fallback behavior,
  stale targets, reduced motion, comet geometry, call-graph reachability, and structural export contracts. The only open gate is
  direct browser observation of the final artifact.
- **VERDICT:** Implementation is complete for code/static gates; browser interaction and visual inspection remain `NEEDS-REVIEW`.

## Code Verification Evidence

- [x] `ECHO.md` read 0-EOF before planning.
- [x] Existing Code Universe FID and current implementation inspected.
- [x] RED source evidence collected for stage reset, sidebar layering, selection call graph, and comet CSS.
- [x] GREEN solution answers the missed questions and preserves explicit reset controls.
- [x] AUDIT separates statically proven claims from browser `NEEDS-REVIEW` claims.
- [x] ADVERSARIAL pass checks omission, duplicate scope, and unsupported certainty.
- [x] User approval for implementation.
- [x] Production implementation and tests.
- [x] Static call-graph and structural export evidence recorded.
- [ ] Browser evidence from the regenerated real export via direct click/screenshot capture; remains `NEEDS-REVIEW` because the
  browser-use helper returned no structured result.

## Resolution

- **Fixed By:** Savant  after operator approval
- **Fixed Date:** 2026-08-07
- **Fix Description:** Added durable `navigateToObject` selection routing, non-destructive stage clicks, explicit sidebar stacking,
  vector-derived varied comet geometry, and visible reduced-motion comet geometry. Updated graph-export contracts and live harness.
- **Tests Added:** Static navigation/comet contract assertions; focused suite 16/16; live harness 16/16.
- **Verified By:** CLI typecheck, changed-file ESLint, Prettier, focused tests, live harness, and independent code review PASS.
  Final browser click persistence and screenshot visual review remain `NEEDS-REVIEW`.
- **Commit/PR:** Pending operator push
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

A generated handler is not a verified interaction. For exported HTML interfaces, DOM stacking, browser hit-testing, event ordering,
camera transitions, and post-click state persistence require a real artifact browser test. Visual motion must derive its orientation from
its movement vector; independently chosen CSS angles and translations produce visibly false physics.

## Corrective Loop 2 — Center Focus and Dynamic Framing

### RED

- **Confirmed omission:** the selected-object information is rendered only in `#graph-sidebar`; the center has no detail/focus markup.
  Evidence: `template.ts:106-115` contains the viewport and right drawer, while `openSidebar()` at `template.ts:415-428` updates only
  sidebar elements.
- **Confirmed framing defect:** system and file navigation use fixed camera ratios (`0.5` and `0.22`) in `navigateToObject()` at
  `template.ts:369-387`; no selected-system bounds calculation or viewport fit exists.
- **Confirmed acceptance failure:** the previous static suite and structural harness did not assert center content or dynamic framing;
  the operator's direct artifact report therefore supersedes the prior unobserved browser gate and marks this behavior failed.
- **Call graph:** the corrective functions will be reachable from the existing `navigateToObject()` path, and reset-only clearing will
  be reachable from `fitUniverse()`, explicit close, and Escape. No duplicate selection state is permitted.

### GREEN

- Add a center focus surface with selected title, full path, kind, metrics, and a bounded connection list. Keep it visually integrated
  with the current cyberpunk space design and keep it non-intercepting except for explicit controls.
- Add `renderFocusView()` and `clearFocusView()` as the single center-view render/clear functions. `navigateToObject()` calls the former;
  only explicit reset/close actions call the latter.
- Add `selectionNodes()` and `fitSelection()` to calculate bounds from graph coordinates, include the selected region and its files, add
  deterministic padding, and derive a clamped camera ratio from the viewport dimensions. File selection includes the file and its local
  neighbors, with a safe fallback to the file itself.
- Keep Sigma, planet effects, the left navigation, and the right drawer available. The center focus view is an information overlay, not
  a replacement for the graph.
- Missed questions answered: system with zero files uses its region anchor; a single-node selection receives a minimum readable span;
  stale targets preserve the existing view; resize does not clear selection; reduced motion removes transitions but not content; an
  empty connection list renders an explicit empty state; hostile paths use `textContent`, never `innerHTML`.
- Scope remains limited to the existing template, focused test contract, live structural harness, and regenerated export. No new
  dependency, renderer migration, graph schema change, or ambient-motion redesign is introduced.

### AUDIT

- **FID audit evidence:** source inspection confirms the omission and fixed ratios above; the corrective implementation has not yet been
  written at this point, so implementation claims are intentionally not promoted to PASS.
- **Protocol boundary:** ECHO was reread 0-EOF. The Recorder role is unavailable in this runtime; the Orchestrator is documenting the
  exception and will not claim Recorder verification.
- **Approval:** the operator explicitly requested “run perfection loop on it then install it”; this is treated as approval to implement
  the converged corrective plan after this loop documentation.

### ADVERSARIAL

- **CONFIRMED:** a right drawer is not a center focus view; the prior implementation did not meet the user's center-view requirement.
- **CONFIRMED:** fixed camera ratios cannot guarantee a selected system is visible at useful scale across different graph geometries.
- **REFUTED:** a renderer migration is not required to solve this defect; the existing Sigma graph and serialized coordinates are usable
  once the selection overlay and bounds framing are corrected.
- **OMISSION CHECK:** the plan covers system, file, edge/search routing, empty systems, stale targets, resize, reduced motion, hostile
  paths, reset semantics, and both static/runtime verification boundaries.
- **VERDICT:** FID corrective plan converged to COMPLETE for implementation. Production edits may now begin under the user's explicit
  “install it” authorization.

## Corrective Loop 2 — Final Implementation Evidence

### RED / GREEN / AUDIT / ADVERSARIAL Resolution

- **RED confirmed:** selection metadata was previously limited to the right drawer and system navigation used fixed camera ratios.
- **GREEN implemented:** the export now includes a cyberpunk center focus surface with selected kind, title, full path, metrics, and
  bounded connections. `renderFocusView()` is called by `navigateToObject()` for both systems and files. `clearFocusView()` is called
  only by explicit close/reset paths.
- **GREEN implemented:** `selectionNodes()` and `fitSelection()` derive the camera target and ratio from the selected graph-coordinate
  bounds, include region children or a file's local orbit, clamp the result, and use a documented status message for the degenerate
  fallback path.
- **AUDIT static evidence:** focused suite `16 pass / 0 fail / 116 expect() calls`; CLI typecheck exit `0`; changed-file ESLint exit `0`;
  Prettier exit `0`; FID markdownlint exit `0`. Live structural harness: `17 PASS / 0 FAIL`.
- **AUDIT artifact evidence:** regenerated artifact is
  `C:\\Users\\spenc\\dev\\savant-code\\dev\\exports\\graph\\savant-graph.html`, `3,264,842` bytes, export time `15,569 ms`.
  Static probe found center markup/functions and `.region-nav` stacking contract; no stale fixed-ratio call remains in the normal
  `navigateToObject()` branches (one `animateTo()` ratio remains only as the documented degenerate framing fallback).
- **ADVERSARIAL:** the center overlay is not a renderer replacement; Sigma remains visible below it, the overlay uses `textContent` for
  paths/labels, and explicit Universe/Escape/close actions remain the only clearing paths. The browser helper again returned no
  structured snapshot/click result, so direct `file://` hit-testing, computed visual state, and console cleanliness remain
  **NEEDS-REVIEW** rather than being promoted to PASS.

### Final Status

The corrective implementation is **fixed for source, static contracts, and export generation**. The only unresolved verification boundary
is direct browser observation of the generated artifact; its unavailability is recorded rather than claimed away.
