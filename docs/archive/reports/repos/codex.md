# Codex — Feature Inventory

> **Repo:** `resources/codex` | **Language:** Rust (codex-rs) + TypeScript/Python SDKs
> **Build:** Bazel + Cargo dual build system

## Overview

OpenAI's Codex CLI is a Rust-based terminal coding agent with OS-level sandboxing, a role-based agent registry, a Starlark execution policy engine, an 11-event lifecycle hook system, and a two-phase memories pipeline. It is one of the most technically sophisticated coding agents in the ecosystem.

## Feature Inventory

### Multi-Agent Orchestration

- **Role-Based Agent Registry** — Built-in `explorer` and `worker` roles with config layering (user roles override built-in). `SpawnReservation` RAII pattern, nickname pools, spawn depth/thread count limits. (`codex-rs/core/src/agent/`)

### OS-Level Sandboxing

- **Cross-Platform** — macOS Seatbelt (SBPL profiles), Linux seccomp/Landlock/bubblewrap, Windows restricted token. Unified `SandboxManager` with `SandboxType` enum. (`codex-rs/sandboxing/src/`)

### Execution Policy Engine

- **Starlark Rules** — Declarative allow/prompt/forbidden decisions for shell commands. Prefix matching with alternatives, host executable path resolution, self-validating rules. (`codex-rs/execpolicy/src/`)

### Lifecycle Hooks (11 Events)

- **11-Event System** — `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`. Matcher fields, persistable states. (`codex-rs/hooks/src/`)

### Context Compaction

- **Multi-Strategy** — Remote summarization, pre-turn compaction, manual, model fallback. Hook integration, replacement history tracking. (`codex-rs/core/src/compact.rs`)

### Thread Management

- **Full Lifecycle** — Create, resume, fork (branch), archive, delete, rollback. Dual persistence: JSONL rollouts + SQLite state DB. (`codex-rs/core/src/thread_manager.rs`)

### MCP Integration

- **Bidirectional** — Both MCP client and server. Plugin-contributed MCP servers with OAuth. Tool catalog caching. (`codex-rs/codex-mcp/src/`, `codex-rs/mcp-server/src/`)

### Skills System

- **Markdown-Based** — `.md` files with metadata. Implicit invocation detection (matching shell commands to skills). Scope (User/Repo/System/Admin), policy, budget. (`codex-rs/core-skills/src/`)

### Plugin/Marketplace

- **Full Ecosystem** — Local (filesystem) or remote (Git-based marketplace). Contributes skills, MCP servers, hooks, apps. (`codex-rs/plugin/src/`)

### Memories (Two-Phase Pipeline)

- **Phase 1:** Extract structured memories from completed conversations (parallel with concurrency caps).
- **Phase 2:** Consolidate into workspace artifacts via git-baseline diff. (`codex-rs/memories/`)

### App-Server Protocol (JSON-RPC)

- **50+ RPC Methods** — Thread management, turn control, file ops, model listing, skills, plugins. `turn/steer` (mid-turn injection), `thread/fork`, backpressure. (`codex-rs/app-server/src/`)

### Execution Server

- **Remote Execution** — Sandboxed subprocess management with Noise-encrypted relay, PTY-backed processes, filesystem RPCs. (`codex-rs/exec-server/src/`)

### Other

- **Collaboration Modes** — Template-based behavioral presets (Default, Execute, Pair Programming, Plan). (`codex-rs/collaboration-mode-templates/`)
- **Agent Graph Store** — Parent-child relationships, spawn reasons, status transitions. (`codex-rs/agent-graph-store/src/`)
- **Rollout Budget** — Token usage and turn count budgets per session. (`codex-rs/core/src/rollout_budget.rs`)
- **Context Fragments** — Bounded (max 10K tokens) with trait enforcement. (`codex-rs/context-fragments/src/`)
- **Realtime/Voice** — WebRTC/WebSocket voice conversations. (`codex-rs/core/src/realtime_conversation/`)
- **TUI** — ratatui-based with markdown rendering, diff visualization, inline tool output. (`codex-rs/tui/src/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Role-Based Agent Registry | Config layering for ECHO agent roster |
| HIGH | Lifecycle Hook System (11 events) | Maps 1:1 to agent lifecycle needs |
| HIGH | Context Compaction | Essential for long-running sessions |
| HIGH | Execution Policy Engine | Safety gate for tool execution |
| HIGH | Memories Two-Phase Pipeline | Production-grade memory architecture |
| HIGH | Bounded Context Fragments | Prevents context explosion |
| MEDIUM | Plugin/Marketplace System | Extensibility for community contributions |
| MEDIUM | Agent Graph Store | Multi-agent relationship tracking |
| MEDIUM | Collaboration Modes | Behavioral presets per task type |
| MEDIUM | Completion Policy (headless gating) | Ensures headless work is actually complete |
