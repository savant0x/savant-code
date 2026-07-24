# FID-2026-0723-066 — Legacy Template-Type Cleanup

**Filename:** `FID-2026-0723-066-legacy-template-type-cleanup.md`
**ID:** FID-2026-0723-066
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23
**Author:** Savant Orchestrator
**Replaces:** FID-2026-0722-051 (archived)

---

## Summary

Two `AgentTemplateTypeList` arrays exist in the codebase and have drifted out of sync. Both contain legacy Codebuff-era entries (`base`, `base_free`, `base_lite`, `base_max`, `base_experimental`, `claude4_gemini_thinking`, `superagent`, `base_agent_builder`, `example_programmatic`) that no longer correspond to agent files on disk. This FID catalogs every legacy entry, maps it to the current 9-agent ECHO roster, and defines the cleanup scope.

---

## Current State

### File 1: `common/src/types/session-state.ts` (lines 153–184)

```
base, base_free, base_max, base_experimental,
claude4_gemini_thinking, superagent, base_agent_builder,
ask, planner, dry_run, thinker,
file_picker, file_explorer, researcher, reviewer,
recorder, scribe, agent_builder, example_programmatic
```

### File 2: `agents/types/secret-agent-definition.ts` (lines 66–95)

```
base, base_lite, base_max, base_experimental,
claude4_gemini_thinking, superagent, base_agent_builder,
ask, dry_run, thinker,
file_picker, file_explorer, researcher, reviewer,
recorder, scribe, agent_builder, example_programmatic
```

### Divergences

| Entry | `common/session-state.ts` | `agents/secret-agent-definition.ts` |
|---|---|---|
| `base_free` | ✅ present | ❌ missing |
| `base_lite` | ❌ missing | ✅ present |
| `planner` | ✅ present | ❌ missing |

### Dead entries (no corresponding agent file on disk)

| Entry | Replacement | Status |
|---|---|---|
| `base` | `savant` | Dead — no `agents/base/` directory |
| `base_free` | `savant-free` | Dead — no agent file |
| `base_lite` | `savant-lite` | Dead — no agent file |
| `base_max` | `savant-max` | Dead — no agent file |
| `base_experimental` | none | Dead |
| `claude4_gemini_thinking` | `thinker` variants | Dead |
| `superagent` | none | Dead |
| `base_agent_builder` | none | Dead |
| `agent_builder` | none | Dead |
| `example_programmatic` | none | Dead |

### Live entries (have corresponding agent files or are actively used)

| Entry | Agent file | Used in production? |
|---|---|---|
| `ask` | `agents/savant/savant.ts` (persona) | Yes — `AGENT_PERSONAS` in `common/src/constants/agents.ts` |
| `planner` | `agents/savant/savant-plan.ts` | Yes — persona exists |
| `dry_run` | `agents/savant/savant-analyze.ts` | Yes — persona exists |
| `thinker` | `agents/thinker/thinker.ts` | Yes — ECHO agent |
| `file_picker` | `agents/scout/scout.ts` (renamed) | Legacy ID used in `baseAgentSubagents` |
| `file_explorer` | `agents/file-explorer/` | Legacy ID, infrastructure agent; `AGENT_PERSONAS` still has `file-explorer` entry |
| `researcher` | `agents/researcher/researcher-web.ts` + `researcher-docs.ts` | Legacy ID — old generic `researcher` split into two agents; used in `baseAgentSubagents` |
| `reviewer` | `agents/verifier/verifier.ts` (renamed) | Legacy ID used in `baseAgentSubagents` |
| `recorder` | `agents/recorder/recorder.ts` | Yes — ECHO agent |
| `scribe` | `agents/scribe/scribe.ts` | Yes — ECHO agent |

---

## All touchpoints

1. **`common/src/types/session-state.ts`** — `AgentTemplateTypeList` array + `AgentTemplateTypes` mapping + Zod schema
2. **`agents/types/secret-agent-definition.ts`** — `AgentTemplateTypeList` array + `AgentTemplateTypes` mapping
3. **`packages/agent-runtime/src/templates/types.ts`** — `baseAgentSubagents` references `file_picker`, `researcher`, `thinker`, `reviewer`
4. **`common/src/constants/agents.ts`** — `AGENT_PERSONAS` has `base`, `ask`, and `file-explorer` entries that need review
5. **`cli/src/utils/local-agent-registry.ts`** — special-cases `def.id.startsWith('base')` (lines 378, 394)
6. **`packages/agent-runtime/src/__tests__/main-prompt.test.ts`** — uses `AgentTemplateTypes.base` and `AgentTemplateTypes.base_max`
7. **`common/src/__tests__/dynamic-agent-template-schema.test.ts`** — uses `AgentTemplateTypes.file_picker`
8. **`evals/buffbench/eval-task-generator.ts`** — already fixed (FID-066 session): `spawnableAgents` updated from `['file-picker', 'code-searcher']` to `['scout', 'detective']`
9. **`sdk/src/impl/llm.ts`** — generic underscore-to-dash regex (`toolName.replace(/_/g, '-')`) handles legacy IDs at runtime; no code change needed but worth noting
10. **`packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts`** — uses `'file-picker'` and `'savant-code/file-picker@1.0.0'` as test agent types (lines 319, 342); will break if `file_picker` removed from enum
11. **`packages/agent-runtime/src/__tests__/web-search-tool.test.ts`** — uses `'researcher'` as agentType (lines 55, 111, 146, 186, 218, 255, 292, 330, 370); will break if `researcher` removed from enum
12. **`cli/src/agents/bundled-agents.generated.ts`** — generated file; contains agent definitions but references are IDs not enum values; no direct enum dependency

---

## Proposed work

### Step 1: Reconcile the two lists
Merge both `AgentTemplateTypeList` arrays into a single canonical set. Remove all dead entries. Keep live entries that are actively referenced. The two files must contain identical lists after this step.

### Step 2: Update `baseAgentSubagents`
Change `file_picker` → `scout`, `researcher` → `detective` (the code-search agent that replaced the generic researcher role), `reviewer` → `verifier` in `packages/agent-runtime/src/templates/types.ts`. Keep `thinker` as-is.

### Step 3: Clean up `AGENT_PERSONAS`
Remove the `base` persona from `common/src/constants/agents.ts`. Review the `file-explorer` entry (may need updating to `scout` or removal). Keep `ask` if still used; verify.

### Step 4: Fix `local-agent-registry.ts`
Replace the `def.id.startsWith('base')` special case with explicit checks for known orchestrator IDs (`savant`, `savant-free`, `savant-lite`, `savant-max`, `savant-plan`, `savant-analyze`).

### Step 5: Update tests
Replace mock agent IDs in `main-prompt.test.ts` and `dynamic-agent-template-schema.test.ts` with current agent IDs (`savant`, `scout`, `detective`, etc.).

### Step 6: Database backward compatibility
Before removing enum members, add a Zod `.catch()` or `.transform()` fallback in `session-state.ts` that maps legacy values to current ones. This prevents breakage when deserializing old session-state blobs.

### Step 7: Verify
Run x4 typecheck gate (sdk, common, agent-runtime, cli) and full test suite.

---

## Prerequisite decision

**Should we rename live IDs or only delete dead ones?**

- **Option A (minimal):** Only remove dead entries (`base`, `base_free`, `base_lite`, `base_max`, `base_experimental`, `claude4_gemini_thinking`, `superagent`, `base_agent_builder`, `agent_builder`, `example_programmatic`). Keep `file_picker`, `researcher`, `reviewer` as legacy aliases.
- **Option B (full cleanup):** Also rename `file_picker` → `scout`, `researcher` → `researcher-web`, `reviewer` → `verifier` everywhere. More thorough but higher risk.

**Recommendation:** Option A first, Option B as a follow-up FID.

---

## Perfection Loop

### Missed Questions (surfaced during RED phase)

| # | Missed Question | Answer | Impact on Plan |
|---|----------------|--------|----------------|
| 1 | Which test files use legacy `AgentTemplateTypes` enum values? | `main-prompt.test.ts` (uses `.base`, `.base_max`), `dynamic-agent-template-schema.test.ts` (uses `.file_picker`), `spawn-agents-permissions.test.ts` (uses `'file-picker'` string literal), `web-search-tool.test.ts` (uses `'researcher'` string literal) | Step 5 must update all 4 test files |
| 2 | Does `AgentTemplateType`'s `string & {}` union mean removing enum members won't break TypeScript? | Yes — TypeScript allows any string. But Zod validation (`z.enum(AgentTemplateTypeList)`) will reject old session-state blobs containing removed values | Step 6 (Zod fallback) is critical |
| 3 | Does `local-agent-registry.ts` `startsWith('base')` catch any current live agents? | No — no live agent ID starts with `base`. The check is dead code for the current roster | Step 4 can safely replace with explicit ID list |
| 4 | Is `AGENT_PERSONAS` type-constrained to `AgentTemplateTypes` keys? | Yes — `Record<(typeof AgentTemplateTypes)[keyof typeof AgentTemplateTypes], ...>`. Removing enum members narrows the type, so any persona keyed on a removed type will cause a TS error | Step 3 must remove `base` persona before Step 1 removes it from the enum |
| 5 | Does `bundled-agents.generated.ts` reference legacy enum values? | No — it uses string literals for agent IDs, not `AgentTemplateTypes.*` references | No action needed |
| 6 | Are there Zod `.catch()` or `.transform()` patterns elsewhere in the codebase we can follow? | `AgentTemplateType` already uses `z.infer<typeof schema> | (string & {})` union — the `string & {}` acts as a runtime escape hatch. Old values pass through as strings. The Zod schema is used for validation of *new* inputs, not deserialization of stored state | Step 6 may be simpler than initially planned — the `string & {}` union already handles backward compat at the type level |

### Decision: Option A (minimal) confirmed

Only remove dead entries. Keep `file_picker`, `researcher`, `reviewer` as legacy aliases for now. Rename them in a follow-up FID.

---

## Risk

**Medium.** The template-type enum is used for Zod validation and stored in session-state database blobs. Removing enum members without a migration/fallback will break deserialization of old sessions.

---

## Impact

- Removes ~10 dead code entries from two type-definition files
- Synchronizes the two divergent `AgentTemplateTypeList` arrays
- Eliminates confusion between legacy Codebuff names and the 9-agent ECHO roster
- Prevents future developers from adding agents that match dead template IDs
