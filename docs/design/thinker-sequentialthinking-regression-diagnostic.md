# Thinker `sequentialthinking` Regression Diagnostic

**Date:** 2026-08-01
**FID:** FID-2026-0801-007 (live CLI regression test)
**Status:** Open — awaiting investigation on a stronger model
**Reported by:** Savant (MiMo V2.5 / opencode-go)

---

## 1. Summary

A live CLI regression test for FID-2026-0801-007 (child tool-set fallback) was executed. The Thinker child agent was spawned successfully, and it **did receive** `sequentialthinking` in its tool set (proven by the specific error pattern). However, **all three `sequentialthinking` tool calls failed** with parameter formatting errors, and the Thinker returned `null` output. The test was previously working earlier the same day.

---

## 2. Test Execution Evidence

### 2.1 What Passed

| Field | Result | Evidence |
|-------|--------|----------|
| **THINKER_SPAWNED** | ✅ PASS | `spawn_agents` returned `{"agentName":"Savant the Thinker","agentType":"thinker"}` |
| **PARENT_TOOL_LEAKAGE** | ✅ NO | Thinker did not attempt `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, or any parent-only tool |
| **UNAVAILABLE_TOOL_ERROR** | ✅ NO | Errors say "Invalid parameters", NOT "Tool sequentialthinking is not currently available" |
| **RAW_LEGACY_XML_VISIBLE** | ✅ NO | No `<tool_call>`, `<function=sequentialthinking>`, `<parameter=`, or `</tool_call>` appeared as ordinary assistant text |

### 2.2 What Failed

| Field | Result | Evidence |
|-------|--------|----------|
| **THINKER_CHILD_TOOL_EXECUTED** | ❌ FAIL | 3 attempts, all failed with parameter formatting errors |
| **SEQUENTIALTHINKING_CALL_COUNT** | 0 | 3 attempted, 0 successful |
| **CHILD_RESULT** | ❌ FAIL | Thinker returned `structuredOutput: null` — zero numbered items |
| **FID_2026_0801_007_BEHAVIORAL_RESULT** | ❌ FAIL | Gate criteria (2) and (7) failed |

### 2.3 The Three Failed Attempts

**Attempt 1** — JSON string instead of object:
```
Invalid parameters for sequentialthinking: expected the tool arguments
to be an object, but received a string. Parsing as JSON failed:
JSON Parse error: Unterminated string. The arguments may be malformed
or incomplete.
```
The model sent the arguments as a raw JSON string rather than a structured object. The runtime's `parseStringifiedToolInput` tried to `JSON.parse` it up to 3 times but failed because the string was truncated/unterminated.

**Attempt 2** — Empty object, missing all required fields:
```
Invalid parameters for sequentialthinking: [
  { "expected": "string", "code": "invalid_type", "path": ["thought"],
    "message": "Invalid input: expected string, received undefined" },
  { "expected": "boolean", "code": "invalid_type", "path": ["nextThoughtNeeded"],
    "message": "Invalid input: expected boolean, received undefined" },
  { "expected": "number", "code": "invalid_type", "path": ["thoughtNumber"],
    "message": "Invalid input: expected number, received undefined" },
  { "expected": "number", "code": "invalid_type", "path": ["totalThoughts"],
    "message": "Invalid input: expected number, received undefined" }
]
```
The model sent `{}` — all four required fields were missing.

**Attempt 3** — Identical to Attempt 2 (empty `{}`).

### 2.4 Critical Corroboration: Parent-Level Tool Isolation

When I (the parent/orchestrator agent "savant") attempted to call `sequentialthinking` at my own level, the system returned:

```
Tool `sequentialthinking` is not currently available [agent: savant].
Make sure to only use tools provided at the start of the conversation
AND that you most recently have permission to use.
```

This **proves**:
1. Tool-set isolation is working correctly — `sequentialthinking` is blocked at parent level
2. The Thinker child DID receive `sequentialthinking` — it got "Invalid parameters" (the tool exists but params are wrong), NOT "not available"

---

## 3. Architecture: How Child Tool-Set Provisioning Works

### 3.1 The Tool Construction Decision Tree

In `packages/agent-runtime/src/run-agent-step.ts` (inside `loopAgentSteps`):

```
1. Is inheritParentSystemPrompt true AND parentTools provided?
   → useParentTools = true

2. Are ALL of the child's toolNames present in the parent's tool keys?
   → childToolsSubsetOfParent = (check via Set)

3. Final decision:
   → useInheritedTools = useParentTools && childToolsSubsetOfParent

4. If useInheritedTools:
   → filterToolSet(inheritedParentTools, agentTemplate.toolNames)
   → Returns only the child's allowed tools from the parent's set

5. If NOT useInheritedTools:
   → buildAgentToolSet() for agent-as-tool definitions
   → getToolSet() to build the full tool set from scratch for the child
```

### 3.2 Thinker's Path

For the Thinker agent:
- `inheritParentSystemPrompt: true` → `useParentTools = true`
- `toolNames: ['sequentialthinking']`
- Parent tools do NOT include `sequentialthinking`
- Therefore `childToolsSubsetOfParent = false`
- Therefore `useInheritedTools = false`
- **Thinker gets tools built from scratch via `getToolSet()`** — this includes `sequentialthinking`

### 3.3 `sequentialthinking` Authorization Gate

In `packages/agent-runtime/src/tools/tool-executor.ts`:

```typescript
if (!isDevOverride && toolCall.toolName === 'sequentialthinking' &&
    !agentTemplate.id.startsWith('thinker')) {
  // Block: "Tool sequentialthinking is only available to Thinker agents"
}
```

This is a runtime authorization check. The Thinker's ID is `"thinker"` which starts with `"thinker"`, so the check passes.

### 3.4 `filterToolSet` (FID-2026-0801-005)

File: `packages/agent-runtime/src/tools/filter-tool-set.ts`

This function takes a parent ToolSet and an allowlist of tool names, returning only the tools in the allowlist. It was added in FID-2026-0801-005 to prevent parent-only tools from leaking to children. In the Thinker's case, this function is NOT used because `useInheritedTools = false` (the Thinker builds tools from scratch).

---

## 4. The `sequentialthinking` Tool Definition

### 4.1 Tool Interface

File: `common/src/tools/sequential-thinking.ts`

```typescript
export interface ThoughtData {
  thought: string          // Required — the thinking content
  thoughtNumber: number    // Required — current thought number
  totalThoughts: number    // Required — estimated total thoughts
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
  needsMoreThoughts?: boolean
  nextThoughtNeeded: boolean  // Required — whether more thinking is needed
}
```

### 4.2 Tool Schema (Zod)

The tool's `inputSchema` is a Zod schema derived from `ThoughtData`. The four required fields are: `thought` (string), `thoughtNumber` (number), `totalThoughts` (number), `nextThoughtNeeded` (boolean).

### 4.3 How Tools Are Serialized to the LLM

The pipeline is:
1. `compileToolDefinitions` → AI SDK `ToolSet` with Zod schemas
2. `OpenAICompatibleChatLanguageModel.doGenerate/doStream()` → calls `prepareTools()`
3. `prepareTools()` (in `packages/llm-providers/src/openai-compatible/chat/openai-compatible-prepare-tools.ts`) → converts to OpenAI-compatible format:
   ```json
   { "type": "function", "function": { "name": "sequentialthinking",
     "description": "...", "parameters": <JSON Schema from Zod> } }
   ```

For opencode-go, the model receives the tool in OpenAI function-calling format.

---

## 5. What Changed Recently

### 5.1 FID-2026-0801-005: Thinker Agent Tool Cascade Fix

**Closed:** 2026-0801
**Modified files:**
- `packages/agent-runtime/src/run-agent-step.ts` — Added `filterToolSet` at the final model-facing inherited-tool boundary
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` — Applied filter at ordinary spawn handoff
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` — Applied filter at inline child handoff and inline child state
- `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts` — Regression tests

**New file:** `packages/agent-runtime/src/tools/filter-tool-set.ts`

**Purpose:** Prevent restricted agents (like Thinker) from receiving parent-only tool definitions while still allowing them to receive their own allowed tools.

### 5.2 FID-2026-0801-006: Strict Tool-Call Format Boundary

**Closed:** 2026-0801
**Changes:** Added a fail-closed filter for unsupported legacy `<tool_call>...</tool_call>` markup in text and reasoning streams. Also finalized atomic/fail-closed agent prebuild behavior and WSL/tmux bundle validation.

### 5.3 FID-2026-0801-007: Child Tool-Set Fallback

**Closed:** 2026-0801
**Changes:** Separated prompt inheritance from child-tool provisioning. Children now reuse filtered parent tool definitions only when the parent contains the complete child allowlist; partial or non-overlapping allowlists use the existing child `buildAgentToolSet` and `getToolSet` paths.

### 5.4 Other Recent Changes

From the git status, numerous files across the CLI were modified (components, commands, hooks, etc.). Any of these could potentially affect how the CLI renders child-agent events or how tool calls are processed in the stream.

---

## 6. Root Cause Analysis

### 6.1 What We KNOW

1. **Tool provisioning WORKS** — The Thinker child receives `sequentialthinking` in its tool set. This is proven by the "Invalid parameters" error (not "not available").

2. **Tool authorization WORKS** — The runtime correctly allows `sequentialthinking` for agents with ID starting with "thinker" and blocks it for all others.

3. **Parent tool isolation WORKS** — The Thinker does not receive parent-only tools like `spawn_agents`, `write_file`, etc.

4. **The tool call parsing FAILS** — The MiMo V2.5 model (via opencode-go) sent malformed arguments in all three attempts.

5. **The error is in parameter formatting, not tool availability** — The model either sends a JSON string instead of an object, or sends an empty object `{}`.

### 6.2 What We DON'T Know (Hypotheses)

#### Hypothesis A: Recent code change broke tool serialization
The FID-2026-0801-005/006/007 changes modified how tools are filtered and passed to child agents. A subtle bug in the tool construction path could cause the `sequentialthinking` schema to be serialized differently or incompletely when delivered to the Thinker child.

**Where to investigate:**
- `getToolSet()` in `packages/agent-runtime/src/tools/prompts.ts` — Does it correctly include `sequentialthinking` when building from scratch?
- `filterToolSet()` in `packages/agent-runtime/src/tools/filter-tool-set.ts` — Could this be accidentally called and strip the schema?
- `compileToolDefinitions()` in `common/src/tools/compile-tool-definitions.ts` — Is the Zod schema being converted to JSON Schema correctly for `sequentialthinking`?
- The `prepareTools()` path in `packages/llm-providers/` — Could the opencode-go provider be serializing the schema differently?

#### Hypothesis B: Model regression or session degradation
The opencode-go MiMo V2.5 model may have been updated or degraded between "working earlier today" and the test run. If the model's function-calling capability changed, it would explain the sudden failure.

**Where to investigate:**
- Check if the opencode-go provider had any updates or incidents
- Test with a different model (Claude, GPT) to see if the issue is model-specific
- Compare the raw API request/response if possible

#### Hypothesis C: Stream parser change broke tool call extraction
A change to the stream parser (`packages/agent-runtime/src/tools/stream-parser.ts`) could cause tool calls to be extracted incorrectly, resulting in partial or malformed arguments being passed to the executor.

**Where to investigate:**
- `processStream()` in `packages/agent-runtime/src/tools/stream-parser.ts`
- Any changes to how tool call deltas are accumulated

#### Hypothesis D: The Thinker inherited the wrong model
`withParentModel()` (in `spawn-agent-utils.ts`) clones the child template with the parent's model. If the parent is using MiMo V2.5, the Thinker also runs on MiMo V2.5 (not its default `anthropic/claude-opus-4.8`). MiMo V2.5 may have weaker function-calling precision than Claude Opus.

**This is expected behavior** — `inheritParentModel` defaults to `true` and the Thinker definition does not set it to `false`. But this could be the root cause if MiMo V2.5 genuinely cannot format `sequentialthinking` calls correctly.

---

## 7. Key Files to Investigate

| File | Role | Why it matters |
|------|------|----------------|
| `packages/agent-runtime/src/run-agent-step.ts` | Tool construction decision tree | Determines which tools the Thinker child receives |
| `packages/agent-runtime/src/tools/filter-tool-set.ts` | Tool allowlist filter | Added in FID-2026-0801-005; could accidentally strip tools |
| `packages/agent-runtime/src/tools/prompts.ts` | `getToolSet()` | Builds the full tool set for child agents |
| `packages/agent-runtime/src/tools/stream-parser.ts` | Stream processing | Extracts tool calls from the LLM stream |
| `packages/agent-runtime/src/tools/tool-executor.ts` | Tool execution + authorization | Validates and executes tool calls |
| `common/src/tools/compile-tool-definitions.ts` | Tool definition compilation | Converts Zod schemas to AI SDK ToolSet |
| `packages/llm-providers/src/openai-compatible/chat/openai-compatible-prepare-tools.ts` | Wire serialization | Converts tools to OpenAI-compatible format for the API |
| `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` | `withParentModel()` | Copies parent model to child agents |
| `agents/thinker/thinker.ts` | Thinker agent definition | Tool names, model, inheritance settings |
| `common/src/tools/sequential-thinking.ts` | `SequentialThinkingServer` | The tool's processing logic |

---

## 8. Recommended Investigation Steps

1. **Log the tool definitions sent to the Thinker child** — Add logging in `loopAgentSteps` (after the `tools` variable is constructed) to dump the full ToolSet being passed to `runAgentStep`. This will show whether `sequentialthinking` has a valid schema or if it's empty/malformed.

2. **Compare with the parent's tool definitions** — Check what the parent (Savant/savant) sends to the LLM vs what the Thinker child receives. If the schemas differ, the issue is in the tool construction path.

3. **Test with a different model** — Switch the Thinker to use its default model (`anthropic/claude-opus-4.8`) by setting `inheritParentModel: false` in `agents/thinker/thinker.ts`. If the test passes, the issue is MiMo V2.5's function-calling capability.

4. **Test the opencode-go provider directly** — Send a raw API request with the `sequentialthinking` tool definition to see if the model can format the call. This isolates whether the issue is in the model or in the serialization layer.

5. **Check the stream parser** — Look at `processStream()` to see if recent changes affected how tool call arguments are accumulated from deltas. A bug here could cause partial/empty arguments.

6. **Review the FID-2026-0801-005/007 diffs carefully** — The `filterToolSet` and tool-construction path changes are the most likely regression source since they were implemented today.

---

## 9. Files Modified by Recent FIDs (Potential Regression Sources)

```
packages/agent-runtime/src/run-agent-step.ts
packages/agent-runtime/src/tools/filter-tool-set.ts          (NEW)
packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts
packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts
```

---

## 10. Reproduction

To reproduce, run the Savant-Code CLI and paste the test prompt from `dev/test-prompts/fid-2026-0801-007-child-tool-set-fallback-cli.md`. The key behavior to watch for:

1. Thinker child is spawned (structured `subagent_start` event)
2. Thinker child makes `sequentialthinking` tool calls
3. Whether those calls succeed or fail with parameter errors
4. Whether the Thinker returns a structured answer

---

## 11. Open Questions

1. Was there a code change between "working earlier today" and the test run that could affect tool serialization?
2. Does the `sequentialthinking` Zod schema survive the `compileToolDefinitions` → `prepareTools` → wire path correctly for the Thinker child?
3. Is the MiMo V2.5 model through opencode-go capable of formatting `sequentialthinking` calls, or is this a model limitation?
4. Could the `withParentModel` clone be losing the Thinker's tool schema during the shallow copy?
5. Does the `parseStringifiedToolInput` double-encode loop in `tool-executor.ts` interact badly with how opencode-go formats tool calls?
