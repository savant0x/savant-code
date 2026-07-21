# AionUi — Feature Inventory

> **Repo:** `resources/AionUi` | **Stack:** Electron + React 19 + TypeScript + Bun + Rust (AionCore)
> **Tagline:** "A free, open-source Cowork app with AI Agents"

## Overview

AionUi is a desktop-first AI coworking application with a Rust backend (AionCore), Electron shell, and React 19 UI. It wraps 20+ CLI-based AI agents behind a unified ACP protocol, supports team-mode multi-agent collaboration, and ships with a full extension SDK.

## Feature Inventory

### Architecture
- **Two-Process Electron + Rust** — Strict separation between Electron Main/Renderer and a Rust backend binary (AionCore). IPC bridge maps renderer calls to HTTP/WS. (`packages/desktop/src/process/`, `packages/desktop/src/renderer/`, `packages/desktop/src/common/adapter/ipcBridge.ts`)
- **WebUI Mode** — Standalone HTTP server mode via `packages/web-host` with LAN/remote access. (`packages/web-host/`)
- **Platform Abstraction** — `IPlatformServices` with Electron and Node implementations. (`packages/desktop/src/common/platform/`)

### Agent Orchestration
- **ACP Protocol** — Wraps 20+ CLI agents (Claude Code, Codex, Goose, OpenClaw, Hermes, Cursor, etc.) behind a unified protocol with capability negotiation. (`packages/desktop/src/common/types/platform/acpTypes.ts`, `packages/desktop/src/renderer/pages/conversation/platforms/acp/`)
- **Team Mode** — Leader agent breaks tasks into subtasks, delegates to teammates via mailbox. Task dependency graph (`blocked_by`/`blocks`), shared workspace, per-agent permissions. (`packages/desktop/src/renderer/pages/team/`, `packages/desktop/src/common/types/team/teamTypes.ts`)
- **Agent Process Registry** — JSON-file registry with atomic writes for tracking spawned agent subprocesses. (`packages/web-host/src/agent-process-registry.ts`)

### Provider Integrations
- **30+ LLM Platforms** — Gemini, OpenAI, Anthropic, Bedrock, DeepSeek, Dashscope, Ollama, LM Studio, plus Chinese providers (Zhipu, Moonshot, Qianfan, Hunyuan). (`packages/desktop/src/common/types/provider/`)
- **Centralized MCP** — Configure once, sync to all agents. stdio, HTTP, SSE transports. OAuth support. (`packages/desktop/src/renderer/hooks/mcp/`)

### Tool Systems
- **Three-Tier Skills** — Builtin, custom, extension skills with per-conversation enable/disable. (`packages/desktop/src/renderer/pages/settings/SkillsSettings/`)
- **@ Command Parser** — File reference syntax in chat input. (`packages/desktop/src/common/chat/atCommandParser.ts`)
- **Slash Commands** — Three-source (ACP/builtin/skill) with merge priority. (`packages/desktop/src/common/chat/slash/`)
- **Image Generation** — Shared logic with JSON repair for malformed responses. (`packages/desktop/src/common/chat/imageGenCore.ts`)

### Scheduling
- **Cron Scheduler** — Standard 5-field cron, fixed interval, one-time triggers. Conversation-bound or new-conversation mode. Keep-awake, missed-trigger detection. (`packages/desktop/src/renderer/pages/cron/`)

### Memory & Database
- **SQLite with WAL** — better-sqlite3 with 26 schema versions, migrations, 5s busy_timeout. (`packages/desktop/src/process/services/database/schema.ts`)
- **Approval Store** — Session-level permission caching. (`packages/desktop/src/common/chat/approval/ApprovalStore.ts`)

### UI Surfaces
- **Desktop App** — Electron with React 19, Arco Design, CodeMirror, Monaco, react-markdown, KaTeX/GFM/mermaid, virtual scrolling, drag-and-drop.
- **Preview Panel** — 10+ format preview (PDF, Word, Excel, PPT, code, Markdown, images, HTML, diff) with Git version history.
- **Mobile App** — React Native / Expo for iOS and Android. (`mobile/`)
- **Chat Platforms** — Telegram, Lark/Feishu, DingTalk, WeChat, WeCom, Slack, Discord.
- **Desktop Pet** — Virtual pet with 21 states reacting to agent activity. (`packages/desktop/src/process/pet/`)

### Extensibility
- **Extension SDK** — `aion-extension.json` manifest with contributions: ACP adapters, MCP servers, assistants, agents, skills, themes, settings, i18n. Lifecycle hooks, permissions model. (`examples/`)
- **Custom Assistants** — Markdown-defined with rules, prompts, skills, MCP servers, models. 21 built-in assistants.

### Testing
- **E2E Tests** — 19 team-mode test cases covering lifecycle, communication, whitelisting, workspace migration. (`tests/e2e/cases/teams/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | ACP Protocol Types | `DetectedAgent<K>` discriminated union and capability negotiation |
| HIGH | Team Mode Mailbox + Task Board | Async inter-agent communication with dependency chains |
| HIGH | Extension SDK (aion-extension.json) | Comprehensive extensibility model |
| HIGH | Centralized MCP Management | "Configure once, sync to all agents" |
| HIGH | BackendLifecycleManager | Crash restart with exponential backoff |
| MEDIUM | Three-Tier Skill System | Builtin/custom/extension with per-conversation toggle |
| MEDIUM | Agent Process Registry | Atomic writes for subprocess tracking |
| MEDIUM | Cron Scheduler | Conversation-bound scheduled tasks |
| LOW | Desktop Pet State Machine | Priority-based states with auto-return (novel but niche) |
| LOW | Mobile Companion App | Expo-based reference implementation |
