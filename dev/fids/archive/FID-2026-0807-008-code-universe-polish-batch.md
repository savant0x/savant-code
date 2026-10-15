<!-- markdownlint-disable MD013 -->

# FID: Code Universe Polish Batch — Region Honesty, Brand Backdrop, Search Depth

**Filename:** `FID-2026-0807-008-code-universe-polish-batch.md`
**ID:** FID-2026-0807-008
**Severity:** medium
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

Three Code Universe polish items surfaced during deep review of `/graph-export`:

1. **F1 (fixed + verified):** root-level files were emitted as their own 1-file "systems" in the
   left `SYSTEMS / REGIONS` nav (`.bun-version · 1`, `.env.example · 1`, …), and clicking one routed
   through the *system* branch, opening the ROOT directory instead of the file's document.
2. **F2 (proposed):** the decorative circle logo in the background of the universe (the ROOT region's
   planet/orbit emblem drawn by the `#planet-effects` canvas) should be the Savant brand logo instead
   of a generic planetary body.
3. **F3 (proposed):** the search feature is a single-first-match path/label probe; it needs results
   depth — ranked multi-kind matching (files, folders, systems), live dropdown, keyboard navigation,
   and match highlighting.

F1 is implemented and browser-verified. F2 and F3 are scoped and ready for operator approval → implementation.

## Environment and Evidence

- **OS:** Windows; target Chrome/Chromium and offline `file://` HTML
- **Runtime:** TypeScript, Bun 1.3.14
- **Renderer:** Sigma.js + Graphology; center browser in `cli/src/commands/graph-export/template.ts`
- **Serializer:** `packages/knowledge-graph/src/export-serializer.ts`
- **Prior FIDs:** FID-2026-0807-001…007 (Code Universe spatial graph, WebGL renderer, navigation,
  hierarchy, init/loader, documents/images, sound effects)

### F1 evidence (implemented, browser-verified)

```text
packages/knowledge-graph/src/export-serializer.ts:287-301 (post-fix)
function regionPath(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length === 0) return 'root'
  // Root-level files are files, not systems. Grouping them into the ROOT
  // region keeps the systems list honest: a root file must never appear as
  // its own 1-file "system" (clicking one opened the root directory instead
  // of the file's document).
  if (parts.length === 1) return 'root'
  if (parts[0] === 'packages' && parts[1]) {
    return parts.length === 2 ? 'packages' : `packages/${parts[1]}`
  }
  return parts[0]
```

```text
packages/knowledge-graph/src/export-serializer.ts:684-688
color: REGION_COLORS[index % REGION_COLORS.length],
cluster,
// The ROOT region aggregates the repository itself; it is never
// "isolated" even when its root-level files carry no edges.
disconnected: edgeCount === 0 && key !== 'root',
```

Pre-fix headless-Chrome click-probe on the regenerated artifact:

```text
LEFT_NAV_COUNT=54        ← 36 fake root-file "systems" (.bun-version · 1, .env.example · 1, …)
Clicking .bun-version → ROOT / repository directory (50 cards), DOC_HEADER=NONE
```

Post-fix headless-Chrome click-probe on the regenerated artifact:

```text
LEFT_NAV_COUNT=22        ← ROOT / repository · 33 first, then real directories only
NO_ROOTFILE_NAV_ENTRY    ← .bun-version no longer a "system"
ROOT_GRID_HEADING=ROOT / repository
ROOT_FILE_HEADING=.bun-version   ← clicking the file card opens the DOCUMENT (2 lines, content present)
```

Regression test: `cli/src/commands/__tests__/graph-export.test.ts` — "graph-export groups root-level
files into the ROOT system (no fake file regions)" asserts root-first ordering, README.md → ROOT
region, no file-named region, `packages/package.json` → packages, and `disconnected: false` for ROOT.

Gates: typecheck ×2 exit 0 (knowledge-graph + cli); graph-export suite 20/20 pass (189 expectations);
ESLint clean; Prettier clean; regenerated artifact deterministic (12.70 MB, 2,084 files).

### F2 evidence

```text
cli/src/commands/graph-export/template.ts:10,95 (header logo already the brand)
import { LOGO_DATA_URI } from '../export-conversation/branding'
...
<img class="logo" src="${LOGO_DATA_URI}" alt="${escapeHtml(brandName)}">

cli/src/commands/graph-export/template.ts:120
<canvas id="planet-effects" class="planet-effects" aria-hidden="true"></canvas>

cli/src/commands/graph-export/template.ts:366-415 (drawPlanetEffects)
- radial halo (radius*1.65, colorWithAlpha(color, 0.22 → 0))
- dashed orbit ring (radius*1.18) + second ring (radius*1.38)
- planet body: dark disc radius*0.54 + stroke, then glowing center dot
```

The background emblem is the ROOT region's planet (largest radius, center of the universe): a
generic dark planet with cyan/magenta orbit rings — the "circle logo" the operator wants replaced with
the Savant brand mark (`art/savant-logo.png`, 250×250 RGBA, circular transparent-corner emblem,
already embedded as `SAVANT_LOGO_PNG_BASE64` in `cli/src/constants/savant-logo.ts`).

### F3 evidence

```text
cli/src/commands/graph-export/template.ts:101-102
<form class="universe-search" onsubmit="searchUniverse(event)">
  <input id="universe-search-input" type="search" placeholder="Search path or system" aria-label="Search code universe">

cli/src/commands/graph-export/template.ts:732-741
function searchUniverse(event) {
    if (event) event.preventDefault();
    var input = document.getElementById('universe-search-input');
    var query = (input && input.value || '').trim().toLowerCase();
    if (!query) return;
    var match = DATA.universe.files.find(function (f) { return f.path.toLowerCase().indexOf(query) >= 0 || f.label.toLowerCase() === query; }) || DATA.universe.regions.find(function (r) { return r.path.toLowerCase().indexOf(query) >= 0 || r.label.toLowerCase() === query; });
    if (!match) { playSound('warning'); setStatus('No universe object matches “' + query + '”'); return; }
    navigateToObjectWithCue(match.id, 'confirm');
    setStatus('Traveling to ' + (match.path || match.label));
}
```

Current behavior: single first match via `.find()`; files checked before regions; no folders; no
results list; no keyboard navigation; no highlighting; Enter/click only. `window.searchUniverse` is
exported for the form (template.ts:778) — call-graph is contained to the template.

## Detailed Description

### Problem

**F1** — `regionPath()` returned the first path segment for root-level files, so every root file
became its own 1-file "system". The left nav listed 54 "systems" (36 of them files), and the click
handler's `fileCount !== undefined` branch routed those through the *system* path — opening the ROOT
directory instead of the file's document.

**F2** — The background of the universe shows a generic planet/orbit emblem at the center (the ROOT
region's planet-effects canvas drawing). It reads as a decorative "circle logo" but carries no brand.

**F3** — Search resolves at most one match and only against file path/label then region path/label.
No results surface, no folders, no ranking, no keyboard UX, no match emphasis. For a 2,084-file
export, "flesh out the search" means a real search experience.

### Expected Behavior

**F1** — Root files group under the ROOT system (never fake systems); clicking a root file opens its
document. ROOT sorts first in the systems list and is never flagged ISOLATED.

**F2** — The central background emblem shows the Savant brand logo (the circular cyan PNG already
embedded), keeping the ambient halo/orbit aesthetic where it complements rather than obscures the mark.

**F3** — Typing in the search box shows a live ranked results panel covering files, folders, and
systems; supports keyboard (↑/↓/Enter/Escape), highlights the matched span, and navigates on
selection. Still fully offline.

### Root Cause

**F1** — Serializer grouping: `regionPath()` had no root-file special case; `parts.length === 1`
fell through to `return parts[0]` (the file's own name).

**F2** — The planet-effects renderer draws a generic procedural planet; no brand image is composed
into the background layer.

**F3** — Search was a v1 probe: single match, no results model, no DOM surface for results.

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/export-serializer.ts` — region grouping (F1, done)
- `cli/src/commands/__tests__/graph-export.test.ts` — regression coverage (F1, done; F2/F3 additions)
- `cli/src/commands/graph-export/template.ts` — background logo composition (F2), search UX (F3)
- `dev/test-prompts/graph-export-e2e.ts` — artifact markers for brand backdrop + search depth
- `dev/exports/graph/savant-graph.html` — regenerated real artifact

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Core document inspection is broken; workaround requires hidden environment configuration
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Cosmetic issue

*(F1 was high-severity UX breakage — now fixed. F2/F3 are feature-depth improvements; the batch is rated
medium as implemented scope.)*

## Proposed Solution

### F1 — Region grouping (DONE, verified)

`regionPath()` now maps root files (`parts.length === 1`) → `'root'`, `packages/<file>` → `'packages'`,
and real nested subtrees keep their own system. Region keys sort with `'root'` first. ROOT is exempt
from the `disconnected` flag. Regression test added. (No further changes required.)

### F2 — Savant brand backdrop

In `drawPlanetEffects()`, for the ROOT region (`region.path === 'root'`) replace the generic planet
body with the Savant logo:

1. Build one `Image` at init: `var brandLogo = new Image(); brandLogo.src = LOGO_DATA_URI;` (the
   data URI is already inlined in the template; zero network).
2. In the draw loop, when the region is ROOT and `brandLogo.complete && brandLogo.naturalWidth > 0`,
   draw the logo image centered at the region point, diameter ≈ `radius * 1.08` (slightly larger than
   the old dark disc so the circular mark reads clearly), with a soft cyan `shadowBlur` glow.
3. Keep the radial halo + orbit rings so the brand sits inside the existing ambient emblem; drop the
   dark planet disc + glowing dot only for the ROOT region. Non-ROOT regions keep the current planet.
4. Fallback: if the image is not yet decoded (`!brandLogo.complete`), draw the current procedural
   planet so the canvas never shows a gap; the next animation frame replaces it once loaded.
5. Reduced-motion path (`reducedMotion`) still draws the static logo (single `drawPlanetEffects`
   call) — no new animation dependency.

### F3 — Search depth

Replace the single-match probe with a results-driven search inside the existing template app script:

1. **Results model:** build once at boot — `searchIndex = []` with one entry per file, folder, and
   region: `{ id, kind: 'file'|'folder'|'system', label, path }` (folders from `DATA.universe.folders`,
   regions from `DATA.universe.regions`). ~2,100 entries for the real export; trivial memory.
2. **Ranking (score):** exact label = 100; label startsWith = 80; path segment match = 60; label
   contains = 45; basename contains = 30; path contains = 20. Ties broken by kind order
   (system → folder → file) then label length. Query is lowercased, trimmed; empty query hides panel.
3. **Live results panel:** a new `#search-results` element positioned under the search input
   (absolute, same panel styling as `region-nav`), populated on `input` (debounced ~120 ms) and on
   submit. Max 12 visible rows + "N MORE" footer; each row: kind glyph (◎ system / ◈ folder / ✦ file),
   `label` with the matched span wrapped in `<mark>`, and muted `path`.
4. **Keyboard:** ArrowDown/ArrowUp move an `activeIndex` (with scroll-into-view), Enter navigates the
   active row (or first), Escape closes the panel and blurs; clicking a row navigates.
5. **Navigation:** row activation calls `navigateToObjectWithCue(id, 'confirm')` then
   `closeSearchPanel()` — same travel UX as today, now for any kind (folders already resolve via the
   existing `renderFocusView`/`folderById` path).
6. **No-match:** panel shows "NO MATCHES FOR “query”" and plays the warning cue.
7. **Accessibility:** panel is `role="listbox"`, rows `role="option"`, `aria-activedescendant` on the
   input; Escape handler added to the existing document keydown.
8. **Offline + motion-safe:** pure DOM/string work; no network; no rAF; reduced-motion unaffected.

### Steps

1. (F1) — complete (regionPath fix, sort, disconnected exemption, regression test, browser probe).
2. (F2) — inject brand logo `Image` into the app script; compose into `drawPlanetEffects` ROOT branch;
   keep halo/rings; add procedural fallback while decoding.
3. (F3) — add `searchIndex` + ranking, `renderSearchResults(query)`, `#search-results` panel + CSS,
   keyboard/click wiring, `closeSearchPanel()`, no-match state.
4. Tests: template contains `brandLogo` composition marker + `renderSearchResults` + `searchIndex`
   (graph-export.test.ts string contracts); keep vm.Script parse + existing 20 tests green.
5. Regenerate `dev/exports/graph/savant-graph.html`; headless-Chrome probe: nav count 22 (F1),
   ROOT backdrop contains brand pixels / logo img loaded (F2), typing "template" shows ranked rows and
   Enter opens a document (F3).
6. Gates: typecheck ×2, graph-export suite, ESLint, Prettier, lint:md, live E2E harness.

### Verification

- F1: already verified in real browser (54 → 22, ROOT first, file document opens).
- F2: screenshot diff at ROOT center + probe asserting `brandLogo.complete` and non-void backdrop pixels.
- F3: probe typing a query → panel rows present, keyboard selection navigates, no-match state correct.

## Five Questions

1. **All cases?** F1: root files, `packages/<file>`, nested subtrees, disconnected ROOT. F2: decoded
   vs undecoded image, reduced-motion, non-ROOT regions unchanged. F3: files/folders/systems, empty
   query, no match, 2k+ corpus, keyboard, click.
2. **1000x scale?** Search index ~2.1k entries × ~4 fields — trivial. Live filter is O(n) over labels
   with early exit; capped result rows. Logo is one fixed image, drawn once per frame for one region.
3. **Hostile attacker?** Search results are built from serialized labels/paths and rendered via
   `textContent`/`<mark>` from DOM creation (no innerHTML); data was already escaped (`\u003c`) at the
   JSON boundary. Logo is a fixed data URI from our own constant.
4. **Maintainable in 2 years?** Ranking is a tiny pure function; results panel mirrors `region-nav`
   styling; brand backdrop reuses the existing planet-effects render loop.
5. **Industry standard?** Ranked live search with keyboard nav and highlighting is the standard
   expectation for a code explorer; offline data-URI brand emblems are standard for self-contained
   artifacts.

## Perfection Loop

### Loop 1 — RED

- **CONFIRMED (F1):** `regionPath()` had no root-file branch — every root file became a fake
  "system"; browser probe showed 54 nav entries with 36 file-systems, and clicking `.bun-version`
  opened the ROOT directory, not the file (`cli/src/commands/graph-export/template.ts:732-741`
  navigation branch, pre-fix artifact probe).
- **CONFIRMED (F2):** `drawPlanetEffects()` draws a generic dark planet disc + glow dot as the ROOT
  background emblem (`cli/src/commands/graph-export/template.ts:366-415`); no brand image in the
  background layer.
- **CONFIRMED (F3):** `searchUniverse()` returns at most one `.find()` match across files then
  regions; no folders, no results surface, no keyboard/emphasis (`cli/src/commands/graph-export/template.ts:732-741`).
- **CALL-GRAPH (F3):** `searchUniverse` is exported on `window` at template.ts:778 and referenced by
  the form `onsubmit` (template.ts:101) — the only consumers; a results panel keeps this contract and
  adds `input`/keydown listeners inside the same IIFE.

### Loop 1 — GREEN

- **F1:** group root files into the ROOT region; ROOT sorts first; ROOT never `disconnected`;
  regression test. *(Implemented — no further changes.)*
- **F2:** compose the embedded Savant PNG into the ROOT planet-effect body with halo/rings preserved;
  graceful decode-fallback; reduced-motion static draw.
- **F3:** search index + pure score ranking across files/folders/systems; live debounced results
  panel with `<mark>` highlighting; keyboard (↑/↓/Enter/Escape) + click; no-match state; `textContent`-safe
  rendering.

### Missed Questions and Answers

1. **Should every region get the brand logo?** → No. Only ROOT (the center backdrop emblem) gets the
   mark; small non-ROOT planets keep the procedural look so the brand stays the one focal point.
2. **Should search rank folders and systems equal to files?** → Yes — all three kinds are indexed;
   kind order breaks score ties (system → folder → file) so navigation is predictable.
3. **What happens while the logo image decodes?** → The procedural planet renders for ROOT until
   `brandLogo.complete`; the next rAF frame swaps it in. No blank frame.
4. **Does the search panel conflict with the right sidebar / center focus?** → No; it is a transient
   dropdown that closes on navigate/Escape/blur; selection flows through the existing
   `navigateToObjectWithCue` path.
5. **Is 12 visible rows enough?** → Yes with a "N MORE" footer; the real export's top-12 for any
   query is already scoped (a system + its files), and capping keeps the panel responsive.
6. **Should content (document text) be searched?** → Out of scope here; F3 indexes paths/labels only.
   Document-text search would need its own budget-aware FID (documents are already embedded with caps).
7. **Reduced-motion users lose the glow pulse — is the logo still visible?** → Yes; the logo draw is
   static; only the halo pulse animates, and `reducedMotion` freezes it at 0.5 as today.
8. **Does the mark replace the orbit rings?** → No; rings remain — the brand sits at the planet's
   core, inside the existing ambient emblem, which is the composition the operator asked for
   ("change the circle logo … to the savant logo").

### Loop 1 — AUDIT

- **PASS — F1 evidence:** `packages/knowledge-graph/src/export-serializer.ts:287-301` quotes the
  root-file branch; `:688` quotes the ROOT disconnected exemption; regression test at
  `cli/src/commands/__tests__/graph-export.test.ts` ("groups root-level files into the ROOT system").
- **PASS — F1 verification:** headless-Chrome probes before (54 / directory-open) and after
  (22 / document-open) on the regenerated artifact; gates typecheck ×2, suite 20/20, ESLint,
  Prettier, deterministic export.
- **PASS — F2 reachability:** `LOGO_DATA_URI` already imported and inlined at
  `cli/src/commands/graph-export/template.ts:10,95`; `#planet-effects` canvas + `drawPlanetEffects`
  loop are the single background composition site (template.ts:120, 366-415) — zero other consumers.
- **PASS — F3 call-graph:** `window.searchUniverse` (template.ts:778) is the only external hook; the
  new panel is internal to the same IIFE, so no API surface change.
- **NEEDS-REVIEW — F2/F3 browser pixels:** final visual confirmation of the brand backdrop and the
  search panel must come from the regenerated artifact in Chrome after implementation (screenshot/
  probe) — same honesty boundary as FID-2026-0807-006.

### Loop 1 — ADVERSARIAL

- **CONFIRMED:** F1 was a real navigation regression (fake systems → wrong destination) and is now
  fixed with browser evidence; remaining scope is honest polish, not blocking.
- **CONFIRMED:** branding the center backdrop is a legitimate composition request; restricting it to
  ROOT avoids brand clutter on 21 other planets.
- **ADJUSTED:** F3 ranking now includes folders and systems with kind-order tie-breaking, and the
  panel caps at 12 rows + footer rather than unbounded scroll — keeps 2,084-file corpus snappy.
- **REFUTED:** Document-text search and per-region logos are both out of scope (budget/visual noise);
  noted as future FID candidates rather than folded in.
- **VERDICT:** Converged; F1 verified, F2/F3 implementation-ready pending operator approval.

## Code Verification Evidence

- [x] ECHO-single-agent.md + echo-v0.1.2-single-agent.md reread before FID planning.
- [x] Serializer, template, tests, and real artifact inspected; call-graphs grepped.
- [x] RED catalogs all three issues with `file:line` evidence.
- [x] GREEN answers brand scope, search ranking, decode fallback, reduced motion, and offline safety.
- [x] AUDIT cites current source evidence; F2/F3 final pixels marked NEEDS-REVIEW.
- [x] ADVERSARIAL re-audits scope creep (content search, per-region logos) and caps.
- [x] F2 implementation complete (brand logo backdrop for ROOT region).
- [x] F3 implementation complete (ranked kind-aware search + keyboard nav).
- [x] Regenerated artifact + browser probe evidence for F2/F3.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** F1 implemented (root-file region grouping, ROOT-first sort, disconnected
  exemption, regression test, browser-verified 54→22). F2 implemented: the ROOT region's background
  planet body is now the Savant brand logo (data URI read from the header `<img>` so the multi-line
  base64 constant never enters a JS string literal), halo + orbit rings preserved, procedural fallback
  while decoding, reduced-motion static. F3 implemented: `buildSearchIndex()` covers files, folders,
  and systems; `searchScore()` ranks (exact → prefix → path-segment → contains); live debounced
  `#search-results` panel with `<mark>` highlighting, `role=listbox` ARIA, ↑/↓/Enter/Escape + click,
  folder results route through the center browser, no-match state.
- **Tests Added:** Yes — F1 regression + F2 brand-backdrop string contracts + F3 search-depth string
  contracts in `cli/src/commands/__tests__/graph-export.test.ts` (suite now 22/22, 217 expect calls).
- **Verified By:** typecheck ×2 exit 0 (knowledge-graph + cli); graph-export suite 22/22; ESLint
  clean; Prettier clean; FID markdownlint clean; live E2E harness 19/19; headless-Chrome probe:
  `BRAND_LOGO_DRAWN=true`, 104,826 canvas pixels, 12 ranked rows for "template", ArrowDown→Enter
  navigates to a folder (`Exploring common/src/templates`), Escape closes panel; regenerated artifact
  deterministic 12.71 MB.
- **Commit/PR:** Pending
- **Archived:** 2026-08-07 (moved to `dev/fids/archive/`)

## Lessons Learned

A "circle" in a visualization is often a component (here: the ROOT planet-effects body), not an
asset — reproduce the pixel before changing it, and probe the click path to prove intent. Search
features should be ranked, kind-aware, and keyboard-accessible from day one; a single `.find()` probe
does not survive a multi-thousand-file export.
