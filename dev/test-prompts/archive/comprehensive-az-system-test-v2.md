# Savant-Code — Comprehensive A-Z System Test v2

**Purpose:** Exhaustive functional test of every tool, agent, FSM gate, slash command, skill, CLI behavior, and recent FID change in the Savant-Code harness.

**Version:** 2.0 — incorporates FID-006 (agent roster), FID-007 (Scout + MCP timeout), FID-003 (dev override), FID-004 (FSM inheritance).

**Mode:** Interactive live execution. You MUST call every tool and agent listed below. Report PASS/FAIL for each with evidence. Do not skip any item. If a tool or agent fails, capture the exact error message and continue testing the rest.

**Environment:** The test is running inside the Savant CLI. Assume the ECHO Protocol is active.

---

## PHASE 1: BOOT & IDENTITY

### 1.1 Boot Sequence Verification
| # | Test | Expected |
|---|------|----------|
| 1 | Confirm ECHO.md was loaded at startup | Reference a line from it |
| 2 | Confirm protocol.config.yaml was read | Report `strictMode`, `language`, and any open FIDs |
| 3 | Confirm dev/fids/ was scanned | List all open FIDs by filename |
| 4 | Confirm the agent entered IDLE phase after boot | Phase is "idle" |

### 1.2 Version & Environment
| # | Test | Expected |
|---|------|----------|
| 5 | Run `bun run --version` to confirm CLI version | Returns version string |
| 6 | Confirm which model is active | Check if IS_FREEBUFF or SavantCode mode |
| 7 | Confirm which shell is detected | bash/powershell |

---

## PHASE 2: DIRECT TOOLS — FULL COVERAGE

### 2.1 File Read Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 8 | `read_files` | Read `package.json` and `ECHO.md` simultaneously (2 paths) | Both file contents returned |
| 9 | `read_subtree` | Read `agents/` subtree with maxTokens=2000 | Directory tree with file names and variable names |
| 10 | `list_directory` | List `cli/src/` | Array of filenames and subdirectories |
| 11 | `glob` | Find all `*.ts` files in `agents/` | Matching file paths |
| 12 | `code_search` | Search for `fsmPhase` across `packages/agent-runtime/` | Lines containing the pattern with file paths |
| 13 | `find_files` | Find files related to "tool gating" | Relevant file paths with summaries |

### 2.2 File Write Tools (GREEN phase only)
| # | Tool | Test | Expected |
|---|------|------|----------|
| 14 | `write_file` | Create `dev/test-write.txt` with "test content" | File created (GREEN only) |
| 15 | `str_replace` | Replace "test content" with "replaced content" | Replacement applied (GREEN only) |
| 16 | `apply_patch` | Patch "replaced" to "patched" | Patch applied (GREEN only) |
| 17 | `propose_str_replace` | Propose a replacement (non-committing) | Proposal returned without modifying file |
| 18 | `propose_write_file` | Propose a write (non-committing) | Proposal returned without modifying file |

### 2.3 FSM & Phase Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 19 | `transition_phase` | `idle → red` | Succeeds |
| 20 | `transition_phase` | `red → green` | Succeeds |
| 21 | `transition_phase` | `green → audit` | Succeeds |
| 22 | `transition_phase` | `audit → complete` | Succeeds |
| 23 | `transition_phase` | `complete → idle` | Succeeds |
| 24 | `transition_phase` | `idle → audit` (ILLEGAL) | FAIL: "INVALID FSM transition" |
| 25 | `transition_phase` | `idle → green` (ILLEGAL) | FAIL: "INVALID FSM transition" |
| 26 | `transition_phase` | `audit → green` (ILLEGAL) | FAIL: "INVALID FSM transition" |

### 2.4 FSM Tool Gating Enforcement
| # | Gate | Test | Expected |
|---|------|------|----------|
| 27 | Write in IDLE | `write_file` in IDLE | BLOCKED: "only available during GREEN" |
| 28 | Write in RED | `str_replace` in RED | BLOCKED: "only available during GREEN" |
| 29 | Write in AUDIT | `apply_patch` in AUDIT | BLOCKED: "only available during GREEN" |
| 30 | Write in GREEN | `write_file` in GREEN | SUCCEEDS |
| 31 | Bash in IDLE | `run_terminal_command` in IDLE | BLOCKED: "only available during AUDIT" |
| 32 | Bash in RED | `run_terminal_command` in RED | BLOCKED: "only available during AUDIT" |
| 33 | Bash in GREEN | `run_terminal_command` in GREEN | BLOCKED: "only available during AUDIT" |
| 34 | Bash in AUDIT | `run_terminal_command` in AUDIT | SUCCEEDS |
| 35 | FID path exemption | `write_file` to `dev/fids/test-gate.md` in IDLE | SUCCEEDS (FID paths exempt) |

### 2.5 Subagent / Spawn Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 36 | `spawn_agents` | Spawn `basher` with `echo hello` | Returns "hello" |
| 37 | `spawn_agents` | Spawn `detective` with pattern `fsmPhase` | Returns search results |
| 38 | `spawn_agents` | Spawn `scout` for "tool gating files" | Returns file paths via glob (NOT code_search) |
| 39 | `spawn_agents` | Spawn `thinker-with-files-gemini` on a reasoning problem | Returns analysis |
| 40 | `spawn_agents` | Spawn `verifier` with a review task | Returns review |
| 41 | `spawn_agents` | Spawn `recorder` to list open FIDs | Returns FID list |
| 42 | `spawn_agents` | Spawn `scribe` for a summary | Returns summary |
| 43 | `spawn_agents` | Spawn `detective` for code search | Returns evidence |
| 44 | `spawn_agents` | Spawn `researcher-web` for web search | Returns results OR network error |
| 45 | `spawn_agents` | Spawn `researcher-docs` for doc lookup | Returns docs OR backend error |
| 46 | `spawn_agents` | Spawn `verifier` for code review | Returns review (no tools — reads only) |
| 47 | `spawn_agents` | Spawn `browser-use` to visit a URL | Returns page data OR Chrome error |
| 48 | `spawn_agents` | Spawn `tmux-cli` for CLI testing | Returns results OR tmux-missing error |
| 49 | `spawn_agents` | Spawn INVALID agent `"fake-agent-xyz"` | FAIL: "not available to spawn" |
| 50 | `spawn_agents` | Spawn a TOOL name as agent (`read_files`) | FAIL: "is a tool, not an agent" |

### 2.6 Terminal / System Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 51 | `run_terminal_command` | `echo "savant-test"` (AUDIT phase) | Returns "savant-test" |
| 52 | `run_terminal_command` | `bun --version` (AUDIT phase) | Returns bun version |
| 53 | `run_terminal_command` | `node --version` (AUDIT phase) | Returns node version |
| 54 | `run_terminal_command` | `dir .` (AUDIT phase) | Returns directory listing |

### 2.7 Web / External Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 55 | `web_search` | Search "Savant Code AI" | Results OR network error |
| 56 | `read_url` | Fetch `https://example.com` | Page text OR network error |
| 57 | `read_docs` | Look up React hooks docs | Docs OR backend error |
| 58 | `gravity_index` | Search "serverless database" | Recommendations OR network error |

### 2.8 UI / Presentation Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 59 | `render_ui` | Button: `{ type: "button", text: "Open", link: "https://example.com" }` | "UI rendered." |
| 60 | `render_ui` | Table: `{ type: "table", columns: [...], rows: [...] }` | "UI rendered." |
| 61 | `render_ui` | Badge: `{ type: "badge", label: "Active", variant: "success" }` | "UI rendered." |
| 62 | `render_ui` | Stepper: `{ type: "stepper", steps: [...], current: 1 }` | "UI rendered." |
| 63 | `render_ui` | Card: `{ type: "card", title: "FID-001", summary: "Test" }` | "UI rendered." |
| 64 | `render_ui` | Perfection loop: `{ type: "perfection_loop", phase: "green", iteration: 3 }` | "UI rendered." |
| 65 | `suggest_followups` | Generate suggestions for "implement auth" | Returns clickable suggestions |

### 2.9 Reasoning / Planning Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 66 | `sequentialthinking` | Call from Orchestrator | BLOCKED: "only available to Thinker agents" |
| 67 | `write_todos` | Create a 3-item todo list | Returns confirmation |
| 68 | `ask_user` | Ask a multiple-choice question | Returns user response or skip |

### 2.10 Agent State / Messaging Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 69 | `set_output` | Set output with a data payload | Confirmation |
| 70 | `lookup_agent_info` | Look up agent "basher" | Returns agent definition |
| 71 | `skill` | Load `coding-typescript` | Returns SKILL.md content |
| 72 | `skill` | Load `release-workflow` | Returns SKILL.md content |
| 73 | `skill` | Load NONEXISTENT `fake-skill-xyz` | Graceful error |

### 2.11 FID / Tracking Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 74 | `add_subgoal` | Add a subgoal | Confirmation |
| 75 | `update_subgoal` | Update subgoal status | Confirmation |
| 76 | `create_plan` | Create a plan with file changes | Confirmation |
| 77 | `task_completed` | Mark task completed | Confirmation |

---

## PHASE 3: DEV OVERRIDE SYSTEM (FID-003)

### 3.1 Activation
| # | Test | Expected |
|---|------|----------|
| 78 | Type `/dev wrong-passphrase` | "Command not found" |
| 79 | Type `/dev echo-alpha-7749` | "Dev override activated." |
| 80 | Verify sidebar `[DEV MODE]` badge | Badge visible in red |
| 81 | Type `/dev off` | "Dev override deactivated." |
| 82 | Verify badge disappears | No badge |

### 3.2 Bypass — Write Tools (any phase)
| # | Test | Expected |
|---|------|----------|
| 83 | Activate dev, stay IDLE, call `write_file` | SUCCEEDS |
| 84 | Call `str_replace` in IDLE with dev active | SUCCEEDS |
| 85 | Call `apply_patch` in IDLE with dev active | SUCCEEDS |

### 3.3 Bypass — Bash (any phase)
| # | Test | Expected |
|---|------|----------|
| 86 | Dev active in IDLE, `run_terminal_command echo dev-test` | SUCCEEDS |
| 87 | Transition RED, `run_terminal_command echo red-test` | SUCCEEDS |

### 3.4 Bypass — Sequential Thinking (any agent)
| # | Test | Expected |
|---|------|----------|
| 88 | Dev active, call `sequentialthinking` from Orchestrator | SUCCEEDS |

### 3.5 Bypass — Agent Tool Restrictions
| # | Test | Expected |
|---|------|----------|
| 89 | Dev active, spawn `basher` → call `write_file` | SUCCEEDS |

### 3.6 Persistence & Reset
| # | Test | Expected |
|---|------|----------|
| 90 | Dev active, type `/new` | Dev mode resets |
| 91 | Verify badge gone after `/new` | No badge |
| 92 | Verify write tools blocked again after `/new` | BLOCKED in IDLE |

### 3.7 Invisibility
| # | Test | Expected |
|---|------|----------|
| 93 | `/help` — verify `/dev` NOT listed | Absent |
| 94 | `/dev` with no args | "Command not found" |
| 95 | Verify `/dev` not in autocomplete | Not in command list |

### 3.8 Cleanup
| # | Test | Expected |
|---|------|----------|
| 96 | Delete test files, verify dev mode off | Clean state |

---

## PHASE 4: SLASH COMMANDS

| # | Command | Expected |
|---|---------|----------|
| 97 | `/help` | Keyboard shortcuts and tips |
| 98 | `/diagnostics` | CLI resource usage |
| 99 | `/new` | Clears conversation |
| 100 | `/history` | Conversation browser |
| 101 | `/copy` | Copies to clipboard |
| 102 | `/theme:toggle` | Toggles light/dark |
| 103 | `/review` | Code review mode |
| 104 | `/interview` | AI flesh-out questions |
| 105 | `/plan` | Implementation plan (SavantFree-only) |
| 106 | `/feedback` | Feedback prompt |
| 107 | `/bash` | Bash mode |
| 108 | `/logout` | Signs out |
| 109 | `/exit` | Quits CLI |
| 110 | `/skill:coding-typescript` | Loads TS skill |
| 111 | `/skill:coding-python` | Loads Python skill |
| 112 | `/skill:coding-rust` | Loads Rust skill |
| 113 | `/skill:coding-go` | Loads Go skill |
| 114 | `/skill:coding-java` | Loads Java skill |
| 115 | `/skill:coding-csharp` | Loads C# skill |
| 116 | `/skill:sequential-thinking` | Loads thinking skill |
| 117 | `/skill:release-workflow` | Loads release skill |
| 118 | `/connect` (SavantFree) | Connects OR "not available" |
| 119 | `/end-session` (SavantFree) | Ends free session |
| 120 | `help` (no slash) | Same as `/help` |
| 121 | `new` (no slash) | Same as `/new` |
| 122 | `exit` (no slash) | Same as `/exit` |

---

## PHASE 5: AGENT ROSTER & SEPARATION OF DUTIES (FID-006)

### 5.1 All 9 Savant Agents Spawnable
| # | Agent | Test | Expected |
|---|-------|------|----------|
| 123 | Detective | Spawn with code search task | Returns evidence with file paths |
| 124 | Thinker | Spawn with reasoning problem | Returns sequential thinking output |
| 125 | Verifier | Spawn with review task | Returns review (NO tools — reads only) |
| 126 | Recorder | Spawn with FID listing task | Returns FID data |
| 127 | Scribe | Spawn with summary task | Returns session summary |
| 128 | Forge | Spawn with write task (GREEN phase) | Writes code, returns confirmation |
| 129 | Scout | Spawn with file-finding task | Returns file paths via glob |
| 130 | Researcher-Web | Spawn with web search | Results OR network error |
| 131 | Researcher-Docs | Spawn with doc lookup | Docs OR backend error |

### 5.2 Orchestrator Tool Restrictions
| # | Test | Expected |
|---|------|----------|
| 132 | Verify Orchestrator HAS `write_file` | In toolNames (scratchpad + exempt paths) |
| 133 | Verify Orchestrator HAS `str_replace` | In toolNames (scratchpad + exempt paths) |
| 134 | Verify Orchestrator does NOT have `apply_patch` | Not in toolNames |
| 135 | Verify Orchestrator DOES have `spawn_agents` | In toolNames |
| 136 | Verify Orchestrator DOES have `transition_phase` | In toolNames |
| 137 | Verify Orchestrator DOES have `read_files` | In toolNames |
| 138 | Verify Orchestrator DOES have `set_output` | In toolNames |

### 5.3 Separation of Duties
| # | Agent | Test | Expected |
|---|-------|------|----------|
| 139 | Detective | Try `write_file` | BLOCKED: not in toolNames |
| 140 | Verifier | Try ANY tool | BLOCKED: toolNames=[] |
| 141 | Forge | Try `spawn_agents` | BLOCKED: not in toolNames |
| 142 | Scout | Try `write_file` | BLOCKED: not in toolNames |
| 143 | Thinker | Call `sequentialthinking` | SUCCEEDS |
| 144 | Orchestrator | Call `sequentialthinking` | BLOCKED: "only to Thinker agents" |

### 5.4 Agent Identity
| # | Test | Expected |
|---|------|----------|
| 145 | Spawn all 9 core agents in parallel | All spawn without error |
| 146 | Verify agent depth limit (MAX_AGENT_DEPTH=5) | 6th-level nesting blocked |
| 147 | Verify tool names match ARCHITECTURE.md spec | Each agent's tools match spec table |

---

## PHASE 6: SCOUT FILE-FINDING (FID-007 Fix A)

### 6.1 Basic File Finding
| # | Test | Expected |
|---|------|----------|
| 148 | Scout: "Find files related to tool gating" | Returns paths with "tool"/"gating" in NAMES, not contents |
| 149 | Scout: "Find agent definition files" | Returns `agents/*/` files, `agent-definition.ts`, etc. |
| 150 | Scout: "Find MCP client files" | Returns `common/src/mcp/client.ts`, etc. |
| 151 | Scout: "Find configuration files" | Returns `package.json`, `tsconfig.json`, etc. |

### 6.2 Multi-Keyword Extraction
| # | Test | Expected |
|---|------|----------|
| 152 | Scout: "find auth service files" | Extracts `auth`, `service`. Globs for both. |
| 153 | Scout: "show me the database schema files" | Extracts `database`, `schema`. Stop words stripped. |
| 154 | Scout: "I need to look at the error handling code" | Extracts `error`, `handling`, `code`. |

### 6.3 Edge Cases
| # | Test | Expected |
|---|------|----------|
| 155 | Scout: "files" (single stop word) | Falls back gracefully. No crash. |
| 156 | Scout: "Find [test] files with * special chars" | Strips `[`, `]`, `*`. No broken glob. |
| 157 | Scout: empty prompt | Handles gracefully. No crash. |

### 6.4 No Detective Delegation
| # | Test | Expected |
|---|------|----------|
| 158 | Observe Scout's tool calls | Sees `glob` calls, NOT `spawn_agents` with detective |
| 159 | Verify Scout's spawnableAgents is empty | No spawnable agents |

### 6.5 Scout Tool Set
| # | Test | Expected |
|---|------|----------|
| 160 | Scout has `glob` | Can call directly |
| 161 | Scout has `list_directory` | Can call directly |
| 162 | Scout has `read_files` | Can read results |
| 163 | Scout has `read_subtree` | Can explore subtrees |
| 164 | Scout does NOT have `write_file` | Read-only |
| 165 | Scout does NOT have `str_replace` | Read-only |

---

## PHASE 7: MCP PROXY TIMEOUT (FID-007 Fix B)

### 7.1 Timeout Infrastructure (source verification)
| # | Test | Expected |
|---|------|----------|
| 166 | Read `common/src/types/mcp.ts` — verify `timeout` field | Present in both schemas as `z.number().positive().optional()` |
| 167 | Read `common/src/mcp/client.ts` — verify `withTimeout` | Uses `Promise.race` + `setTimeout` + `.finally(clearTimeout)` |
| 168 | Verify `MAX_TIMEOUT_MS` constant | Value is `300_000` (5 min) |
| 169 | Verify `DEFAULT_CONNECT_TIMEOUT_MS` | Value is `30_000` (30s) |
| 170 | Verify `DEFAULT_TOOL_TIMEOUT_MS` | Value is `60_000` (60s) |

### 7.2 Connect Timeout
| # | Test | Expected |
|---|------|----------|
| 171 | `getMCPClient()` — `client.connect()` wrapped with `withTimeout` | Present |
| 172 | `getMCPClient()` — `transport.close()` in catch block | Present (prevents orphaned processes) |
| 173 | `getMCPClient()` — timeout clamped via `clampTimeout()` | Present |

### 7.3 Tool Call & List Timeout
| # | Test | Expected |
|---|------|----------|
| 174 | `callMCPTool()` — `client.callTool()` wrapped with `withTimeout` | Present |
| 175 | `listMCPTools()` — `client.listTools()` wrapped with `withTimeout` | Present |
| 176 | `listMCPTools()` — cache clears on rejection | `.catch()` with `delete listToolsCache[clientId]` |

### 7.4 Client Timeout Map
| # | Test | Expected |
|---|------|----------|
| 177 | `clientTimeouts` declaration | `Record<string, number> = {}` |
| 178 | `clientTimeouts[key]` set on successful connect | Set after `runningClients[key] = client` |

### 7.5 Clamp Function
| # | Test | Expected |
|---|------|----------|
| 179 | `clampTimeout()` function | `Math.min(Math.max(Math.round(value), 1), MAX_TIMEOUT_MS)` |
| 180 | `clampTimeout(undefined, 30000)` | Returns 30000 (default) |
| 181 | `clampTimeout(999999999, 30000)` | Returns 300000 (clamped) |

---

## PHASE 8: FSM PHASE INHERITANCE (FID-004)

| # | Test | Expected |
|---|------|----------|
| 182 | Transition to GREEN phase | Phase is "green" |
| 183 | Spawn subagent in GREEN | Subagent's `fsmPhase` is "green" (inherited) |
| 184 | Subagent uses write tools in inherited GREEN | Write succeeds |
| 185 | Transition to AUDIT phase | Phase is "audit" |
| 186 | Spawn subagent in AUDIT | Subagent's `fsmPhase` is "audit" (inherited) |
| 187 | Subagent uses bash in inherited AUDIT | Bash succeeds |

---

## PHASE 9: ECHO PERFECTION LOOP

### 9.1 Full Loop Execution
| Step | Action | Expected |
|------|--------|----------|
| 188 | Start in IDLE | Phase is "idle" |
| 189 | `transition_phase` to RED | Phase is "red" |
| 190 | Spawn Detective to analyze a code section | Returns issue catalog |
| 191 | `transition_phase` to GREEN | Phase is "green" |
| 192 | Write FID to `dev/fids/FID-TEST-*.md` | File created (FID exemption) |
| 193 | `transition_phase` to AUDIT | Phase is "audit" |
| 194 | Run `bun --version` via `run_terminal_command` | Returns version |
| 195 | `transition_phase` to COMPLETE | Phase is "complete" |
| 196 | `transition_phase` to IDLE | Phase is "idle" — loop closed |
| 197 | Clean up test FID | Delete `dev/fids/FID-TEST-*.md` |

### 9.2 Self-Correct Loop
| Step | Action | Expected |
|------|--------|----------|
| 198 | RED → GREEN → AUDIT | Phase is "audit" |
| 199 | AUDIT → SELF_CORRECT | Phase is "self_correct" |
| 200 | SELF_CORRECT → GREEN | Phase is "green" (loop back) |
| 201 | GREEN → AUDIT → COMPLETE | Loop completes |

### 9.3 Circuit Breaker
| # | Test | Expected |
|---|------|----------|
| 202 | Verify iterationCount in agent state | Starts at 0 |
| 203 | After 10 self_correct iterations | Hard stop at 10 |

---

## PHASE 10: INTEGRATION SMOKE TESTS

### 10.1 Scout → Read Pipeline
| # | Test | Expected |
|---|------|----------|
| 204 | Scout finds "MCP timeout files" | Returns `common/src/mcp/client.ts`, etc. |
| 205 | `read_files` on Scout's results | Contents returned |
| 206 | Verify files contain `withTimeout` | MCP timeout changes present |

### 10.2 Full Agent Pipeline
| # | Test | Expected |
|---|------|----------|
| 207 | Scout finds "FSM enforcement files" | Returns relevant paths |
| 208 | Detective searches those paths for `fsmPhase` | Returns code evidence |
| 209 | Thinker analyzes the evidence | Returns analysis |
| 210 | Verifier reviews the analysis | Returns review (read-only) |
| 211 | All 4 agents complete without error | Pipeline works end-to-end |

### 10.3 MCP Config Schema
| # | Test | Expected |
|---|------|----------|
| 212 | Read `common/src/types/mcp.ts` | `timeout` field in both schemas |
| 213 | `z.strictObject` works with optional `timeout` | Existing configs parse correctly |
| 214 | Config with `timeout: 5000` parses | Positive number accepted |

---

## PHASE 11: NOVA COMMUNICATION PROTOCOL

| # | Test | Expected |
|---|------|----------|
| 215 | List `dev/nova/inbox/` | Shows contents |
| 216 | List `dev/nova/outbox/` | Shows contents |
| 217 | If inbox has message, read and process | Read and respond |
| 218 | Write response to `dev/nova/outbox/` | File created |
| 219 | Verify archive folders exist | Both archive dirs present |

---

## PHASE 12: SKILLS SYSTEM

| # | Test | Expected |
|---|------|----------|
| 220 | Load `coding-typescript` | TS conventions + ECHO overrides |
| 221 | Load `coding-python` | Python conventions |
| 222 | Load `coding-rust` | Rust conventions |
| 223 | Load `coding-go` | Go conventions |
| 224 | Load `coding-java` | Java conventions |
| 225 | Load `coding-csharp` | C# conventions |
| 226 | Load `sequential-thinking` | Stepwise reasoning |
| 227 | Load `release-workflow` | Release conventions |
| 228 | Load `find-skills` | Skill discovery |
| 229 | Load `gepeto` | Pinokio guide |
| 230 | Load `pinokio` | App discovery |
| 231 | Verify `.agents/skills/` has all SKILL.md | 7 directories present (4 skills are preloaded, not in dirs) |

---

## PHASE 13: CLI EDGE CASES

| # | Test | Expected |
|---|------|----------|
| 232 | Send empty message | Graceful handling |
| 233 | Send very long message (5000+ chars) | No truncation error |
| 234 | Send special chars (`<script>`, backticks) | Processed safely |
| 235 | Rapid successive messages | Sequential handling |
| 236 | Send during agent processing | Queued/rejected gracefully |

---

## PHASE 14: KNOWLEDGE FILES

| # | Test | Expected |
|---|------|----------|
| 237 | `ECHO.md` loaded as knowledge | Referenced in system prompt |
| 238 | `LEARNINGS.md` loaded | Referenced |
| 239 | `AGENTS.md` loaded | Referenced |
| 240 | `ARCHITECTURE.md` loaded | Referenced |
| 241 | `STARTER-PROMPT.md` loaded | Referenced |

---

## PHASE 15: CROSS-PACKAGE TYPECHECK

| # | Test | Expected |
|---|------|----------|
| 242 | `common/` typecheck | Zero errors |
| 243 | `packages/agent-runtime/` typecheck | Zero errors |
| 244 | `cli/` typecheck | Zero errors |
| 245 | `sdk/` typecheck | Zero errors |
| 246 | `agents/` typecheck | Zero errors |

---

## REPORTING FORMAT

```
[T] PHASE — PASS/FAIL — Evidence
```

### Summary Table

| Phase | Category | Total | Pass | Fail | Skip |
|-------|----------|-------|------|------|------|
| 1 | Boot & Identity | 7 | | | |
| 2 | Direct Tools | 70 | | | |
| 3 | Dev Override | 19 | | | |
| 4 | Slash Commands | 26 | | | |
| 5 | Agent Roster & Separation | 25 | | | |
| 6 | Scout File-Finding | 18 | | | |
| 7 | MCP Proxy Timeout | 16 | | | |
| 8 | FSM Inheritance | 6 | | | |
| 9 | Perfection Loop | 16 | | | |
| 10 | Integration Smoke | 11 | | | |
| 11 | Nova Protocol | 5 | | | |
| 12 | Skills System | 12 | | | |
| 13 | CLI Edge Cases | 5 | | | |
| 14 | Knowledge Files | 5 | | | |
| 15 | Cross-Package Typecheck | 5 | | | |
| **TOTAL** | | **246** | | | |

---

## CRITICAL RULES

1. **Do not skip any test.** Every item must be attempted.
2. **Capture exact errors.** Do not paraphrase error messages.
3. **Test tool gating explicitly.** Write in non-GREEN, bash in non-AUDIT.
4. **Test agent isolation.** Try tools an agent shouldn't have.
5. **Test Scout's glob behavior.** Verify file NAMES, not contents.
6. **Test MCP timeout infrastructure.** Read source, verify code exists.
7. **Test FSM inheritance.** Verify subagents inherit parent phase.
8. **Test the full Perfection Loop.** IDLE → RED → GREEN → AUDIT → COMPLETE → IDLE.
9. **Clean up after yourself.** Delete test files.
10. **Report honestly.** PASS-WITH-CAVEAT if needed.
