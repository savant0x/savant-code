# Savant-Code — FID-2026-0718-007 Ability Confirmation Test

**Purpose:** Confirm that the Scout file-finding rewrite, MCP proxy timeout, and agent roster alignment changes work correctly in a live CLI session.

**Mode:** Interactive live execution. You MUST call every test listed below. Report PASS/FAIL for each with evidence. Do not skip any item.

**Environment:** The test is running inside the Savant CLI. ECHO Protocol is active. All changes from FID-006 (agent roster) and FID-007 (Scout + MCP timeout) are deployed.

---

## SECTION A: SCOUT FILE-FINDING (FID-007 Fix 1)

These tests verify that Scout uses `glob` + `list_directory` directly instead of delegating to Detective.

### A.1 Scout Basic File Finding

| # | Test | Expected |
|---|------|----------|
| 1 | Spawn `scout` with prompt: "Find files related to tool gating" | Returns file paths containing "tool" or "gating" in their names (e.g., `tool-executor.ts`, `gating-rules.ts`). Should NOT return files that merely contain the word "gating" in their content. |
| 2 | Spawn `scout` with prompt: "Find agent definition files" | Returns paths like `agents/*/` files, `agent-definition.ts`, etc. |
| 3 | Spawn `scout` with prompt: "Find MCP client files" | Returns `common/src/mcp/client.ts`, `packages/agent-runtime/src/mcp.ts`, `common/src/types/mcp.ts`, etc. |
| 4 | Spawn `scout` with prompt: "Find configuration files" | Returns `package.json`, `tsconfig.json`, `protocol.config.yaml`, `.prettierrc`, etc. |

### A.2 Scout Multi-Keyword Extraction

| # | Test | Expected |
|---|------|----------|
| 5 | Spawn `scout` with prompt: "find auth service files" | Should extract keywords `auth`, `service`. Glob for `**/*auth*` and `**/*service*`. Returns files matching either pattern. |
| 6 | Spawn `scout` with prompt: "show me the database schema files" | Should extract keywords `database`, `schema`. Stop words (`show`, `me`, `the`, `files`) stripped. |
| 7 | Spawn `scout` with prompt: "I need to look at the error handling code" | Should extract keywords `error`, `handling`, `code`. Stop words (`I`, `need`, `to`, `look`, `at`, `the`) stripped. |

### A.3 Scout Edge Cases

| # | Test | Expected |
|---|------|----------|
| 8 | Spawn `scout` with prompt: "files" (single stop word) | Should fall back gracefully — either glob for `**/*file*` or report "no specific keywords found". Should NOT crash. |
| 9 | Spawn `scout` with prompt: "Find [test] files with * special chars" | Should strip `[`, `]`, `*` from keywords. Extracts `test`, `files`, `special`, `chars`. Should NOT produce broken glob patterns. |
| 10 | Spawn `scout` with empty prompt (no prompt) | Should handle gracefully — either glob for `*` or report no search terms. Should NOT crash. |

### A.4 Scout Does NOT Delegate to Detective

| # | Test | Expected |
|---|------|----------|
| 11 | Spawn `scout` and observe the tool calls made | Should see `glob` tool calls, NOT `spawn_agents` with `agent_type: 'detective'`. Scout should never spawn Detective. |
| 12 | Verify Scout's spawnableAgents is empty | Scout should have no spawnable agents. It uses its own tools directly. |

### A.5 Scout Tool Set

| # | Test | Expected |
|---|------|----------|
| 13 | Verify Scout has `glob` tool | Scout can call glob directly |
| 14 | Verify Scout has `list_directory` tool | Scout can call list_directory directly |
| 15 | Verify Scout has `read_files` tool | Scout can read files to examine results |
| 16 | Verify Scout has `read_subtree` tool | Scout can explore directory subtrees |
| 17 | Verify Scout does NOT have `write_file` | Scout is read-only — cannot write files |
| 18 | Verify Scout does NOT have `str_replace` | Scout is read-only — cannot edit files |

---

## SECTION B: MCP PROXY TIMEOUT (FID-007 Fix 2)

These tests verify that MCP server connections and tool calls have proper timeout handling.

### B.1 Timeout Infrastructure

| # | Test | Expected |
|---|------|----------|
| 19 | Read `common/src/types/mcp.ts` and verify `timeout` field exists | Both `mcpConfigStdioSchema` and `mcpConfigRemoteSchema` have optional `timeout: z.number().positive().optional()` |
| 20 | Read `common/src/mcp/client.ts` and verify `withTimeout` function exists | Function uses `Promise.race` + `setTimeout` with `.finally(() => clearTimeout(timer))` |
| 21 | Read `common/src/mcp/client.ts` and verify `MAX_TIMEOUT_MS` constant | Value is `300_000` (5 minutes) |
| 22 | Read `common/src/mcp/client.ts` and verify `DEFAULT_CONNECT_TIMEOUT_MS` | Value is `30_000` (30 seconds) |
| 23 | Read `common/src/mcp/client.ts` and verify `DEFAULT_TOOL_TIMEOUT_MS` | Value is `60_000` (60 seconds) |

### B.2 Connect Timeout

| # | Test | Expected |
|---|------|----------|
| 24 | Read `getMCPClient()` and verify `client.connect(transport)` is wrapped with `withTimeout` | `await withTimeout(client.connect(transport), connectTimeoutMs, ...)` present |
| 25 | Read `getMCPClient()` and verify `transport.close()` is called in catch block | Prevents orphaned child processes on timeout |
| 26 | Read `getMCPClient()` and verify timeout is clamped via `clampTimeout()` | User-configured timeout clamped to MAX_TIMEOUT_MS |

### B.3 Tool Call Timeout

| # | Test | Expected |
|---|------|----------|
| 27 | Read `callMCPTool()` and verify `client.callTool(...args)` is wrapped with `withTimeout` | `await withTimeout(client.callTool(...args), timeoutMs, ...)` present |
| 28 | Read `callMCPTool()` and verify timeout value comes from `clientTimeouts` map | `clientTimeouts[clientId] ?? DEFAULT_TOOL_TIMEOUT_MS` |

### B.4 List Tools Timeout

| # | Test | Expected |
|---|------|----------|
| 29 | Read `listMCPTools()` and verify `client.listTools(...)` is wrapped with `withTimeout` | `withTimeout(client.listTools(...), timeoutMs, ...)` present |
| 30 | Read `listMCPTools()` and verify cache clears on rejection | `.catch((error) => { delete listToolsCache[clientId]; throw error })` present |

### B.5 Client Timeout Map

| # | Test | Expected |
|---|------|----------|
| 31 | Read `clientTimeouts` declaration | `const clientTimeouts: Record<string, number> = {}` present |
| 32 | Verify `clientTimeouts[key]` is set on successful connect | Set after `runningClients[key] = client` |

### B.6 Timeout Clamp Function

| # | Test | Expected |
|---|------|----------|
| 33 | Read `clampTimeout()` function | Returns `Math.min(Math.max(Math.round(value), 1), MAX_TIMEOUT_MS)` |
| 34 | Verify `clampTimeout(undefined, 30000)` returns 30000 | Default value used when input is undefined |
| 35 | Verify `clampTimeout(999999999, 30000)` returns 300000 | Clamped to MAX_TIMEOUT_MS |

---

## SECTION C: AGENT ROSTER ALIGNMENT (FID-006)

These tests verify the 9-agent Savant architecture is correctly deployed.

### C.1 Agent Spawnability

| # | Test | Expected |
|---|------|----------|
| 36 | Spawn `detective` with a code search task | Returns evidence with file paths. Detective has `code_search`, `list_directory`, `glob`, `read_files`, `read_subtree`, `set_output`. |
| 37 | Spawn `thinker` with a reasoning problem | Returns sequential thinking output. Thinker has `sequentialthinking` tool. |
| 38 | Spawn `verifier` with a read-only review task | Returns review. Verifier has NO tools (reads only via message history). |
| 39 | Spawn `recorder` with a FID listing task | Returns FID data. Recorder has `code_search`, `read_files`, `write_file`, `set_output`, `transition_phase`. |
| 40 | Spawn `scribe` with a summary task | Returns summary. Scribe has `read_files`, `write_file`, `glob`, `code_search`, `set_output`. |
| 41 | Spawn `forge` with a write task (during GREEN phase) | Writes code. Forge has `write_file`, `str_replace`, `set_output`. |
| 42 | Spawn `scout` with a file-finding task | Returns file paths via glob. Scout has `glob`, `list_directory`, `read_files`, `read_subtree`, `set_output`. |
| 43 | Spawn `researcher-web` with a web search task | Returns search results OR network error. |
| 44 | Spawn `researcher-docs` with a doc lookup task | Returns docs OR backend error. |

### C.2 Orchestrator Tool Restrictions

| # | Test | Expected |
|---|------|----------|
| 45 | Verify Orchestrator does NOT have `write_file` | Not in toolNames |
| 46 | Verify Orchestrator does NOT have `str_replace` | Not in toolNames |
| 47 | Verify Orchestrator does NOT have `apply_patch` | Not in toolNames |
| 48 | Verify Orchestrator DOES have `spawn_agents` | In toolNames |
| 49 | Verify Orchestrator DOES have `transition_phase` | In toolNames |
| 50 | Verify Orchestrator DOES have `read_files` | In toolNames |
| 51 | Verify Orchestrator DOES have `set_output` | In toolNames |

### C.3 Separation of Duties

| # | Test | Expected |
|---|------|----------|
| 52 | Verify Detective does NOT have `write_file` | Read-only agent |
| 53 | Verify Verifier does NOT have any tools | Pure reader |
| 54 | Verify Forge DOES have `write_file` and `str_replace` | Code writer |
| 55 | Verify Scout does NOT have `write_file` | Read-only agent |
| 56 | Verify Thinker does NOT have `write_file` | Reasoning only |

### C.4 FSM Phase Inheritance (FID-004)

| # | Test | Expected |
|---|------|----------|
| 57 | Transition to GREEN phase | Phase is "green" |
| 58 | Spawn a subagent in GREEN phase | Subagent's `fsmPhase` is "green" (inherited from parent) |
| 59 | Verify subagent can use write tools in inherited GREEN phase | Write succeeds without "only available during GREEN phase" error |
| 60 | Transition to AUDIT phase | Phase is "audit" |
| 61 | Spawn a subagent in AUDIT phase | Subagent's `fsmPhase` is "audit" (inherited) |
| 62 | Verify subagent can use bash in inherited AUDIT phase | Bash succeeds |

---

## SECTION D: INTEGRATION SMOKE TESTS

End-to-end tests that exercise multiple changes together.

### D.1 Scout Finds → Orchestrator Reads

| # | Test | Expected |
|---|------|----------|
| 63 | Spawn Scout to find "MCP timeout files" | Returns `common/src/mcp/client.ts`, `common/src/types/mcp.ts`, etc. |
| 64 | Use `read_files` on Scout's results | File contents returned successfully |
| 65 | Verify the returned files contain `withTimeout` | The MCP timeout changes are present in the files |

### D.2 Full Agent Pipeline

| # | Test | Expected |
|---|------|----------|
| 66 | Spawn Scout to find "FSM enforcement files" | Returns relevant paths |
| 67 | Spawn Detective on those paths to search for `fsmPhase` | Returns code evidence |
| 68 | Spawn Thinker to analyze the evidence | Returns analysis |
| 69 | Spawn Verifier to review the analysis | Returns review (read-only) |
| 70 | All 4 agents complete without error | Pipeline works end-to-end |

### D.3 MCP Config Schema

| # | Test | Expected |
|---|------|----------|
| 71 | Read `common/src/types/mcp.ts` | Verify `timeout` field present in both schemas |
| 72 | Verify `z.strictObject` still works with optional `timeout` | Existing configs without timeout parse correctly |
| 73 | Verify a config with `timeout: 5000` parses correctly | Positive number accepted |

---

## REPORTING FORMAT

For each test item, report:

```
[T] SECTION — PASS/FAIL — Evidence
```

Where:
- `T` = test number (001-073)
- `PASS` = behavior matches expected
- `FAIL` = behavior differs from expected (capture exact error)
- `Evidence` = first 150 chars of response or exact error message

### Summary Table

| Section | Total | Pass | Fail | Skip |
|---------|-------|------|------|------|
| A: Scout File-Finding | 18 | | | |
| B: MCP Proxy Timeout | 17 | | | |
| C: Agent Roster Alignment | 27 | | | |
| D: Integration Smoke Tests | 11 | | | |
| **TOTAL** | **73** | | | |

---

## CRITICAL RULES

1. **Do not skip any test.** Every item must be attempted.
2. **Capture exact errors.** Do not paraphrase error messages.
3. **Test Scout's glob behavior explicitly.** Verify it searches file NAMES, not contents.
4. **Test timeout infrastructure exists.** Read the source files and verify the code is present.
5. **Test agent tool isolation.** Verify each agent has exactly the tools specified.
6. **Test FSM inheritance.** Verify subagents inherit parent phase.
7. **Clean up after yourself.** Delete any test files created.
8. **Report honestly.** A PASS with a concern is different from a FAIL.

---

## EXPECTED OUTCOME

If all changes from FID-006 and FID-007 are correctly deployed:
- Scout uses glob directly (no Detective delegation)
- MCP client has timeout protection on connect, callTool, and listTools
- All 9 Savant agents are spawnable with correct tool sets
- Orchestrator has no write tools (strict separation of duties)
- Subagents inherit FSM phase from parent

Any FAIL in Sections A or B indicates the FID changes were not properly deployed.
Any FAIL in Section C indicates the agent roster alignment has regressed.
Any FAIL in Section D indicates integration issues between components.
