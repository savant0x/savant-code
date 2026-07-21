# OpenClaude — Feature Inventory

> **Repo:** `resources/openclaude` | **Language:** TypeScript
> **Nature:** Claude-Code-style coding agent

## Overview

OpenClaude is a TypeScript coding agent with 20+ LLM providers, smart model routing, coordinator-mode multi-agent orchestration, a tree-sitter + PageRank repo map, auto-dream memory consolidation, context collapse, cron scheduling, tool search (deferred discovery), and a comprehensive skills system.

## Feature Inventory

### Multi-Provider Gateway
- **20+ Providers** — OpenAI-compatible, Gemini, GitHub Models, Codex OAuth, Ollama, Fireworks, MiMo, NEAR AI, Cloudflare, Bedrock/Vertex/Foundry. OpenAI shim normalizes all providers. (`src/services/api/`, `src/integrations/`)

### Smart Model Routing
- **Complexity Classifier** — Routes simple turns (chit-chat) to cheap model, complex coding to strong model. Heuristics: word count, keywords, code fences, turn number. (`src/services/api/smartModelRouting.ts`)

### Agent Routing
- **Per-Agent Model Overrides** — Route Explore/Plan/verification/worker agents to different models/providers. `maxSteps` caps. (`src/services/api/agentRouting.ts`)

### Coordinator Mode
- **Multi-Agent Orchestration** — Main agent spawns parallel workers via `AgentTool`, continues via `SendMessageTool`, stops via `TaskStopTool`. Synthesis-before-delegation. `<task-notification>` XML protocol. (`src/coordinator/coordinatorMode.ts`)

### Agent Swarms / Teams
- **Named Teams** — Team lead + teammates with colors, names, roles. Persistent team files. Inter-agent messaging. (`src/tools/TeamCreateTool/`, `src/utils/swarm/`)

### MCP Integration
- **Full Client** — stdio, SSE, Streamable HTTP, WebSocket. InProcessTransport for same-process. SDK control transport bridge. OAuth. (`src/services/mcp/`)

### Repo Map (PageRank + tree-sitter)
- **Structural Code Map** — tree-sitter symbol extraction, dependency graph, PageRank ranking, token-budgeted rendering. File-stat fingerprinting cache. (`src/context/repoMap/`)

### Memory System
- **Auto-Dream** — Background subagent consolidates session transcripts into durable memory. Time gate (24h), session gate (5+), consolidation lock. 4-stage prompt. (`src/services/autoDream/`)
- **Extract Memories** — Forked subagent extracts memories at end of each query loop. Structured memory types (decisions, facts, patterns). (`src/services/extractMemories/`)
- **Session Memory** — Background maintenance of session notes file. (`src/services/SessionMemory/`)

### Context Management
- **Context Collapse** — Risk-scored span selection, staged collapse, dedicated "ctx agent" subagent. (`src/services/contextCollapse/`)
- **Auto-Compact** — Multiple strategies: full, micro, reactive, snip, session memory. (`src/services/compact/`)

### Cron Scheduling
- **Agent-Initiated Tasks** — In-memory (session-only) and durable (`.openclaude/scheduled_tasks.json`). Max 50 jobs. (`src/tools/ScheduleCronTool/`)

### Tool Search
- **Deferred Discovery** — When many tools exist, compacted via `ToolSearchTool`. Agent discovers on-demand via keyword search. (`src/tools/ToolSearchTool/`)

### Skills System
- **Bundled + User** — 17+ bundled skills (batch, simplify, debug, loop, PDF, etc.). File extraction, hooks, MCP-derived skills. (`src/skills/`)

### Built-in Agents
- **6 Agent Types** — GeneralPurpose, Explore, Plan, Verification, ClaudeCodeGuide, StatuslineSetup. Tool restrictions per agent. (`src/tools/AgentTool/builtInAgents.ts`)

### Other
- **LSP Tool** — Language server integration for symbols, diagnostics, formatting. (`src/tools/LSPTool/`)
- **Goal System** — Structured goal-tracking with evaluators, turn limits, auto-evaluation. (`src/services/goal/`)
- **Git Worktree Isolation** — Create, work, exit. State persisted per-session. (`src/tools/EnterWorktreeTool/`)
- **Background Sessions** — Non-interactive local child processes with metadata/logs. (`src/daemon/`)
- **Web Search** — 10+ providers with DuckDuckGo free fallback. (`src/tools/WebSearchTool/providers/`)
- **Voice Input** — Push-to-talk with native audio capture. (`src/voice/`)
- **Vim Mode** — Full vim input mode. (`src/vim/`)
- **Companion/Buddy System** — Pixel-art companion with 7 types and signature moves. (`src/buddy/`)
- **VS Code Extension** — In-editor chat, provider-aware Control Center. (`vscode-extension/`)
- **gRPC Server** — Headless bidirectional streaming. 1000 concurrent sessions. (`src/grpc/`)
- **Wiki/Knowledge System** — Conventions tracking, identity management. (`src/services/wiki/`)
- **PR Subscription** — Subscribe to GitHub PR events. (`src/tools/SubscribePRTool/`)
- **Auto-Fix** — Lint/test auto-remediation with timeout handling. (`src/services/autoFix/`)
- **Proactive Mode** — Agent can take actions proactively. (`src/proactive/`)
- **Context Visualization** — Token usage, message breakdown, context pressure. (`src/components/ContextVisualization.tsx`)
- **Session Resume & Fork** — Resume by ID, continue recent, or fork (branch). (`src/history.ts`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Coordinator Mode | Multi-agent orchestration with synthesis-before-delegation |
| HIGH | Repo Map (tree-sitter + PageRank) | Codebase intelligence |
| HIGH | Agent Routing (per-agent model overrides) | Cost optimization |
| HIGH | Smart Model Routing | Simple vs. complex turn routing |
| HIGH | Tool Search (deferred discovery) | Prevents tool bloat |
| MEDIUM | Auto-Dream (memory consolidation) | Background memory maintenance |
| MEDIUM | Context Collapse | Sophisticated context management |
| MEDIUM | Git Worktree Isolation | Clean parallel work |
| MEDIUM | Goal System | Structured goal-tracking |
| MEDIUM | Cron Scheduling | Agent-initiated tasks |
