# FID: Researcher acceptance and render recovery

**Filename:** `FID-2026-1012-003-researcher-acceptance-and-render-recovery.md`
**ID:** FID-2026-1012-003
**Severity:** high
**Status:** closed
**Created:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

The operator's scholarly acceptance run lost the entire interactive UI to an
AppRoot render error. Resuming reportedly fails too. The second run completes
research but never successfully calls paper lookup, and MCP tools use the old
generic display rather than the existing traffic-light panels.

## Environment

- Windows, Bun 1.3.14, TypeScript monorepo, OpenTUI 0.5.3.
- Initial HEAD: 7df92cba; operator-appended experience traces are preserved and
  excluded from task commits. The supplied results.md was read for evidence,
  then deleted at the operator's explicit request as disposable run output.

## Detailed Description

### Problem and expected behavior

A defective transcript block must show a local error while chat input, sibling
content and the ongoing run remain usable. Restoring the same history must not
replace the whole app with a noninteractive resume instruction. Correct MCP
argument types must reach dispatch; bounded corrective handling must not widen
tool authority or turn malformed input into accepted arguments. MCP calls should
reuse the project's traffic-light display in loading, result and error states.

### Root cause and evidence

- debug/cli.jsonl: 2026-10-12T16:10:17.878Z, AppRoot catches
  "Text must be created inside of a text node". Results arrive at
  16:10:17.923Z and 16:10:18.066Z afterward. This proves UI loss, not process
  death. The exact offending subtree is not yet reproduced.
- cli/src/index.tsx:275: root fallback replaces the app with a text-only
  instruction to restart. cli/src/components/error-boundary.tsx has no recovery
  control and logs no component stack.
- results.md tool report and runtime logs: ids arrays and numeric limits arrive
  as strings and fail validation. The agent's claim of harness coercion is a
  hypothesis; the parser must be inspected and reproduced.
- cli/src/components/tools/registry.ts resolves only registered native names;
  MCP names fall through to ToolCallItem in blocks/tool-branch.tsx.
- Existing OutputResultComponent and TrafficLightPanel already supply shared
  result rendering. Reuse them rather than inventing another visual system.

## Impact Assessment

High: transcript rendering can disable the entire live interface and recur on
resume. Paper lookup fails despite prior direct service checks succeeding.

## Proposed Solution

1. Preserve raw MCP JSON Schema through discovery and model tool construction;
   keep executor validation and existing permissions. A live schema probe proves
   search/similarity nullable schemas throw during Zod roundtrip and become empty
   under the current fallback. Add realistic schema regression coverage.
2. Repair JSON-encoded scalar/array/object values only when validation reports
   the corresponding expected type, retry validation once, and dispatch the
   validated result. Never parse ordinary string fields or accept invalid JSON,
   violated bounds, missing required values or non-object inputs.
3. Route namespaced MCP tools to a shared panel with human action names,
   streaming/empty/result/error states, collapse and copy preserved. Reuse
   TrafficLightPanel and StructuredCard. Keep native registrations unchanged.
4. Normalize StructuredCard rich text through renderMarkdownContent; it currently
   embeds raw semantic Markdown fragments directly under a box. Bound transcript
   failures locally in both root and nested block groups, showing raw content and
   a retry control while preserving sibling content and chat input. Log error
   and component stacks without writing any conversation payload to the error.
5. Prove host-error containment with the real OpenTUI reconciler, replay-style
   restoration, sibling/input survival, streaming, resize and retry. Run declared
   gates, full typecheck, lint, formatting and manual adversarial review. Commit
   explicit task paths locally; no publication is authorized.

### Verification

Use the real OpenTUI reconciler for containment, sibling/input survival, restored
content, streaming and narrow-layout checks. Runtime tests must verify typed
arrays/numbers, malformed rejection, model-visible schema and dispatched values.
Declare every resulting test artifact as a bare test gate before verification.

## Verification Gates

- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/mcp-schema-recovery.test.ts
- gate: test packages/agent-runtime/src/__tests__/researcher-scholars-execution.test.ts
- gate: test cli/src/components/__tests__/transcript-recovery.render.test.tsx
- gate: test cli/src/components/tools/__tests__/mcp-result.render.test.tsx
- gate: test cli/scripts/hud-preview.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:6731e7b5ee302a04868f741038578117ca8aa7b0be3e584be39ef9663ed2b8d8
- verified: 2026-10-12T20:44:48.679Z
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/mcp-schema-recovery.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/researcher-scholars-execution.test.ts: exit 0
- test cli/src/components/__tests__/transcript-recovery.render.test.tsx: exit 0
- test cli/src/components/tools/__tests__/mcp-result.render.test.tsx: exit 0
- test cli/scripts/hud-preview.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

RED: recorded AppRoot host failure and continued tool execution; lookup and
numeric strings fail runtime validation. No claim pins the original offending
subtree, because old logs omit component stacks.

GREEN: the five steps above use existing schema, validation, markdown, panel and
error-boundary seams. No role, dependency, server or safety exemption is added.

AUDIT: direct converter probe on simple array/integer schemas preserves types;
live server discovery shows search/similarity nullable fields make toJSONSchema
throw "Custom types cannot be represented in JSON Schema". Parser inspection
also proves it validates but discards parsed/transformed data. Production callers
are getMCPToolData -> getToolSet -> loop-context, and parseRawCustomToolCall ->
executeCustomToolCall. UI callers are BlocksRenderer and AgentBody, both sharing
ToolBlockGroup and the existing registry. The exact original renderer remains
NEEDS-REVIEW; containment and known unsafe rich-text conversion are testable.

ADVERSARIAL: accepting arbitrary coercion would hide malformed calls. Only a
single JSON decode at a type-error path followed by full schema validation is
allowed. A boundary at AppRoot cannot preserve input; boundaries belong around
individual transcript groups. Restarting the process is unnecessary and would
replay the same history. A native reconciler test is required; SSR is insufficient.

Converged specification; implementation may proceed under recorded level 3.

### Missed Questions

- Was this process termination? No: the log records continued tool execution.
- Does retry success prove acceptance? No: get_papers still fails in that run.
- Can arbitrary exceptions be ignored safely? No: recovery must be scoped to
  transcript rendering and validated tool inputs, retaining fatal process safety.

## Resolution

### Loop 2 — verification findings and correction

Full CLI verification: 4131 pass, 18 skip, one failure. The existing HUD capture
returned a blank frame after its fixed 20 ms wait. Its render-commit boundary
must be awaited with a bounded native-tree readiness probe, not assumed by time.
This correction retains every content and color assertion in the existing suite.

Markdown lint also found violations in the supplied results.md run transcript.
The operator subsequently authorized deleting that disposable file. Removed
it and the temporary lint/git exclusions; no gate exemption remains. Full
typecheck and quality have passed.

### Code Verification Evidence

Local implementation commit: f3dd0eee. Separate baseline-format commit:
285cf3fb. Nothing was pushed or published. The rebuilt local Windows binary
reports 0.0.35; it includes the schema, parser, panel and containment repairs.

The source repairs are implemented and the declared eight gates have passed.
The final non-object-root pin rejects null, booleans, numbers and arrays even
for zero-argument tools; the real executor pin proves decoded arrays and integers
are dispatched. Malformed JSON, missing fields, excessive array length and
numeric bounds remain failures. The recovery is one decode plus full validation,
not a provider retry or a permission exemption.

Native renderer tests cover root/nested restored groups, sibling content,
keyboard input, explicit mouse retry, a failing raw-content serializer, and the
old raw Markdown host shape. Existing copy/export data remains unchanged.
Production reachability is getMCPToolData -> getToolSet -> createLoopContext,
parseRawCustomToolCall -> executeCustomToolCall, registry -> ToolBranch,
containTranscriptNodes -> BlocksRenderer/AgentBody, and MessageWithAgents ->
TranscriptBoundary. Stable React node keys retain boundary ownership during
streaming. Error logging and raw-content fallback cannot throw through the local
boundary. Full CLI regression: 4133 pass, 18 skip, zero fail. SDK: 607 pass,
one platform skip, zero fail. Four service calls pass live with validated types.
Final runtime regression after the non-object-root pin: 2009 pass, zero fail.
Registered panels also avoid eagerly parsing their unused generic Markdown dump
on every streamed update; the existing parser now exclusively owns MCP output.

NEEDS-REVIEW, recorded honestly and not claimed as done: the exact original
offending subtree was never logged (the old logs carry no component stack), so
the repair is pinned by the shapes it covers — root and nested restored groups,
the old raw-Markdown host shape, a failing raw-content serializer — rather than
by reproducing that exact subtree; and the operator's original prompt still
needs acceptance on the repaired build, which is the operator's own live check.

The build boundary is now characterized instead of merely named. The
aggregate `bun run ci` red is the FID-2026-0805-002 integrity gate refusing
this machine's repo `.env.local`, which carries dev `NEXT_PUBLIC_*` values
(`NEXT_PUBLIC_SAVANT_CODE_APP_URL=http://localhost:3000`): that is the leak
class the gate exists to refuse, and the documented remedy is a clean shell.
Verified live in that condition, the Savant-Free leg builds green —
`SAVANT_FREE_MODE=true bun --no-env-file cli/scripts/build-binary.ts savant-free 0.0.0-dev`
→ exit 0, `✅ Built savant-free.exe (win32-x64)` — which also runs the SDK
build leg. T122 (repair the Savant-Free feature or remove it) remains an open,
operator-owned register item; nothing here resolves it.

### Closure

- **Closed Date:** 2026-10-12
- **Fix Description:** the schema, parser, panel and containment repairs were
  implemented and committed earlier (`f3dd0eee`, formatter normalization
  `285cf3fb`); this pass closes the record on its declared gates and records the
  two open boundaries above, plus the build-disposition measurement.
- **Tests Added:** `packages/agent-runtime/src/__tests__/mcp-schema-recovery.test.ts`,
  `packages/agent-runtime/src/__tests__/researcher-scholars-execution.test.ts`,
  `cli/src/components/__tests__/transcript-recovery.render.test.tsx`,
  `cli/src/components/tools/__tests__/mcp-result.render.test.tsx` and the HUD
  readiness fix inside `cli/scripts/hud-preview.test.tsx`.
- **Verification Evidence:** eight declared gates exit 0 live at the archived
  path (receipt below); full CLI suite 4136 pass / 18 skip / 0 fail, SDK 618
  pass / 1 skip / 0 fail and agent-runtime 2020 pass / 0 fail, all three
  re-measured live after the FID-2026-1012-007/-008 changes, plus root
  typecheck, ESLint, Markdown lint, formatting, `quality:report` and
  `validate:repository`.
- **Archived:** `dev/fids/archive/FID-2026-1012-003-researcher-acceptance-and-render-recovery.md`, with its
  CHANGELOG entry and an entry in `dev/fids/archive/README.md`.

### Loop 3 — repository gate normalization

The full formatting check identified 36 pre-existing files from yesterday's
work. Read each 0-EOF and normalized exactly those files with Prettier. The
printer retained source trivia, so verification compares structural TypeScript
trees against initial HEAD 7df92cba, retaining node kinds, literals, identifiers,
modifiers and child order while ignoring trivia and redundant parentheses.
All 36 trees are identical. Three files exceeded the line ceiling after
formatting; shortened comments only, then rechecked syntax and quality. No test
assertion or executable statement changed. Keep this cleanup in its own logical
local commit. Final full typecheck and eslint pass; the build boundary stands.

Repository validation also requires the exact Code Verification Evidence
heading and rejected untracked results.md as a foreign publishable root. Added
the heading; the operator authorized deletion of the disposable transcript.
Final repository validation, full Prettier check and Markdown lint all pass.

## Lessons Learned

Service round trips do not establish model-driven argument or UI acceptance.
