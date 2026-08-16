# OpenHands — Feature Inventory

> **Repo:** `resources/OpenHands` | **Language:** Python | **Stack:** FastAPI + React frontend
> **License:** MIT

## Overview

OpenHands is a multi-backend coding agent platform with a sandbox abstraction layer (Docker, local process, remote VM, cloud), an Agent-Client Protocol (ACP) for interoperability, trigger-based skill loading, an EventCallbackProcessor pattern for integrations, and enterprise features (Slack, Jira, GitHub, billing).

## Feature Inventory

### Multi-Backend Agent Orchestration

- **Sandbox Abstraction** — Run agent work in Docker, local process, remote VM, or cloud. Flip between backends mid-session. (`openhands/app_server/sandbox/sandbox_service.py`, `docker_sandbox_service.py`, `process_sandbox_service.py`, `remote_sandbox_service.py`)

### Agent-Client Protocol (ACP)

- **Interoperability Protocol** — Any agent implementing ACP can plug in as a sub-agent or standalone backend. (`openhands/app_server/integrations/service_types.py`)

### Skills / Microagents

- **Trigger-Based Loading** — Skills only injected when user messages match keyword triggers. Multi-source: public skills, repo-specific (`.openhands/skills/`), org-level. MCP tool declarations in skill frontmatter. Self-improving `agent_memory` skill. (`skills/`, `openhands/app_server/app_conversation/skill_loader.py`)

### MCP Integration

- **Server + Proxy** — Exposes tools (create_pr, create_mr) as MCP tools. Proxies remote MCP services under namespaces (e.g., Tavily under `tavily/`). (`openhands/app_server/mcp/mcp_router.py`)

### Event System

- **EventCallbackProcessor** — Typed event-driven hooks for FID state changes, notifications, downstream work. Webhook, Slack, Jira, GitHub callbacks. (`openhands/app_server/event/event_service.py`, `event_callback/`)

### Git Integration

- **Multi-Provider** — GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo. Uniform `GitService` protocol. PR/MR creation via MCP tools. (`openhands/app_server/integrations/`)

### Secrets Management

- **Sandbox-Scoped** — Two-tier: user-level encrypted secrets + sandbox-scoped endpoints. `ConversationSecretEnricher` extension point. (`openhands/app_server/secrets/`)

### LLM Profiles

- **Switchable Configurations** — Up to 10 named LLM profiles with active pointer. Managed proxy URL resolution. (`openhands/app_server/settings/llm_profiles.py`)

### Task Tracking

- **Planner UI** — Real-time task list with status. `TaskTrackerAction`/`TaskTrackerObservation` events. (`frontend/src/components/v1/chat/task-tracking/`)

### Enterprise Integrations

- **Slack, Jira, GitHub, Linear, Bitbucket, Azure DevOps** — Callback processor pattern with typed `EventKind`. (`enterprise/integrations/`)

### Other

- **Sandbox Lifecycle** — Start, resume, pause, delete with health-check polling. `wait_for_sandbox_running` with configurable timeout. (`openhands/app_server/sandbox/`)
- **File Store Abstraction** — Local, S3, Google Cloud, in-memory. (`openhands/app_server/file_store/`)
- **Event Store** — Filesystem, AWS, Google Cloud backends. (`openhands/app_server/event/`)
- **Sub-Agent Visualization** — UI renders delegated agent work as distinct components. (`frontend/src/components/v1/chat/subagent/`)
- **Suggested Task Generation** — Auto-generates tasks from merge conflicts, failing CI, unresolved PR comments. (`openhands/app_server/integrations/templates/suggested_task/`)
- **Browser Automation** — Navigate, click, type, scroll, switch tabs. (`frontend/src/components/v1/chat/event-content-helpers/`)
- **Workspace Archive** — Archive workspace state before sandbox teardown. (`openhands/app_server/sandbox/workspace_archive.py`)
- **Rate Limiting** — In-memory (OSS) + Redis (enterprise). (`openhands/app_server/middleware.py`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Sandbox Abstraction Layer | Run agent work in Docker, local, or cloud interchangeably |
| HIGH | EventCallbackProcessor Pattern | Typed event-driven hooks for FID state changes |
| HIGH | Trigger-Based Skill Loading | Only inject skills when relevant |
| HIGH | Agent Memory Skill | Self-improving pattern for future sessions |
| MEDIUM | MCP Proxy Pattern | Namespace-mount remote MCP servers securely |
| MEDIUM | Suggested Task Generation | Auto-generate FIDs from repo issues |
| MEDIUM | Hooks System | User-defined event-driven lifecycle hooks |
| MEDIUM | Sub-Agent Event Visualization | Structured rendering of delegated work |
| LOW | Workspace Archive | Archive state before teardown |
| LOW | PR Directory Pattern | `.pr/` for temporary PR-specific artifacts |
