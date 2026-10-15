# FID: `sequentialthinking` renders header-only (thought stream not shown)

**Filename:** `FID-2026-0821-008-sequentialthinking-header-only.md`
**ID:** FID-2026-0821-008
**Severity:** low
**Status:** closed
**Created:** 2026-08-21
**YAGNI-Compliance:** Verified

---

## Summary

Third and final item in the input-vs-output rendering audit (FID-2026-0821-006
`set_output`, FID-2026-0821-007 result tools). The Thinker's
`sequentialthinking` tool has no renderer, so each reasoning step renders
header-only inside the Thinker's agent branch via the generic collapsed
fallback. The actual thought lives in the tool **input** (`thought`), while the
handler returns only metadata counters — the exact input-payload class fixed
for `set_output`. The Thinker prompt promises "the thought stream is visible to
the user"; it currently is not.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Relevant components:** `cli/src/components/tools/registry.ts`,
  `cli/src/components/tools/sequential-thinking.tsx` (new),
  `common/src/tools/params/tool/sequential-thinking.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts`
- **Commit/State:** working tree at main, uncommitted (see git status)

## Detailed Description

### Problem

Each `sequentialthinking` call in a Thinker agent branch shows only the
`┌─ Sequentialthinking ─┐` header (plus a bare `}`). The reasoning text is
hidden until the operator manually expands each one — and even then the generic
fallback shows the raw input JSON, not a readable thought.

### Expected Behavior

Each thought renders inline — the reasoning text visible — with its position
(`Thought N/M`, revision, branch) as a short label and a one-line preview when
collapsed.

### Root Cause

Same input-payload class as FID-2026-0821-006:

1. **Not registered** — no `sequentialthinking` entry in
   `cli/src/components/tools/registry.ts` (`toolComponentRegistry`).
2. **Not hidden** — not in `hiddenToolNames`
   (`cli/src/utils/sdk-event-handlers/guards.ts:15-26`), so
   `handleRegularToolCall` creates a tool block.
3. **Unregistered → collapsed** — `tool-branch.tsx:51-56` collapses the generic
   fallback by default.
4. **Thought lives in input, output is metadata** — the handler
   (`packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts:47`)
   returns `{ message: JSON.stringify(result) }` (counters only); the thought is
   `input.thought` (`common/src/tools/params/tool/sequential-thinking.ts`).

### Evidence

```text
$ grep -n "sequentialthinking" cli/src/components/tools/registry.ts
(no match)

$ grep -n "sequentialthinking" cli/src/utils/sdk-event-handlers/guards.ts
(no match — not in the hidden set)

$ grep -n "thought:" common/src/tools/params/tool/sequential-thinking.ts
30:     thought: z.string().min(1, 'Thought cannot be empty')...

$ grep -n "message: JSON.stringify" packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts
47:   return { output: [{ type: 'json', value: { message: JSON.stringify(result) } }] }
```

## Impact Assessment

### Affected Components

- `cli/src/components/tools/sequential-thinking.tsx` (new component)
- `cli/src/components/tools/registry.ts` (register)
- `cli/src/components/tools/__tests__/sequential-thinking.test.tsx` (new test)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists (manual expand shows raw JSON)
- [x] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Register a `SequentialThinkingComponent` that reads `input.thought` (the
reasoning text) and renders it inline as markdown with a short position label
(`💭 Thought N/M`, `↩️ Revising thought #k`, `· branch <id>`), plus a one-line
`collapsedPreview`. This is the `set_output` pattern applied to the reasoning
tool — the meaningful payload is in `input`, not `output`.

### Steps

1. Create `cli/src/components/tools/sequential-thinking.tsx` —
   `SequentialThinkingComponent` (`toolName: 'sequentialthinking'`). Extract
   `thought` + position/revision/branch metadata (coercing numeric/boolean
   strings the way the params schema does); render the thought as markdown;
   `content: null` when `thought` is empty.
2. Register it in `cli/src/components/tools/registry.ts`.
3. Add `cli/src/components/tools/__tests__/sequential-thinking.test.tsx`:
   renders the thought inline; label shows `Thought N/M`; empty thought →
   `content: null`; revision label.

### Verification

- `bun run --cwd=cli typecheck`
- `bun test cli/src/components/tools/__tests__/sequential-thinking.test.tsx`
- `bun x eslint cli/src/components/tools/sequential-thinking.tsx cli/src/components/tools/registry.ts cli/src/components/tools/__tests__/sequential-thinking.test.tsx --max-warnings 0`
- Grep: `sequentialthinking` present in `registry.ts` (Law 4 reachability).

## Perfection Loop

### Loop 1 — RED

- **RED (issues cataloged):**
  - No renderer (registry.ts absent).
  - Not hidden → tool block created (guards.ts:15-26 excludes it).
  - Collapsed by default (tool-branch.tsx:51-56).
  - Thought in `input`, metadata in `output` (sequential-thinking handler:47).
- **GREEN (minimal fix):** `SequentialThinkingComponent` rendering
  `input.thought` inline with a position label; register; focused test.
- **AUDIT (double-audit):**
  - Static: confirmed input carries `thought` + `thoughtNumber`/`totalThoughts`/
    `isRevision`/`revisesThought`/`branchId` (params file); handler output is
    metadata only (handler:47). No existing renderer (grep).
  - Call-graph: `renderToolComponent` is the only path (registry.ts
    referencedBy). `sequentialthinking` is Thinker-only (thinker.ts +
    thinker-gemini.ts `toolNames: ['sequentialthinking', 'end_turn']`), so the
    renderer appears only in Thinker branches — no double-render of the final
    synthesis (which the convergence gate surfaces separately).
  - Reuse: same markdown pipeline as `set-output.tsx`/`output-result.tsx`.
- **ADVERSARIAL (independent challenge):**
  - Challenge: "Would this double-render the Thinker's final answer?" — Refuted:
    the renderer shows each intermediate `thought`; the final synthesis is the
    Thinker agent's `output` (surfaced to the parent), a different block.
  - Challenge: "Is rendering reasoning inline too noisy?" — Accepted as
    intended: the prompt already promises visibility; the panel stays
    user-collapsible with a one-line preview.
- **CHANGE DELTA:** N/A (initial pass; FID authored fresh).

### Missed Questions

> Answer each with the most robust default and fold it back.

1. **Q: Render the `thought` (input) or the handler `output`?** A: `thought` —
   the output is only `{ message: JSON.stringify(counters) }` (handler:47).
2. **Q: Numeric/boolean coercion at the block level?** A: The block's `input`
   is the raw print-mode payload (may hold `"3"`/`"true"` strings). Coerce
   defensively, mirroring `z.coerce.number()`/`coercedBoolean`.
3. **Q: Empty thought?** A: `content: null` (no noise for a malformed call).
4. **Q: Should this be a "result" code block or plain text?** A: Plain markdown
   text — it is reasoning, not structured data.
5. **Q: `think_deeply` shares the same shape — fold it in too?** A: Out of scope
   (dead, no agent exposes it); recorded in the prior audit.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** uncommitted (working-tree closure per operator directive)
- [x] **File:line ranges:**
  - `cli/src/components/tools/sequential-thinking.tsx` — `SequentialThinkingComponent` (whole file, 115 lines)
  - `cli/src/components/tools/registry.ts:19` — import
  - `cli/src/components/tools/registry.ts:77` — `[SequentialThinkingComponent.toolName, SequentialThinkingComponent]`
  - `cli/src/components/tools/__tests__/sequential-thinking.test.tsx` — 3 cases
- [x] **Gate output:** typecheck exit 0; test 3 pass / 0 fail (7 expect); eslint --max-warnings 0 exit 0
- [x] **Reproducibility:** `bun test cli/src/components/tools/__tests__/sequential-thinking.test.tsx`
- [x] **Step statuses:** Steps 1-3 of Proposed Solution all done

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence present (registry entry)
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction (implementation audit)

- **RED:** New component renders `input.thought`; empty thought → `content: null`;
  stringified `thoughtNumber`/`isRevision` coerced defensively.
- **GREEN:** Registered in registry.ts; 3 focused tests added; eslint clean.
- **AUDIT:**
  - Static: component reads only `input` (no output dependency), matches the
    handler metadata-only contract (handler:47).
  - Call-graph: `renderToolComponent` is the sole consult path (registry
    referencedBy); `sequentialthinking` not in `hiddenToolNames` — now has a
    real renderer instead of the generic collapsed fallback.
  - Reuse: shares `renderContentWithMarkdown`/`renderMarkdownContent` pipeline
    with `set-output.tsx`/`output-result.tsx` (Law 13: one pipeline, many tools).
- **ADVERSARIAL:**
  - Challenge: "Stringified `isRevision: 'false'` would incorrectly label a
    revision?" — Refuted: `asBoolean` maps `'false'` → false, so the revision
    label is only applied when truthy.
  - Challenge: "Would this double-render the final synthesis?" — Refuted: the
    renderer shows intermediate `thought`s; the final synthesis is the Thinker
    agent `output` surfaced separately.
- **CHANGE DELTA:** none post-test (tests passed on first verified run).

## Resolution

- **Closed Date:** 2026-08-21
- **Fix Description:** Registered `SequentialThinkingComponent` (renders
  `input.thought` inline as markdown with a `💭 Thought N/M` / `↩️ Revising
  thought #k` / `· branch <id>` label and a one-line `collapsedPreview`),
  so the Thinker's reasoning stream is actually visible instead of a
  header-only box.
- **Tests Added:** `cli/src/components/tools/__tests__/sequential-thinking.test.tsx` (3 cases)
- **Verification Evidence:**
  ```text
  $ bun test .../sequential-thinking.test.tsx
  3 pass / 0 fail (7 expect)

  $ bun run --cwd=cli typecheck
  exit 0

  $ bun x eslint <3 files> --max-warnings 0
  exit 0
  ```
- **Archived:** dev/fids/archive/FID-2026-0821-008-sequentialthinking-header-only.md

## Lessons Learned

The input-vs-output audit now closes all three classes: input-payload result
(`set_output`), output-payload result (FID-007's 14 tools), and input-payload
reasoning (`sequentialthinking`). The invariant to reuse for any future tool:
find where the meaningful content lives (`input` vs `output`) and render that,
never the box-drawing header alone.
