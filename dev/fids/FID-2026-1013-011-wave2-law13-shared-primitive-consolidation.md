<!-- markdownlint-disable MD013 -->

# FID: Wave 2 — Law 13 shared-primitive consolidation and utility deduplication

**Filename:** `FID-2026-1013-011-wave2-law13-shared-primitive-consolidation.md`
**ID:** FID-2026-1013-011
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-13 19:25
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022
**Depends On:** FID-2026-1013-009, FID-2026-1013-010

---

## Summary

Wave 2 of the QOL & Enterprise Hardening Program (`FID-2026-1013-009`) eliminates seven classes of duplicated
utility primitives across `common` , `cli` , `desktop` , `packages/agent-runtime` , and `packages/knowledge-graph`
under ECHO Law 13 ("one function, one truth") and registers the new canonical owners in
`scripts/eslint-rules/shared-primitives.json` so `no-duplicate-shared-primitive` prevents future copy-paste drift
mechanically: (W2-1) Title-Case `toolDisplayName` duplicated across 3 CLI/Desktop files (plus `getToolDisplayInfo`
in `savant-code-client.ts` ) and naming collision with sentence-case `sidebarToolDisplayName` in
`right-sidebar-format.ts` ; (W2-2) `truncateSingleLine` duplicated across 4 CLI/Desktop files; (W2-3)
`renderToolInput` and `renderToolOutput` duplicated verbatim between `/copy` (`copy-conversation-render.ts`) and
`/export` (`export-conversation/format.ts`); (W2-4) `traceRoundedRect` duplicated verbatim between Desktop office
and stage nameplates; (W2-5) `asPositiveInt` and `asBoolean` duplicated with divergent coercion semantics between
CLI `sequential-thinking.tsx` and Desktop `thinking-parse.ts` ; (W2-6) `getRuntimeRequire` and
`resolveBunSqliteDatabaseModule` duplicated across `packages/knowledge-graph` , `packages/agent-runtime`
(`sqlite-adapter.ts` and `docset-search.ts` ), and `packages/database` ; and (W2-7)
`scripts/eslint-rules/shared-primitives.json` registration of the consolidated primitives. No source code is
modified by this pre-implementation record.

`implementation_started: true`

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** ESLint 9 (`--max-warnings 0`), Prettier
- **Commit/State:** `main` @ `3ee91a35`

## Detailed Description

### Problem

1. **W2-1 — `toolDisplayName` duplicated across 3 files + 1 variant in `right-sidebar-format.ts`:**
   - `cli/src/commands/copy-conversation-render.ts:12-15` , `cli/src/commands/export-conversation/format.ts:31-34`
     , and `desktop/src/components/chat/tool-display.ts:11-19` each declare an identical Title-Case
     `toolDisplayName(toolName: string): string` (`list_directory` → `'List Directories'` , otherwise snake_case
     words capitalized).
   - `cli/src/utils/savant-code-client.ts:116-137` (`getToolDisplayInfo`) implements the same Title-Case logic
     inline (plus MCP `__` prefix stripping).
   - `cli/src/components/right-sidebar-format.ts:183-196` declares a different function under the same name
     `toolDisplayName` (sentence-case for the CLI sidebar timeline, pinned by `FID-2026-1010-005` ).

2. **W2-2 — `truncateSingleLine` duplicated across 4 files:**
   - `cli/src/components/tools/add-message.tsx:14-18` (cap 160),
     `cli/src/components/tools/sequential-thinking.tsx:41-45` (cap 160),
     `cli/src/components/tools/set-output.tsx:31-35` (cap `SUMMARY_MAX_LENGTH` ), and
     `desktop/src/components/chat/tool-display.ts:48-52` (cap 120) each declare
     `function truncateSingleLine(value: string)` with identical whitespace-collapsing and `…` suffix logic.

3. **W2-3 — `renderToolInput` and `renderToolOutput` duplicated in CLI `/copy` and `/export`:**
   - `cli/src/commands/copy-conversation-render.ts:63-98` and
     `cli/src/commands/export-conversation/format.ts:44-77` contain byte-for-byte identical implementations of
     `renderToolInput(input: unknown): string` and
     `renderToolOutput(output: string): { body: string; lang: string }` .

4. **W2-4 — `traceRoundedRect` duplicated across Desktop 3D floor modules:**
   - `desktop/src/floor/office/nameplate-draw.ts:81-95` and `desktop/src/floor/stage/nameplate.ts:59-73` contain
     byte-for-byte identical 2D canvas path helpers `traceRoundedRect(ctx, x, y, w, h, r)` .

5. **W2-5 — Divergent `asPositiveInt` and `asBoolean` in `sequentialthinking` parsers:**
   - `cli/src/components/tools/sequential-thinking.tsx:20-39` coerces both numeric and stringified positive
     integers (`"3"` → `3` ) and booleans (`"true"` → `true` , `"false"` → `false` ), because streaming/print-mode
     tool inputs can arrive with stringified primitives.
   - `desktop/src/lib/thinking-parse.ts:34-41` only accepts `typeof value === 'number'` and `value === true` ,
     silently dropping stringified `thoughtNumber` , `totalThoughts` , `isRevision` , and `revisesThought` on
     Desktop!

6. **W2-6 — `getRuntimeRequire` + `resolveBunSqliteDatabaseModule` duplicated across 4 modules:**
   - `packages/knowledge-graph/src/store.ts:20-43` ,
     `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts:34-70` ,
     `packages/agent-runtime/src/llm-api/docset-search.ts:47-72` , and `packages/database/src/index.ts:18-45` each
     define `getRuntimeRequire()` and `resolveBunSqliteDatabaseModule` (`resolveBunSqlite`).
   - Note: `packages/database/package.json` intentionally has zero workspace dependencies
     (`packages/database/src/index.ts:13-16`), whereas `packages/knowledge-graph` and `packages/agent-runtime` both
     depend on `@savant-code/common` .

7. **W2-7 — `scripts/eslint-rules/shared-primitives.json` coverage:**
   - Without registering the newly consolidated helpers in `scripts/eslint-rules/shared-primitives.json` , future
     changes can re-introduce local copies without tripping `savant/no-duplicate-shared-primitive` .

### Expected Behavior

1. **Canonical `@savant-code/common/util/tool-display` module (W2-1, W2-2, W2-5):**
   - Exports `toolDisplayName(toolName: string): string` (Title-Case with `list_directory` override and MCP `__`
     namespace stripping), `truncateSingleLine(value: string, maxLength = 160): string` ,
     `asPositiveInt(value: unknown): number | undefined` , and `asBoolean(value: unknown): boolean | undefined` .
   - `cli/src/commands/copy-conversation-render.ts` , `cli/src/commands/export-conversation/format.ts` ,
     `desktop/src/components/chat/tool-display.ts` , `cli/src/utils/savant-code-client.ts` ,
     `cli/src/components/tools/add-message.tsx` , `cli/src/components/tools/sequential-thinking.tsx` ,
     `cli/src/components/tools/set-output.tsx` , and `desktop/src/lib/thinking-parse.ts` consume these canonical
     exports (re-exporting where existing tests import from the consumer module).
   - `cli/src/components/right-sidebar-format.ts:183` renames its distinct sentence-case helper to
     `sidebarToolDisplayName` (with a deprecated or test-compatible alias if required, or updated in
     `right-sidebar-sections.tsx` and `right-sidebar-format.test.ts` so `toolDisplayName` can be registered in
     `shared-primitives.json` with zero ambiguity).
2. **Canonical `renderToolInput` and `renderToolOutput` (W2-3):**
   - Exported from `@savant-code/common/util/tool-display` (or `cli/src/commands/copy-conversation-render.ts`
     re-exported into `export-conversation/format.ts` ) and consumed by both `/copy` and `/export` . Placing
     `renderToolInput` and `renderToolOutput` in `common/src/util/tool-display.ts` makes them available to both CLI
     and Desktop and registers them cleanly in `shared-primitives.json` .
3. **Canonical `traceRoundedRect` (W2-4):**
   - `desktop/src/floor/office/nameplate-draw.ts` exports `traceRoundedRect` as the canonical owner, and
     `desktop/src/floor/stage/nameplate.ts` imports it from `../office/nameplate-draw` (registered in
     `shared-primitives.json` ).
4. **Canonical `@savant-code/common/util/bun-sqlite` loader (W2-6):**
   - `common/src/util/bun-sqlite.ts` exports `getRuntimeRequire()` and
     `resolveBunSqliteModule(options?: { requireFn?: ((id: string) => unknown) | null; consumerName?: string })` .
   - `packages/knowledge-graph/src/store.ts` , `packages/agent-runtime/src/llm-api/docset-search.ts` , and
     `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts` delegate to
     `@savant-code/common/util/bun-sqlite` (with `sqlite-adapter.ts` wrapping any thrown error in
     `StructuredDbError(DbErrorCode.CONNECTION_FAILED, error.message)` to preserve its exact error-code contract).
   - `packages/database/src/index.ts` remains zero-dependency by design (`packages/database/package.json` has no
     `dependencies` ) and is listed in `shared-primitives.json` `allowedFiles` with its zero-dependency rationale
     documented.
5. **ESLint `shared-primitives.json` registration (W2-7):**
   - `scripts/eslint-rules/shared-primitives.json` registers `toolDisplayName` , `truncateSingleLine` ,
     `renderToolInput` , `renderToolOutput` , `traceRoundedRect` , and ` getRuntimeRequire` , and
     `bun x eslint . --max-warnings 0` passes with 0 errors and 0 warnings.

### Root Cause

Helpers created during rapid UI and tool-handler sprints (`copy-conversation`, `export-conversation` , desktop
`tool-display` , `thinking-parse` , 3D floor `nameplate` passes, and `docset-search` ) were copied across workspace
boundaries before `scripts/eslint-rules/shared-primitives.json` (`FID-2026-0928-009`) existed, and were not yet
swept into the registry.

### Evidence

```text
- Duplicate toolDisplayName:
  1. cli/src/commands/copy-conversation-render.ts:12-15
  2. cli/src/commands/export-conversation/format.ts:31-34
  3. desktop/src/components/chat/tool-display.ts:11-19
  (plus sentence-case variant in cli/src/components/right-sidebar-format.ts:183-196)

- Duplicate truncateSingleLine:
  1. cli/src/components/tools/add-message.tsx:14-18
  2. cli/src/components/tools/sequential-thinking.tsx:41-45
  3. cli/src/components/tools/set-output.tsx:31-35
  4. desktop/src/components/chat/tool-display.ts:48-52

- Duplicate renderToolInput / renderToolOutput:
  1. cli/src/commands/copy-conversation-render.ts:63-98
  2. cli/src/commands/export-conversation/format.ts:44-77

- Duplicate traceRoundedRect:
  1. desktop/src/floor/office/nameplate-draw.ts:81-95
  2. desktop/src/floor/stage/nameplate.ts:59-73

- Divergent asPositiveInt / asBoolean:
  1. cli/src/components/tools/sequential-thinking.tsx:20-39 (coerces "3" -> 3, "true" -> true)
  2. desktop/src/lib/thinking-parse.ts:34-41 (rejects stringified numbers/booleans)

- Duplicate getRuntimeRequire / resolveBunSqliteDatabaseModule:
  1. packages/database/src/index.ts:18-45 (zero-dep package)
  2. packages/knowledge-graph/src/store.ts:20-43
  3. packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts:34-70
  4. packages/agent-runtime/src/llm-api/docset-search.ts:47-72
```

## Impact Assessment

### Affected Components

- `common/src/util/tool-display.ts` (new canonical utility module)
- `common/src/util/bun-sqlite.ts` (new canonical `bun:sqlite` lazy loader)
- `common/src/util/__tests__/tool-display.test.ts` (new unit test suite)
- `common/src/util/__tests__/bun-sqlite.test.ts` (new unit test suite)
- `cli/src/commands/copy-conversation-render.ts`
- `cli/src/commands/export-conversation/format.ts`
- `cli/src/components/right-sidebar-format.ts`
- `cli/src/components/right-sidebar-sections.tsx`
- `cli/src/components/__tests__/right-sidebar-format.test.ts`
- `cli/src/components/tools/add-message.tsx`
- `cli/src/components/tools/sequential-thinking.tsx`
- `cli/src/components/tools/set-output.tsx`
- `cli/src/utils/savant-code-client.ts`
- `desktop/src/components/chat/tool-display.ts`
- `desktop/src/lib/thinking-parse.ts`
- `desktop/src/floor/office/nameplate-draw.ts`
- `desktop/src/floor/stage/nameplate.ts`
- `packages/knowledge-graph/src/store.ts`
- `packages/agent-runtime/src/llm-api/docset-search.ts`
- `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`
- `scripts/eslint-rules/shared-primitives.json`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — Desktop `thinking-parse.ts` currently drops stringified
      `thoughtNumber` /`isRevision` fields that CLI handles, and duplicated helpers across 16 files violate Law 13.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. **Create `common/src/util/tool-display.ts` (W2-1, W2-2, W2-3, W2-5):**
   - Implement and export:
     - `toolDisplayName(toolName: string): string` (handles `list_directory` → `'List Directories'` and strips MCP
       `server__tool` prefixes before Title-Casing).
     - `truncateSingleLine(value: string, maxLength = 160): string` (collapses whitespace, trims, and truncates to
       `maxLength - 1` + `'…'` when `line.length > maxLength` ).
     - `renderToolInput(input: unknown): string` and `renderToolOutput(output: string): { body: string; lang: string }`.
     - `asPositiveInt(value: unknown): number | undefined` and `asBoolean(value: unknown): boolean | undefined`
       (with string-coercion support so Desktop `thinking-parse.ts` gains full parity with CLI
       `sequential-thinking.tsx` ).
2. **Wire CLI & Desktop consumers to `common/src/util/tool-display.ts`:**
   - Replace local declarations in `cli/src/commands/copy-conversation-render.ts` ,
     `cli/src/commands/export-conversation/format.ts` , `cli/src/components/tools/add-message.tsx` ,
     `cli/src/components/tools/sequential-thinking.tsx` , `cli/src/components/tools/set-output.tsx` (passing
     `SUMMARY_MAX_LENGTH` ), `cli/src/utils/savant-code-client.ts` (`getToolDisplayInfo` delegates
     `name: toolDisplayName(toolName)` ), `desktop/src/components/chat/tool-display.ts` (passing `120` to
     `truncateSingleLine` ), and `desktop/src/lib/thinking-parse.ts` (using `asPositiveInt(input.thoughtNumber)`
     and `asBoolean(input.isRevision) === true` ).
   - Rename the sentence-case sidebar helper in `cli/src/components/right-sidebar-format.ts` to
     `sidebarToolDisplayName` and update its 2 callers (`cli/src/components/right-sidebar-sections.tsx` and
     `cli/src/components/__tests__/right-sidebar-format.test.ts` ).
3. **Unify `traceRoundedRect` in Desktop 3D floor (W2-4):**
   - Export `traceRoundedRect` from `desktop/src/floor/office/nameplate-draw.ts` and import it in
     `desktop/src/floor/stage/nameplate.ts` .
4. **Create `common/src/util/bun-sqlite.ts` and wire SQLite consumers (W2-6):**
   - Implement `getRuntimeRequire()` and `resolveBunSqliteDatabaseModule(requireFn, packageLabel)` in
     `common/src/util/bun-sqlite.ts` .
   - Wire `packages/knowledge-graph/src/store.ts` , `packages/agent-runtime/src/llm-api/docset-search.ts` , and
     `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts` to import from
     `@savant-code/common/util/bun-sqlite` (preserving `StructuredDbError` in `sqlite-adapter.ts` and exact error
     messages for existing unit tests).
   - Keep `packages/database/src/index.ts` dependency-free (`packages/database/package.json` has zero dependencies)
     and add `"packages/database/src/index.ts"` to `allowedFiles` in `scripts/eslint-rules/shared-primitives.json`
     .
5. **Update `scripts/eslint-rules/shared-primitives.json` (W2-7):**
   - Register `toolDisplayName` , `truncateSingleLine` , `renderToolInput` , `renderToolOutput` ,
     `traceRoundedRect` , and `getRuntimeRequire` with their canonical owner paths.

### Steps

1. Create `common/src/util/tool-display.ts` and `common/src/util/bun-sqlite.ts` with unit tests in
   `common/src/util/__tests__/tool-display.test.ts` and `common/src/util/__tests__/bun-sqlite.test.ts` .
2. Update `cli/src/commands/copy-conversation-render.ts` , `cli/src/commands/export-conversation/format.ts` ,
   `cli/src/utils/savant-code-client.ts` , `cli/src/components/tools/add-message.tsx` ,
   `cli/src/components/tools/sequential-thinking.tsx` , `cli/src/components/tools/set-output.tsx` ,
   `cli/src/components/right-sidebar-format.ts` , `cli/src/components/right-sidebar-sections.tsx` , and
   `cli/src/components/__tests__/right-sidebar-format.test.ts` to consume `@savant-code/common/util/tool-display` .
3. Update `desktop/src/components/chat/tool-display.ts` and `desktop/src/lib/thinking-parse.ts` to consume
   `@savant-code/common/util/tool-display` , and export `traceRoundedRect` from
   `desktop/src/floor/office/nameplate-draw.ts` for `desktop/src/floor/stage/nameplate.ts` .
4. Update `packages/knowledge-graph/src/store.ts` , `packages/agent-runtime/src/llm-api/docset-search.ts` , and
   `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts` to consume
   `@savant-code/common/util/bun-sqlite` .
5. Register `toolDisplayName` , `truncateSingleLine` , `renderToolInput` , `renderToolOutput` , `traceRoundedRect`
   , and `getRuntimeRequire` in `scripts/eslint-rules/shared-primitives.json` (with
   `packages/database/src/index.ts` in `allowedFiles` ) and verify with `bun x eslint . --max-warnings 0` .

### Verification

- `gate: typecheck common`
- `gate: typecheck cli`
- `gate: typecheck desktop`
- `gate: typecheck packages/agent-runtime`
- `gate: typecheck packages/knowledge-graph`
- `gate: probe scripts/scripts-typecheck-check.ts`
- `gate: test common/src/util/__tests__/tool-display.test.ts`
- `gate: test common/src/util/__tests__/bun-sqlite.test.ts`
- `gate: test cli/src/components/__tests__/right-sidebar-format.test.ts`
- `gate: test desktop/src/components/chat/__tests__/tool-display.test.ts`
- `gate: test desktop/src/lib/__tests__/thinking-parse.test.ts`
- `gate: test desktop/src/floor/office/__tests__/nameplate-draw.test.ts`
- `gate: test desktop/src/floor/__tests__/nameplate.test.ts`
- `gate: test packages/agent-runtime/src/llm-api/__tests__/docset-search.test.ts`
- `gate: test packages/agent-runtime/src/tools/handlers/tool/database/__tests__/sqlite-adapter.test.ts`
- `gate: quality`

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck desktop
- gate: typecheck packages/agent-runtime
- gate: typecheck packages/knowledge-graph
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test common/src/util/__tests__/tool-display.test.ts
- gate: test common/src/util/__tests__/bun-sqlite.test.ts
- gate: test cli/src/components/__tests__/right-sidebar-format.test.ts
- gate: test desktop/src/components/chat/__tests__/tool-display.test.ts
- gate: test desktop/src/lib/__tests__/thinking-parse.test.ts
- gate: test desktop/src/floor/office/__tests__/nameplate-draw.test.ts
- gate: test desktop/src/floor/__tests__/nameplate.test.ts
- gate: test packages/agent-runtime/src/llm-api/__tests__/docset-search.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/tool/database/__tests__/sqlite-adapter.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:89d24e0a5a64c0f4546c4045f2df0e486b75883a82519ad5bb1137ae69f8751d
- verified: 2026-10-14T14:22:19.544Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck desktop: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck packages/knowledge-graph: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- test common/src/util/__tests__/tool-display.test.ts: exit 0
- test common/src/util/__tests__/bun-sqlite.test.ts: exit 0
- test cli/src/components/__tests__/right-sidebar-format.test.ts: exit 0
- test desktop/src/components/chat/__tests__/tool-display.test.ts: exit 0
- test desktop/src/lib/__tests__/thinking-parse.test.ts: exit 0
- test desktop/src/floor/office/__tests__/nameplate-draw.test.ts: exit 0
- test desktop/src/floor/__tests__/nameplate.test.ts: exit 0
- test packages/agent-runtime/src/llm-api/__tests__/docset-search.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/database/__tests__/sqlite-adapter.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Identified three subtle compatibility constraints when consolidating these 7 primitive families:
  1. `packages/database/package.json` has zero `dependencies` (`packages/database/src/index.ts:13-16` explicitly
     notes it must remain zero-dependency). Importing `@savant-code/common` in `packages/database/src/index.ts`
     would fail `bun run deps:undeclared` .
  2. `cli/src/components/right-sidebar-format.ts:183` defines a *sentence-case* function named `toolDisplayName`
     (`FID-2026-1010-005`), whereas the 3 other `toolDisplayName` functions are *Title-Case*. Registering
     `toolDisplayName` in `shared-primitives.json` without renaming `right-sidebar-format.ts` 's sentence-case
     helper would cause ESLint `savant/no-duplicate-shared-primitive` to error on `right-sidebar-format.ts` .
  3. `desktop/src/components/chat/tool-display.ts:46` uses a 120-character cap for `truncateSingleLine` , whereas
     CLI tools (`add-message.tsx:12`, `sequential-thinking.tsx:14` ) use 160 and `set-output.tsx:31` uses
     `SUMMARY_MAX_LENGTH` .
- **GREEN:**
  1. Kept `packages/database/src/index.ts` zero-dependency and added it to `allowedFiles` in
     `scripts/eslint-rules/shared-primitives.json` , while consolidating the other 3 `bun:sqlite` loaders
     (`knowledge-graph`, `docset-search` , `sqlite-adapter` ) into `@savant-code/common/util/bun-sqlite` .
  2. Renamed the sentence-case function in `cli/src/components/right-sidebar-format.ts` to `sidebarToolDisplayName`
     (updating `right-sidebar-sections.tsx` and `right-sidebar-format.test.ts` ), leaving `toolDisplayName`
     unambiguously Title-Case across the entire repo.
  3. Parameterized `truncateSingleLine(value: string, maxLength = 160): string` in
     `common/src/util/tool-display.ts` so callers with custom caps (`120` in Desktop `tool-display.ts` ,
     `SUMMARY_MAX_LENGTH` in `set-output.tsx` ) pass their exact cap while sharing one implementation.
- **AUDIT:** Checked `common/package.json:25-30` exports map: `"./*"` maps to `"./src/*.ts"` , so
  `@savant-code/common/util/tool-display` and `@savant-code/common/util/bun-sqlite` resolve automatically in `cli`
  , `desktop` , `packages/agent-runtime` , and `packages/knowledge-graph` without editing `package.json` .
- **ADVERSARIAL:** Do existing tests in `packages/agent-runtime/src/llm-api/__tests__/docset-search.test.ts` or
  `sqlite-adapter.test.ts` assert specific error substrings when `resolveBunSqlite(null)` is called? Checked
  `docset-search.ts:53-68` (`"Docset search requires the Bun runtime: bun:sqlite is only available under Bun."`)
  and `sqlite-adapter.ts:50-65` (`"The database tools require the Bun runtime: bun:sqlite is only available under
  Bun..."`). Passing the caller prefix/suffix into `resolveBunSqliteDatabaseModule` in
  `common/src/util/bun-sqlite.ts` preserves 100% of existing error messages and `StructuredDbError` wrapping.
- **CHANGE DELTA:** Initial authoring pass + 3 compatibility refinements.

### Missed Questions

1. **Question:** Can `packages/database/src/index.ts` import `@savant-code/common/util/bun-sqlite`?
   **Decision:** No. `packages/database/package.json` intentionally declares zero dependencies
   (`packages/database/src/index.ts:13-16`), and `bun run deps:undeclared` enforces declared workspace
   dependencies. `packages/database/src/index.ts` stays in `shared-primitives.json` `allowedFiles` , while
   `packages/knowledge-graph` and `packages/agent-runtime` (both of which already depend on `@savant-code/common` )
   share `common/src/util/bun-sqlite.ts` .
2. **Question:** How should the naming collision between Title-Case `toolDisplayName` (3 files) and sentence-case
   `toolDisplayName` in `cli/src/components/right-sidebar-format.ts` be resolved?
   **Decision:** Rename the sidebar-specific sentence-case function in `cli/src/components/right-sidebar-format.ts`
   to `sidebarToolDisplayName` (mirroring the `isJSONObjectRecord` / `withTimeoutValue` disambiguation pattern
   documented in `scripts/eslint-rules/shared-primitives.json` ), and register `toolDisplayName` in
   `shared-primitives.json` pointing to `common/src/util/tool-display.ts` .
3. **Question:** Should `agents/context-pruner/helpers.ts` (`asString`, `asObject` ) be consolidated into
   `@savant-code/common` ?
   **Decision:** No. As established in `FID-2026-1013-009` , `agents/context-pruner` modules are serialized via
   `.toString()` at build/factory time and cannot import external packages at runtime.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree on `main` @ `3ee91a35` (local wave 2 implementation)
- [x] **File:line ranges:**
  - `common/src/util/tool-display.ts:1-133` (new canonical `toolDisplayName`, `truncateSingleLine`, `renderToolInput`, `renderToolOutput`, `asPositiveInt`, `asBoolean`)
  - `common/src/util/bun-sqlite.ts:1-87` (new canonical `getRuntimeRequire` + `resolveBunSqliteModule`)
  - `common/src/util/__tests__/tool-display.test.ts:1-135` and `common/src/util/__tests__/bun-sqlite.test.ts:1-94` (new unit suites; 23 tests)
  - `cli/src/commands/copy-conversation-render.ts:1-28,124-209` (imports the canonical renderers; re-exports `renderToolInput`/`renderToolOutput`)
  - `cli/src/commands/export-conversation/format.ts:1-17,48` (re-exports the canonical label + renderers; local copies deleted)
  - `cli/src/components/right-sidebar-format.ts:175-216` (sentence-case helper renamed to `sidebarToolDisplayName`)
  - `cli/src/components/right-sidebar-sections.tsx:1-14,76,84` and `cli/src/components/__tests__/right-sidebar-format.test.ts:3-8,72-102` (rename consumers)
  - `cli/src/components/tools/add-message.tsx:1-12`, `cli/src/components/tools/sequential-thinking.tsx:1-20`, `cli/src/components/tools/set-output.tsx:1-13,55-60` (local truncators/coercers deleted; canonical imports; `set-output` passes `SUMMARY_MAX_LENGTH`)
  - `cli/src/utils/savant-code-client.ts:1-4,114-124` (`getToolDisplayInfo` delegates to `toolDisplayName`)
  - `desktop/src/components/chat/tool-display.ts:1-20,92-131` (`toolDisplayName` re-exported; all 5 preview call sites pass `PREVIEW_MAX_LENGTH` = 120)
  - `desktop/src/lib/thinking-parse.ts:1-18,60-70` (canonical `asPositiveInt`/`asBoolean`; stringified-field parity with the CLI)
  - `desktop/src/floor/office/nameplate-draw.ts:80-103` (exports `traceRoundedRect`) and `desktop/src/floor/stage/nameplate.ts:1-18` (imports it; local copy deleted)
  - `packages/knowledge-graph/src/store.ts:1-45`, `packages/agent-runtime/src/llm-api/docset-search.ts:1-68`, `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts:1-72` (thin wrappers over `@savant-code/common/util/bun-sqlite` preserving each package's exact error wording; `sqlite-adapter` re-wraps in `StructuredDbError`)
  - `packages/database/src/index.ts:13-23` (zero-dependency exception documented; registered in `allowedFiles`)
  - `scripts/eslint-rules/shared-primitives.json:41-82` (8 registry entries + `packages/database/src/index.ts` in `allowedFiles`)
- [x] **Gate output:** All 16 declared verification gates (`typecheck` × 5 workspaces, the `scripts` typecheck probe,
      9 unit suites, and `quality`) exit 0 and are stamped in `### Verification Receipt`.
- [x] **Reproducibility:** Run `bun run fid:verify dev/fids/FID-2026-1013-011-wave2-law13-shared-primitive-consolidation.md`.
- [x] **Step statuses:**
  - Step 1: [COMPLETED] Created `common/src/util/tool-display.ts` and `common/src/util/bun-sqlite.ts` with the two new unit suites.
  - Step 2: [COMPLETED] Wired the CLI `/copy`, `/export`, sidebar, client, and tool-card consumers; renamed the sidebar helper to `sidebarToolDisplayName`.
  - Step 3: [COMPLETED] Wired the desktop tool-display, thinking-parse, and both nameplate modules.
  - Step 4: [COMPLETED] Wired `knowledge-graph`, `docset-search`, and `sqlite-adapter` to the canonical SQLite loader (packages/database stays zero-dependency by design).
  - Step 5: [COMPLETED] Registered the consolidated primitives (the six declared names plus the W2-5 coercion pair, per the
    rule's "adding a canonical export = add one registry entry" contract) and verified the ban is live with a negative ESLint probe.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist and were read 0-EOF:
      `scripts/eslint-rules/shared-primitives.json:1-50` ,
      `scripts/eslint-rules/no-duplicate-shared-primitive.js:1-137` ,
      `cli/src/commands/copy-conversation-render.ts:1-244` , `cli/src/commands/export-conversation/format.ts:1-78`
      , `cli/src/components/right-sidebar-format.ts:1-206` , `cli/src/components/right-sidebar-sections.tsx:1-214`
      , `cli/src/components/tools/add-message.tsx:1-75` , `cli/src/components/tools/sequential-thinking.tsx:1-113`
      , `cli/src/components/tools/set-output.tsx:1-74` , `desktop/src/components/chat/tool-display.ts:1-136` ,
      `desktop/src/lib/thinking-parse.ts:1-74` , `desktop/src/floor/office/nameplate-draw.ts:1-250` ,
      `desktop/src/floor/stage/nameplate.ts:1-191` , `packages/database/src/index.ts:1-294` ,
      `packages/knowledge-graph/src/store.ts:1-125` , `packages/agent-runtime/src/llm-api/docset-search.ts:1-268` ,
      `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts:1-192` .
- [x] Verified `common/package.json` wildcard export `"./*": "./src/*.ts"` and `packages/database/package.json`
      zero-dependency constraint.
- [x] Status updated to `fixed` with `implementation_started: true` and receipt stamped via `bun run fid:verify --write`.
- [x] Registry enforcement proven load-bearing: an ESLint stdin probe declaring `toolDisplayName` /
      `truncateSingleLine` outside the owner errors with `savant/no-duplicate-shared-primitive`, while importing
      them is clean.

### Loop 2 — Independent audit and self-correction

- **RED:** Checked whether any external caller imports `toolDisplayName` , `renderToolInput` , or
  `renderToolOutput` from `cli/src/commands/copy-conversation-render.ts` or
  `desktop/src/components/chat/tool-display.ts` .
- **GREEN:** Call-graph references (`referencedBy` metadata from `read_files`) show:
  - `cli/src/commands/export-conversation/copy-text.ts` and `render-blocks.ts` import `renderToolInput` ,
    `renderToolOutput` , and `toolDisplayName` from `./format` (or `copy-conversation-render.ts` ).
  - `desktop/src/components/chat/ToolCard.tsx` and `desktop/src/components/chat/__tests__/tool-display.test.ts`
    import `toolDisplayName` from `./tool-display` .
  Therefore, `copy-conversation-render.ts` , `export-conversation/format.ts` , and
  `desktop/src/components/chat/tool-display.ts` will re-export `toolDisplayName` (and `renderToolInput` /
  `renderToolOutput` ) from `@savant-code/common/util/tool-display` (`export { toolDisplayName } from
  '@savant-code/common/util/tool-display'`). Because `no-duplicate-shared-primitive.js:107-125` only flags
  `FunctionDeclaration` and `VariableDeclaration` AST nodes (never `ExportNamedDeclaration` re-exports),
  re-exporting from the canonical owner is 100% legal under ESLint while keeping all existing consumer imports
  unbroken!
- **AUDIT:** Verified `scripts/eslint-rules/no-duplicate-shared-primitive.js:107-125` : only `FunctionDeclaration`
  and `VariableDeclaration` are visited. Re-exports (`export { ... } from '...'`) never trigger
  `duplicatePrimitive` .
- **ADVERSARIAL:** Does `truncateSingleLine` in `desktop/src/components/chat/tool-display.ts` need a local wrapper
  for its 120-char default? If `tool-display.ts` calls `truncateSingleLine(sanitized, PREVIEW_MAX_LENGTH)` directly
  at its 4 call sites inside `toolCollapsedPreview` , it needs no local `function truncateSingleLine` declaration
  at all, so `tool-display.ts` doesn't even need an `allowedFiles` entry!
- **CHANGE DELTA:** ~5% refinement to preserve re-exports on existing module surfaces and pass `PREVIEW_MAX_LENGTH`
  directly at call sites.

### Loop 3 — Final convergence

- **RED:** Checked all 5 steps and 15 verification gates for completeness.
- **GREEN:** No further changes needed.
- **AUDIT:** Structural validation against `fid-validator.ts` (`REQUIRED_SECTIONS`, `STRICT_SECTIONS` , 3 answered
  Missed Questions, zero placeholders, standalone `implementation_started: false` ).
- **ADVERSARIAL:** Confirmed Wave 2 depends on Wave 1 (`FID-2026-1013-010`) and touches zero files in Wave 1's
  write set.
- **CHANGE DELTA:** 0% — converged.

## Resolution

**Fixed (`Status: fixed`) — all 7 Wave 2 findings (W2-1 through W2-7) implemented and verified:**

1. **W2-1 (`toolDisplayName`):** one Title-Case owner in `common/src/util/tool-display.ts` (with the `list_directory`
   override and MCP `server__tool` stripping) consumed by `/copy`, `/export`, `getToolDisplayInfo`, and the desktop
   tool card; the CLI sidebar's distinct sentence-case helper is renamed `sidebarToolDisplayName` so the registry
   name is unambiguous.
2. **W2-2 (`truncateSingleLine`):** one parameterized implementation (`maxLength`, default 160) replacing four
   copies; the desktop collapse header passes 120 and `set-output` passes `SUMMARY_MAX_LENGTH`.
3. **W2-3 (`renderToolInput`/`renderToolOutput`):** the byte-identical `/copy` and `/export` pair now lives in
   common and is re-exported from both former homes, so no import site changed.
4. **W2-4 (`traceRoundedRect`):** owned by `desktop/src/floor/office/nameplate-draw.ts`; the billboard nameplate
   imports it instead of carrying a second copy.
5. **W2-5 (`asPositiveInt`/`asBoolean`):** one coercing pair in common; the desktop `sequentialthinking` parser
   gains the stringified-field parity the CLI already had.
6. **W2-6 (`getRuntimeRequire`/`resolveBunSqliteDatabaseModule`):** one mechanism in
   `common/src/util/bun-sqlite.ts`; `knowledge-graph`, `docset-search`, and `sqlite-adapter` keep thin wrappers so
   every existing error message and the `StructuredDbError` code contract are byte-identical, and
   `packages/database` stays zero-dependency (registered in the rule's `allowedFiles`).
7. **W2-7 (registry):** the consolidated primitives are registered in
   `scripts/eslint-rules/shared-primitives.json`, proven live by a negative ESLint probe.

- **Parent Coordinator:** `FID-2026-1013-009`
- **Findings Owned:** W2-1, W2-2, W2-3, W2-4, W2-5, W2-6, W2-7

## Lessons Learned

1. **Check workspace `package.json` dependency edges before consolidating a helper into `common` .**
   `packages/database` is intentionally zero-dependency; checking `package.json` first avoids introducing an
   undeclared workspace edge.
2. **Re-exports (`export { fn } from '@savant-code/common/...'`) preserve existing module import paths without
   violating `savant/no-duplicate-shared-primitive` .** The AST rule inspects `FunctionDeclaration` and
   `VariableDeclaration` nodes, so barrel re-exports keep downstream callers untouched while eliminating duplicate
   function bodies.
