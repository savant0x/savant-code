# FID: Semantic Markdown Presentation in OpenTUI Chat

**Filename:** `FID-2026-0801-004-semantic-markdown-presentation.md`
**ID:** FID-2026-0801-004
**Severity:** critical
**Status:** closed
**Created:** 2026-08-01 12:45
**Author:** Buffy

---

## Summary

The prior flowing-chat adapter fixed the catastrophic per-fragment whitespace behavior, but the real WSL/tmux capture exposed a second release-blocking presentation gap: Markdown semantic nodes are being reduced to styled text instead of being rendered as semantic terminal UI. H1–H6 have no visible hierarchy, fenced code appears as highlighted text without a code panel, links lose activation behavior, Markdown images are not rendered, and prose that describes `render_ui` widgets is correctly not interpreted as a widget protocol. This FID defines the next implementation boundary: preserve flowing prose and reasoning blocks while routing headings, code, links, and images through dedicated OpenTUI components. Existing OpenTUI, Tree-sitter, TerminalLink, safeOpen, terminal-image, and render_ui primitives are sufficient; no new package is justified before implementation evidence proves a capability gap.

---

## Environment

- **OS:** Windows host with WSL2 Ubuntu available for tmux verification
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **UI stack:** React 19, OpenTUI/OpenTUI React 0.2.2, Yoga layout
- **Markdown stack:** unified, remark-parse, remark-gfm, remark-breaks, string-width
- **Existing primitives:** OpenTUI CodeRenderable, SyntaxStyle/tree-sitter, TerminalLink, safeOpen, terminal image protocols, render_ui tool widgets
- **Primary evidence:** `debug/tmux-sessions/tui-test-1785602713-1614-775/capture-003-semantic-settled.txt`
- **Related FID:** `FID-2026-0801-003-flowing-chat-formatting.md` — prior flow adapter; do not overwrite
- **Commit/State:** Existing working tree contains unrelated pre-existing changes; this FID owns only semantic Markdown presentation

---

## Detailed Description

### Problem

The user-visible formatting demo showed:

1. H1, H2, H3, H4, H5, and H6 as effectively the same visual size/weight.
2. Fenced code as syntax-colored text without a bordered/padded code surface.
3. Markdown links as colored text with no click/open behavior.
4. Markdown images absent from the transcript.
5. `2 — Rich Terminal Widgets (render_ui)` and HTML comments such as `<!-- card -->` as ordinary text. This is expected for the current protocol: actual widgets are produced by the `render_ui` tool, not by comment placeholders. The implementation must not invent an unsafe implicit widget language.
6. Thinking blocks visible in the capture and explicitly required to remain visible/collapsible; reasoning is not the defect.

### Expected Behavior

- H1–H6 have visible hierarchy using terminal-safe layout, spacing, glyphs, attributes, and theme roles; do not claim pixel font-size changes are possible in a character-cell terminal.
- Fenced code renders in a dedicated compact panel with language label, padding, border/background treatment, OpenTUI CodeRenderable syntax highlighting, preserved internal blank lines, and measured width.
- Markdown links retain their destination and render as interactive TerminalLink/button hosts with visible link styling and hover/focus treatment. Unsafe or unsupported schemes fail safely without crashing.
- Markdown images render through the existing terminal-image protocol when the terminal supports it, and otherwise show a useful bounded metadata/fallback card rather than disappearing.
- Actual `render_ui` tool output continues to use the existing widget registry; Markdown comment placeholders remain text unless a separate approved protocol is designed later.
- Existing flowing prose, list/table/quote/divider layout, copy behavior, streaming identity, reasoning blocks, agent/tool state, and width ownership remain intact.

### Root Cause

The Markdown AST renderer currently emits heading/style spans, direct `<code>` nodes, colored link spans, and no `image` node component. The Markdown-only adapter groups these into flow hosts but does not promote semantic nodes to dedicated interactive/layout components:

- `renderHeading` applies the same bold/color treatment to every depth.
- `renderCodeBlock` emits a CodeRenderable without the existing bordered `CodeBlock` wrapper.
- `renderLink` returns a colored `<span>`, discarding the URL and activation callback.
- `renderNode` has no dedicated `image` branch; unknown image nodes fall through to plain-text conversion.
- `ImageBlock` handles attachment `ContentBlock`s, but Markdown image AST nodes never enter that path.
- `RenderUIComponent` is correctly registered for actual `render_ui` tool blocks; comment syntax in model text is not a supported widget transport.

### Evidence

The real WSL/tmux capture at 120 columns rendered:

```text
# Formatting Demo
## Markdown Formatting Demo
### Headings (H1–H6)
// typescript
function greet(name: string): string {
[link text omitted from interaction]
```

The visible result showed the same heading treatment, a code block without a panel, and no image/link interaction. Source inspection confirms:

- `cli/src/utils/markdown-renderer.tsx` — AST render functions for heading/code/link and missing image handling.
- `cli/src/components/blocks/markdown-content.tsx` — semantic block adapter that currently delegates non-inline layout through the generic renderer.
- `cli/src/components/savant-ui/data-display/code-block.tsx` — existing bordered CodeRenderable wrapper to reuse.
- `cli/src/components/terminal-link.tsx` — existing interactive link primitive; inline mode intentionally disables interaction and must not be used for Markdown links.
- `cli/src/utils/terminal-images.ts` and `cli/src/components/blocks/image-block.tsx` — existing protocol detection and attachment fallback behavior.
- `cli/src/components/tools/render-ui.tsx` and its registry — existing actual widget path.

No new package has been shown necessary by this evidence.

---

## Impact Assessment

### Affected Components

- `cli/src/utils/markdown-renderer.tsx`
- `cli/src/components/blocks/markdown-content.tsx`
- `cli/src/components/savant-ui/data-display/code-block.tsx` or a shared extracted code-panel primitive
- `cli/src/components/terminal-link.tsx`
- `cli/src/components/blocks/image-block.tsx` or a Markdown-image wrapper
- focused Markdown renderer/adapter and transcript tests
- WSL/OpenTUI/tmux smoke fixtures

### Risk Level

- [x] Critical: release-blocking user-facing presentation defect
- [ ] High: major feature broken, no workaround
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

1. Keep the existing remark/GFM parser and FID-003 flow adapter.
2. Extend the semantic Markdown render contract with explicit node ownership:
   - headings → dedicated heading host with depth-aware attributes, glyph/spacing, and theme colors;
   - fenced code → reusable bordered/padded CodeBlock panel using existing SyntaxStyle/CodeRenderable;
   - links → interactive TerminalLink-compatible host retaining URL, safe scheme validation, and activation behavior;
   - images → Markdown image host using existing terminal image protocol utilities and bounded fallback metadata;
   - tables/lists/quotes/dividers → preserve their current structured output and spacing ownership;
   - unknown/custom nodes → existing safe generic compatibility path.
3. Keep inline emphasis and inline code in the single flowing text host; only true block/interactive nodes become structural children.
4. Keep reasoning components outside Markdown semantic conversion and verify reasoning → prose transitions.
5. Preserve the width ledger: the message/transcript owner calculates available width; semantic leaves receive it and do not apply unexplained magic deductions.
6. Keep `render_ui` as an explicit tool protocol. Do not parse HTML comments or headings into widgets.
7. Add tests that assert semantic element shape and actual interaction props, not just text presence.

### Explicit Semantic Contracts

- **Headings:** H1 uses a dedicated primary heading row with bold/bright primary color and a stronger surrounding separation; H2 uses the secondary heading treatment; H3–H6 use progressively reduced emphasis/indent markers while remaining distinguishable in attributes or color. The test oracle checks each level's rendered props/row shape; it does not require font-size changes that terminals cannot provide.
- **Code:** Markdown code receives `availableWidth` from the owning adapter. The code panel owns exactly one border/padding budget and passes the inner width to OpenTUI `<code>`. The outer message copy owner remains responsible for copy behavior; the code panel must not add a second copy button. Internal blank lines remain code content, while only the panel's outer separator is normalized.
- **Links:** A paragraph containing a link is segmented into flow text runs and explicit interactive link hosts. A `TerminalLink`/`Button` is never placed directly inside an OpenTUI `<text>` host. Surrounding runs remain compact and the link host retains the parsed destination. Activation is delegated to `safeOpen` after the existing allowed-scheme validation; rejected schemes render as non-activating styled text without throwing.
- **Images:** Markdown image nodes are classified into `data:` payloads, local paths, and remote URLs. Existing base64 terminal protocols are used only for validated data/local content after bounded loading; remote URLs are not fetched from the renderer synchronously. Remote or unsupported images render a bounded fallback card containing alt text and destination, never silently disappear, and never emit unbounded escape sequences. Malformed data follows the same fallback path.
- **Widgets:** Only actual `render_ui` tool blocks enter the existing widget registry. Markdown comments and prose descriptions remain text.

### Non-Goals

- Adding a replacement Markdown package without a demonstrated parser limitation.
- Adding WebGPU, Three.js, or browser rendering to the terminal transcript.
- Treating Markdown comments as executable UI widgets.
- Hiding or deleting reasoning blocks.
- Changing model prompts or response content to compensate for renderer behavior.
- Rewriting the already-fixed paragraph flow adapter globally.
- Guaranteeing inline image pixels in terminals that do not support iTerm2/Kitty/Sixel protocols; fallback behavior is required instead.

### Verification Matrix

At widths `40, 80, 120`, test the semantic adapter and production message path with:

| Fixture | Required result |
| --- | --- |
| `heading-depths` | H1–H6 produce six distinguishable depth treatments: H1/H2 primary/secondary heading roles, H3–H6 distinct reduced-emphasis attributes or markers, with bounded rows |
| `fenced-code` | bordered/padded code host owns one width budget, language label, CodeRenderable/SyntaxStyle, preserved blank lines, and no duplicate copy control |
| `links` | destination retained outside the text host, interactive host/callback present for allowed schemes, non-throwing styled fallback for rejected schemes |
| `images` | data/local/remote cases are separately tested; supported data/local protocol sequence or bounded alt+destination fallback; never silently omitted |
| `render-ui-text` | comment placeholders remain text; actual render_ui tool blocks still use widget registry |
| `reasoning-transition` | reasoning remains visible/collapsible; prose follows without duplicate separator |
| `streaming-semantic` | stable completed block keys and row shape across at least three updates |

Required gates:

- focused Markdown renderer, adapter, link, image, and transcript tests;
- CLI typecheck;
- focused ESLint with zero warnings;
- Prettier check;
- production call-graph search from `MessageWithAgents → MessageBlock → BlocksRenderer → SingleBlock`;
- WSL/tmux capture at normal width and, if feasible, narrow width;
- independent implementation review with no critical/high findings.

### Rollback Boundary

Revert the semantic Markdown renderer/components and their focused tests only. Do not revert FID-003 flow spacing, reasoning storage, tool widget registry, or unrelated sidebar/input changes.

---

## Perfection Loop

### Loop 1 — RED

- Confirmed through a real WSL/tmux capture that the prior whitespace fix works but semantic presentation is incomplete.
- Catalogued heading hierarchy, code panel, link interaction, image rendering, and widget-protocol findings.
- Traced current AST behavior: headings become uniform spans, code becomes direct CodeRenderable, links become non-interactive spans, and images have no renderer branch.
- Found reusable existing primitives for every required capability except the Markdown-to-component wiring.
- Confirmed actual `render_ui` widgets already have an explicit tool path; comment placeholders must not be interpreted.
- Confirmed no package addition is justified by the current parser/OpenTUI capability evidence.
- Confirmed Markdown image URLs are not interchangeable with existing base64 attachment data; the FID now specifies bounded data/local handling and non-fetching remote fallback.
- Confirmed interactive links cannot remain inline spans; the FID now requires explicit host segmentation around links.
- Confirmed the existing CodeBlock wrapper needs an explicit width/copy contract before reuse.
- Confirmed the streaming test must compare rendered stable-prefix row shape and separator counts across at least three updates, including an incomplete fence containing an interactive/media boundary.

### Loop 1 — GREEN

- Selected a semantic-node presentation layer inside the existing Markdown renderer/adapter.
- Reuse existing CodeBlock, SyntaxStyle, TerminalLink, safeOpen, and terminal-image utilities.
- Add depth-aware heading treatment using terminal-safe attributes/spacing rather than pretending to change terminal font size.
- Add explicit image AST handling with validated data/local protocol behavior and a bounded non-fetching remote fallback.
- Segment interactive links out of prose text hosts while preserving compact surrounding flow.
- Reuse or extract the existing CodeBlock panel with an explicit inner-width and copy ownership contract.
- Preserve FID-003 flow ownership and generic renderer compatibility for unknown nodes.
- Define exact tests for visual structure, retained link destinations, image fallback, and actual render_ui separation.

### Loop 1 — AUDIT

Independent audit found three underspecified contracts: Markdown URL/path image transport versus base64 terminal protocols, the required host boundary for interactive links, and code-panel width/copy ownership. SELF-CORRECT folded those findings into the Explicit Semantic Contracts, Verification Matrix, and GREEN plan above. A second audit must specifically check:

1. No new package is being added without a proven gap.
2. Link activation does not place interactive Button/TerminalLink nodes inside an OpenTUI text host illegally.
3. Code panel width and border accounting do not double-subtract message gutters or duplicate copy controls.
4. Image fallback cannot emit unbounded escape sequences, synchronously fetch remote URLs, or crash on malformed data.
5. Heading hierarchy is visible and objectively distinguishable in a character-cell terminal using theme roles.
6. Actual render_ui tool output remains reachable through the existing registry while comment placeholders remain text.
7. Reasoning and streaming behavior remain separate and stable, including an incomplete-fence update containing a link/image boundary.

### Missed Questions

1. **Can terminals change font size for H1–H6?** → No; use depth-aware terminal attributes, spacing, glyphs, and color hierarchy instead.
2. **Should every link be clickable inside a prose `<text>` host?** → No; interactive links need an explicit layout host and cannot be flattened into inline spans.
3. **Why not parse `<!-- card -->` into a widget?** → It is not a typed or safe transport contract; only actual `render_ui` tool payloads are widgets.
4. **Why are images absent when attachment images work?** → Attachment blocks and Markdown AST image nodes use different paths; the AST branch is missing.
5. **Should a new package solve all of this?** → No; existing primitives already cover code, links, images, and widgets.
6. **What happens in tmux or unsupported terminals?** → Images use bounded metadata fallback; captures cannot prove pixel protocols where the terminal does not support them.
7. **How are unsafe links handled?** → Permit safe web/file schemes supported by `safeOpen`; reject unsupported schemes without throwing.
8. **Does code remain selectable/copyable?** → Preserve copy behavior at the owning block and render code as a structural child without duplicating copy controls.
9. **How do nested links/images affect flow?** → They become explicit semantic children with width-bounded hosts; ordinary inline prose remains one flowing text host.
10. **What proves the fix is real?** → AST shape tests plus production-path tests plus WSL/tmux capture; isolated text snapshots alone are insufficient.

### Code Verification Evidence

- [x] FreeBuff ECHO specification read from start to EOF.
- [x] Canonical FID template read.
- [x] FID ID uniqueness checked; `FID-2026-0801-004` unused.
- [x] Real WSL/tmux capture reviewed.
- [x] Existing code/link/image/widget primitives inspected.
- [x] Independent FID audit complete after self-correction; no critical/high findings.
- [x] Implementation tests complete: 29 focused Markdown tests passed across renderer, streaming, and adapter suites.
- [x] CLI typecheck/lint/format complete: CLI typecheck passed; focused ESLint passed with zero warnings; Prettier check passed; `git diff --check` passed.
- [x] WSL/tmux semantic capture complete: startup and settled production captures passed at 120×30; see `capture-001-semantic-startup.txt` and `capture-003-semantic-settled.txt`.

---

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-08-01
- **Fix Description:** Added semantic Markdown renderables and wired them through the existing flow adapter. Headings now use depth-aware terminal rows and markers; fenced code uses bounded bordered/padded OpenTUI code panels with syntax rendering and narrow-width fallback; links retain destinations, safe-scheme validation, activation, and inherited emphasis attributes without entering text hosts; Markdown images support bounded validated data/local PNG rendering and non-fetching remote/unsupported fallback cards with symlink containment; inline links remain compact in prose; reasoning, streaming identities, tables, and render_ui tool boundaries remain preserved. No new package was added.
- **Tests Added:** Updated focused renderer and adapter coverage for heading hierarchy, semantic links/images/code panels, narrow width, stable streaming keys, and flow spacing. `29 passed / 0 failed` across three focused suites.
- **Verified By:** Independent implementation review found no critical/high findings; CLI typecheck passed; focused ESLint passed with zero warnings; Prettier check and `git diff --check` passed; WSL/tmux production capture passed at 120×30. Evidence: `debug/tmux-sessions/tui-test-1785602713-1614-775/capture-001-semantic-startup.txt`, `capture-002-semantic-response.txt`, and `capture-003-semantic-settled.txt`.
- **Commit/PR:** Not created
- **Archived:** 2026-08-01 to `dev/fids/archive/FID-2026-0801-004-semantic-markdown-presentation.md`

## Lessons Learned

1. A flowing Markdown adapter can solve row ownership without solving semantic presentation.
2. Terminal heading hierarchy is a layout/style problem, not a font-size problem.
3. Interactive and media nodes must not be flattened into text hosts.
4. Existing primitives should be wired before adding packages.
5. Actual OpenTUI captures are necessary because React element presence does not guarantee terminal-visible behavior.
