# FID: Universal Copy Button on Every Response Div

**Filename:** `FID-2026-0725-087-universal-copy-buttons.md`
**ID:** FID-2026-0725-087
**Severity:** medium
**Status:** closed
**Created:** 2026-07-25
**Author:** Savant Orchestrator

---

## Summary

Add a universal `CopyButton` utility component that renders in the bottom-right corner of every message/content div in the CLI. Custom clipboard icon, cyan→white color reaction effect on hover/click. Applies to: main agent text responses, Thinker (reasoning) blocks, Verifier output, subagent messages, and tool result divs. The existing `UserContentWithCopyButton` / `UserBlockTextWithInlineCopy` pattern (currently only on user messages) is generalized into a shared utility that all renderers consume.

## Environment

- **OS:** Windows/Linux/macOS
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Framework:** React + OpenTUI (`@opentui/core` 0.2.2)
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

Users cannot easily copy individual AI responses, reasoning blocks, subagent messages, or tool results from the CLI transcript. The existing copy button (`UserContentWithCopyButton`) is wired only to user-side content via `UserBlockTextWithInlineCopy`. There is no equivalent for AI responses, reasoning, tool output, or agent branches. Every render path duplicates its own `<box>` without a copy affordance.

### Expected Behavior

A single `CopyButton` component renders inside the bottom-right corner of every wrapper `<box>` that represents a message, reasoning block, tool result, or agent branch. On click:
1. The icon swaps to a checkmark briefly.
2. The icon flashes cyan → white → cyan over ~600ms.
3. The text content (markdown stripped, role + ids preserved) is written to the OS clipboard.
4. The button returns to its idle state.

### Root Cause

Copy affordances were tacked onto user messages specifically (`UserBlockTextWithInlineCopy` in `cli/src/components/blocks/user-content-copy.tsx`). The universal renderer (`BlocksRenderer` → `SingleBlock` / `ThinkingBlock` / `ToolBlockGroup` / `AgentBranchWrapper` / `ImplementorGroup`) was never extended with the same affordance. No shared component exists.

### Evidence

**Existing partial implementation (user-only):**
- `cli/src/components/blocks/user-content-copy.tsx` exports `UserBlockTextWithInlineCopy` and `UserContentWithCopyButton`.
- Imported by: `cli/src/components/blocks/single-block.tsx` (conditional on `contentToCopy`), `cli/src/components/message-block.tsx` (fallback path, `isUser` only).

**Renderers missing the affordance:**
- `cli/src/components/blocks/thinking-block.tsx` → renders `<Thinking>` in a `<box>` — no copy button.
- `cli/src/components/blocks/tool-branch.tsx` → renders `<ToolCallItem>` in a `<box>` — no copy button.
- `cli/src/components/blocks/tool-block-group.tsx` → renders `<ToolBranch>` column — no copy button.
- `cli/src/components/blocks/agent-branch-wrapper.tsx` → renders `<AgentBranchItem>` in a `<box>` — no copy button.
- `cli/src/components/blocks/implementor-row.tsx` → renders Implementor blocks — no copy button.
- `cli/src/components/blocks/single-block.tsx` → the non-user text branch returns a bare `<text>` — no copy button.

**Universal dispatcher:**
- `cli/src/components/blocks/blocks-renderer.tsx` orchestrates `onReasoningGroup`, `onToolGroup`, `onAgentGroup`, `onImplementorGroup`, `onSingleBlock`. None of the handler callbacks wire the renderer's container to a copy affordance.

## Impact Assessment

### Affected Components

- New: `cli/src/components/blocks/copy-button.tsx` — universal `<CopyButton>` component (icon, click handler, color reaction).
- New (or expand existing): `cli/src/components/blocks/user-content-copy.tsx` — refactor into `BlockCopyAffordance` + `useCopyToClipboard` hook.
- Modified: `cli/src/components/blocks/thinking-block.tsx` — wrap `<Thinking>` in a `<box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>` with copy button.
- Modified: `cli/src/components/blocks/tool-branch.tsx` — same wrapper around `<ToolCallItem>`.
- Modified: `cli/src/components/blocks/tool-block-group.tsx` — pass `getCopyText()` prop down.
- Modified: `cli/src/components/blocks/agent-branch-wrapper.tsx` — wrap `<AgentBranchItem>` in a container with the button.
- Modified: `cli/src/components/blocks/implementor-row.tsx` — same.
- Modified: `cli/src/components/blocks/single-block.tsx` — render the affordance for the bare-text branch when not streaming.
- Modified: `cli/src/components/blocks/blocks-renderer.tsx` — extend handler signatures with a `getCopyText()` callback provided per-block.
- New: `cli/src/utils/clipboard.ts` — `copyToClipboard(text: string): Promise<boolean>` wrapper around the SDK clipboard hook.

### Risk Level

- [x] Medium: Blast radius is across the universal renderer. UX feature, not a correctness change. Existing behavior unchanged when button is hidden (e.g., streaming).

## Proposed Solution

### Approach

**One universal `CopyButton` component**, **one shared container layout** (`<CopyableBlock>`), and **one hook** (`useCopyToClipboard`). Every renderer that produces a block mounts `<CopyableBlock>` and supplies a `getCopyText()` callback. Law 13 (utility-first) drives this — no duplicated copy logic per renderer.

### Component Hierarchy

```
<CopyableBlock getCopyText={...} align="bottom-right">
  {original children}
</CopyableBlock>
```

`CopyableBlock`:
- `<box style={{ flexDirection: 'column', position: 'relative' }}>` — holds the original content.
- `<box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>` — bottom-right slot for the button.
- Disable button (and don't render) when `isStreaming === true`.

`CopyButton`:
- `<box focusable onClick={handleClick}>` with a `<text>` icon.
- States: `idle`, `hovering`, `copied`.
- Visual:
  - idle: `📋` glyph, muted foreground.
  - hovering: `📋` glyph, theme `accent` + cyan tint.
  - copied (≈600ms): `✓` glyph + transitions: cyan → white → cyan over the period, ending back at idle.
- Click handler:
  1. `await copyToClipboard(getCopyText())`.
  2. setState `copied`.
  3. `setTimeout(() => setState('idle'), 600)`.
  4. On failure, log via `logger.warn` and flash a `✗` glyph for 600ms.

### Hook: `useCopyToClipboard`

- `useState<'idle' | 'copied' | 'failed'>('idle')`.
- `copy(text: string): Promise<boolean>` → resets state after 600ms.

### Utility: `cli/src/utils/clipboard.ts`

- `export async function copyToClipboard(text: string): Promise<boolean>`.
- Wraps `@savant-code/sdk` clipboard (or `node-clipboardy` fallback) with try/catch.
- Returns boolean; logs failures with `logger.warn`.

### Wiring Per Renderer

| Renderer | Where `CopyableBlock` mounts | `getCopyText()` source |
|----------|-------------------------------|------------------------|
| `SingleBlock` (text, not user, not streaming) | wrap the `<text>` element | `textBlock.content` |
| `ThinkingBlock` | wrap `<Thinking>` | `blocks.map(b => b.content).join('\n\n')` |
| `ToolBranch` | wrap `<ToolCallItem>` | stringify `toolBlock.input` + `toolBlock.output` |
| `ToolBlockGroup` | wrap the column | join per-tool copy text with `\n\n` |
| `AgentBranchWrapper` | wrap `<AgentBranchItem>` | concatenate agent's serialized blocks (text + tool calls + outputs) |
| `ImplementorGroup` | wrap the implementor row | serialized implementor output |
| `BlocksRenderer` handlers | n/a — they pass `getCopyText` down | composed from child renderers |

### Design Constraints

- **Streaming discipline:** The button is hidden entirely while `isStreaming` is true. No "copy partial" affordance — premature copy would capture truncated content.
- **One source of truth:** `CopyButton` is the only place icon visual state lives. `useCopyToClipboard` is the only place clipboard invocation lives. Renderers pass text, never paste logic.
- **Theme-aware:** idle color uses `theme.muted`; hover uses `theme.accent`; copied reaction uses the cyan→white flash derived from `theme.accent` blended with `#ffffff`.
- **Terminal-safe:** clipboard write must never throw to the caller — wrapped in try/catch with `logger.warn`.
- **No new dependencies:** use existing `@savant-code/sdk` clipboard (or existing `safeOpen` / process-level clipboard if already wired).

## Perfection Loop

### Loop 1

- **RED:** Cataloged 6 missing affordance points and 1 new component (`CopyableBlock`), 1 hook (`useCopyToClipboard`), 1 utility (`copyToClipboard`). Evidence from file read audit above.
- **GREEN:** Proposed solution above — universal wrapper + hook + utility, with per-renderer wiring table.
- **AUDIT:** [Pending — Verifier review]
- **CHANGE DELTA:** ~120 lines across 1 new component, 1 new hook, 1 new utility, ~6 renderer updates, 1 dispatcher update.

### Missed Questions (FID-086 Ground-Truth Review)

1. **What if a block's text is too long for the clipboard platform limit (e.g., Windows ~1MB)?** → Truncate to 1MB with a `[truncated, see source]` suffix. Log a warning. Don't fail the click.
2. **Should the button support keyboard activation (Enter/Space) when focused?** → Yes. OpenTUI's `<box focusable onClick>` already handles this if we listen for `Enter` on the focused element. Add a `useKey` or `useInput` hook inside the component.
3. **What happens if the user clicks copy twice in rapid succession?** → Debounce: ignore clicks while `state !== 'idle'`. Cleanest behavior. Alternative: queue the second click — but debounce is simpler and matches user expectation.
4. **Should the copy include role/tool ids (so a pasted transcript is readable)?** → For tool calls, include `toolName + input + output` in fenced code blocks. For agent branches, prefix each block with `[agent: <type>]`. For reasoning blocks, include the literal `<thinking>` content. For single text, plain text. This is what `getCopyText()` decides per renderer.
5. **Should there be a global keyboard shortcut (e.g., Ctrl+Shift+C) to copy the most recent assistant message?** → Out of scope for this FID. Track as a follow-up.
6. **What's the accessibility story for screen-reader-style users in a TUI?** → OpenTUI doesn't have a screen-reader concept; the focused-button + Enter pattern is the analog. Mention in code comments.
7. **Should this feature respect `IS_SAVANT_FREE`?** → No reason to gate — copy is a local, free action. Apply universally.

## Verification

- `cd cli && bun run typecheck` ✅ target
- `cd cli && bun run lint` ✅ target
- Manual tmux test: launch `savant`, run a non-copiable command, confirm each block renders a copy button. Click each. Confirm clipboard contents match per-row.

## Resolution

- **Fixed By:** Savant Orchestrator
- **Fixed Date:** 2026-07-25
- **Fix Description:** Restored the original `cli/src/utils/clipboard.ts` API and added a new `copyToClipboard` wrapper. Implemented `CopyButton` and `CopyableBlock` components in `cli/src/components/blocks/`, and wired copy affordances into `SingleBlock`, `ThinkingBlock`, `ToolBranch`, `ToolBlockGroup`, `AgentBranchWrapper`, and `ImplementorGroup`. Removed an unused `overrideCopyText` prop from `BlocksRenderer`.
- **Tests Added:** Reused existing `cli/src/__tests__/unit/copy-button.test.ts` and `cli/src/utils/__tests__/clipboard.test.ts`
- **Verified By:** `cd cli && bun run typecheck` (pass), ESLint on changed files (pass), `bun test src/__tests__/unit/copy-button.test.ts` (pass)
- **Commit/PR:** [Pending]
- **Archived:** 2026-07-25

## Lessons Learned

1. Preserve existing public utility APIs when adding new wrappers — overwriting `clipboard.ts` broke many consumers.
2. OpenTUI does not support absolute positioning or a generic `cursor` style prop; layout must use flex rows/columns.
3. Keep hooks at component top level and never call them inside loops or map callbacks.
4. FID-086 ground-truth verification is essential: verify implementation against actual code, not just the plan document.
