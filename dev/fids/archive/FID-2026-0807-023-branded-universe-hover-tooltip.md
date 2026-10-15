# FID: Branded Code Universe Universe Hover Tooltip

**Filename:** `FID-2026-0807-023-branded-universe-hover-tooltip.md`
**ID:** FID-2026-0807-023
**Severity:** low
**Status:** closed
**Created:** 2026-08-07 00:00
**Author:** Buffy / Savant
**YAGNI-Compliance:** Verified

---

## Summary

The Code Universe universe view currently communicates node hover through Sigma's default canvas label and a small footer status update. The hover presentation is not aligned with Savant's Neon Slate design system. Add a dedicated, non-interactive tooltip overlay with a dark navy surface, cyan border/glow, clear kind/label/path hierarchy, and viewport-aware positioning. Preserve the existing hover status, click navigation, keyboard behavior, and reduced-motion semantics.

## Environment

- **OS:** Windows development environment
- **Language/Runtime:** TypeScript, Bun, self-contained HTML/CSS/inline JavaScript export
- **Tool Versions:** Existing repository versions from `package.json` and `bun.lock`
- **Commit/State:** Working tree after FID-2026-0807-022 progress-feedback completion

## Detailed Description

### Problem

Hovering a universe bubble exposes an unbranded white canvas label rather than a Savant-designed information surface. The user cannot quickly distinguish whether the hovered object is a system or file, and the treatment lacks the dark blue surface, cyan glow, and metadata hierarchy used elsewhere in the export.

### Expected Behavior

When the pointer enters a universe node, a larger tooltip appears near that node with a dark navy background, cyan glowing border, subtle shadow, readable title, object-kind badge, and relevant path/count metadata. It follows the node when the camera changes, stays within the viewport bounds, does not intercept clicks, and hides on leave/stage reset. Its text is available through an accessible live region or equivalent semantic labeling.

### Root Cause

The generated markup has no tooltip element. The Sigma `enterNode` handler only calls `setStatus`, and Sigma's normal label renderer supplies the visible canvas text. There is no controllable DOM surface for design-system styling or viewport clamping.

### Evidence

```text
cli/src/commands/graph-export/template.ts:245
<footer ...><span id="graph-status">...</span>...</footer>

cli/src/commands/graph-export/template.ts:320
function setStatus(text) { var el = document.getElementById('graph-status'); if (el) el.textContent = text; }

cli/src/commands/graph-export/template.ts:473-474
sigma.on('enterNode', function (event) { var n = nodeData(event.node); if (n) setStatus((n.label || n.path) + ' · click to enter'); });
sigma.on('leaveNode', function () { setStatus('Drag through the universe · select a system to enter its orbit'); });

Current generated CSS contains no dedicated graph-tooltip selector; the hover label is therefore Sigma canvas output rather than a branded DOM component.
```

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts`
- `cli/src/commands/__tests__/graph-export.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Add one hidden `#universe-tooltip` element inside `.viewport-wrap`, styled with existing Neon Slate tokens: `#06152b`/`#081b35` navy surface, cyan border, cyan glow, compact uppercase metadata, and a constrained width. The element uses `pointer-events:none`, `role="tooltip"`, `aria-hidden`, and a bounded `max-width`/`overflow-wrap:anywhere` so it cannot block node clicks or create viewport overflow. Build its contents with `textContent`, never HTML interpolation. On `enterNode`, render the node's kind/label/path/counts and position it from `sigma.graphToViewport()` in `.viewport-wrap` coordinates; measure `offsetWidth`/`offsetHeight`, then clamp with a viewport margin and flip below the node when there is insufficient room above. On camera updates, reposition the active tooltip; on `leaveNode`, stage click, reset, or invalid node, hide it. Keep `setStatus` for the accessible footer status and use a reduced-motion-safe opacity/transform transition. Suppress Sigma's hover-only white label by using `labelRenderedSizeThreshold`/label configuration rather than removing intentional universe labels globally.

### Steps

1. Add tooltip markup and design-system CSS to the generated artifact.
2. Add tooltip show/hide/position helpers and wire them to node hover, camera updates, leave, and reset paths.
3. Add generated HTML contract assertions for markup, styling, safe text rendering, event reachability, and pointer isolation.
4. Run the focused graph-export suite, CLI typecheck, ESLint, and Prettier.

### Verification

- Focused graph-export tests assert tooltip markup, dark/cyan styling, viewport clamp helpers, pointer isolation, and hover/camera wiring.
- CLI typecheck passes.
- ESLint and Prettier pass on changed files.
- Final adversarial review checks that tooltip DOM creation cannot inject graph data and that click/navigation behavior remains unchanged.
- Browser visual behavior is reported as NEEDS-REVIEW unless a live artifact probe confirms it; source contract tests are not presented as visual proof.

## Perfection Loop

### Loop 1

- **RED:** Confirmed the unbranded hover surface: no tooltip DOM/CSS exists; `enterNode` only updates footer status and Sigma supplies the white canvas label.
- **GREEN:** Converged on one export-local, non-interactive tooltip overlay. Rejected modifying the global chat UI, adding a dependency, or replacing node click handlers. Text will be assigned through DOM `textContent`; positioning will clamp to the viewport.
- **AUDIT:** Source implementation audit passed: CLI typecheck exited 0; 40 focused graph-export tests passed with 0 failures; ESLint passed with zero warnings; Prettier passed. Live browser placement/clamping remains NEEDS-REVIEW because contract tests do not simulate pointer/camera rendering.
- **CHANGE DELTA:** Scoped implementation touched the generated template, focused graph-export contract assertions, and this FID.

### Missed Questions

1. **Should the tooltip replace the footer status?** No. The footer remains useful persistent status; the tooltip is a focused hover surface.
2. **Should the tooltip intercept pointer events?** No. `pointer-events:none` preserves Sigma hover/click continuity.
3. **What if a node is near an edge?** Measure after render and clamp left/top within the viewport with a small margin.
4. **What should be shown for systems vs. files?** Systems show SYSTEM plus path/file/edge counts; files show FILE plus path and owning system when available.
5. **How is arbitrary source/path text handled?** Use `textContent` for every dynamic field; no `innerHTML`.
6. **What happens while panning/zooming?** Reposition the active tooltip from the current graph-to-viewport coordinate; hide it if conversion is unavailable.
7. **Does reduced motion disable the tooltip?** No. It removes or shortens the transition only; information remains available.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes: `cd cli && bun run typecheck` → exit 0
- [x] Focused tests pass: `cd cli && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts` → 40 pass, 0 fail
- [x] ESLint and Prettier pass on changed files
- [x] FID status updated to reflect actual implementation state
- [ ] Browser visual probe confirms tooltip placement/clamping: NEEDS-REVIEW; not claimed as verified

> **AUDIT evidence-citation rule (FID-2026-0805-004):** every PASS and every FAIL in the AUDIT phase cites `path/to/file.ts:LINE` with the quoted code that justifies it; absence-shaped checks paste the exact search (NO-MATCH). Out-of-reach evidence is marked `NEEDS-REVIEW` naming the screen/system a human must check — never converted to PASS.

### Loop 2

- **RED:** Final adversarial review found no critical runtime defect. It identified the remaining evidence boundary: string contracts do not prove live browser tooltip placement, and keyboard users need a non-hover fallback.
- **GREEN:** Confirmed the footer `setStatus` remains the accessible text fallback, retained `pointer-events:none`, restored `clickStage` status behavior, and documented browser rendering as NEEDS-REVIEW rather than claiming it.
- **AUDIT:** Independent gates passed: CLI typecheck exit 0; focused graph-export tests 40 pass / 0 fail; ESLint 0 warnings/errors; Prettier clean. Source inspection confirms `defaultDrawNodeHover: function () {}` suppresses Sigma's conflicting white hover renderer, while the DOM tooltip handles pointer hover.
- **CHANGE DELTA:** Final review/FID evidence only; no additional production code changes after the green validation pass.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** Added a dark navy/cyan neon DOM tooltip for universe-node hover with kind/title/path/metadata hierarchy, safe `textContent` rendering, viewport-aware positioning and flipping, camera repositioning, leave/stage/reset cleanup, pointer-event isolation, reduced-motion styling, and Sigma native hover-label suppression.
- **Tests Added:** Yes — generated HTML contract assertions for markup, styling, safe text surface, hover/camera/stage wiring, clamping, and native-label suppression.
- **Verified By:** Independent basher runs: CLI typecheck exit 0; graph-export tests 40 pass / 0 fail; ESLint clean; Prettier clean; final adversarial review found no critical runtime findings.
- **Commit/PR:** Not committed
- **Archived:** 2026-08-08

## Lessons Learned

Canvas-rendered labels are difficult to theme consistently. A small DOM overlay is the right boundary when a visualization needs branded, accessible, viewport-aware hover information without altering the renderer or interaction model.
