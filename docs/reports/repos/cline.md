# Cline — Feature Inventory

> **Repo:** `resources/cline` | **Stack:** Bun 1.3.13 + Node >= 22, TypeScript monorepo
> **License:** Apache 2.0

## Overview

Cline is a TypeScript/Bun coding agent with a disciplined layered SDK architecture (`shared → llms → agents → core → apps`). It features a sophisticated multi-agent team system, subprocess sandboxing for plugins, a 7-callback hook system, and VCR-style HTTP recording for testing.

## Feature Inventory

### Architecture
- **Layered SDK** — Strict dependency direction: `@cline/shared` → `@cline/llms` → `@cline/agents` → `@cline/core` → apps (CLI, VS Code, JetBrains). (`sdk/packages/`)

### Tool System
- **Tool Presets** — Act/Plan/Search/Minimal/Yolo modes with different tool availability. (`sdk/packages/core/src/extensions/tools/presets.ts`)
- **Model-Tool Routing** — Dynamic tool enable/disable based on provider+model+mode (e.g., OpenAI gets `apply_patch` instead of `editor`). (`sdk/packages/core/src/extensions/tools/model-tool-routing.ts`)
- **9 Default Tool Factories** — `read_files`, `search_codebase`, `run_commands`, `fetch_web_content`, `editor`/`apply_patch`, `skills`, `ask_question`, `submit_and_exit`, `spawn_agent`. (`sdk/packages/core/src/extensions/tools/definitions.ts`)

### Sandbox
- **SubprocessSandbox** — IPC-based isolation for plugins with typed message protocol, auto-reinit on crash, timeout enforcement. (`sdk/packages/core/src/runtime/tools/subprocess-sandbox.ts`)

### Plugin System
- **Contribution-Based Plugins** — Tools, commands, rules, message builders, providers, automation events, MCP servers, shortcuts, flags. npm/git/remote installation. Marketplace. (`sdk/packages/core/src/extensions/plugin/`)

### MCP Integration
- **Full MCP Client** — Tool discovery, OAuth, policy enforcement, settings synchronization. (`sdk/packages/core/src/extensions/mcp/`)

### Multi-Agent Teams
- **AgentTeamsRuntime** — Lead/teammate hierarchy, task management, run queuing, mailbox messaging, outcome tracking, mission logs, team state persistence, completion guard. 20+ team tools. (`sdk/packages/core/src/extensions/tools/team/multi-agent.ts`)

### Cron Automation
- **Markdown Spec System** — `.cline/cron/*.md` with YAML frontmatter. One-off, schedule (cron), and event triggers. SQLite-backed. Filesystem watching for spec changes. (`sdk/packages/core/src/cron/`)

### Connector System (Messaging)
- **6 Platform Connectors** — Telegram, Slack (webhook + socket), Discord, Google Chat, WhatsApp, Linear. (`apps/cli/src/connectors/`)

### Hook System
- **7-Callback Hooks** — `beforeRun`, `afterRun`, `beforeModel`, `afterModel`, `beforeTool`, `afterTool`, `onEvent`. `beforeModel` can inject messages and modify tools per-request. (`sdk/packages/shared/src/agent.ts`)

### Safety
- **Loop Detection** — Repeated tool-call detection with soft warning (3) and hard stop (5). (`sdk/packages/core/src/runtime/safety/loop-detection.ts`)

### Checkpoints
- **Git-Based** — Git commits as checkpoints, diffing, restore. (`sdk/packages/core/src/session/checkpoint-diff.ts`)

### VCR (Testing)
- **HTTP Record/Playback** — Records/replays HTTP via fetch patching. Selective filtering, sensitive data sanitization, SSE replay. (`sdk/packages/shared/src/vcr.ts`)

### Eval System
- **3-Layer Pyramid** — Contract tests → smoke tests (5 scenarios, 3 models, pass@k) → E2E (Harbor/SWE-bench). (`evals/`)

### Agent Client Protocol
- **ACP Implementation** — `@agentclientprotocol/sdk` with session management, image prompts, provider switching, tool approval routing. (`apps/cli/src/acp/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | `createTool` factory + ToolPresets | Clean tool definition with mode-based presets |
| HIGH | Multi-Agent Team system | Production-grade orchestration with persistence |
| HIGH | Loop Detection | Simple but critical safety feature |
| HIGH | Eval system (3-layer pyramid) | Rigorous testing framework |
| HIGH | Plugin sandbox (SubprocessSandbox) | Safe extension execution |
| HIGH | 7-callback hook system | Well-designed runtime extensibility |
| MEDIUM | VCR (HTTP record/playback) | Deterministic testing |
| MEDIUM | Connector catalog pattern | Messaging platform integration |
| MEDIUM | Cron automation (markdown specs) | Scheduled agent runs |
| MEDIUM | Git-based checkpoints | Elegant undo/restore |
