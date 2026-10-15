# FID: Output-carrying tools render header-only (no result shown)

**Filename:** `FID-2026-0821-007-output-carrying-tools-header-only.md`
**ID:** FID-2026-0821-007
**Severity:** low
**Status:** closed
**Created:** 2026-08-21
**YAGNI-Compliance:** Verified

---

## Summary

Follow-up to FID-2026-0821-006 (which fixed `set_output`). The same
input-vs-output audit swept every remaining header-only tool and found a
second, broader class: a set of **result-bearing tools** whose result lives in
the tool **output** (not input) but which have no renderer, so they fall into
the generic collapsed fallback and show only the box-drawing header plus a bare
`}`. Their actual result is hidden until the operator manually expands each
one.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Relevant components:** `cli/src/components/tools/registry.ts`,
  `cli/src/components/blocks/tool-branch.tsx`,
  `cli/src/utils/message-block-helpers/tool-output.ts`
- **Commit/State:** working tree at main, uncommitted (see git status)

## Detailed Description

### Problem

`deep_research`, `find_files`, `list_tables`, `describe_table`,
`execute_query`, `analyze_query`, `lookup_agent_info`, `query_blast_radius`,
`query_domain_clusters`, `query_node_edges`, `ponytail_debt`,
`run_file_change_hooks`, `get_goal`, and `browser_logs` render as a collapsed
generic `ToolCallItem` — the `┌─ Deep Research ─┐`-style header with no result.

### Expected Behavior

Each of these tools shows its result (the formatted `output`) inline, expanded
by default, with a meaningful one-line preview when collapsed.

### Root Cause

The same fallback mechanism as FID-2026-0821-006, but for the **output** side:

1. **Not registered** — none of the 14 tools has an entry in
   `cli/src/components/tools/registry.ts:39-77` (`toolComponentRegistry`).
2. **Unregistered → collapsed by default** —
   `cli/src/components/blocks/tool-branch.tsx:51-56`: unregistered tools fall
   through to the generic `ToolCallItem` fallback with `isCollapsed = true`.
3. **Useless collapsed preview** — `tool-branch.tsx:63-65,85-99` previews the
   last line of the JSON **input** (a bare `}`), not the result.
4. **Result lives in `output`** — `updateToolBlockWithOutput`
   (`cli/src/utils/message-block-helpers/tool-output.ts:29-41`) already formats
   each tool's result into `toolBlock.output` via `formatToolOutput`. The
   generic fallback DOES show it when expanded; only the collapse-by-default +
   `}` preview hide it.

Note: `end_turn` and `task_completed` were **excluded** by the audit — both
have an empty `z.object({})` input schema and their content is the assistant
text before the call (already rendered). `think_deeply` was also excluded:
it is the input-payload class (like `set_output`) but is not exposed in any
agent's `toolNames`, so it never renders in a live transcript.

### Evidence

```text
$ grep -nE "deep_research|find_files|list_tables|describe_table|execute_query|analyze_query|lookup_agent_info|query_blast_radius|query_domain_clusters|query_node_edges|ponytail_debt|run_file_change_hooks|get_goal|browser_logs" cli/src/components/tools/registry.ts
(no matches — none of the 14 is registered)

$ grep -n "isCollapsed =" cli/src/components/blocks/tool-branch.tsx
52:     const isCollapsed =
53:       toolBlock.isCollapsed ??
54:       (hasRegisteredComponent
55:         ? shouldCollapseToolByDefault(toolBlock.toolName)
56:         : true)

$ grep -n "formatToolOutput" cli/src/utils/message-block-helpers/tool-output.ts
11: import { formatToolOutput } from '../savant-code-client'
32:         output = formatToolOutput(toolOutput.map(safeToJSONValue))
```

## Impact Assessment

### Affected Components

- `cli/src/components/tools/output-result.tsx` (new shared component)
- `cli/src/components/tools/registry.ts` (register the 14 aliases)
- `cli/src/components/tools/__tests__/output-result.test.tsx` (new test)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists (manual expand shows raw JSON)
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Register a **single shared renderer** — `OutputResultComponent` — for all 14
result-bearing tools, mirroring how `run_readonly_command` reuses
`RunTerminalCommandComponent` (Law 13: one renderer, many tools). It renders
`toolBlock.output` (already formatted by `formatToolOutput`) expanded as a YAML
code block, with a `collapsedPreview` = the first meaningful line of the
result. No per-tool input parsing — uniform and minimal.

### Steps

1. Create `cli/src/components/tools/output-result.tsx` — `OutputResultComponent`
   (`toolName: 'deep_research'` as the representative; aliased below). Renders
   the formatted `output` as a code block; `content: null` when `output` is
   empty; `collapsedPreview` from the first non-empty output line.
2. Register it in `cli/src/components/tools/registry.ts` for the 14 tool names:
   `deep_research`, `find_files`, `list_tables`, `describe_table`,
   `execute_query`, `analyze_query`, `lookup_agent_info`, `query_blast_radius`,
   `query_domain_clusters`, `query_node_edges`, `ponytail_debt`,
   `run_file_change_hooks`, `get_goal`, `browser_logs`.
3. Add `cli/src/components/tools/__tests__/output-result.test.tsx`:
   renders the result expanded, empty output → `content: null`, meaningful
   `collapsedPreview`.

### Verification

- `bun run --cwd=cli typecheck`
- `bun test cli/src/components/tools/__tests__/output-result.test.tsx`
- `bun x eslint cli/src/components/tools/output-result.tsx cli/src/components/tools/registry.ts cli/src/components/tools/__tests__/output-result.test.tsx --max-warnings 0`
- Grep: the 14 names present in `registry.ts` (Law 4 reachability).

## Perfection Loop

### Loop 1 — RED

- **RED (issues cataloged):**
  - 14 result-bearing tools unregistered → generic fallback (registry.ts:39-77 absent).
  - Unregistered ⇒ collapsed by default (tool-branch.tsx:52-56).
  - Preview = last line of input JSON = `}` (tool-branch.tsx:63-65, 85-99).
  - Result already formatted into `output` (tool-output.ts:29-41).
- **GREEN (minimal fix):** one shared `OutputResultComponent` rendering the
  formatted `output` expanded; register under 14 aliases (Law 13, mirrors
  `run_readonly_command` → `RunTerminalCommandComponent`); focused test.
- **AUDIT (double-audit):**
  - Static: all 14 confirmed result-in-`output` via their params
    (`jsonToolResultSchema`/`terminalCommandOutputSchema`) —
    `deep-research.ts`, `find-files.ts`, `database.ts`,
    `lookup-agent-info.ts`, `graph.ts`, `ponytail-debt.ts`,
    `run-file-change-hooks.ts`, `get-goal.ts`, `browser-logs.ts`. No
    input-payload tools in the set (`think_deeply` excluded: dead;
    subgoal/goal mutations excluded: state surfaced in sidebar/plan).
  - Call-graph: `renderToolComponent` is the only path from tool-branch.tsx to
    the registry (registry.ts referencedBy). Aliasing pattern proven by the
    existing `run_readonly_command` entry (registry.ts:56).
  - Reuse: `formatToolOutput`/markdown pipeline are the same primitives used by
    the generic fallback and `set-output.tsx` — no new serialization.
- **ADVERSARIAL (independent challenge):**
  - Challenge: "Would a global `isCollapsed = false` default be simpler than a
    component + 14 aliases?" — Refuted: a blanket default would also expand
    internal primitives (`add_message`, `set_messages`, `spawn_agents`) whose
    full input JSON is noise and whose content is already rendered elsewhere;
    the explicit registry list scopes the change to the 14 result tools.
  - Challenge: "Large results (e.g. `execute_query` 1000 rows) expanded by
    default could flood the transcript." — Accepted as intended: the operator
    asked for output visibility; the panel remains user-collapsible and the
    preview bounds the collapsed state.
- **CHANGE DELTA:** N/A (initial pass; FID authored fresh).

### Missed Questions

> Surface every question that should have been asked when this FID was created,
> answer it with the most robust default derivable from inspection, and fold the
> answer back into the relevant sections.

1. **Q: Which tools qualify as "output-carrying"?** A: those whose params
   declare a `jsonToolResultSchema`/`terminalCommandOutputSchema` and whose
   result is the tool `output` — the 14 listed. Tracking mutations
   (`add_subgoal`, `update_subgoal`, `update_goal`, `set_scaffold_complete`)
   are excluded (state is shown in the plan/goal sidebar; their `output` is a
   confirmation, not a result). Folded into Step 2's list.
2. **Q: `end_turn` / `task_completed` — render or keep hidden?** A: keep hidden.
   Empty input; content is the preceding assistant text (already rendered).
   No change.
3. **Q: `think_deeply` — same class as `set_output` (thought in input)?**
   A: Yes structurally, but dead (not in any agent's `toolNames`). Out of scope
   for this FID; recorded so it isn't silently dropped.
4. **Q: YAML code-block lang for results that are plain text (e.g. browser
   logs)?** A: Use `yaml` (the generic fallback's non-terminal default,
   tool-branch.tsx:60-61). Harmless for plain text; uniform across the 14.
5. **Q: Should the input query be shown alongside the result?** A: No — uniform
   renderer reads only `output`; the copy button still captures input+output
   (tool-branch.tsx getCopyText). Keeps the component tool-agnostic.

### Implementation Evidence (REQUIRED for `closed`)

> Filled after implementation.

- [x] **Commit SHA:** working-tree closure (uncommitted, per operator flow — no
      commit requested). file:line + grep evidence below.
- [x] **File:line ranges:**
      - `cli/src/components/tools/output-result.tsx` (new) — `OutputResultComponent`.
      - `cli/src/components/tools/registry.ts:12` (import) + `:80-93` (14 aliases).
      - `cli/src/components/tools/__tests__/output-result.test.tsx` (new) — 4 tests.
- [x] **Gate output:** cli typecheck clean; eslint 0 warnings on changed files;
      output-result.test.tsx 4/4 pass (exact output pasted in Loop 2 AUDIT).
- [x] **Reproducibility:** `grep -nE "OutputResultComponent|<14 names>" cli/src/components/tools/registry.ts`
      → import :12 + aliases :80-93.
- [x] **Step statuses:** steps 1-3 all `implemented`.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (grep in Loop 2 AUDIT)
- [x] Implementation matches the Proposed Solution (shared component + 14 aliases + test)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 2 AUDIT)
- [x] Production call-graph evidence present (registry.ts:80-93 aliases)
- [x] FID status reflects the actual implementation state (`closed`)

### Loop 2 — Independent audit and self-correction (implementation audit)

- **RED (implementation review):** one finding — the initial
  `firstMeaningfulLine` regex was double-escaped (`\\[\\]`), so the collapsed
  preview kept markdown chars. Corrected to a backslash-free `/[#*_`~]/g`.
- **GREEN (correction):** sanitizer fixed; re-verified.
- **AUDIT (evidence):**
  ```text
  $ bun run --cwd=cli typecheck
  $ tsc --noEmit -p .
  (exit 0)

  $ bun test cli/src/components/tools/__tests__/output-result.test.tsx
  4 pass, 0 fail, 8 expect() calls

  $ bun x eslint cli/src/components/tools/output-result.tsx \
      cli/src/components/tools/registry.ts \
      cli/src/components/tools/__tests__/output-result.test.tsx --max-warnings 0
  (exit 0)

  $ grep -nE "OutputResultComponent|<14 names>" cli/src/components/tools/registry.ts
  12:import { OutputResultComponent } from './output-result'
  80:  [OutputResultComponent.toolName, OutputResultComponent], // deep_research
  81:  ['find_files', OutputResultComponent],
  ... (through :93 browser_logs)
  ```
- **ADVERSARIAL (residual challenge):** "Does aliasing one component to 14 tool
  names typecheck?" — Yes: the registry already aliases `run_readonly_command`
  to `RunTerminalCommandComponent` (registry.ts:56); cli typecheck exit 0 proves
  the 14 aliases compile. "Do the two registry-consuming tests still pass?" —
  unaffected (they import `getToolComponent`/`renderToolComponent`, which now
  resolve the new component without side effects). Pre-existing unrelated
  failures (`sdk/src/native/ripgrep.ts` missing `./platform-targets`;
  vendored `resources/freebuff-main/*`) remain outside this FID's scope.
- **CHANGE DELTA:** small (sanitizer regex fix only).

## Resolution

- **Closed Date:** 2026-08-21
- **Fix Description:** Registered a shared `OutputResultComponent` that renders a
  result-bearing tool's formatted `output` expanded (with a one-line collapsed
  preview), aliased to 14 previously-header-only tools.
- **Tests Added:** Yes — `cli/src/components/tools/__tests__/output-result.test.tsx`
  (4 cases: expanded result, sanitized/truncated preview, empty output, whitespace-only).
- **Verification Evidence:** cli typecheck clean; output-result.test.tsx 4/4;
  eslint 0 warnings; grep wiring (registry.ts:12 import, :80-93 aliases).
- **Archived:** 2026-08-21

## Lessons Learned

FID-2026-0821-006 fixed the input-payload class (`set_output`); this FID closes
the sibling output-payload class. The general rule now derivable: a tool with no
renderer collapses behind its header; whether that's a bug depends on where the
meaningful content lives — input (payload class, e.g. `set_output`) or output
(result class, e.g. `deep_research`) — and both should render that content.
