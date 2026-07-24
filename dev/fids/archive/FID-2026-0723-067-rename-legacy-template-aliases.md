# FID-2026-0723-067 — Rename Legacy Template Aliases

**Filename:** `FID-2026-0723-067-rename-legacy-template-aliases.md`
**ID:** FID-2026-0723-067
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23
**Author:** Savant Orchestrator
**Depends on:** FID-2026-0723-066 (Legacy Template-Type Cleanup — completed)

---

## Summary

FID-066 removed dead template types and kept three legacy aliases (`file_picker`, `researcher`, `reviewer`) in `AgentTemplateTypeList` for backward compatibility. This FID completes the cleanup by renaming those aliases to their current ECHO agent IDs everywhere in the codebase, then removing the aliases from the type lists.

---

## Rename mapping

| Legacy alias | Current agent ID | Agent file | Rationale |
|---|---|---|---|
| `file_picker` | `scout` | `agents/scout/scout.ts` | Scout handles file finding via `glob`/`list_directory` |
| `reviewer` | `verifier` | `agents/verifier/verifier.ts` | Verifier replaced the reviewer role |
| `researcher` | `detective` | `agents/detective/detective.ts` | Detective handles codebase analysis via `code_search` |

### ⚠️ Concern: `researcher` → `detective` mapping

The `researcher` template type currently maps to **two** agents: `researcher-web.ts` and `researcher-docs.ts`. The `detective` agent at `agents/detective/detective.ts` handles codebase analysis (code search), which is a different role from web/docs research. The correct mapping may be:
- **Option A:** `researcher` → `researcher` (keep as-is since researcher-web/researcher-docs still exist)
- **Option B:** `researcher` → `detective` (if detective subsumes the researcher role)
- **Option C:** Remove `researcher` from `baseAgentSubagents` entirely (scout already handles file finding; detective handles code search)

**Recommendation (confirmed by code-reviewer):** Option C — remove `researcher` from `baseAgentSubagents` since the Orchestrator already spawns `detective` directly for code search. Keep `researcher` in `AgentTemplateTypeList` since `researcher-web.ts` and `researcher-docs.ts` still exist as valid agents. The scope is: (1) remove `file_picker` and `reviewer` from both type lists, (2) remove `researcher` from `baseAgentSubagents`, (3) rename `file_picker` → `scout` and `reviewer` → `verifier` everywhere, (4) keep `researcher` as a valid type.

---

## All touchpoints

### `file_picker` references (107+ occurrences)

**Type definitions (must change):**
1. `common/src/types/session-state.ts` — `AgentTemplateTypeList` entry `'file_picker'`
2. `agents/types/secret-agent-definition.ts` — `AgentTemplateTypeList` entry `'file_picker'`

**Production code (must change):**
3. `common/src/constants/free-agents.ts` — `'file-picker-max'`, `'file-lister'` subagent model mappings
4. `common/src/templates/initial-agents-dir/examples/03-advanced-file-explorer.ts` — `spawnableAgents: ['savant-code/file-picker@0.0.1']`
5. `common/src/templates/initial-agents-dir/types/agent-definition.ts` — JSDoc references to `file-picker`
6. `evals/buffbench/lessons-extractor.ts` — `spawnableAgents: ['file-picker', ...]`

**Test files (must update mock agent IDs):**
7. `common/src/__tests__/dynamic-agent-template-schema.test.ts` — `'file-picker'` string literals
8. `common/src/__tests__/free-agents.test.ts` — `'file-picker-max'`, `'file-lister'`
9. `packages/agent-runtime/src/templates/__tests__/agent-registry.test.ts` — mock `file_picker` template
10. `packages/agent-runtime/src/templates/__tests__/strings.test.ts` — `'file-picker'` mock agents
11. `packages/agent-runtime/src/__tests__/prompts-schema-handling.test.ts` — `'file_picker'` tool calls
12. `packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts` — `'file-picker'` string literals
13. `packages/agent-runtime/src/util/__tests__/parse-tool-calls-from-text.test.ts` — `'file-picker'` in JSON
14. `cli/src/__tests__/cli-args.test.ts` — `'file-picker'` agent arg
15. `cli/src/__tests__/integration/local-agents.test.ts` — `'savant-code/file-picker@0.0.1'`
16. `cli/src/hooks/__tests__/use-suggestion-engine-mention.test.ts` — `'file-picker'`
17. `cli/src/utils/__tests__/block-processor.test.ts` — `'file-picker'` mock agent types
18. `cli/src/utils/__tests__/implementor-helpers.test.ts` — `'file-picker'` mock agent types
19. `cli/src/utils/__tests__/sdk-event-handlers.test.ts` — `'file-picker'` agent types
20. `cli/src/utils/__tests__/message-block-helpers.test.ts` — `'file-picker'` agent names
21. `cli/src/utils/__tests__/send-message-helpers.test.ts` — `'file-picker'` agent types

**Comments/docs (update for accuracy):**
22. `packages/agent-runtime/src/templates/prompts.ts` — comment `'savant-code/file-picker@1.0.0' -> 'file-picker'`

### `reviewer` references (fewer occurrences)

**Type definitions:**
1. `common/src/types/session-state.ts` — `AgentTemplateTypeList` entry `'reviewer'`
2. `agents/types/secret-agent-definition.ts` — `AgentTemplateTypeList` entry `'reviewer'`

**Test files:**
3. `packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts` — `'reviewer'` in spawnableAgents arrays

### `researcher` references (if renaming to `detective`)

**Type definitions:**
1. `common/src/types/session-state.ts` — `AgentTemplateTypeList` entry `'researcher'`
2. `agents/types/secret-agent-definition.ts` — `AgentTemplateTypeList` entry `'researcher'`

**Production code:**
3. `packages/agent-runtime/src/templates/types.ts` — `baseAgentSubagents` entry `AgentTemplateTypes.researcher`

**Test files:**
4. `common/src/__tests__/dynamic-agent-template-schema.test.ts` — `'researcher'` string literals
5. `packages/agent-runtime/src/__tests__/web-search-tool.test.ts` — `'researcher'` as agentType

---

## Proposed work

### Step 1: Remove legacy aliases from type lists
Remove `file_picker`, `reviewer`, and (if Option B chosen) `researcher` from `AgentTemplateTypeList` in both `common/src/types/session-state.ts` and `agents/types/secret-agent-definition.ts`.

### Step 2: Update `baseAgentSubagents`
If Option C is chosen: remove `researcher` from `baseAgentSubagents` in `packages/agent-runtime/src/templates/types.ts`.

### Step 3: Rename `file_picker` → `scout` in production code
Update all production code references (free-agents.ts, examples, docs, evals).

### Step 4: Update test files
Systematically replace `'file-picker'` → `'scout'` and `'reviewer'` → `'verifier'` in all test mock data. The underscore-to-hyphen conversion in `AgentTemplateTypes` means `file_picker` → `file-picker` at runtime; after removal, the runtime will only recognize `scout`.

### Step 5: Database backward compatibility
Old session states may contain `agentType: 'file-picker'` or `agentType: 'reviewer'`. The `AgentTemplateType` type includes `string & {}` union, so TypeScript won't break. But the Zod schema will reject unknown enum values. Add a `.catch()` or `.transform()` fallback that maps `file-picker` → `scout` and `reviewer` → `verifier` for deserialization.

### Step 6: Update `getMatchingSpawn` logic
The underscore-to-hyphen matching in `spawn-agents-permissions.ts` (`getMatchingSpawn`) converts `file_picker` → `file-picker` for spawnable agent lookup. After removing `file-picker` from spawnableAgents, this logic should still work — spawned agents will use the new IDs directly.

### Step 7: Verify
Run x4 typecheck gate and full test suite.

---

## Risk

**Medium.** The rename affects:
- Zod validation of stored session states (backward compat)
- Test mock data (mechanical but large surface area)
- Agent spawning at runtime (if Orchestrator prompts reference old IDs)

The `string & {}` union in `AgentTemplateType` provides a safety net — old string values pass through TypeScript without error. The real risk is Zod validation and runtime agent lookup.

---

## Impact

- Eliminates all legacy Codebuff agent naming from the codebase
- Makes the canonical agent ID set unambiguous: `scout`, `detective`, `verifier`
- Prevents confusion between legacy and current names in documentation
- Reduces the `AgentTemplateTypeList` to only live entries
