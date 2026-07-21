# Kilo Code — Feature Inventory

> **Repo:** `resources/kilocode` | **Stack:** TypeScript/Bun + Effect-TS | **Version:** 7.4.11
> **License:** MIT | **Nature:** Fork of OpenCode

## Overview

Kilo Code is a TypeScript/Bun coding agent built on the Effect-TS functional-effect library. It features a route-based LLM provider system (4-axis decomposition), profile-based sandboxing, permission-controlled agent tool access with wildcard patterns, and a memory system with indexed search and secret filtering.

## Feature Inventory

### Architecture
- **Effect-TS Service Architecture** — Every subsystem is an Effect `Service` with `Layer` composition. `LayerNode` enforces Location-scoped vs global-scoped services at the type level. `InstanceState.make(init, dispose?)` creates project-scoped lazy singletons via `AsyncLocalStorage`. (`packages/opencode/src/agent/agent.ts`, `packages/opencode/src/effect/instance-state.ts`)

### Agent System
- **Permission-Controlled Tool Access** — 7+ built-in agents (code, plan, general, explore, scout, compaction, title, summary) plus user-defined custom agents. Typed `permission` rulesets with wildcard matching. `Permission.merge(defaults, user)` composition. (`packages/opencode/src/agent/agent.ts`, `packages/opencode/src/permission/index.ts`)
- **Subagent/Task Orchestration** — `task` tool spawns child sessions in foreground/background. Cost propagation, resumable task IDs, background auto-notify. (`packages/opencode/src/tool/task.ts`)
- **Agent Requirements** — Pre-flight validation of MCP servers, skills before execution. (`packages/opencode/src/kilocode/agent-requirements.ts`)

### Tool System
- **Tool.define Pattern** — `Tool.define(id, init)` returns `{ description, parameters, execute }`. Auto-truncation with managed output files (bounded preview + complete file). (`packages/opencode/src/tool/tool.ts`, `packages/opencode/src/tool/truncate.ts`)
- **48 Built-in Tools** — `apply_patch`, `edit`, `glob`, `grep`, `lsp`, `read`, `write`, `shell`, `task`, `webfetch`, `websearch`, `skill`, `recall` (memory), `repo_clone`, `warpgrep`, `diagnostics`. (`packages/opencode/src/tool/`)

### LLM Provider System
- **Route-Based 4-Axis Architecture** — Protocol (API contract), Endpoint (URL), Auth (credentials), Framing (stream parsing). 5-15 lines per new provider. DeepSeek, TogetherAI, Cerebras all reuse `OpenAIChat.protocol`. (`packages/llm/src/route/client.ts`, `packages/llm/src/protocols/`)
- **Provider Facades** — `OpenAI.configure({ apiKey }).responses("gpt-4o-mini")`. (`packages/llm/src/providers/openai.ts`)
- **Recorded Test Cassettes** — VCR-style cassettes with multi-interaction support. (`packages/llm/test/`)

### Session Management
- **Context Epochs** — Immutable baseline system context per epoch. Changes admitted lazily at safe provider-turn boundaries. `SystemContextRegistry` with ordered, scoped contributions. (`packages/opencode/CONTEXT.md`, `packages/opencode/src/session/system.ts`)
- **Compaction** — Chunked processing, payload recovery, replay of user turns. `preserve_recent_tokens` budget. (`packages/opencode/src/session/compaction.ts`)

### Permission System
- **Wildcard Pattern Matching** — `Wildcard.match` with `ask/allow/deny` actions. Composable via `Permission.merge(...)`. Config file protection for `.env`, `*.env.*`. (`packages/opencode/src/permission/index.ts`)

### Sandbox System
- **Profile-Based Sandboxing** — Three-axis: filesystem (allow/deny write paths), network (allow/deny/proxy), environment (deny vars, set vars). Bubblewrap/Seatbelt backend support. Network proxy with per-session tokens. (`packages/kilo-sandbox/src/profile.ts`, `packages/kilo-sandbox/src/network.ts`)

### Memory System
- **Indexed Search** — `remember`, `forget`, `correct`, `recall`, `catalog` operations. Token-based budgeting, auto-consolidation. Session digest recording. Secret filtering. (`packages/kilo-memory/src/memory.ts`)

### Skills System
- **Multi-Location Discovery** — Global (`~/.claude/skills/`), project (`.kilo/skills/`), config, custom paths. Trust provenance tracking. Built-in skills seed before user skills. (`packages/opencode/src/skill/index.ts`)

### Worktree Management
- **Git Worktree Isolation** — Create, list, remove, reset. Handles Windows fsmonitor daemon stop. (`packages/opencode/src/worktree/index.ts`)

### Other
- **MCP Integration** — Full client with OAuth, tool listing, prompt caching, resource reading. (`packages/opencode/src/mcp/index.ts`)
- **Hono HTTP Server** — OpenAPI spec generation, SSE for real-time events, auto-generated TypeScript SDK. (`packages/opencode/src/server/server.ts`)
- **mDNS Discovery** — Server registers via mDNS for local network discovery. (`packages/opencode/src/server/mdns.ts`)
- **Tree-Sitter Indexing** — Language detection, file extension mapping, header extraction. (`packages/kilo-indexing/src/`)
- **PostHog + OpenTelemetry** — Telemetry with per-request tracing. (`packages/kilo-telemetry/src/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Effect-TS Service Architecture | Structured concurrency, typed errors, clean DI |
| HIGH | Route-Based LLM Provider System | Composable 4-axis provider abstraction |
| HIGH | Profile-Based Sandboxing | Filesystem/network/environment constraints |
| HIGH | Permission-Controlled Agent Tool Access | Wildcard patterns, composable rulesets |
| HIGH | Subagent with Cost Propagation | Background tasks with cost tracking |
| HIGH | Context Epochs | Formal context management model |
| HIGH | Memory with Indexed Search | Project memory, session digests, secret filtering |
| MEDIUM | Git Worktree Isolation | Parallel sessions with cleanup |
| MEDIUM | SKILL.md Discovery with Trust Provenance | Multi-location skill loading with security |
| MEDIUM | Tool Auto-Truncation | Managed output files prevent context overflow |
