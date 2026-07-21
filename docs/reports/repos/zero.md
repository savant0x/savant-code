# Zero — Feature Inventory

> **Repo:** `resources/zero` | **Language:** Go (1.26.5+)
> **License:** MIT | **Tagline:** "A terminal coding agent you own."

## Overview

Zero is a Go-based terminal coding agent with 25+ LLM providers, OS-level sandboxing (landlock/seccomp/seatbelt), a multi-agent swarm with mailbox-based communication, an execution profile controller (adaptive self-regulation), a completion policy (headless work gating), post-edit LSP verification, and a two-phase memories pipeline. It is one of the most technically complete coding agents.

## Feature Inventory

### Multi-Provider LLM (25+)
- **Provider-Neutral Types** — `CompletionRequest`/`StreamEvent` abstraction with single `Provider.StreamCompletion` interface. OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek, Mistral, xAI, Qwen, Kimi, Ollama, LM Studio, MiniMax, etc. (`internal/providers/`, `internal/providercatalog/`)

### Agent Loop
- **Core Run** — 3184 lines. Malformed tool call detection, repeated-failure guards, stall retries, empty-turn nudges, max-turn fallback, proactive/reactive compaction. `RequireCompletionSignal` for headless mode. (`internal/agent/loop.go`)

### Context Compaction
- **Proactive + Reactive** — Summarizes oldest middle at ~70% context. Per-provider calibration by usage. Turn-boundary preservation (never splits tool_use/tool_result). Plan/structured state preserved. (`internal/agent/compaction.go`)

### Permission & Sandbox Engine
- **Dual-Layer** — Tool-level permission metadata + sandbox engine evaluating path scope, network, destructive shell, command-prefix grants. Platform backends: macOS seatbelt, Linux landlock/bwrap/seccomp, Windows restricted token + WFP. Risk classification (low/medium/high/critical) with structured `Block` codes. (`internal/sandbox/`)

### Multi-Agent Swarm
- **Mailbox-Based** — Orchestrator spawns/coordinates/collects from concurrent specialists. Per-agent mailboxes, task handoff, channel-based `WaitSettled` (not polling). Deferred tool loading adapts to swarm state. (`internal/swarm/`)

### Specialist Sub-Agents
- **Markdown Manifests** — Three scopes (built-in, user, project). `extends` inheritance. `GenerateSpecialist` tool (agent creates its own sub-agents). Background state survives restarts. (`internal/specialist/`)

### MCP (Client + Server)
- **Bidirectional** — Both client and server. stdio and HTTP transports. OAuth. (`internal/mcp/`)

### Plugin System
- **Directory-with-Manifest** — `plugin.json` with tools, hooks, skills. Auto-registration of skill roots. (`internal/plugins/`)

### Skills System
- **On-Demand Loading** — Multi-root discovery with earlier-root-wins. Registered in system prompt. (`internal/skills/`)

### Hooks System
- **Shell Commands** — stdin-JSON payload (not env vars). `beforeTool` (blocking) / `afterTool` (advisory). Audit trail. (`internal/hooks/`)

### Session Management
- **Resume/Fork/Rewind** — Append-only event log (`events.jsonl` + `metadata.json`). Parent/root IDs for lineage. (`internal/sessions/`)

### Cron Scheduler
- **Built-in Recipes** — `git-recap`, `ci-watch`, `todo-pulse`, `daily-summary`. Customizable loop prompt. DST-aware parser. (`internal/cron/`)

### Self-Correction System
- **Post-Edit Verification** — LSP diagnostics + project verification (tests/lint) fed back to model. Attempt ceiling (default 3). Autonomy-gated (low = report only, high = auto-fix). (`internal/agent/selfcorrect.go`)

### Execution Profile Controller
- **Adaptive Self-Regulation** — Observes per-turn signals (tool failure streak, risky mutations, self-correct failures, uncertain completion) and one-shot escalates loop parameters. Safety: escalation targets are displaced values (can never introduce unauthorized knobs). (`internal/agent/profile_controller.go`)

### Parallel Tool Execution
- **Read-Ahead** — Independent read-only tools (read_file + grep + glob) execute concurrently (up to 8). Resource-key conflict detection prevents same-path parallel reads. (`internal/agent/parallel_tools.go`)

### Deferred Tool Loading
- **State-Dependent** — Many tools withheld, advertised as compact `tool_search` lines. Coordination tools un-defer when swarm exists. (`internal/tools/deferred.go`)

### Stream-JSON Protocol
- **Headless/Automation** — Schema-versioned (v2), line-delimited JSON. Structured events with permission metadata. (`internal/streamjson/`)

### Agent Evals
- **Process-Level Assertions** — Fixtures with expected changed files, forbidden files, verification commands, required trace events. (`internal/agenteval/`)

### Spec Mode
- **Plan-First** — Draft spec, pause for human review, then execute. (`internal/specmode/`)

### Other
- **LSP Integration** — Background async diagnostics. (`internal/lsp/`)
- **Worktrees** — Isolated git worktrees. (`internal/worktrees/`)
- **Completion Policy** — Validates headless work is actually complete. (`internal/agent/completion_policy.go`)
- **GitHub Action** — Composite action with install + run + post. (`action.yml`)
- **Notification System** — Webhook notifier with redaction. (`internal/notify/`)
- **Tracing** — Opt-in per-turn timing recorder. (`internal/trace/`)
- **Performance Benchmarking** — Manifest-based test suites with model matrix. (`internal/perfbench/`)
- **OAuth Management** — Device code, loopback, PKCE, encrypted storage, keyring, singleflight refresh. (`internal/oauth/`)
- **Redaction System** — Secret scrubbing at every output boundary. (`internal/redaction/`)
- **File Tracker** — Staleness detection for external changes. (`internal/tools/file_tracker.go`)
- **Output Budget** — Category-aware semantic truncation. (`internal/tools/output_budget.go`)
- **Voice Dictation** — Cloud (Deepgram), local (Whisper), OpenAI Realtime. (`internal/dictation/`)
- **Image/PDF Input** — File, clipboard, PDF extraction. (`internal/imageinput/`)
- **Repository Map** — Deterministic, 4 KiB cap. (`internal/repomap/`)
- **Daemon Mode** — Background worker pool with socket IPC. (`internal/daemon/`)
- **Escalate Model Tool** — Mid-run switch to stronger model. (`internal/tools/escalate_model.go`)
- **Response Style** — Concise, explanatory, review, balanced. (`internal/agent/types.go`)
- **Ask-User Tool** — Structured questions with options, descriptions, recommended defaults. (`internal/tools/ask_user.go`)
- **Theme System** — 12+ built-in themes. (`internal/tui/theme.go`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Execution Profile Controller | Adaptive self-regulation based on failure signals |
| HIGH | Completion Policy | Ensures headless work is actually complete |
| HIGH | Self-Correction System (LSP + test) | Post-edit verification with autonomy gating |
| HIGH | Multi-Agent Swarm (mailbox-based) | Mature orchestration with task handoff |
| HIGH | Context Compaction (proactive + reactive) | Essential for long sessions |
| HIGH | Deferred Tool Loading (state-dependent) | Keeps context lean |
| HIGH | Agent Evals (process-level assertions) | Tests process, not just output |
| HIGH | Spec Mode (plan-first with review gate) | High-stakes change safety |
| MEDIUM | Provider-Neutral Runtime Types | Clean multi-provider abstraction |
| MEDIUM | Permission & Sandbox Engine | Dual-layer safety with structured block codes |
