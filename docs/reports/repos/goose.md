# Goose — Feature Inventory

> **Repo:** `resources/goose` | **Language:** Rust core + Electron/TypeScript UI + Ink/React TUI
> **License:** Apache 2.0 (Linux Foundation / AAIF) | **Version:** 1.43.0

## Overview

Goose is a Rust-based coding agent with 15+ LLM providers, 70+ MCP server extensions, a recipe system for YAML-defined agent tasks, a plugin system with auto-update, and a cron scheduler that runs full agent sessions.

## Feature Inventory

### Multi-Provider LLM
- **15+ Providers** — Anthropic, OpenAI, Google, Ollama, OpenRouter, Azure, Bedrock, Databricks, Snowflake, HuggingFace, llama.cpp/MLX, etc. Provider registry with runtime discovery, declarative YAML-based custom providers, OAuth device flow. (`crates/goose/src/providers/`)

### Agent Core
- **Single-Agent Loop** — 4400+ lines managing conversation, tool calling, context compaction, permission checks, security scanning. Auto mode and plan mode. `Stop` hook with block cap (8 iterations). (`crates/goose/src/agents/agent.rs`)

### MCP Extensions
- **70+ MCP Servers** — `ExtensionManager` handles subprocess spawning, OAuth, health monitoring, tool routing. Built-in MCP servers for memory, computer control, autovisualisation, tutorials. Malware checking via OSV API. (`crates/goose-mcp/src/`, `crates/goose/src/agents/extension_manager.rs`)

### Platform Extensions (Built-in)
- **10 Built-in Extensions** — `analyze` (tree-sitter), `todo`, `apps` (sandboxed HTML), `chatrecall` (session search), `summon` (subagents), `orchestrator` (multi-session), `summarize`, `developer`, `extensionmanager`. (`crates/goose/src/agents/platform_extensions/`)

### Subagent System
- **Delegate/Summon** — Sync and async delegation with configurable max turns, extensions, models, cancellation tokens. Background tasks with real-time status, notification streaming. (`crates/goose/src/agents/subagent_handler.rs`, `platform_extensions/summon.rs`)

### Scheduling
- **Cron for Agent Sessions** — Runs actual agent sessions (not just shell commands) with full provider/extension context. Recipes validated with file size limits and symlink protection. (`crates/goose/src/scheduler.rs`)

### Recipe System
- **YAML Task Definitions** — Instructions, prompts, extensions, parameters, settings (model, temperature, max_turns), sub-recipes, response schemas, retry configs. (`crates/goose/src/recipe/`)

### Plugin System
- **Dual Format** — Gemini-style and OpenPlugins. Auto-update every 24 hours. Skills (SKILL.md), hooks, config. Project-level in `.agents/plugins/`. (`crates/goose/src/plugins/`)

### Lifecycle Hooks
- **11 Events** — PreToolUse, PostToolUse, PostToolUseFailure, SessionStart, SessionEnd, UserPromptSubmit, BeforeReadFile, AfterFileEdit, BeforeShellExecution, AfterShellExecution, Stop. Regex-matched. (`crates/goose/src/hooks/`)

### Tool Inspector Pipeline
- **Composable Inspectors** — Permission judge → security inspector → adversary inspector → egress inspector → repetition inspector. (`crates/goose/src/agents/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | MCP Extension model with malware check | Standard tool extensibility + safety |
| HIGH | Orchestrator extension (multi-session) | Directly applicable to multi-agent architecture |
| HIGH | Recipe system (YAML task definitions) | Task templates with sub-recipe composition |
| HIGH | Subagent with background tasks | Clean async delegation pattern |
| MEDIUM | Cron for agent sessions | Full-context scheduled execution |
| MEDIUM | Plugin auto-update with 24h interval | Keeps extensions current |
| MEDIUM | Tool Inspector pipeline | Composable safety inspection |
| MEDIUM | Declarative provider system (YAML) | Add providers without code |
| LOW | Summarize extension | Deterministic file load + LLM call primitive |
| LOW | Chatrecall extension | Session search for contextual memory |
