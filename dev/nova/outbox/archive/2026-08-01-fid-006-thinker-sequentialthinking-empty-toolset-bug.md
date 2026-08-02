# Bug Report — Thinker `sequentialthinking` Empty Tool Set

**Date:** 2026-08-01
**Reporter:** Nova (independent trace)
**Related FID:** FID-2026-0801-005 (Thinker tool cascade — parent tools leaking)
**Severity:** Critical — Thinker cannot use `sequentialthinking` at all

## Summary

The Thinker agent fails with `Tool 'sequentialthinking' is not currently available [agent: savant]` when attempting to call `sequentialthinking`. The root cause is that `inheritParentSystemPrompt: true` on the Thinker template causes the runtime to inherit the parent's tool set, but `sequentialthinking` is not in the orchestrator's tool set, resulting in an **empty filtered tool set** for the Thinker.

## Trace

### Step 1 — Thinker spawns via `executeSubagent`
`spawn-agent-utils.ts:404` — calls `loopAgentSteps` with `agentTemplate` = Thinker's template.

### Step 2 — `loopAgentSteps` resolves tools
`run-agent-step.ts:833-835`:
```typescript
const useParentTools =
    agentTemplate.inheritParentSystemPrompt && parentTools !== undefined
const inheritedParentTools: ToolSet = parentTools ?? {}
```
Thinker has `inheritParentSystemPrompt: true` and `parentTools` is defined → `useParentTools = true`.

### Step 3 — Tool set is filtered (THE BUG)
`run-agent-step.ts:888-889`:
```typescript
const tools = useParentTools
    ? filterToolSet(inheritedParentTools, agentTemplate.toolNames)
    : await getToolSet(...)
```
- `inheritedParentTools` = orchestrator's tool set (does NOT contain `sequentialthinking`)
- `agentTemplate.toolNames` = `['sequentialthinking']` (Thinker's allowlist)
- `filterToolSet(parentTools, ['sequentialthinking'])` → **empty object `{}`** because `sequentialthinking` is not in the parent's tools

### Step 4 — Model receives empty tool set
The Thinker model receives `{}` as its available tools. It still tries to call `sequentialthinking` (because its instructionsPrompt says to), but the executor at `tool-executor.ts:345` rejects it:
```typescript
!agentTemplate.toolNames.includes(toolCall.toolName) && ...
message: `Tool \`${toolName}\` is not currently available [agent: ${agentTemplate.id}].`
```
The `agentTemplate` here is the orchestrator's template (id: `savant`), not the Thinker's — another layer of the same issue.

## Root Cause

`inheritParentSystemPrompt` conflates two separate concerns:
1. **Prompt inheritance** — Thinker should see the parent's system prompt (correct behavior)
2. **Tool inheritance** — Thinker should NOT inherit the parent's tools; it should get its own from `getToolSet()`

The current code at `run-agent-step.ts:888` uses a single `useParentTools` flag for both, which breaks any agent that:
- Has `inheritParentSystemPrompt: true` (wants parent prompt)
- Has a restricted `toolNames` list that doesn't overlap with the parent's tools

### Orchestrator's tool set (for reference)
`agents/savant/savant.ts:100-121`:
```
spawn_agents, read_files, read_subtree, run_readonly_command, write_todos,
suggest_followups, ask_user, read_url, skill, set_output, list_directory,
glob, render_ui, gravity_index, transition_phase, write_file, str_replace,
apply_patch, set_scaffold_complete
```
**`sequentialthinking` is NOT in this list.**

### Thinker's tool set
`agents/thinker/thinker.ts:34`:
```
toolNames: ['sequentialthinking']
```

## Proposed Fix

Separate prompt inheritance from tool inheritance. When `inheritParentSystemPrompt` is true:

1. **System prompt**: inherit from parent (existing behavior, correct)
2. **Tools**: always build from `getToolSet(agentTemplate.toolNames)`, NOT from `filterToolSet(parentTools, ...)`

The fix should be at `run-agent-step.ts:888-903` — always use the `getToolSet` branch when the agent has a restricted `toolNames` list, regardless of `inheritParentSystemPrompt`.

### Specific change
```typescript
// BEFORE (buggy):
const tools = useParentTools
    ? filterToolSet(inheritedParentTools, agentTemplate.toolNames)
    : await getToolSet({ ... })

// AFTER (fixed):
const useOwnTools = agentTemplate.toolNames.length > 0 &&
    !agentTemplate.toolNames.some(name => Object.keys(inheritedParentTools).includes(name))

const tools = useOwnTools || !useParentTools
    ? await getToolSet({ ... })
    : filterToolSet(inheritedParentTools, agentTemplate.toolNames)
```

Or more simply: if the child's `toolNames` are not a subset of the parent's tools, always build from `getToolSet`.

## Verification

After fix, verify:
1. Thinker spawns and can call `sequentialthinking` without errors
2. Orchestrator does NOT gain `sequentialthinking` in its tool set
3. Other agents with `inheritParentSystemPrompt: true` still work correctly
4. Agents that DO have overlapping tools with the parent still inherit correctly
5. No "unavailable tool cascade" errors appear in the Thinker's output

## Impact

This blocks the Thinker agent entirely — the most critical reasoning agent in the 9-agent roster. Without sequential thinking, the orchestrator cannot delegate deep reasoning tasks.
