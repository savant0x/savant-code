# Agents and Tools

> **Last verified:** 2026-07-23 — source reads of all agent definitions + `common/src/tools/constants.ts`.

## Agents

The Savant harness ships 9 canonical agents + 5 helper tool-library agents from the `agents/` workspace. Each agent is a `SecretAgentDefinition` with a restricted tool set — no agent may perform another agent's role (ECHO Law: Separation of Duties).

### Canonical 9-Agent Roster

| # | Agent | ID | Phase | Responsibility | Tools |
|---|-------|----|-------|----------------|-------|
| 1 | **Orchestrator** | `savant` | ALL | Routes work, enforces ECHO Protocol, spawns all agents | `spawn_agents`, `read_files`, `read_subtree`, `run_readonly_command`, `write_todos`, `suggest_followups`, `ask_user`, `read_url`, `skill`, `set_output`, `list_directory`, `glob`, `render_ui`, `gravity_index`, `transition_phase`, `write_file`, `str_replace`, `apply_patch` |
| 2 | **Detective** | `detective` | RED | Codebase analysis, grep call-graphs, catalog evidence | `code_search`, `set_output`, `list_directory`, `glob`, `read_files`, `read_subtree` |
| 3 | **Forge** | `forge` | GREEN | Implementation only — writes code from converged FID | `write_file`, `str_replace`, `set_output` |
| 4 | **Verifier** | `verifier` | AUDIT | Double-audit, run tests, check call-graph reachability | *(reads via message history — no write tools)* |
| 5 | **Recorder** | `recorder` | FID | Create, track, archive FIDs. Update CHANGELOG | `write_file`, `read_files`, `glob`, `code_search`, `set_output` |
| 6 | **Thinker** | `thinker` | Planning | Deep reasoning via sequential thinking engine | `sequentialthinking` |
| 7 | **Scout** | `scout` | Explore | File/code search, glob, read subtrees, context gathering | `glob`, `list_directory`, `read_files`, `read_subtree`, `set_output` |
| 8 | **Researcher** | `researcher-web` / `researcher-docs` | Research | Web search, documentation lookup | `web_search`, `read_url` (web) · `read_docs` (docs) |
| 9 | **Scribe** | `scribe` | Docs | Session summaries, LESSONS.md, knowledge files | `read_files`, `write_file`, `glob`, `code_search`, `set_output` |

### Helper Tool-Library Agents

These are consumed by the canonical 9 roles but do NOT constitute independent conversational agents:

| Agent | ID | Tools | Consumed By |
|-------|----|-------|-------------|
| **Basher** | `basher` | `run_terminal_command` | Orchestrator (terminal commands) |
| **tmux-cli** | `tmux-cli` | `run_terminal_command`, `read_files`, `set_output`, `add_message` | Orchestrator (interactive CLI testing) |
| **browser-use** | `browser-use` | `set_output`, `run_terminal_command`, `add_message` | Orchestrator (browser automation) |
| **Context Pruner** | `context-pruner` | *(no explicit toolNames — uses `set_messages` via runtime)* | Orchestrator (auto-spawned for long sessions) |
| **Deep Agent** | `savant-deep` | `spawn_agents`, `read_files`, `read_subtree`, `suggest_followups`, `write_todos`, `ask_user`, `skill`, `set_output`, `transition_phase` | Orchestrator (complex task delegation) |

### Directory Layout

```
agents/
├── savant/              # Orchestrator (savant.ts, savant-deep.ts, + variants)
├── detective/           # RED phase
├── forge/               # GREEN phase
├── verifier/            # AUDIT phase
├── recorder/            # FID lifecycle
├── thinker/             # Sequential thinking
├── scout/               # File/code search
├── researcher/          # Web + docs research (researcher-web.ts, researcher-docs.ts)
├── scribe/              # Session documentation
├── browser-use/         # Browser automation helper
├── editor/              # Editor scaffolding (used by `init` command)
├── file-explorer/       # File listing helper
├── librarian/           # Knowledge/context helper (used by context-pruner)
├── types/               # Shared TypeScript types across agents
├── base-chat.ts         # Base chat agent shared logic
├── basher.ts            # Terminal command agent
├── context-pruner.ts    # Context pruning agent
├── constants.ts         # Publisher constant
├── tmux-cli.ts          # Interactive CLI testing agent
└── package.json         # @savant-code/agents workspace
```

### Separation of Duties

| Rule | Enforcement |
|------|-------------|
| Orchestrator cannot write source code | `write_file`/`str_replace` gated to GREEN phase + FID path exemptions only |
| Forge cannot verify its own work | No `run_terminal_command`, no test access |
| Verifier cannot write code | No `write_file`/`str_replace` — reads via message history |
| Detective cannot implement fixes | No `write_file`/`str_replace` |
| Recorder controls FID lifecycle exclusively | Only Recorder archives FIDs |
| Thinker must use sequential thinking | `sequentialthinking` is its only tool |

---

## Tools

Tool definitions live in `common/src/tools/` and are executed via the SDK helpers + agent-runtime. Each tool has a Zod input schema, output schema, and an `endsAgentStep` flag.

### Tool Catalog

#### File Operations

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `write_file` | Create or overwrite a file | GREEN only |
| `str_replace` | Exact string replacement in a file | GREEN only |
| `apply_patch` | Apply a unified diff patch | GREEN only |
| `read_files` | Read one or more files | None |
| `read_subtree` | Read a directory tree recursively | None |

#### Search & Navigation

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `glob` | Pattern-match files by name | None |
| `list_directory` | List directory contents | None |
| `code_search` | Search file contents with regex | None |
| `find_files` | Find files by name pattern | None |
| `read_url` | Fetch content from a URL | None |
| `read_docs` | Read documentation files | None |

#### Agent Orchestration

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `spawn_agents` | Spawn one or more sub-agents | None (template-level restriction) |
| `spawn_agent_inline` | Spawn agent inline (internal) | None |
| `set_output` | Set output for parent agent | None |
| `ask_user` | Ask the user a question | None |
| `suggest_followups` | Suggest follow-up actions | None |
| `add_message` | Add a message to the conversation | None |

#### Execution

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `run_terminal_command` | Run a shell command | AUDIT only |
| `run_readonly_command` | Run a read-only shell command | None |
| `run_file_change_hooks` | Run file change hooks | None |

#### Planning & State

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `transition_phase` | Transition the Perfection Loop FSM | None (validates legal transitions) |
| `create_plan` | Create a development plan | None |
| `write_todos` | Write a TODO list | None |
| `add_subgoal` | Add a subgoal to the current plan | None |
| `update_subgoal` | Update an existing subgoal | None |
| `task_completed` | Mark a task as completed | None |

#### Reasoning & UI

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `sequentialthinking` | Structured stepwise reasoning | Thinker only |
| `think_deeply` | Deep thinking prompt | None |
| `render_ui` | Render visual widgets (table, card, stepper, badge, etc.) | None |
| `skill` | Load a skill from the skills directory | None |
| `gravity_index` | Index codebase for gravity-aware search | None |
| `web_search` | Search the web | None |

#### Infrastructure

| Tool | Description | FSM Gate |
|------|-------------|----------|
| `end_turn` | End the current turn | None |
| `set_messages` | Set conversation messages (internal) | None |
| `set_scaffold_complete` | Mark scaffold mode as complete | None |
| `lookup_agent_info` | Look up agent metadata | None |
| `propose_str_replace` | Propose a string replacement (Forge) | None |
| `propose_write_file` | Propose a file write (Forge) | None |
| `browser_logs` | Get browser automation logs | None |

#### Composio (disabled)

| Tool | Description |
|------|-------------|
| `composio_manage_connections` | Manage Composio connections |
| `composio_multi_execute_tool` | Execute multiple Composio tools |
| `composio_search_tools` | Search Composio tools |
| `composio_get_tool_schemas` | Get Composio tool schemas |

> **Note:** Composio tools are disabled (`ENABLE_COMPOSIO_TOOLS = false` in `agents/savant/savant.ts:16`).

### Tool Count

- **Total registered tools:** 40 (including Composio meta-tools)
- **Published tools (available to agents):** 30
- **FSM-gated tools:** 3 (`write_file`, `str_replace` → GREEN; `run_terminal_command` → AUDIT)
- **Agent-exclusive tools:** 1 (`sequentialthinking` → Thinker only)

### FSM Phase Gating

Tools are gated by FSM phase in `packages/agent-runtime/src/tools/tool-executor.ts`:

```
write_file / str_replace / apply_patch  →  GREEN only
run_terminal_command                    →  AUDIT only
sequentialthinking                      →  Thinker only (agent ID starts with "thinker")
```

Gate logic: `(agentState.fsmPhase ?? 'idle') !== 'green'` — subagents inherit `fsmPhase` from parent via `createAgentState()` in `spawn-agent-utils.ts`.

### Tool Integration Points

| Layer | File | Role |
|-------|------|------|
| Tool definitions | `common/src/tools/constants.ts` | `toolNames[]` array, `publishedTools[]` array |
| Tool schemas | `common/src/tools/params/tool/*.ts` | Zod input/output schemas per tool |
| Tool compilation | `common/src/tools/compile-tool-definitions.ts` | Compiles tool defs for runtime |
| Tool execution | `packages/agent-runtime/src/tools/tool-executor.ts` | FSM gating, phase validation |
| Tool handlers | `packages/agent-runtime/src/tools/handlers/tool/*.ts` | Per-tool execution logic |
| MCP tools | `packages/agent-runtime/src/mcp.ts` | MCP server tool loader |
| Skills | `packages/agent-runtime/src/tools/handlers/tool/skill.ts` | Skill loader (4 directories) |
| SDK bridge | `sdk/src/run.ts` | Streams tool calls to CLI |

### Shell Shims

Direct commands without `savant-code` prefix:

```bash
savant-code shims install savant-code/savant@1.0.0
eval "$(savant-code shims env)"
savant "fix this bug"
```
