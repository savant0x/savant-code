<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="assets/banner.png" alt="Savant-Code — Multi-Agent AI Coding Assistant" width="850" />

**Savant-Code — Multi-Agent AI Coding Assistant. TypeScript Monorepo. ECHO-Protocol Citizen.**

Two products ship from this monorepo. **Savant-Code** is the full-featured AI coding agent for your terminal — multi-agent orchestration, custom skills, MCP tool discovery, progressive skill loading, custom slash commands, stream-JSON output for CI, and the [`@savant-code/sdk`](https://www.npmjs.com/package/@savant-code/sdk) for embedding agents in your own apps. **Savant-Free** is the free, ad-supported variant — no subscription, no API key, same agent runtime with paid features stripped at compile time via `FREEBUFF_MODE=true`.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![OpenTUI](https://img.shields.io/badge/OpenTUI-0.2.2-%23000000?style=flat-square&logo=opentui&logoColor=%2300fbff)](https://github.com/anomalyco/opentui)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](ECHO.md)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![Release](https://img.shields.io/badge/Release-v0.0.6-%23000000?style=flat-square&logo=semver&logoColor=%2300fbff)](CHANGELOG.md)

</div>

> **v0.0.6** — ECHO Compliance + Cloudflare Provider. Hardened type safety across core workspaces (Law 6, FID-068), brought four core workspaces to zero ESLint warnings (Law 15, FID-069), removed production TODOs and routed console usage through the logger (Laws 5 & 14, FID-070), consolidated duplicate utility helpers (Law 13, FID-071), and added Cloudflare Workers AI as a gateway provider (FID-072).

---

## Overview

Savant-Code is a TypeScript monorepo that builds, ships, and maintains two AI coding-agent products from one workspace:

- **Savant-Code** (npm: `@savant-code/cli` — binary: `savant-code`) — the paid CLI + the public [`@savant-code/sdk`](https://www.npmjs.com/package/@savant-code/sdk). Multi-agent orchestration, custom skills, MCP tool discovery, mode switching (`EDIT` / `ANALYZE` / `SCAFFOLD`), usage metering.
- **Savant-Free** (npm: `@savant-code/savant-free` — binary: `savant-free`) — the free, ad-supported CLI. Same agent runtime, same SDK, but built with `SAVANT_FREE_MODE=true` so the bundler strips paid-only slash commands, credits UI, and mode switching. Result: a single binary that "just works" — no subscription, no API key, no config.

Both products are built from the same `cli/` source — only the build flag differs. The SDK, the agent runtime, the multi-agent orchestration engine, the tool layer, and the LLM provider shims are shared. That's why two products can ship from one monorepo without duplicating thousands of lines.

The whole project ships under [ECHO Protocol v0.2.0](ECHO.md) — the same 15-law agent discipline that governs the Savant ecosystem. Every change goes through the RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE Perfection Loop FSM, with a hard 10-iteration cap and a 10% Levenshtein change-cap per pass.

---

## Key Technologies

| Layer | Tech | Version |
|-------|------|---------|
| Runtime | Bun | 1.3.14 (engines `>=1.3.11`) |
| Language | TypeScript | 5.5.4 (`strict: true`, `noImplicitReturns: true`) |
| TUI | OpenTUI + React 19 | `@opentui/core` 0.2.2, `react` ^19.0.0 |
| State | Zustand + Immer | zustand ^5.0.8, immer ^10.1.3 |
| Validation | Zod | ^4.2.1 |
| LLM SDK | Vercel AI SDK | `ai` ^5.0.52 + `@ai-sdk/anthropic` 2.0.50 |
| MCP | Model Context Protocol | `@modelcontextprotocol/sdk` ^1.18.2 |
| Code parsing | tree-sitter (WASM) | `@vscode/tree-sitter-wasm` 0.1.4 |
| HTTP / WS | ws, node-fetch, custom SDK client | ws ^8.18.0 |
| Package manager | Bun workspaces (hoisted) | `bunfig.toml` `[install] linker = "hoisted"` |

---

## Features

### CLI (`@savant-code/cli` — npm: `@savant-code/cli` and `@savant-code/savant-free`)

- **Multi-agent orchestration** — 9 specialized agents coordinate via ECHO Protocol: Detective finds issues, Forge implements, Verifier audits, Recorder manages FIDs, Thinker reasons, Scout explores, Researcher investigates, Scribe documents.
- **`/init` command** — scaffolds `.agents/types/{agent-definition,tools,util-types}.ts` and a starter `knowledge.md`.
- **Slash commands** — `/new`, `/history`, `/bash`, `/feedback`, `/theme:toggle`, `/login`, `/logout`, `/exit`, plus agent-specific commands.
- **`@filename` and `@AgentName` mentions** — file and agent mentions with inline autocomplete.
- **Bash mode** — `!command` or `/bash` to run shell commands inline (with confirmation).
- **Mode switching** — `EDIT` / `ANALYZE` / `SCAFFOLD` execution-scope modes, togglable at runtime via UI.
- **Streaming & cancellation** — token-by-token SSE streaming with mid-stream cancellation, retry-with-backoff, and subagent streaming for parallel work.
- **Knowledge files** — project-level `knowledge.md` plus per-user home-dir knowledge, auto-loaded into agent context.
- **Skills** — OpenClaw-format `SKILL.md` files discovered at startup, schemas sent to the LLM, available as native tools.
- **MCP tools** — Model Context Protocol servers discovered at startup, schemas published to the LLM API.
- **Theming** — light/dark toggle (`/theme:toggle`), Neon Slate aesthetic.

### SDK (`@savant-code/sdk`)

- **`SavantCodeClient` class** — single entry point for running agents from any Node.js / Bun / browser app.
- **Streaming events** — `handleEvent` callback receives `RunState` updates, tool calls, file diffs, and final output.
- **Custom agents** — pass `agentDefinitions: AgentDefinition[]` to override defaults.
- **Custom tools** — pass `customToolDefinitions` to extend the tool registry.
- **Cancellation** — `AbortSignal` propagates through subagent streams.

### Agent Runtime (`@savant-code/agent-runtime`)

- **LLM-agnostic** — calls any provider registered with `@savant-code/llm-providers` (OpenAI-compatible chat, Anthropic, etc.).
- **Multi-step loop** — model decides tool → tool executes → result fed back → repeat until `end_turn` or budget exhausted.
- **Tool registry** — built-in (`read_files`, `write_file`, `run_terminal_command`, `code_search`, `web_search`, `spawn_agents_inline`, …) + custom + MCP.
- **Cost aggregation** — per-call token counts and USD cost estimates surfaced in `RunState`.

### ECHO Protocol Integration

- **9 specialized agents** — Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe
- **FID-Bound Execution** — Code is never written until the FID converges
- **Perfection Loop FSM** — RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE
- **Separation of Duties** — The agent that writes code cannot verify it
- **15 Laws** — 4 immutable process + 11 extended code laws

---

## Repo Map

| Workspace | Package | Purpose |
|-----------|---------|---------|
| `agents/` | `@savant-code/agents` | Public agent definitions shipped with the CLI |
| `cli/` | `@savant-code/cli` | CLI source — UI, commands, state, hooks, OpenTUI/React components |
| `common/` | `@savant-code/common` | Shared types, tool definitions, utilities |
| `evals/` | `@savant-code/evals` | Buffbench benchmark runner + public eval fixtures |
| `savant-free/` | `@savant-code/savant-free` | CLI release + e2e tests for the free variant |
| `packages/agent-runtime/` | `@savant-code/agent-runtime` | Agent loop, tool executor, LLM API integration |
| `packages/code-map/` | `@savant-code/code-map` | tree-sitter code indexing, language detection |
| `packages/database/` | `@savant-code/database` | Database abstraction layer |
| `packages/llm-providers/` | `@savant-code/llm-providers` | Public LLM provider shims |
| `sdk/` | `@savant-code/sdk` | Public SDK — `SavantCodeClient`, types, build + verify scripts |
| `scripts/tmux/` | `@savant-code/tmux` | tmux CLI helpers used in interactive test runs |

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/savant0x/savant-code.git
cd savant-code
bun install
```

### 2. Run the CLI (development)

```bash
# Run the CLI in dev mode (paid: savant-code)
bun run dev

# Or run the savant-free variant
bun run dev:savant-free
```

### 3. Build for Release

```bash
# Build the SDK
bun run build:sdk

# Build the savant-free CLI binary
bun run build:savant-free
```

### 4. Use the SDK

```ts
import { SavantCodeClient } from '@savant-code/sdk'

const client = new SavantCodeClient({
  apiKey: process.env.SAVANT_CODE_API_KEY,
  cwd: '/path/to/your/project',
  onError: (err) => console.error('Savant-Code error:', err.message),
})

const result = await client.run({
  agent: 'savant',
  prompt: 'Add error handling to all API endpoints',
  handleEvent: (event) => console.log('Progress', event),
})
```

### 5. End-User Install

```bash
# Free (ad-supported, npm)
npm install -g @savant-code/savant-free

# Paid (npm)
npm install -g @savant-code/cli
```

---

## CLI Commands

| Command | What it does |
|---------|--------------|
| `bun run dev` | Launch CLI in dev mode |
| `bun run dev:savant-free` | Launch with `SAVANT_FREE_MODE=true` |
| `bun run build:sdk` | Build the SDK for npm publish |
| `bun run build:savant-free` | Build the savant-free CLI binary |
| `bun run ci` | `build:sdk && build:savant-free` — CI gate |
| `bun test` | Run test suite |
| `bun x tsc --noEmit` | Type check |
| `bun x eslint . --max-warnings 0` | Lint |

---

## ECHO Protocol

This project ships with [ECHO Protocol v0.2.0](ECHO.md) — the single bootstrap file for agent behavior.

### Core Principles

- **FID-Bound Execution** — Code is never written until the FID converges
- **Perfection Loop** — RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE
- **Separation of Duties** — The agent that writes code cannot verify it
- **No Deferrals** — Every approved work item must be completed

### 15 Laws

4 immutable process laws (Read 0-EOF, Present Before Act, Verify Before Proceed, Call-Graph Reachability) + 11 extended code laws. `strict: true` in TypeScript.

### Key Files

| File | Purpose |
|------|---------|
| `ECHO.md` | The 15 Laws + Perfection Loop FSM + FID lifecycle |
| `ARCHITECTURE.md` | Agent roster and tool restrictions |
| `protocol.config.yaml` | Build commands, quality bar, paths |
| `dev/fids/` | Feature Implementation Documents |
| `dev/session-summaries/` | Session audit trail |
| `dev/LEARNINGS.md` | Cross-session lessons |

---

## Configuration

| What | Where | Format |
|------|-------|--------|
| ECHO Protocol runtime config | `protocol.config.yaml` | YAML — language, commands, quality limits |
| TypeScript base config | `tsconfig.json` | JSON — `strict: true` |
| ESLint config | `eslint.config.js` | Flat config |
| Bun config | `bunfig.toml` | TOML — `linker: "hoisted"` |

---

## Validation

```bash
# Build
bun run build:sdk && bun run build:savant-free

# Test
bun test

# Type check
bun x tsc --noEmit

# Lint
bun x eslint . --max-warnings 0

# Format
bun x prettier --write .
```

---

## Documentation

- [`ECHO.md`](ECHO.md) — The 15 Laws + Perfection Loop FSM
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Agent roster and tool restrictions
- [`protocol.config.yaml`](protocol.config.yaml) — Build commands, quality bar
- [`CHANGELOG.md`](CHANGELOG.md) — Release history
- [`dev/LEARNINGS.md`](dev/LEARNINGS.md) — Cross-session lessons
- [`dev/session-summaries/`](dev/session-summaries/) — Session audit trail

---

## License

[Apache-2.0](LICENSE) — see [LICENSE](LICENSE) for full text.

---

<div align="center">

_Savant-Code is the public TypeScript monorepo for the Savant-Code agent framework. Savant-Free is the ad-supported variant._

**Savant** • 2026
</div>
