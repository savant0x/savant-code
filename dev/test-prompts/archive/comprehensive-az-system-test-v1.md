# Savant-Code — Comprehensive A-Z System Test Prompt

**Purpose:** Exhaustive functional test of every tool, agent, FSM gate, slash command, skill, and CLI behavior in the Savant-Code harness.

**Mode:** Interactive live execution. You MUST call every tool and agent listed below. Report PASS/FAIL for each with evidence. Do not skip any item. If a tool or agent fails, capture the exact error message and continue testing the rest.

**Environment:** The test is running inside the Savant CLI. Assume the ECHO Protocol is active.

---

## PHASE 1: BOOT & IDENTITY

### 1.1 Boot Sequence Verification
- [ ] Confirm ECHO.md was loaded at startup (reference a line from it)
- [ ] Confirm protocol.config.yaml was read (report `strictMode`, `language`, and any open FIDs)
- [ ] Confirm dev/fids/ was scanned — list all open FIDs by filename
- [ ] Confirm the agent entered IDLE phase after boot

### 1.2 Version & Environment
- [ ] Run `bun run --version` to confirm CLI version
- [ ] Confirm which model is active (check if IS_FREEBUFF or SavantCode mode)
- [ ] Confirm which shell is detected (bash/powershell)

---

## PHASE 2: DIRECT TOOLS — FULL COVERAGE

Test every tool listed below. For each, provide the exact call you made and the result.

### 2.1 File Read Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 1 | `read_files` | Read `package.json` and `ECHO.md` simultaneously (2 paths) | Both file contents returned |
| 2 | `read_subtree` | Read `agents/` subtree with maxTokens=2000 | Directory tree with file names and variable names |
| 3 | `list_directory` | List `cli/src/` | Array of filenames and subdirectories |
| 4 | `glob` | Find all `*.ts` files in `agents/` | Matching file paths |
| 5 | `code_search` | Search for `fsmPhase` across `packages/agent-runtime/` | Lines containing the pattern with file paths |
| 6 | `find_files` | Find files related to "tool gating" | Relevant file paths with summaries |

### 2.2 File Write Tools (GREEN phase only — must test in/out of phase)
| # | Tool | Test | Expected |
|---|------|------|----------|
| 7 | `write_file` | Create a test file `dev/test-write.txt` with "test content" | File created. **Do this during GREEN phase only.** |
| 8 | `str_replace` | Replace "test content" with "replaced content" in `dev/test-write.txt` | Replacement applied. **GREEN phase only.** |
| 9 | `apply_patch` | Apply a patch to `dev/test-write.txt` changing "replaced" to "patched" | Patch applied. **GREEN phase only.** |
| 10 | `propose_str_replace` | Propose a replacement (non-committing) on `dev/test-write.txt` | Proposal returned without modifying file |
| 11 | `propose_write_file` | Propose a write (non-committing) on `dev/test-write.txt` | Proposal returned without modifying file |

### 2.3 FSM & Phase Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 12 | `transition_phase` | `idle → red` | Succeeds: "Transitioned to RED" |
| 13 | `transition_phase` | `red → green` | Succeeds: "Transitioned to GREEN" |
| 14 | `transition_phase` | `green → audit` | Succeeds: "Transitioned to AUDIT" |
| 15 | `transition_phase` | `audit → complete` | Succeeds: "Transitioned to COMPLETE" |
| 16 | `transition_phase` | `complete → idle` | Succeeds: "Transitioned to IDLE" |
| 17 | `transition_phase` | `idle → audit` (ILLEGAL) | **FAIL expected:** "INVALID FSM transition" |
| 18 | `transition_phase` | `idle → green` (ILLEGAL) | **FAIL expected:** "INVALID FSM transition" |
| 19 | `transition_phase` | `audit → green` (ILLEGAL) | **FAIL expected:** "INVALID FSM transition" |

### 2.4 FSM Tool Gating Enforcement
| # | Gate | Test | Expected |
|---|------|------|----------|
| 20 | Write tools in IDLE | Call `write_file` while phase is IDLE | **BLOCKED:** "only available during the GREEN phase" |
| 21 | Write tools in RED | Call `str_replace` while phase is RED | **BLOCKED:** "only available during the GREEN phase" |
| 22 | Write tools in AUDIT | Call `apply_patch` while phase is AUDIT | **BLOCKED:** "only available during the GREEN phase" |
| 23 | Write tools in GREEN | Call `write_file` while phase is GREEN | **SUCCEEDS** |
| 24 | Bash in IDLE | Call `run_terminal_command` while phase is IDLE | **BLOCKED:** "only available during the AUDIT phase" |
| 25 | Bash in RED | Call `run_terminal_command` while phase is RED | **BLOCKED:** "only available during the AUDIT phase" |
| 26 | Bash in GREEN | Call `run_terminal_command` while phase is GREEN | **BLOCKED:** "only available during the AUDIT phase" |
| 27 | Bash in AUDIT | Call `run_terminal_command` while phase is AUDIT | **SUCCEEDS** |
| 28 | FID path exemption | Call `write_file` to `dev/fids/test-gate.md` in IDLE phase | **SUCCEEDS** (FID paths exempt from write gate) |

### 2.5 Subagent / Spawn Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 29 | `spawn_agents` | Spawn `basher` with command `echo hello` | Returns "hello" output |
| 30 | `spawn_agents` | Spawn `code-searcher` with pattern `fsmPhase` | Returns search results |
| 31 | `spawn_agents` | Spawn `file-picker` for "tool gating files" | Returns file list |
| 32 | `spawn_agents` | Spawn `thinker-with-files-gemini` on a reasoning problem | Returns analysis |
| 33 | `spawn_agents` | Spawn `verifier` with a read-only review task | Returns review |
| 34 | `spawn_agents` | Spawn `recorder` to list open FIDs | Returns FID list |
| 35 | `spawn_agents` | Spawn `scribe` for a summary | Returns summary |
| 36 | `spawn_agents` | Spawn `detective` for code search | Returns evidence |
| 37 | `spawn_agents` | Spawn `scout` for file discovery | Returns file paths |
| 38 | `spawn_agents` | Spawn `researcher-web` for web search | Returns search results OR network error |
| 39 | `spawn_agents` | Spawn `researcher-docs` for doc lookup | Returns docs OR backend error |
| 40 | `spawn_agents` | Spawn `code-reviewer-mimo-pro` for code review | Returns review |
| 41 | `spawn_agents` | Spawn `opus-agent` for a problem | Returns analysis |
| 42 | `spawn_agents` | Spawn `gpt-5-agent` for a problem | Returns analysis |
| 43 | `spawn_agents` | Spawn `browser-use` to visit a URL | Returns page data OR Chrome error |
| 44 | `spawn_agents` | Spawn `tmux-cli` for CLI testing | Returns test results OR tmux-missing error |
| 45 | `spawn_agents` | Spawn INVALID agent type `"fake-agent-xyz"` | **FAIL expected:** "not available to spawn" |
| 46 | `spawn_agents` | Spawn a TOOL name as an agent (e.g., `read_files`) | **FAIL expected:** "is a tool, not an agent" |

### 2.6 Terminal / System Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 47 | `run_terminal_command` | Run `echo "savant-test"` (in AUDIT phase) | Returns "savant-test" |
| 48 | `run_terminal_command` | Run `bun --version` (in AUDIT phase) | Returns bun version |
| 49 | `run_terminal_command` | Run `node --version` (in AUDIT phase) | Returns node version |
| 50 | `run_terminal_command` | Run `dir .` (in AUDIT phase) | Returns directory listing |

### 2.7 Web / External Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 51 | `web_search` | Search "Savant Code AI" | Returns results OR network error |
| 52 | `read_url` | Fetch `https://example.com` | Returns page text OR network error |
| 53 | `read_docs` | Look up React hooks documentation | Returns docs OR backend error |
| 54 | `gravity_index` | Search for "serverless database" | Returns recommendations OR network error |

### 2.8 UI / Presentation Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 55 | `render_ui` | Render button widget: `{ type: "button", text: "Open Docs", link: "https://example.com" }` | "UI rendered." |
| 56 | `render_ui` | Render table widget: `{ type: "table", columns: [...], rows: [...] }` | "UI rendered." |
| 57 | `render_ui` | Render badge widget: `{ type: "badge", label: "Active", variant: "success" }` | "UI rendered." |
| 58 | `render_ui` | Render stepper widget: `{ type: "stepper", steps: [...], current: 1 }` | "UI rendered." |
| 59 | `render_ui` | Render card widget: `{ type: "card", title: "FID-001", summary: "Test" }` | "UI rendered." |
| 60 | `render_ui` | Render perfection_loop widget: `{ type: "perfection_loop", phase: "green", iteration: 3 }` | "UI rendered." |
| 61 | `suggest_followups` | Generate follow-up suggestions for "implement auth" | Returns clickable suggestions |

### 2.9 Reasoning / Planning Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 62 | `sequentialthinking` | Call with thought="Analyzing the problem...", thoughtNumber=1, totalThoughts=5, nextThoughtNeeded=true | Returns thought response. **Note: Must be in a Thinker agent context — test from Orchestrator should be BLOCKED.** |
| 63 | `think_deeply` | Call with a complex reasoning prompt | Returns deep analysis |
| 64 | `write_todos` | Create a 3-item todo list | Returns confirmation |
| 65 | `ask_user` | Ask a multiple-choice question | Returns user response or skip |

### 2.10 Agent State / Messaging Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 66 | `set_output` | Set output with a data payload | Confirmation |
| 67 | `set_messages` | (if applicable) Set message history | Confirmation |
| 68 | `add_message` | Add a message to conversation | Confirmation |
| 69 | `lookup_agent_info` | Look up info for agent "basher" | Returns agent definition |
| 70 | `end_turn` | End the current agent step | Ends turn cleanly |
| 71 | `skill` | Load skill `coding-typescript` | Returns SKILL.md content |
| 72 | `skill` | Load skill `release-workflow` | Returns SKILL.md content |
| 73 | `skill` | Load NONEXISTENT skill `fake-skill-xyz` | **FAIL expected:** graceful error |

### 2.11 FID / Tracking Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 74 | `add_subgoal` | Add a subgoal to track progress | Confirmation |
| 75 | `update_subgoal` | Update the subgoal status | Confirmation |
| 76 | `create_plan` | Create a plan with file changes | Confirmation |
| 77 | `task_completed` | Mark a task as completed | Confirmation |
| 78 | `run_file_change_hooks` | Trigger file change hooks | Confirmation |

### 2.12 Special Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 79 | `browser_logs` | (if browser-use is active) Retrieve browser logs | Returns logs or empty |
| 80 | `spawn_agent_inline` | Spawn an inline agent (if supported) | Confirmation or "not available" |

---

## PHASE 2B: DEV OVERRIDE SYSTEM (NEW)

**Prerequisite:** The dev override system was added in FID-2026-0718-003. These tests verify the secret `/dev` command and its bypass behavior.

### 2B.1 Dev Override Activation
| # | Test | Expected |
|---|------|----------|
| 81 | Type `/dev wrong-passphrase` | Shows "Command not found" (indistinguishable from typo) |
| 82 | Type `/dev echo-alpha-7749` | Shows "Dev override activated." in system message |
| 83 | Verify sidebar shows `[DEV MODE]` badge in red | Badge visible in right sidebar |
| 84 | Type `/dev off` | Shows "Dev override deactivated." |
| 85 | Verify sidebar badge disappears | No `[DEV MODE]` badge |

### 2B.2 Dev Override Bypass — Write Tools (any phase)
| # | Test | Expected |
|---|------|----------|
| 86 | Activate dev mode, stay in IDLE phase | Dev mode active, phase is idle |
| 87 | Call `write_file` to `dev/test-dev-override.txt` in IDLE | **SUCCEEDS** (dev override bypasses GREEN gate) |
| 88 | Call `str_replace` on `dev/test-dev-override.txt` in IDLE | **SUCCEEDS** (dev override bypasses GREEN gate) |
| 89 | Call `apply_patch` on `dev/test-dev-override.txt` in IDLE | **SUCCEEDS** (dev override bypasses GREEN gate) |

### 2B.3 Dev Override Bypass — Bash (any phase)
| # | Test | Expected |
|---|------|----------|
| 90 | With dev mode active in IDLE, call `run_terminal_command` with `echo dev-test` | **SUCCEEDS** (dev override bypasses AUDIT gate) |
| 91 | Transition to RED, call `run_terminal_command` with `echo red-test` | **SUCCEEDS** (dev override bypasses AUDIT gate) |

### 2B.4 Dev Override Bypass — Sequential Thinking (any agent)
| # | Test | Expected |
|---|------|----------|
| 92 | With dev mode active, call `sequentialthinking` from Orchestrator | **SUCCEEDS** (dev override bypasses Thinker gate) |

### 2B.5 Dev Override Bypass — Agent Tool Restrictions
| # | Test | Expected |
|---|------|----------|
| 93 | With dev mode active, spawn `basher` and have it call `write_file` | **SUCCEEDS** (dev override bypasses agent tool restrictions) |

### 2B.6 Dev Override Persistence & Reset
| # | Test | Expected |
|---|------|----------|
| 94 | With dev mode active, type `/new` | Dev mode resets to false |
| 95 | Verify sidebar badge gone after `/new` | No `[DEV MODE]` badge |
| 96 | Verify write tools blocked again after `/new` (in IDLE) | **BLOCKED:** "only available during the GREEN phase" |

### 2B.7 Dev Override Invisibility
| # | Test | Expected |
|---|------|----------|
| 97 | Type `/help` — verify `/dev` is NOT listed | `/dev` absent from help output |
| 98 | Type `/dev` with no args — verify behavior | Shows "Command not found" (not a usage hint) |
| 99 | Verify `/dev` does not appear in slash command autocomplete | Not in command list |

### 2B.8 Cleanup
| # | Test | Expected |
|---|------|----------|
| 100 | Delete `dev/test-dev-override.txt` | File removed |
| 101 | Verify dev mode is off | Sidebar has no badge, tools gated normally |

---

## PHASE 3: SLASH COMMANDS

Test every slash command. For each, type the command and verify the response.

| # | Command | Expected |
|---|---------|----------|
| 102 | `/help` | Shows keyboard shortcuts and tips |
| 103 | `/diagnostics` | Shows CLI resource usage and process IDs |
| 104 | `/new` | Clears conversation, starts fresh chat |
| 105 | `/history` | Opens conversation browser |
| 106 | `/copy` | Copies conversation to clipboard |
| 107 | `/theme:toggle` | Toggles light/dark mode |
| 108 | `/review` | Initiates code review mode |
| 109 | `/interview` | AI asks flesh-out questions |
| 110 | `/plan` | Creates implementation plan |
| 111 | `/feedback` | Opens feedback prompt |
| 112 | `/bash` | Enters bash mode |
| 113 | `/logout` | Signs out |
| 114 | `/exit` | Quits CLI |
| 115 | `/skill:coding-typescript` | Loads TypeScript coding skill |
| 116 | `/skill:coding-python` | Loads Python coding skill |
| 117 | `/skill:coding-rust` | Loads Rust coding skill |
| 118 | `/skill:coding-go` | Loads Go coding skill |
| 119 | `/skill:coding-java` | Loads Java coding skill |
| 120 | `/skill:coding-csharp` | Loads C# coding skill |
| 121 | `/skill:sequential-thinking` | Loads sequential thinking skill |
| 122 | `/skill:release-workflow` | Loads release workflow skill |
| 123 | `/connect` (SavantFree only) | Connects ChatGPT account OR shows "not available" |
| 124 | `/end-session` (SavantFree only) | Ends free session |
| 125 | `help` (no slash, implicit) | Same as `/help` |
| 126 | `new` (no slash, implicit) | Same as `/new` |
| 127 | `exit` (no slash, implicit) | Same as `/exit` |

---

## PHASE 4: AGENT-SPECIFIC BEHAVIOR

### 4.1 Tool Isolation
| # | Agent | Test | Expected |
|---|-------|------|----------|
| 128 | Orchestrator | Call `sequentialthinking` directly | **BLOCKED:** "only available to Thinker agents" |
| 129 | Basher | Try to call `write_file` | **BLOCKED:** not in basher's toolNames |
| 130 | Detective | Try to call `write_file` | **BLOCKED:** not in detective's toolNames |
| 131 | Verifier | Try to call ANY tool | **BLOCKED:** verifier has toolNames=[] |
| 132 | Forge | Try to call `spawn_agents` | **BLOCKED:** not in forge's toolNames |
| 133 | Scout | Try to call `write_file` | **BLOCKED:** not in scout's toolNames |
| 134 | Thinker | Call `sequentialthinking` | **SUCCEEDS** (thinker has this tool) |

### 4.2 Agent Identity & Spawning
| # | Test | Expected |
|---|------|----------|
| 135 | Spawn each of the 9 core agents in parallel | All 9 spawn without error |
| 136 | Spawn Orchestrator from Orchestrator | Verify nesting works (depth limit check) |
| 137 | Verify agent depth limit (MAX_AGENT_DEPTH=5) | 6th-level nesting should be blocked |
| 138 | Verify agent tool names match ARCHITECTURE.md spec | Each agent's tools match the spec table |

### 4.3 Agent Output
| # | Test | Expected |
|---|------|----------|
| 139 | Spawn Detective — give it a code search task | Returns evidence with file paths + line numbers |
| 140 | Spawn Forge — give it a write task (during GREEN) | Writes code, returns confirmation |
| 141 | Spawn Verifier — give it a review task | Returns review without modifying files |
| 142 | Spawn Recorder — give it a FID task | Returns FID data |
| 143 | Spawn Scribe — give it a summary task | Returns session summary |
| 144 | Spawn Thinker — give it a reasoning problem | Returns sequential thinking output |

---

## PHASE 5: ECHO PROTOCOL PERFECTION LOOP

### 5.1 Full Loop Execution
Execute the complete Perfection Loop on a trivial task:

| Step | Action | Expected |
|------|--------|----------|
| 145 | Start in IDLE | Phase is "idle" |
| 146 | `transition_phase` to RED | Phase is "red" |
| 147 | Spawn Detective to analyze a small code section | Detective returns issue catalog |
| 148 | `transition_phase` to GREEN | Phase is "green" |
| 149 | Write a FID to `dev/fids/FID-TEST-*.md` | File created (FID path exemption) |
| 150 | `transition_phase` to AUDIT | Phase is "audit" |
| 151 | Run `bun --version` via `run_terminal_command` | Returns version (bash now allowed) |
| 152 | `transition_phase` to COMPLETE | Phase is "complete" |
| 153 | `transition_phase` to IDLE | Phase is "idle" — loop closed |
| 154 | Clean up test FID | Delete `dev/fids/FID-TEST-*.md` |

### 5.2 Self-Correct Loop
| Step | Action | Expected |
|------|--------|----------|
| 155 | `transition_phase` RED → GREEN → AUDIT | Phase is "audit" |
| 156 | `transition_phase` AUDIT → SELF_CORRECT | Phase is "self_correct" |
| 157 | `transition_phase` SELF_CORRECT → GREEN | Phase is "green" (loop back — FSM permits self_correct→green only) |
| 158 | `transition_phase` GREEN → AUDIT → COMPLETE | Full loop completes |

### 5.3 Circuit Breaker
| Step | Action | Expected |
|------|--------|----------|
| 159 | Verify iterationCount exists in agent state | Should start at 0 |
| 160 | After 10 iterations of RED→GREEN→AUDIT→SELF_CORRECT→RED | Should hit hard stop at 10 |

---

## PHASE 6: NOVA COMMUNICATION PROTOCOL

| # | Test | Expected |
|---|------|----------|
| 161 | List `dev/nova/inbox/` | Shows inbox contents (empty or Nova's message) |
| 162 | List `dev/nova/outbox/` | Shows outbox contents |
| 163 | If inbox has a message, read it and process | Read and respond |
| 164 | Write response to `dev/nova/outbox/` | File created |
| 165 | Verify archive folders exist | `dev/nova/inbox/archive/` and `dev/nova/outbox/archive/` |

---

## PHASE 7: SKILLS SYSTEM

| # | Test | Expected |
|---|------|----------|
| 166 | Load `coding-typescript` skill | Returns TypeScript conventions + ECHO overrides |
| 167 | Load `coding-python` skill | Returns Python conventions |
| 168 | Load `coding-rust` skill | Returns Rust conventions |
| 169 | Load `coding-go` skill | Returns Go conventions |
| 170 | Load `coding-java` skill | Returns Java conventions |
| 171 | Load `coding-csharp` skill | Returns C# conventions |
| 172 | Load `sequential-thinking` skill | Returns stepwise reasoning instructions |
| 173 | Load `release-workflow` skill | Returns release cycle conventions |
| 174 | Load `find-skills` skill | Returns skill discovery instructions |
| 175 | Load `gepeto` skill | Returns Pinokio launcher guide |
| 176 | Load `pinokio` skill | Returns app discovery guide |
| 177 | Verify `.agents/skills/` directory has all SKILL.md files | 11 skills present |

---

## PHASE 8: CLI EDGE CASES

| # | Test | Expected |
|---|------|----------|
| 178 | Send empty message | Graceful handling (no crash) |
| 179 | Send very long message (5000+ chars) | Processed without truncation error |
| 180 | Send message with special characters (`<script>`, `rm -rf`, backticks) | Processed safely |
| 181 | Rapid successive messages | Handled sequentially without race conditions |
| 182 | Send message during agent processing | Queued or rejected gracefully |

---

## PHASE 9: KNOWLEDGE FILES

| # | Test | Expected |
|---|------|----------|
| 183 | Check if `ECHO.md` is loaded as knowledge | Referenced in system prompt |
| 184 | Check if `LEARNINGS.md` is loaded as knowledge | Referenced in system prompt |
| 185 | Check if `AGENTS.md` is loaded as knowledge | Referenced in system prompt |
| 186 | Check if `ARCHITECTURE.md` is loaded as knowledge | Referenced in system prompt |
| 187 | Check if `STARTER-PROMPT.md` is loaded as knowledge | Referenced in system prompt |

---

## PHASE 10: CROSS-PACKAGE INTEGRATION

| # | Test | Expected |
|---|------|----------|
| 188 | Verify `common/` typecheck passes | Zero errors |
| 189 | Verify `packages/agent-runtime/` typecheck passes | Zero errors |
| 190 | Verify `cli/` typecheck passes | Zero errors |
| 191 | Verify `sdk/` typecheck passes | Zero errors |
| 192 | Verify `agents/` typecheck passes | Zero errors |

---

## REPORTING FORMAT

For each test item, report:

```
[T] TOOL_NAME — PASS/FAIL — Evidence
```

Where:
- `T` = tool test number (001-192)
- `PASS` = tool responded correctly
- `FAIL` = tool returned unexpected error or wrong behavior
- `Evidence` = first 100 chars of response or exact error message

### Summary Table

At the end, produce:

| Category | Total | Pass | Fail | Skip |
|----------|-------|------|------|------|
| File Read Tools | 6 | | | |
| File Write Tools | 5 | | | |
| FSM & Phase Tools | 8 | | | |
| FSM Tool Gating | 9 | | | |
| Subagent / Spawn | 18 | | | |
| Terminal Tools | 4 | | | |
| Web / External | 4 | | | |
| UI / Presentation | 7 | | | |
| Reasoning / Planning | 4 | | | |
| Agent State / Messaging | 8 | | | |
| FID / Tracking | 5 | | | |
| Special Tools | 2 | | | |
| **Dev Override** | **21** | | | |
| Slash Commands | 26 | | | |
| Agent Behavior | 17 | | | |
| Perfection Loop | 16 | | | |
| Nova Communication | 5 | | | |
| Skills System | 12 | | | |
| CLI Edge Cases | 5 | | | |
| Knowledge Files | 5 | | | |
| Cross-Package | 5 | | | |
| **TOTAL** | **192** | | | |

---

## CRITICAL RULES

1. **Do not skip any test.** Every item must be attempted.
2. **Capture exact errors.** Do not paraphrase error messages.
3. **Test tool gating explicitly.** Call write tools in non-GREEN phases and bash in non-AUDIT phases to verify enforcement.
4. **Test agent isolation.** Try calling tools that an agent shouldn't have.
5. **Test the full Perfection Loop.** The IDLE → RED → GREEN → AUDIT → COMPLETE → IDLE cycle must be exercised end-to-end.
6. **Clean up after yourself.** Delete any test files created during the test.
7. **Report honestly.** A PASS with a concern is different from a FAIL. Use PASS-WITH-CAVEAT if needed.
