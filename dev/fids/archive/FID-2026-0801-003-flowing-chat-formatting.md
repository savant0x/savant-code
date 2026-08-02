# FID: Flowing Chat Formatting and Semantic Block Layout

**Filename:** `FID-2026-0801-003-flowing-chat-formatting.md`
**ID:** FID-2026-0801-003
**Severity:** critical
**Status:** verified
**Created:** 2026-08-01 11:30
**Author:** Buffy

---

## Summary

Savant-Code's assistant transcript still renders ordinary responses as scattered
single-line fragments with repeated blank rows, even after the earlier Zero-style
width and Markdown pass. Thinking/reasoning blocks are intentional and must stay
visible/collapsible; they are not the defect. The remaining failure is the
OpenTUI composition boundary: the Markdown renderer returns a heterogeneous
array containing semantic fragments, inline elements, and newline-only strings,
then `renderExpandedContent` recursively maps that array into a vertical box.
As a result, text that should occupy one flowing prose surface is split into
separate layout children. This FID defines the final production contract:
semantic Markdown blocks own their internal flow and one normalized separator,
while generic OpenTUI wrappers remain neutral. The local Zero implementation is
the primary visual reference; the supplied OpenTUI guide informs measured
widths, row-major tables, stable streaming identity, and restrained visual
hierarchy. No new package or WebGPU subsystem is required.

---

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **UI stack:** React 19, OpenTUI/OpenTUI React 0.2.2, Yoga layout
- **Markdown stack:** `unified`, `remark-parse`, `remark-gfm`, `remark-breaks`, `string-width`
- **Primary visual reference:** `resources/zero/internal/tui`
- **Secondary context:** local reference trees were searched for Kilo Code/OpenCode/OpenClaude-related renderer sources; the only concrete source evidence used in this FID is the supplied `resources/zero` tree. This FID does not claim verified parity with the other tools or treat any external implementation as a dependency.
- **Commit/State:** Existing working tree contains unrelated pre-existing changes; this FID documents the next implementation and adds no production runtime change

---

## Detailed Description

### Problem

The user-visible transcript violates the expected terminal chat rhythm:

1. A normal assistant paragraph appears as isolated one-line entries rather than
   continuing across the available width.
2. Two or more empty rows can appear between lines or paragraphs.
3. Headings, lists, blockquotes, tables, dividers, and fenced code do not have a
   reliable single-owner spacing model.
4. The defect is present in Savant-Code's production OpenTUI composition even
   though other CLI references display the same kinds of responses as dense,
   continuous transcript rows.
5. Thinking/reasoning blocks are a required feature and must remain visible,
   collapsible, and visually distinct. Hiding them is explicitly not a fix.
6. Existing React tests prove that content and elements exist, but do not prove
   the visual row contract through the production message path.

### Expected Behavior

For ordinary assistant prose, the transcript should feel like one continuous
terminal document:

- prose flows across the complete measured content width and wraps only when the
  width budget requires it;
- a paragraph does not become one vertical OpenTUI child per text fragment or
  newline-only node;
- adjacent ordinary paragraphs have at most one intentional separator row;
- leading/trailing blank rows are removed from the rendered message;
- headings, lists, quotes, tables, dividers, and code are semantic blocks with
  predictable compact separation;
- true layout blocks remain structurally distinct and do not get flattened into
  prose;
- reasoning blocks continue to use their existing interactive collapse/expand
  treatment and do not leak their layout spacing into neighboring prose;
- completed and streaming output have equivalent spacing for the stable prefix;
- all output stays within the measured owner width at narrow and normal terminal
  sizes.

### Visual Enhancement Contract

The fix must visibly match the supplied Zero-style goal rather than only make
unit tests green:

- **Hierarchy:** assistant prose is dense and high-contrast; headings have clear
  depth; reasoning, tools, errors, code, and tables have restrained secondary
  treatments.
- **Flow:** ordinary inline text, emphasis, links, and inline code share a
  flowing text host; no decorative box surrounds every paragraph.
- **Semantic blocks:** code/table/quote/list/divider treatments are deliberate,
  compact, and separated once by their owning renderer.
- **Width:** the content width is measured once at the transcript/message
  boundary and passed down; leaf renderers do not subtract unrelated magic
  constants.
- **Responsive behavior:** widths 24, 40, 58, 80, and 120 remain readable,
  without clipped borders, horizontal overflow, or controls consuming the prose
  surface.
- **Stability:** stable Markdown block keys remain stable while tokens stream;
  completed blocks do not remount because a later block grows.
- **Interaction:** copy, reasoning collapse/expand, tool/agent state, and focus
  affordances remain functional and do not add accidental document-height jumps.
- **Theme:** existing Markdown palette/chat theme roles are used; no new
  decorative hard-coded colors are introduced.

### Root Cause

#### 1. Heterogeneous Markdown output is treated as a vertical document

`renderMarkdown` emits a top-level collection of keyed semantic fragments. A
paragraph can contain styled inline elements and newline strings. `normalizeOutput`
now preserves the semantic `markdown-block-*` boundary, which is correct for
streaming identity, but the downstream adapter still treats arrays as a generic
column:

- `renderExpandedContent` in
  `cli/src/components/blocks/block-helpers.tsx` maps array children into a
  `flexDirection: 'column'` box;
- fragments are recursively unwrapped, so the semantic block's text and its
  newline-only children become separate vertical layout children;
- OpenTUI therefore counts both flex rows and text newlines, multiplying the
  intended spacing.

This is the primary cause of the “one line, blank rows, next line” symptom.

#### 2. Markdown and wrapper layers both participate in vertical spacing

`markdown-renderer.tsx` expresses semantic boundaries with newline strings,
while message/block wrappers also compose nested column boxes. Even where outer
containers use `gap: 0`, a newline-only child can still become its own host row.
There is no single adapter contract that distinguishes inline flow from a true
layout block.

#### 3. Text-block boundary trimming is not a safe universal fix

`SingleBlock` applies `trimNewlines` while streaming and `.trim()` after
completion. Removing all trimming would preserve unwanted transport padding and
could merge or distort boundaries between separate text/reasoning blocks. The
correct fix is block-aware normalization: trim only message-edge whitespace at
the document owner, preserve intentional internal content, and let the semantic
renderer own separators.

#### 4. Width correctness cannot compensate for row ownership

The previous width-ledger work improved calculated widths and stable keys, but a
full-width value passed into a vertical array adapter still produces the wrong
visual rhythm. Width and spacing must be verified through the same production
boundary; they cannot be certified independently from React element count.

### Evidence

#### Savant-Code source evidence

- `cli/src/components/blocks/block-helpers.tsx`
  - `renderExpandedContent` accepts `ReactNode` and recursively converts arrays
    into a column box;
  - `isTextRenderable` only treats primitive-only arrays as a text host;
  - rich Markdown arrays therefore follow the vertical fallback path.
- `cli/src/utils/markdown-renderer.tsx`
  - root rendering creates stable `markdown-block-{index}-{type}` fragments;
  - paragraph/list/heading/code/table/divider paths emit newline strings;
  - `normalizeOutput` preserves semantic block fragments but only compacts
    whitespace nodes, not their downstream OpenTUI row ownership;
  - streaming uses a stable-prefix/pending-region split.
- `cli/src/components/blocks/content-with-markdown.tsx`
  - plain text bypasses Markdown parsing when `hasMarkdown` is false;
  - formatted content returns the heterogeneous Markdown node shape to the
    generic adapter.
- `cli/src/components/blocks/single-block.tsx`
  - text blocks pass the rendered Markdown result into `renderExpandedContent`;
  - reasoning blocks are filtered here from ordinary text rendering and must not
    be removed or conflated with the formatting fix.
- `cli/src/components/message-block.tsx` and
  `cli/src/components/message-with-agents.tsx`
  - production path is `MessageWithAgents → MessageBlock → BlocksRenderer →
    SingleBlock → renderContentWithMarkdown → renderExpandedContent`;
  - root prefixes, message gutters, and nested agent widths are already named
    concerns and must remain part of the width ledger;
  - one message-to-message separator may remain at the outer message owner, but
    Markdown wrappers must not add a second generic per-child gap.
- `cli/src/utils/block-operations.ts`
  - consecutive ordinary text deltas append to the latest text block;
  - native reasoning is stored in separate reasoning blocks and closed before
    ordinary text resumes, so the primary symptom is not inherently caused by
    one-block-per-token creation.

#### Local Zero reference evidence

The supplied `resources/zero` implementation establishes the relevant contract:

- `internal/tui/assistant_markdown.go` classifies Markdown into semantic blocks,
  trims display edges, wraps prose against an explicit measure, and preserves
  intentional internal lines;
- `internal/tui/rendering.go` measures assistant rows against the actual chat
  width and joins rendered block rows deliberately rather than nesting generic
  flex gaps around every fragment;
- `internal/tui/transcript_viewport.go` models the transcript as measured visual
  rows;
- `internal/tui/wrap_whitespace_test.go` and
  `internal/tui/transcript_view_test.go` assert whitespace and width behavior
  across representative terminal sizes.

The reusable idea is the measured semantic-row contract, not a Go/Bubble Tea
port.

#### Supplied OpenTUI guide evidence

The guide's applicable recommendations are:

- row-major tables must wrap cells and synchronize row heights;
- newline strings and layout rows must not both independently own the same
  vertical separation;
- stable component identity matters during streaming;
- width measurement must be explicit at the layout owner.

The guide's `@opentui/three`, `bun-webgpu`, and 3D rendering material is
explicitly out of scope. No new visualization package is justified for this
2D transcript defect.

#### Prior FID/lifecycle evidence

- `FID-2026-0731-010-cli-display-quality.md` is marked closed while still in
  active `dev/fids/`; it addressed isolated newline sites and prompt guidance,
  not the array-to-column composition boundary.
- `FID-2026-0801-002-zero-style-chat-rendering.md` is archived but its body says
  runtime implementation was pending. It is not being overwritten. This new FID
  records the narrower, still-observed production failure and keeps the
  implementation approval boundary explicit.

---

## Impact Assessment

### Affected Components

- `cli/src/components/blocks/block-helpers.tsx`
- `cli/src/components/blocks/content-with-markdown.tsx`
- `cli/src/components/blocks/single-block.tsx`
- `cli/src/components/message-block.tsx`
- `cli/src/components/message-with-agents.tsx`
- `cli/src/utils/markdown-renderer.tsx`
- `cli/src/utils/block-operations.ts` (verification only unless a stream fixture exposes a real aggregation defect)
- Focused Markdown, streaming, block-helper, and transcript integration tests
- Interactive tmux/OpenTUI smoke fixture

### Risk Level

- [x] Critical: release-blocking user-facing presentation defect
- [ ] High: major feature broken, no workaround
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor cosmetic or edge case

The classification is critical for release readiness and user trust, not because
this issue causes data loss or code execution.

---

## Proposed Solution

### Approach

Implement one dedicated, block-aware Markdown-to-OpenTUI presentation boundary:

1. Preserve the existing remark/GFM parser, palette, syntax highlighting,
   tables, copy behavior, and reasoning components.
2. Preserve the stable top-level `markdown-block-*` identity boundary.
3. Add a dedicated `renderMarkdownContent`/equivalent Markdown-only adapter at
   the existing `SingleBlock` Markdown call site. Do **not** broaden the shared
   `renderExpandedContent` contract for tools, agents, plans, copy previews, or
   arbitrary custom React content. The dedicated adapter must classify only
   renderer-owned Markdown output using an explicit contract:
   - a semantic Markdown block fragment is a block boundary;
   - primitive strings and inline styled spans inside that block share one
     flowing text host;
   - newline characters inside that host are content line breaks, not sibling
     layout rows;
   - true renderer-owned layout nodes (fenced code, structured tables, and
     other explicitly tagged layout renderables) receive their own direct host;
   - unknown/custom React elements are delegated unchanged to the existing safe
     generic adapter;
   - exactly one normalized separator is emitted between semantic Markdown
     blocks;
   - only outer message-edge blank content is trimmed and repeated separators
     are capped;
   - stable semantic keys are retained without positional remounts.
4. Keep generic non-Markdown custom renderables safe and unchanged. The dedicated
   Markdown adapter must not flatten arbitrary interactive React components into
   text, and the existing generic `renderExpandedContent` behavior remains the
   compatibility path for those callers.
5. Keep reasoning blocks separate. Do not strip native reasoning, `<think>`
   content, collapse state, or thinking IDs. Verify a transcript containing
   reasoning → prose and prose → reasoning transitions.
6. Retain the measured width ledger from the existing chat-layout work. The
   transcript boundary owns root prefix/gutter deductions; nested agent/tool
   owners pass named structural indents; leaf renderers receive the resulting
   width and do not subtract `-8`, `-12`, or equivalent magic values.
7. Apply the visual hierarchy using existing palette/theme roles: dense prose,
   restrained code/table containers, aligned list/quote continuation, visible
   heading depth, compact separators, and stable interactive affordances.
8. Add a production-path visual-row oracle and a real OpenTUI smoke fixture. A
   React element count is not an acceptable visual proof.

### Non-Goals

- Hiding or deleting thinking/reasoning blocks.
- Replacing the Markdown parser solely to obtain a new package.
- Adding `marked-terminal`, `cli-table3`, or another package without a proven
  parser/rendering gap and Bun/Windows/streaming review.
- Adding `@opentui/three`, `bun-webgpu`, or any 3D subsystem.
- Rewriting the sidebar, input bar, provider picker, or unrelated layout.
- Changing assistant response content, system prompts, or model behavior to
  compensate for a presentation-layer defect.
- Archiving unrelated FIDs silently.

### Implementation Steps After Approval

1. Reproduce a baseline through the production renderer with prose, paragraphs,
   headings, lists, blockquotes, tables, code, Unicode, and reasoning fixtures.
2. Implement the dedicated Markdown-only semantic flow adapter at the owning
   boundary, with no duplicate renderer path.
3. Normalize message-edge whitespace and semantic separators without globally
   stripping internal Markdown/code content.
4. Verify root/nested width propagation and remove only deductions proven to be
   duplicate owners.
5. Add/adjust renderer, streaming, block-helper, and transcript integration
   tests.
6. Run tmux/OpenTUI captures at narrow and normal widths; use captured output as
   evidence rather than claiming server-render equivalence.
7. Run implementation audit and revise only if evidence finds a real defect.

### Verification Matrix

For each fixture at widths `24, 40, 58, 80, 120`:

- render through the production Markdown boundary, not only `renderMarkdown` in
  isolation;
- flatten only known renderer-owned text/row hosts;
- split intentional hard line breaks;
- measure rows with `string-width`;
- assert no row exceeds the owner width;
- assert first/last visual rows are non-blank;
- assert ordinary adjacent paragraphs have at most one blank separator row;
- assert no repeated source blank run creates repeated visual rows.

The oracle must include exact row-shape expectations for these minimal fixtures:

| Fixture | Required normalized visual shape |
| --- | --- |
| `single-paragraph` | one continuous sequence of wrapped prose rows; zero blank separator rows inside the paragraph |
| `two-paragraphs` | prose rows, exactly one blank separator row, prose rows; never two consecutive blank rows |
| `heading-paragraph` | one heading row, exactly one separator row, prose rows |
| `reasoning-transition` | reasoning component rows as owned by the thinking block, then at most one separator row, then continuous prose; no reasoning removal and no duplicate separator from the Markdown adapter |
| `streaming-prefix` | stable prefix row sequence and separator count unchanged across updates; pending content may grow only in its owned region |

The production integration fixture must pass the actual width ledger through
`MessageWithAgents → MessageBlock → BlocksRenderer → SingleBlock`, including
root prefix width, message gutter, scrollbox padding, and nested agent indent.
It must assert the final renderer-owned content width at each representative
terminal width and verify that no child receives a width larger than its owner or
is reduced twice by a leaf magic constant.

Named fixtures:

- **prose-flow:** one long paragraph with inline bold, emphasis, link, and
  inline code; proves one flowing host and width wrapping.
- **paragraph-boundary:** three paragraphs with repeated source blank lines;
  proves compact, single-owner separation.
- **structured-markdown:** headings, lists, wrapped blockquote, divider, and
  nested continuation; proves semantic styling and aligned continuation.
- **wrapped-table:** Unicode/wide-character cells at widths 24/40/80; proves
  synchronized row height, complete text, borders inside budget, and no hidden
  truncation.
- **fenced-code:** language label, internal blank line, long line, and closing
  fence; proves one outer boundary and preserved code structure.
- **reasoning-transition:** reasoning → prose, prose → reasoning, and collapsed
  reasoning; proves thinking remains visible and does not add accidental prose
  gaps.
- **streaming-prefix:** stable completed Markdown blocks followed by an
  incomplete fence across at least three updates; proves stable keys, rendered
  stable-prefix row shape and separator counts, unchanged stable-prefix spacing,
  and controlled pending content. The test must compare rendered stable-prefix
  row shape and separator counts across at least three updates; manifest equality
  alone is insufficient.
- **nested-transcript:** user, assistant, tool, and nested agent content; proves
  width ledger and role hierarchy through the real message path.

Required evidence after implementation:

- focused Markdown and block-helper tests pass;
- stream aggregation and streaming-render tests pass;
- transcript integration fixtures pass for user, assistant, reasoning, tool,
  agent, and nested-agent paths;
- CLI typecheck passes;
- focused ESLint has zero warnings;
- Prettier check passes;
- production call-graph search confirms the adapter is used from
  `Chat → MessageWithAgents → MessageBlock → BlocksRenderer/SingleBlock`;
- tmux/OpenTUI capture passes at one narrow and one normal width;
- independent implementation review reports no critical/high issue.

---

## Perfection Loop

### Loop 1 — RED

- Confirmed the user is not asking for reasoning removal; thinking blocks are
  intentional and must remain.
- Traced ordinary assistant text from stream aggregation through
  `MessageWithAgents → MessageBlock → BlocksRenderer → SingleBlock →
  renderContentWithMarkdown → renderExpandedContent`.
- Confirmed ordinary text deltas append to an existing text block, so the main
  defect is not necessarily token fragmentation in `block-operations.ts`.
- Confirmed `renderMarkdown` emits semantic fragments plus newline strings and
  `renderExpandedContent` maps heterogeneous arrays into a vertical OpenTUI box.
- Confirmed this can turn one prose block into multiple vertical rows and count
  newline content as additional layout height.
- Confirmed the earlier FID-010/FID-002-style newline and width adjustments did
  not change this ownership boundary.
- Confirmed that changing the shared `renderExpandedContent` behavior globally
  would risk tools, agents, plans, copy previews, and custom renderables; the
  fix must therefore be scoped to a dedicated Markdown adapter at the existing
  production call site.
- Catalogued required visual behavior: flowing prose, compact paragraph
  separators, semantic Markdown blocks, measured width through the real message
  path, stable streaming keys plus rendered spacing, preserved reasoning, and
  actual OpenTUI evidence.

### Loop 1 — GREEN

- Selected a dedicated Markdown-only semantic flow adapter at the existing
  `SingleBlock` production boundary, not a global change to
  `renderExpandedContent`, not a parallel renderer, and not a prompt-only
  workaround.
- Chose the existing parser and table implementation; no dependency addition is
  justified by current evidence.
- Defined exact row-shape fixtures for single prose, paragraph boundaries,
  heading-to-prose, reasoning transitions, and streaming stable prefixes.
- Added a production integration requirement that asserts the final width ledger
  through `MessageWithAgents → MessageBlock → BlocksRenderer → SingleBlock`, not
  only isolated renderer output.
- Assigned spacing ownership: Markdown semantic blocks own internal separators;
  generic wrappers use neutral `gap: 0`; the outer message owner may retain one
  message-to-message separator; reasoning/tool/agent components retain their
  own interactive structure.
- Assigned width ownership: transcript/message boundary owns prefixes and
  gutters; nested owners pass named indents; Markdown/code/table renderers use
  the resulting width without unrelated leaf deductions.
- Explicitly rejected two unsafe shortcuts:
  1. delete/strip reasoning blocks;
  2. remove all `.trim()`/`trimNewlines` calls globally. Both would hide the
     symptom or damage semantic boundaries rather than fix row ownership.
- Added a production visual-row verification matrix and tmux evidence gate.

### Loop 1 — AUDIT

Independent audit findings and resolutions:

1. **Finding:** A renderer array must not automatically mean a vertical layout.
   **Resolution:** The dedicated Markdown adapter distinguishes semantic blocks,
   inline spans, true renderer-owned layout nodes, and unknown custom elements
   before choosing an OpenTUI host; the generic shared adapter is not broadened.
2. **Finding:** Stable semantic keys can be lost under a positional wrapper.
   **Resolution:** `markdown-block-*` fragments remain the top-level reconciliation
   boundary, and streaming tests compare manifests across updates.
3. **Finding:** A newline-trimming-only fix can merge blocks or erase intentional
   code/quote/list structure. **Resolution:** edge normalization is limited to
   the document owner; internal structure remains semantic content.
4. **Finding:** Width assertions over React nodes do not prove Yoga output.
   **Resolution:** the implementation gate requires deterministic row/width
   tests through the production message path, an explicit width-ledger fixture
   including root and nested deductions, plus narrow and normal tmux captures.
5. **Finding:** Manifest equality alone does not prove streaming visual stability.
   **Resolution:** the streaming fixture compares rendered stable-prefix row shape
   and separator counts across at least three updates in addition to keys.
6. **Finding:** The supplied OpenTUI guide contains unrelated 3D/WebGPU advice.
   **Resolution:** those packages and runtime changes are explicitly out of
   scope; only applicable 2D layout/table/streaming principles are adopted.
7. **Finding:** The earlier FID-002 archive/body is inconsistent with runtime
   status. **Resolution:** it is not overwritten or falsely treated as fixed;
   this FID is the active implementation boundary and the discrepancy remains
   visible for later lifecycle cleanup.
8. **Finding:** Concrete evidence was available for Zero, but not for every
   named secondary tool. **Resolution:** the FID narrows its authoritative
   comparison claim to the supplied Zero tree and records the other references
   only as searched context unless verified local source is found.

Audit result: no unresolved design-level blocker remains. Runtime code is still
intentionally untouched pending user approval.

### Change Delta

- FID/documentation-only change: new active FID created; no production source
  files modified by this FID.
- Implementation change budget: keep the first code pass localized to the
  Markdown/OpenTUI adapter and focused tests; do not broaden into unrelated UI
  surfaces without presenting a new scope change.

### Missed Questions

1. **Are thinking blocks the problem?** → No. They are required content with
   independent collapse/expand behavior; only accidental prose/layout spacing is
   in scope.
2. **Should the shared `renderExpandedContent` be changed globally?** → No.
   Its callers include tools, agents, plans, copy previews, and custom
   renderables. The fix uses a Markdown-only adapter at `SingleBlock` and leaves
   the generic compatibility path unchanged.
3. **Is the model failing to emit Markdown?** → Not as the primary defect. The
   current renderer parses headings, lists, tables, code, quotes, and inline
   styles; the production adapter is decomposing the result.
4. **What exact visual output proves the fix?** → One paragraph has continuous
   wrapped rows with no internal blank row; two paragraphs have exactly one
   separator row; heading-to-prose has one separator; reasoning-to-prose has at
   most one adapter separator after the reasoning component; the stable streaming
   prefix keeps both row shape and separator count across updates.
5. **Can one more newline replacement solve this?** → No. Text newline rows and
   flex-column child rows must have one explicit ownership contract.
6. **Should all Markdown be flattened into one string?** → No. That would lose
   styles, tables, code renderables, copy behavior, and interactive nodes.
7. **How is the adapter safely scoped?** → It recognizes only the Markdown
   renderer's explicit semantic fragments/layout nodes at the `SingleBlock`
   boundary; unknown/custom elements delegate to the existing generic adapter.
8. **Should every React element become its own row?** → No. Inline styled spans
   must share a flowing text host; only semantic layout blocks get structural
   hosts.
9. **What does full width mean?** → The width available after the transcript's
   documented padding, root prefix, message gutter, and named nested indent;
   it is not the raw terminal width and must not be repeatedly reduced by leaves.
   The integration fixture must assert this ledger through the real production
   call graph at every representative width.
10. **How should repeated blank source lines behave?** → Normalize ordinary
    paragraph separation to one intentional separator; preserve internal code and
    other explicitly structural line content.
11. **How do we preserve streaming identity?** → Keep semantic
    `markdown-block-{index}-{kind}` keys and compare the stable prefix's rendered
    row shape and separator count across token updates, not keys alone.
12. **What is the visual proof?** → Exact row-shape/width tests through the
    production path plus real OpenTUI/tmux output; server-render structure alone
    is insufficient.
13. **Should a new npm renderer be installed?** → No unless focused
    implementation evidence proves an unavoidable parser gap. The existing
    remark/GFM/string-width stack is capable of the required contract.
14. **What is the rollback boundary?** → The Markdown/OpenTUI adapter and its
    tests. Do not alter reasoning storage, model prompts, sidebar state, or
    unrelated controls as part of this FID.
15. **What if tmux is unavailable on Windows?** → Report the failed environment
    gate honestly, retain deterministic evidence, and do not claim live visual
    verification. The implementation must still be tested in an environment
    where an OpenTUI capture is possible before release.

### Code Verification Evidence

- [x] FID metadata uses canonical format and available ID `FID-2026-0801-003`.
- [x] FreeBuff protocol was read from `dev/nova/specs/echo-v0.1.2-freebuff.md`
      start to EOF before this FID was drafted.
- [x] Existing production call graph and affected files were read/verified.
- [x] Existing parser, width, streaming, and test dependencies were inspected.
- [x] Local Zero reference paths and applicable OpenTUI guide principles were
      checked.
- [x] Runtime implementation remains absent, as required before approval.
- [x] AUDIT findings were folded back into the dedicated adapter boundary,
      exact row oracle, production width fixture, streaming visual checks, and
      narrowed reference claim.
- [ ] Implementation tests — pending approval and coding.
- [ ] CLI typecheck/lint/format — pending implementation.
- [ ] OpenTUI/tmux smoke capture — pending implementation/environment.

### Loop 2

Not required for FID convergence. Reserved for evidence-backed findings after
implementation. If implementation audit finds a remaining issue, update this FID
before changing scope or applying a second code pass.

---

## Resolution

- **Fixed By:** Pending user approval and implementation
- **Fixed Date:** Pending
- **Fix Description:** Pending implementation of the converged semantic
  flow-to-OpenTUI adapter
- **Tests Added:** Pending implementation
- **Verified By:** FreeBuff Perfection Loop design audit; runtime verification
  intentionally pending
- **Commit/PR:** Not created
- **Archived:** Not archived; FID remains active until implementation is approved,
  completed, and independently verified

## Lessons Learned

1. Terminal Markdown is a layout system, not merely a parser. Inline flow,
   semantic blocks, width, and visual rows need one explicit contract.
2. A React array is not automatically a visual column. Its children may represent
   inline styled segments, line content, semantic blocks, or interactive hosts.
3. A newline character and a flex-column child can both create vertical space;
   using both without ownership rules creates the exact scattered transcript
   symptom reported here.
4. Preserving reasoning blocks and fixing formatting are compatible requirements;
   they must be modeled as separate block kinds.
5. Zero's strongest transferable idea is measured semantic transcript rows, not a
   wholesale dependency or framework port.
6. Width, spacing, streaming identity, and visual polish must be verified through
   the production message path, not only isolated Markdown snapshots.
