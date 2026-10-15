# FID-2026-0807-010 — Code Universe sidebar drill-down + nav polish

**Phase:** RED → GREEN → AUDIT → ADVERSARIAL → COMPLETE
**Date:** 2026-08-07
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**YAGNI-Compliance:** All items operator-requested; no speculative scope.

## RED — Issue catalog (evidence)

Deep UI audit of `/graph-export` (Code Universe) surfaced the following,
root-caused in `cli/src/commands/graph-export/template.ts`:

- **F1 — No sidebar drill-down (operator blocker):** `buildRegionNav` +
  `toggleRegionFiles` render a FLAT per-region file list (60-button cap,
  `template.ts:1015-1075`). A region with files in `packages/foo/src/x.ts`
  shows `src/x.ts` mixed into one list — no sub-directory structure, no
  nested expand. Operator: "sidebar should expand and show the contents of
  that folder, then when you click the file the center updates."
- **F2 — File rows do not reveal their location:** selecting a file from the
  sigma graph or search never expands/scrolls the nav to that file's row; the
  tree (once nested) would stay collapsed.
- **F3 — No active-file indicator:** only the region row highlights on
  navigation (`navigateToObjectWithCue`, `template.ts:779`); the exact file
  row is never marked.
- **F4 — Document view has no sibling paging:** `renderDocument` offers only
  BACK TO FOLDER + COPY; moving file-to-file requires up/back + re-click.
- **F5 — Redundant full-path text in nav rows:** flat file rows printed the
  whole `f.path` under each label (`template.ts:1030-1031`); a nested tree
  conveys path structure, so per-row paths become noise.

## GREEN — Converged design

- **F1 — Nested per-region directory tree.** `buildRegionTree(files)` folds
  each region's file paths into `{ name, path, folders, files }` nodes.
  `regionRootTree(regionId)` caches one tree per region. Region rows expand
  (chevron + `aria-expanded`/`aria-controls`) into a recursive
  `renderTreeLevel(container, node)`: folder rows first (`▸` chevron,
  name, child count), then file rows. Folder rows lazy-expand into the same
  level renderer (`toggleFolderRow`); every level caps at 60 visible rows
  with a "+N more in explorer" note. File rows keep `region-file` styling
  (no per-row path). A region row still navigates the center to that
  region's folder on click (unchanged); folder rows navigate the center to
  that folder (`navigateToFolder`) and expand.
- **F2 — Auto-reveal.** `revealInNav(id)` runs at the end of
  `navigateToObjectWithCue` for file objects: expands the owning region
  row, walks the path expanding each ancestor folder, then scrolls the
  target row into view (`scrollIntoView({ block: 'nearest' })`).
- **F3 — Active indicator.** Every nav row carries `data-nav-id`;
  `highlightNav(id)` clears and sets `.nav-active` (styled) across the nav
  on every navigation. `fitUniverseInternal` clears it on reset.
- **F4 — Prev/next siblings.** `siblingFiles()` resolves the current
  folder's file children; `renderDocument` appends `← PREV FILE` /
  `NEXT FILE →` buttons (disabled at the ends) that re-render the doc for
  the sibling.
- **F5 — Deleted.** The flat-list path `<small>` is gone with the flat list.

Explicit non-goals (this FID): keyboard tree navigation, collapse-all,
breadcrumbs, doc word-wrap toggle — tracked as follow-ups, not shipped.

## AUDIT — Verification evidence

- Typecheck (cli) exit 0; `graph-export.test.ts` 30/30 pass (278 expects,
  updated nav contracts + new drill-down + prev/next tests).
- ESLint `--max-warnings 0` + Prettier clean on changed files; FID
  markdownlint clean; live E2E harness 19/19 PASS.
- Regenerated artifact deterministic (13.77 MB). Headless-Chrome
  click-through probe: 22 regions; `.agents` region expands → `skills`
  → `coding-csharp` → SKILL.md (depth 3, no phantom region-level folder);
  file row click opens the document (`.bun-version`, 2 lines); the row is
  marked `region-file nav-active`; prev/next buttons present, NEXT navigates
  to `.gitattributes`. Two tree bugs found by the probe and fixed: a
  redundant region-name top folder (fixed via `regionSkipSegments`) and a
  `relKey` slice-index bug that leaked the region's own name into nested
  levels (fixed via `relParts`).

## COMPLETE — Close

FID archived to `dev/fids/archive/`; CHANGELOG entry added under
FID-2026-0807-010.
