# Agno — Feature Inventory

> **Repo:** `resources/agno` | **Language:** Python | **License:** Apache-2.0
> **Tagline:** High-performance AI agent framework

## Overview

Agno is a Python-based AI agent framework with an extremely broad provider surface (54 LLM providers), a composable workflow engine, and a full AgentOS serving layer. It emphasizes performance, modularity, and multi-agent orchestration.

## Feature Inventory

### Agent Core

- **Agent Class** — Central orchestrator with model, tools, memory, knowledge, instructions, session management, fork/checkpoint, telemetry. (`agent/agent.py`)
- **Agent Factory** — Config-driven dynamic agent creation from YAML/JSON dicts. (`agent/factory.py`)
- **Remote Agent** — Transparent delegation to remote AgentOS endpoints. (`agent/remote.py`)
- **Session Forking** — Branch session state for alternative explorations. (`cookbook/02_agents/21_fork_session/`)

### Team Orchestration

- **Team Class** — Multi-agent coordinator with four modes: coordinate, route, broadcast, tasks. (`team/team.py`, `team/mode.py`)

### Workflow Engine

- **Workflow Class** — DAG of steps with conditional routing, loops, and dynamic step selection. (`workflow/workflow.py`)
- **CEL Router** — Common Expression Language for routing conditions. (`workflow/cel.py`)

### Model Layer (54 Providers)

- **Provider Catalog** — 54 provider implementations: OpenAI, Anthropic, Google, xAI, DeepSeek, MiniMax, Bedrock, Vertex, Azure, Groq, Together, Fireworks, Ollama, LM Studio, Mistral, Cohere, HuggingFace, Novita, SambaNova, Cerebras, Perplexity, IBM watsonx, etc. (`models/`)
- **Reasoning Providers** — 13 first-class reasoning model support modules. (`reasoning/`)

### Tool System

- **Toolkit Class** — Container with caching, include/exclude filtering, HITL confirmation. (`tools/toolkit.py`)
- **MCP Tools** — Client + multi-MCP server merging with auth and namespacing. (`tools/mcp/mcp.py`, `tools/mcp/multi_mcp.py`)
- **Workspace Tool** — File system + shell with allow/confirm/exclude patterns. (`tools/workspace.py`)
- **145 Tool Integrations** — File, shell, web, search, email, calendar, CRM, databases, cloud, media, social, finance. (`tools/`)

### Memory & Knowledge

- **Memory Manager** — Strategy-based memory (summarize, etc.) with DB backend. (`memory/manager.py`, `memory/strategies/`)
- **Knowledge System** — Vector DB with 24 backends, document loaders, chunking, embedders, rerankers. (`knowledge/`, `vectordb/`)
- **Context Providers** — 12+ providers: calendar, database, filesystem, Gmail, Google, Slack, web, wiki, workspace. (`context/`)

### Learning System

- **LearningMachine** — Orchestrates memory, entity memory, session context, learned knowledge, decision logs. (`learn/machine.py`)

### Scheduler

- **ScheduleManager** — DB-backed cron scheduler with persistence. (`scheduler/manager.py`)

### Eval System

- **Eval Suite** — Cases, AgentAsJudge, Reliability eval, SuiteResult. (`eval/`)

### Guardrails & Approval

- **BaseGuardrail** — Check/validate inputs or outputs. (`guardrails/base.py`)
- **@approval Decorator** — HITL gating with `required` and `audit` modes. (`approval/decorator.py`)

### AgentOS

- **FastAPI Application** — Serves agents as HTTP endpoints with auth, MCP, WebSocket streaming. (`os/app.py`)
- **MCP Server** — Exposes agents as MCP servers. (`os/mcp.py`)
- **Interface Adapters** — A2A, AG-UI, Slack, Telegram, WhatsApp. (`os/interfaces/`)
- **19 API Routers** — Agents, approvals, components, database, evals, health, knowledge, etc. (`os/routers/`)

### Other

- **CompressionManager** — LLM-based tool output compression. (`compression/manager.py`)
- **OpenTelemetry Tracing** — Full OTel with DB-backed span export. (`tracing/`)
- **22 Database Backends** — PostgreSQL, SQLite, MySQL, MongoDB, Redis, DynamoDB, etc. (`db/`)

## Top Adoptable Ideas for savant-code

| Rank | Feature | Impact | Effort |
|------|---------|--------|--------|
| 1 | MCP Client + Server | Critical | Medium |
| 2 | 54-provider model catalog (adapter pattern) | High | Medium |
| 3 | Workflow Engine with CEL routing | High | Medium |
| 4 | Persistent Memory with strategy system | High | Medium |
| 5 | @approval HITL decorator | High | Low |
| 6 | Scheduler (DB-backed cron) | Medium | Low |
| 7 | Eval Suite (Case/SuiteResult/Reliability) | Medium | Low |
| 8 | Context Providers for git/CI/docs | Medium | Low |
| 9 | Team Modes (coordinate/route/broadcast/tasks) | Medium | Low |
| 10 | CompressionManager for tool outputs | Low-Medium | Low |
