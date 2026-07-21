# SWE-agent — Feature Inventory

> **Repo:** `resources/SWE-agent` | **Language:** Python (3.11+)
> **Runtime:** Docker/Modal/AWS via SWE-ReX

## Overview

SWE-agent is a research-oriented coding agent from Princeton that formalizes the Agent-Computer Interface (ACI) concept. It features YAML-driven configuration, 11 output parser strategies, a composable history processor pipeline, a three-layer hook system, and a retry agent with LLM-based review/chooser loops.

## Feature Inventory

### ACI Design Philosophy
- **Agent-Computer Interface** — Curated tool surfaces that maximize agent performance. Specialized file viewers, search commands, and editors with built-in linters rather than raw shell. (`docs/background/aci.md`, `tools/windowed_edit_linting/`)

### YAML-Driven Configuration
- **Composable Configs** — Entire agent behavior governed by YAML files. Multiple configs merged via repeated `--config` flags. (`config/default.yaml`, `sweagent/utils/config.py`)

### Tool Bundle System
- **Self-Contained Bundles** — Each tool is a directory with `config.yaml`, `bin/` executables, optional `install.sh`, optional `lib/`. `hidden_tools` feature, `state_command` for dynamic state injection. (`tools/`, `sweagent/tools/bundle.py`)

### 11 Parser Strategies
- **FunctionCallingParser** — LiteLLM tool calls. **ThoughtActionParser** — backtick code blocks. **XMLThoughtActionParser**, **XMLFunctionCallingParser**, **JsonParser**, **ActionParser**, **ActionOnlyParser**, **EditFormat**, **Identity**, **BashCodeBlockParser**, **SingleBashCodeBlockParser**. (`sweagent/tools/parsing.py`)

### History Processor Pipeline
- **Composable Processors** — `LastNObservations` (polling-aware caching), `CacheControlHistoryProcessor` (Anthropic prompt cache), `ClosedWindowHistoryProcessor` (collapse outdated windows), `TagToolCallObservations`, `RemoveRegex`, `ImageParsingHistoryProcessor`. (`sweagent/agent/history_processors.py`)

### Container Sandboxing
- **Docker/Modal/AWS** — via SWE-ReX. Agent never runs code on host. Clean separation between agent logic and runtime. (`sweagent/environment/swe_env.py`)

### Retry Agent with Review Loop
- **Multi-Attempt** — Runs agent multiple times. `Reviewer` (separate LLM) scores solutions. `Chooser` with `Preselector` picks best. `ScoreRetryLoop` (threshold) and `ChooserRetryLoop` (LLM selection). (`sweagent/agent/reviewer.py`, `sweagent/agent/agents.py`)

### Action Sampling
- **AskColleagues** — Sample N completions, present as "colleague ideas", model synthesizes. **BinaryTrajectoryComparison** — Pairwise tournament selection. (`sweagent/agent/action_sampler.py`)

### Command Safety
- **Blocklist** — Configurable prefix, exact match, or conditional regex blocking. (`sweagent/tools/tools.py`)

### Three-Layer Hook System
- **Agent/Env/Run Hooks** — `AgentHook` (per-step), `EnvHook` (environment lifecycle), `RunHook` (instance lifecycle). Combined dispatch. Events: `on_actions_generated`, `on_action_executed`, `on_model_query`, `on_query_message_added`. (`sweagent/agent/hooks/`, `sweagent/environment/hooks/`, `sweagent/run/hooks/`)

### Batch Execution
- **Parallel Workers** — ThreadPoolExecutor with per-instance cost tracking, thread-safe API key rotation, random startup delays, live progress bars, continuous SWE-bench submission. (`sweagent/run/run_batch.py`)

### Other
- **Multimodal Support** — Image processing from GitHub issues. Vision model integration. (`sweagent/agent/problem_statement.py`)
- **Human-in-the-Loop Shell** — `^C` switches to human input, `^D` returns to AI. (`sweagent/agent/extra/shell_agent.py`)
- **Web-Based Trajectory Inspector** — Built-in HTTP server for viewing agent trajectories. (`sweagent/inspector/`)
- **Auto-Submission on Errors** — Extracts partial work on fatal errors. (`sweagent/agent/agents.py`)
- **Demonstrations** — Pre-recorded trajectories injected as few-shot examples. (`sweagent/agent/agents.py`)
- **Registry Bundle** — Persistent JSON key-value store for inter-tool state. (`tools/registry/`)
- **PR Opening Hook** — Auto-creates draft GitHub PRs with safety checks. (`sweagent/run/hooks/open_pr.py`)
- **Edit Tools with Linting** — Linting-gated edits reject syntactically invalid changes. (`tools/windowed_edit_linting/`)
- **Diff State Tracking** — `git diff` as per-step template variable. (`tools/diff_state/`)
- **Web Browser Bundle** — 14 Playwright-based tools for browser automation. (`tools/web_browser/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | ACI Design Philosophy | Design agent-optimized tools, not raw shell |
| HIGH | Tool Bundle System with state_command | Modular, self-contained tool packaging |
| HIGH | History Processor Pipeline | Composable context management |
| HIGH | Three-Layer Hook System | Clean extensibility at agent/env/run levels |
| HIGH | Retry Agent with Review Loop | Multi-attempt with LLM-based selection |
| MEDIUM | Action Sampling (AskColleagues) | Multi-sample consensus for action selection |
| MEDIUM | Command Blocklist/Safety Filtering | Prevent dangerous agent actions |
| MEDIUM | Auto-Submission on Errors | Graceful degradation |
| MEDIUM | Registry Bundle (Shared State) | Inter-tool persistent state |
| LOW | YAML Config Composition | Declarative, mergeable agent profiles |
