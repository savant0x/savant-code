# Gemini CLI — Feature Inventory

> **Repo:** `resources/gemini-cli` | **Language:** TypeScript | **Runtime:** Node.js
> **License:** Apache 2.0

## Overview

Google's Gemini CLI is a TypeScript coding agent with a graph-based context management system, an event-driven scheduler with parallel tool batching, a sophisticated hook system (including BeforeModel synthetic responses), and a behavioral eval framework with dynamic baselines.

## Feature Inventory

### Architecture

- **7-Package Monorepo** — `core` (brain, zero UI deps), `cli` (React/Ink TUI), `sdk` (embeddable), `a2a-server`, `vscode-ide-companion`, `devtools`, `test-utils`. (`packages/core/src/`, `packages/cli/src/`, `packages/sdk/src/`)

### Tool Registry

- **Tool Discovery** — Auto-discovered by running a configurable CLI command returning JSON. Per-model schema adaptation. Plan Mode tool restriction. (`packages/core/src/tools/tool-registry.ts`)

### Scheduler (Event-Driven)

- **Parallel Batching** — Non-edit tools execute in parallel; edit tools forced sequential. `wait_for_previous` per-call override. Sandbox expansion mid-flight. Tail call replacement for hook-driven redirection. (`packages/core/src/scheduler/`)

### Agent System

- **Subagent Framework** — Local (in-process) and remote (A2A protocol) agents. `complete_task` tool for structured termination. Agent acknowledgement system for untrusted definitions. Activity streaming (THOUGHT_CHUNK, TOOL_CALL_START/END, ERROR). (`packages/core/src/agents/`)

### Context Management (Graph-Based)

- **Context as Graph** — Typed nodes (UserPrompt, AgentThought, ToolExecution, MaskedTool, AgentYield, Snapshot, RollingSummary). Processor pipeline: blobDegradation, historyTruncation, nodeDistillation, rollingSummary, stateSnapshot, toolMasking. Render cache with hysteresis. (`packages/core/src/context/`)

### Chat Compression

- **Model-Aware** — Automatically compresses at 50% of token limit. Split point algorithm respects turn boundaries. Reverse Token Budget truncates old tool outputs first. (`packages/core/src/context/chatCompressionService.ts`)

### Tool Output Management

- **Masking + Distillation** — Protection window (newest 50k tokens), min prunable threshold (30k), proportional truncation, exempt tools. (`packages/core/src/context/toolOutputMaskingService.ts`, `toolDistillationService.ts`)

### Memory System

- **Hierarchical + JIT** — Global, extension, project, user project, JIT subdirectory context. Auto-extraction agent produces memory patch files. MEMORY.md as index. (`packages/core/src/context/memoryContextManager.ts`, `agents/skill-extraction-agent.ts`)

### Hook System (10 Events)

- **10 Event Points** — BeforeTool, AfterTool, BeforeAgent, AfterAgent, SessionStart, SessionEnd, PreCompress, BeforeModel, AfterModel, BeforeToolSelection. **BeforeModel synthetic responses** (bypass model call entirely). BeforeTool input modification. AfterTool tail calls. (`packages/core/src/hooks/`)

### Model Routing

- **CompositeStrategy** — Chains: Fallback → Override → ApprovalMode → GemmaClassifier → Classifier → NumericalClassifier → Default. Local Gemma classifier for cheap routing. (`packages/core/src/routing/`)

### MCP Integration

- **Full Client** — stdio, SSE/HTTP, WebSocket transports. Per-agent MCP servers. MCP resource tools. Fully qualified tool names. (`packages/core/src/tools/mcp-client-manager.ts`)

### Skills System

- **On-Demand Loading** — Precedence: Extensions < User < Workspace. `activate_skill` tool for model-initiated loading. Admin toggle. (`packages/core/src/skills/`)

### Plan Mode

- **Tool-Restricted** — `write_file` and `edit` restricted to `.md` plan files only. Enforced at schema description level. (`packages/core/src/tools/enter-plan-mode.ts`)

### Behavioral Evals

- **Nightly Regression** — Tests run 3x per model per night, scored 0/33/66/100%. Dynamic baseline verification (fails on main → marked "Pre-existing"). Trustworthiness filter (60%+ per-night, 80%+ aggregate). Automated promotion. (`evals/`)

### Extension System

- **Multi-System** — Extensions contribute skills, MCP servers, hooks, agents, and custom context files simultaneously. (`packages/core/src/config/extensions/`)

### Other

- **Confirmation Bus** — Pub/sub decoupling tool execution from confirmation UI. `derive(subagentName)` for scoped buses. (`packages/core/src/confirmation-bus/`)
- **Task Tracker** — Create, update, dependency graph with cycle detection. (`packages/core/src/tools/trackerTools.ts`)
- **GEMINI.md Context Files** — Hierarchical project instructions with JIT loading. (`packages/core/src/utils/memoryDiscovery.ts`)
- **Voice Input** — Dual backend: Gemini Live API + local Whisper. (`packages/core/src/voice/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Scheduler with parallel batching | Dramatically improves throughput |
| HIGH | Context graph + processor pipeline | Far more sophisticated than flat message arrays |
| HIGH | Tool output masking with protection window | Prevents context bloat while preserving recent context |
| HIGH | Hook system (BeforeModel synthetic responses) | Enables testing, caching, safety interception |
| HIGH | Behavioral eval framework with dynamic baselines | Proper regression testing for LLM behavior |
| HIGH | JIT context discovery | Load subdirectory context on-demand |
| HIGH | Agent acknowledgement system | Security for untrusted agent definitions |
| HIGH | Complete_task tool | Cleaner than relying on natural conversation end |
| MEDIUM | Model routing with composite strategies | Cost optimization via local classifier |
| MEDIUM | Sandbox expansion mid-flow | Seamless permission escalation |
