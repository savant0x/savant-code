# OpenCode — Feature Inventory

> **Repo:** `resources/opencode-dev` | **Stack:** TypeScript/Bun + Effect-TS
> **Nature:** Kilo Code's upstream project

## Overview

OpenCode is the upstream project for Kilo Code. It is a TypeScript/Bun coding agent built on the Effect-TS library with a four-axis LLM route architecture, durable session runner, session input delivery (steer/queue), system context algebra, and content-addressed snapshots. It is one of the most architecturally principled coding agents.

## Feature Inventory

### LLM Provider System
- **Four-Axis Route Architecture** — Protocol (API contract), Endpoint (URL), Auth (credentials), Framing (stream decoding). DeepSeek, TogetherAI, Cerebras all reuse `OpenAIChat.protocol` — 5-15 lines per new provider. (`packages/llm/src/route/protocol.ts`, `endpoint.ts`, `auth.ts`, `framing.ts`)
- **Schema-First Data Model** — All LLM types as Effect Schema classes. Compile-time type safety + runtime validation + JSON encoding. (`packages/llm/src/schema/`)
- **Typed Tool Runtime** — `ToolRuntime.dispatch` decodes input against schema, dispatches, encodes output. Provider-defined tools pass through untouched. (`packages/llm/src/tool-runtime.ts`)

### Session Management
- **Durable Session Runner** — Runs one session until it settles. Loads history, resolves model, assembles system context, streams exactly one LLM turn, persists events incrementally, settles tools durably, loops. (`packages/core/src/session/runner/llm.ts`)
- **Session Input Delivery (Steer/Queue)** — `steer`: promoted at next safe boundary, resets step count. `queue`: pending until idle, one promoted per boundary. Prevents race conditions. (`packages/core/src/session/input.ts`)
- **Session Context Epoch** — Tracks when system context was last reconciled. Changes injected as durable updates at safe boundaries. (`packages/core/src/session/context-epoch.ts`)
- **Session Compaction** — Structured Markdown summary (Objective, Important Details, Work State, Next Move, Relevant Files). Tool output truncated to 2000 chars. (`packages/core/src/session/compaction.ts`)
- **Session Revert** — Captures snapshots, restores filesystem state. Stage preview then execute. (`packages/core/src/session/revert.ts`)

### System Context
- **System Context Algebra** — `Source<A>` with key, codec, load function, baseline/update/remove renderers. Composed into `SystemContext`, observed once for durable `Snapshot`. Prevents context drift. (`packages/core/src/system-context/`)

### Tool System
- **Tool.define Pattern** — `Tool.make({ description, input, output, execute, toModelOutput })`. Layered registration: Location > Application. Scoped lifecycle with `Effect.addFinalizer`. (`packages/core/src/tool/tool.ts`, `registry.ts`)
- **Tool Output Store** — 2000 lines, 50KB limit. Head/tail preview sampling. 7-day retention. (`packages/core/src/tool-output-store.ts`)

### Permission System
- **Wildcard Pattern Matching** — `allow/deny/ask` with `Wildcard.match`. Saved approvals. Config protection. (`packages/opencode/src/permission/evaluate.ts`)

### Agent System
- **Dual-Agent** — `build` (full-access) and `plan` (read-only). `general` subagent for complex searches. Tab to switch. Agent step limits with forced summary. (`packages/opencode/src/agent/agent.ts`)

### Plugin System
- **Comprehensive Hooks** — `event`, `config`, `tool`, `auth`, `provider`, `chat.message`, `chat.params`, `chat.headers`, `permission.ask`, `tool.execute.before`, `tool.execute.after`, `shell.env`, `experimental.chat.system.transform`, `experimental.session.compacting`. (`packages/plugin/src/index.ts`)

### MCP Integration
- **Full Client** — Stdio, SSE, Streamable HTTP transports. OAuth provider and callback. Browser-based flows. Catalog management. (`packages/opencode/src/mcp/`)

### Snapshot System
- **Content-Addressed** — Efficient deduplication. Diff between snapshots, preview restore, selective path restoration. 7-day retention. (`packages/core/src/snapshot.ts`)

### Other
- **Durable Event System (EventV2)** — SQLite-backed, replayable event store with aggregate sequence tracking. (`packages/core/src/event.ts`)
- **Background Job System** — Status tracking, output streaming, promotion (background → foreground), timeout. (`packages/core/src/background-job.ts`)
- **PTY Management** — Create, update, attach, detach. Subscriber-based data streaming with cursor tracking. 2MB cap. (`packages/core/src/pty.ts`)
- **LSP Integration** — Diagnostics, symbol lookup, document symbols, status tracking. (`packages/opencode/src/lsp/`)
- **IAM-Style Policy Engine** — Wildcard-pattern-matched statements. Last match wins. (`packages/core/src/policy.ts`)
- **Skill Discovery** — Remote URLs with concurrent fetching (4 skill, 8 file concurrency). Path validation. (`packages/core/src/skill/discovery.ts`)
- **Filesystem Watcher** — `@parcel/watcher` with platform backends. Gitignore-aware. (`packages/core/src/filesystem/watcher.ts`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Four-Axis LLM Route Architecture | Eliminates provider duplication |
| HIGH | Durable Session Runner | Gold standard for coding agent sessions |
| HIGH | Session Input Delivery (Steer/Queue) | Sophisticated human-agent interaction |
| HIGH | System Context Algebra | Advanced memory with source-based composition |
| HIGH | Session Compaction with Structured Summary | Essential for long-running agents |
| HIGH | Location-Scoped Service Graph | Clean multi-project isolation |
| HIGH | Plugin Hook Surface | Comprehensive extensibility model |
| MEDIUM | Content-Addressed Snapshots | Safe code modification |
| MEDIUM | Agent Step Limits with Forced Summary | Simple safety mechanism |
| MEDIUM | Tool Output Store with Preview | Efficient large output handling |
