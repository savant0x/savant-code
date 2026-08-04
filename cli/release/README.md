# Savant-Code

**A terminal-native multi-agent AI coding assistant that audits every change before it touches your repo.**

Built with TypeScript/Bun, governed by the [ECHO Protocol](https://github.com/savant0x/savant-code/blob/main/ECHO.md),
and designed for local-first use with Ollama or any OpenAI-compatible provider.

[![GitHub Stars](https://img.shields.io/github/stars/savant0x/savant-code?style=social)](https://github.com/savant0x/savant-code)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/savant0x/savant-code/blob/main/LICENSE)

## Installation

```bash
npm install -g savant-code
```

## Quick Start

```bash
cd your-project
savant-code
```

Then just start chatting — describe what you want and Savant-Code will read your codebase, plan changes, implement them,
and verify the result.

### Configure your provider

Savant-Code supports local Ollama plus multiple hosted gateway providers. If Ollama is not running, configure a hosted
provider before sending your first prompt:

```text
/provider
```

This opens the interactive provider picker. You can also select a provider directly with `/provider <name>`:

| Provider | Picker command | Environment variable | Notes |
| --- | --- | --- | --- |
| Ollama | automatic local detection | — | Local inference; no API key required |
| OpenRouter direct | `DIRECT_PROVIDER=openrouter` | `OR_MASTER_KEY`, `OPENROUTER_API_KEY`, or `INFERENCE_API_KEY` | Direct mode; key resolution uses master key, then regular key, then inference key |
| OpenCode Go | `/provider opencode-go` | `OPENCODE_GO_API_KEY` | Default hosted provider; MiMo 2.5 is the default model |
| TokenRouter | `/provider tokenrouter` | `TOKENROUTER_API_KEY` | Multi-provider gateway |
| NVIDIA NIM | `/provider nvidia` | `NVIDIA_API_KEY` | NVIDIA-hosted inference |
| CommandCode | `/provider commandcode` | `COMMAND_CODE_API_KEY` | OpenAI-compatible hosted inference |

Paste the selected key into the masked prompt; Savant-Code stores it globally and never adds it to chat history. The
credential file is:

- **Windows:** `C:\\Users\\<username>\\.savant-code\\credentials.json`
- **macOS/Linux:** `~/.savant-code/credentials.json`

For automation, set the provider-specific environment variable before launching Savant-Code. Environment variables take
precedence over saved credentials:

```powershell
# PowerShell — choose one provider key
$env:OPENCODE_GO_API_KEY = "your-key"
# $env:TOKENROUTER_API_KEY = "your-key"
# $env:NVIDIA_API_KEY = "your-key"
# $env:COMMAND_CODE_API_KEY = "your-key"
savant-code
```

```cmd
:: Command Prompt — choose one provider key
set OPENCODE_GO_API_KEY=your-key
:: set TOKENROUTER_API_KEY=your-key
:: set NVIDIA_API_KEY=your-key
:: set COMMAND_CODE_API_KEY=your-key
savant-code
```

```bash
# macOS/Linux — choose one provider key
export OPENCODE_GO_API_KEY="your-key"
# export TOKENROUTER_API_KEY="your-key"
# export NVIDIA_API_KEY="your-key"
# export COMMAND_CODE_API_KEY="your-key"
savant-code
```

#### OpenRouter direct mode

To bypass the Savant Code backend and route inference directly to OpenRouter, set:

```bash
export DIRECT_PROVIDER=openrouter
export INFERENCE_BASE_URL=https://openrouter.ai/api/v1
```

The OpenRouter credential precedence is:

1. `OR_MASTER_KEY` — exchanges for a regular OpenRouter key through `/api/v1/keys`.
2. `OPENROUTER_API_KEY` — uses an existing regular OpenRouter key directly.
3. `INFERENCE_API_KEY` — uses the SDK-specific inference key.

For advanced direct-provider or backend integrations, Cloudflare Workers AI uses `CLOUDFLARE_API_TOKEN` together with
`CLOUDFLARE_ACCOUNT_ID`. These variables are for advanced configurations; ordinary CLI users should use `/provider` or
one of the four provider-specific keys above. Do not create a project-local `.env` file or edit `credentials.json`
manually.

## What Makes Savant-Code Different

Savant-Code isn't a single AI model guessing at your code. It's a **multi-agent system** where 9 specialized agents
coordinate through a strict protocol to audit every change before it touches your files.

### The Agent Roster

| Agent | Role |
|-------|------|
| **Savant** | Orchestrator — routes work, enforces protocol, spawns agents |
| **Detective** | Discovers bugs and issues with evidence before any code is written |
| **Forge** | Implements code changes from a converged plan |
| **Verifier** | Independent double-audit after implementation |
| **Thinker** | Deep sequential reasoning for complex problems |
| **Scout** | Explores codebases to gather context |
| **Researcher** | Web search and documentation lookup |
| **Recorder** | FID lifecycle management and tracking |
| **Scribe** | Session summaries and knowledge capture |

### ECHO Protocol

Every change follows the **ECHO Perfection Loop**:

1. **RED** — Identify ALL failures and issues with evidence
2. **GREEN** — Fix with minimal, surgical changes
3. **AUDIT** — Independent verification by a separate agent
4. **COMPLETE** — Document results, archive tracking

No code is written without a plan. No plan is accepted without audit. No audit passes without evidence.

## Features

### Multi-Agent Orchestration

9 specialized agents coordinate via the ECHO Protocol. Detective finds issues, Forge implements, Verifier audits,
Thinker reasons through complex problems, and Recorder tracks everything.

### Thinker with Sequential Thinking

The Thinker agent accumulates stacked reasoning steps, converges to a typed non-null result, and never returns an empty
or null output. Each thought builds on the previous one.

### Native Tool-Call Hardening

Fail-closed streaming boundary for incomplete or malformed tool calls. Stale-fragment replacement for placeholder
arguments. Permissive coercion of stringified values before strict validation.

### Tool Permission Boundary

Strict allowlist-based tool provisioning. Restricted agents never receive parent-only tools. Each agent has exactly the
tools it needs — no more.

### Gateway Providers

Works with Ollama (local-first) and any OpenAI-compatible API:

- **OpenCode Go** (default) — MiMo 2.5
- **OpenRouter** — access to hundreds of models
- **NVIDIA NIM** — enterprise inference
- **Cloudflare Workers AI** — edge inference
- **TokenRouter** — multi-provider routing
- **CommandCode** — OpenAI-compatible hosted inference
- **Any OpenAI-compatible endpoint** — custom providers via `/provider`

### Context Compaction

4-layer progressive auto-compaction keeps your session running through large codebases without hitting context limits.

### Rich Terminal UI

- Streaming token-by-token output
- Copy buttons on code blocks, tool outputs, and diffs
- Mode switching (EDIT / ANALYZE / SCAFFOLD)
- Light/dark theming with Neon Slate aesthetic
- Provider picker with masked API key input
- Collapsible sidebar sections

### Goal Loop

Set a goal and a cadence — Savant-Code will check and work toward it on a schedule.

```bash
/goal fix all failing tests
/loop 5m
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/model` | Switch LLM provider and model |
| `/provider` | Configure API keys (interactive picker) |
| `/help` | Show all commands |
| `/new` | Start a fresh conversation |
| `/history` | Browse past sessions |
| `/goal` | Set a persistent goal |
| `/loop` | Schedule recurring checks |
| `/telemetry` | Toggle analytics (on/off/status) |
| `/theme:toggle` | Switch light/dark mode |
| `/init` | Scaffold agent config files |

### Knowledge Files

Add a `knowledge.md` anywhere in your project to give Savant-Code persistent context about your codebase, conventions,
and preferences.

## Usage Examples

**Implement a feature:**
> Add a rate limiter to the API endpoints that allows 100 requests per minute per IP address, with Redis-backed counting.

**Fix a bug:**
> The login form crashes on submit when the email field is empty. Find the bug and fix it.

**Write tests:**
> Add unit tests for the UserService class covering all edge cases in the register flow.

**Refactor:**
> Refactor the database connection layer to use connection pooling instead of creating a new connection per request.

**Code review:**
> Review my recent changes and flag any security issues, performance problems, or style violations.

## Troubleshooting

### Permission Errors

```bash
sudo npm install -g savant-code
```
Or [reinstall Node](https://nodejs.org/en/download) to fix global permissions.

### Corporate Proxy / Firewall

```bash
export HTTPS_PROXY=http://your-proxy-server:port
savant-code
```

### No Model Available

Savant-Code requires at least one LLM provider. Run `/provider` to configure one, or install
[Ollama](https://ollama.com) for local inference.

## Links

- **GitHub:** [github.com/savant0x/savant-code](https://github.com/savant0x/savant-code)
- **Docs:** [savant-code.com/docs](https://savant-code.com/docs)
- **Issues:** [GitHub Issues](https://github.com/savant0x/savant-code/issues)
- **License:** [Apache 2.0](https://github.com/savant0x/savant-code/blob/main/LICENSE)
