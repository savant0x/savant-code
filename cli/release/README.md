<!-- markdownlint-disable MD013 -->

# Savant-Code

**A terminal-native multi-agent AI coding assistant that audits every change before it touches your repo.**

Built with TypeScript/Bun, governed by the [ECHO Protocol](https://github.com/savant0x/savant-code/blob/main/ECHO.md), and designed for local-first use with Ollama or any OpenAI-compatible provider.

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

Describe the change you want. Savant-Code explores the repository, plans the work, implements approved changes, and verifies the result.

If Ollama is installed and running, it is detected automatically and requires no API key:

```bash
ollama serve
savant-code
```

Run `/health` inside the chat to inspect Ollama connectivity, available local models, provider mode, and permission mode.

## Provider Setup

Savant-Code supports local Ollama, hosted gateway providers, and direct OpenRouter or OpenAI-compatible endpoints. Use the interactive picker:

```text
/provider
```

Or select one of the supported gateway providers directly:

| Provider | Selection | Environment variable | Notes |
| --- | --- | --- | --- |
<!-- GENERATED:provider-table-start -->
| OpenRouter | `/provider openrouter` or `DIRECT_PROVIDER=openrouter` | `OR_MASTER_KEY`, `OPENROUTER_API_KEY`, or `INFERENCE_API_KEY` | Default provider; free tier (`openrouter/free`) is the boot default; direct mode without the Savant backend |
| TokenRouter | `/provider tokenrouter` or `DIRECT_PROVIDER=tokenrouter` | `TOKENROUTER_API_KEY` | Multi-provider gateway |
| NVIDIA NIM | `/provider nvidia` or `DIRECT_PROVIDER=nvidia` | `NVIDIA_API_KEY` | NVIDIA-hosted inference |
| OpenCode Go | `/provider opencode-go` or `DIRECT_PROVIDER=opencode-go` | `OPENCODE_API_KEY` | Hosted gateway (dual-protocol) |
| Cloudflare | Environment configuration | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Env-only — not in the `/provider` picker; requires the account id too |
| CommandCode | `/provider commandcode` or `DIRECT_PROVIDER=commandcode` | `COMMAND_CODE_API_KEY` | OpenAI-compatible hosted inference (dual-protocol) |
| KiosAPI | `/provider kiosapi` or `DIRECT_PROVIDER=kiosapi` | `KIOSAPI_API_KEY` | OpenAI-compatible gateway (live catalog) |
| Nous Research | `/provider nous` or `DIRECT_PROVIDER=nous` | `NOUS_API_KEY` | OpenAI-compatible direct inference; Portal OAuth is separate |
| Ollama | Automatic detection | `OLLAMA_HOST` (optional) | Local inference; no API key required |
| OpenCode Zen | `/provider opencode-zen` or `DIRECT_PROVIDER=opencode-zen` | `OPENCODE_API_KEY` | Pay-per-use gateway, 70 models incl. free tier (multi-protocol) |
| TokenHarbor | `/provider tokenharbor` or `DIRECT_PROVIDER=tokenharbor` | `TOKENHARBOR_API_KEY` | OpenAI-compatible hosted gateway |
| Custom endpoint | Environment configuration | `INFERENCE_BASE_URL`, `INFERENCE_API_KEY` | Advanced OpenAI-compatible endpoint |
<!-- GENERATED:provider-table-end -->

The interactive key prompt is masked. Saved provider credentials are stored in the user configuration directory and are not added to chat history:

- **Windows:** `C:\Users\<username>\.savant-code\credentials.json`
- **macOS/Linux:** `~/.savant-code/credentials.json`

Shell environment variables take precedence over saved credentials. Configure one provider key before launching:

```powershell
# PowerShell — choose one hosted gateway
$env:OPENCODE_GO_API_KEY = "your-key"
# $env:TOKENHARBOR_API_KEY = "your-key"
# $env:TOKENROUTER_API_KEY = "your-key"
# $env:NVIDIA_API_KEY = "your-key"
# $env:COMMAND_CODE_API_KEY = "your-key"
# $env:NOUS_API_KEY = "your-key"
savant-code
```

```cmd
:: Windows Command Prompt — choose one hosted gateway
set OPENCODE_GO_API_KEY=your-key
:: set TOKENHARBOR_API_KEY=your-key
:: set TOKENROUTER_API_KEY=your-key
:: set NVIDIA_API_KEY=your-key
:: set COMMAND_CODE_API_KEY=your-key
:: set NOUS_API_KEY=your-key
savant-code
```

```bash
# macOS/Linux — choose one hosted gateway
export OPENCODE_GO_API_KEY="your-key"
# export TOKENHARBOR_API_KEY="your-key"
# export TOKENROUTER_API_KEY="your-key"
# export NVIDIA_API_KEY="your-key"
# export COMMAND_CODE_API_KEY="your-key"
# export NOUS_API_KEY="your-key"
savant-code
```

### OpenRouter direct mode

To bypass the Savant Code backend for inference and route directly to OpenRouter:

```bash
export DIRECT_PROVIDER=openrouter
export INFERENCE_BASE_URL=https://openrouter.ai/api/v1
```

The credential resolution order is:

1. `OR_MASTER_KEY` — exchanges a master key for a regular key through OpenRouter `/api/v1/keys`.
2. `OPENROUTER_API_KEY` — uses an existing regular OpenRouter key directly.
3. `INFERENCE_API_KEY` — uses the SDK-specific inference key.

### Complete safe local configuration example

The following is a public template containing dummy values only. Copy it to `.env.local` for local development, then replace only the values you actually use. Configure one inference mode or hosted provider at a time; the entries below document the complete variable surface, not a recommendation to enable every provider simultaneously. `.env.local` must remain private and gitignored. Never copy real credentials into documentation.

```dotenv
# Core and app configuration
NEXT_PUBLIC_CB_ENVIRONMENT=dev
NEXT_PUBLIC_WEB_PORT=3000
NEXT_PUBLIC_SAVANT_CODE_APP_URL=http://localhost:3000
# NEXT_PUBLIC_SAVANT_FREE_APP_URL=http://localhost:3001

# Analytics, support, and billing placeholders
NEXT_PUBLIC_POSTHOG_API_KEY=phc_dummy_replace_me
NEXT_PUBLIC_POSTHOG_HOST_URL=http://localhost:4000
NEXT_PUBLIC_GRAVITY_PIXEL_ID=00000000-0000-0000-0000-000000000000
NEXT_PUBLIC_SUPPORT_EMAIL=replace-me@example.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_dummy_replace_me
NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL=http://localhost:3000/portal
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID=dummy_replace_me

# OpenRouter direct mode
DIRECT_PROVIDER=openrouter
INFERENCE_BASE_URL=https://openrouter.ai/api/v1
OR_MASTER_KEY=dummy-or-master-key-replace-me
# OPENROUTER_API_KEY=dummy-openrouter-api-key-replace-me
# INFERENCE_API_KEY=dummy-inference-api-key-replace-me

# Supported hosted gateways
OPENCODE_GO_API_KEY=dummy-opencode-go-key-replace-me
TOKENHARBOR_API_KEY=dummy-tokenharbor-key-replace-me
TOKENROUTER_API_KEY=dummy-tokenrouter-key-replace-me
NVIDIA_API_KEY=dummy-nvidia-key-replace-me
COMMAND_CODE_API_KEY=dummy-commandcode-key-replace-me
NOUS_API_KEY=dummy-nous-key-replace-me

# Local Ollama override (optional)
# OLLAMA_HOST=http://localhost:11434

# GitHub MCP helper (read-only) and database helper
# SAVANT_CODE_GITHUB_TOKEN=dummy-github-token-replace-me
# SAVANT_CODE_DATABASE_URL=sqlite://./local.db

# Optional backend and advanced integrations
# SAVANT_CODE_API_KEY=backend-dummy-replace-me
# CLOUDFLARE_API_TOKEN=cloudflare-dummy-replace-me
# CLOUDFLARE_ACCOUNT_ID=cloudflare-account-dummy-replace-me
AMAZON_WORKER=amazon-worker-dummy-replace-me
```

`AMAZON_WORKER` is retained for local deployment integrations. `GITHUB_TOKEN` and `NPM_PUBLISH` are intentionally not part of the public template because they are private release credentials.

### Building release binaries

Release binaries ship a sibling `env.json` with the canonical production `NEXT_PUBLIC_*` defaults (prod environment, `https://savant-code.com`, `support@savant-code.com`, release placeholders). `cli/scripts/build-binary.ts` fails the build if any dev `NEXT_PUBLIC_*` value — localhost URLs, personal emails, or dummy keys from the build shell or a repo `.env.local` — leaks into that file. Two escape hatches exist for intentional deviations:

- `SAVANT_CODE_BUILD_ENV=<env>` — build a local dev binary (skips the integrity check).
- `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` — CI/release override when injecting real production keys (for example PostHog or Stripe) that intentionally differ from the canonical placeholders.

Build release artifacts from a clean shell (no dev `NEXT_PUBLIC_*` exports, no `.env.local` loaded) so `env.json` matches the canonical defaults exactly.

## What Makes Savant-Code Different

Savant-Code is a multi-agent system rather than a single model guessing at your code. Ten canonical ECHO roles coordinate with strict separation of duties:

| Agent | Responsibility |
| --- | --- |
| **Savant** | Orchestrator — routes work, enforces protocol, and spawns agents |
| **Detective** | Finds bugs and issues with evidence before code is written |
| **Forge** | Implements code changes from a converged plan |
| **Verifier** | Performs the independent double-audit after implementation |
| **Recorder** | Manages FID lifecycle and release tracking |
| **Thinker** | Performs deep sequential reasoning for complex problems |
| **Scout** | Explores files and code to gather context |
| **Researcher** | Performs web search, documentation lookup, and multi-query `deep_research` |
| **Scribe** | Captures session summaries and durable knowledge |
| **Adversary** | Meta-verification — refutes Verifier findings, re-audits unevidenced PASSes, resolves citations; verdicts override |

Infrastructure helpers such as terminal execution, browser automation, and web/docs tool libraries support these roles; they are not additional roster members.

### ECHO Protocol

Every code change follows the ECHO Perfection Loop:

1. **RED** — identify all failures and issues with evidence.
2. **GREEN** — implement minimal, surgical changes from the converged FID.
3. **AUDIT** — independently verify the implementation and call-graph reachability.
4. **ADVERSARIAL** — the Adversary refutes Verifier findings, re-audits
   unevidenced PASSes, and resolves citations; verdicts override.
5. **SELF-CORRECT** — resolve audit findings and repeat verification when needed.
6. **COMPLETE** — record evidence, update tracking, and close the work item.

No code is written without a converged plan, and the implementing agent cannot serve as the final verifier.

## Features

### Multi-agent orchestration

- Ten canonical agents coordinate through ECHO with explicit separation of duties.
- Child agents receive only their authorized tool subset through strict allowlist filtering.
- Parallel agent work supports exploration, research, implementation, and independent review.
- FID-bound execution keeps implementation tied to an approved specification.

### Thinker and sequential reasoning

The Thinker accumulates typed sequential reasoning steps and converges to a non-null final artifact containing status, synthesis, payload, metrics, and thoughts. Thinker cascades preserve prompt inheritance while keeping child tools restricted.

### Safe execution and tool-call hardening

- Fail-closed handling for incomplete, malformed, or truncated native tool calls.
- Strict tool schema validation with safe coercion of stringified numbers and booleans.
- Programmatic tool primitives with explicit authorization boundaries.
- Write-gate checkpoints capture files before `write_file`, `str_replace`, or `apply_patch` changes.
- Tool errors, cancellation, retry, and child-agent failures are surfaced rather than silently treated as success.

### Checkpoint and Rewind

Each user turn can persist the pre-edit content of every first-touched file, including subagent writes. `/rewind` supports:

- **Code only** — restore files while keeping the conversation.
- **Conversation only** — restore the transcript boundary without changing files.
- **Both** — restore code and conversation together.
- **Fork** — restore the selected turn into a fresh chat.

Retention is bounded to the most recent 20 turns, restore paths are revalidated, and terminal side effects are intentionally not rewound. No Git repository is required.

### Permissions and modes

- `--permission-mode safe|prompt|unsafe` selects the startup policy.
- `/permissions` (aliases `/sandbox` and `/safety`) views or changes the policy.
- `safe` denies risky tools; `prompt` currently also denies them because interactive confirmations are not yet implemented; `unsafe` allows them explicitly.
- `HYBRID`, `SCAFFOLD`, `STRICT`, and `ANALYZE` modes change the execution scope at runtime (hovering the toggle shows each mode's contract). `HYBRID` (default) is the frictionless flow: you write directly while the harness deterministically enforces Law 1/3 and the Verifier criteria at `warn`, and the full Perfection Loop auto-engages past the 20-line threshold. `STRICT` guarantees the full ceremony on **every** code change: Recorder creates a FID, RED (Detective) analyzes, GREEN (Forge) writes, AUDIT (Verifier) double-checks with Law-4 reachability greps, and Recorder archives the FID with a CHANGELOG entry. Use `STRICT` for security-sensitive or long-lived code (auth, payments, migrations); use `HYBRID` for day-to-day building and exploration.

### Planning, review, and goals

- `/interview` turns an underspecified idea into a structured specification.
- `/plan` creates an implementation plan.
- `/review` opens a focused code-review workflow.
- `/goal` defines a verifiable goal.
- `/loop` schedules recurring checks with cadence, run counts, and convergence detection.

### Context and project knowledge

- Four-layer progressive context compaction keeps large repositories within model limits.
- `knowledge.md` files provide durable project conventions and preferences.
- User-level knowledge can be loaded alongside project knowledge.
- OpenClaw-format `SKILL.md` files are discovered and exposed as native skills.
- MCP servers are discovered at startup and their tools are published to the model.
- The Researcher role ships a mechanical `deep_research` tool: multi-query web research
  with concurrency limits, URL dedup, domain scoring, citations, and graceful
  degradation (`incomplete` + gaps) — a pure search facade, no second LLM.
- A read-only `github` helper connects to the official GitHub MCP server
  (`SAVANT_CODE_GITHUB_TOKEN`) for PR/issue/CI review, code search, and secret scanning.
- A `database` helper exposes `list_tables`, `describe_table`, `execute_query`, and
  `analyze_query` over `bun:sqlite` with an adapter-enforced safety contract:
  read-only by default, LIMIT injection, SQL redaction, and destructive-DDL blocking.
- Browser automation supports `viewport` presets (mobile/tablet/desktop), an offline
  WCAG accessibility scan, and optional session persistence.
- Gateway model context lengths can be resolved from the live catalog.
- A harness-side ECHO compliance layer enforces Law 1 (read-before-write) and Law 3
  (verify-after-write) deterministically, mechanically flags the Verifier-criteria
  (10+ lines / 2+ files / new API / security-sensitive / Forge), and escalates when a
  write touches an active FID — non-blocking receipts plus corrective steering.

### Terminal UI

- Token-by-token streaming with cancellation and retry backoff.
- Universal copy actions for code blocks, tool output, and diffs.
- Light/dark themes with the Neon Slate aesthetic.
- Collapsible sidebar sections and FID cards.
- `@filename` and `@AgentName` autocomplete.
- Bash mode via `!command` or `/bash` with permission enforcement.
- Masked provider setup and health diagnostics.
- Telemetry consent controls through `/telemetry status|enable|disable`.
- Optional image attachments for multimodal providers.
- `/export` writes a fully self-contained branded HTML report of the conversation
  (offline fonts, collapsible tool rows, per-message and copy-all buttons).
- Edit diffs tint added lines 50% neon green and removed lines 50% neon red, with a
  `[-N/+M]` add/remove counter beside the copy button.

### SDK and runtime

The package ships the CLI on top of shared runtime and SDK capabilities:

- `SavantCodeClient` for running agents from Node.js, Bun, or browser applications.
- Streaming `RunState` events for progress, tool calls, diffs, and final output.
- Custom `AgentDefinition[]` agents and custom tool definitions.
- `AbortSignal` cancellation propagated through subagent streams.
- Checkpoint APIs (`openTurn`, `captureSnapshot`, `closeTurn`, `listTurns`, `restoreTurn`, and `forkFrom`).
- LLM-agnostic runtime with OpenAI-compatible, Anthropic, Ollama, and gateway provider shims.
- Per-call token counts and USD cost estimates surfaced in run state.

## Slash Command Reference

Commands can be entered with `/`; aliases are shown in parentheses.

| Command | Purpose |
| --- | --- |
| `/help` (`/h`, `/?`) | Show command help and tips |
| `/new` (`/clear`, `/reset`) | Start a fresh conversation |
| `/history` (`/chats`) | Browse and resume previous sessions |
| `/copy` (`/copy-chat`) | Copy the complete conversation to the clipboard |
| `/export` (`/save`) | Write a self-contained branded HTML report of the conversation |
| `/interview` | Create a structured specification |
| `/plan` | Create an implementation plan |
| `/review` | Review code changes |
| `/goal` (`/g`) | Iterate toward a verifiable goal |
| `/loop` (`/repeat`) | Schedule recurring checks; use `status` or `stop` |
| `/verify` (`/typecheck`) | Run all four core workspace typechecks or one selected workspace |
| `/permissions` (`/sandbox`, `/safety`) | View or set the tool permission mode |
| `/rewind` (`/undo`, `/checkpoint`) | Restore code and/or conversation from a prior turn |
| `/health` (`/status`, `/check`) | Check provider, Ollama, model, and permission status |
| `/diagnostics` (`/diag`, `/processes`) | Show local process and resource diagnostics |
| `/provider` | Configure a hosted provider key with masked input |
| `/mode` | List the four modes and their contracts, or switch: `/mode <name>` or `/mode:<name>` |
| `/model` | Select or switch the active model |
| `/publish` | Publish agent templates through the Savant backend |
| `/feedback` (`/bug`, `/report`) | Open the feedback flow |
| `/telemetry` (`/analytics`) | View or change remote analytics consent |
| `/theme:toggle` | Switch between light and dark themes |
| `/bash` (`!`) | Run a shell command or enter Bash mode |
| `/image` (`/img`, `/attach`) | Attach an image for supported multimodal models |
| `/init` | Create starter agent types and `knowledge.md` |
| `/login` / `/logout` | Authenticate or end the current session |
| `/exit` (`/quit`, `/q`) | Quit the CLI |

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

> Review my recent changes and flag security issues, performance problems, and style violations.

**Headless / scripting (FID-2026-0806-011):**

```bash
# Run a single prompt without the TUI and print the final answer to stdout
savant-code --print "summarize this repo"

# Pipe a prompt in — the CLI auto-enters headless mode
printf 'add a .gitignore\n' | savant-code
```

Exit codes: `0` success, `1` error or timeout, `2` usage error.
`SAVANT_CODE_RUN_TIMEOUT_MS` (default 10 minutes) bounds hung runs.

## Troubleshooting

### Permission errors

Use a user-writable Node/npm installation or, where appropriate, install globally with elevated permissions:

```bash
sudo npm install -g savant-code
```

### Corporate proxy or firewall

```bash
export HTTPS_PROXY=http://your-proxy-server:port
savant-code
```

### No model available

Run `/provider` to configure one of the hosted gateways, or install and start [Ollama](https://ollama.com) for local inference.

### Direct-provider mode cannot connect

Confirm that `DIRECT_PROVIDER`, `INFERENCE_BASE_URL`, and the selected credential are set in the same shell that launches Savant-Code. For OpenRouter, verify the precedence order above and use `/health` to inspect the active mode.

## Links

- **GitHub:** [github.com/savant0x/savant-code](https://github.com/savant0x/savant-code)
- **Documentation:** [savant-code.com/docs](https://savant-code.com/docs)
- **Issues:** [GitHub Issues](https://github.com/savant0x/savant-code/issues)
- **License:** [Apache 2.0](https://github.com/savant0x/savant-code/blob/main/LICENSE)

---

_Savant-Code is the public TypeScript monorepo for the Savant-Code agent framework._
