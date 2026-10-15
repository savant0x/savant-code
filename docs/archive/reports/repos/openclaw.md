# OpenClaw — Feature Inventory

> **Repo:** `resources/openclaw` | **Stack:** Node.js, TypeScript ESM, pnpm workspace
> **License:** MIT | **Version:** 2026.7.2

## Overview

OpenClaw is a personal AI assistant platform (NOT a coding agent) with 22+ messaging channels, 150+ provider extensions, 52 skills, a plugin SDK, swarm mode, code mode (QuickJS sandbox), memory dreaming, and a gateway daemon architecture. It is the broadest platform in the ecosystem.

## Feature Inventory

### Gateway Architecture

- **Local-First Daemon** — Single long-running process owning all sessions, channels, tools, events, state. WebSocket + HTTP control plane. (`src/gateway/server.ts`)

### Multi-Channel Inbox (22+ Platforms)

- **Unified Inbox** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, IRC, Teams, Matrix, Feishu, LINE, Mattermost, Nostr, Twitch, WeChat, QQ, WebChat, etc. Channels are transport-only; render portable presentation/actions. (`extensions/whatsapp/`, `extensions/telegram/`, etc.)

### Plugin SDK & Extensions

- **159 Bundled Extensions** — Code plugins (runtime hooks, providers, channels, tools) and bundle plugins (skills, MCP servers, config). 150+ typed subpath exports. (`src/plugin-sdk/`, `extensions/`)

### Provider Integration

- **30+ Providers** — OpenAI, Anthropic, Google, Azure, Bedrock, Cohere, Mistral, Groq, DeepSeek, xAI, Ollama, LM Studio, vLLM, OpenRouter. Auth profile rotation with cooldown/expiry/round-robin. (`extensions/openai/`, `extensions/anthropic/`, etc.)

### Agent Orchestration

- **Subagent Registry** — SQLite-backed with orphan detection, liveness probes, delivery retries, steering queue. (`src/agents/subagent-registry.ts`)
- **Swarm Mode** — Lane-based concurrency limiter with per-group quotas. Retry with backoff. (`src/agents/swarm-scheduler.ts`)

### Tool Search

- **Dynamic Discovery** — `tool_search`, `tool_describe`, `tool_call`, `tool_search_code`. Keeps context lean. Code mode variant in QuickJS. (`src/agents/tool-search.ts`)

### Code Mode (QuickJS)

- **Sandboxed Execution** — QuickJS WASM runtime with memory limits, timeouts, output caps. Bridged tool search/call/yield. (`src/agents/code-mode.ts`)

### Sandbox System

- **Pluggable Backends** — Docker, SSH, OpenShell. Tool policy layer. Workspace mounting, remote filesystem bridges. (`src/agents/sandbox/`)

### Memory System

- **Dreaming** — Background cron jobs that "dream" (process transcripts into long-term memory). Light dreaming (periodic) and REM dreaming (deeper consolidation). Short-term → long-term promotion with budget constraints. (`extensions/memory-core/src/dreaming.ts`)

### Cron System

- **Production-Grade** — Declarative job definitions, delivery channels, session targeting (main/isolated), retry policies, heartbeat monitoring, pacing controls. (`src/cron/`)

### MCP Support

- **Bidirectional** — Both server and client. Channel bridging allows MCP tools from messaging channels. (`src/mcp/`)

### Session Management

- **Compaction** — Staged summarization with adaptive chunking, identifier preservation (UUIDs, hashes, URLs), circuit-breaker on generic fallbacks. (`src/agents/sessions/agent-session-compaction.ts`)

### Security

- **Multi-Layer** — DM pairing, allowlists, tool policies (allow/deny per tool per scope), sandbox restrictions, SSRF protection, credential isolation. Tool policy pipeline applies policies from multiple sources. (`src/security/`, `src/agents/tool-policy.ts`)

### Skills System

- **52 Bundled Skills** — 1Password, Apple Notes, GitHub, Spotify, Weather, etc. Skill-workshop for runtime creation. ClawHub marketplace. (`skills/`, `src/skills/`)

### Context Engine

- **Pluggable Providers** — Registered context providers for different information sources. (`src/context-engine/`)

### Other

- **Voice & Talk Mode** — Wake words, push-to-talk, continuous voice, realtime sessions via ElevenLabs. (`src/talk/`)
- **Live Canvas** — Agent-driven visual workspace (A2UI). (`src/canvas/`)
- **Browser Extension** — Chrome extension integration with profile management. (`extensions/browser/`)
- **Device Pairing** — iOS/Android/macOS companion apps as "nodes". (`src/gateway/node-registry.ts`)
- **Control UI** — Web dashboard (Vite + Lit). (`ui/src/`)
- **QA System** — YAML-defined scenarios with maturity scoring. (`qa/scenarios/`)
- **ACP (Agent Communication Protocol)** — Inter-agent spawn, steering, completion tracking. (`src/agents/acp-runtime-overlay.ts`)
- **SQLite-First Storage** — All runtime state in SQLite with Kysely. (`src/config/sessions/store-writer.ts`)
- **Tailscale Integration** — Zero-config secure remote access. (`src/gateway/server-tailscale.ts`)
- **OpenAI Responses API Compat** — Compatibility surface for OpenAI tools. (`src/gateway/openresponses-http.ts`)
- **Auth Profile Rotation** — Multi-profile with cooldown, expiry, round-robin, async primary probing. (`src/agents/auth-profiles.ts`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Auth Profile Rotation with Cooldown | Prevents single-point-of-failure |
| HIGH | Subagent Registry with SQLite Persistence | Formalizes agent lifecycle |
| HIGH | Tool Search Pattern | Keeps context windows lean |
| HIGH | Plugin Manifest System | Third-party extensibility |
| HIGH | Layered Tool Policy Pipeline | Restricts tools by role and security context |
| MEDIUM | Compaction with Identifier Preservation | Summarizes without losing FIDs/SHAs |
| MEDIUM | Memory Dreaming (Background Consolidation) | Auto-extracts lessons |
| MEDIUM | Context Engine with Registered Providers | Formalizes prompt composition |
| MEDIUM | SQLite-First Storage | Better concurrency than file-based |
| LOW | Swarm Scheduler (Lane-Based Concurrency) | If agent concurrency grows |
