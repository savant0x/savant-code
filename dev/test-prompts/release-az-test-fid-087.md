# Release A-Z Test — FID-087 Universal Copy Buttons

**Version:** v0.0.9
**Purpose:** Regression and feature verification for the universal copy button feature plus a quick sanity check of core CLI behavior before release.

**Ground Rules:**
- Run from agent context (idle phase unless noted)
- Do not require user interaction
- Report pass/fail and any friction for every test
- Write the final report to `dev/scratchpad/release-az-test-fid-087-report.md`

**Available Tools:** read_files, glob, list_directory, spawn_agents, write_todos, basher, code_searcher

---

## Tier 1: Build & Type Safety

### T1.1 — CLI typecheck
- Run `cd cli && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.2 — Changed-file lint
- Run ESLint on the changed files:
  - `cli/src/components/blocks/copy-button.tsx`
  - `cli/src/components/blocks/copyable-block.tsx`
  - `cli/src/components/blocks/single-block.tsx`
  - `cli/src/components/blocks/thinking-block.tsx`
  - `cli/src/components/blocks/tool-branch.tsx`
  - `cli/src/components/blocks/tool-block-group.tsx`
  - `cli/src/components/blocks/agent-branch-wrapper.tsx`
  - `cli/src/components/blocks/implementor-row.tsx`
  - `cli/src/components/blocks/blocks-renderer.tsx`
  - `cli/src/utils/clipboard.ts`
- **Expected:** zero warnings, zero errors

### T1.3 — Copy-button unit tests
- Run `bun test src/__tests__/unit/copy-button.test.ts` from `cli/`
- **Expected:** all tests pass

### T1.4 — Clipboard utility tests
- Run `bun test src/utils/__tests__/clipboard.test.ts` from `cli/`
- **Expected:** all tests pass (note: one pre-existing environment-specific failure may occur when `TERM_PROGRAM=vscode` and SSH env vars are set)

### T1.5 — Hook rules check
- Read `cli/src/components/blocks/implementor-row.tsx`
- Verify `useCallback`/`useState`/`useMemo` are called only at the top level of components, not inside `.map()` callbacks or loops
- **Expected:** no hook calls inside loops or map callbacks

### T1.6 — Import order / unused vars lint
- Run `bun x eslint` on the changed files with `--max-warnings 0`
- Verify no `import/order` warnings and no unused-variable warnings
- **Expected:** zero warnings

---

## Tier 2: Copy Button Components Exist

### T2.1 — CopyButton component
- Read `cli/src/components/blocks/copy-button.tsx`
- Verify it exports a `CopyButton` component
- Verify it uses the existing `Clickable` component
- Verify it uses the restored `copyToClipboard` from `cli/src/utils/clipboard.ts`
- **Expected:** no `navigator.clipboard`, no `theme.accent`, no absolute positioning

### T2.2 — CopyableBlock component
- Read `cli/src/components/blocks/copyable-block.tsx`
- Verify it exports a `CopyableBlock` component
- Verify it uses a flex column with a right-aligned row for the button
- Verify it accepts an `isStreaming` prop that hides the button
- **Expected:** OpenTUI-compatible layout, no absolute positioning

### T2.3 — Clipboard utility
- Read `cli/src/utils/clipboard.ts`
- Verify original exports (`copyTextToClipboard`, `showClipboardMessage`, `subscribeClipboardMessages`, etc.) are still present
- Verify the new `copyToClipboard` wrapper exists and suppresses global messages
- **Expected:** old API preserved, new wrapper added

### T2.4 — No invalid OpenTUI style props
- Search `copy-button.tsx` and `copyable-block.tsx` for `position:`, `absolute`, `cursor:`, and `theme.accent`
- **Expected:** none of these invalid/undefined style props are used

### T2.5 — copyToClipboard failure contract
- Temporarily force all copy methods to fail (e.g., register a renderer that throws and clear platform env)
- Call `copyToClipboard('test')` and verify it returns `false` without throwing
- **Expected:** returns `false`, no unhandled exception

---

## Tier 3: Renderers Wired with CopyableBlock

### T3.1 — SingleBlock
- Read `cli/src/components/blocks/single-block.tsx`
- Verify the text branch wraps non-user text in `CopyableBlock`
- Verify it passes `isStreaming` to `CopyableBlock`
- **Expected:** copy button appears on AI text blocks

### T3.2 — ThinkingBlock
- Read `cli/src/components/blocks/thinking-block.tsx`
- Verify it wraps `<Thinking>` in `CopyableBlock`
- Verify it hides the button while reasoning is incomplete
- **Expected:** copy button appears on reasoning blocks after completion

### T3.3 — ToolBranch
- Read `cli/src/components/blocks/tool-branch.tsx`
- Verify it wraps tool content in `CopyableBlock`
- Verify it passes `isStreaming` to `CopyableBlock`
- **Expected:** copy button appears on tool results blocks

### T3.4 — ToolBlockGroup
- Read `cli/src/components/blocks/tool-block-group.tsx`
- Verify it wraps the group column in `CopyableBlock`
- Verify it builds copy text from each `toolBlock`
- **Expected:** copy button appears on grouped tool blocks

### T3.5 — AgentBranchWrapper
- Read `cli/src/components/blocks/agent-branch-wrapper.tsx`
- Verify it wraps `<AgentBranchItem>` in `CopyableBlock`
- Verify it passes `isStreaming` to `CopyableBlock`
- **Expected:** copy button appears on agent branches

### T3.6 — ImplementorGroup
- Read `cli/src/components/blocks/implementor-row.tsx`
- Verify each implementor column is wrapped in `CopyableBlock`
- Verify the copy text includes implementor name, text, and tool outputs
- **Expected:** copy button appears on implementor columns groups

---

## Tier 4: Functional Checks

### T4.1 — Copy text content
- For each renderer, verify the `getCopyText` callback returns a non-empty string when content exists
- Check that tool/agent/reasoning copy text includes a role prefix (`[Tool: ...]`, `[Agent: ...]`, `[Reasoning]`)
- **Expected:** pasted content is readable and identifies the source

### T4.2 — Streaming discipline
- Verify `CopyableBlock` hides the button when `isStreaming` is true
- Verify each parent passes the correct streaming flag
- **Expected:** no copy button during streaming

### T4.3 — Clipboard truncation
- Verify the new `copyToClipboard` wrapper truncates text over 1MB with a `[truncated, see source]` suffix
- **Expected:** large blocks do not crash the clipboard

---

## Tier 5: Regression Checks

### T5.1 — Existing copy button still works
- Read `cli/src/components/copy-button.tsx`
- Verify the existing inline copy button still exports `CopyButton`, `useCopyToClipboard`, and constants
- **Expected:** no changes to the existing component

### T5.2 — User content copy
- Read `cli/src/components/blocks/user-content-copy.tsx`
- Verify `UserBlockTextWithInlineCopy` is still used for user messages
- **Expected:** user-message copy behavior unchanged

### T5.3 — BlocksRenderer props
- Read `cli/src/components/blocks/blocks-renderer.tsx`
- Verify the previously unused `overrideCopyText` prop was removed
- Verify no other props changed in a breaking way
- **Expected:** cleaner interface

---

## Tier 6: CLI Smoke (if tmux available)

### T6.1 — CLI launches
- If possible, launch the CLI with `bun run src/index.tsx --cwd ..` from `cli/`
- Verify it starts without crashing
- **Expected:** prompt appears

### T6.2 — Copy buttons render
- In the CLI, trigger a short agent response (e.g., "say hello")
- Visually confirm a copy button appears next to the assistant text block
- Click it and verify the clipboard contains the text
- **Expected:** button visible and functional

---

## Tier 7: Documentation

### T7.1 — FID status
- Read `dev/fids/FID-2026-0725-087-universal-copy-buttons.md`
- Verify status is closed/archived and resolution fields are filled
- **Expected:** ground-truth verification section complete

### T7.2 — CHANGELOG entry
- Read `CHANGELOG.md`
- Verify a v0.0.9 entry exists for FID-087
- **Expected:** entry matches the implementation

---

## Report Format

After all tiers, write `dev/scratchpad/release-az-test-fid-087-report.md` with:

1. **Executive Summary** — 3-5 sentences on release readiness
2. **Tier-by-Tier Results** — For each test: Status, Notes, Friction Level (none/low/medium/high)
3. **Blockers** — Any test that must be fixed before release
4. **Pre-existing Issues** — Any failures not caused by this feature
5. **Release Recommendation** — Go / No-Go with justification

---

## Summary

| Tier | Name | Tests | Purpose |
|------|------|-------|---------|
| 1 | Build & Type Safety | 4 | Does the code compile and pass tests? |
| 2 | Copy Button Components Exist | 3 | Are the new components present and correct? |
| 3 | Renderers Wired | 6 | Is the affordance applied everywhere? |
| 4 | Functional Checks | 3 | Does the copy behavior work correctly? |
| 5 | Regression Checks | 3 | Did we break existing copy behavior? |
| 6 | CLI Smoke | 2 | Does the feature render in the real CLI? |
| 7 | Documentation | 2 | Is the FID/CHANGELOG complete? |
| **Total** | | **23** | |
