# Feature Parity Report — savant-code vs. Reference Repos

> **Generated:** 2026-07-19
> **Revised:** 2026-07-20 — (1) corrected false "absent" claims for MCP client,
> MCP server, and skills system after re-verification against the savant-code
> codebase (see corrected Section 5.1 and gap matrix rows); (2) expanded scope
> from 4 reference repos to all 16 (full coverage of `resources/`).
> **⚠️ Archival note (2026-07-23):** The `resources/` directory containing the 16 reference repos has been removed from disk. This report and the companion `adoptable-features-master.md` are preserved as historical research. The `docs/reports/repos/` subfolder retains the individual per-repo analysis files. Feature parity gaps identified here may have changed — run a fresh baseline pass before acting on any recommendation.
> **Purpose:** Identify features present in the 16 reference repositories under
> `resources/` that **savant-code does not currently have**,
> to drive a feature-parity program.
> **Scope:** All 16 repos in `resources/` — `agno/`, `aider/`, `AionUi/`, `cline/`,
> `codex/`, `gemini-cli/`, `goose/`, `gpt-pilot/`, `hermes-agent/`, `kilocode/`,
> `openclaude/`, `openclaw/`, `opencode-dev/`, `OpenHands/`, `SWE-agent/`, `zero/`.
> **Companion document:** `docs/reports/adoptable-features-master.md` is the
> feature-first 16-repo synthesis (20 numbered features, each with per-repo
> comparison tables). This report is the product-first counterpart (per-repo
> snapshots + category-grouped gap matrix + per-gap evidence).
> **Method:** Each repo was scanned in depth by an independent read-only Explore agent
> (file inventory with path citations). savant-code's baseline was established from direct
> reads of `packages/llm-providers/`, `sdk/src/impl/`, `common/src/constants/`, `agents/`,
> `packages/agent-runtime/`, `ECHO.md`, and `AGENTS.md`.

---

## 1. Executive Summary

savant-code is a **TypeScript, Bun-based, multi-agent coding assistant** with a strong
**governance layer** (ECHO Protocol, 10-agent roster, FID-bound Perfection Loop) and a
**free-tier model catalog**. It is engineered for *correct, reviewable* code generation
through a small, disciplined agent roster and a single OpenAI-compatible provider
abstraction.

The 16 reference repositories span **coding agents, personal-agent platforms, research
frameworks, and one platform SDK** — most are broader and more productized than
savant-code:

| Product | Lang | Primary Shape | Approx. Feature Breadth |
|---|---|---|---|
| **agno** | Python | Agent framework + AgentOS | 54 providers, 145 tools, 22 DB backends, 24 vector DBs, workflow engine, MCP, AgentOS HTTP serving |
| **aider** | Python | Terminal pair-programming (~6.8M installs) | 13 edit formats, PageRank repo map, multi-model tiers, prompt-cache warming, SWE-bench eval |
| **AionUi** | Electron+Rust+TS | Desktop AI coworking app | 30+ providers, ACP wrapping 20+ CLI agents, team mode, full extension SDK, cron, mobile app |
| **cline** | TS/Bun | Layered-SDK coding agent | 9 tool factories, plugin sandbox, multi-agent teams, 7-callback hooks, VCR testing, 3-layer eval |
| **codex** | Rust+TS | OpenAI's CLI coding agent | OS sandbox (SBPL/seccomp), Starlark exec policy, 11-event hooks, two-phase memories, app-server RPC |
| **gemini-cli** | TS/Node | Google's Gemini CLI | Graph-based context, scheduler with parallel batching, BeforeModel synthetic responses, behavioral evals |
| **goose** | Rust+TS | Linux Foundation coding agent | 15+ providers, 70+ MCP servers, recipe system, plugin auto-update, cron for agent sessions |
| **gpt-pilot** | Python | Structured dev workflow agent | Step-based dev, TDD, BugHunter debugging loop, project scaffolding |
| **hermes-agent** | Python+TS | Personal + coding agent, multi-surface | ~95 tools, ~30 channels, 35 providers, Kanban, MOA, billing, TUI/Web/Desktop/Mobile |
| **kilocode** | TS/Bun | OpenCode fork with Effect-TS | 4-axis LLM route, profile sandbox, permission-controlled agents, memory with indexed search, worktree |
| **openclaude** | TS/Bun | Claude-Code-style coding agent | 25+ providers, smart routing, LSP, voice, sandbox, VS Code ext, teams/swarms, goals, wiki |
| **openclaw** | TS | Personal-AI-agent **platform** | 150+ provider extensions, 40+ channels, 152 extensions, 51 skills, media-gen, fleet, multi-OS apps |
| **opencode-dev** | TS/Bun+Effect | OpenCode upstream | 4-axis LLM route, durable session runner, Steer/Queue, system context algebra, content-addressed snapshots |
| **OpenHands** | Python+React | Multi-backend agent platform | Docker/local/remote/VM sandbox abstraction, ACP, trigger-based skills, MCP proxy, enterprise integrations |
| **SWE-agent** | Python | Princeton research agent | ACI philosophy, 11 parser strategies, history processor pipeline, 3-layer hooks, retry with review loop |
| **zero** | Go | Terminal coding agent | 25+ providers, swarm, OS-level sandbox (landlock/seccomp/seatbelt), MCP, built-in eval/benchmark |

**Headline gap:** savant-code has a **partial** MCP layer (client tool loader +
3 bundled MCP servers, but no dedicated `packages/mcp/` workspace, OAuth, or
InProcessTransport), a **partial** skills surface (runtime loader + 7 bundled
skills, but no plugin SDK or marketplace), **no** scheduling/cron, **no**
OS-level sandbox, **no** messaging-channel integrations, **no**
Web/Desktop/Mobile apps (CLI/TUI + SDK only), and **no** media generation
(image/video/music/TTS). Its provider surface (~8 model prefixes via
OpenRouter) and agent roster (9 fixed roles) are intentionally narrow versus
the 25–150 providers and dynamic agent/skill/plugin ecosystems of the
references.

The single most consequential parity gap is the **absence of a consolidated
extensibility surface** (dedicated `packages/mcp/` workspace + plugin SDK +
skills marketplace) — savant-code has scattered primitives but no unified
plugin boundary, which is the scaling ceiling the reference products solved
with plugin/skill architectures.

---

## 2. savant-code Capability Baseline (what it HAS)

Established from direct source reads. Citations are to the savant-code workspace.

| Capability | Evidence in savant-code |
|---|---|
| Multi-agent roster (9 roles) | `AGENTS.md`, `ECHO.md` (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe) |
| FID-bound Perfection Loop governance | `ECHO.md` (FID lifecycle, Perfection Loop FSM), `dev/fids/` |
| OpenAI-compatible provider abstraction | `packages/llm-providers/src/openai-compatible/` (`OpenAICompatibleChatLanguageModel`) |
| Provider routing (SDK) | `sdk/src/impl/model-provider.ts` — `getModelForRequest()` → ChatGPT-OAuth-direct **or** SavantCode/OpenRouter backend |
| Env-driven inference bypass | `sdk/src/env.ts` (`INFERENCE_BASE_URL`, `INFERENCE_API_KEY`); `sdk/src/impl/openrouter-key-resolver.ts` (`OR_MASTER_KEY` exchange) |
| Model registry + prefixes | `common/src/constants/model-config.ts` (`ALLOWED_MODEL_PREFIXES`: anthropic, openai, google, x-ai, deepseek, minimax, mimo, tencent) |
| Free-tier model catalog | `common/src/constants/savant-free-models.ts` (MiniMax M3, DeepSeek V4, MiMo, Kimi, GLM, HY3) |
| Per-agent model + providerOptions | `agents/*.ts` (`model`, `providerOptions: { only, order, allow_fallbacks, data_collection }`) |
| Sub-agent spawning | `agent-runtime` `spawn_agents` tool; `withParentModel()` model inheritance (`spawn-agent-utils.ts`) |
| MCP client tool loader (partial) | `packages/agent-runtime/src/mcp.ts` — per-server failure isolation, JSON-schema→Zod conversion; `sdk/src/agents/load-mcp-config.ts` — multi-source config merger (project + user + env-var resolution) |
| MCP servers (3 bundled) | `research/servers-main/src/{sequentialthinking,memory,filesystem}/index.ts` — built on `@modelcontextprotocol/sdk/server/mcp.js` |
| Skills loader (partial) | `packages/agent-runtime/src/tools/handlers/tool/skill.ts` — frontmatter validation, 4-directory search (`~/.agents/skills/`, `~/.claude/skills/`, project `.agents/skills/`, `.claude/skills/`); 7 bundled skills in `.agents/skills/` (coding-csharp, coding-go, coding-java, coding-python, coding-rust, coding-typescript, release-workflow) |
| Tool set (core) | bash (`tmux-cli`, `basher`), file read/edit, glob/grep, `browser-use` agent, tree-sitter `code-map`, tmux |
| SDK streaming + cost accounting | `sdk/src/impl/llm.ts` (provider metadata, cache-debug, `OpenRouterUsageAccounting`) |
| CLI (OpenTUI + React) | `cli/` (`dev`, `run`) |
| Eval harness | `evals/` (Buffbench benchmark runner, `bun --cwd evals run-buffbench`) |
| Database layer | `packages/database/` (better-sqlite3) |
| ChatGPT OAuth direct route | `sdk/src/impl/chatgpt-backend-fetch.ts` (Responses-API ↔ Chat-Completions transform) |

---

## 3. Reference Product Snapshots

### 3.1 hermes-agent (Python)

Nous Research's Hermes Agent. Extremely broad: ~95 self-registering tools (`tools/registry.py`),
~30 messaging channels (`gateway/platforms/`, `plugins/platforms/` — Telegram, Discord, Slack,
WhatsApp, Signal, Matrix, etc.), **35 model-provider plugins** (`plugins/model-providers/`:
openrouter, anthropic, gemini, bedrock, vertex, deepseek, fireworks, xai, minimax, kimi, zai…),
Kanban multi-agent board (`plugins/kanban/`), Mixture-of-Agents (`agent/moa_loop.py`),
Skills Hub + 19 bundled + 19 optional skill categories (`skills/`, `optional-skills/`),
plugin SDK (`PluginManager`), full TUI (Ink/React) + Web dashboard (FastAPI/React, 20 pages) +
Electron desktop + Tauri installer + Termux mobile, Cron scheduler (`cron/`), MCP client
**and server** (`mcp_serve.py`), billing/usage (`agent/billing_usage.py`), trajectory-compression
training pipeline (`trajectory_compressor.py`), and a strong security stack (approval patterns,
Tirith pre-exec scan, file/secret safety). Evidence: `hermes-agent/README.md`,
`hermes-agent/AGENTS.md`, `hermes-agent/tools/`, `hermes-agent/plugins/`.

### 3.2 openclaude (TS/Bun)

Claude-Code-style coding agent. Rich tool set (~120 slash commands; `src/tools/` — Bash,
PowerShell, FileRead/Write/Edit, Glob, Grep, NotebookEdit, WebSearch/Fetch/Browser, RepoMap,
LSP, Task/ScheduleCron, Workflow, SendMessage, TeamCreate). **~25 vendors + ~25 gateways**
(`src/integrations/vendors/`, `gateways/`: anthropic, openai, deepseek, gemini, fireworks, xai,
minimax, moonshot, openrouter, ollama, lmstudio, groq, together, bedrock, vertex, azure…).
Smart model routing (`smartModelRouting.ts`, `agentRouting.ts`), agent routing per sub-agent,
context auto/micro/snippet compaction (`src/services/compact/`), repo-map (PageRank),
persistent memory (`src/memdir/`, team-memory sync with secret scanning), **OS sandbox**
(`@anthropic-ai/sandbox-runtime`, `shouldUseSandbox.ts`), **LSP integration**, **voice mode**,
**VS Code extension**, Android (Termux), goals system, wiki/knowledge base, MCP client+server

+ official registry, security-review / bughunter commands, gRPC headless server, background
daemon. Evidence: `openclaude/README.md`, `openclaude/AGENTS.md`, `openclaude/src/`.

### 3.3 openclaw (TS) — the broadest platform

Personal-AI-agent **platform**. **150+ provider extensions** (`extensions/` — openai, anthropic,
google, meta, mistral, deepseek, xai, groq, ollama, bedrock, vertex, openrouter, litellm,
cloudflare-ai-gateway, tencent, volcengine, alibaba, nvidia…), **model-catalog** subsystem
(`src/model-catalog/`), **40+ channels** (`extensions/` — whatsapp, telegram, discord, signal,
imessage, irc, msteams, matrix, feishu, line, wechat, qq, slack, google-meet, zoom, webhooks…),
**152 extensions**, **51 skills** + ClawHub registry, public **plugin-sdk**, **fleet**
(multi-tenant container cells, `src/fleet/`), **system-agent**, **code-mode** (coding agent),
**swarm**, **media generation** (image/video/music/`src/tts/`), **meeting bots**, realtime
transcription / Talk voice-wake, **Canvas / computer-use**, multi-OS apps (macOS, iOS, Android,
Linux, Windows `swabble`), Web Control UI (Lit), TUI, daemon + gateway, ACP binding, secrets
(SecretRef), policy engine, sandbox (Docker/SSH), audit log, OTel/Prometheus, Docker/Fly/Render
deploy. Evidence: `openclaw/README.md`, `openclaw/VISION.md`, `openclaw/src/`, `openclaw/extensions/`.

### 3.4 zero (Go)

Terminal coding agent (Claude-Code/Codex-style). Specialists + **swarm** (`internal/swarm/`),
**25+ providers** (`internal/providercatalog/catalog.go` — OpenAI, Anthropic, Google, Bedrock,
Vertex, OpenRouter, DeepSeek, Qwen, Kimi, MiniMax, Mistral, xAI, Groq, Ollama, LM Studio…),
model registry with smart/deep/fast **modes**, reasoning-effort, **model escalation /
self-correct loop**, LSP navigation, plan/spec mode, skills (`SKILL.md` packs), **plugins**
(`plugin.json` bundles tools/hooks/skills), **OS-level sandbox** (Linux landlock+seccomp,
macOS seatbelt, Windows ACL/unelevated — `internal/sandbox/`), hooks, secrets redaction,
encrypted credential store/OS keyring, durable sessions with compaction/rewind/checkpoints,
cron, **MCP client + server** (`zero serve --mcp`), **built-in eval + perf-bench harnesses**
(`internal/agenteval/`, `internal/perfbench/`), ACP integration, GitHub Action + Slack/PR
notifiers. **No Web UI, no Mobile, no Docker image.** Evidence: `zero/zero-main/README.md`,
`zero/zero-main/docs/`, `zero/zero-main/internal/`.

### 3.5 agno (Python)

High-performance AI agent framework. **54 LLM providers** (`models/` — OpenAI, Anthropic,
Google, xAI, DeepSeek, MiniMax, Bedrock, Vertex, Azure, Groq, Together, Fireworks, Ollama,
LM Studio, Mistral, Cohere, HuggingFace, Novita, SambaNova, Cerebras, Perplexity, watsonx…),
composable workflow engine with CEL routing (`workflow/`), Team class with 4 modes
(coordinate/route/broadcast/tasks), **145 tool integrations**, **24 vector DB backends**,
memory manager with strategy system, **AgentOS** HTTP serving (FastAPI) exposing agents as
endpoints + MCP servers, 22 database backends, OpenTelemetry tracing, DB-backed cron
scheduler, eval suite, guardrails, @approval HITL decorator, session forking. Evidence:
`agno/README.md`, `agno/agent/`, `agno/models/`, `agno/tools/mcp/`, `agno/os/`.

### 3.6 aider (Python)

Mature terminal pair-programming agent (~6.8M installs, ~60k stars). Distinguishing
innovations: **13+ polymorphic edit formats** (SEARCH/REPLACE, unified diff, whole file,
patch, fenced/editor variants, architect/editor two-stage, ask, context, help —
`coders/base_coder.py`), **PageRank + tree-sitter repo map** (`repomap.py`) with 10x
snake_case weight / 0.1x private identifier weight, multi-model tiers (main/weak/editor),
**prompt-cache warming** background thread, recursive chat-history summarization, AI-comment
file watcher (editor-agnostic trigger), reflection loop (edit → lint → retry up to
`max_reflections`), deep git integration with co-author attribution, voice-to-code,
benchmark framework (Polyglot Exercism + SWE-bench with Docker isolation). 100+ model
configs in declarative YAML. Evidence: `aider/README.md`, `aider/coders/`, `aider/repomap.py`.

### 3.7 AionUi (Electron + React + Rust + Bun + TS)

Desktop-first AI coworking app. Wraps **20+ CLI-based AI agents** (Claude Code, Codex,
Goose, OpenClaw, Hermes, Cursor…) behind a unified **ACP protocol** with capability
negotiation. **Team mode** with leader/teammate hierarchy, mailbox communication, task
dependency graph (`blocked_by`/`blocks`). **30+ LLM platforms** including Chinese providers
(Zhipu, Moonshot, Qianfan, Hunyuan). **Centralized MCP** ("configure once, sync to all
agents"). Three-tier skills system (builtin/custom/extension) with per-conversation toggle.
Cron scheduler with conversation-bound mode. SQLite (WAL mode, 26 schema versions).
**Extension SDK** with `aion-extension.json` manifest declaring 7 contribution points (ACP
adapters, MCP servers, assistants, agents, skills, themes, settings). Mobile companion
(React Native/Expo). 7 chat-platform connectors (Telegram, Lark, DingTalk, WeChat, WeCom,
Slack, Discord). Evidence: `AionUi/README.md`, `AionUi/packages/desktop/src/`, `AionUi/examples/`.

### 3.8 cline (TypeScript/Bun)

Disciplined layered-SDK coding agent (`@cline/shared → llms → agents → core → apps`).
9 default tool factories with 5 presets (Act/Plan/Search/Minimal/Yolo), model-tool routing
(OpenAI gets `apply_patch` instead of `editor`), **SubprocessSandbox** for plugins (IPC
isolation, typed message protocol, auto-reinit on crash), **contribution-based plugins**
(tools/commands/rules/message-builders/providers/MCP/shortcuts/flags) with marketplace,
**AgentTeamsRuntime** multi-agent system (lead/teammate, mailbox, run queuing, completion
guard, 20+ team tools), **7-callback hooks** (`beforeModel` can inject messages/modify tools
per-request), markdown-spec cron system, 6 platform connectors, loop detection (soft at 3,
hard at 5), git-based checkpoints, VCR HTTP recording for testing, 3-layer eval pyramid
(contract → smoke → E2E Harbor/SWE-bench). Evidence: `cline/README.md`, `cline/sdk/packages/`.

### 3.9 codex (Rust + TS/Python SDKs)

OpenAI's Codex CLI. **OS-level sandboxing** (macOS Seatbelt SBPL, Linux seccomp/Landlock/
bubblewrap, Windows restricted token — `codex-rs/sandboxing/`), **Starlark execution policy**
(prefix matching, host executable resolution, self-validating rules — `codex-rs/execpolicy/`),
**11-event lifecycle hooks** (PreToolUse, PermissionRequest, PostToolUse, PreCompact,
PostCompact, SessionStart/End, UserPromptSubmit, SubagentStart/Stop, Stop — `codex-rs/hooks/`),
multi-strategy context compaction, thread lifecycle (create/resume/fork/archive/delete/
rollback) with dual JSONL+SQLite persistence, **role-based agent registry** (explorer/worker
with config layering), **two-phase memories pipeline** (Phase 1: parallel extraction;
Phase 2: git-baseline diff consolidation), bidirectional MCP, Markdown skills with scope
(User/Repo/System/Admin), full plugin/marketplace ecosystem, app-server JSON-RPC protocol
(50+ methods, `turn/steer`, `thread/fork`, backpressure), realtime voice, agent graph store,
rollout budgets. Evidence: `codex/README.md`, `codex/codex-rs/`.

### 3.10 gemini-cli (TypeScript/Node)

Google's Gemini CLI. 7-package monorepo (core/cli/sdk/a2a-server/vscode-companion/
devtools/test-utils). **Graph-based context management** with typed nodes (UserPrompt,
AgentThought, ToolExecution, MaskedTool, AgentYield, Snapshot, RollingSummary) and a
processor pipeline (blobDegradation, historyTruncation, nodeDistillation, rollingSummary,
stateSnapshot, toolMasking). **Event-driven scheduler** with parallel batching for non-edit
tools, sequential for edits. **10-event hook system** including **BeforeModel synthetic
responses** (bypass the model call entirely — enables caching/testing/safety interception).
Composite model routing (Fallback → Override → ApprovalMode → GemmaClassifier → Classifier
→ Default, with local Gemma for cheap routing). Behavioral evals with **dynamic baselines**
(nightly 3x per model, fails-on-main marked "Pre-existing", trustworthiness filter 60%+ per
night). JIT subdirectory context discovery. Agent acknowledgement system for untrusted
definitions. Evidence: `gemini-cli/README.md`, `gemini-cli/packages/core/src/`.

### 3.11 goose (Rust + Electron/TS UI + Ink/React TUI)

Linux Foundation / AAIF coding agent (v1.43.0). **15+ providers** with declarative YAML
custom providers and OAuth device flow. **70+ MCP server extensions** via `ExtensionManager`
(subprocess spawning, OAuth, health monitoring, malware checking via OSV API). 10 built-in
extensions (analyze/tree-sitter, todo, apps, chatrecall, summon, orchestrator, summarize,
developer, extensionmanager). Subagent system with delegate/summon (sync + async, background
tasks with real-time status). **Cron for agent sessions** (full provider/extension context,
not just shell commands). Recipe system (YAML task definitions with sub-recipes, response
schemas, retry configs). Plugin dual-format (Gemini + OpenPlugins) with auto-update every 24h.
11 lifecycle hooks. Tool inspector pipeline (permission → security → adversary → egress →
repetition). Evidence: `goose/README.md`, `goose/crates/goose/`, `goose/crates/goose-mcp/`.

### 3.12 gpt-pilot (Python)

Structured development workflow agent. **Step-based development** — breaks projects into
ordered phases (architecture, planning, coding, testing, debugging) with clear entry/exit
criteria. **TDD integration** — generates tests before code, runs them, iterates until
passing. **BugHunter debugging loop** — when tests fail, analyzes error output, proposes
fixes, re-runs tests, bounded by attempt ceiling. Project scaffolding from templates.
Curated Agent-Computer Interface (structured file viewers, search commands, editors rather
than raw shell). Automatic git commits at logical boundaries. Conversation history
summarization. Evidence: `gpt-pilot/README.md`, `gpt-pilot/pilot/`.

### 3.13 kilocode (TypeScript/Bun + Effect-TS)

Fork of OpenCode built on Effect-TS. Every subsystem is an Effect `Service` with `Layer`
composition; `LayerNode` enforces Location-scoped vs global-scoped services at the type
level. **4-axis LLM route architecture** (Protocol/Endpoint/Auth/Framing, 5-15 lines per
new provider). 7+ built-in agents (code, plan, general, explore, scout, compaction, title,
summary) + user-defined. **Permission-controlled tool access** with wildcard pattern
matching and composable rulesets (`Permission.merge`). 48 built-in tools including
`apply_patch`, `lsp`, `recall` (memory), `repo_clone`, `warpgrep`, `diagnostics`. **Profile-
based sandboxing** (filesystem allow/deny, network allow/deny/proxy, environment deny/set —
Bubblewrap/Seatbelt backends). Memory system with `remember`/`forget`/`correct`/`recall`/
`catalog` operations, token budgeting, secret filtering. Skills with multi-location discovery

+ trust provenance. Git worktree isolation. MCP client with OAuth. Hono HTTP server with
OpenAPI + mDNS discovery. Tree-sitter indexing. Evidence: `kilocode/README.md`,
`kilocode/packages/`.

### 3.14 opencode-dev (TypeScript/Bun + Effect-TS)

Upstream of Kilo Code. **4-axis LLM route architecture** (`packages/llm/src/route/` —
Protocol, Endpoint, Auth, Framing). **Durable session runner** (loads history, resolves
model, streams one LLM turn, persists events incrementally, settles tools durably, loops).
**Session input delivery (Steer/Queue)** — `steer` promotes user input at next safe boundary
and resets step count; `queue` ensures ordered processing. **System Context Algebra**
(`Source<A>` with key/codec/load/renderers, composed into `Snapshot` to prevent context
drift). **Content-addressed snapshots** (deduplication, diff, preview restore, 7-day
retention). Session compaction with structured Markdown summary (Objective, Important
Details, Work State, Next Move, Relevant Files). Plugin system with 12+ hook surfaces
including `experimental.chat.system.transform`, `experimental.session.compacting`. Full MCP
client (stdio/SSE/HTTP, OAuth, browser flows). IAM-style policy engine. Skill discovery
from remote URLs with concurrent fetching. Filesystem watcher (@parcel/watcher, gitignore-
aware). Evidence: `opencode-dev/README.md`, `opencode-dev/packages/`.

### 3.15 OpenHands (Python + React/FastAPI)

Multi-backend coding agent platform. **Sandbox abstraction layer** — run agent work in
Docker, local process, remote VM, or cloud; flip between backends mid-session. **Agent-
Client Protocol (ACP)** — any agent implementing ACP can plug in as sub-agent or standalone
backend. **Trigger-based skill loading** — skills only injected when user messages match
keyword triggers; multi-source (public, repo-specific `.openhands/skills/`, org-level);
MCP tool declarations in skill frontmatter; self-improving `agent_memory` skill. **MCP
server + proxy** — namespace-mounts remote MCP services (e.g., Tavily under `tavily/`).
**EventCallbackProcessor** pattern for typed event-driven hooks (webhook, Slack, Jira,
GitHub). Multi-provider git (GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo). Sandbox-
scoped secrets with `ConversationSecretEnricher` extension point. Switchable LLM profiles
(up to 10 named). Task tracker UI. Enterprise integrations (Slack, Jira, GitHub, Linear).
Suggested-task generation (merge conflicts, failing CI, unresolved PR comments). Browser
automation. Workspace archive before sandbox teardown. Rate limiting (in-memory OSS + Redis
enterprise). Evidence: `OpenHands/README.md`, `OpenHands/openhands/app_server/`.

### 3.16 SWE-agent (Python)

Princeton research-oriented coding agent. **ACI design philosophy** — curated agent-
optimized tool surfaces (specialized file viewers, search commands, linting-gated editors)
rather than raw shell access. **YAML-driven configuration** with composable config merging.
**Tool bundle system** — each tool is a self-contained directory with `config.yaml`, `bin/`
executables, optional `install.sh`/`lib/`, `hidden_tools`, `state_command` for dynamic
state injection. **11 parser strategies** (FunctionCalling, ThoughtAction, XMLThoughtAction,
XMLFunctionCalling, Json, Action, ActionOnly, EditFormat, Identity, BashCodeBlock,
SingleBashCodeBlock). **History processor pipeline** (LastNObservations with polling-aware
caching, CacheControlHistoryProcessor for Anthropic prompt cache, ClosedWindowHistoryProcessor,
TagToolCallObservations, RemoveRegex, ImageParsingHistoryProcessor). Container sandboxing
via SWE-ReX (Docker/Modal/AWS). **Retry agent with review loop** (Reviewer LLM scores
solutions, Chooser with Preselector picks best). **Three-layer hook system** (Agent/Env/Run
with combined dispatch). Batch execution with thread-safe API key rotation. Multimodal
GitHub-issue image processing. Web-based trajectory inspector. Evidence: `SWE-agent/README.md`,
`SWE-agent/sweagent/`, `SWE-agent/tools/`.

---

## 4. Feature-Parity Gap Matrix

Legend: ✅ present · ❌ absent · 🟡 partial/limited. Cells include brief parenthetical
detail where the bare symbol would lose information. Each sub-table groups features by
category and includes only the reference repos most relevant to that category (a repo may
appear in multiple sub-tables — many repos contribute to multiple categories).

### 4.1 Extensibility Surface (MCP / Plugins / Skills)

savant-code has partial MCP + partial skills but no plugin SDK or marketplace. Most mature
repos have all three; savant-code is the only one of the 16 with no plugin boundary.

| Feature | savant-code | hermes | openclaude | openclaw | zero | codex | opencode | kilocode | goose | cline | AionUi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MCP client | 🟡 (loader only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (70+) | ✅ | ✅ (centralized) |
| MCP server | 🟡 (3 bundled) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Plugin / extension SDK | ❌ | ✅ | ✅ | ✅ (152) | ✅ | ✅ | ✅ (hooks) | ✅ | ✅ (dual) | ✅ (sandbox) | ✅ (manifest) |
| Skills system / marketplace | 🟡 (7 bundled) | ✅ (38) | ✅ | ✅ (51+ClawHub) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (3-tier) |
| Plugin sandbox | ❌ | 🟡 (approval) | ✅ | ✅ (Docker/SSH) | ✅ (OS) | ✅ (OS) | 🟡 (profile) | ✅ (profile) | — | ✅ (IPC) | — |

### 4.2 Provider & Model Routing

savant-code has ~8 prefixes via a single OpenAI-compatible class with a 2-branch
`getModelForRequest()` switch. References have 15-150+ providers with smart routing,
fallback, and model catalogs.

| Feature | savant-code | agno | aionui | goose | hermes | openclaude | openclaw | zero | opencode | kilocode | codex | cline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Provider count | 🟡 (~8) | ✅ (54) | ✅ (30+) | ✅ (15+) | ✅ (35) | ✅ (25+) | ✅ (150+) | ✅ (25+) | ✅ (4-axis) | ✅ (4-axis) | ✅ (25+) | ✅ (10+) |
| Smart routing / modes | 🟡 (prefix+OAuth) | — | — | — | ✅ | ✅ | ✅ (rotation) | ✅ (modes) | — | — | — | ✅ (model-tool) |
| 4-axis route arch | ❌ | — | — | — | — | — | — | — | ✅ | ✅ | — | — |
| Declarative providers (YAML) | ❌ | — | — | ✅ | — | — | — | — | — | — | — | — |
| Model catalog / fallback | ❌ | — | — | — | ✅ | ✅ | ✅ (failover) | ✅ (escalate) | — | — | — | — |
| Free-tier model catalog | ✅ (unique) | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 (web) | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.3 Safety, Sandbox & Policy

savant-code has no OS sandbox and only coarse `providerOptions` for routing (not policy).
Several references have OS-level sandboxing and structured policy engines; savant-code
has none.

| Feature | savant-code | codex | zero | openclaude | openclaw | hermes | kilocode | SWE-agent | goose |
|---|---|---|---|---|---|---|---|---|---|
| OS-level sandbox | ❌ | ✅ (SBPL/seccomp) | ✅ (landlock/seatbelt) | ✅ (@anthropic) | 🟡 (Docker/SSH) | 🟡 (Docker/Modal) | ✅ (profile) | ✅ (container) | — |
| Policy / permission engine | 🟡 (providerOptions) | ✅ (Starlark) | ✅ (dual-layer) | ✅ | ✅ (tool policy) | ✅ (approval) | ✅ (wildcard) | ✅ (blocklist) | ✅ (inspectors) |
| Secrets abstraction | ❌ | — | ✅ (keyring) | 🟡 (OAuth) | ✅ (SecretRef) | ✅ (cred pool) | ✅ (filter) | — | — |
| Redaction system | ❌ | — | ✅ | — | — | — | ✅ | — | — |

### 4.4 Orchestration, Memory & Context

savant-code has 9 fixed agents with `spawn_agents` and cache-debug only. References have
swarm/team orchestration, persistent memory, and sophisticated compaction.

| Feature | savant-code | hermes | openclaude | openclaw | zero | cline | aionui | codex | opencode | agno |
|---|---|---|---|---|---|---|---|---|---|---|
| Multi-agent orchestration | ✅ (9 roles) | ✅ (Kanban) | ✅ (coordinator) | ✅ (fleet/swarm) | ✅ (swarm) | ✅ (teams) | ✅ (team mode) | ✅ (roles) | 🟡 (dual-agent) | ✅ (4 modes) |
| Dynamic sub-agent spawning | 🟡 (spawn_agents) | ✅ (delegate) | ✅ (AgentTool) | ✅ (swarm) | ✅ (specialists) | ✅ (teams) | ✅ (ACP) | ✅ (SpawnReservation) | ✅ (task) | ✅ (team) |
| Persistent memory | ❌ | ✅ (8 backends) | ✅ (memdir+auto-dream) | ✅ (dreaming) | — | — | — | ✅ (two-phase) | ✅ (algebra) | ✅ (strategy) |
| Context compaction | 🟡 (cache-debug) | ✅ (compressor) | ✅ (collapse+compact) | ✅ (staged) | ✅ (proactive+reactive) | — | — | ✅ (multi-strategy) | ✅ (structured) | ✅ (CompressionManager) |
| Session fork/rewind | ❌ | — | ✅ | ✅ | ✅ (event log) | ✅ (git checkpoints) | — | ✅ (thread fork) | ✅ (snapshot revert) | ✅ (session fork) |
| Structured summary template | ❌ | ✅ (Resolved/Pending) | ✅ | ✅ (identifier preserve) | ✅ (proactive) | — | — | ✅ (history tracking) | ✅ (Objective/State/Next/Files) | — |

### 4.5 UX Surfaces (Web / Desktop / Mobile / Channels / Media)

savant-code is CLI/TUI/SDK only. This is the largest surface gap — many references are
full multi-platform products.

| Feature | savant-code | hermes | openclaude | openclaw | aionui | goose | zero | openhands |
|---|---|---|---|---|---|---|---|---|
| CLI / TUI | ✅ | ✅ | ✅ | ✅ (TUI) | — | ✅ (Rust+Ink) | ✅ | — |
| Web UI / dashboard | ❌ | ✅ (FastAPI) | 🟡 (docs/headless) | ✅ (Lit) | ✅ (web-host) | — | ❌ | ✅ (React) |
| Desktop app | ❌ | ✅ (Electron) | 🟡 (VS Code ext) | ✅ (multi-OS) | ✅ (Electron+Rust) | ✅ (Electron) | ❌ | — |
| Mobile app | ❌ | 🟡 (Termux) | 🟡 (Termux) | ✅ (iOS/Android) | ✅ (Expo) | — | ❌ | — |
| Messaging channels | ❌ | ✅ (~30) | 🟡 (Slack/GitHub) | ✅ (40+) | ✅ (7) | — | 🟡 (Slack/PR) | ✅ (enterprise) |
| Media generation (img/video/music) | ❌ | ✅ | ❌ | ✅ | 🟡 (image) | — | ❌ | — |
| TTS / voice / meetings | ❌ | ✅ | ✅ (voice) | ✅ | — | — | 🟡 (dictation) | — |
| Browser automation | 🟡 (browser-use) | ✅ | ✅ | ✅ (Canvas) | — | — | — | ✅ (14 tools) |

### 4.6 Automation, Eval & Intelligence

savant-code has Buffbench only. References have rich eval harnesses, cron, LSP, repo
maps, and hook systems.

| Feature | savant-code | aider | cline | gemini-cli | openhands | zero | openclaude | goose | SWE-agent | codex |
|---|---|---|---|---|---|---|---|---|---|---|
| Eval / benchmark harness | 🟡 (Buffbench) | ✅ (Polyglot+SWE-bench) | ✅ (3-layer pyramid) | ✅ (dynamic baseline) | 🟡 (qa scenarios) | ✅ (agenteval/perfbench) | 🟡 (model rec) | — | ✅ (batch) | — |
| Cron / scheduling | ❌ | — | ✅ (markdown specs) | — | — | ✅ (recipes) | ✅ (in-mem+durable) | ✅ (agent sessions) | — | — |
| LSP integration | 🟡 (tree-sitter code-map) | — | — | — | — | ✅ (background async) | ✅ | — | — | — |
| Repo map (PageRank) | ❌ | ✅ | — | — | — | 🟡 (deterministic) | ✅ | ✅ (tree-sitter) | — | — |
| Hook system | ❌ | — | ✅ (7 events) | ✅ (10 events, BeforeModel) | ✅ (EventCallback) | ✅ (6 events) | — | ✅ (11 events) | ✅ (3-layer) | ✅ (11 events) |
| Process-level eval assertions | ❌ | — | ✅ (pass@k) | ✅ (baseline filter) | — | ✅ (requiredTraceEvents) | — | — | ✅ (review loop) | — |
| Tool search / deferred loading | ❌ | — | — | — | ✅ (trigger skills) | ✅ (state-dependent) | ✅ (ToolSearchTool) | — | — | — |

### 4.7 Governance & Differentiators (savant-code's Lead)

savant-code's unique strengths — none of the references match these.

| Feature | savant-code | hermes | openclaude | openclaw | zero | codex |
|---|---|---|---|---|---|---|
| FID-bound Perfection Loop | ✅ (unique) | ❌ | ❌ | ❌ | ❌ | ❌ |
| 9-role separation of duties | ✅ (unique) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Governance audit trail (FID lifecycle) | ✅ (unique) | 🟡 (logs) | 🟡 | ✅ (audit log) | 🟡 (trace) | 🟡 (graph store) |
| ECHO Protocol bootstrap | ✅ (unique) | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.8 Coverage Matrix (16-repo ✅/❌/🟡 at a glance)

Compact view of every reference repo × every category. Each cell shows savant-code's
status only (the row headers); for per-repo detail, see the sub-tables above.

| Repo | Extensibility | Providers | Safety | Orchestration | UX surfaces | Eval/Automation |
|---|---|---|---|---|---|---|
| **savant-code** | 🟡 (MCP+skills partial, no plugin) | 🟡 (~8, 2-branch) | ❌ (no OS sandbox) | ✅ (9 roles) / 🟡 (spawn only) | ❌ (CLI/TUI only) | 🟡 (Buffbench only) |
| agno | ✅ (MCP+AgentOS) | ✅ (54) | 🟡 (guardrails) | ✅ (4 team modes) | 🟡 (AgentOS HTTP) | ✅ (eval suite) |
| aider | ❌ | 🟡 (litellm) | 🟡 (reflection) | 🟡 (architect/editor) | ❌ (terminal) | ✅ (Polyglot+SWE-bench) |
| AionUi | ✅ (manifest SDK) | ✅ (30+) | 🟡 (approval store) | ✅ (team mode) | ✅ (desktop+mobile+web) | 🟡 (e2e teams) |
| cline | ✅ (sandbox plugins) | ✅ (10+) | ✅ (loop detection) | ✅ (teams runtime) | 🟡 (CLI+VS Code) | ✅ (3-layer pyramid) |
| codex | ✅ (marketplace) | ✅ (25+) | ✅ (SBPL/seccomp+Starlark) | ✅ (role registry) | 🟡 (TUI) | ✅ (rollout budgets) |
| gemini-cli | ✅ (extensions) | ✅ (composite routing) | 🟡 (confirmation bus) | ✅ (subagent+a2a) | 🟡 (CLI+VS Code) | ✅ (dynamic baseline) |
| goose | ✅ (70+ MCP) | ✅ (15+, YAML) | ✅ (inspectors) | ✅ (delegate/summon) | ✅ (TUI+Electron) | ✅ (recipes+cron) |
| gpt-pilot | ❌ | 🟡 (multiple) | 🟡 (curated ACI) | 🟡 (step-based) | ❌ (terminal) | 🟡 (TDD) |
| hermes-agent | ✅ (plugin SDK) | ✅ (35) | ✅ (approval+Tirith) | ✅ (Kanban+MOA) | ✅ (TUI+Web+Desktop+Mobile) | ✅ (trajectory) |
| kilocode | ✅ (permissions) | ✅ (4-axis) | ✅ (profile sandbox) | ✅ (task spawning) | 🟡 (CLI) | 🟡 (memory) |
| openclaude | ✅ (registry) | ✅ (25+) | ✅ (@anthropic sandbox) | ✅ (coordinator+teams) | ✅ (VS Code+voice+mobile) | ✅ (model rec) |
| openclaw | ✅ (152 ext+SDK) | ✅ (150+) | ✅ (tool policy) | ✅ (fleet+swarm) | ✅ (multi-OS+web+channels) | 🟡 (qa scenarios) |
| opencode-dev | ✅ (hooks+snapshots) | ✅ (4-axis) | ✅ (IAM policy) | 🟡 (dual-agent) | 🟡 (CLI) | 🟡 (snapshots) |
| OpenHands | ✅ (ACP+MCP proxy) | 🟡 (LiteLLM) | ✅ (sandbox abstraction) | ✅ (ACP) | ✅ (React web) | 🟡 (qa scenarios) |
| SWE-agent | ❌ | 🟡 (multi) | ✅ (container) | 🟡 (retry agent) | ❌ (terminal+web inspector) | ✅ (batch+review) |
| zero | ✅ (plugin.json) | ✅ (25+) | ✅ (landlock/seatbelt) | ✅ (swarm) | 🟡 (TUI+GitHub Action) | ✅ (agenteval+perfbench) |

---

## 5. Detailed Gap Analysis (by category)

Each item states the reference evidence (across all 16 repos) and what savant-code would
need. Evidence is grouped by category; not every repo is cited in every category — only
where the repo offers a distinct, adoptable pattern.

### 5.1 Extensibility surface (MCP + Plugins + Skills) — **highest priority**

- **Gap (corrected 2026-07-20):** savant-code has **partial** MCP and skills surfaces,
  but **no plugin SDK and no skills marketplace**:
  - **MCP client (partial):** `packages/agent-runtime/src/mcp.ts` is a per-server
    failure-isolated tool loader; `sdk/src/agents/load-mcp-config.ts` merges project +
    user + env-var config sources. **Missing:** dedicated `packages/mcp/` workspace,
    OAuth, InProcessTransport, MCP proxy/namespace-mounting.
  - **MCP server (partial):** 3 bundled servers in `research/servers-main/`
    (sequentialthinking, memory, filesystem) using `@modelcontextprotocol/sdk/server/mcp.js`.
    **Missing:** public server SDK, contribution API, plugin-contributed servers.
  - **Skills (partial):** `packages/agent-runtime/src/tools/handlers/tool/skill.ts`
    loads skills from 4 directories (`~/.agents/skills/`, `~/.claude/skills/`,
    project `.agents/skills/`, `.claude/skills/`) with frontmatter validation.
    7 bundled skills in `.agents/skills/` (coding-csharp, coding-go, coding-java,
    coding-python, coding-rust, coding-typescript, release-workflow).
    **Missing:** marketplace/registry, remote skill discovery, plugin SDK, manifest
    schema, sandbox.
- **Reference evidence (16-repo coverage):**
  - **MCP client:** hermes `tools/mcp_tool.py`; openclaude `src/services/mcp/` (stdio/SSE/HTTP/WS + InProcessTransport + OAuth); openclaw `src/mcp/`; zero `internal/mcp/`; codex `codex-rs/codex-mcp/` + `codex-rs/mcp-server/`; opencode-dev + kilocode `packages/opencode/src/mcp/`; goose `crates/goose-mcp/src/` (70+ servers, OSV malware check); cline `sdk/packages/core/src/extensions/mcp/`; AionUi "centralized MCP, configure once sync to all"; agno `tools/mcp/multi_mcp.py` (multi-merge); OpenHands `mcp_router.py` (server + namespace-proxy).
  - **Plugin SDK:** hermes `PluginManager` (4-source discovery); openclaude `builtinPlugins.ts`; openclaw `packages/plugin-sdk/` + `check-plugin-sdk-boundary.mjs` (152 ext); zero `plugin.json` (tools/hooks/skills); codex `codex-rs/plugin/` (marketplace); cline `extensions/plugin/` (SubprocessSandbox with auto-reinit); AionUi `aion-extension.json` (7 contribution points); goose dual-format with 24h auto-update.
  - **Skills/marketplace:** hermes 38 categories; openclaude 17+ bundled; openclaw 51 + ClawHub registry; zero `SKILL.md` packs; codex Markdown skills with scope (User/Repo/System/Admin); kilocode multi-location + trust provenance; OpenHands trigger-based loading (only inject when keyword matches).
- **savant impact:** The partial surfaces exist but are scattered across `agent-runtime/`,
  `sdk/`, and `research/` with no unified plugin boundary. Recommend consolidating MCP
  primitives into a `packages/mcp/` workspace + adding OAuth/InProcessTransport; building
  an `extensions/` plugin loader with manifest schema modeled on openclaw's
  plugin-sdk boundary checks (`check-plugin-sdk-boundary.mjs`); and adding a skills
  registry/marketplace modeled on ClawHub, with trigger-based loading modeled on OpenHands.

### 5.2 Provider breadth & routing

- **Gap:** savant-code supports ~8 model prefixes through a **single OpenAI-compatible
  class** with two hard-coded routes (ChatGPT-OAuth, SavantCode/OpenRouter). No per-provider
  adapter, no smart routing, no model catalog, no fallback/failover, no cost-based routing.
- **Reference evidence (16-repo coverage):**
  - **Provider count:** agno 54 providers (`models/`); openclaw 150+ extensions; hermes 35 plugins; openclaude ~50 (25 vendors + 25 gateways); zero 25+; cline 10+; AionUi 30+ (incl. Chinese: Zhipu, Moonshot, Qianfan, Hunyuan); goose 15+; codex 25+.
  - **4-axis route architecture:** opencode-dev + kilocode (`packages/llm/src/route/` — Protocol, Endpoint, Auth, Framing). 5-15 lines per new provider. DeepSeek/TogetherAI/Cerebras all reuse `OpenAIChat.protocol`.
  - **Smart routing:** openclaude `smartModelRouting.ts` + `agentRouting.ts` (complexity classifier); zero modes (smart/deep/fast) + escalate; gemini-cli CompositeStrategy (Fallback→Override→ApprovalMode→GemmaClassifier→...); cline model-tool routing (OpenAI gets `apply_patch`).
  - **Model catalog + fallback:** openclaw `model-catalog/`, `model-fallback.ts`, `failover-policy.ts`, `live-model-switch.ts`, auth profile rotation with cooldown/expiry/round-robin.
  - **Declarative providers:** goose YAML-based custom providers (no code for new providers).
- **savant impact:** Extend `getModelForRequest()` (currently a 2-branch switch in
  `sdk/src/impl/model-provider.ts`) into a 4-axis provider registry + routing layer
  (modeled on opencode-dev/kilocode). The `ALLOWED_MODEL_PREFIXES` in `model-config.ts`
  is the natural extension point. Add a `model-catalog` + fallback policy modeled on openclaw.
  (This aligns with the multi-provider end-state flagged in archived `FID-2026-0714-006`.)

### 5.3 Scheduling / cron

- **Gap:** savant-code has **no scheduler**. Agents run only on interactive CLI invocation.
- **Reference evidence (16-repo coverage):**
  - hermes `cron/scheduler.py` (5-field cron, ISO timestamps, per-job skills/models, multi-platform delivery).
  - openclaude `ScheduleCronTool/` (in-memory + durable `.openclaude/scheduled_tasks.json`, max 50 jobs).
  - openclaw `src/cron/` (declarative jobs, delivery channels, retry policies, heartbeat, pacing).
  - zero `internal/cron/` (recipes: git-recap, ci-watch, todo-pulse, daily-summary; DST-aware).
  - goose `crates/goose/src/scheduler.rs` — **runs full agent sessions** (not just shell) with provider/extension context.
  - cline `sdk/packages/core/src/cron/` (markdown spec files `.cline/cron/*.md` with YAML frontmatter; SQLite-backed).
  - AionUi conversation-bound or new-conversation mode with keep-awake + missed-trigger detection.
- **savant impact:** Add a `cron/` workspace + `/cron` slash command + a daemon tick loop.
  Best pattern for savant-code: cline's markdown specs (developer-friendly, version-
  controllable) + zero's recipe presets. Must respect ECHO governance (FID for scheduled
  runs, audit trail).

### 5.4 OS-level sandbox & permission engine

- **Gap:** savant-code has **no OS sandbox** and only coarse per-agent `providerOptions`
  (model routing), not command/network/filesystem policy.
- **Reference evidence (16-repo coverage):**
  - **OS-level sandbox:** zero `internal/sandbox/` (Linux landlock+seccomp, macOS seatbelt, Windows ACL/unelevated); codex `codex-rs/sandboxing/` (macOS SBPL profiles, Linux seccomp/Landlock/bwrap, Windows restricted token); openclaude `@anthropic-ai/sandbox-runtime` + `shouldUseSandbox.ts`; kilocode `packages/kilo-sandbox/` (profile-based: filesystem/network/environment, Bubblewrap/Seatbelt backends); SWE-agent SWE-ReX (Docker/Modal/AWS, agent never runs on host); OpenHands sandbox abstraction (Docker/local/remote/VM/cloud, flip between backends mid-session).
  - **Policy/permission engine:** codex Starlark rules (`codex-rs/execpolicy/`, self-validating, prefix matching, host exe resolution); zero dual-layer (tool metadata + sandbox, structured `Block` codes like `symlink_traversal`); openclaude wildcard; opencode-dev IAM-style policy; kilocode `Wildcard.match` with `ask/allow/deny` + `Permission.merge`; gemini-cli multi-dimensional matching (tool/args regex/MCP server/annotations); SWE-agent command blocklist (prefix/exact/regex); goose tool inspector pipeline (permission→security→adversary→egress→repetition); openclaw layered tool policy pipeline.
  - **Approval/HITL:** hermes `tools/approval.py` (per-session queue, subagent callbacks); agno `@approval` decorator (required/audit modes); OpenHands ConversationSecretEnricher extension point.
- **savant impact:** High-value for a coding agent that runs arbitrary shell. Adopt
  zero's dual-layer model (tool metadata + sandbox with structured `Block` codes) for
  actionable denial reasons, plus cline's SubprocessSandbox pattern for plugin isolation.
  Add a sandbox boundary + a permission/approval gate (destructive-command denylist)
  before shipping autonomous shell execution.

### 5.5 Messaging channels / integrations

- **Gap:** savant-code is **CLI/TUI/SDK only** — no Slack/Discord/Telegram/WhatsApp/etc.
- **Reference evidence (16-repo coverage):**
  - openclaw `extensions/` (40+ channels — WhatsApp, Telegram, Slack, Discord, Signal, iMessage, IRC, Teams, Matrix, Feishu, LINE, WeChat, QQ, etc.).
  - hermes `gateway/platforms/` + `plugins/platforms/` (~30 platform adapters).
  - AionUi 7 connectors (Telegram, Lark/Feishu, DingTalk, WeChat, WeCom, Slack, Discord).
  - cline 6 platform connectors (Telegram, Slack webhook+socket, Discord, Google Chat, WhatsApp, Linear).
  - zero `internal/notify/` (Slack + GitHub PR + GitHub Action composite).
  - openclaude Slack + GitHub app.
  - OpenHands enterprise integrations (Slack, Jira, GitHub, Linear, Bitbucket, Azure DevOps).
- **savant impact:** Best delivered *via* the MCP/plugin surface (5.1), not core. A
  `channels/` extension category modeled on openclaw's `src/channels/` is the parity target.

### 5.6 UI surfaces (Web / Desktop / Mobile)

- **Gap:** savant-code has CLI (OpenTUI+React) + embeddable SDK only. No web dashboard, no
  desktop app, no mobile.
- **Reference evidence (16-repo coverage):**
  - hermes: FastAPI Web (20 pages) + Electron + Tauri + Termux.
  - openclaude: VS Code extension + headless gRPC server (1000 concurrent sessions) + Termux.
  - openclaw: Lit Web UI + macOS/iOS/Android/Linux/Windows native apps (`swabble`).
  - AionUi: Electron + React 19 + Rust (AionCore) desktop + React Native/Expo mobile.
  - goose: Rust + Electron/TS UI + Ink/React TUI.
  - OpenHands: React/FastAPI web frontend with subagent visualization.
  - codex: ratatui TUI.
  - gemini-cli: React/Ink CLI + VS Code companion + devtools.
  - zero: terminal-only (no web/mobile/desktop).
- **savant impact:** Lowest priority for a *coding* agent; highest for a *personal-agent*
  play. If parity with openclaw/hermes is the goal, a web dashboard + Electron/Tauri shell
  wraps the existing SDK. For coding-agent parity, the VS Code extension pattern (openclaude,
  gemini-cli) is the highest-leverage minimum.

### 5.7 Media generation & voice

- **Gap:** savant-code has **no** image/video/music generation, **no** TTS, **no** meeting bots.
- **Reference evidence (16-repo coverage):**
  - openclaw `src/image-generation/`, `video-generation/`, `music-generation/`, `tts/`, `meeting-bot/`, `talk/` (wake words, realtime sessions via ElevenLabs).
  - hermes `tools/image_generation_tool.py`, `video_generation_tool.py`, `tts_tool.py`.
  - openclaude voice mode + Vim mode.
  - zero `internal/dictation/` (Deepgram cloud + Whisper local + OpenAI Realtime).
  - AionUi image generation with JSON repair for malformed responses.
  - codex realtime voice (WebRTC/WebSocket conversations).
- **savant impact:** Deliver through plugins/providers (5.1, 5.2). Not core to coding parity.

### 5.8 Persistent memory & context compaction

- **Gap:** savant-code has DB + cache-debug but **no** cross-session persistent memory and
  **no** autonomous context compaction (only manual prompt-cache awareness).
- **Reference evidence (16-repo coverage):**
  - **Persistent memory:** openclaude `src/memdir/` + `autoDream/` (background subagent consolidates transcripts, 24h time gate, 5+ session gate, consolidation lock); openclaw `extensions/memory-core/src/dreaming.ts` (light + REM dreaming); codex two-phase pipeline (`codex-rs/memories/` — Phase 1 parallel extraction, Phase 2 git-baseline diff consolidation, DB-backed job claiming); opencode-dev System Context Algebra (`Source<A>` with key/codec/load/renderers composed into `Snapshot`); hermes 8 pluggable backends (Honcho, Mem0, Supermemory, ByteRover, Hindsight, Holographic, OpenViking, RetainDB); kilocode memory with `remember`/`forget`/`correct`/`recall`/`catalog` + secret filtering; agno strategy-based memory with 24 vector DB backends; OpenHands self-improving `agent_memory` skill.
  - **Context compaction:** zero `internal/agent/compaction.go` (proactive at ~70% + reactive after context-limit error, per-provider calibration, turn-boundary preservation); opencode-dev structured Markdown summary (Objective, Important Details, Work State, Next Move, Relevant Files); openclaw staged summarization with identifier preservation (UUIDs, hashes, URLs not summarized away); openclaude context collapse + auto/micro/snippet compaction; gemini-cli graph-based context (typed nodes, processor pipeline: blobDegradation, historyTruncation, nodeDistillation, rollingSummary); codex multi-strategy with replacement history; hermes context compressor (Resolved/Pending question tracking); aider recursive split-then-summarize; SWE-agent history processor pipeline (LastNObservations, CacheControlHistoryProcessor, ClosedWindowHistoryProcessor).
  - **Prompt cache warming:** aider background thread (periodic pings keep Anthropic caches alive).
- **savant impact:** Adopt a two-phase memory pipeline (codex pattern: parallel extraction
  → git-baseline consolidation) with dreaming (openclaw light/REM) as the consolidation
  scheduler, plus a structured summary template (opencode-dev) + identifier preservation
  (openclaw). Add auto-compaction in the agent runtime modeled on zero's proactive+reactive
  dual-path. Improves long-task quality.

### 5.9 Evaluation / benchmark harness

- **Gap:** savant-code has **Buffbench** (`evals/`) but no agentic eval suite (expected/forbidden
  file diffs, verification commands, trace scoring).
- **Reference evidence (16-repo coverage):**
  - zero `internal/agenteval/` + `internal/perfbench/` (richest — fixtures with expected changed files, forbidden files, verification commands, **requiredTraceEvents**, manifest-based test suites with model matrix).
  - gemini-cli behavioral evals with **dynamic baselines** (nightly 3x per model, fails-on-main marked "Pre-existing", trustworthiness filter 60%+ per night, automated promotion USUALLY→ALWAYS).
  - cline 3-layer pyramid (contract → smoke with pass@k → E2E Harbor/SWE-bench).
  - aider Polyglot Exercism + SWE-bench with Docker isolation.
  - SWE-agent batch execution with retry agent + review loop (Reviewer LLM scores, Chooser with Preselector picks best).
  - hermes `mini_swe_runner.py` + `batch_runner.py` + trajectory compression.
  - openclaw `qa/scenarios/` with maturity scoring.
- **savant impact:** Extend `evals/` into a zero-style harness (prompt + expected diff +
  verify command + required trace events). Add gemini-cli's dynamic baseline verification
  to avoid false-failing on pre-existing main breakage. Directly supports ECHO's "verify
  before proceed" — process-level assertions are a natural fit for the Perfection Loop's
  AUDIT phase.

### 5.10 Secrets & policy management

- **Gap:** savant-code holds keys in env/backend; **no** SecretRef abstraction, no policy engine,
  no keyring.
- **Reference evidence (16-repo coverage):**
  - openclaw `src/secrets/` (SecretRef) + `extensions/policy`.
  - zero `internal/credstore/` + `internal/keyring/` + `internal/redaction/` (secret scrubbing at every output boundary).
  - hermes `agent/secret_scope.py` + credential pool with failover/borrowing.
  - kilocode memory with secret filtering (prevents accidental credential leakage in extracted memories).
  - OpenHands sandbox-scoped secrets + `ConversationSecretEnricher` extension point.
  - codex encrypted credential store with singleflight refresh.
- **savant impact:** Add a secrets abstraction (SecretRef-style) + a policy overlay +
  a redaction system at output boundaries. Required before multi-tenant/fleet use and
  before any autonomous shell execution.

### 5.11 Hooks, LSP, and code intelligence (added 2026-07-20)

- **Gap:** savant-code has no hook system (no `beforeModel`/`afterTool`/etc.), no LSP
  integration (only tree-sitter `code-map`), and no PageRank repo map.
- **Reference evidence (16-repo coverage):**
  - **Hooks:** codex 11 events (`codex-rs/hooks/`); gemini-cli 10 events incl. **BeforeModel synthetic responses** (bypass model call entirely — enables caching/testing/safety interception); goose 11 events (regex-matched, `Stop` can block); cline 7 callbacks (`beforeModel` can inject messages + modify tools per-request); SWE-agent 3-layer (Agent/Env/Run with combined dispatch); zero 6 events (stdin-JSON payload, audit trail); opencode-dev 12+ hook surfaces incl. `experimental.chat.system.transform`, `experimental.session.compacting`.
  - **LSP:** zero `internal/lsp/` (background async diagnostics — non-blocking file checking); openclaude `src/tools/LSPTool/` (symbols, diagnostics, formatting); opencode-dev `packages/opencode/src/lsp/` (diagnostics, symbol lookup, document symbols, status tracking); kilocode 48 built-in tools incl. `lsp` + `diagnostics`.
  - **Repo map (PageRank):** aider `repomap.py` (PageRank + tree-sitter, 10x snake_case weight, 0.1x private identifier weight, token-budgeted); openclaude `src/context/repoMap/` (PageRank + tree-sitter with file-stat fingerprinting cache); zero `internal/repomap/` (deterministic, 4 KiB cap); goose `crates/goose/src/agents/platform_extensions/analyze` (tree-sitter).
- **savant impact:** Add a hook registry (at minimum `beforeModel`/`afterTool`/`onEvent`)
  with BeforeModel synthetic responses (gemini-cli pattern) for cache/test/safety
  interception. Add background async LSP diagnostics (zero pattern) for non-blocking
  post-edit verification — directly improves the AUDIT phase. Extend `packages/code-map/`
  with PageRank (aider pattern) for principled codebase navigation.

---

## 6. Prioritized Roadmap to Parity

Phased so each phase unlocks the next (extensibility first — it is the force-multiplier).

### Phase 0 — Extensibility foundation (unblocks everything else)

1. **MCP consolidation** — promote existing `packages/agent-runtime/src/mcp.ts` +
   `sdk/src/agents/load-mcp-config.ts` + `research/servers-main/` (3 bundled servers)
   into a `packages/mcp/` workspace; add OAuth + InProcessTransport + MCP proxy.
   Not a from-scratch build. (zero `internal/mcp/client.go` is the cleanest reference
   for the OAuth/transport gaps; openclaude `src/services/mcp/` for TS patterns.)
2. **Plugin loader + plugin-sdk boundary** (`extensions/` dir + manifest schema) modeled on
   openclaw `src/plugin-sdk/` + `check-plugin-sdk-boundary.mjs`. savant-code has no plugin
   SDK today (only a skills loader).
3. **Skills marketplace** — savant-code already has a runtime skill loader
   (`packages/agent-runtime/src/tools/handlers/tool/skill.ts`) and 7 bundled skills
   (`.agents/skills/`); gap is a registry/marketplace (ClawHub-style) + remote skill
   discovery (openclaude `src/skills/`, opencode `skill/discovery.ts`).

### Phase 1 — Provider & routing parity

4. Promote `getModelForRequest()` from a 2-branch switch to a **4-axis route architecture**
   (Protocol/Endpoint/Auth/Framing) modeled on opencode-dev + kilocode
   (`packages/llm/src/route/`). 5-15 lines per new provider.
5. Add **model catalog + fallback/failover + live model switch** (openclaw `model-fallback.ts`,
   `live-model-switch.ts`, auth profile rotation with cooldown).
6. Add **smart routing / modes** (zero `internal/modelregistry/modes.go` smart/deep/fast;
   openclaude `smartModelRouting.ts` complexity classifier; gemini-cli CompositeStrategy with
   local Gemma classifier for cheap routing).
7. Add **declarative YAML providers** (goose pattern) for no-code provider additions.

### Phase 2 — Safety & autonomy

8. **OS/command sandbox** — adopt zero's dual-layer model (tool metadata + sandbox with
   structured `Block` codes: `symlink_traversal`, `destructive_command`, `outside_workspace`)
   plus codex's cross-platform sandbox (SBPL/seccomp/seatbelt).
9. **Permission/approval gate** — codex Starlark rules (self-validating, prefix matching) or
   kilocode `Wildcard.match` with `ask/allow/deny` + `Permission.merge`.
10. **Plugin sandbox** — cline `SubprocessSandbox` (IPC isolation, auto-reinit on crash)
    for third-party plugin execution.
11. **Secrets abstraction + redaction** — openclaw SecretRef + zero redaction at every output
    boundary + keyring (`internal/credstore/`, `internal/keyring/`).

### Phase 3 — Automation, memory & intelligence

12. **Cron/scheduler + daemon** — cline markdown specs (`.cline/cron/*.md` with YAML
    frontmatter) + zero recipe presets + goose agent-session cron (full provider context).
13. **Persistent memory** — codex two-phase pipeline (parallel extraction → git-baseline
    consolidation) + openclaw dreaming (light + REM) + openclaude auto-dream gating
    (24h time gate, 5+ session gate, lock).
14. **Context compaction** — zero proactive+reactive dual-path with per-provider calibration +
    opencode-dev structured Markdown summary (Objective/Work State/Next Move/Relevant Files) +
    openclaw identifier preservation (UUIDs, hashes, URLs).
15. **Hook system** — gemini-cli BeforeModel synthetic responses (bypass model call entirely)
    + codex 11-event lifecycle + cline `beforeModel` message/tool injection.
16. **Agentic eval harness** extending `evals/` — zero `agenteval` (requiredTraceEvents,
    forbiddenChangedFiles) + gemini-cli dynamic baselines (fails-on-main → "Pre-existing") +
    cline 3-layer pyramid (contract → smoke pass@k → E2E).
17. **LSP integration** — zero background async diagnostics (non-blocking) + openclaude
    symbol lookup / formatting.
18. **Repo map** — extend `packages/code-map/` with PageRank (aider pattern: 10x snake_case
    weight, 0.1x private identifier weight, token-budgeted) + openclaude file-stat fingerprinting cache.

### Phase 4 — Surface expansion (only if personal-agent parity is the goal)

19. **Channels** via plugin category (openclaw `src/channels/` 40+; hermes `gateway/platforms/` ~30).
20. **Web dashboard + Desktop/Mobile shells** wrapping the SDK (hermes FastAPI+Electron+Tauri;
    openclaw Lit Web UI + multi-OS apps; AionUi Electron+Rust+Expo).
21. **Media-gen / voice / meetings** via provider+plugin surface (openclaw image/video/music/TTS;
    hermes tools; zero dictation; codex realtime voice).
22. **VS Code extension** (openclaude, gemini-cli pattern) — highest-leverage minimum for
    coding-agent surface expansion.

---

## 7. savant-code's Differentiators (what the references LACK)

Honest parity is two-way. Across all 16 reference repos, savant-code leads on:

- **Governance:** ECHO Protocol FID-bound Perfection Loop + 9-role separation of duties
  (`ECHO.md`, `AGENTS.md`). References have audit logs / traces (openclaw audit log,
  zero trace, codex agent graph store) but **none** enforce RED→GREEN→AUDIT→COMPLETE
  gating. This is savant-code's most defensible differentiator.
- **Free-tier model catalog:** `common/src/constants/savant-free-models.ts` (MiniMax M3,
  DeepSeek V4, MiMo, Kimi, GLM, HY3) with premium/limited tiers, streaks, referrals.
  **None of the 16 references** ships a comparable free-mode catalog (openclaw has a
  partial "web free" tier, but not a free-mode model catalog).
- **Disciplined small roster:** 9 fixed, well-scoped agents (Orchestrator, Detective, Forge,
  Verifier, Recorder, Thinker, Scout, Researcher, Scribe) vs. open-ended dynamic spawning
  (agno 4 team modes, zero swarm, cline AgentTeamsRuntime, hermes Kanban). Trades
  flexibility for reviewability and determinism.
- **ChatGPT-OAuth direct route** with Responses-API ↔ Chat-Completions transform
  (`chatgpt-backend-fetch.ts`) is a novel, self-contained integration pattern — no other
  repo has an equivalent direct OAuth route to ChatGPT's Codex endpoint.

These should be **preserved** during parity work — the roadmap adds breadth without removing
the governance spine.

---

## 8. Evidence Index

**savant-code (direct reads, 2026-07-20 re-verification):**

- `packages/llm-providers/src/openai-compatible/` — provider abstraction
- `sdk/src/impl/model-provider.ts` — `getModelForRequest()` 2-branch routing (verified lines 133-181)
- `sdk/src/impl/openrouter-key-resolver.ts`, `sdk/src/env.ts` — key/env resolution
- `sdk/src/impl/llm.ts` — streaming, cost accounting, cache-debug
- `sdk/src/impl/chatgpt-backend-fetch.ts` — OAuth Responses-API transform
- `common/src/constants/model-config.ts` — model registry + `ALLOWED_MODEL_PREFIXES` (8 prefixes verified)
- `common/src/constants/savant-free-models.ts` — free-tier model catalog
- `packages/agent-runtime/src/mcp.ts` — MCP client tool loader (verified 80 lines)
- `packages/agent-runtime/src/tools/handlers/tool/skill.ts` — skills loader (verified 135 lines, 4-directory search)
- `sdk/src/agents/load-mcp-config.ts` — multi-source MCP config merger
- `research/servers-main/src/{sequentialthinking,memory,filesystem}/index.ts` — 3 bundled MCP servers
- `.agents/skills/` — 7 bundled skills (coding-csharp/go/java/python/rust/typescript, release-workflow)
- `agents/*.ts`, `packages/agent-runtime/src/prompt-agent-stream.ts`, `spawn-agent-utils.ts` — agent roster + spawning
- `ECHO.md`, `AGENTS.md` — governance

**Reference repos (independent Explore-agent inventories, 2026-07-19; 16-repo full coverage):**

- `resources/agno/` — `README.md`, `agent/`, `models/` (54 providers), `tools/mcp/`, `tools/multi_mcp.py`, `os/app.py` (AgentOS), `workflow/`, `memory/`, `knowledge/`, `eval/`, `scheduler/`
- `resources/aider/` — `README.md`, `coders/` (13 edit formats), `repomap.py` (PageRank), `history.py`, `linter.py`, `watch.py`, `benchmark/`, `resources/model-settings.yml` (100+ configs)
- `resources/AionUi/` — `README.md`, `packages/desktop/` (Electron+Rust+React 19), `examples/` (extension SDK), `packages/web-host/`, `mobile/` (Expo), `tests/e2e/cases/teams/`
- `resources/cline/` — `README.md`, `sdk/packages/` (shared→llms→agents→core→apps), `extensions/tools/presets.ts`, `extensions/plugin/`, `extensions/mcp/`, `extensions/tools/team/`, `cron/`, `apps/cli/src/connectors/` (6 platforms), `evals/` (3-layer pyramid)
- `resources/codex/` — `README.md`, `codex-rs/sandboxing/` (SBPL/seccomp), `codex-rs/execpolicy/` (Starlark), `codex-rs/hooks/` (11 events), `codex-rs/core/src/compact.rs`, `codex-rs/thread_manager.rs`, `codex-rs/agent/`, `codex-rs/memories/`, `codex-rs/codex-mcp/`, `codex-rs/plugin/`, `codex-rs/app-server/`
- `resources/gemini-cli/` — `README.md`, `packages/core/src/context/` (graph + processor pipeline), `packages/core/src/scheduler/`, `packages/core/src/hooks/` (10 events, BeforeModel), `packages/core/src/routing/` (CompositeStrategy), `evals/` (dynamic baselines), `packages/core/src/skills/`, `packages/core/src/tools/mcp-client-manager.ts`
- `resources/goose/` — `README.md`, `crates/goose/src/providers/`, `crates/goose-mcp/src/` (70+ servers), `crates/goose/src/agents/extension_manager.rs`, `crates/goose/src/scheduler.rs`, `crates/goose/src/recipe/`, `crates/goose/src/plugins/`, `crates/goose/src/hooks/` (11 events)
- `resources/gpt-pilot/` — `README.md`, `pilot/` (step-based dev, TDD, BugHunter)
- `resources/hermes-agent/` — `README.md`, `AGENTS.md`, `tools/` (~95 tools, registry.py), `plugins/` (35 model-providers, kanban), `gateway/platforms/` (~30 channels), `cron/`, `mcp_serve.py`, `skills/`, `optional-skills/`, `agent/memory_manager.py`, `agent/context_compressor.py`
- `resources/kilocode/` — `README.md`, `packages/opencode/src/agent/`, `packages/opencode/src/permission/` (wildcard + merge), `packages/llm/src/route/` (4-axis), `packages/kilo-sandbox/` (profile), `packages/kilo-memory/src/` (remember/forget/recall), `packages/opencode/src/skill/`, `packages/opencode/src/mcp/`, `packages/opencode/src/worktree/`
- `resources/openclaude/` — `README.md`, `AGENTS.md`, `src/tools/` (~120 slash commands), `src/integrations/vendors/`, `gateways/`, `src/services/api/smartModelRouting.ts`, `src/coordinator/`, `src/services/mcp/` (InProcessTransport + OAuth), `src/context/repoMap/` (PageRank), `src/services/autoDream/`, `src/services/compact/`, `src/services/sandbox/`, `src/skills/`, `src/tools/LSPTool/`, `vscode-extension/`, `src/grpc/`
- `resources/openclaw/` — `README.md`, `VISION.md`, `src/`, `extensions/` (152), `skills/` (51), `src/plugin-sdk/` + `check-plugin-sdk-boundary.mjs`, `src/model-catalog/`, `src/model-fallback.ts`, `src/fleet/`, `src/memory/` + `extensions/memory-core/src/dreaming.ts`, `src/cron/`, `src/mcp/`, `src/agents/sandbox.ts`, `src/agents/auth-profiles.ts`, `src/secrets/` (SecretRef), `qa/scenarios/`
- `resources/opencode-dev/` — `README.md`, `packages/llm/src/route/` (4-axis), `packages/core/src/session/runner/llm.ts` (durable), `packages/core/src/session/input.ts` (steer/queue), `packages/core/src/session/compaction.ts` (structured summary), `packages/core/src/system-context/` (algebra), `packages/core/src/snapshot.ts` (content-addressed), `packages/plugin/src/index.ts` (12+ hooks), `packages/opencode/src/mcp/`, `packages/core/src/policy.ts` (IAM), `packages/core/src/skill/discovery.ts`, `packages/opencode/src/lsp/`
- `resources/OpenHands/` — `README.md`, `openhands/app_server/sandbox/` (Docker/local/remote/VM), `openhands/app_server/integrations/service_types.py` (ACP), `skills/` (trigger-based), `openhands/app_server/mcp/mcp_router.py` (server + proxy), `openhands/app_server/event/` (EventCallbackProcessor), `openhands/app_server/secrets/`, `openhands/app_server/settings/llm_profiles.py`
- `resources/SWE-agent/` — `README.md`, `docs/background/aci.md`, `tools/` (bundle system), `sweagent/tools/parsing.py` (11 strategies), `sweagent/agent/history_processors.py` (pipeline), `sweagent/environment/swe_env.py` (SWE-ReX sandbox), `sweagent/agent/reviewer.py` (retry loop), `sweagent/agent/hooks/` (3-layer)
- `resources/zero/zero-main/` — `README.md`, `docs/`, `internal/agent/loop.go`, `internal/agent/compaction.go` (proactive+reactive), `internal/sandbox/` (landlock/seccomp/seatbelt/Windows), `internal/swarm/` (mailbox), `internal/specialist/`, `internal/mcp/`, `internal/plugins/`, `internal/skills/`, `internal/hooks/`, `internal/sessions/`, `internal/cron/`, `internal/agent/selfcorrect.go`, `internal/agent/profile_controller.go` (adaptive), `internal/agent/completion_policy.go`, `internal/lsp/`, `internal/worktrees/`, `internal/agenteval/`, `internal/perfbench/`, `internal/credstore/`, `internal/keyring/`, `internal/redaction/`

**Companion documents:**

- `docs/reports/adoptable-features-master.md` — 16-repo feature-first synthesis (20 numbered features, per-repo comparison tables, "Recommended adoption" picks with rationale).
- `docs/reports/repos/*.md` — 16 individual repo inventories (source for this report's Section 3 snapshots and Section 5 evidence).
- `docs/research/AI Coding Agents Market Research.md` — Claude Code / Codex / Cursor / OpenCode competitive synthesis.

---

*End of report.*
