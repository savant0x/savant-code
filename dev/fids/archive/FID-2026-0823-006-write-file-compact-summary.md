# FID: write_file full-document diff wall — compact summary + markdown-aware expansion

**Filename:** `FID-2026-0823-006-write-file-compact-summary.md`
**ID:** FID-2026-0823-006
**Severity:** medium
**Status:** closed
**Created:** 2026-08-23
**YAGNI-Compliance:** Verified

---

## Summary

The Recorder agent (and any whole-file writer) produces a "massive wall of
unorganized text" in the transcript when it updates a document via
`write_file`: the CLI's edit toolchain renders a whole-file replace as a diff
in which **every line is `+`-prefixed**, so a 300-line FID paints as a
full-document green wall of raw markdown source with gutter line numbers — it
reads as unparsed markdown and the `+300 -0` count is misleading (one line
actually changed). Fix: render `write_file` blocks as a compact traffic-light
summary (path + line count) that expands on demand — markdown content
(`.md` targets) renders as formatted markdown when expanded, all other content
renders as a code block. `str_replace` keeps its real per-line diff.

## Environment

- **OS:** win32 (Windows, Git Bash shell)
- **Language/Runtime:** TypeScript strict monorepo, Bun ≥ 1.3.11
- **Tool Versions:** `@opentui/core` 0.5.3, react ^19
- **Commit/State:** working tree, post-FID-2026-0823-005

## Detailed Description

### Problem

A `write_file` tool call whose target already exists (the Recorder's FID-update
workflow: `read_files` → `write_file` with the complete updated document)
renders the **entire document** as a diff where every line is an addition.
Observed symptom: a multi-hundred-line wall of `+`-prefixed markdown source,
green-tinted rows, dual old/new line-number gutters, and a `+312 -0` count —
even when the actual change was a one-line status edit. The content is raw
markdown source, so it "looks like it does not parse markdown".

### Expected Behavior

- A `write_file` block should show a **compact summary** by default: the
  operation (`Write`/`Create`), the path, and the line count — no wall.
- The full content should be available on **explicit expansion**:
  markdown files render as formatted markdown; other files render as a code
  block.
- `str_replace` blocks keep their existing real per-line diff (that is a
  genuine edit, not a snapshot).

### Root Cause

Three interacting decisions in the CLI:

1. `cli/src/utils/implementor-helpers/edit-analysis.ts` (`extractDiff`,
   `constructDiffFromWriteFile`, ~line 250): a `write_file` with string
   `content` is converted into an all-additions "diff" — semantically wrong
   for a whole-file snapshot.
2. `shouldShowEditDiff` (same file) returns **true** for overwrites
   ("Overwrote file successfully." is a successful edit message but not a
   create), so the constructed wall actually renders.
3. `cli/src/utils/constants.ts` line 22: `COLLAPSED_BY_DEFAULT_TOOL_NAMES`
   is empty — no tool, including `write_file`, collapses by default, and the
   custom-component render path has no collapse affordance at all
   (`ToolRenderOptions` carries no collapse state/toggle).

### Evidence

```text
# Reproduced shape (FID-2026-0823-005 format, DiffViewer header)
# Every FID line is emitted as `+ <line>`:

diff --git a/dev/fids/FID-xxx.md b/dev/fids/FID-xxx.md   → header strip "+312 -0"
 + # FID: ...
 + **Status:** analyzed
 + ... 312 lines, all additions, gutter line numbers, green tint ...
```

Code paths (grep-verified):

```text
cli/src/utils/implementor-helpers/edit-analysis.ts
  250:  // Handle write_file: show content as addition
  252:  if (baseToolName === 'write_file' && typeof input.content === 'string') {
  253:    return constructDiffFromWriteFile(input.content)
  260:  return hasSignedDiffLines ? content : constructDiffFromWriteFile(content)
  ~280: function constructDiffFromWriteFile(content) → lines.map(l => `+ ${l}`)

cli/src/utils/implementor-helpers/edit-analysis.ts (shouldShowEditDiff)
  ~225: if (!extractDiff(toolBlock) || isCreateFile(toolBlock)) return false
  # "Overwrote file successfully." passes isSuccessfulEditMessage → not create
  # → full wall renders

cli/src/utils/constants.ts
  22: export const COLLAPSED_BY_DEFAULT_TOOL_NAMES: readonly ToolName[] = [] as const

cli/src/components/tools/write-file.tsx
  # delegates 1:1 to StrReplaceComponent → DiffViewer wall
```

## Impact Assessment

### Affected Components

- `cli/src/components/tools/write-file.tsx` — replaced renderer
- `cli/src/components/tools/types.ts` — `ToolRenderOptions` gains optional collapse fields
- `cli/src/components/blocks/tool-branch.tsx` — passes collapse state/toggle to custom components
- `cli/src/utils/constants.ts` — collapsed-by-default list
- `cli/src/components/tools/str-replace.tsx` — unchanged (verify no regression)
- Tests: new `cli/src/components/tools/__tests__/write-file.test.tsx`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (the copy button still
      captures the full input; expand reveals content)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Make the **whole-file write** the compact case and keep the **edit** case as a
diff:

1. Extend `ToolRenderOptions` with optional `isCollapsed` + `onToggle` so a
   custom tool component can render its own expand/collapse chrome (mirrors
   the `AgentBranchItem`/`ToolCallItem` pattern; optional so no other
   component changes).
2. `ToolBranch` passes the already-computed `isCollapsed` and `handleToggle`
   into `renderToolComponent` options.
3. Rewrite `WriteFileComponent` (`write-file.tsx`) to stop delegating to
   `StrReplaceComponent`:
   - Parse `input.path` + `input.content` directly.
   - Render a `TrafficLightPanel` with a header row
     `▸/▾ Write <path> (<N> lines)` (operation label `Create` when
     `isCreateFile`, else `Write`).
   - Collapsed (default): summary only. Expanded: markdown target
     (`.md`/`.markdown`) renders via the existing
     `renderContentWithMarkdown` + `renderMarkdownContent` pipeline (the
     `add-message`/`set-output` pattern, incl. `TRAFFIC_PANEL_WIDTH_ALLOWANCE`
     width math); any other target renders as a fenced code block.
   - No content → header only, no expand affordance.
4. Add `write_file` + `propose_write_file` to
   `COLLAPSED_BY_DEFAULT_TOOL_NAMES` so the compact summary is the default
   (fully-expanded walls stop being the default for whole-file writes).
5. `str_replace` untouched — real per-line diffs stay.

### Steps

1. `types.ts`: add `isCollapsed?: boolean` + `onToggle?: () => void` to
   `ToolRenderOptions`.
2. `tool-branch.tsx`: hoist `handleToggle`, pass both fields into
   `renderToolComponent` options.
3. `write-file.tsx`: new `WriteFileComponent` per approach §3 (remove
   str-replace delegation; delete now-unused imports).
4. `constants.ts`: append `write_file`, `propose_write_file` to
   `COLLAPSED_BY_DEFAULT_TOOL_NAMES`.
5. New `write-file.test.tsx` + regression check of `str-replace`/`apply-patch`
   suites.
6. Gates: cli typecheck, focused suites, eslint `--max-warnings 0`, prettier.

### Verification

- Unit: static-render assertions that (a) collapsed default shows path + line
  count and **not** the raw content / `+`-prefixed rows; (b) expanded `.md`
  renders markdown (heading text present, no literal `# ` / `+ ` residue);
  (c) expanded non-md renders a code block; (d) `Create` label for creates;
  (e) expand affordance present when `onToggle` supplied.
- Regression: `str_replace`/`apply_patch` suites stay green (their diffs
  unchanged).
- Typecheck exit 0; eslint `--max-warnings 0` on touched files; prettier clean.

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) `write_file` of an existing document renders the entire
  document as an all-additions diff wall (`edit-analysis.ts:250-260`,
  `constructDiffFromWriteFile`); (2) `shouldShowEditDiff` passes for
  overwrites so the wall renders; (3) no tool is collapsed by default and
  custom components have no collapse affordance (`constants.ts:22`,
  `ToolRenderOptions`); (4) `+N -0` count misrepresents whole-file writes.
- **GREEN:** Compact summary default + on-demand expansion with
  markdown-aware content rendering; `str_replace` diffs unchanged; collapse
  wiring added to `ToolRenderOptions`/`ToolBranch`.
- **AUDIT (design):** Claims cross-checked against source —
  `write-file.tsx` currently delegates to `StrReplaceComponent` (verified);
  `extractDiff` write_file branch + `constructDiffFromWriteFile` (verified at
  `edit-analysis.ts:250-260`); `COLLAPSED_BY_DEFAULT_TOOL_NAMES` empty
  (`constants.ts:22`); `ToolBranch` computes `isCollapsed` from
  `shouldCollapseToolByDefault` (verified) — so the extension point is real,
  not speculative. `add-message.tsx`/`set-output.tsx` prove the
  markdown-in-TrafficLightPanel pattern is already production-wired
  (Law 13 — reuse, not new machinery).
- **ADVERSARIAL:** Attack — "expanded `.md` markdown rendering could break
  layout on hostile content (e.g. FID tables/fences)." Answer: the same
  pipeline already renders arbitrary user messages and `add_message` content;
  `renderContentWithMarkdown` is fenced/escaped at the element level (no
  innerHTML). Attack — "collapsing write_file by default hides work from
  implementor users." Answer: the compact header still names the file + line
  count, the copy button still captures full input, and expansion is one
  click — a strict improvement over an unreadable wall.
- **CHANGE DELTA:** n/a (new FID, first loop).

### Missed Questions

1. **Should the summary count be `+N -0` (edit-chrome style) or plain
   `N lines`?** → Plain `N lines`. `+N -0` claims N additions for a snapshot;
   a whole-file write isn't an edit, so the unified `+N -N` edit counter is
   the wrong language. The header keeps the edit chrome's visual family
   (bullet + bold op + muted path) so the transcript stays coherent.
2. **Should `propose_write_file` get the same treatment?** → Yes. It routes
   through `WriteFileComponent` today and proposes the same full-file
   snapshots; the wall is equally bad and the fix is free (registry unchanged).
3. **What about `str_replace` whole-file replacement inputs?** → Unchanged.
   `str_replace` constructs a real old/new line diff from replacements; that
   is a genuine edit and stays as-is.
4. **Does anything else render `write_file` blocks?** → `registry.ts` maps
   `write_file` + `propose_write_file` to `WriteFileComponent` only; the
   generic `ToolCallItem` fallback is unreachable for these tool names.
5. **Streaming behavior?** → Content is read from `input`, available
   immediately; no need to wait for the tool result (unlike
   `shouldShowEditDiff`'s guard, whose purpose was avoiding a flash of an
   input-derived diff — the new renderer has no such flash concern).

## Resolution

- **Closed Date:** 2026-08-23
- **Fix Description:** See Implementation Evidence below.
- **Tests Added:** Yes — `write-file.test.tsx` (summary/markdown/code-block/
  create-label/expand-affordance cases).
- **Verification Evidence:** See Implementation Evidence below.
- **Archived:** 2026-08-23 (when moved to `dev/fids/archive/`)

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working-tree closure (release-only-commits convention);
      implementation present in the working tree at close.
- [x] **File:line ranges:**
      `cli/src/components/tools/types.ts:18-32` (`ToolRenderOptions`
      `isCollapsed`/`onToggle`);
      `cli/src/components/blocks/tool-branch.tsx:44-73` (registry-membership
      collapse resolution + options pass-through);
      `cli/src/components/tools/write-file.tsx:38-139` (new renderer, whole
      file — 139 lines, under the 300 ceiling);
      `cli/src/utils/constants.ts:26-32` (`write_file` +
      `propose_write_file` in `COLLAPSED_BY_DEFAULT_TOOL_NAMES`);
      `cli/src/components/tools/__tests__/write-file.test.tsx` (new, 154
      lines).
- [x] **Gate output:**
      ```text
      cli typecheck (scoped, structured-card WIP excluded): TSC_EXIT=0
      focused suites (10 files incl. write-file/apply-patch/diff-viewer/
        add-message/set-output/read-files/tool-call-item/agent-branch-item/
        implementor-helpers): 135 pass / 0 fail (296 expects)
      write-file.test.tsx: 7 pass / 0 fail
      eslint --max-warnings 0 on 5 touched files: clean (exit 0)
      prettier --check on 5 touched files: clean
      ```
      Pre-existing blocker (NOT introduced here): untracked WIP
      `cli/src/components/tools/structured-card/classify.ts`
      (FID-2026-0822-014, unreferenced anywhere) fails full-project tsc with
      3 intrinsic type errors; recorded as `[OPEN-OUT-OF-SCOPE]` in SCOPE.md.
- [x] **Reproducibility:** `grep -rn "StrReplaceComponent"
      cli/src/components/tools/write-file.tsx` → 0 matches (delegation gone);
      `grep -rn "constructDiffFromWriteFile" cli/src/utils` still finds the
      (now unused-for-write_file) fallback; `WriteFileComponent` is the
      registered renderer for `write_file` (registry.ts unchanged).
- [x] **Step statuses:** all steps `implemented` — see Step Status.

### Step Status

- [x] Step 1 (types.ts) — `implemented` (`ToolRenderOptions` gains optional
      `isCollapsed`/`onToggle`, types.ts:18-32)
- [x] Step 2 (tool-branch.tsx) — `implemented` (collapse resolved from
      registry membership, options passed to custom components,
      tool-branch.tsx:44-73)
- [x] Step 3 (write-file.tsx) — `implemented` (compact summary + markdown/
      code-block expansion, write-file.tsx:38-139)
- [x] Step 4 (constants.ts) — `implemented` (`write_file` +
      `propose_write_file` collapsed by default, constants.ts:26-32)
- [x] Step 5 (tests) — `implemented` (write-file.test.tsx, 7 cases)
- [x] Step 6 (gates) — `implemented` (see Gate output above)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (see Gate output;
      full-project tsc blocked by the pre-existing structured-card WIP
      landmine recorded in SCOPE.md)
- [x] Production call-graph evidence present (`ToolBranch` passes the new
      options at tool-branch.tsx:65-70; `WriteFileComponent` consumed via
      `renderToolComponent` in tool-branch.tsx:56; registry maps
      `write_file`/`propose_write_file` → `WriteFileComponent`)
- [x] FID status reflects the actual implementation state (`converged`,
      working-tree closed; archive step pending operator-chronology)

## Lessons Learned

A whole-file replace and an edit are different operations and should not share
a visualization. The edit-tool renderers were written for `str_replace`-style
changes and later reused for `write_file` without revisiting whether an
all-additions "diff" is meaningful. When a renderer is shared, re-audit the
semantics at the shared boundary — the `+N -N` count is only truthful when the
diff represents a change, not a snapshot.
