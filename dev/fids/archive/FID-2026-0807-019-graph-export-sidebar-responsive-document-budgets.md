# FID: Graph-export sidebar, document budget, and responsive polish

**Filename:** `FID-2026-0807-019-graph-export-sidebar-responsive-document-budgets.md`
**ID:** FID-2026-0807-019
**Severity:** medium
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant
**YAGNI-Compliance:** Confirmed — focused implementation reuses existing serializer, renderer, and window-control contracts

---

## Summary

Audit and refine the generated offline Code Universe graph export after a live
Chrome review of `dev/exports/graph/savant-graph.html`. The export is functional
and the existing drill-down path works, but the left navigation is too narrow
for deep paths, the count treatment is visually weak, nested scrolling creates
competing scrollbars, document toolbar controls compress and wrap, the
character watermark remains too visible, and text documents are still subject
to several independent inline-size limits that produce `HEAD PREVIEW` and
`FILE TOO LARGE FOR EXPORT` states. This FID covers the responsive navigation
and document-viewer polish as one coherent export-surface pass.

## Environment

- **OS:** Windows 11 host
- **Language/Runtime:** TypeScript, Bun, generated self-contained HTML, Chrome
- **Tool Versions:** Repository-pinned Bun/OpenTUI/Sigma stack; live artifact opened with Chrome
- **Commit/State:** Working tree contains the existing graph-export implementation and archived FIDs 014–015

## Detailed Description

### Problem

The generated graph export has the following confirmed or source-verifiable
issues:

1. **Sidebar width and responsive behavior:** `.region-nav` uses a fixed
   `width: 205px` and the narrow media query reduces it to `170px`. Deep
   drill-down paths and nested folder labels therefore get squeezed or
   ellipsized instead of receiving a responsive navigation column.
2. **Weak count treatment:** `.region-count` is a plain text span with no
   badge surface, spacing contract, or minimum width. Counts visually run into
   long system labels.
3. **Competing scroll containers:** the export independently scrolls
   `.region-nav`, `.graph-sidebar`, `.center-browser`, `.browser-grid`,
   `.document-surface`, and connection lists. The current CSS repeats scrollbar
   declarations across selectors, but there is no shared design token and the
   center browser/grid/document surfaces can create nested scrollbars for one
   view.
4. **Toolbar compression:** `.document-toolbar` is a single flex row with no
   `flex-wrap`, no grouped navigation control, and no `min-width`/`white-space`
   contract for `← PREV FILE` and `NEXT FILE →`. At constrained widths labels
   visually split or controls are forced into a second row without a contained
   control group.
5. **Watermark visibility:** `.center-focus::after` renders
   `CHARACTER_WATERMARK_DATA_URI` at `opacity: .12`. The user requests that
   visibility be halved again so the character remains branding rather than
   competing with document content.
6. **Arbitrary text-document limits:**
   `packages/knowledge-graph/src/export-serializer.ts` currently applies
   `DOCUMENT_MAX_SOURCE_BYTES` (1 MiB), `DEFAULT_DOCUMENT_LINES` (500),
   `DEFAULT_DOCUMENT_BYTES` (50 KiB), `DEFAULT_DOCUMENT_TOTAL_TEXT_BYTES`
   (8 MiB), `DEFAULT_DOCUMENT_HEAD_BYTES` (8 KiB), and
   `DEFAULT_DOCUMENT_HEAD_TOTAL_BYTES` (4 MiB). The resulting artifact contains
   `HEAD PREVIEW` and `FILE TOO LARGE FOR EXPORT` branches and tells users to
   rerun the command with larger limits.
7. **Live artifact confirmation:** Chrome successfully opened the supplied
   `file://` artifact at desktop and narrow viewports, expanded a top-level
   region, expanded a folder, and opened `.bun-version`; the browser reported
   zero console errors. The successful interaction does not remove the layout
   and policy defects above. Exact DOM measurements and computed-style output
   were not captured in the available probe result, so pixel-level claims remain
   `NEEDS-REVIEW` until the implementation probe records them.

### Expected Behavior

- The left navigation reserves a responsive, usable width for deep paths and
  remains usable rather than being squeezed by the graph viewport.
- System/file counts render as visually distinct compact badges with enough
  horizontal separation from labels.
- Each major surface uses the same scrollbar tokens. A document view should
  have one primary document scroll surface rather than accidental nested
  vertical scrollbars; intentional secondary lists remain bounded and clearly
  distinct.
- Previous/next controls remain contained, readable, and single-line at normal
  widths. At narrow widths they may move as a group, but their labels must not
  break into `NEXT` / `FILE` lines.
- The watermark is present but substantially quieter than the current export.
- Text documents open inline in full by default. The export must not emit
  arbitrary default aggregate/per-file/head-preview limits or tell users to
  rerun with larger text limits.
- Explicit operator-supplied limits remain available as an escape hatch for
  intentionally bounded exports, and binary/media safeguards remain separate
  from text-document behavior.
- Truly unreadable files, failed reads, and unsupported binary content continue
  to receive a clear unavailable state rather than crashing export generation.

### Root Cause

The graph export accumulated independent features over several FIDs. Layout
rules were added locally instead of through shared responsive tokens; document
serialization retained earlier safety caps after the product decision changed
toward full inline documents; and the UI still exposes the serializer's old
preview policy directly in generated copy. The generated HTML is self-contained,
so source size affects both export memory and browser parse/render cost, but the
current user-facing behavior treats ordinary large text files as unavailable
rather than making the tradeoff explicit at export time.

### Evidence

Static source evidence:

```text
cli/src/commands/graph-export/template.ts
  .region-nav: fixed width:205px; narrow media query width:170px
  .region-count: plain flex item with color/font-size only
  .region-nav, .graph-sidebar, .center-browser, .browser-grid,
    .document-surface: multiple overflow containers with repeated scrollbar CSS
  .document-toolbar: display:flex with no wrap/group sizing contract
  .center-focus::after: opacity:.12
  renderDocument(): HEAD PREVIEW and FILE TOO LARGE FOR EXPORT messages

packages/knowledge-graph/src/export-serializer.ts
  DOCUMENT_MAX_SOURCE_BYTES = 1 MiB
  DEFAULT_DOCUMENT_LINES = 500
  DEFAULT_DOCUMENT_BYTES = 50 KiB
  DEFAULT_DOCUMENT_TOTAL_TEXT_BYTES = 8 MiB
  DEFAULT_DOCUMENT_HEAD_BYTES = 8 KiB
  DEFAULT_DOCUMENT_HEAD_TOTAL_BYTES = 4 MiB
  aggregate-budget and oversized-source branches return preview/unavailable documents

dev/exports/graph/savant-graph.html
  generated artifact size: approximately 17 MB
  contains HEAD PREVIEW, FILE TOO LARGE FOR EXPORT, and aggregate text budget copy
```

Runtime evidence:

```text
Chrome file:// audit: initialization succeeded
Navigation path: top-level region → folder expansion → .bun-version file view
Viewport audit: 1440×900 and approximately 900×700 completed
Console errors: 0
Exact computed widths/scroll ownership/watermark alpha: NEEDS-REVIEW

Artifact evidence captured 2026-08-07:
  bytes: 17,173,885
  sha256: 8599cc3bfc7196fb3975d03b54a54f35ae4ecc5489ad3c2af25d99302c2273df
  aggregate text budget markers: 3
  FILE TOO LARGE FOR EXPORT markers: 2
  HEAD PREVIEW markers: 2
```

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts`
- `packages/knowledge-graph/src/export-serializer.ts`
- `cli/src/commands/__tests__/graph-export.test.ts`
- Generated output under `dev/exports/graph/`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists but conflicts with the intended full-document workflow
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Implement a focused responsive/document-surface pass with shared design
constants and explicit text-document policy:

1. **Responsive navigation shell**
   - Replace the fixed sidebar width with a clamped responsive width using
     CSS custom properties and viewport-aware bounds: desktop target
     `clamp(260px, 24vw, 380px)`; narrow target `min(88vw, 360px)`.
   - Give the sidebar a deliberate responsive overlay-panel treatment below
     the narrow breakpoint rather than squeezing the graph and tree
     simultaneously. It remains a visible navigation panel, not a modal drawer,
     so no new trigger, close workflow, or focus trap is introduced.
   - Preserve deep drill-down indentation while applying bounded label
     ellipsis only after the row has reserved space for chevrons and badges.
   - Acceptance: at 1440px viewport width the navigation content box is at least
     260px wide; at 900px it is at least 280px wide; at 640px or less it uses
     `min(88vw, 360px)` as an overlay panel and does not reduce the graph to a
     squeezed fixed column.
2. **Count badges**
   - Render count spans as compact badges with a minimum inline size,
     centered text, padding, border, and a consistent gap from the label.
   - Apply the same treatment to region and nested-folder counts where counts
     are shown.
3. **Scrollbar design system and scroll ownership**
   - Extract shared scrollbar variables/tokens from the repeated selectors.
   - Define exact vertical scroll owners: `.region-nav` owns the navigation tree;
     `.graph-sidebar` owns its details panel; `.document-surface` owns text
     document scrolling; `.browser-grid` owns folder-card pagination only when
     cards exceed the available viewport; connection lists may remain bounded
     secondary lists. `.center-browser` must not independently scroll while a
     document or grid owner is active.
   - Keep keyboard focus and `scrollIntoView` behavior intact after the layout
     change, and add a browser assertion that one document view has exactly one
     primary vertical scrollbar.
4. **Contained document navigation controls**
   - Add a semantic document navigation group for back/previous/next actions.
   - Use `white-space: nowrap`, `flex: 0 0 auto`, and responsive group layout so
     labels never split into separate words.
   - Allow metadata and editing controls to move below the navigation group at
     narrow widths without making the controls themselves two-line buttons.
5. **Quieter watermark**
   - Reduce the current watermark opacity by half, from `.12` to `.06`, and
     retain pointer/event transparency and the existing mask.
6. **Unlimited-by-default text documents**
   - Remove default arbitrary text caps from the serializer: no default source
     byte cap, line cap, per-document text byte cap, aggregate text byte cap,
     or head-preview pool for text documents.
   - Keep explicit option/env limits working when an operator deliberately
     supplies them, so bounded exports remain possible for constrained hosts.
   - Remove text preview/unavailable messaging and branches that are reachable
     only because of the default text caps. Preserve unavailable handling for
     read failures, unsupported content, and explicit operator limits.
   - Keep raster/media byte limits separate and bounded by default because
     embedding binary assets has a different memory and artifact-size profile.
   - Ensure UTF-8 truncation remains correct when an explicit text limit is
     supplied.
7. **Regression coverage and large-document rendering**
   - Update source-contract tests for the new CSS tokens, responsive rules,
     badge classes, toolbar grouping, watermark opacity, and text-policy copy.
   - Define default-vs-explicit semantics precisely: an omitted option or env
     variable means unlimited text; a positive option/env value is an explicit
     cap; invalid/zero values normalize to `undefined` and remain unlimited.
     Remove finite defaults from every `serializeGraphForExport` and helper
     destructuring layer; the graph-export template must pass `undefined`
     through unchanged. `documents: false` still disables document embedding
     entirely.
   - Remove the text-only `DOCUMENT_MAX_SOURCE_BYTES` gate from the unlimited
     path. Keep media/image limits and explicit text caps separate.
   - Add a named `LARGE_DOCUMENT_LINE_THRESHOLD = 10_000` renderer constant.
     Keep the current line-numbered rows at or below the threshold. For larger
     text documents, render one preformatted text node with wrapping controls
     preserved and show a compact `LINE NUMBERS HIDDEN FOR LARGE FILE` note;
     copying still uses the complete embedded text. This is a browser-DOM
     policy, not an export byte limit. Acceptance: a 100,000-line fixture opens
     without a renderer timeout and without creating 100,000 independent line
     elements; compact rendering tests cover complete copy, wrap toggling, and
     accessible text content.
   - Define the document-state contract: full text is `kind: 'text'` with
     `truncated: false`; an explicit positive cap may return `kind: 'text'` with
     `truncated: true` and an explicit-cap indicator; a read failure returns a
     separate unavailable reason; `documents: false` remains disabled. The
     default unlimited path must never use the old aggregate/head-preview
     message.
   - Detect unknown binary content before the unlimited text path by checking
     the first 8 KiB for NUL bytes and a conservative known-binary signature
     list (PDF/ZIP/ELF/PE). Add a text fixture containing no NUL bytes and a
     binary fixture containing NUL/signature bytes to cover false positives and
     false negatives. Known raster types retain their media path; unknown
     binary content remains unavailable rather than being embedded as text.
   - Add serializer tests proving ordinary large text is fully embedded by
     default, explicit caps produce distinguishable bounded text, invalid limits
     use unlimited defaults, read failures remain unavailable, unknown binary
     content remains unavailable, and binary media remains bounded.
   - Regenerate a deterministic artifact and run a browser probe at desktop,
     narrow, deep-drilldown, and document widths. Assert that in document mode
     `.document-surface` is the only primary vertical scroll owner:
     `scrollHeight > clientHeight` there, while `.center-browser` has
     `overflow-y: hidden` and no independent vertical overflow.

### Important Design Boundary

“Unlimited” means **unlimited by default for text documents in the serializer**.
The exact contract is: omitted option/env = no text cap; positive option/env =
that explicit cap; zero, negative, or invalid option/env normalize to
`undefined` and mean no text cap; and `documents: false` = no document payload.
Every serializer/helper destructuring layer must preserve `undefined` rather
than reintroducing finite defaults. Full text, explicit-cap text, unavailable,
and disabled documents remain distinguishable in the exported document shape.
This does not mean ignoring explicit
operator limits or embedding arbitrary binary files. A generated HTML file can
become very large and browser memory remains a real operational constraint. The
UI should stop presenting a normal text-file limit as a mysterious failure,
while the command still permits intentional bounded exports for CI, sharing, or
low-memory environments.

### Steps

1. Update the FID through RED/GREEN/AUDIT/ADVERSARIAL and confirm the default
   text policy.
2. Refactor graph-export CSS into shared responsive/sidebar/scrollbar tokens.
3. Adjust tree rows and count badges without changing drill-down data flow.
4. Consolidate document scroll ownership and contain toolbar navigation.
5. Reduce watermark opacity to `.06`.
6. Update serializer defaults and explicit-limit behavior for text documents.
7. Update focused tests and regenerate the artifact.
8. Run CLI/knowledge-graph typechecks, focused tests, ESLint, Prettier,
   markdownlint, and browser/runtime probes.

### Verification

- `cd packages/knowledge-graph && bun run typecheck`
- `cd cli && bun run typecheck`
- `cd packages/knowledge-graph && bun test`
- `cd cli && NODE_ENV=production bun test src/commands/__tests__/graph-export.test.ts`
- `bun x eslint cli/src/commands/graph-export
  packages/knowledge-graph/src/export-serializer.ts
  cli/src/commands/__tests__/graph-export.test.ts --max-warnings 0`
- `bunx prettier --check` on all changed files
- `bun x markdownlint-cli2` on the FID and changed documentation
- Deterministic graph-export regeneration
- Chrome runtime probe at desktop and narrow widths covering sidebar drilldown,
  count badges, scroll ownership, watermark opacity, full text embedding, and
  single-line previous/next controls

## Perfection Loop

### Loop 1

- **RED:** Source and live-artifact audit identified responsive sidebar,
  count-badge, scrollbar ownership, watermark, toolbar, and default text-budget
  defects. Existing FIDs 014 and 015 were reviewed to avoid duplicating their
  already-implemented window/document polish. Current baseline evidence:
  knowledge-graph typecheck passed; CLI typecheck passed; knowledge-graph tests
  passed 17/17; graph-export tests passed 37/37; FID Prettier and markdownlint
  passed; artifact measured 17,173,885 bytes with 2 `HEAD PREVIEW`, 2 `FILE TOO
  LARGE FOR EXPORT`, and 3 aggregate-budget markers.
- **GREEN:** Proposed responsive shell, shared scrollbar tokens, badge treatment,
  contained navigation group, opacity reduction, and unlimited-by-default text
  serialization with explicit opt-in bounds.
- **AUDIT:** Baseline call-graph audit passed: `serializeGraphForExport` is
  consumed by `template.ts`, and `buildGraphExportHtml` is consumed by
  `graph-export.ts`. The design audit required no new production API, but
  identified missing propagation, binary, DOM-rendering, and scroll assertions.
- **SELF-CORRECT:** Revised the design to preserve `undefined` through every
  serializer layer, define the 10,000-line renderer threshold, add unknown
  binary detection, simplify narrow navigation to a visible overlay panel, and
  specify runtime scroll-owner assertions.
- **CHANGE DELTA:** FID/documentation only; no production code changed during analysis.### Loop 2

- **RED:** Re-audited the revised contracts against the current optional
  serializer fields and template call sites. The first adversarial pass found
  stale missed-question wording and required stronger contracts for defaults,
  renderer behavior, binary classification, and document-state distinctions.
- **GREEN:** Converged design: unlimited text defaults are explicit and
  distinguishable from positive caps; all destructuring layers preserve
  `undefined`; media and unknown binary content remain bounded/unavailable;
  `LARGE_DOCUMENT_LINE_THRESHOLD` defines compact rendering; navigation and
  scroll acceptance criteria are measurable.
- **AUDIT:** Baseline verification passed: knowledge-graph typecheck and 17
  tests, CLI typecheck and 37 graph-export tests, focused ESLint, Prettier, and
  markdownlint. Production reachability is confirmed for
  `serializeGraphForExport` → `template.ts` and `buildGraphExportHtml` →
  `graph-export.ts`. Runtime pixel/scroll measurements remain
  `NEEDS-REVIEW` until implementation.
- **ADVERSARIAL:** Final review confirms the design is complete for
  implementation. Production behavior remains pending by design; the proposed
  `undefined` propagation, binary detection, compact renderer, and runtime
  scroll assertions must be verified after code changes.

### Missed Questions

1. **Should “remove the limit” include images?** No. Text documents are the
   requested unlimited-by-default path; raster/media embedding retains separate
   byte safeguards to avoid turning a single image into an uncontrolled artifact.
2. **Should explicit environment limits be removed?** No. They remain useful for
   CI, sharing, and low-memory machines, but defaults must not force ordinary text
   files into preview/unavailable states.
3. **What happens when a full text file makes the HTML too large for Chrome?**
   The exporter honors the unlimited default and reports host/export failures
   clearly; it does not silently fall back to the old per-file preview wall.
   The renderer uses the named large-document threshold rather than one DOM
   element per source line.
4. **What exactly counts as an explicit text limit?** A positive option/env value
   is explicit; omitted, zero, negative, and invalid values normalize to
   `undefined` and mean unlimited. The CLI documents-disabled switch remains
   authoritative, and the exported document shape distinguishes full,
   explicitly capped, unavailable, and disabled states.
5. **Should the document and browser both scroll?** No for normal document mode.
   The document surface owns vertical scrolling; the browser shell sizes around
   it. The region tree, details panel, card grid, and bounded connection list
   are the only other intentional vertical owners.
6. **Should the sidebar remain beside the graph at narrow widths?** No. Below
   the responsive breakpoint it becomes a visible responsive overlay panel,
   not a modal drawer or squeezed fixed column, so no focus-trap workflow is
   needed.
7. **Should count badges be clickable?** No. They are status affordances; the
   existing row remains the interaction target.
8. **Should watermark opacity affect the graph's central logo planet?** No. This
   request targets the document background watermark only. The graph emblem and
   header branding retain their existing identity treatment.
9. **Should toolbar labels be shortened to avoid wrapping?** No. Preserve clear
   labels such as `NEXT FILE →`; size and group controls correctly instead.
10. **How should a failed read differ from an explicit cap?** A failed read or
    unsupported file remains unavailable; an explicit cap returns distinguishable
    bounded text; default unlimited serialization never produces the old preview
    or aggregate-budget state.
11. **Should the large-document renderer keep one line element per source line?**
    No. Use `LARGE_DOCUMENT_LINE_THRESHOLD = 10_000`; beyond it use one
    preformatted text node, hide line numbers with an explicit note, and test
    complete copy, wrap toggling, and accessible text.
12. **How are unknown binary files handled?** Inspect the first 8 KiB for NUL
    bytes and PDF/ZIP/ELF/PE signatures; add text and binary fixtures so valid
    text is not falsely rejected and binary content is not embedded as text.
13. **Does this change alter drill-down semantics?** No. It changes
    presentation and scroll ownership only; top-level click, folder expansion,
    and file selection must retain their current behavior.

### Code Verification Evidence

> Implementation evidence recorded after the converged FID was built and
> independently reviewed.

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Knowledge-graph and CLI typechecks pass
- [x] Knowledge-graph tests pass (17/17)
- [x] Focused graph-export tests pass (34/34)
- [x] Focused ESLint and Prettier checks pass
- [x] Regenerated artifact contains the quieter watermark and no retired
      production preview/head-limit identifiers
- [x] Browser file:// probe reports zero console errors
- [x] FID status updated to reflect implementation state

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-07
- **Fix Description:** Implemented responsive graph navigation, count badges,
  shared scrollbar tokens and document scroll ownership, contained document
  navigation, quieter character watermark, unlimited-by-default text documents,
  explicit-cap messaging, binary probing, and compact rendering for very large
  documents.
- **Tests Added:** Unlimited/default and explicit-cap serializer coverage,
  invalid-limit normalization, large-text embedding, binary/control-byte
  coverage, and generated UI contract assertions.
- **Verified By:** Independent code review, focused static gates, and Chrome
  file:// runtime probe
- **Commit/PR:** Pending
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

Document-size policy must be treated as a product decision, not only as a
serializer implementation detail. When a generated offline UI exposes a cap,
the cap, its fallback behavior, and its rerun instructions all become part of
the user experience and must change together. Full-text defaults also require
an explicit rendering-performance contract; otherwise removing a serializer
cap simply moves the failure into the browser DOM.
