# Hermes Agent — Feature Inventory

> **Repo:** `resources/hermes-agent` | **Language:** Python | **TUI:** TypeScript (Ink/React)
> **Tagline:** Self-improving AI agent by Nous Research

## Overview

Hermes Agent is a Python-based personal AI agent with extreme breadth: ~95 tools, ~30 messaging channels, 35 model provider plugins, Kanban multi-agent work queue, Mixture-of-Agents loop, and a closed learning loop with autonomous skill creation and memory persistence.

## Feature Inventory

### Agent Core

- **AIAgent Class** — Synchronous tool-calling loop with interrupt handling, budget tracking, one-turn grace calls. ~60 parameters. (`run_agent.py`, `agent/conversation_loop.py`)

### Delegation System

- **Role-Based Tool Blocking** — `delegate_task` spawns child AIAgent instances. Leaf vs orchestrator tool blocking. Spawn depth limits. Background delegation with async result re-entry. (`tools/delegate_tool.py`)

### Kanban Multi-Agent Work Queue

- **SQLite-Backed Board** — Multi-profile/worker collaboration. Dispatcher loop, worker toolset, board routing, failure detection with auto-blocking. Heartbeat monitoring. (`tools/kanban_tools.py`, `plugins/kanban/`)

### Mixture-of-Agents (MoA)

- **Reference-Model Context Gathering** — `/moa` command runs advisory calls in parallel. Per-model cost accounting and trace persistence. (`agent/moa_loop.py`)

### Tool System

- **AST Auto-Discovery** — `registry.register()` calls discovered via AST parsing. TTL-cached availability. (`tools/registry.py`)
- **Toolsets** — Logical groupings (browser, terminal, memory, kanban). Platform-specific composition. (`toolsets.py`)
- **MCP Client** — Full MCP with sampling, parallel tool calls, multi-transport. (`tools/mcp_tool.py`)

### Terminal Backends

- **6 Backends** — Local, Docker, SSH, Singularity, Modal, Daytona. Serverless persistence with hibernation. (`tools/environments/`)

### Checkpoint Manager

- **Shadow Git** — Transparent filesystem snapshots via shared shadow git. Content-addressable deduplication. Auto-snapshot before mutations. (`tools/checkpoint_manager.py`)

### Memory & Learning

- **Pluggable Memory Backends** — Honcho (dialectic user modeling), Mem0, Supermemory, ByteRover, Hindsight, Holographic, OpenViking, RetainDB. (`plugins/memory/`)
- **Session Search (FTS5)** — SQLite FTS5 full-text search with LLM summarization. (`hermes_state.py`, `tools/session_search_tool.py`)
- **Curator** — Background skill lifecycle management with auto-archiving. (`agent/curator.py`)
- **Learning Graph** — Skill-memory relationship visualization. (`agent/learning_graph.py`)

### Context Management

- **Context Compressor** — Summarizes middle turns, protects head/tail. Structured summary with Resolved/Pending question tracking. (`agent/context_compressor.py`)
- **Prompt Caching** — `system_and_3` layout with 4 cache_control breakpoints. (`agent/prompt_caching.py`)
- **System Prompt Assembly** — Three-tier: stable, context, volatile. Cache-preserving construction. (`agent/system_prompt.py`)

### Scheduling

- **Cron Scheduler** — Duration, "every" phrases, 5-field cron, ISO timestamps. Per-job skills, model overrides, scripts, multi-platform delivery. (`cron/scheduler.py`)

### Plugin System

- **Four-Source Discovery** — Bundled, user (`~/.hermes/plugins/`), project (`./.hermes/plugins/`), pip entry points. (`hermes_cli/plugins.py`)
- **33 Model Provider Plugins** — OpenRouter, Anthropic, GMI, DeepSeek, NVIDIA, Ollama, Copilot, Bedrock, Vertex, xAI, etc. (`plugins/model-providers/`)

### UI Surfaces

- **Classic CLI** — Rich + prompt_toolkit with skin engine for theming. (`cli.py`)
- **TUI** — Ink/React with TypeScript rendering, Python backend via JSON-RPC. (`ui-tui/src/`)
- **Electron Desktop** — `@assistant-ui/react` with JSON-RPC transport. (`apps/desktop/`)
- **Web Dashboard** — Embeds real TUI via PTY bridge with xterm.js. (`hermes_cli/web_server.py`)
- **Messaging Gateway** — 20+ platform adapters (Telegram, Discord, Slack, WhatsApp, Signal, etc.). (`gateway/platforms/`)

### Security

- **Command Approval** — Per-session queue with subagent callbacks. (`tools/approval.py`)
- **Path/URL Safety** — Dedicated modules. (`tools/path_security.py`, `tools/url_safety.py`)
- **Credential Pool** — Multi-credential failover with borrowing semantics. (`agent/credential_pool.py`)

### Other

- **Verification Evidence Ledger** — Passive verification with turn-end guards. (`agent/verification_evidence.py`)
- **Pet System (Petdex)** — Animated sprites for agent activity visualization. (`agent/pet/`)
- **Scale-to-Zero** — Idle detection + dormant-quiesce for gateway. Fly.io suspend/resume. (`gateway/scale_to_zero.py`)
- **Footprint Ladder** — Formal capability addition hierarchy. (AGENTS.md)
- **Profile System** — Multiple isolated instances with separate HERMES_HOME. (`hermes_cli/profiles.py`)
- **Batch Runner** — Parallel batch processing with checkpointing. (`batch_runner.py`)
- **Trajectory Compressor** — Training-focused trajectory compression. (`trajectory_compressor.py`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Tool Registry with AST Auto-Discovery | Elegant pattern for plugin-heavy systems |
| HIGH | Delegation with Role-Based Tool Blocking | Essential for multi-agent orchestration |
| HIGH | Kanban Multi-Agent Work Queue | Excellent for parallel workstreams |
| HIGH | Checkpoint Manager (Shadow Git) | Transparent filesystem snapshots |
| HIGH | Context Compressor with Historical Headings | Sophisticated context management |
| MEDIUM | Verification Evidence Ledger | Passive verification for coding agents |
| MEDIUM | Credential Pool with Failover | Multi-credential management |
| MEDIUM | Slash Command Registry (Single Source of Truth) | Multi-surface UI pattern |
| MEDIUM | Footprint Ladder (Capability Decision Hierarchy) | Architectural guidance for growth |
| LOW | Scale-to-Zero for Cloud Deployment | Cost optimization |
