# FID: Zero-Style Chat Rendering and Layout Contract

**Filename:** `FID-2026-0801-002-zero-style-chat-rendering.md`
**ID:** FID-2026-0801-002
**Severity:** critical
**Status:** closed
**Created:** 2026-08-01 10:45
**Author:** Buffy

---

## Summary

The Savant CLI transcript still has release-blocking presentation defects even
after the narrower `FID-2026-0731-010-cli-display-quality` change: assistant
responses can render with excessive vertical whitespace, prose does not reliably
use the available transcript width, and Markdown blocks such as headings,
tables, dividers, blockquotes, lists, and fenced code do not consistently appear
as intentional terminal-native structures. The defect is architectural rather
than a missing prompt instruction or one remaining `\\n\\n`: the current renderer
emits literal newline strings from an AST visitor and then recursively wraps the
result in vertical OpenTUI boxes, while outer message containers independently
add gaps, padding, and width insets. This FID adopts the local
`resources/zero` TUI as the primary visual reference and establishes one
measured block-rendering contract before any runtime implementation is written.

---

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **UI stack:** React 19, OpenTUI/OpenTUI React 0.2.2, Yoga layout
- **Markdown stack:** `unified`, `remark-parse`, `remark-gfm`, `remark-breaks`, `string-width`
- **Reference implementation:** Local `resources/zero`, Go, Bubble Tea v2, Lip Gloss v2
- **Commit/State:** Existing working tree contains unrelated pre-existing changes; this FID adds no runtime changes

---

## Detailed Description

### Problem

The user-facing chat visual is not release-ready:

1. Assistant answers appear narrower than the available transcript region.
2. Large, unexplained vertical gaps appear around otherwise ordinary response content.
3. Markdown is parsed, but the visual result is inconsistent:
   - headings are primarily color/bold changes rather than a stable block treatment;
   - tables are manually assembled but are subject to the surrounding mixed layout contract;
   - dividers, blockquotes, lists, and code blocks do not share a predictable spacing model;
   - streaming and completed output can follow different rendering paths.
4. Previous fixes were local and did not establish a measurable visual contract.
5. Existing tests mostly assert that content or React nodes exist. They do not
   assert final visual row counts, maximum rendered width, block separation, or
   parity between streaming and completed output.

### Expected Behavior

The CLI should present assistant responses in the same dense, full-width,
terminal-native style as the local Zero reference:

- The content column uses the actual width available inside the transcript after
  only intentional prefix/gutter/padding deductions.
- Normal prose wraps to that width (with a documented readability cap only if
  deliberately chosen), and no emitted visual line exceeds the content budget.
- Leading/trailing blank lines are removed.
- Ordinary adjacent paragraphs have one intentional visual separator at most;
  one source blank line must not become multiple layout rows.
- Headings are visually distinct, occupy a predictable block, and do not retain
  raw Markdown control characters.
- Tables use measured terminal column widths, wrap cell content without
  truncation, preserve alignment where possible, and never overflow the width.
- Fenced code blocks preserve code lines, language treatment, and intentional
  internal blank lines without creating accidental outer whitespace.
- Lists and blockquotes are compact, readable, and consistently indented.
- Streaming output does not repeatedly reflow completed blocks or introduce
  visible line multiplication as tokens arrive.
- The same content rendered completed or through the stable streaming path has
  equivalent block spacing and width behavior.

### Visual Enhancement Contract

The supplied OpenTUI guide is also a visual-design reference, not only a
layout-correctness reference. The implementation must make the transcript feel
like a deliberate terminal-native interface rather than raw Markdown printed
inside a generic box.

#### Hierarchy and composition

- Assistant prose is the primary visual layer: high-contrast, dense, and allowed
  to use the complete measured content width.
- User messages, assistant messages, nested agents, tools, reasoning, errors, and
  metadata have distinct but restrained visual roles. Prefixes and indentation
  must communicate ownership without consuming an arbitrary large portion of the
  response width.
- Ordinary prose remains visually lighter than interactive cards or code blocks.
  Do not put a border around every paragraph or introduce a decorative panel that
  recreates the current whitespace problem.
- Nested agent/tool content uses a consistent depth treatment: a named indent,
  compact spacing, and a visible collapsed/expanded state rather than ad hoc
  padding at every leaf.

#### Semantic Markdown styling

- Headings use a clear size/depth hierarchy through the existing terminal
  attributes and palette, remove raw `#` control syntax, and have one predictable
  separation from surrounding blocks.
- Horizontal rules are full-width within the owning content budget, visually
  quiet, and never cause accidental blank-line multiplication.
- Blockquotes use a stable accent rail/prefix and readable muted text; wrapped
  continuation lines retain the quote identity.
- Lists keep markers aligned, preserve ordered/checklist semantics, and wrap
  continuation lines under the item text rather than under the viewport edge.
- Inline code is visibly distinct without making ordinary prose noisy.
- Fenced code is a contained, readable block with a subtle header/language
  treatment, syntax colors from the existing theme when available, preserved
  internal lines, and no clipped content. Its border/background must not reduce
  the usable width twice.
- Tables are treated as structured visual components using the selected existing
  row-major renderer: aligned headers, readable separators, wrapped cells,
  synchronized row heights, and no silent cell truncation. The renderer must
  remain compatible with inline styles, copy behavior, and streaming; native
  `TextTableRenderable` is deferred from this implementation pass.

#### Color, borders, and affordances

- All visual roles resolve through the existing `MarkdownPalette`/chat theme;
  hard-coded decorative colors are not acceptable when a semantic theme role
  exists.
- Borders and backgrounds are used as hierarchy cues for code, tables, focused
  controls, and errors—not as blanket decoration. Contrast must remain readable
  in the current Neon Slate themes and in narrow terminals.
- Copy buttons, collapse/expand controls, feedback/error affordances, and focused
  rows retain clear idle/hover/focused/active states without changing document
  height unpredictably while content streams.
- Scrollable content has a visible, predictable focus/selection treatment and
  must use OpenTUI's `scrollChildIntoView` where the pinned 0.2.2 API can safely
  replace manual scroll arithmetic.

#### Responsive visual behavior

- At narrow widths, visual treatments degrade gracefully: borders remain inside
  the width budget, tables wrap or switch to a compact row presentation, and
  controls do not force horizontal overflow.
- At normal and wide widths, prose fills the intended transcript region while
  code/tables can use the full measured width. Any prose readability cap is an
  explicit design choice, not an accidental max-width.
- Visual polish must not reintroduce layout thrashing: stable component identity,
  stable keys, and measured containers are required during token streaming.

The 3D/WebGPU portions of the guide (`@opentui/three`, `bun-webgpu`,
`ThreeRenderable`, supersampling, and 60-FPS graphics loops) are explicitly out
of scope for this FID. They do not improve the 2D chat transcript and would add
Bun/runtime, GPU, and packaging risk unrelated to the release-blocking defect.

### Root Cause

The following root causes are supported by source inspection. The exact amount of row multiplication must be confirmed with a real OpenTUI/tmux baseline during implementation; until then, the newline/flex interaction below is a strong, testable root-cause hypothesis rather than a claimed runtime measurement.

#### 1. Two competing vertical layout systems

`cli/src/utils/markdown-renderer.tsx` returns React nodes containing literal
newline strings. Examples include:

- paragraph rendering appending `\\n\\n` at the root;
- headings returning `\\n\\n`;
- lists appending a trailing blank line;
- code blocks and blockquotes appending trailing newline nodes;
- tables and thematic breaks appending trailing newlines.

The result is then normalized by `renderExpandedContent` in
`cli/src/components/blocks/block-helpers.tsx`. Arrays and rich nodes are wrapped
in `<box style={{ flexDirection: 'column', gap: 0 }}>`, so OpenTUI layout rows
and embedded newline rows both participate in vertical sizing. This is the
central structural risk: spacing is expressed simultaneously as text content
and as component layout.

#### 2. Independent outer spacing multiplies the effect

The transcript path adds additional layout rules around the same content:

- `cli/src/components/message-with-agents.tsx` adds a message-level
  `paddingBottom` for non-final messages and a one-column `SIDE_GUTTER` on each
  side of the content box;
- `cli/src/components/message-block.tsx` wraps block output in nested column
  boxes with `gap: 1`;
- `cli/src/chat.tsx` renders messages in a scrollbox whose content options add
  left/right padding;
- copy wrappers and nested agent/tool containers add further boxes and width
  insets.

These may each be valid in isolation, but there is no single owner for vertical
block separation or a single authoritative width budget.

#### 3. Width is budgeted repeatedly and inconsistently

The same response width is reduced at multiple levels:

- `SingleBlock` derives `codeBlockWidth` as `availableWidth - 8`;
- `ToolBranch` uses `availableWidth - 12`;
- `AgentBranchWrapper` subtracts `AGENT_CONTENT_HORIZONTAL_PADDING` and nested
  indentation;
- `MessageWithAgents` applies prefixes, side gutters, and a full-width content
  box while passing the original `availableWidth` down.

The code comments themselves identify transcript clipping and multiple padding
insets. The result is that Markdown width calculations do not necessarily equal
the width OpenTUI actually gives the rendered node.

#### 4. Markdown semantic blocks are flattened too early

The AST visitor has good GFM coverage, but many block nodes are converted to a
single heterogeneous `ReactNode[]` stream. `renderExpandedContent` must then
infer whether a node is primitive text, an inline span, a code layout node, or a
nested array. That safety normalization prevents host crashes, but it also
prevents a stable document-level block model from owning margins, width, and
row measurement.

#### 5. Existing verification does not test the actual visual contract

`cli/src/utils/__tests__/markdown-renderer.test.tsx` verifies AST-to-node
content, styles, table characters, and some wrapping behavior. The component
suite verifies that rendered markup contains text. These tests do not enforce:

- no leading/trailing blank visual rows;
- no accidental multiple blank rows between ordinary blocks;
- maximum display width after all prefixes and wrappers;
- stable row counts across streaming/completed rendering;
- width behavior at narrow, normal, and wide terminals;
- full-width response ownership through the real MessageWithAgents path.

### Evidence

#### Current Savant source evidence

- `cli/src/utils/markdown-renderer.tsx`
  - `renderNode` adds newline strings to paragraph, heading, list, blockquote,
    code, table, and thematic-break output.
  - `normalizeOutput` trims only trailing whitespace React nodes; it does not
    establish a block spacing/width contract.
  - `renderStreamingMarkdown` renders a completed prefix separately from a
    pending code-fence suffix.
  - `renderTable` performs its own width calculation using `codeBlockWidth`,
    independent of the final OpenTUI container width.
- `cli/src/components/blocks/block-helpers.tsx`
  - `renderExpandedContent` turns arrays and non-inline elements into nested
    vertical boxes.
- `cli/src/components/blocks/single-block.tsx`
  - code width is derived as `Math.max(10, availableWidth - 8)`.
- `cli/src/components/blocks/tool-branch.tsx`
  - tool Markdown width is derived as `Math.max(10, availableWidth - 12)`.
- `cli/src/components/message-with-agents.tsx`
  - message content uses a side gutter and passes `availableWidth` through several
    nested renderers.
  - the user/AI prefix hosts currently declare `width: 1` while rendering two
    display columns; the implementation standardizes both to `width: 2`.
  - non-final messages retain exactly one `paddingBottom: 1` as the explicit
    message-to-message separator; no Markdown block spacing is added there.
- `cli/src/components/message-block.tsx`
  - the outer content wrapper and `blocks` wrapper currently use `gap: 1`; both
    become `gap: 0` for Markdown content so the Markdown renderer alone owns
    block separators. Attachment/error/popover spacing remains independent.
- `cli/src/components/blocks/block-helpers.tsx`
  - array/unknown normalization already uses `gap: 0`; it must remain a neutral
    host and must not add Markdown margins.
- `cli/src/chat.tsx`
  - the main transcript remains a scrollbox with content padding on both sides;
    only its documented padding enters the shared width ledger.

#### Supplied OpenTUI guide validation

The guide's visual recommendations were checked against the repository's pinned
OpenTUI 0.2.2 installation:

- `TextTableRenderable`, `scrollChildIntoView`, and sticky-scroll APIs are
  present locally and may be evaluated as native implementation options.
- The guide's row-major table lesson remains applicable even when the native
  table is not selected: cells must wrap, rows must synchronize to the tallest
  cell, and no `height: 1`/`overflow: hidden` combination may silently discard
  content.
- Stable React/OpenTUI node identity is a visual requirement during streaming;
  detached text/code nodes can leave the terminal visually stale even when state
  contains newer content.
- `OPENTUI_FORCE_EXPLICIT_WIDTH` was not found in the installed 0.2.2 package
  source/declarations, so it is not an assumed production fix. Terminal-width
  compatibility must be established through actual tmux smoke captures and the
  repository's existing width utilities instead.
- The guide's sample imports and 3D/WebGPU runtime assumptions are not adopted;
  this FID uses the existing React/OpenTUI stack and does not add
  `@opentui/three`, `bun-webgpu`, or another visualization package.

#### Previous attempted fix and lifecycle discrepancy

`dev/fids/FID-2026-0731-010-cli-display-quality.md` declares `Status: closed` but
is currently located in active `dev/fids/`, not `dev/fids/archive/`. That is a
separate FID lifecycle inconsistency and is recorded here for visibility; this
FID does not silently change or archive that unrelated record.

The prior display FID changed only two trailing newline sites and added
response-formatting prompt guidance. It did not change the mixed text-newline/flex
layout architecture, width budget, block model, or visual-row tests. The current
user report demonstrates that this change did not resolve the release-blocking
defect and must not be treated as proof that the display contract is correct.

#### Primary local visual reference: Zero

The user supplied `resources/zero` as the exact visual reference. Its relevant
implementation is:

- `resources/zero/internal/tui/assistant_markdown.go`
  - normalizes CRLF/CR and trims outer newlines;
  - classifies fences, tables, horizontal rules, headings, lists, blockquotes,
    paragraphs, and prose as separate blocks;
  - wraps prose with `wrapMarkdownInline` against an explicit measure;
  - calculates table widths against the table measure and wraps cells;
  - trims display blank edges with `trimMarkdownDisplayBlankEdges`;
  - renders streaming from a stable prefix and uses a render cache.
- `resources/zero/internal/tui/rendering.go`
  - separates `assistantMeasure` from `tableMeasure`;
  - wraps user and assistant rows to the actual chat width;
  - uses `fitStyledLine`/display-width measurement so rendered rows do not
    overflow;
  - renders Markdown blocks as rows joined by exactly the intended newline
    boundaries rather than nesting independent layout gaps around every node.
- `resources/zero/internal/tui/transcript.go`,
  `transcript_view.go`, and `transcript_viewport.go`
  - model transcript entries as rows, measure the rendered body, and display a
    viewport over visual rows rather than treating raw strings as an unmeasured
    document.
- `resources/zero/internal/tui/wrap_whitespace_test.go`
  - verifies that aligned whitespace is preserved, prose wraps normally, and
    explicit blank lines remain controlled.
- `resources/zero/internal/tui/transcript_view_test.go`
  - verifies detailed transcript output never exceeds terminal width across
    24/40/58/80/120-column terminals;
  - verifies capped live content versus uncapped detailed content;
  - verifies scrolling over measured transcript rows.

#### Secondary public references (context only)

- Zero public repository page: <https://github.com/gi-dellav/zerostack>
- OpenClaude public repository page: <https://github.com/Gitlawb/openclaude>
- Kilo Code public repository page: <https://github.com/Kilo-Org/kilocode>

The public pages establish project context, but no unverified OpenClaude or Kilo
Code renderer claim is used as an implementation dependency in this FID. The
local Zero tree is the sole authoritative visual and behavioral reference because
it is the exact resource supplied by the user and exposes concrete renderer and
test source in this workspace.

---

## Impact Assessment

### Affected Components

- `cli/src/utils/markdown-renderer.tsx`
- `cli/src/components/blocks/block-helpers.tsx`
- `cli/src/components/blocks/content-with-markdown.tsx`
- `cli/src/components/blocks/single-block.tsx`
- `cli/src/components/blocks/tool-branch.tsx`
- `cli/src/components/blocks/agent-branch-wrapper.tsx`
- `cli/src/components/message-block.tsx`
- `cli/src/components/message-with-agents.tsx`
- `cli/src/chat.tsx`
- `cli/src/utils/__tests__/markdown-renderer.test.tsx`
- `cli/src/components/__tests__/block-helpers.test.tsx`
- `cli/src/components/__tests__/message-with-agents.test.tsx`
- New focused renderer/layout tests, subject to the converged implementation

### Risk Level

- [x] Critical: release-blocking user-facing presentation defect
- [ ] High: major feature broken, no workaround
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor cosmetic or edge-case issue

The classification is critical for release readiness, not because the defect
causes data loss or code execution failure.

---

## Proposed Solution

### Approach

Port Zero's **rendering contract**, not its Go/Bubble Tea implementation:

1. Keep the existing `remark-parse` + `remark-gfm` AST parser unless verification
   proves it cannot support the required Markdown semantics. Do not add a new
   npm package as a reflex; the repository already has a capable parser and
   `string-width`.
2. Use the existing row-major `renderTable` implementation as the default table
   renderer. It already measures columns, wraps cells, synchronizes row heights,
   and draws terminal borders; the implementation will correct its width budget
   and spacing without introducing `TextTableRenderable` into the mixed inline
   style/copy/streaming path. `TextTableRenderable` remains a later isolated
   experiment, not a conditional branch in this FID.
3. Introduce one explicit terminal Markdown document/block representation (or an
   equivalent internal renderer boundary) in which each block owns:
   - normalized content;
   - semantic kind;
   - intended vertical separation;
   - measured width budget;
   - rendered OpenTUI node/visual rows.
4. Remove the mixed-layout ambiguity: the semantic Markdown renderer becomes
   the sole owner of Markdown block separation. Generic wrapper boxes must use
   `gap: 0` and must not add margins/gaps around individual Markdown blocks.
   Rendered block boundaries use one normalized separator row; inline newlines
   remain only where they are part of a block's content (soft breaks, code lines,
   explicit source blank lines, or code/table structure).
5. Compute a single content width at the transcript boundary. The current
   upstream width input is concrete: `useTerminalDimensions` sets
   `separatorWidth = max(1, floor(terminalWidth) - 2)`, and `useChatUI` passes that
   value as `messageAvailableWidth`. It is not yet the final Markdown width:
   the transcript scrollbox adds left padding `1` and right padding `2`, while
   `MessageWithAgents` adds `SIDE_GUTTER = 1` on each content-box side. The
   implementation standardizes both root message variants on visible prefixes:
   user `> ` and AI `◆ `, each rendered in a two-column prefix host. The
   implementation must replace the current implicit/branch-dependent accounting
   with one measured ledger:
   `rootContentWidth = max(1, separatorWidth - scrollboxPaddingLeft(1) -
scrollboxPaddingRight(2) - rootMessagePaddingLeft(1) -
rootMessagePaddingRight(1) - prefixWidth)`. The implementation selects
   `prefixWidth = 2` for both visible `> ` and `◆ ` prefixes, matching their
   measured display width and fixing the current `width={1}` mismatch. The same
   `prefixWidth` is used by layout and wrapping; agent children receive a named
   `AGENT_INDENT = AGENT_CONTENT_HORIZONTAL_PADDING` deduction at their owning
   boundary. Each nested renderer receives
   `childContentWidth = max(1, parentContentWidth - documentedStructuralIndent)`;
   every such indent must be named and tested at its owning boundary. No leaf
   renderer may subtract an unrelated magic constant. Prose wraps at
   `min(childContentWidth, 96)` to match Zero's readability cap, while tables and
   fenced code use the full `childContentWidth`; every final visual row must
   still be at or below its owning `childContentWidth`.
6. Adapt Zero's tested behaviors:
   - normalize line endings and trim blank edges;
   - classify blocks before rendering;
   - wrap prose and blockquote/list lines with `string-width`;
   - calculate and wrap tables against the real table width;
   - render headings/dividers/code as semantic terminal blocks;
   - use a stable-prefix streaming path and avoid re-rendering already-stable
     blocks unnecessarily.
7. Apply the visual enhancement contract without inventing a second design
   system: use existing theme roles, restrained borders/backgrounds, semantic
   heading/list/quote/code treatments, aligned table rows, and stable focus/copy/
   collapse affordances.
8. Preserve current interactions: copy buttons, collapsible reasoning/tool/agent
   branches, syntax highlighting, links, and user-message styling. Keep stable
   keys and mounted text/code hosts during streaming.
9. Use the shared width helper at the transcript/message boundary and pass the
   resulting child width into Markdown, code, table, tool, and nested-agent
   renderers. Remove leaf-level `availableWidth - 8`/`-12` deductions; nested
   owners pass a documented structural indent to the helper instead.
10. Use `scrollChildIntoView` only where a focused transcript child is actually
    navigated and the pinned 0.2.2 API is verified; it is not required for the
    static Markdown renderer.
11. Add a deterministic visual-row/width test harness for the renderer and a
    focused transcript integration fixture. Add a tmux CLI smoke fixture at the
    end of implementation to catch OpenTUI/Yoga behavior that server rendering
    cannot prove.

### Dependency Decision

**Default: do not add a new Markdown package.**

The current parser already provides CommonMark/GFM AST support, and Zero's
critical advantage is its explicit block/measurement contract rather than a
particular parser package. A new package may be proposed only if the converged
implementation demonstrates a specific parser/rendering gap that cannot be
addressed safely with the existing AST. Any package addition must include Bun
compatibility, Windows packaging, streaming behavior, license, bundle-size, and
terminal-width verification.

### Steps

1. Reproduce the current defect with fixed Markdown fixtures at widths 24, 40,
   58, 80, 120, and a normal full-screen width. Capture current row/markup and
   tmux output as baseline evidence.
2. Define and test the width ledger from `chat.tsx` through
   `MessageWithAgents`/`MessageBlock` to the Markdown renderer.
3. Implement the normalized block renderer using existing parser and width
   utilities; keep the change behind the current production call graph rather
   than creating a dead parallel renderer.
4. Replace generic array-to-column normalization for Markdown documents with the
   explicit block host contract. Preserve rich OpenTUI nodes for code blocks and
   interactive child components.
5. Rework block spacing, headings, tables, dividers, blockquotes, lists, and
   fences to match the Zero reference density and measured-width behavior.
6. Reconcile streaming and completed rendering, including incomplete fences and
   stable-prefix reuse.
7. Add focused tests for semantic formatting, exact blank-row behavior, width
   invariants, Unicode/wide characters, tables, code, and streaming.
8. Run the CLI typecheck, focused tests, focused ESLint/Prettier, production
   call-graph search, and the interactive tmux smoke test at narrow/normal/wide
   terminal sizes.

### Verification

The implementation is not complete until all of the following are evidenced.
The renderer test oracle must normalize the produced test representation by
stripping ANSI/control sequences, flattening only known OpenTUI text hosts,
splitting intentional line content into visual rows, and measuring each row with
`string-width`. It must not infer visual rows from React element count alone.
For each fixture and width in `[24, 40, 58, 80, 120]`, the test must: (1) build
an explicit width context from `separatorWidth = width - 2` and the ledger above,
(2) render the fixture through the production renderer boundary, (3) flatten
only renderer-owned text/row hosts, (4) split hard newlines, (5) wrap using the
same display-width function, and (6) assert every row is within its context
width and that the first/last rows are non-blank. Paragraph fixtures must also
assert at most one blank separator row between adjacent blocks.

#### Named visual fixture oracle

The implementation must add named fixtures and either deterministic structural
snapshots or ANSI/tmux captures. Exact color escape sequences are not the oracle
because themes and terminals vary; the semantic roles, visible glyphs, borders,
row counts, and width bounds are.

- `prose-hierarchy`: heading levels, paragraphs, inline emphasis, inline code,
  and links. It must show heading depth, semantic palette roles, and compact
  paragraph separation without raw Markdown markers.
- `structured-blocks`: horizontal rule, blockquote with a wrapped continuation,
  unordered/ordered/checklist items, and nested indentation. It must prove that
  rails, markers, continuation alignment, and separators remain readable.
- `wrapped-table`: a header plus multi-line Unicode/wide-character cells at 24,
  40, and 80 columns. It must prove row-major height synchronization, visible
  borders/separators, complete cell text, and no hidden overflow.
- `fenced-code`: language label, syntax-highlighted lines, an internal blank
  line, a long line, and a closing boundary. It must prove contained styling,
  preserved code structure, and one—not multiple—outer spacing boundary.
- `nested-transcript`: user, assistant, tool, and nested-agent blocks with copy
  and collapse affordances. It must prove role hierarchy, named indentation,
  restrained containers, and visible state changes.
- `streaming-fence`: a stable completed prefix followed by an unfinished fence
  across at least three token updates. It must prove stable block boundaries,
  no completed-content flicker/reflow, and a controlled pending region.

The streaming fixture must expose a test-only block manifest or equivalent
renderer-owned identity record containing semantic kind and stable key. The test
compares the stable prefix's keys and kinds across token updates and fails if a
completed block is remounted or receives a different identity solely because a
later token arrived. This verifies stable React/OpenTUI identity without
asserting implementation-private object identity.

Each visual fixture must record the expected semantic palette role, border or
separator treatment, compact-spacing rule, and narrow-width fallback in its
fixture metadata. A tmux capture is required for at least one normal-width and
one narrow-width fixture so the visual oracle includes actual OpenTUI/Yoga output,
not only React structure.

- Focused Markdown renderer tests pass with zero failures.
- Component/transcript integration tests pass for AI, user, tool, agent, and
  streaming messages.
- Every emitted visual line is at or below the calculated child content width for
  widths 24, 40, 58, 80, and 120.
- No fixture has leading/trailing blank visual rows after normalization.
- Ordinary adjacent paragraphs produce no more than one separator row; repeated
  source blank runs collapse to one intentional separator.
- Heading, table, divider, blockquote, list, inline-code, and fenced-code
  fixtures contain their expected semantic terminal treatment and no raw control
  syntax.
- Visual snapshots or structural assertions verify the hierarchy contract:
  assistant/user/agent/tool roles are distinguishable, headings and code have
  stronger treatment than prose, and nested content uses compact named indents.
- Theme assertions verify semantic palette usage for headings, links, quotes,
  dividers, code, borders, and errors; no new decorative hard-coded color is
  introduced where a theme role exists.
- Table fixtures verify aligned headers/separators, wrapped multi-line cells,
  synchronized row heights, and preservation of the complete cell text at narrow
  widths. No cell is truncated by a fixed height or hidden overflow.
- Code fixtures verify readable containment, language treatment, syntax colors
  when available, preserved internal blank lines, and no double width deduction
  from borders/padding.
- Narrow-width fixtures verify graceful degradation: no horizontal overflow,
  clipped border, or unreadable control label at 24/40 columns.
- Streaming and completed fixtures preserve the same stable block boundaries and
  normalized separator-row count for the stable prefix; stable rendered nodes do
  not churn solely because new tokens arrive.
- Focus/collapse/copy fixtures verify visible state changes without unexpected
  document-height jumps for unchanged content.
- `bun test` focused CLI suites pass.
- `bun run --cwd=cli typecheck` passes.
- Focused ESLint passes with zero warnings; Prettier check passes.
- Production call graph confirms the new renderer is called from
  `Chat → scrollbox → MessageWithAgents → MessageBlock → BlocksRenderer/SingleBlock`.
- A tmux smoke capture shows assistant text using the intended full-width,
  compact Zero-style visual without massive whitespace at representative widths.
- Independent implementation review reports no critical/high issue.

---

## Perfection Loop

### Loop 1

- **RED:** Audited the current renderer, transcript layout, prior display FID,
  tests, dependencies, local Zero reference, and the supplied OpenTUI guide.
  Identified competing newline/flex spacing, repeated width deductions,
  flattened Markdown blocks, missing visual-row invariants, and an
  under-specified visual hierarchy/polish contract.
- **GREEN:** Converged on a renderer-contract fix: retain the parser, introduce
  measured semantic blocks, centralize width ownership, remove mixed spacing
  ownership, port Zero's normalization/wrapping/test principles, and add an
  explicit visual design contract for hierarchy, theme roles, restrained
  containers, tables, code, responsive behavior, and interaction states. The
  existing row-major table renderer is selected; `TextTableRenderable` is
  deferred. Markdown owns Markdown separators, `MessageWithAgents` owns one
  message-to-message separator, and a shared width helper owns prefix/gutter/
  nested-indent deductions. Runtime implementation is now authorized.
- **AUDIT:** Independent review found the prior table/spacing/prefix decisions
  underspecified. Those findings were resolved in this GREEN pass. Design
  evidence was rechecked against current source, `resources/zero/internal/tui`,
  the pinned local OpenTUI 0.2.2 package, and the supplied guide. The audit
  rejects the guide's unrelated 3D/WebGPU scope and rejects assuming its
  explicit-width environment variable because it was not present in the installed
  package.
- **CHANGE DELTA:** FID/documentation-only convergence update; runtime remains
  unchanged until the lifecycle archive operation completes.

### Missed Questions

1. **Is this only an LLM formatting-prompt problem?** → No. The current system
   prompt already asks for Markdown, and the renderer has extensive Markdown
   handling. The observed defects remain in the terminal presentation layer.
2. **Can another `\\n\\n` replacement solve it?** → No. Newline trimming is
   necessary but insufficient while newline strings and flex gaps both control
   vertical layout.
3. **Should we immediately install `marked-terminal`, `cli-table3`, or another
   renderer?** → No by default. Existing `remark` AST support and
   `string-width` are sufficient to implement the required contract; adding a
   package before proving a gap increases Bun/Windows and streaming risk.
4. **What does “full width” mean?** → The current upstream width is
   `separatorWidth = floor(terminalWidth) - 2`, but the renderer's root content
   width must account for scrollbox padding `1 + 2`, content gutters `1 + 1`,
   and the standardized two-column root prefix. Both visible root prefixes are
   now selected as `prefixWidth = 2`; the current `width: 1` declarations are
   implementation defects to remove. The ledger must be explicit and tested,
   not inferred through repeated magic deductions.
5. **Should prose use every available column on ultrawide terminals?** → The
   layout must honor the measured context width; prose may cap at `96` columns
   for readability, matching Zero, while tables/code use the full context width.
6. **Which table implementation is the default?** → The existing row-major
   renderer is the default because it already preserves Markdown inline styling,
   copy behavior, and streaming composition. Its width and spacing contract will
   be corrected in place; `TextTableRenderable` is explicitly not part of this
   implementation pass.
7. **Which layer owns spacing?** → The Markdown block renderer owns all Markdown
   separators. Generic wrappers, `MessageBlock`, and transcript message shells
   use `gap: 0` for Markdown content; message-to-message separation remains one
   explicit outer row owned by `MessageWithAgents`.
8. **What are the selected prefix and nested-width values?** → Both visible root
   prefixes use `prefixWidth = 2`; nested agent content uses the named
   `AGENT_CONTENT_HORIZONTAL_PADDING` deduction at its owner. These values are
   tested rather than rediscovered in leaf renderers.
9. **What makes this a visual enhancement rather than only a bug fix?** → The
   implementation must visibly establish hierarchy, semantic color roles,
   restrained borders/backgrounds, compact code/table treatments, aligned lists
   and quotes, responsive narrow-width fallbacks, and stable copy/collapse/focus
   affordances. These are release acceptance criteria, not optional polish.
10. **Should source blank lines always be preserved?** → No. Preserve intentional
    block separation, but normalize repeated blank runs and trim outer blank rows.
    Code blocks and explicit internal line structure are the exception.
11. **How do we verify OpenTUI behavior rather than only React markup?** → Add
    deterministic width/row tests plus a tmux smoke capture. Server-render tests
    remain useful but are not sufficient.
12. **Can nested agent/tool cards use the same renderer?** → Yes, but with an
    explicit indentation/width context. Each nested owner must expose its exact
    structural indent in the width context and test it at that boundary; nested
    cards must not independently subtract arbitrary constants or reintroduce
    generic newline/flex mixing.
13. **What happens during incomplete streaming fences?** → Render the stable
    complete prefix as blocks and keep the unfinished suffix in a controlled
    pending region, matching the existing behavior without reparsing stable
    blocks on every token.
14. **Should the guide's TextTable/scroll APIs be adopted blindly?** → No. The
    native table is explicitly deferred; `scrollChildIntoView` is used only for
    verified focused navigation, while this pass preserves the existing
    row-major renderer and theme/copy/streaming contract.
15. **What is the rollback boundary?** → Keep the change localized to the
    renderer/layout boundary and preserve the old implementation until focused
    tests and tmux captures pass; do not rewrite unrelated sidebar, input, or
    agent-state code.

### Code Verification Evidence

- [x] Files referenced in the affected-components section were inspected and
      exist, except new test files that will be created during implementation.
- [x] Existing parser and width dependencies were verified in `cli/package.json`.
- [x] Current production call graph was confirmed by source inspection and search.
- [x] The local Zero reference renderer and test paths were verified to exist;
      `assistant_markdown.go`, `transcript_viewport.go`,
      `wrap_whitespace_test.go`, and `transcript_view_test.go` were read in full,
      while oversized `rendering.go`/`transcript.go` evidence was inspected in
      targeted source sections and must not be described as a complete read.
- [ ] Runtime implementation exists — pending FID approval.
- [ ] Focused tests pass — pending implementation.
- [ ] CLI typecheck/lint/format pass — pending implementation.
- [ ] Interactive tmux visual smoke passes — pending implementation.

### Loop 2 (if needed)

- **RED:** Reserved for findings from implementation tests or tmux visual audit.
- **GREEN:** Apply only evidence-backed corrections to the converged renderer
  contract.
- **AUDIT:** Re-run focused tests, width/row invariants, typecheck, lint,
  formatting, call-graph search, and independent review.
- **CHANGE DELTA:** Record the measured implementation change.

---

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-08-01
- **Fix Description:** Converged the Zero-style visual renderer contract for
  implementation: selected the existing row-major table renderer, assigned
  Markdown and message shells explicit spacing ownership, standardized visible
  two-column `> `/`◆ ` prefixes, and fixed the width ledger around named nested
  indents.
- **Tests Added:** Pending implementation
- **Verified By:** FID double audit: independent design review plus source/lifecycle
  checks; runtime implementation verification remains pending.
- **Commit/PR:** Not created
- **Archived:** Ready for filesystem move and changelog entry before coding

## Lessons Learned

1. Terminal Markdown is a layout system, not just a parser. The renderer must
   own semantic blocks, width, and visual rows together.
2. A text newline and a flexbox row are both vertical layout operations; using
   both without a contract creates multiplicative whitespace.
3. “Full width” requires a width ledger from the transcript boundary to every
   nested renderer. Magic deductions in leaf components make visual regressions
   difficult to diagnose.
4. Zero's strongest reusable idea is its measured transcript-row contract and
   test suite, not a wholesale Go/Bubble Tea dependency transfer.
5. Visual release gates need terminal smoke evidence in addition to React
   server-render tests and typechecks.
6. Visual quality is a contract: hierarchy, semantic color, restrained borders,
   responsive composition, and interaction states must be tested alongside
   correctness and width.
7. Native OpenTUI primitives should be preferred when their pinned-version API
   is verified, but visual behavior—not API novelty—determines the final choice.
