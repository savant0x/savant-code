# FID: `set_output` renders header-only (no output content)

**Filename:** `FID-2026-0821-006-set-output-rendering.md`
**ID:** FID-2026-0821-006
**Severity:** medium
**Status:** closed
**Created:** 2026-08-21
**YAGNI-Compliance:** Verified

---

## Summary

In the CLI transcript, every `set_output` tool call renders as a bare
box-drawing header (`┌─ Set Output ─┐`) with no visible output. The subagent's
actual result — which lives in the tool call **input** (the `data` field, or the
top-level fields) — is never shown. The operator directed: "For all 'set output',
it needs to actually show the output, not only the header."

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Relevant components:** `cli/src/components/tools/registry.ts`,
  `cli/src/components/blocks/tool-branch.tsx`,
  `cli/src/utils/constants.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/set-output.ts`
- **Commit/State:** working tree at main, uncommitted (see git status)

## Detailed Description

### Problem

When a subagent finishes and calls `set_output`, the transcript shows only the
collapsed generic tool header — the `┌─ Set Output ─┐` box-drawing "ascii" — plus
an empty/useless preview (a bare `}`). The meaningful payload is hidden.

### Expected Behavior

Every `set_output` block renders its actual output inline, expanded by default,
so the operator can read the subagent's result without clicking to expand a
generic JSON dump.

### Root Cause

`set_output` has **no dedicated renderer**, so it falls into the generic tool
fallback, which collapses by default and shows only the header:

1. **Not registered** — `cli/src/components/tools/registry.ts:39-77`
   (`toolComponentRegistry`) has no `set_output` entry, so
   `renderToolComponent('set_output')` returns `undefined`.
2. **Unregistered → collapsed** — `cli/src/components/blocks/tool-branch.tsx:51-56`:
   `isCollapsed = toolBlock.isCollapsed ?? (hasRegisteredComponent ? shouldCollapseToolByDefault(name) : true)`.
   Unregistered ⇒ `true`.
3. **Also explicitly collapse-by-default** — `cli/src/utils/constants.ts:17-19`:
   `COLLAPSED_BY_DEFAULT_TOOL_NAMES = ['set_output']`.
4. **Useless collapsed preview** — `tool-branch.tsx:63-65` derives the preview
   from the last line of the pretty-printed JSON input
   (`getToolFinishedPreview` → `sanitizePreview(lastLine)` at `tool-branch.tsx:85-99`).
   For a `set_output` payload `{ "data": { "message": "…" } }` the last line is
   `}`, so the preview is literally `}`.
5. **Content lives in input, not output** — the handler
   (`packages/agent-runtime/src/tools/handlers/tool/set-output.ts:44-77`) stores
   the real payload in `agentState.output` and returns
   `{ message: 'Output set' }` (`set-output.ts:100`) as the tool **output**.
   The generic fallback therefore shows the raw JSON *input* plus a useless
   `Result: Output set`, never the meaningful payload.

### Evidence

```text
$ grep -n "set_output" cli/src/components/tools/registry.ts
(no matches — set_output is not in the component registry)

$ grep -n "COLLAPSED_BY_DEFAULT_TOOL_NAMES" cli/src/utils/constants.ts
17: export const COLLAPSED_BY_DEFAULT_TOOL_NAMES: readonly ToolName[] = [
18:   'set_output',
19: ] as const

$ grep -n "shouldCollapseToolByDefault" cli/src -r
cli/src/utils/constants.ts:22: export const shouldCollapseToolByDefault = ...
cli/src/components/blocks/tool-branch.tsx:55: ? shouldCollapseToolByDefault(...)

$ grep -n "message: 'Output set'" packages/agent-runtime/src/tools/handlers/tool/set-output.ts
100:   return { output: jsonToolResult({ message: 'Output set' }) }
```

## Impact Assessment

### Affected Components

- `cli/src/components/tools/registry.ts` (add registration)
- `cli/src/components/tools/set-output.tsx` (new component)
- `cli/src/utils/constants.ts` (remove from collapse-by-default list)
- `cli/src/components/tools/__tests__/set-output.test.tsx` (new test)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (manual expand shows raw JSON)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Register a dedicated `set_output` tool component that extracts the meaningful
payload (mirroring the runtime handler) and renders it as a formatted code
block. Remove `set_output` from the collapse-by-default list so it renders
expanded. This reuses the existing `formatToolOutput` YAML serializer and the
existing `renderContentWithMarkdown`/`renderMarkdownContent` pipeline (Law 13 —
no new serialization or rendering machinery).

Payload extraction mirrors
`packages/agent-runtime/src/tools/handlers/tool/set-output.ts` (no-schema path):
if the input's only key is `data`, unwrap it; otherwise use the whole input
object.

### Steps

1. Create `cli/src/components/tools/set-output.tsx` — `SetOutputComponent`
   (toolName `set_output`) that extracts the payload and returns a
   `ToolRenderConfig` with a YAML code-block `content` and a meaningful
   `collapsedPreview` (the `message` field, else a truncated one-line summary).
2. Register `SetOutputComponent` in `cli/src/components/tools/registry.ts`.
3. Remove `set_output` from `COLLAPSED_BY_DEFAULT_TOOL_NAMES` in
   `cli/src/utils/constants.ts` (empty list ⇒ delete the constant or leave an
   empty array; keep `shouldCollapseToolByDefault` for future tools).
4. Add `cli/src/components/tools/__tests__/set-output.test.tsx` covering:
   wrapped `{ data: { message } }`, unwrapped top-level fields, and empty
   payload → `content: null`.

### Verification

- `bun run --cwd=cli typecheck`
- `bun test cli/src/components/tools/__tests__/set-output.test.tsx`
- `bun x eslint cli/src/components/tools/set-output.tsx cli/src/components/tools/registry.ts cli/src/utils/constants.ts cli/src/components/tools/__tests__/set-output.test.tsx --max-warnings 0`
- Grep: `set_output` present in `registry.ts` (wiring), absent from
  `COLLAPSED_BY_DEFAULT_TOOL_NAMES` (Law 4 call-graph reachability).

## Perfection Loop

### Loop 1 — RED

- **RED (issues cataloged):**
  - `set_output` has no renderer (registry.ts:39-77 absent) → generic fallback.
  - Generic fallback collapses by default (tool-branch.tsx:51-56).
  - Collapse-by-default list contains `set_output` (constants.ts:17-19).
  - Collapsed preview = last line of JSON input = `}` (tool-branch.tsx:63-65, 85-99).
  - Real payload is in `input`, not `output`; handler returns `Output set`
    (set-output.ts:44-77, 100).
- **GREEN (minimal fix):** dedicated `set_output` component extracting the
  payload and rendering it expanded (YAML code block), registered in the
  registry; remove from collapse-by-default list; focused render test.
- **AUDIT (double-audit):**
  - Static: confirmed no existing `set_output` renderer via
    `grep -rn "set_output" cli/src/components/tools/` — only `registry.ts` and
    unrelated agent-prompt matches; no component exists. Reuse of
    `formatToolOutput` (cli/src/utils/savant-code-client.ts) and the markdown
    pipeline (tool-branch.tsx:106-126) verified — no new serialization logic.
  - Call-graph: `renderToolComponent` is the only path from `tool-branch.tsx`
    to the registry (registry.ts referencedBy `renderToolComponent` →
    tool-branch.tsx). `shouldCollapseToolByDefault` is consumed only by
    tool-branch.tsx (constants.ts referencedBy). New wiring is reachable.
  - Handler parity: extraction logic mirrors set-output.ts:44-77
    (`hasOnlyDataField` unwrap). Cited `file:line` above.
- **ADVERSARIAL (independent challenge):**
  - Challenge: "Is a dedicated component over-engineering when a
    `collapsedPreview` on the generic fallback would suffice?" — Refuted: the
    generic fallback renders the wrong data (raw input + `Output set`); only a
    component that reads `input.data`/top-level fields can show the actual
    result, and the operator explicitly wants it expanded by default, which
    only the registry path (not the collapse list) can honor.
  - Challenge: "Could unwrapping `data` diverge from the outputSchema path?"
    — The renderer only mirrors the no-schema unwrap; for schema-validated
    agents the top-level fields are the output, which the `else` branch already
    renders whole. No information is lost; the full input is shown when not
    wrapped. Accepted.
- **CHANGE DELTA:** N/A (initial pass; FID authored fresh).

### Missed Questions

> Surface every question that should have been asked when this FID was created,
> answer it with the most robust default derivable from inspection, and fold the
> answer back into the relevant sections.

1. **Q: Should `set_output` render the `output` field (the tool result) or the
   `input` payload?** A: The `input` payload — the handler stores the real
   result there and returns only `{ message: 'Output set' }` (set-output.ts:100).
   Rendering `output` would show "Output set", which is exactly the bug.
2. **Q: Empty payload (`{}` / `{ data: undefined }`) — render or hide?**
   A: Hide (`content: null`). An empty box adds noise with no information.
   Folded into Step 1 + the test (empty payload case).
3. **Q: Does removing the last entry from `COLLAPSED_BY_DEFAULT_TOOL_NAMES`
   leave dead code?** A: Keep `shouldCollapseToolByDefault` (used by
   tool-branch.tsx:55); the list becomes empty, which is valid. If lint flags
   an unused empty array, retain a comment noting it is intentionally empty.
4. **Q: YAML vs JSON vs raw `message` text for rendering?** A: YAML via
   `formatToolOutput` (already the project's structured-output formatter,
   cli/src/utils/savant-code-client.ts:204-243). `message`-only payloads still
   render readably as `message: …`; the `collapsedPreview` surfaces the bare
   message. No new formatter (Law 13).
5. **Q: Where does the block render — top-level vs nested agent body?**
   A: Both flow through `ToolBranch` (tool-branch.tsx), which consults the
   registry; the fix is path-agnostic.

### Implementation Evidence (REQUIRED for `closed`)

> Filled after implementation. A FID **cannot** be set to `closed` without this
> section filled.

- [x] **Commit SHA:** working-tree closure (uncommitted, per operator flow — no
      commit requested). file:line + grep evidence below.
- [x] **File:line ranges:**
      - `cli/src/components/tools/set-output.tsx` (new) — `SetOutputComponent`.
      - `cli/src/components/tools/registry.ts:18` (import) + `:75` (registration).
      - `cli/src/utils/constants.ts:22` — empty collapse-by-default list.
      - `cli/src/components/tools/__tests__/set-output.test.tsx` (new) — 4 tests.
- [x] **Gate output:** cli typecheck clean; eslint 0 warnings on changed files;
      set-output.test.tsx 4/4 pass (exact output pasted in Loop 2 AUDIT).
- [x] **Reproducibility:** `grep -n "SetOutputComponent" cli/src/components/tools/registry.ts`
      → `18` (import) + `75` (registration); `grep -n "'set_output'" cli/src/utils/constants.ts`
      → no match (removed from collapse list).
- [x] **Step statuses:** steps 1-4 all `implemented`.

### Code Verification Evidence

> Before marking status `fixed`/`closed`, verify the code exists.

- [x] Files referenced in Affected Components exist (`ls` + grep in Loop 2 AUDIT)
- [x] Implementation matches the Proposed Solution (component + registry + collapse-list removal + test)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 2 AUDIT)
- [x] Production call-graph evidence present (registry.ts:18/75 wiring + constants.ts:22 empty list)
- [x] FID status reflects the actual implementation state (`closed`)

### Loop 2 — Independent audit and self-correction (implementation audit)

- **RED (implementation review):** one finding — initial import order in
  `set-output.tsx` violated `import/order` (2 eslint warnings). Corrected with
  `--fix` (order became `./types` → `../../utils/*` → `../blocks/*`).
- **GREEN (correction):** import order fixed; re-verified with `--max-warnings 0`.
- **AUDIT (evidence):**
  ```text
  $ bun run --cwd=cli typecheck
  $ tsc --noEmit -p .
  (exit 0)

  $ bun test cli/src/components/tools/__tests__/set-output.test.tsx
  4 pass, 0 fail, 7 expect() calls

  $ bun x eslint cli/src/components/tools/set-output.tsx \
      cli/src/components/tools/registry.ts cli/src/utils/constants.ts \
      cli/src/components/tools/__tests__/set-output.test.tsx --max-warnings 0
  (exit 0)

  $ grep -n "SetOutputComponent" cli/src/components/tools/registry.ts
  18:import { SetOutputComponent } from './set-output'
  75:  [SetOutputComponent.toolName, SetOutputComponent],

  $ grep -n "'set_output'" cli/src/utils/constants.ts
  (no match)
  ```
- **ADVERSARIAL (residual challenge):** "Does registering `set_output` break the
  two registry-consuming tests?" — `run-terminal-command.test.ts` (imports
  `getToolComponent`) and `apply-patch.test.tsx` (imports `renderToolComponent`)
  still pass; the transitive import of `set-output.tsx` resolves cleanly (cli
  typecheck proves it). Pre-existing, unrelated failures remain in
  `sdk/src/native/ripgrep.ts` (missing `./platform-targets` — in-flight ripgrep
  vendoring, FID-2026-0821-005) and the vendored `resources/freebuff-main/*`
  reference tree; both outside this FID's scope and unmodified by it.
- **CHANGE DELTA:** small (import-order fix only).

## Resolution

- **Closed Date:** 2026-08-21
- **Fix Description:** Registered a dedicated `set_output` renderer that extracts
  the real payload (`data` unwrap mirroring the handler) and renders it expanded
  as a YAML code block; removed `set_output` from the collapse-by-default list.
- **Tests Added:** Yes — `cli/src/components/tools/__tests__/set-output.test.tsx`
  (4 cases: wrapped data, unwrapped fields, empty payload, empty wrapped data).
- **Verification Evidence:** cli typecheck clean; set-output.test.tsx 4/4; eslint
  0 warnings on changed files; grep wiring (registry.ts:18/75, constants.ts:22 empty).
- **Archived:** 2026-08-21

> When status is set to **closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

A tool with no dedicated renderer falls into the generic fallback, which
collapses by default and previews the *input* (not the *result*). For
terminal/result-bearing tools (`set_output`, and by analogy any future
`*_output`-style tool), the meaningful payload must be read from the correct
source (input vs output) — a lesson to check whenever a new tool shows only a
header in the transcript.
