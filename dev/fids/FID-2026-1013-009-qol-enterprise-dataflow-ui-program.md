<!-- markdownlint-disable MD013 -->

# FID: Four-wave QOL, enterprise standards, agent data-flow, and UI/UX hardening program

**Filename:** `FID-2026-1013-009-qol-enterprise-dataflow-ui-program.md`
**ID:** FID-2026-1013-009
**Severity:** high
**Status:** converged
**Created:** 2026-10-13 19:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

---

## Summary

A full-repository audit across all 15 workspaces (3,458 non-test production TypeScript/TSX modules) identified 24
concrete engineering defects and QOL opportunities across four domains while all 7 baseline repository gates remain
green (`validate:repository`, `quality:report` , `hygiene:check` , `deps:undeclared` , `eslint` ,
`fid:verify --check` , `skills:check` ). This record is the **program coordinator FID** under the active repository
master (`FID-2026-1012-022`, per `scripts/fid-ledger.ts` single-master graph rule `fid.graph.multiple-masters` )
that organizes the four implementation waves — `FID-2026-1013-010` (Wave 1: Agent-to-Agent Data Flow & Compaction
Hardening), `FID-2026-1013-011` (Wave 2: Law 13 Shared-Primitive Consolidation & Deduplication),
`FID-2026-1013-012` (Wave 3: Law 6 Type Hardening, Lint Rationales & Quality Ceiling Relief), and
`FID-2026-1013-013` (Wave 4: CLI & Desktop UI/QOL Enhancements). It defines the disjoint file ownership matrix,
wave sequencing (`010` → `011` → `012` → `013` ), cross-wave invariants, and the verification contract. This
coordinator owns the plan; source implementation belongs to the child waves.
All four waves are now `fixed`, with implemented working-tree changes and passing
declared gates. They await implementation commits and closure evidence.

`implementation_started: false`

This marker describes the coordinator's own source-write surface. Child-wave
implementation has started and is recorded in each child's implementation evidence.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** ESLint 9 (`--max-warnings 0`), Prettier, markdownlint-cli2
- **Commit/State:** `main` @ `3ee91a35` (working tree carries existing open session changes)

## Detailed Description

### Problem

Although the standing repository gates pass on the current tree, deep static and call-graph inspection surfaced 24
concrete issues spanning four architectural layers:

1. **Wave 1 — Agent-to-Agent Data Flow & Compaction (`FID-2026-1013-010`):**
   - `apply_patch` writes are invisible to `agents/context-pruner/preserved-state.ts:171-208` ,
     `packages/agent-runtime/src/run-agent-step/compaction-plan.ts:32-34,104-131` , and
     `packages/agent-runtime/src/util/graph-injection.ts:45-60` (only `input.path` is checked, whereas
     `apply_patch` nests its target under `input.operation.path` per
     `packages/agent-runtime/src/echo/enforcement/helpers.ts:81-94` ).
   - `packages/agent-runtime/src/echo/pre-write-gates-law1.ts:45-87` calls `existsSync(targetPath)` and
     `canonicalizePath(targetPath)` against `process.cwd()` without resolving relative paths against `projectRoot`
     , causing false Law 1 blocks when the host process CWD differs from `fileContext.projectRoot` .
   - `packages/agent-runtime/src/evidence/spill-read.ts:42-61` (`loadEvidenceRecords`) re-reads and JSON-parses
     `.savant/evidence/<runId>.jsonl` from disk on every subagent spawn without an in-memory per-`(runId, shard,
     mtimeMs, size)` cache, adding avoidable I/O latency on parallel multi-agent spawns
     (`spawn-evidence.ts:62-66`).
   - `packages/agent-runtime/src/context-compactor/micro-compact.ts:138-140` estimates
     `tokensSaved = messagesCleared * 200` with a hardcoded constant instead of measuring the actual token delta of
     the cleared tool-result content.
   - `packages/agent-runtime/src/tools/handlers/tool/set-output.ts:56-68` interpolates raw `${bestError}` (an
     `[object Object]` stringification when `bestError` is a `ZodError` or non-string) and dumps the entire
     unredacted `output` payload into the tool result and log without secret redaction or size capping.

2. **Wave 2 — Law 13 Shared-Primitive Consolidation (`FID-2026-1013-011`):**
   - `toolDisplayName` is duplicated across 3 files (`cli/src/commands/copy-conversation-render.ts:12-15`,
     `cli/src/commands/export-conversation/format.ts:31-34` , `desktop/src/components/chat/tool-display.ts:11-19`
     ).
   - `truncateSingleLine` is duplicated across 4 files (`cli/src/components/tools/add-message.tsx:14-18`,
     `cli/src/components/tools/sequential-thinking.tsx:41-45` , `cli/src/components/tools/set-output.tsx:31-35` ,
     `desktop/src/components/chat/tool-display.ts:48-52` ).
   - `renderToolInput` and `renderToolOutput` are duplicated verbatim between
     `cli/src/commands/copy-conversation-render.ts:63-98` and
     `cli/src/commands/export-conversation/format.ts:44-77` .
   - `traceRoundedRect` is duplicated verbatim between `desktop/src/floor/office/nameplate-draw.ts:81-95` and
     `desktop/src/floor/stage/nameplate.ts:59-73` .
   - `asPositiveInt` and `asBoolean` are duplicated with divergent coercion semantics between
     `cli/src/components/tools/sequential-thinking.tsx:20-39` (handles stringified numbers/booleans) and
     `desktop/src/lib/thinking-parse.ts:34-41` (rejects stringified numbers/booleans).
   - `getRuntimeRequire` and `resolveBunSqliteDatabaseModule` (`resolveBunSqlite`) are duplicated across 4 files
     (`packages/database/src/index.ts:18-45`, `packages/knowledge-graph/src/store.ts:20-43` ,
     `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts:34-70` ,
     `packages/agent-runtime/src/llm-api/docset-search.ts:47-72` ).
   - `scripts/eslint-rules/shared-primitives.json` does not yet register the newly consolidated shared primitives
     (`toolDisplayName`, `truncateSingleLine` , `renderToolInput` , `renderToolOutput` , `traceRoundedRect` ).

3. **Wave 3 — Law 6 Type Hardening, Lint Rationales & Quality Ceiling Relief (`FID-2026-1013-012`):**
   - 15 production `eslint-disable` comments across 9 tracked source files omit the required `-- <rationale>`
     explanation (`cli/src/index.tsx:74`, `desktop/src/floor/driver/deck-live-driver.ts:156` ,
     `desktop/src/floor/stage/deck-robots-loader.ts:34` , `desktop/src/floor/stage/deck-runtime.ts:84,177` ,
     `desktop/src/floor/stage/deck-walkers-mount.ts:63` , `desktop/src/floor/stage/deck-walkers.ts:151` ,
     `desktop/src/floor/stage/perf-hud.ts:117` , `packages/agent-runtime/src/provenance/session.ts:86,276` ,
     `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline-verdict.ts:63` ,
     `sdk/src/custom-tool.ts:7,9,33,35` ), and no repository gate enforces `-- <rationale>` on `eslint-disable`
     directives.
   - `cli/src/commands/init-type-files.ts:5-19` carries 8 `@ts-expect-error` directives on Bun
     `with { type: 'text' }` imports because no ambient module declaration covers `.ts` text-attribute imports or a
     typed loader seam.
   - 7 production files suppress `@typescript-eslint/no-explicit-any` where concrete types (`unknown`,
     `Record<string, unknown>` , `z.ZodTypeAny` , or OpenTUI ref types) eliminate `any` cleanly
     (`common/src/util/agent-name-normalization.ts:1,16`, `common/src/env-schema.ts:1,22` ,
     `cli/src/hooks/use-send-message-options.ts:1,15,51` , `sdk/src/agents/load-agents.ts:228-229` ,
     `sdk/src/custom-tool.ts:7-10,33-36` , `common/src/tools/constants.ts:1,144` ,
     `common/src/types/contracts/client.ts:1,10` ).
   - `packages/agent-runtime/src/echo/post-write-scanners.ts:31` scans raw file text with
     `/@ts-ignore|@ts-expect-error|\bany\b/g` , which false-positives on prose comments or string literals
     containing the English word `any` (e.g., `// if any item fails` ).
   - `scripts/eslint-rules/no-unknown-in-signatures.js:90-140` checks `TSTypeAnnotation` only on `Identifier`
     params and misses destructured parameters (`function f({ a }: { a: unknown })`), default parameters (`function
     f(x: unknown = 1)`), and rest parameters (`function f(...args: unknown[])`).
   - 20 non-test production files sit at exactly 300 lines (0 lines of headroom before failing `quality:report` ),
     and several files touched by Waves 1–4 (`desktop/src/state/transcript-reducer.ts` at 300 lines,
     `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` at 300 lines,
     `agents/savant/handle-steps-template-body-b.ts` at 299 lines) require cohesive helper extraction before new
     logic can land safely.

4. **Wave 4 — CLI & Desktop UI/QOL Enhancements (`FID-2026-1013-013`):**
   - `desktop/src/state/transcript-types.ts:43-50` , `desktop/src/state/transcript-reducer.ts:95-135` , and
     `desktop/src/components/chat/ToolCard.tsx` omit `parentAgentId` and `agentType` on `ChatBlock` (`kind:
     'tool'`) and omit `set_output` structured-card rendering and `apply_patch` diff rendering
     (`desktop/src/lib/diff-parse.ts`), leaving Desktop subagent tool calls unattributed and `set_output`
     /`apply_patch` rendered as raw JSON.
   - `desktop/src/components/chat/ApprovalCard.tsx:14-64` and `desktop/src/hooks/use-gateway.ts:224-233` hardcode
     empty answers (`respondApproval(approvalId, [], skipped)`), preventing the operator from supplying free-text
     context or structured answers when approving or rejecting a request on Desktop.
   - `desktop/src/floor/office/office-scene.tsx:96-109` calls `setBursts` on every completion inside `useFrame` ,
     and `desktop/src/floor/office/scene-frame-loop.ts:105-110` scans `walkers.find(...)` (`O(W)` per child ->
     `O(N*W)` per frame) and mutates `document.body.style.cursor` directly across multiple `AgentCharacter`
     instances (`desktop/src/floor/office/scene-agent-ui.tsx:48-53`), causing cursor race conditions when moving
     directly from one agent to another.
   - `cli/src/chat/use-message-block-sync.ts:62-84` creates a new `{}` literal in
     `responseAds: showInlineAds ? responseAds : {}` on every `useLayoutEffect` pass when `showInlineAds` is false,
     and `cli/src/hooks/use-chat-messages.ts:81-94` uses an untracked `setTimeout(..., 0)` without
     unmount/re-trigger cleanup.

### Expected Behavior

1. Every one of the 24 findings is owned by exactly one wave FID (`FID-2026-1013-010` through `FID-2026-1013-013`
   ), with zero unowned items and zero overlapping write surfaces where waves could conflict.
2. Each wave FID is converged through the Perfection Loop (`RED` → `GREEN` → `AUDIT` → `ADVERSARIAL` → `CONVERGED`
   ) with exact `file:line` citations, answered Missed Questions, and declared verification gates.
3. Waves execute in deterministic dependency order (`010` → `011` → `012` → `013` ) so that ceiling splits and
   shared primitives are in place before downstream waves touch shared modules.

### Root Cause

Incremental feature delivery across `packages/agent-runtime` , `agents` , `common` , `cli` , `desktop` , and `sdk`
added specialized tools (`apply_patch`, `set_output` , `sequentialthinking` ), desktop UI views, and EHEL
enforcement gates without a cross-workspace consolidation pass to unify shared helpers, propagate new tool shapes
(`apply_patch`'s `input.operation.path` ) into every compaction/graph consumer, and relieve 300-line ceiling
pressure on hot modules.

### Evidence

Live baseline verification and audit measurements on `main` @ `3ee91a35`:

```text
1. Wave 1 (Data Flow & Compaction):
   - packages/agent-runtime/src/echo/enforcement/helpers.ts:81-94 handles `input.operation.path` for `apply_patch`,
     but agents/context-pruner/preserved-state.ts:171-208, packages/agent-runtime/src/run-agent-step/compaction-plan.ts:32-55,
     and packages/agent-runtime/src/util/graph-injection.ts:45-60 only inspect `write_file`/`str_replace` or `input.path`.
   - packages/agent-runtime/src/echo/pre-write-gates-law1.ts:87-94 calls `existsSync(path)` on raw unanchored paths.
   - packages/agent-runtime/src/context-compactor/micro-compact.ts:140 computes `const tokensSaved = messagesCleared * 200`.

2. Wave 2 (Law 13 Duplication):
   - toolDisplayName defined in 3 files: cli/src/commands/copy-conversation-render.ts:12,
     cli/src/commands/export-conversation/format.ts:31, desktop/src/components/chat/tool-display.ts:11.
   - truncateSingleLine defined in 4 files: cli/src/components/tools/add-message.tsx:14,
     cli/src/components/tools/sequential-thinking.tsx:41, cli/src/components/tools/set-output.tsx:31,
     desktop/src/components/chat/tool-display.ts:48.
   - renderToolInput + renderToolOutput duplicated in copy-conversation-render.ts:63-98 and export-conversation/format.ts:44-77.
   - traceRoundedRect duplicated in desktop/src/floor/office/nameplate-draw.ts:81-95 and desktop/src/floor/stage/nameplate.ts:59-73.
   - resolveBunSqliteDatabaseModule / getRuntimeRequire duplicated across 4 files.

3. Wave 3 (Law 6, Rationales & Ceiling):
   - 15 production eslint-disable directives without `--` rationale across 9 files.
   - 8 `@ts-expect-error` directives in cli/src/commands/init-type-files.ts:5-19.
   - 20 non-test files at exactly 300 lines (0-line headroom), including desktop/src/state/transcript-reducer.ts
     and packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts.

4. Wave 4 (CLI & Desktop UI/QOL):
   - desktop/src/state/transcript-types.ts:43-50 ToolBlock lacks parentAgentId/agentType; ToolCard.tsx lacks set_output card.
   - desktop/src/components/chat/ApprovalCard.tsx:14-64 & use-gateway.ts:224-233 pass `[]` answers with no note input.
   - desktop/src/floor/office/scene-frame-loop.ts:110 O(N*W) walker lookup per frame; scene-agent-ui.tsx:48-53 cursor race.
   - cli/src/chat/use-message-block-sync.ts:74 fresh `{}` allocation every layout effect; use-chat-messages.ts:91 raw setTimeout.
```

## Impact Assessment

### Affected Components

- **Master & Scope Governance:** `dev/fids/FID-2026-1012-022-failure-class-remediation-master-plan.md`, `SCOPE.md`
- **Wave 1 (`FID-2026-1013-010`):** `agents/context-pruner/preserved-state.ts` ,
  `packages/agent-runtime/src/run-agent-step/compaction-plan.ts` ,
  `packages/agent-runtime/src/util/graph-injection.ts` , `packages/agent-runtime/src/echo/pre-write-gates-law1.ts`
  , `packages/agent-runtime/src/echo/pre-write-gates.ts` ,
  `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` ,
  `packages/agent-runtime/src/evidence/spill-read.ts` , `packages/agent-runtime/src/evidence/spill.ts` ,
  `packages/agent-runtime/src/context-compactor/micro-compact.ts` ,
  `packages/agent-runtime/src/tools/handlers/tool/set-output.ts`
- **Wave 2 (`FID-2026-1013-011`):** `common/src/util/tool-display.ts` (new canonical home),
  `common/src/util/bun-sqlite.ts` (new canonical home), `scripts/eslint-rules/shared-primitives.json` ,
  `cli/src/commands/copy-conversation-render.ts` , `cli/src/commands/export-conversation/format.ts` ,
  `cli/src/components/tools/add-message.tsx` , `cli/src/components/tools/sequential-thinking.tsx` ,
  `cli/src/components/tools/set-output.tsx` , `desktop/src/components/chat/tool-display.ts` ,
  `desktop/src/lib/thinking-parse.ts` , `desktop/src/floor/office/nameplate-draw.ts` ,
  `desktop/src/floor/stage/nameplate.ts` , `packages/database/src/index.ts` ,
  `packages/knowledge-graph/src/store.ts` ,
  `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts` ,
  `packages/agent-runtime/src/llm-api/docset-search.ts`
- **Wave 3 (`FID-2026-1013-012`):** `scripts/audit-eslint-disable-rationale.ts` (new gate probe),
  `scripts/validate-repository.ts` , `scripts/eslint-rules/no-unknown-in-signatures.js` ,
  `packages/agent-runtime/src/echo/post-write-scanners.ts` , `cli/src/commands/init-type-files.ts` ,
  `sdk/src/custom-tool.ts` , `sdk/src/agents/load-agents.ts` , `common/src/util/agent-name-normalization.ts` ,
  `common/src/env-schema.ts` , `common/src/tools/constants.ts` , `common/src/types/contracts/client.ts` ,
  `cli/src/hooks/use-send-message-options.ts` , `cli/src/index.tsx` ,
  `desktop/src/floor/driver/deck-live-driver.ts` , `desktop/src/floor/stage/deck-robots-loader.ts` ,
  `desktop/src/floor/stage/deck-runtime.ts` , `desktop/src/floor/stage/deck-walkers-mount.ts` ,
  `desktop/src/floor/stage/deck-walkers.ts` , `desktop/src/floor/stage/perf-hud.ts` ,
  `packages/agent-runtime/src/provenance/session.ts` ,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline-verdict.ts` , plus 300-line ceiling
  decompositions (`desktop/src/state/transcript-reducer.ts`,
  `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` )
- **Wave 4 (`FID-2026-1013-013`):** `desktop/src/state/transcript-types.ts` ,
  `desktop/src/state/transcript-reducer.ts` , `desktop/src/components/chat/ToolCard.tsx` ,
  `desktop/src/lib/diff-parse.ts` , `desktop/src/components/chat/ApprovalCard.tsx` ,
  `desktop/src/hooks/use-gateway.ts` , `desktop/src/floor/office/office-scene.tsx` ,
  `desktop/src/floor/office/scene-frame-loop.ts` , `desktop/src/floor/office/scene-agent-ui.tsx` ,
  `cli/src/chat/use-message-block-sync.ts` , `cli/src/hooks/use-chat-messages.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — compaction and call-graph reachability silently drop
      `apply_patch` file mutations, Law 1 false-blocks relative paths when CWD differs from `projectRoot` , and 20
      files sit at 0-line ceiling headroom.
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Organize the 24 audit items into four focused, dependency-ordered wave FIDs under the repository's single active
master (`FID-2026-1012-022`, so `scripts/fid-ledger.ts` `fid.graph.multiple-masters` and `fid.graph.master-nested`
remain 100% satisfied). Each wave FID declares `**Master FID:** FID-2026-1012-022` and `**Depends On:**` linking
this coordinator (`FID-2026-1013-009`) and its predecessor wave where file surfaces intersect:

| Wave | FID | Focus | Findings Owned | Depends On |
| :--- | :--- | :--- | :--- | :--- |
| **Coordinator** | `FID-2026-1013-009` | Program architecture, 24-item allocation matrix, sequencing, cross-wave invariants | All 24 (allocated to Waves 1–4) | — |
| **Wave 1** | `FID-2026-1013-010` | Agent-to-Agent Data Flow & Compaction Hardening | 5 findings (W1-1 … W1-5) | `FID-2026-1013-009` |
| **Wave 2** | `FID-2026-1013-011` | Law 13 Shared-Primitive Consolidation & Deduplication | 7 findings (W2-1 … W2-7) | `FID-2026-1013-009`, `FID-2026-1013-010` |
| **Wave 3** | `FID-2026-1013-012` | Law 6 Type Hardening, Lint Rationales & Quality Ceiling Relief | 6 findings (W3-1 … W3-6) | `FID-2026-1013-009`, `FID-2026-1013-011` |
| **Wave 4** | `FID-2026-1013-013` | CLI & Desktop UI/QOL Enhancements | 6 findings (W4-1 … W4-6) | `FID-2026-1013-009`, `FID-2026-1013-012` |

### Complete 24-Finding Allocation Matrix

| ID | Domain | Finding Summary | Primary File:Line | Owning Wave FID |
| :--- | :--- | :--- | :--- | :--- |
| **W1-1** | Compaction / Graph | `apply_patch` (`input.operation.path`) dropped by `preserved-state.ts`, `compaction-plan.ts`, and `graph-injection.ts` | `agents/context-pruner/preserved-state.ts:171-208` | `FID-2026-1013-010` |
| **W1-2** | EHEL Law 1 | `runLaw1Gate` checks `existsSync(path)` on unanchored relative paths instead of resolving against `projectRoot` | `packages/agent-runtime/src/echo/pre-write-gates-law1.ts:45-94` | `FID-2026-1013-010` |
| **W1-3** | Spawn Evidence | `loadEvidenceRecords` re-reads and parses `.savant/evidence/<runId>.jsonl` on every child spawn without caching | `packages/agent-runtime/src/evidence/spill-read.ts:42-61` | `FID-2026-1013-010` |
| **W1-4** | Micro-Compact | `runMicroCompact` hardcodes `tokensSaved = messagesCleared * 200` instead of actual token delta | `packages/agent-runtime/src/context-compactor/micro-compact.ts:138-140` | `FID-2026-1013-010` |
| **W1-5** | `set_output` | `handleSetOutput` formats `ZodError` via raw string interpolation and logs/returns unredacted, uncapped payloads | `packages/agent-runtime/src/tools/handlers/tool/set-output.ts:56-73` | `FID-2026-1013-010` |
| **W2-1** | Law 13 | `toolDisplayName` duplicated across 3 CLI/Desktop files | `desktop/src/components/chat/tool-display.ts:11-19` | `FID-2026-1013-011` |
| **W2-2** | Law 13 | `truncateSingleLine` duplicated across 4 CLI/Desktop files | `cli/src/components/tools/add-message.tsx:14-18` | `FID-2026-1013-011` |
| **W2-3** | Law 13 | `renderToolInput` and `renderToolOutput` duplicated in `/copy` and `/export` | `cli/src/commands/copy-conversation-render.ts:63-98` | `FID-2026-1013-011` |
| **W2-4** | Law 13 | `traceRoundedRect` duplicated across Desktop office and stage nameplates | `desktop/src/floor/office/nameplate-draw.ts:81-95` | `FID-2026-1013-011` |
| **W2-5** | Law 13 | `asPositiveInt` and `asBoolean` duplicated with divergent coercion between CLI and Desktop | `desktop/src/lib/thinking-parse.ts:34-41` | `FID-2026-1013-011` |
| **W2-6** | Law 13 | `getRuntimeRequire` + `resolveBunSqliteDatabaseModule` duplicated across 4 packages | `packages/database/src/index.ts:18-45` | `FID-2026-1013-011` |
| **W2-7** | Law 13 Gate | Register newly consolidated shared primitives in `scripts/eslint-rules/shared-primitives.json` | `scripts/eslint-rules/shared-primitives.json:1-50` | `FID-2026-1013-011` |
| **W3-1** | Lint Hygiene | 15 production `eslint-disable` comments lack `-- <rationale>` + add repository gate check | `desktop/src/floor/stage/deck-runtime.ts:84,177` | `FID-2026-1013-012` |
| **W3-2** | Law 6 | Eliminate 8 `@ts-expect-error` directives in `cli/src/commands/init-type-files.ts` | `cli/src/commands/init-type-files.ts:5-19` | `FID-2026-1013-012` |
| **W3-3** | Law 6 | Replace avoidable `any` and `@typescript-eslint/no-explicit-any` across 7 production files | `sdk/src/custom-tool.ts:7-36` | `FID-2026-1013-012` |
| **W3-4** | EHEL Law 6 | Strip comments and string literals before scanning for `\bany\b` in `post-write-scanners.ts` | `packages/agent-runtime/src/echo/post-write-scanners.ts:28-33` | `FID-2026-1013-012` |
| **W3-5** | ESLint Law 6 | Extend `no-unknown-in-signatures.js` to catch `ObjectPattern`, `ArrayPattern`, `AssignmentPattern`, and `RestElement` | `scripts/eslint-rules/no-unknown-in-signatures.js:116-127` | `FID-2026-1013-012` |
| **W3-6** | Quality Cap | Decompose 300-line ceiling-locked modules (`tool-pipeline.ts`, `transcript-reducer.ts`, `handle-steps-template-body-b.ts`) | `desktop/src/state/transcript-reducer.ts:1-300` | `FID-2026-1013-012` |
| **W4-1** | Desktop UI | Subagent attribution (`parentAgentId`, `agentType`) on Desktop `ToolBlock` and `ToolCard` | `desktop/src/state/transcript-types.ts:43-50` | `FID-2026-1013-013` |
| **W4-2** | Desktop UI | `set_output` structured card + `apply_patch` diff rendering in Desktop `ToolCard` and `diff-parse.ts` | `desktop/src/components/chat/ToolCard.tsx:48-105` | `FID-2026-1013-013` |
| **W4-3** | Desktop UI | Interactive answer/reason input on Desktop `ApprovalCard` wired through `useGateway.respondApproval` | `desktop/src/components/chat/ApprovalCard.tsx:14-64` | `FID-2026-1013-013` |
| **W4-4** | Desktop 3D | `O(1)` walker lookup map in `scene-frame-loop.ts`, ref-pooled spark bursts, and reference-counted hover cursor | `desktop/src/floor/office/scene-frame-loop.ts:105-115` | `FID-2026-1013-013` |
| **W4-5** | CLI Perf | Replace inline `{}` allocation with frozen `EMPTY_RESPONSE_ADS` constant in `use-message-block-sync.ts` | `cli/src/chat/use-message-block-sync.ts:74` | `FID-2026-1013-013` |
| **W4-6** | CLI Perf | Track and clear `isUserCollapsingRef` timer on re-trigger and unmount in `use-chat-messages.ts` | `cli/src/hooks/use-chat-messages.ts:81-96` | `FID-2026-1013-013` |

### Steps

1. Converge and register Wave 1 (`FID-2026-1013-010`) covering W1-1 through W1-5 (`apply_patch` compaction/graph
   tracking, `projectRoot` -anchored Law 1 check, cached evidence-spill reads with `resetEvidenceRecordCache` ,
   real token delta in `micro-compact.ts` , and structured/redacted `set_output` error formatting).
2. Converge and register Wave 2 (`FID-2026-1013-011`) covering W2-1 through W2-7 (canonical shared utilities in
   `common/src/util/tool-display.ts` , `common/src/util/bun-sqlite.ts` ,
   `cli/src/commands/conversation-render-shared.ts` , `desktop/src/floor/canvas-primitives.ts` , and
   `scripts/eslint-rules/shared-primitives.json` ).
3. Converge and register Wave 3 (`FID-2026-1013-012`) covering W3-1 through W3-6 (`eslint-disable` rationale
   enforcement + 15 rationales, `init-type-files.ts` type-safe raw-text loader, 7 `no-explicit-any` removals,
   comment/string-stripped Law 6 post-write scanner, `no-unknown-in-signatures.js` destructuring/default/rest
   coverage, and 300-line ceiling relief on `tool-pipeline.ts` , `transcript-reducer.ts` , and
   `handle-steps-template-body-b.ts` ).
4. Converge and register Wave 4 (`FID-2026-1013-013`) covering W4-1 through W4-6 (Desktop subagent tool
   attribution, `set_output` + `apply_patch` rendering in `ToolCard` , `ApprovalCard` note/answer input, 3D
   OfficeScene `O(1)` stepper + cursor ref-count, and CLI hook allocation/timer cleanup).
5. Register `FID-2026-1013-009` through `FID-2026-1013-013` in `FID-2026-1012-022` (the single active master table)
   and `SCOPE.md` (both Open Items and Machine-Readable Scope Targets) and verify with
   `bun run validate:repository` , `bun run fid:verify --check` , and `bun run lint:md` .

### Verification

Pre-implementation verification for this coordinator record and its four wave FIDs:

- `bun run validate:repository` exits 0 (verifying `fid.ledger` , `fid.graph.*` , `fid.steps.unresolved` ,
  `scope.prohibited-disposition` , `scope.unregistered-item` , and `quality.ratchet` ).
- `bun run fid:verify --check` exits 0.
- `bun run lint:md` exits 0.

When each wave is implemented and transitions to `verified` , it stamps its own receipt via
`bun run fid:verify <fid-path> --write` over its declared `typecheck` , `test` , `probe` , and `quality` gates.

## Verification Gates

Coordination plan (`Status: converged`): this record makes no source changes of its own and carries no implementation
receipt. Each child wave FID (`FID-2026-1013-010` … `FID-2026-1013-013` ) declares the
exact `typecheck` , `test` , `probe` , and `quality` gates that prove its implementation.

## Perfection Loop

### Loop 1 — RED

- **RED:** Identified three structural hazards in organizing a 5-FID multi-wave program in this repository:
  1. `scripts/fid-ledger.ts:76-83` enforces `fid.graph.multiple-masters` ("Active FIDs declare multiple master
     FIDs") and `fid.graph.master-nested` ("Master FID must not declare another master FID"). Because
     `FID-2026-1012-022` is already the active master in `dev/fids/` , declaring `FID-2026-1013-009` as a second
     `**Master FID:**` on Waves 1–4 would fail `validate:repository` .
  2. `packages/agent-runtime/src/echo/fid-step-evasion.ts:15-75` fails `fid.steps.unresolved` on any `converged`
     FID that lacks a standalone `implementation_started: false` line when unchecked boxes exist outside
     `## Step Status` .
  3. Two files touched by Waves 1 and 4 — `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` (300
     lines) and `desktop/src/state/transcript-reducer.ts` (300 lines) — are at the exact 300-line ceiling
     (`dev/quality-baseline.json` / `scripts/quality-report.ts:116` ).
- **GREEN:**
  1. Linked `FID-2026-1013-009` and all four wave FIDs (`-010` … `-013` ) under `**Master FID:** FID-2026-1012-022`
     , registered all five in `FID-2026-1012-022` 's Children table, and connected the four waves to
     `FID-2026-1013-009` via `**Depends On:** FID-2026-1013-009` (validated by `scripts/fid-ledger.ts:107-143` DAG
     walk).
  2. Added the standalone `implementation_started: false` declaration to every pre-implementation `converged` FID
     in this program.
  3. Sequenced ceiling decompositions explicitly inside each wave before adding lines to 300-line files
     (`tool-pipeline.ts` in Wave 1/3, `transcript-reducer.ts` in Wave 3/4).
- **AUDIT:** Verified against `scripts/fid-ledger.ts:71-145` ,
  `packages/agent-runtime/src/echo/fid-step-evasion.ts:15-75` , and `scripts/quality-report.ts:100-125` . All 24
  findings from the repository audit are accounted for in the allocation matrix (5 in Wave 1, 7 in Wave 2, 6 in
  Wave 3, 6 in Wave 4 = 24 total).
- **ADVERSARIAL:** Could `agents/context-pruner/preserved-state.ts` import a shared helper from
  `@savant-code/common` in Wave 1 or Wave 2? **Refuted:** `agents/context-pruner/preserved-state.ts:41-44`
  documents that every function in `context-pruner` is serialized via `.toString()` at factory time and evaluated
  in an isolated scope where external module imports are unavailable. Wave 1 and Wave 2 therefore keep
  `context-pruner` helpers self-contained and embeddable-safe.
- **CHANGE DELTA:** Initial authoring pass of the coordinator record.

### Missed Questions

1. **Question:** How should the new coordinator FID (`FID-2026-1013-009`) and the 4 wave FIDs (`FID-2026-1013-010`
   … `-013` ) express their hierarchy without violating `scripts/fid-ledger.ts` `fid.graph.multiple-masters` ?
   **Decision:** All 5 FIDs declare `**Master FID:** FID-2026-1012-022` (the repository's single active master) and
   are listed in `FID-2026-1012-022` 's child table, while Waves 1–4 declare `**Depends On:** FID-2026-1013-009`
   (plus predecessor wave IDs) to enforce the coordinator and wave DAG mechanically.
2. **Question:** Can `agents/context-pruner/*` participate in cross-package imports when consolidating shared
   helpers in Wave 1 or Wave 2?
   **Decision:** No. `agents/context-pruner` functions are embedded via `.toString()` into the generated
   `handleSteps` string (`agents/context-pruner/preserved-state.ts:41-44`), so any helper used inside
   `context-pruner` must remain a pure, self-contained exported function within `agents/context-pruner/` with zero
   external runtime imports.
3. **Question:** How do we prevent 300-line ceiling failures when Waves 1, 3, and 4 touch `tool-pipeline.ts` (300
   lines) and `transcript-reducer.ts` (300 lines)?
   **Decision:** Any wave that edits a file at 295–300 lines must extract a cohesive sub-module in the same step so
   every touched file stays strictly below 300 lines and leaves headroom for subsequent waves.

### Implementation Evidence (REQUIRED for `closed`)

> Coordination plan (`Status: converged`). All four waves have working-tree
> implementations and valid receipts; final closure requires committed child evidence.

- [ ] **Commit SHA:** —
- [ ] **File:line ranges:** —
- [ ] **Gate output:** —
- [ ] **Reproducibility:** —
- [x] **Step statuses:** All five planning/registration steps are present: four wave
      records with declared gates, master child/status rows, and scope entries/targets.
      Child implementation commits and closure remain open.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and were inspected 0-EOF: `scripts/fid-ledger.ts:1-276` ,
      `packages/agent-runtime/src/echo/fid-validator.ts:1-278` ,
      `packages/agent-runtime/src/echo/fid-step-evasion.ts:1-86` , `scripts/quality-report.ts:1-169` .
- [x] Allocation completeness verified: 24 findings mapped across `FID-2026-1013-010` (5), `FID-2026-1013-011` (7),
      `FID-2026-1013-012` (6), and `FID-2026-1013-013` (6) = 24 findings, 0 unassigned.
- [x] Pre-implementation repository gates verified (`validate:repository` PASS, `quality:report` PASS on 1,502
      baselined files, `fid:verify --check` PASS).
- [x] FID status (`converged`) describes this coordination plan. Each child wave
      is `fixed` with `implementation_started: true`; the program is implemented
      in the working tree and awaiting committed closure evidence.

### Loop 2 — Independent audit and self-correction

- **RED:** Audited cross-wave file dependencies: both Wave 1 (`FID-2026-1013-010`) and Wave 3 (`FID-2026-1013-012`)
  reference `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` (300 lines), and both Wave 3
  (`FID-2026-1013-012`) and Wave 4 (`FID-2026-1013-013`) reference `desktop/src/state/transcript-reducer.ts` (300
  lines). If Wave 1 edits `tool-pipeline.ts` before Wave 3 decomposes it, Wave 1 would immediately trip the
  300-line ceiling.
- **GREEN:** Assigned the `tool-pipeline.ts` helper extraction (`projectRoot` threading + read-tracking helper)
  directly to Wave 1 (`FID-2026-1013-010`) where `projectRoot` is needed for Law 1, and assigned the
  `transcript-reducer.ts` helper extraction to Wave 3 (`FID-2026-1013-012`) before Wave 4 (`FID-2026-1013-013`)
  adds subagent metadata fields to `ToolBlock` . Declared explicit `**Depends On:**` edges (`010` → `011` → `012` →
  `013` ) so the execution order is enforced by `scripts/fid-ledger.ts` .
- **AUDIT:** Verified line counts: `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` is 300 lines
  (`quality-report.ts` check); `desktop/src/state/transcript-reducer.ts` is 300 lines. Sequential dependency chain
  `FID-2026-1013-009` ← `010` ← `011` ← `012` ← `013` is acyclic.
- **ADVERSARIAL:** Does `scope-register-completeness.ts` (`FID-2026-0919-025`) flag bare `Task NN` or `TNN-X`
  strings inside active FIDs? Checked `packages/agent-runtime/src/echo/scope-register-completeness.ts:52-55` : it
  matches `/\bTask\s+(\d+)\b/g` and `/\bT(\d+)-([A-Z])\b/g` outside inline code backticks. Our finding IDs use
  `W1-1` … `W4-6` (and any `Task NN` citations are backtick-quoted), so zero false-positive unregistered-task
  errors can trigger.
- **CHANGE DELTA:** ~6% targeted refinement to wave dependency ordering and ceiling ownership.

### Loop 3 — Final convergence

- **RED:** Checked for any remaining ambiguity in closure criteria or gate declarations across the coordinator and
  its four wave FIDs.
- **GREEN:** No further changes required; every wave's scope, file targets, and verification gates are
  self-contained and non-overlapping.
- **AUDIT:** Structural check against `packages/agent-runtime/src/echo/fid-validator.ts` (`REQUIRED_SECTIONS`,
  `STRICT_SECTIONS` , `MIN_UNANSWERED_QUESTIONS >= 2` , zero `PLACEHOLDER_PATTERN` matches, standalone
  `implementation_started: false` ).
- **ADVERSARIAL:** Verified that `converged` is the exact pre-implementation status mandated by
  `templates/FID-TEMPLATE.md:9-13` and `scripts/fid-ledger.ts:22-28` .
- **CHANGE DELTA:** 0% — converged.

## Resolution

**Coordination plan converged; Waves 1–4 implemented in the working tree — `Status: converged`.**

Ground-truth audit 2026-10-14: all four wave headers are `fixed`, their production
consumers exist, and their declared gates pass the repository validator's live
rerun. Their cited baseline HEADs do not contain the uncommitted implementation.
This coordinator remains active until each child records its implementation
commit, completes its closure evidence, and closes. Historical planning loops
retain their original pre-implementation measurements; no child needs to
be re-implemented solely because the former coordinator prose said unstarted.

- **Coordinator FID:** `FID-2026-1013-009`
- **Wave FIDs:** `FID-2026-1013-010` (Wave 1), `FID-2026-1013-011` (Wave 2), `FID-2026-1013-012` (Wave 3),
  `FID-2026-1013-013` (Wave 4)
- **Execution order:** `FID-2026-1013-010` → `FID-2026-1013-011` → `FID-2026-1013-012` → `FID-2026-1013-013`

## Lessons Learned

1. **Respect the single-master graph invariant (`fid.graph.multiple-masters`).** When a repository-wide master plan
   (`FID-2026-1012-022`) is active, new multi-wave sub-programs must attach to the existing master and express
   their internal wave ordering via `**Depends On:**` edges rather than introducing a competing `**Master FID:**`
   root.
2. **Pre-allocate 300-line ceiling relief to the first wave that touches a ceiling-locked file.** Auditing line
   counts before writing wave specs prevents mid-implementation quality-ratchet deadlocks.
