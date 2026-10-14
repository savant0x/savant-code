<!-- markdownlint-disable MD013 -->

# FID: Wave 1 — Agent-to-agent data flow, compaction fidelity, and EHEL path-resolution hardening

**Filename:** `FID-2026-1013-010-wave1-agent-dataflow-compaction-hardening.md`
**ID:** FID-2026-1013-010
**Severity:** high
**Status:** fixed
**Created:** 2026-10-13 19:20
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022
**Depends On:** FID-2026-1013-009

---

## Summary

Wave 1 of the QOL & Enterprise Hardening Program (`FID-2026-1013-009`) repairs five concrete defects in
agent-to-agent data flow, compaction state preservation, call-graph evidence injection, and EHEL Law 1 path
resolution: (W1-1) `apply_patch` writes (`input.operation.type` + `input.operation.path` ) are currently invisible
to `agents/context-pruner/preserved-state.ts` , `packages/agent-runtime/src/run-agent-step/compaction-plan.ts` ,
and `packages/agent-runtime/src/util/graph-injection.ts` ; (W1-2)
`packages/agent-runtime/src/echo/pre-write-gates-law1.ts` calls `existsSync(targetPath)` on unanchored relative
paths instead of resolving against `projectRoot` , causing false Law 1 blocks when the host process CWD differs
from the workspace root; (W1-3) `packages/agent-runtime/src/evidence/spill-read.ts` re-reads and parses
`.savant/evidence/<runId>.jsonl` from disk on every child spawn without caching by `(shardPath, mtimeMs, size)` ;
(W1-4) `packages/agent-runtime/src/context-compactor/micro-compact.ts` estimates
`tokensSaved = messagesCleared * 200` via a hardcoded constant instead of computing the actual token delta between
the original and compacted tool-result payloads; and (W1-5)
`packages/agent-runtime/src/tools/handlers/tool/set-output.ts` formats `ZodError` instances via raw `${bestError}`
string interpolation and echoes unredacted, uncapped payloads into error messages and logs.

`implementation_started: true`

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** ESLint 9 (`--max-warnings 0`), Prettier
- **Commit/State:** `main` @ `3ee91a35`

## Detailed Description

### Problem

1. **W1-1 — `apply_patch` dropped across compaction and call-graph injection:**
   - `packages/agent-runtime/src/echo/enforcement/helpers.ts:81-94` correctly extracts `apply_patch` targets from
     `input.operation.path` .
   - However, `agents/context-pruner/preserved-state.ts:171-208` (`buildPreservedState`) only switches on
     `write_file` /`propose_write_file` and `str_replace` /`propose_str_replace`, ignoring `apply_patch` .
   - `packages/agent-runtime/src/run-agent-step/compaction-plan.ts:32-55,104-131` (`foldFileOperations`) only
     checks `CREATE_TOOLS` (`write_file`, `propose_write_file` ) and `MODIFY_TOOLS` (`str_replace`,
     `propose_str_replace` ) and reads `record.path` / `record.paths` , missing `apply_patch` 's
     `input.operation.path` and `input.operation.type` (`create_file` vs `update_file` / `delete_file` ).
   - `packages/agent-runtime/src/util/graph-injection.ts:45-60` (`extractChangedPathsFromHistory`) includes
     `toolName !== 'apply_patch'` in its guard, but then checks `'path' in input` on the top-level `input` object
     (`const raw = (input as { path?: unknown }).path`), which is always `undefined` for `apply_patch` because its
     path lives at `input.operation.path` . Consequently, Verifier and Reviewer spawns receive zero call-graph
     reachability evidence for files modified via `apply_patch` .
   - `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:144-149` tracks `fidFilesWritten` only for
     `toolName === 'write_file' || toolName === 'str_replace'` , omitting `apply_patch` .

2. **W1-2 — Law 1 `isNewFile` unanchored path check:**
   - `packages/agent-runtime/src/echo/pre-write-gates-law1.ts:45-94` checks `isNewFile(targetPath)` using
     `existsSync(path)` directly on `targetPath` (and `rawTarget` for terminal mutations). When `targetPath` is
     repo-relative (`src/foo.ts`) and the host process CWD differs from `state.telemetryRootDir` / `projectRoot`
     (e.g., desktop gateway or workspace sub-packages), `existsSync(targetPath)` probes the wrong directory and
     either false-blocks a brand-new file or false-exempts an existing file.

3. **W1-3 — Repeated disk I/O in `loadEvidenceRecords` across parallel subagent spawns:**
   - `packages/agent-runtime/src/evidence/spawn-evidence.ts:62-66` calls `loadEvidenceRecords(projectRoot, runId)`
     for each ancestor and current `runId` on every subagent spawn (`runSingleSubagent` and
     `handleSpawnAgentInline` ).
   - `packages/agent-runtime/src/evidence/spill-read.ts:42-61` reads and JSON-parses every shard file from disk on
     every call. When an orchestrator spawns 4–6 agents in parallel (or chains Detective → Thinker → Forge →
     Verifier → Adversary), the identical `.savant/evidence/<runId>.jsonl` shards are read and parsed repeatedly.

4. **W1-4 — Hardcoded `messagesCleared * 200` token savings in `micro-compact.ts`:**
   - `packages/agent-runtime/src/context-compactor/micro-compact.ts:138-140` calculates
     `const tokensSaved = messagesCleared * 200` regardless of whether the cleared tool outputs held 50 tokens or
     40,000 tokens. That inaccurate figure feeds `agentState.compactionMetrics.tokensSaved`
     (`context-tokens-compaction.ts:116`) and the user-visible `compaction_summary` event.

5. **W1-5 — Unformatted `ZodError` and unredacted payload echo in `set-output.ts`:**
   - `packages/agent-runtime/src/tools/handlers/tool/set-output.ts:56-68` interpolates `${bestError}` directly into
     `errorMessage` and appends `formatValueForError(output as JSONValue)` without redacting secrets
     (`redactSecrets` from `@savant-code/common/util/redact` , Law 12) or formatting `ZodError.issues` into concise
     `path: message` pairs.

### Expected Behavior

1. **W1-1:** `apply_patch` tool calls with `input.operation.path` are tracked across all four surfaces:
   - `agents/context-pruner/preserved-state.ts` (`buildPreservedState`): `apply_patch` with
     `operation.type === 'create_file'` records `normalize(operation.path)` in `createdFiles` ; `update_file` /
     `delete_file` (or default) records `normalize(operation.path)` in `modifiedFiles` (self-contained in
     `preserved-state.ts` for `.toString()` serialization safety).
   - `packages/agent-runtime/src/run-agent-step/compaction-plan.ts` (`foldFileOperations`): extracts `apply_patch`
     `operation.path` into `createdFiles` (when `operation.type === 'create_file'` ) or `modifiedFiles`
     (otherwise).
   - `packages/agent-runtime/src/util/graph-injection.ts` (`extractChangedPathsFromHistory`): extracts
     `input.operation.path` (via `getTargetPath` from `../echo/enforcement/helpers` or direct `operation.path`
     narrowing) so `apply_patch` edits receive full blast-radius and node-edge evidence in Verifier/Reviewer
     spawns.
   - `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` : uses `isWriteTool(toolName)` instead of
     `toolName === 'write_file' || toolName === 'str_replace'` when recording `fidFilesWritten` .
2. **W1-2:** `runLaw1Gate` accepts an optional `projectRoot?: string` (threaded from
   `params.state.telemetryRootDir` in `runPreWriteGates` ), resolves relative `targetPath` / `mutationTargets`
   against `projectRoot` before probing `existsSync` , and canonicalizes against `projectRoot` when comparing
   `filesRead` .
3. **W1-3:** `packages/agent-runtime/src/evidence/spill-read.ts` caches parsed `EvidenceSpillRecord[]` per shard
   path keyed by `(mtimeMs, size)` via `stat` , avoiding redundant file reads and JSON parsing when the shard has
   not grown, and exports `resetEvidenceRecordCache(): void` wired into
   `packages/agent-runtime/test/setup-test-isolation.ts` (`scripts/module-state-check.ts` compliance).
4. **W1-4:** `packages/agent-runtime/src/context-compactor/micro-compact.ts` computes `tokensSaved` from the actual
   token delta (`Math.max(1, countTokensJson(source.content) - countTokensJson(compactedContent))`) when any
   message is cleared, falling back to `0` when `clearSet.size === 0` .
5. **W1-5:** `packages/agent-runtime/src/tools/handlers/tool/set-output.ts` formats `ZodError` issues cleanly
   (`issue.path.join('.') || '<root>': issue.message`) and passes the echoed `formatValueForError(output)` through
   `redactSecrets` (Law 12).
6. **300-line ceiling compliance:** `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` (currently 300
   lines) extracts its post-tool write/mutation bookkeeping block into
   `packages/agent-runtime/src/echo/enforcement/write-bookkeeping-pipeline.ts` so both files remain well below 300
   lines.

### Root Cause

`apply_patch` was introduced with a nested `{ operation: { type, path, diff } }` schema, whereas earlier write
tools (`write_file`, `str_replace` ) used a flat `{ path }` schema. Only
`echo/enforcement/helpers.ts:getTargetPath` was updated for the nested shape; `preserved-state.ts` ,
`compaction-plan.ts` , and `graph-injection.ts` retained flat `input.path` checks. Similarly,
`pre-write-gates-law1.ts` , `spill-read.ts` , `micro-compact.ts` , and `set-output.ts` kept early v1 heuristics
(unanchored `existsSync` , uncached shard reads, `messagesCleared * 200` , and raw `${bestError}` ).

### Evidence

```text
- agents/context-pruner/preserved-state.ts:183-194:
  case 'write_file': case 'propose_write_file': ...
  case 'str_replace': case 'propose_str_replace': ...
  (no 'apply_patch' branch)

- packages/agent-runtime/src/run-agent-step/compaction-plan.ts:32-34:
  const READ_TOOLS = new Set(['read_files', 'read_subtree'])
  const CREATE_TOOLS = new Set(['write_file', 'propose_write_file'])
  const MODIFY_TOOLS = new Set(['str_replace', 'propose_str_replace'])

- packages/agent-runtime/src/util/graph-injection.ts:45-58:
  if (toolName !== 'write_file' && toolName !== 'str_replace' && toolName !== 'apply_patch') continue
  if (input && typeof input === 'object' && 'path' in input) { ... }
  (apply_patch has input.operation.path, never 'path' in input)

- packages/agent-runtime/src/echo/pre-write-gates-law1.ts:87-94:
  function isNewFile(path: string): boolean {
    try { return !existsSync(path) } catch { return false }
  }

- packages/agent-runtime/src/context-compactor/micro-compact.ts:138-140:
  const messagesCleared = originalCount - compacted.length + clearSet.size
  // Rough token estimate: ~4 chars per token
  const tokensSaved = messagesCleared * 200 // ~200 tokens per compacted tool result

- packages/agent-runtime/src/tools/handlers/tool/set-output.ts:59-61:
  const errorMessage = `${prefix}${bestError}\n\nOriginal output value:\n${formatValueForError(output as JSONValue)}`
```

## Impact Assessment

### Affected Components

- `agents/context-pruner/preserved-state.ts`
- `packages/agent-runtime/src/run-agent-step/compaction-plan.ts`
- `packages/agent-runtime/src/util/graph-injection.ts`
- `packages/agent-runtime/src/echo/pre-write-gates-law1.ts`
- `packages/agent-runtime/src/echo/pre-write-gates.ts`
- `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts`
- `packages/agent-runtime/src/echo/enforcement/write-bookkeeping-pipeline.ts` (new ceiling-relief extraction)
- `packages/agent-runtime/src/evidence/spill-read.ts`
- `packages/agent-runtime/src/evidence/spill.ts`
- `packages/agent-runtime/test/setup-test-isolation.ts`
- `packages/agent-runtime/src/context-compactor/micro-compact.ts`
- `packages/agent-runtime/src/tools/handlers/tool/set-output.ts`
- `packages/agent-runtime/src/util/format-value.ts` (redaction before diagnostic truncation)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — `apply_patch` file mutations are lost across compaction and
      Verifier call-graph injection; Law 1 can false-block relative paths when CWD != `projectRoot` .
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **Unify `apply_patch` path extraction across compaction and graph injection (W1-1):**
   - In `agents/context-pruner/preserved-state.ts` (`buildPreservedState`), add a `case 'apply_patch':` branch that
     inspects `asObject(input.operation)` (using the local embeddable-safe `asObject` and `asString` helpers) and
     pushes `normalize(opPath)` into `state.createdFiles` when `op.type === 'create_file'` and into
     `state.modifiedFiles` otherwise.
   - In `packages/agent-runtime/src/run-agent-step/compaction-plan.ts` (`foldFileOperations`), handle
     `call.toolName === 'apply_patch'` by inspecting `call.input.operation` (`type` and `path` ), routing
     `create_file` to `window.createdFiles` and `update_file` /`delete_file` to `window.modifiedFiles` .
   - In `packages/agent-runtime/src/util/graph-injection.ts` (`extractChangedPathsFromHistory`), use
     `getTargetPath` from `../echo/enforcement/helpers` so `write_file` , `str_replace` , and `apply_patch` all
     resolve their target path through one canonical helper.
   - In `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` , replace
     `toolName === 'write_file' || toolName === 'str_replace'` on `fidFilesWritten` with `isWriteTool(toolName)` ,
     and extract the post-tool write bookkeeping block into
     `packages/agent-runtime/src/echo/enforcement/write-bookkeeping-pipeline.ts` to drop `tool-pipeline.ts` well
     below 300 lines.
2. **Anchor Law 1 `isNewFile` to `projectRoot` (W1-2):**
   - In `packages/agent-runtime/src/echo/pre-write-gates-law1.ts` , add optional `projectRoot?: string` to
     `runLaw1Gate` . When `projectRoot` is provided and `targetPath` is relative (`!path.isAbsolute(targetPath)`),
     resolve `path.resolve(projectRoot, targetPath)` before calling `existsSync` in `isNewFile` , while checking
     both raw and `projectRoot` -resolved canonical forms against `filesRead` . Pass
     `projectRoot: params.state.telemetryRootDir` from `runPreWriteGates`
     (`packages/agent-runtime/src/echo/pre-write-gates.ts`).
3. **Cache `loadEvidenceRecords` per shard `(mtimeMs, size)` with test isolation reset (W1-3):**
   - In `packages/agent-runtime/src/evidence/spill-read.ts` , add a bounded module-scope
     `Map<string, { mtimeMs: number; size: number; records: EvidenceSpillRecord[] }>()` (`MAX_CACHED_SHARDS = 64`).
     In `loadEvidenceRecords` , `stat` each shard path; on cache hit with matching `mtimeMs` and `size` , return a
     shallow copy of cached `records` ; otherwise read, parse, and update the cache. Export
     `resetEvidenceRecordCache(): void` , re-export it from `spill.ts` , and call it in
     `packages/agent-runtime/test/setup-test-isolation.ts` (`beforeEach`).
4. **Measure real token delta in `runMicroCompact` (W1-4):**
   - In `packages/agent-runtime/src/context-compactor/micro-compact.ts` , import `countTokensJson` from
     `../util/token-counter` and accumulate the actual token difference
     `Math.max(0, countTokensJson(source.content) - countTokensJson(compactedPlaceholderContent))` across each
     cleared message in `clearSet` (with a floor of `1` per cleared message when `clearSet.size > 0` so
     `tokensSaved > 0` continues to signal that clearing occurred).
5. **Format `ZodError` and redact `set_output` error payloads (W1-5):**
   - In `packages/agent-runtime/src/tools/handlers/tool/set-output.ts` , add a
     `formatZodIssues(error: unknown): string` helper that formats Zod issue arrays as `path: message` list items
     (falling back to `error instanceof Error ? error.message : String(error)` ), and wrap
     `formatValueForError(output as JSONValue)` in `redactSecrets(...)` from `@savant-code/common/util/redact` .

### Steps

1. Extract post-tool write bookkeeping from `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` into
   `packages/agent-runtime/src/echo/enforcement/write-bookkeeping-pipeline.ts` and widen `fidFilesWritten` tracking
   to `isWriteTool(toolName)` .
2. Add `apply_patch` (`input.operation.path` / `input.operation.type` ) support to
   `agents/context-pruner/preserved-state.ts` , `packages/agent-runtime/src/run-agent-step/compaction-plan.ts` ,
   and `packages/agent-runtime/src/util/graph-injection.ts` .
3. Thread `projectRoot` into `runLaw1Gate` (`packages/agent-runtime/src/echo/pre-write-gates-law1.ts` and
   `packages/agent-runtime/src/echo/pre-write-gates.ts` ) so `isNewFile` resolves relative paths against
   `projectRoot` when provided.
4. Add `(mtimeMs, size)` shard caching and `resetEvidenceRecordCache()` to
   `packages/agent-runtime/src/evidence/spill-read.ts` (re-exported in `spill.ts` and called in
   `packages/agent-runtime/test/setup-test-isolation.ts` ).
5. Replace `messagesCleared * 200` in `packages/agent-runtime/src/context-compactor/micro-compact.ts` with real
   `countTokensJson` delta measurement, and harden `packages/agent-runtime/src/tools/handlers/tool/set-output.ts`
   with `formatZodIssues` and `redactSecrets` .
6. Add/extend unit tests in `agents/__tests__/context-pruner-phase1-preserved-state.test.ts` ,
   `packages/agent-runtime/src/__tests__/compaction-file-ledger-wiring.test.ts` ,
   `packages/agent-runtime/src/__tests__/graph-injection.test.ts` ,
   `packages/agent-runtime/src/echo/__tests__/pre-write-gates-apply-patch.test.ts` ,
   `packages/agent-runtime/src/evidence/__tests__/retention.test.ts` ,
   `packages/agent-runtime/src/__tests__/micro-compact.test.ts` , and
   `packages/agent-runtime/src/tools/handlers/tool/__tests__/set-output.test.ts` .

### Verification

- `gate: typecheck agents`
- `gate: typecheck packages/agent-runtime`
- `gate: test agents/__tests__/context-pruner-phase1-preserved-state.test.ts`
- `gate: test packages/agent-runtime/src/__tests__/compaction-file-ledger-wiring.test.ts`
- `gate: test packages/agent-runtime/src/__tests__/graph-injection.test.ts`
- `gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-apply-patch.test.ts`
- `gate: test packages/agent-runtime/src/evidence/__tests__/retention.test.ts`
- `gate: test packages/agent-runtime/src/__tests__/micro-compact.test.ts`
- `gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/set-output.test.ts`
- `gate: quality`

## Verification Gates

- gate: typecheck agents
- gate: typecheck packages/agent-runtime
- gate: test agents/__tests__/context-pruner-phase1-preserved-state.test.ts
- gate: test packages/agent-runtime/src/__tests__/compaction-file-ledger-wiring.test.ts
- gate: test packages/agent-runtime/src/__tests__/graph-injection.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-apply-patch.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/retention.test.ts
- gate: test packages/agent-runtime/src/__tests__/micro-compact.test.ts
- gate: test packages/agent-runtime/src/context-compactor-micro.test.ts
- gate: test packages/agent-runtime/src/run-agent-step/__tests__/context-tokens-compaction-micro-summary.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/set-output.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e97fb0938987db60b3205c78797a2c86e6b6bbca2404db03e942af9e50ee5536
- verified: 2026-10-14T14:14:13.475Z
- typecheck agents: exit 0
- typecheck packages/agent-runtime: exit 0
- test agents/__tests__/context-pruner-phase1-preserved-state.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/compaction-file-ledger-wiring.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/graph-injection.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-apply-patch.test.ts: exit 0
- test packages/agent-runtime/src/evidence/__tests__/retention.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/micro-compact.test.ts: exit 0
- test packages/agent-runtime/src/context-compactor-micro.test.ts: exit 0
- test packages/agent-runtime/src/run-agent-step/__tests__/context-tokens-compaction-micro-summary.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/set-output.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Catalogued five data-flow and compaction defects with exact `file:line` citations:
  1. `agents/context-pruner/preserved-state.ts:171-208` ,
     `packages/agent-runtime/src/run-agent-step/compaction-plan.ts:32-55` , and
     `packages/agent-runtime/src/util/graph-injection.ts:45-60` drop `apply_patch` (`input.operation.path`).
  2. `packages/agent-runtime/src/echo/pre-write-gates-law1.ts:87-94` calls `existsSync(path)` without anchoring
     relative paths to `projectRoot` .
  3. `packages/agent-runtime/src/evidence/spill-read.ts:42-61` re-reads and parses `.savant/evidence/<runId>.jsonl`
     on every child spawn without caching.
  4. `packages/agent-runtime/src/context-compactor/micro-compact.ts:138-140` hardcodes
     `tokensSaved = messagesCleared * 200` .
  5. `packages/agent-runtime/src/tools/handlers/tool/set-output.ts:56-68` formats `ZodError` via `${bestError}` and
     echoes unredacted payloads.
- **GREEN:** Designed self-contained fixes for all five findings, including `tool-pipeline.ts` ceiling extraction
  and `setup-test-isolation.ts` cache reset registration.
- **AUDIT:** Verified that `agents/context-pruner/preserved-state.ts` uses only local embeddable helpers
  (`asObject`, `asString` ), that `scripts/module-state-check.ts` requires any module-level `Map` in
  `packages/agent-runtime` to have a reset function wired in `packages/agent-runtime/test/setup-test-isolation.ts`
  , and that `countTokensJson` in `packages/agent-runtime/src/util/token-counter.ts` is synchronous and pure.
- **ADVERSARIAL:**
  1. *Could caching in `spill-read.ts` return stale records after `retainOriginal` appends a new record within the
     same millisecond (`mtimeMs` unchanged)?* **Addressed:** Keying the cache entry on BOTH `stat.mtimeMs` AND
     `stat.size` guarantees that any append to the JSONL shard (which strictly increases `size` by at least one
     JSON line) invalidates the cache immediately even when `mtimeMs` has coarse filesystem resolution on Windows.
  2. *Could `countTokensJson` in `micro-compact.ts` return `tokensSaved === 0` when a very short tool result is
     replaced with `{ compacted: true, command, exitCode }` , breaking callers that check
     `if (microResult.tokensSaved > 0)` ?* **Addressed:** `context-tokens-compaction.ts:75` checks
     `if (microResult.tokensSaved > 0)` to decide whether to commit `microResult.messages` . When
     `clearSet.size > 0` , clamping the per-pass total to `Math.max(clearSet.size, actualDelta)` (or only replacing
     a tool result when the placeholder is actually smaller than the original) prevents inflating context on tiny
     results AND preserves the `tokensSaved > 0` contract whenever clearing happens. Specifically, if a tool
     result's original token count is already `<= countTokensJson(compactedValue)` , `runMicroCompact` should leave
     that tiny tool result untouched rather than replacing it with a larger placeholder!
- **CHANGE DELTA:** Initial authoring pass + adversarial refinement on `size` cache key and non-inflating
  `micro-compact` guard.

### Missed Questions

1. **Question:** What if a shard file is appended twice within the same Windows filesystem tick (`mtimeMs`
   identical) before `loadEvidenceRecords` is called?
   **Decision:** Key the shard cache entry in `spill-read.ts` on both `stat.mtimeMs` and `stat.size` (and
   invalidate on write in `spill.ts` if desired). Because `spill.ts` is append-only (`appendFile`), any new record
   strictly increases `stat.size` , making `(mtimeMs, size)` 100% collision-free across same-tick appends.
2. **Question:** What happens in `runMicroCompact` when a tool result is smaller than its `[compacted]` /
   `{ compacted: true, command, exitCode }` placeholder?
   **Decision:** Skip clearing any tool result whose token count is less than or equal to the placeholder's token
   count. That guarantees `tokensSaved` is strictly positive whenever a message is cleared and prevents
   micro-compaction from ever increasing token usage on tiny tool results.
3. **Question:** Does adding a module-scope `Map` in `packages/agent-runtime/src/evidence/spill-read.ts` require
   registration in `packages/agent-runtime/test/setup-test-isolation.ts` ?
   **Decision:** Yes (`FID-2026-1007-002` / `scripts/module-state-check.ts` ). Export `resetEvidenceRecordCache()`
   from `spill-read.ts` (and `spill.ts` ) and invoke it inside `beforeEach` in
   `packages/agent-runtime/test/setup-test-isolation.ts` .

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree on `main` @ `3ee91a35` (local wave 1 implementation)
- [x] **File:line ranges:**
  - `packages/agent-runtime/src/echo/enforcement/write-bookkeeping-pipeline.ts:1-80` (extracted post-tool write/mutation bookkeeping)
  - `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:1-225` (consumes `recordAfterToolMutationBookkeeping` and widens `fidFilesWritten` to `isWriteTool`)
  - `agents/context-pruner/preserved-state.ts:190-206` (`apply_patch` `operation.path` / `operation.type` extraction)
  - `packages/agent-runtime/src/run-agent-step/compaction-plan.ts:95-115` (`apply_patch` folding in `foldFileOperations`)
  - `packages/agent-runtime/src/util/graph-injection.ts:45-62` (`getTargetPath` extraction for `apply_patch` in `extractChangedPathsFromHistory`)
  - `packages/agent-runtime/src/echo/pre-write-gates-law1.ts:35-125` and `packages/agent-runtime/src/echo/pre-write-gates.ts:140-150` (`projectRoot`-anchored `runLaw1Gate`)
  - `packages/agent-runtime/src/evidence/spill-read.ts:15-105`, `packages/agent-runtime/src/evidence/spill.ts:160-170`, `packages/agent-runtime/test/setup-test-isolation.ts:24-65` (`(mtimeMs, size)` shard cache + `resetEvidenceRecordCache`)
  - `packages/agent-runtime/src/context-compactor/micro-compact.ts:105-165` (`countTokensJson` delta measurement + tiny-result skip)
  - `packages/agent-runtime/src/tools/handlers/tool/set-output.ts:45-120` (`formatZodIssues`, `data !== undefined` fallback guard, and `redactSecrets`)
- [x] **Gate output:** The original 10 gates passed; Loop 5 expands the contract
      to 12 gates with both micro-compaction consumer suites before closure.
- [x] **Reproducibility:** Run `bun run fid:verify dev/fids/FID-2026-1013-010-wave1-agent-dataflow-compaction-hardening.md`.
- [x] **Step statuses:**
  - Step 1: [COMPLETED] Extracted `write-bookkeeping-pipeline.ts` and widened `fidFilesWritten` to `isWriteTool(toolName)`.
  - Step 2: [COMPLETED] Added `apply_patch` (`input.operation.path` / `input.operation.type`) tracking in `preserved-state.ts`, `compaction-plan.ts`, and `graph-injection.ts`.
  - Step 3: [COMPLETED] Threaded `projectRoot` into `runLaw1Gate` (`pre-write-gates-law1.ts` and `pre-write-gates.ts`).
  - Step 4: [COMPLETED] Added `(mtimeMs, size)` shard caching and `resetEvidenceRecordCache()` in `spill-read.ts`, `spill.ts`, and `setup-test-isolation.ts`.
  - Step 5: [COMPLETED] Replaced `messagesCleared * 200` in `micro-compact.ts` with real `countTokensJson` delta measurement and hardened `set-output.ts` with `formatZodIssues` and `redactSecrets`.
  - Step 6: [COMPLETED] Added/extended unit tests across all 7 declared test files.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and were read 0-EOF:
      `agents/context-pruner/preserved-state.ts:1-299` ,
      `packages/agent-runtime/src/run-agent-step/compaction-plan.ts:1-147` ,
      `packages/agent-runtime/src/util/graph-injection.ts:1-216` ,
      `packages/agent-runtime/src/echo/pre-write-gates-law1.ts:1-126` ,
      `packages/agent-runtime/src/echo/pre-write-gates.ts:1-283` ,
      `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:1-225` ,
      `packages/agent-runtime/src/echo/enforcement/write-bookkeeping-pipeline.ts:1-80` ,
      `packages/agent-runtime/src/evidence/spill-read.ts:1-147` ,
      `packages/agent-runtime/src/context-compactor/micro-compact.ts:1-165` ,
      `packages/agent-runtime/src/tools/handlers/tool/set-output.ts:1-125` .
- [x] Verified `packages/agent-runtime/test/setup-test-isolation.ts:1-83` and `bun run scripts/module-state-check.ts` (`PASS`).
- [x] Status updated to `fixed` with `implementation_started: true` and receipt stamped via `bun run fid:verify --write`.

### Loop 2 — Independent audit and self-correction

- **RED:** Checked whether `agents/context-pruner/summarize-tool-call.ts` also inspects write tool calls when
  generating human-readable turn summaries during compaction.
- **GREEN:** Inspected `agents/context-pruner/preserved-state.ts` and
  `packages/agent-runtime/src/run-agent-step/compaction-plan.ts` : `preserved-state.ts` is the structured state
  extractor and `compaction-plan.ts` is the runtime cumulative file ledger (`CompactionFileLedger`); together with
  `graph-injection.ts` and `tool-pipeline.ts` , they form the complete set of machine-state consumers of write-tool
  paths.
- **AUDIT:** Verified that `packages/agent-runtime/src/echo/pre-write-gates-law2.ts` already resolves relative
  paths against `scopePath` / `process.cwd()` , whereas `pre-write-gates-law1.ts:88` called bare `existsSync(path)`
  . Anchoring `isNewFile` and `filesRead` lookup to `projectRoot ?? process.cwd()` closes the gap without breaking
  existing unit tests that pass no `projectRoot` .
- **ADVERSARIAL:** Could `set-output.ts` redaction alter `agentState.output` itself? **Refuted:** Redaction is
  applied only to the error diagnostic string (`formatValueForError(output)`) when validation fails; valid
  `agentState.output` is stored unaltered for structured agent handoff.
- **CHANGE DELTA:** ~5% clarification on `projectRoot ?? process.cwd()` fallback and `set-output.ts` redaction boundary.

### Loop 3 — Final convergence

- **RED:** Checked all 6 steps and verification gates for completeness and 300-line ceiling safety.
- **GREEN:** No further modifications needed.
- **AUDIT:** Confirmed all required FID sections, strict-mode `### Missed Questions` (3 questions + decisions),
  zero placeholder tokens, and standalone `implementation_started: false` .
- **ADVERSARIAL:** Verified that every touched workspace (`agents`, `packages/agent-runtime` ) has a declared
  `typecheck` gate and test coverage in `### Verification` .
- **CHANGE DELTA:** 0% — converged.

## Resolution

### Loop 4 — Closure security review (2026-10-14)

- **RED:** The failed-output preview is redacted, but `formattedIssues` and the
  `topLevelError` / `dataFieldError` log fields still carry unsanitized schema
  diagnostics. A custom validator can include a credential in its issue message.
  Redacting only after truncation can also expose a credential prefix at the cap.
- **GREEN:** Extend the existing `formatValueForError` helper with an optional
  text redactor applied before truncation. Route preview, selected issue text,
  and both logged errors through that bounded redacted formatter. Valid structured
  handoff output remains unchanged. Add a regression using credential-bearing
  custom validation messages, oversized diagnostics, and a cap-boundary secret.
- **AUDIT plan:** Reproduce the leak before changing production code; then run
  the owned handler suite, its declared runtime typecheck and all Wave 1 gates.
- **Adversarial review:** Redacting only the preview does not protect logs or
  error messages. One formatter owns order/capping for all diagnostic surfaces;
  no raw exception object is logged and no valid handoff payload is transformed.
- **Convergence:** The correction completes W1-5 under the existing level-3
  authority and adds no API or source surface beyond this declared utility seam.
- **Implementation audit:** The new tests reproduced both secret leakage and
  cap-boundary leakage before the fix (3 PASS / 2 FAIL), then passed 5/5.
  `formatValueForError` applies the optional redactor before truncation; handler
  diagnostics and both logged attempts use it. Valid output remains unchanged.

### Loop 5 — Full-suite micro-compaction consumer contract (2026-10-14)

- **RED:** The full root suite found four consumer-test failures in
  `context-compactor-micro.test.ts` and `context-tokens-compaction-micro-summary.test.ts`.
  Their oldest result has no stdout and is smaller than the new placeholder;
  replacing it would grow context. The summary pin also hardcodes the removed
  200-token estimate. Neither consumer suite was declared on this FID.
- **GREEN:** Give the clearing fixtures actual large stdout. Keep all off-switch,
  pressure-floor, exit-code, deduplication and subagent assertions. Assert the
  emitted token count against the before/after content delta, rather than 200.
  Add both consumer suites to the verification contract and scope targets.
- **AUDIT plan:** Re-run both failures before fixture edits, then all micro and
  summary tests and the full runtime suite; retain the tiny-result preservation pin.
- **Adversarial review:** This is not a weaker clearing assertion: the old fixture
  demanded context inflation. The large-result fixture must still clear exactly
  one message and emit exactly one truthful summary while retaining exit status.
- **Convergence:** The caller contract is actual size reduction; align tests to
  that contract without reverting W1-4 or inventing saved tokens.
- **Implementation audit:** Both consumer suites reproduced 4 failures before
  fixture alignment. Consumer and dedicated tiny-result suites now pass 11/11;
  assertions still require exactly one clear, preserved exit code, and the
  correct before/after token delta.

**Fixed (`Status: fixed`) — all 5 Wave 1 findings (W1-1 through W1-5) implemented and verified:**

1. **W1-1 (`apply_patch` tracking):** `preserved-state.ts`, `compaction-plan.ts`, `graph-injection.ts`, and `tool-pipeline.ts` now extract `input.operation.path` and `input.operation.type` (`create_file` vs `update_file` / `delete_file`), ensuring `apply_patch` mutations survive context compaction and feed call-graph blast-radius evidence into Verifier/Reviewer spawns.
2. **W1-2 (`projectRoot`-anchored Law 1):** `runLaw1Gate` in `pre-write-gates-law1.ts` resolves relative `targetPath` and `mutationTargets` against `projectRoot` (`state.telemetryRootDir`) before probing `existsSync` or matching `filesRead`.
3. **W1-3 (`(mtimeMs, size)` shard caching):** `loadEvidenceRecords` in `spill-read.ts` caches parsed `EvidenceSpillRecord[]` per shard keyed by `(mtimeMs, size)` (capped at 64 shards) and exports `resetEvidenceRecordCache()` wired into `packages/agent-runtime/test/setup-test-isolation.ts`.
4. **W1-4 (`runMicroCompact` real token delta):** `micro-compact.ts` computes actual token savings via `countTokensJson` and skips replacing tiny tool results whose token count is already `<=` the placeholder.
5. **W1-5 (`set_output` diagnostics & redaction):** `set-output.ts` formats `ZodError` issues cleanly as `path: message`, avoids false `data`-field error selection when `data === undefined`, and redacts secrets via `redactSecrets` before echoing failed payloads into tool results or logs.

- **Parent Coordinator:** `FID-2026-1013-009`
- **Findings Owned:** W1-1, W1-2, W1-3, W1-4, W1-5

## Lessons Learned

1. **When adding a tool with a nested path schema (`apply_patch` → `input.operation.path` ), audit every history
   scanner, not just the pre-write gate.** Compaction state (`preserved-state.ts`, `compaction-plan.ts` ) and
   call-graph evidence injection (`graph-injection.ts`) scan `messageHistory` independently of EHEL's pre-write
   gate.
2. **Never replace a tiny tool output with a larger compaction placeholder.** Measuring the real token delta in
   `runMicroCompact` both fixes telemetry accuracy and prevents micro-compaction from enlarging small tool results.
