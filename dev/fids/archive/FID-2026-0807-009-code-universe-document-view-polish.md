# FID-2026-0807-009 — Code Universe: Character Watermark + Document-View Polish

**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Area:** `cli/src/commands/graph-export/template.ts` (+ generated watermark asset)
**Signed:** Savant (Savant session)

## RED — Issue Catalog (with evidence)

| # | Issue | Evidence |
|---|-------|----------|
| F1 | Document backdrop still shows the ambient circle, not brand art. The Savant logo planet (FID-008 F2) is itself a circular emblem (`art/savant-logo.png`) and the sigma ROOT node circle + label renders on top of it (`#planet-effects` z:1 < `.sigma-container` z:2). Replacement art: `assets/logo.png` (2048² character, 888,939 B palette PNG), wanted **as the document background at ~25% opacity**. | CSS z-index ordering; F2 probe drew the logo but the screenshot still reads as a circle |
| F2 | Document-view close button (×) is invisible and overlaps the back button's top-left corner. `.center-focus>*:not(.center-focus-grid)` (0,2,0) overrides `.center-focus-close{position:absolute}` (0,1,0), dropping the × into top-left flow instead of anchoring top-right. | CSS specificity ordering; user report |
| F3 | Document surface too short; header stack (back/title/path/meta) wastes ~150 px. | `.center-focus{height:min(78vh,720px)}`, `.document-surface{height:calc(100% - 150px)}` |
| F4 | Content-area scrollbars are default; only sidebar/drawer carry the themed cyan scrollbar. | scrollbar rules scoped to `.region-nav`/`.graph-sidebar` |
| F5 | No way to copy the open document's content. | `renderDocument` header has no copy control |
| F6 | "Document unavailable: oversized" renders as plain pink text — no designed state. | `renderDocument` unavailable branch |
| F7 | Search dropdown anchors `right:0` against `.universe-header` (nearest positioned ancestor — the form is not positioned), so it floats far right, not under the input. | `.search-results{position:absolute;right:0;…}` |
| F8 | Left nav lists systems only; clicking a region updates the center but does not expand the region's files inline. | `buildRegionNav` builds one `<button>` per region |
| F9 | ROOT sigma node circle + label covers the brand emblem in the universe backdrop. | `reduceNode` renders region nodes with label + full size |

## GREEN — Resolutions

- **F1** — Generated `character.ts` exports `CHARACTER_WATERMARK_DATA_URI` (base64 of `assets/logo.png`,
  ~1.19 MB data URI). `.center-focus::after` (formerly the circle ring) becomes the watermark:
  `background:url(…) center/contain no-repeat`, `opacity:.25`, radial mask fade
  (`mask-image:radial-gradient(circle,#000 36%,transparent 74%)`, alpha mode), `pointer-events:none`,
  clipped by the panel's `overflow:hidden`. `.document-surface` goes translucent so the mark shows
  through the code area; the dark panel keeps text contrast. Single inline copy.
- **F2** — Exclude the close button from the positioning rule
  (`.center-focus>*:not(.center-focus-grid):not(.center-focus-close)`); restyle both close buttons
  as visible bordered × chips with hover glow; redesign `.browser-back` (gradient + hover lift).
- **F3** — `.center-focus` height → `min(86vh,880px)`; document header becomes a compact
  toolbar (back + meta + COPY; title; path); surface height `calc(100% - 118px)`.
- **F4** — Extend themed scrollbar selectors to `.center-browser`, `.document-surface`, `.browser-grid`.
- **F5** — `copyDocumentContent(file, doc)`: `navigator.clipboard.writeText(doc.text)` with
  a textarea `execCommand` fallback + status feedback; wired to a `.document-copy` button.
- **F6** — Designed unavailable card: glyph + `FILE TOO LARGE FOR EXPORT` / `DOCUMENT NOT EXPORTED` + hint line.
- **F7** — `.universe-search{position:relative}`; `.search-results{left:0;right:auto;width:min(400px,…)}`.
- **F8** — `buildRegionNav` becomes an accordion: region rows (chevron ▸/▾ + count) toggle
  a capped 60-file `.region-files` list (+N more note); file rows navigate; active highlight.
- **F9** — `reduceNode`: ROOT region node becomes a dim dot (size 4, no label, alpha .32)
  when not selected, so the emblem reads as backdrop; logo enlarged radius*1.32 with
  brightness filter + cyan rim ring.

## AUDIT (reachability)

- Consumers: renderDocument/renderCenterBrowser/buildRegionNav/reduceNode/copySelectedPath; clipboard pattern reused.
- `CHARACTER_WATERMARK_DATA_URI` interpolated once into `UNIVERSE_CSS`; base64 alphabet is `()${}`-free, safe inside `url()`.
- Watermark pseudo-element: pointer-events:none, clipped by overflow:hidden — no layout or interaction regression.
- String-contract tests added; headless-Chrome probe verifies watermark, toolbar, close position, accordion, search alignment.

## Post-archive amendment — the logo IS the character

> Operator correction (2026-08-07): the Savant logo is the character art
> (`assets/logo.png`). The header `<img class="logo">` and the ROOT planet
> backdrop previously embedded the legacy circular emblem
> (`cli/src/constants/savant-logo.ts`); that stale emblem is what the operator
> kept seeing as "the circle". Corrected: the graph export now uses the
> character everywhere — `CHARACTER_LOGO_DATA_URI` (generated 15 KB circular
> crop of the character) in the header and ROOT planet, and
> `CHARACTER_WATERMARK_DATA_URI` (full character) as the document watermark.
> Artifact shrank ~90 KB (emblem 82 KB → character logo 15 KB in the header).
> New test pins `header src === CHARACTER_LOGO_DATA_URI`; browser probe:
> header logo decoded (19,934-char data URI) + ROOT planet canvas populated.

## ADVERSARIAL (meta-verification)

- **CONFIRMED** F1: watermark covers the whole center-focus panel (folder + document views), no doc-only toggle.
- **ADJUSTED** F1: keep `opacity:.25` exactly as user specified; translucent surface + dark panel keep text contrast acceptable.
- **REFUTED** (future FID): scrolling watermark, per-user background customization.
