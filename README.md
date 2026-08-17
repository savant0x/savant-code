<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="assets/banner.png" alt="Savant-Code — Multi-Agent AI Coding Assistant" width="850" />

**A terminal-native AI coding assistant that audits every change before it
touches your repo.**

Built with TypeScript/Bun, governed by the ECHO Protocol, and designed for
local-first use with Ollama.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![OpenTUI](https://img.shields.io/badge/OpenTUI-0.5.3-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](https://github.com/anomalyco/opentui)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](ECHO.md)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![Release](https://img.shields.io/badge/Release-v0.0.24-%2300fbff?style=flat-square&logo=semver&logoColor=%2300fbff)](CHANGELOG.md)

</div>

> **v0.0.24** — this release ships the optimization and automation program
> (FIDs 003–010), the ECHO remediation package (FID-2026-0811-015..021), and
> the LEARNINGS feedback-system remediation (FID-2026-0811-022..029), plus
> four newer programs: Zero-Trust Agentic Provenance (FID-2026-0813-001..010),
> the homegrown Agent-Steering Teacher (FID-2026-0813-011..020 plus the live
> read-only sidebar surface `FID-2026-0813-022`, with a live `/learn` pipeline,
> ZTAP-signed attempt receipts, local progression persistence, and a read-only
> sidebar panel), the canonical version-bump tool (FID-2026-0813-021), and the
> harness observability & integrity remediation (`FID-2026-0813-023` — the
> `savantCode$1` rebrand-corruption repair, a live Trust Matrix with an honest
> empty-state, a reactive context meter with working auto-compact plus a
> compaction-status row, corrected Files Changed counters, and an operator
> help overlay).
>
> **Harness-speed remediation + grounding (FID-2026-0815-001..013):** the
> full harness-speed program — lazy per-step prompt formatting, an async trace
> writer, history-copy reduction, async checkpoint capture, single-pass
> compaction, a cached model catalog with async registry I/O, UI no-op guards,
> and parallel code-map/knowledge-graph indexing (findings F-01…F-12) — plus
> three follow-on hot-path sweeps (FID-2026-0815-011..013: one system-prompt
> tokenization per step, deferred trace serialization, a strict-only
> `existsSync` probe, a bounded read-pattern scan, a trimmed per-step debug
> payload, and no eager full-history copy). Also closes the agent grounding
> gap: `formatCurrentDateTime()` now injects the correct **current date and
> time** (weekday + timezone) and refreshes it every step, so the agent never
> derives the wrong weekday from a bare date.
>
> **Universal session-init grounding (FID-2026-0810-002):** every session boots
> with a deterministic grounding ritual — the harness protocol and grounding
> files are read local-first, with the **full harness grounding set embedded in
> the runtime** as a fallback, so npm-installed copies in any project boot
> (no crash, no scaffolding). The boot reads are enforced in every mode
> (HYBRID, STRICT, ANALYZE, SCAFFOLD, PLAN, DEFAULT) via a universal tool gate
> and a first-turn completion gate, and the embedded copies are generated from
> the repo files with a drift check that fails validation if they fall out of
> sync.
>
> The prior unified provider registry remains historical ground truth; this
> build adds drift detection without changing provider routing. The **unified
> provider registry** makes `common`'s typed
> `PROVIDER_REGISTRY` the single source of truth for every provider surface
> (routing, credentials, `/provider` setup, picker sections, model catalogs,
> generated docs — adding a provider is now one registry entry, see
> `docs/design/Adding New Providers.md`), with a single `activeProvider`
> setting and automatic migration from the legacy `directProvider`. The
> **release system is fully hardened**: a zero-command, token-native,
> reversible release engine (`release:public`, opt-in automation via
> `SAVANT_CODE_RELEASE_AUTOMATION=1`) with deterministic gates
> (frozen-lockfile, build, typecheck, test, eslint, markdownlint, prettier,
> npm-pack dry-runs), receipt-bound resume, and **binary-asset verification**
> — the 5-platform build workflow now fails loudly if a release ships without
> all of its tarballs (FID-2026-0809-002).

---

## Get Started in 30 Seconds

```bash
# Install the CLI (npm i savant-code -g is the short form)
npm install -g savant-code

# Run it. If Ollama is running, it will auto-detect and use it.
savant-code
```

Published as [`savant-code` on npm](https://www.npmjs.com/package/savant-code).

_A terminal demo video is not yet available; the landing page and CLI source
links below describe the currently verified workflow._

No Ollama yet?

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh
ollama serve

# Windows: https://ollama.com/download/windows
```

Then run `savant-code` again, or type `/health` inside the chat to verify the
connection.

If Ollama is not running, configure a hosted provider before sending a prompt.
The CLI **boots to OpenRouter by default** (`openrouter/free` free tier) — set a
key and you are ready:

```text
/provider openrouter
```

You can also enter `/provider` to choose from the interactive picker. Paste the
key into the masked prompt; it is stored globally and is never added to chat
history. The supported hosted providers are:

| Provider | Command | Environment variable | Notes |
| --- | --- | --- | --- |
| Ollama | automatic detection | — | Local inference; no API key required |
| OpenRouter | `/provider openrouter` or `DIRECT_PROVIDER=openrouter` | `OR_MASTER_KEY`, `OPENROUTER_API_KEY`, or `INFERENCE_API_KEY` | **Default provider**; free tier (`openrouter/free`) is the boot default; master key, regular key, then inference key precedence |
| OpenCode Go | `/provider opencode-go` | `OPENCODE_GO_API_KEY` | Hosted gateway |
| TokenRouter | `/provider tokenrouter` | `TOKENROUTER_API_KEY` | Multi-provider gateway |
| TokenHarbor | `/provider tokenharbor` | `TOKENHARBOR_API_KEY` | OpenAI-compatible gateway at `https://tokenharbor.ai/v1` |
| NVIDIA NIM | `/provider nvidia` | `NVIDIA_API_KEY` | NVIDIA-hosted inference |
| CommandCode | `/provider commandcode` | `COMMAND_CODE_API_KEY` | OpenAI-compatible hosted inference |
| Nous Research | `/provider nous` | `NOUS_API_KEY` | OpenAI-compatible direct inference; Portal OAuth is separate |

The key is persisted at
`C:\\Users\\<username>\\.savant-code\\credentials.json` on Windows or
`~/.savant-code/credentials.json` on macOS/Linux. Environment variables take
precedence over saved credentials. For automation, set one provider key before
launching Savant-Code:

```powershell
# PowerShell — choose one provider key (OpenRouter is the boot default)
$env:OPENROUTER_API_KEY = "your-key"
# $env:OPENCODE_GO_API_KEY = "your-key"
# $env:TOKENROUTER_API_KEY = "your-key"
# $env:TOKENHARBOR_API_KEY = "your-key"
# $env:NVIDIA_API_KEY = "your-key"
# $env:COMMAND_CODE_API_KEY = "your-key"
# $env:NOUS_API_KEY = "your-key"
savant-code
```

```cmd
:: Command Prompt — choose one provider key (OpenRouter is the boot default)
set OPENROUTER_API_KEY=your-key
:: set OPENCODE_GO_API_KEY=your-key
:: set TOKENROUTER_API_KEY=your-key
:: set TOKENHARBOR_API_KEY=your-key
:: set NVIDIA_API_KEY=your-key
:: set COMMAND_CODE_API_KEY=your-key
:: set NOUS_API_KEY=your-key
savant-code
```

```bash
# macOS/Linux — choose one provider key (OpenRouter is the boot default)
export OPENROUTER_API_KEY="your-key"
# export OPENCODE_GO_API_KEY="your-key"
# export TOKENROUTER_API_KEY="your-key"
# export TOKENHARBOR_API_KEY="your-key"
# export NVIDIA_API_KEY="your-key"
# export COMMAND_CODE_API_KEY="your-key"
# export NOUS_API_KEY="your-key"
savant-code
```

### OpenRouter direct mode

OpenRouter is the **default boot provider** (free tier `openrouter/free`); any
`openrouter/` model slug routes to `https://openrouter.ai/api/v1` with the
resolved key. To bypass the Savant Code backend and route inference directly to
OpenRouter, set:

```bash
export DIRECT_PROVIDER=openrouter
export INFERENCE_BASE_URL=https://openrouter.ai/api/v1
```

OpenRouter key resolution is ordered as follows:

1. `OR_MASTER_KEY` — exchanges for a regular key through OpenRouter `/api/v1/keys`.
2. `OPENROUTER_API_KEY` — uses an existing regular OpenRouter key directly.
3. `INFERENCE_API_KEY` — uses the SDK-specific inference key.

Advanced Cloudflare Workers AI integrations use `CLOUDFLARE_API_TOKEN` together
with `CLOUDFLARE_ACCOUNT_ID`. Nous Research uses `/provider nous` or
`NOUS_API_KEY` for direct OpenAI-compatible inference; Nous Portal OAuth is a
separate integration and is not part of this provider. Ordinary CLI users should
use `/provider` or one of the provider-specific keys above. Do not create a project-local `.env`
file or edit `credentials.json` manually.

---

## Overview

Savant-Code is a TypeScript monorepo that builds and ships the terminal-native
AI coding assistant **Savant Code** and the public
[`@savant-code/sdk`](https://www.npmjs.com/package/@savant-code/sdk). The CLI
provides multi-agent orchestration, custom skills, MCP tool discovery, mode
switching (`HYBRID` / `SCAFFOLD` / `STRICT` / `ANALYZE`), and local-first Ollama
support. The
SDK, agent runtime, multi-agent orchestration engine, tool layer, and LLM
provider shims are shared so both surfaces ship from one codebase.

The whole project ships under [ECHO Protocol v0.2.0](ECHO.md) — the same 15-law
agent discipline that governs the Savant ecosystem. Every change goes through
the RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE Perfection
Loop FSM, with a hard 10-iteration cap and a 10% Levenshtein change-cap per
pass.

---

## Key Technologies

| Layer           | Tech                              | Version                                           |
| --------------- | --------------------------------- | ------------------------------------------------- |
| Runtime         | Bun                               | 1.3.14 (engines `>=1.3.11`)                       |
| Language        | TypeScript                        | 5.5.4 (`strict: true`, `noImplicitReturns: true`) |
| TUI             | OpenTUI + React 19                | `@opentui/core` 0.5.3, `react` ^19.0.0            |
| State           | Zustand + Immer                   | zustand ^5.0.8, immer ^10.1.3                     |
| Validation      | Zod                               | ^4.2.1                                            |
| LLM SDK         | Vercel AI SDK                     | `ai` ^5.0.52 + `@ai-sdk/anthropic` 2.0.50         |
| MCP             | Model Context Protocol            | `@modelcontextprotocol/sdk` ^1.18.2               |
| Code parsing    | tree-sitter (WASM)                | `@vscode/tree-sitter-wasm` 0.1.4                  |
| HTTP / WS       | ws, node-fetch, custom SDK client | ws ^8.18.0                                        |
| Package manager | Bun workspaces (hoisted)          | `bunfig.toml` `[install] linker = "hoisted"`      |

---

## Features

### CLI (`@savant-code/cli`)

- **Multi-agent orchestration** — 10 specialized agents coordinate via ECHO
  Protocol: Detective finds issues, Forge implements, Verifier audits, Adversary
  refutes the audit, Recorder manages FIDs, Thinker reasons, Scout explores,
  Researcher investigates, Scribe documents.
- **Thinker with sequential thinking** — the Thinker agent accumulates stacked
  reasoning steps via `sequentialthinking`, converges to a typed non-null
  `FinalArtifact` (status/synthesis/payload/metrics/thoughts), and never returns
  a null or empty result.
- **Native tool-call hardening** — fail-closed streaming boundary for
  incomplete/malformed/truncated tool calls; stale-fragment replacement for
  placeholder arguments; permissive coercion of stringified numbers/booleans
  before strict Zod validation.
- **Tool permission boundary** — strict allowlist-based tool provisioning via
  `filterToolSet`; restricted agents (Thinker, Scout) never receive parent-only
  tools; executor authorization unchanged.
- **`/init` command** — scaffolds
  `.agents/types/{agent-definition,tools,util-types}.ts` and a starter
  `knowledge.md`.
- **Slash commands** — `/new`, `/history`, `/bash`, `/goal`, `/loop`,
  `/feedback`, `/rewind`, `/theme:toggle`, `/login`, `/logout`, `/exit`, plus
  agent-specific commands.
- **Provider setup** — `/provider` opens an interactive dropdown picker showing
  all providers with ✓/✗ configuration status. Select a provider to enter its
  API key (masked input). Keys stored in local `credentials.json`.
- **Telemetry controls** — `/telemetry status|enable|disable` toggles remote
  analytics and error reporting. Remote analytics is enabled by default in the
  main CLI but remains user-disableable; local logs remain available when it is
  disabled. Contextual ads are separate: ads are disabled by default in the
  main CLI and can be controlled independently where available.
- **`@filename` and `@AgentName` mentions** — file and agent mentions with
  inline autocomplete.
- **Bash mode** — `!command` or `/bash` to run shell commands inline (with
  confirmation).
- **Permission and sandbox controls** — `--permission-mode safe|prompt|unsafe`
  sets the startup policy, while `/permissions` (aliases `/sandbox` and
  `/safety`) shows or changes it during a session. `safe` denies risky tools;
  `prompt` currently also denies risky tools because interactive confirmations
  are not yet implemented, and `unsafe` allows them
  explicitly. Use `unsafe` only when you understand the command risk.
- **Durable budgeted goal mode** — `/goal <objective> [--budget tokens=N turns=N
time=MS]` starts a durable, budgeted goal run: an event-sourced goal state
machine (`active | paused | blocked | complete`) with token/turn/wall-clock
budgets and a runtime continuation driver that runs goal turns until the model
verifies completion (`update-goal`), blocks on a genuine impasse, or a budget
is exhausted. Goal text is injected as `<untrusted_objective>` (data, never
instructions); `/goal status|pause|resume|cancel` manage the record and the
sidebar shows live goal + budget consumption.
- **Goal loop** — `/loop <cadence>` schedules recurring prompt execution (e.g.,
  `/loop 5m check build status`). The loop scheduler manages cadence, run
  counts, and convergence detection.
- **Extensible hook system** — a project-scoped `hooks:` block in
  `protocol.config.yaml` runs external commands (or internal callbacks) at the
tool-executor lifecycle (`PreToolUse`/`PostToolUse`/`PostToolUseFailure` plus
session/subagent events). Hooks compose with the EHEL gate (an additional
gate, never a bypass) and fail open: only an explicit `deny` decision or exit
code 2 blocks a tool.
- **Structured planning and review** — `/interview` turns an underspecified
  request into a structured specification, `/plan` creates an implementation
  plan, and `/review` opens a focused code-review workflow.
- **In-chat verification** — `/verify` runs the four supported core workspace
  typechecks, or target one with `/verify sdk`, `/verify common`,
  `/verify agent-runtime`, or `/verify cli`. `/diagnostics` reports local
  process/resource information.
- **Conversation utilities** — `/copy` (alias `/copy-chat`) copies the full
  conversation to the clipboard, `/export` (alias `/save`) writes a fully
  self-contained branded HTML report of the conversation to disk, while `/image`
  (aliases `/img` and `/attach`) attaches an image when the selected provider
  supports multimodal input.
- **Agent publishing** — `/publish` opens the agent publishing flow for
  templates with the required publisher metadata. It requires the Savant Code
  backend rather than direct-provider mode.
- **Mode switching** — `HYBRID` / `SCAFFOLD` / `STRICT` / `ANALYZE` execution-scope
  modes with hover descriptions, togglable at runtime via UI. See
  [Execution Modes](#execution-modes) for the STRICT-vs-HYBRID ceremony contract.
- **Streaming & cancellation** — token-by-token SSE streaming with mid-stream
  cancellation, retry-with-backoff, and subagent streaming for parallel work.
- **Knowledge files** — project-level `knowledge.md` plus per-user home-dir
  knowledge, auto-loaded into agent context.
- **Skills** — OpenClaw-format `SKILL.md` files discovered at startup, schemas
  sent to the LLM, available as native tools.
- **Loadable design-system library** — the offline `savant-design-systems` skill
  ships 74 approximately 2 MB presets with deterministic manifests and provenance.
  Use `/design list`, `/design use <id>`, `/design current`, `/design create`,
  `/design edit`, `/design import`, `/design validate`, `/design drafts`,
  `/design resume`, `/design discard`, and `/design reset`; only the active
  contract enters agent context. Custom systems are validated, versioned, reloadable,
  and scanned at the EHEL write boundary. Headless authoring accepts
  `--design-input <path|->`. See the [design-system library guide](docs/design/design-system-library.md)
  for the architecture, authoring lifecycle, security model, persistence contract,
  enforcement behavior, and packaging evidence. For live usability, agent-feedback,
  and latency validation, run the [design-system live test prompt](dev/test-prompts/design-system-live-ux-performance.md).
  For a complete regression across the current feature domains, run the
  [v0.0.24 harness A–Z live-test prompt](dev/test-prompts/az-v0.0.24-harness-live-test.md), which writes an
  evidence report to `dev/scratchpad/az-v0.0.24-harness-live-test-report.md`.
- **MCP tools** — Model Context Protocol servers discovered at startup, schemas
  published to the LLM API.
- **`deep_research` tool** — the Researcher role's mechanical multi-query web
  research tool (`question` + model-supplied `queries[]`, `research_depth`,
  `max_sources`): max-3 concurrency, ≥1s query stagger, URL dedup, domain
  scoring, citations + gaps + `truncated`/`incomplete` flags. Pure search
  facade over the harness web-search API — no second LLM (FID-2026-0804-002).
- **`github` infra helper** — read-only GitHub integration (PR/issue/CI review,
  code search, secret scanning) via the official remote-HTTP MCP server, with
  `Authorization: Bearer $SAVANT_CODE_GITHUB_TOKEN` interpolation
  (FID-2026-0804-003).
- **`database` infra helper + 4 native tools** — `list_tables`, `describe_table`,
  `execute_query`, `analyze_query` over `bun:sqlite` with an adapter-enforced
  safety contract: read-only default, LIMIT injection, SQL redaction,
  destructive-DDL block, JSON-safe BLOB/bigint coercion (FID-2026-0804-004).
- **Browser-use param upgrades** — `viewport` (mobile/tablet/desktop),
  `wcag` (offline DOM-walk accessibility scan, no CDN), and `persistSession`
  (default OFF) on the browser automation helper (FID-2026-0804-005).
- **Self-contained `/export`** — writes the whole conversation to a branded,
  offline HTML report (Savant logo + Neon Slate theme + Font Awesome inlined as
  base64; zero network requests) with collapsible tool/thinking rows and
  per-message / copy-all buttons (FID-2026-0804-007).
- **Codebase knowledge graph** — deterministic, incremental, SQLite-backed
  graph built on `packages/code-map` (tree-sitter) with sha256 diffing,
  `IMPORTS`/`CALLS`/`EXTENDS` edges, and seeded Louvain domain clustering.
  `/graph refresh` re-indexes on demand; Detective/Scout query blast radius,
  node edges, and domain clusters via read-only native tools; the Verifier's
  Law 4 reachability check is harness-computed and injected into its message
  history (zero-tool contract unchanged); `/graph-export` writes a branded,
  fully-offline interactive HTML report reusing the `/export` design system
  (FID-2026-0806-002).
- **ECHO Harness Enforcement Layer (EHEL)** — structural enforcement of all
  15 ECHO laws at the tool-executor level. Pre-write gates block violations
  before they happen (Law 1: read-before-touch, Law 3: verify-before-proceed,
  Law 7: search-before-create, Law 8: log-intent, FID Recorder gate with
  20-line threshold). Post-write scanners batched at turn end (Laws 5, 6, 9,
  10, 12, 14, 15). Law 4 call-graph reachability at turn end. FID completeness
  validator with mandatory Unanswered Questions. Mode-driven: **Hybrid** =
  Laws 1-4 blocking + Laws 5-15 advisory; **Strict** = all 15 blocking.
  Only 2 agents have write tools (Orchestrator + Recorder). Emergency bypass:
  agent requests, user confirms (FID-2026-0805-007).
- **Harness ECHO compliance layer** — deterministic Law 1 (read-before-write),
  Law 3 (verify-after-write), and mechanical Verifier-criteria enforcement
  (10+ lines / 2+ files / new API / security-sensitive / Forge) via a per-run
  runtime tracker: non-blocking `compliance_warning` receipts plus corrective
  steering so the running agent self-corrects, escalated to always-on when a
  write touches an active FID (FID-2026-0804-009).
- **Zero-Trust Agentic Provenance (ZTAP)** — optional, hash-only, per-role
  Ed25519-signed write receipts at the native write boundary; append-only
  session ledgers; signed Verifier/Adversary verdict bindings; `/attest` offline
  JSON and HTML receipts; an independent clean-process validator; and a
  read-only live Trust Matrix. Configure `provenance.mode` as `off`, `record`
  (default), or `enforce`. ZTAP proves recorded mechanical process and its
  integrity, not LLM independence. See the [ZTAP feature guide](docs/design/zero-trust-agentic-provenance.md).
- **Agent-Steering Teacher (`/learn`)** — a local-first way to practice
  directing and reviewing an AI coding agent. `/learn start <steering>` drives a
  live exercise: the steering constraint goes to a read-only teacher-forge
  agent, the produced solution runs in a capability-sandboxed subprocess, and
  behavior-first equivalence + deterministic mutation-detection graders review
  it before you submit a critique of a seeded defect. Versioned local
  progression is recorded with an honest ZTAP process-evidence receipt and
  surfaced via `/learn progress` and a live, read-only sidebar panel. See the
  [teacher guide](docs/design/agent-steering-teacher-guide.md).
- **Readable edit diffs** — edit blocks tint added lines 50% neon green and
  removed lines 50% neon red (blended against the theme background) and show a
  `[-N/+M]` add/remove counter beside the copy button; the full ECHO Perfection
  Loop now triggers at 20 lines instead of 75 (FID-2026-0804-010).
- **Context compaction** — 4-layer progressive auto-compaction: L0 (summarize
  old turns), L1 (compress tool results), L2 (prune stale context), L3
  (aggressive reduction). Preserves critical context while reducing token usage.
  A live in-stream signal (`⚙ Compacting context…` → `✓ Compaction complete
  (−N tokens)`) and a window-consistent sidebar `Compaction` row give real-time
  visual feedback instead of silent compaction.
- **Context window resolution** — gateway models (e.g. `opencode-go/mimo-v2.5`)
  resolve their real context length from the OpenRouter catalog at runtime.
- **Universal copy buttons** — hover-to-copy on code blocks, tool outputs, and
  file diffs throughout the TUI.
- **Gateway providers** — TokenRouter, TokenHarbor, NVIDIA NIM, OpenCode Go, CommandCode,
  Nous Research, and Cloudflare Workers AI via `@savant-code/llm-providers`. Nous Research
  uses the direct OpenAI-compatible API; Portal OAuth is a separate integration.
- **Default model** — `openrouter/free` via OpenRouter (configurable via
  `/model`). One model project-wide: the model selected in the UI panel is the
  only model used — main chat agent, teacher-forge, headless runs, and spawned
  subagents all resolve the operator's active model (never a hardcoded paid
  fallback).
- **Headless / non-interactive mode** — `savant-code --print "<prompt>"` runs a
  single prompt without the TUI and prints the final answer to stdout. Exit
  codes: `0` success, `1` error or timeout, `2` usage error. When stdin is piped
  or the environment is CI, the CLI auto-enters headless mode and uses stdin as
  the prompt. `SAVANT_CODE_RUN_TIMEOUT_MS` (default 10 minutes) bounds hung
  runs (FID-2026-0806-011).
- **Consent-gated auto-update** — the launcher never stops a running session:
  a newer version is staged and applied on the next launch after a y/N
  prompt. `SAVANT_CODE_NO_AUTO_UPDATE=1` opts out entirely (FID-2026-0806-014).
- **Theming** — light/dark toggle (`/theme:toggle`), Neon Slate aesthetic.
- **Sidebar folding** — right-sidebar sections and FID cards start collapsed
  for a compact first render; click to expand.
- **Full command surface** — the primary slash-command families are documented
  in the reference below; advanced commands remain available through the
  registry and autocomplete.
- **Checkpoint & Rewind** — one persistent checkpoint per user turn records the
  pre-edit content of every file first touched (including subagent writes) plus
  the conversation boundary; `/rewind` opens a picker to restore **code only**,
  **conversation only**, **both**, or **fork a new session** from an earlier
  turn — no git required. Retention is bounded to the most recent 20 turns,
  and terminal side effects are never rewound.

---

## Export Workflows: Conversation Reports and Code Universe

Savant-Code has **two separate export features**. They create different HTML
artifacts for different jobs:

| Command | What it exports | Use it when |
| --- | --- | --- |
| `/export` (alias `/save`) | The current chat transcript | You want to preserve or share the agent session, tool calls, edits, and final answer |
| `/graph-export` (aliases `/graph:export`, `/gexport`) | The indexed repository as an interactive Code Universe | You want to explore, present, or share a visual offline snapshot of the codebase |

Both reports are self-contained branded HTML files. They can be opened directly
from `file://` without a hosted service, local web server, project checkout, or
runtime API connection.

### `/export`: save the conversation

`/export` is a **session report**, not a plain-text dump. It captures the
current conversation with the character logo, Neon Slate styling, session
metadata, user/Savant/error rows, rendered Markdown, tool inputs and outputs,
nested subagent blocks, plans, thinking sections, ask-user answers, and
attachment notes. Tool and reasoning details remain collapsible, while each
message has a **Copy** action and the header provides **Expand all**,
**Collapse all**, and **Copy all** controls.

```text
/export
/save
/export reports/session-review.html
```

`/save` is an alias. Without a custom path, the CLI creates and reuses this
single rotating file:

```text
dev/exports/conversation/savant-export.html
```

Relative paths resolve from the current working directory; absolute paths are
honored. The command reports the message count, resolved output path, and
artifact size after a successful write. An empty conversation produces a
system message and no file; filesystem errors are reported in the chat.

The report HTML is escaped and self-contained. Font Awesome CSS/webfonts are
inlined, and clipboard actions use a secure Clipboard API when available with a
`file://`-compatible fallback otherwise. The report does not re-run tools,
reconnect to a provider, or update when the repository changes. It is a static
record of the decision trail: what was asked, what the agent did, which files
changed, and what the final answer was.

![Savant Code conversation export](assets/export.png)

The screenshot shows the local report's branded header, session metadata,
global expand/collapse/copy controls, transcript rows, collapsible execution
blocks, and per-message copy affordances. The exact session ID, timestamp,
message count, and content vary for each export. See the full
[conversation export guide](docs/code-universe-export.md#conversation-export-export)
for the detailed rendering, safety, and sharing notes.

The three visuals below are intentionally for `/graph-export`, not the
conversation transcript report.

### `/graph-export`: explore the offline Code Universe

`/graph-export` is a **repository report**, not a conversation transcript. It
serializes the local knowledge graph into a spatial, interactive HTML browser
called the Code Universe.

First build or refresh the structural index:

```text
/graph refresh
/graph refresh --full
```

The first refresh builds `.savant/graph.db`; later refreshes hash-compare files
and re-parse only changed files. The database is regenerable, Git-ignored, and
not itself shipped in the report.

Then generate the report:

```text
/graph-export
/graph:export
/gexport
/graph-export reports/code-universe.html
```

The default output is a single rotating file at
`dev/exports/graph/savant-graph.html`. A custom relative or absolute path is
honored. During a larger export, the CLI shows stages for index refresh,
graph serialization, layout, document embedding, compression, HTML assembly,
and file writing instead of appearing frozen.

#### What the Code Universe includes

- **Universe view:** a Sigma.js/Graphology WebGL canvas for systems, files,
  corridors, clusters, ambient space effects, and the Savant character mark.
- **Ranked search:** search paths, systems, folders, and files using an
  export-time index; results appear below the search field and support mouse and
  keyboard selection.
- **Drill-down navigation:** expand the systems sidebar into nested folders and
  files, open a folder in the center browser, or select a file directly.
- **Document viewer:** open embedded text documents, validated raster images, or
  a clear unavailable/binary fallback without reading from disk after export.
- **Details and connections:** inspect paths, metadata, clusters, directions,
  edge types, related objects, and copyable full paths.
- **Window controls:** drag panels, minimize them to a taskbar-style dock,
  maximize, restore, or close them independently.
- **Document controls:** copy text, toggle line wrapping, inspect bracketed
  line/byte metadata, use breadcrumbs, and move through previous/next sibling
  files.
- **Offline behavior:** Sigma.js, Graphology, fonts, icons, branding, graph
  data, and enabled document payloads are embedded; no CDN or runtime network
  request is required.

#### Code Universe visual tour

The universe overview turns systems and file relationships into a navigable map.
Select a system to enter its orbit, use search to jump to a path, or expand the
left navigation tree to drill down into folders.

![Savant Code Universe overview](assets/universe-1.png)

Raster documents open inside the same branded viewer. Supported PNG, JPEG, GIF,
and WebP files are validated before embedding; unsupported, malformed, or unsafe
media receives an explicit fallback instead of being silently misrepresented.

![Code Universe image document viewer](assets/universe-img.png)

Text documents open with readable source presentation, path breadcrumbs, line
and byte metadata, copy support, wrapping controls, and sibling-file navigation.
The source is embedded in the report, so the viewer remains useful offline.

![Code Universe text document viewer](assets/universe-text.png)

#### Document and privacy model

The graph index stores structural metadata—paths, symbols, hashes, edge types,
and clusters—not a live server or an external copy of the repository. The HTML
report is a snapshot and should be regenerated after source changes.

Text documents are embedded by default for the graph report. Positive limits can
be supplied for smaller artifacts; binary content and unsupported media remain
protected by format, signature, containment, and media-size checks. Useful
controls include:

```text
SAVANT_GRAPH_EXPORT_DOCUMENTS=0
SAVANT_GRAPH_EXPORT_NO_PREVIEW=1
SAVANT_GRAPH_EXPORT_PREVIEWS=1
SAVANT_GRAPH_EXPORT_DOCUMENT_LINES=<positive integer>
SAVANT_GRAPH_EXPORT_DOCUMENT_BYTES=<positive integer>
SAVANT_GRAPH_EXPORT_DOCUMENT_IMAGE_BYTES=<positive integer>
SAVANT_GRAPH_EXPORT_TOTAL_TEXT_BYTES=<positive integer>
SAVANT_GRAPH_EXPORT_TOTAL_MEDIA_BYTES=<positive integer>
```

`SAVANT_GRAPH_EXPORT_DOCUMENTS=0` disables document bodies. Previews are off by
default; `SAVANT_GRAPH_EXPORT_PREVIEWS=1` opts into small details-panel previews,
while `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` is the hard-off switch. The remaining
variables apply positive per-file or aggregate caps. A document that cannot be
read safely is represented as unavailable rather than replaced with misleading
content.

Use **`/export`** for the conversation and **`/graph-export`** for the repository.
They work well together: the first preserves the reasoning and implementation
trail, while the second preserves the visual codebase artifact that the session
examined. See the full [Export Workflows guide](docs/code-universe-export.md)
for detailed usage, troubleshooting, and the offline architecture.

### SDK (`@savant-code/sdk`)

- **`SavantCodeClient` class** — single entry point for running agents from any
  Node.js / Bun / browser app.
- **Streaming events** — `handleEvent` callback receives `RunState` updates,
  tool calls, file diffs, and final output.
- **Custom agents** — pass `agentDefinitions: AgentDefinition[]` to override
  defaults.
- **Custom tools** — pass `customToolDefinitions` to extend the tool registry.
- **Cancellation** — `AbortSignal` propagates through subagent streams.
- **Checkpoint API** — the persistent checkpoint store (`openTurn`,
  `captureSnapshot`, `closeTurn`, `listTurns`, `restoreTurn`, `forkFrom`) is
  re-exported from the SDK, so hosts can checkpoint and rewind any run;
  `checkpointDir`/`checkpointTurnId` run options thread the turn boundary into
  subagent writes.

### Agent Runtime (`@savant-code/agent-runtime`)

- **LLM-agnostic** — calls any provider registered with
  `@savant-code/llm-providers` (OpenAI-compatible chat, Anthropic, etc.).
- **Multi-step loop** — model decides tool → tool executes → result fed back →
  repeat until `end_turn` or budget exhausted.
- **Tool registry** — built-in (`read_files`, `write_file`,
  `run_terminal_command`, `code_search`, `web_search`, `spawn_agents_inline`,
  …) + custom + MCP.
- **Cost aggregation** — per-call token counts and USD cost estimates surfaced
  in `RunState`.
- **Turn checkpoints** — the write-gate in `executeToolCall` captures
  pre-edit content before `write_file`/`str_replace`/`apply_patch` dispatch;
  subagent writes inherit the parent turn via spawn context.

### ECHO Protocol Integration

- **10 specialized agents** — Orchestrator, Detective, Forge, Verifier, Adversary,
  Recorder, Thinker, Scout, Researcher, Scribe
- **FID-Bound Execution** — Code is never written until the FID converges
- **Perfection Loop FSM** — RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE
- **Separation of Duties** — The agent that writes code cannot verify it
- **15 Laws** — 4 immutable process + 11 extended code laws

---

## Execution Modes

The mode toggle (bottom-left of the chat) sets the **execution scope** for the
current session. Modes are switchable at runtime from the UI or with the `/mode` slash
commands — the bare form lists every mode and its contract, while `/mode <name>`
or `/mode:<name>` switches (e.g. `/mode strict`); hovering the toggle shows each
mode's one-line contract.

| Mode | Agent | Contract |
| --- | --- | --- |
| `HYBRID` (default) | `savant` | Direct, low-friction writing bounded by the harness: deterministic Law 1/3 + Verifier-criteria receipts at `warn`, with the full Perfection Loop auto-escalating past the 20-line ceremony threshold (FID-2026-0804-009/010). |
| `SCAFFOLD` | `savant-scaffold` | Umbrella-FID project initialization; scaffolds once, then hands back to HYBRID. |
| `STRICT` | `savant-strict` | Full ECHO ceremony for **every** code change — FID per change, Forge writes, Verifier audits, Law-4 greps. |
| `ANALYZE` | `savant-analyze` | Read-only: search, inspect, and reason without writing files. |

### STRICT mode: the full ceremony, on every change

`STRICT` is the guaranteed-ceremony mode. Where `HYBRID` *allows* the agent to
escalate to the full loop (and the harness *warns* when the criteria are met),
`STRICT` *requires* it for every code change. Enforcement is the STRICT prompt
contract itself — the harness compliance layer watches alongside it and emits
`warn`-level receipts when a criterion is missed (hard blocking is deferred
future work). In STRICT, the prompt contract mandates, for each change:

1. **Recorder creates a FID** for the change
   (`dev/fids/FID-YYYY-MMDD-NNN-{title}.md`), tracked automatically in the
   sidebar's Active FIDs panel.
2. **RED (Detective)** analyzes the codebase and converges the change plan.
3. **GREEN (Forge)** writes the code — the only agent allowed to write during a
   ceremony pass.
4. **AUDIT (Verifier)** double-audits the result: run the tests, check the call
   graph, and Law-4 reachability greps (grep the production entry points to
   prove the new wiring is actually called).
5. **Recorder archives** the FID and appends the CHANGELOG entry.

No self-verification and no phase-skipping: the agent that writes code cannot
verify it. Pure read-only Q&A (questions, explanations, analysis with no file
writes) stays ceremony-free even in STRICT.

### STRICT vs HYBRID: which should I use?

| Consideration | `HYBRID` | `STRICT` |
| --- | --- | --- |
| Speed | Fastest — write freely; the full loop auto-engages past 20 lines | Slower — every change pays the full loop |
| Friction | Minimal — the harness warns + steers, never blocks | Maximal — ceremony is required, not optional |
| Audit trail | FIDs only for escalated changes | A FID per change, archived with a CHANGELOG entry |
| Verification | Harness receipts at `warn` + self-escalation past 20 lines | Verifier + Law-4 greps on every change |
| Best for | Day-to-day building, exploration, prototypes, quick iterations | Security-sensitive or long-lived code, paid-API surfaces, team review, anything needing a durable audit trail |

**Rule of thumb:** if a change would hurt to get wrong — auth, payments,
migrations, anything shipping to users — use `STRICT`. If you are exploring or
iterating quickly, `HYBRID` is the right default: the harness still watches Law
1/3 and the Verifier criteria, and the full loop still engages past the 20-line
threshold.

---

## Repo Map

<!-- markdownlint-disable MD013 MD060 -->

| Workspace                 | Package                      | Purpose                                                           |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `agents/`                 | `@savant-code/agents`        | Public agent definitions shipped with the CLI                     |
| `cli/`                    | `@savant-code/cli`           | CLI source — UI, commands, state, hooks, OpenTUI/React components |
| `common/`                 | `@savant-code/common`        | Shared types, tool definitions, utilities                         |
| `evals/`                  | `@savant-code/evals`         | ECHO-native benchmark v2 runner + legacy eval fixtures            |
| `packages/agent-runtime/` | `@savant-code/agent-runtime` | Agent loop, tool executor, LLM API integration                    |
| `packages/code-map/`      | `@savant-code/code-map`      | tree-sitter code indexing, language detection                     |
| `packages/database/`      | `@savant-code/database`      | Database abstraction layer                                        |
| `packages/knowledge-graph/` | `@savant-code/knowledge-graph` | Deterministic codebase knowledge-graph engine (indexer, queries, clustering, export serializer) |
| `packages/llm-providers/` | `@savant-code/llm-providers` | Public LLM provider shims                                         |
| `sdk/`                    | `@savant-code/sdk`           | Public SDK — `SavantCodeClient`, types, build + verify scripts    |
| `scripts/tmux/`           | `@savant-code/tmux`          | tmux CLI helpers used in interactive test runs                    |

<!-- markdownlint-enable MD013 MD060 -->

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
# Run the CLI in dev mode
bun run dev

# Or run with a specific permission mode
bun run dev -- --permission-mode safe
```

### 3. Build for Release

```bash
# Build the SDK
bun run build:sdk

# Build the CLI binary from the CLI workspace
bun run --cwd=cli build:binary
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
# npm
npm install -g savant-code
```

### 6. Use with local Ollama (zero API key)

If you have [Ollama](https://ollama.com/) installed and running, Savant Code
auto-detects it on first launch and routes inference to your local daemon — no
API key, no account, no prompts.

```bash
# Start Ollama in the background, then run the CLI
ollama serve
savant-code
```

Run `/health` inside the chat to verify the Ollama connection, available local
models, and current permission mode.

### Configure a hosted provider key

If Ollama is not running, Savant-Code needs a provider API key for the selected
model. The boot default is OpenRouter's free tier (`openrouter/free`), so
`/provider openrouter` is the fastest path. Use `/provider` for the interactive
picker or choose one directly:

```text
/provider openrouter
/provider opencode-go
/provider tokenrouter
/provider tokenharbor
/provider nvidia
/provider commandcode
```

The supported environment variables are `OPENROUTER_API_KEY`,
`OPENCODE_GO_API_KEY`,
`TOKENROUTER_API_KEY`, `TOKENHARBOR_API_KEY`, `NVIDIA_API_KEY`, and
`COMMAND_CODE_API_KEY`. The key
prompt is masked and stores the key globally in the Savant-Code config
`credentials.json`; it is not added to chat history. Shell environment variables
take precedence over stored keys, so CI and managed environments can configure
providers without using local persistence. Advanced direct-provider integrations
may use `INFERENCE_BASE_URL` and `INFERENCE_API_KEY`; OpenRouter can use
`OPENROUTER_API_KEY` or `SAVANT_CODE_BYOK_OPENROUTER`.

---

## CLI Commands

<!-- markdownlint-disable MD013 MD060 -->

| Command                           | What it does                     |
| --------------------------------- | -------------------------------- |
| `bun run dev`                     | Launch CLI in dev mode           |
| `bun run build:sdk`               | Build the SDK for npm publish    |
| `bun run --cwd=cli build:binary`  | Build the CLI binary from `cli/` |
| `bun run ci`                      | Build SDK and release artifacts  |
| `bun test`                        | Run the test suite               |
| `bun x tsc --noEmit`              | Type check                       |
| `bun x eslint . --max-warnings 0` | Lint                             |

<!-- markdownlint-enable MD013 MD060 -->

---

## Slash Command Reference

Commands can be entered with `/`; aliases are shown in parentheses.

| Command | Purpose |
| --- | --- |
| `/help` (`/h`, `/?`) | Show command help and tips |
| `/new` (`/clear`, `/reset`) | Start a fresh chat; optional text starts the first prompt |
| `/history` (`/chats`) | Browse and resume previous conversations |
| `/copy` (`/copy-chat`) | Copy the complete conversation to the clipboard |
| `/export` (`/save`) | Write a self-contained branded HTML report of the conversation |
| `/graph refresh` (`/graph`) | Re-index the code knowledge graph and show summary stats (`--full` rebuilds) |
| `/graph-export` (`/graph:export`) | Write a branded, interactive offline HTML report of the code knowledge graph |
| `/attest` (`/trust-receipt`) | Export and verify the current project's signed ZTAP trust receipt |
| `/learn` (`/teacher`) | Practice directing and reviewing an AI coding agent through guided exercises |
| `/interview` | Turn an idea into a structured specification |
| `/plan` | Create an implementation plan |
| `/review` | Review code changes |
| `/goal` (`/g`) | Start or manage a durable, budgeted goal run (`status`, `pause`, `resume`, `cancel`) |
| `/loop` (`/repeat`) | Run a prompt on a recurring cadence; use `stop` or `status` |
| `/verify` (`/typecheck`) | Run the four supported core workspace typechecks, all or one selected |
| `/permissions` (`/sandbox`, `/safety`) | View or set `safe`, `prompt`, or `unsafe` tool policy |
| `/rewind` (`/undo`, `/checkpoint`) | Restore a previous turn’s files and/or conversation |
| `/health` (`/status`, `/check`) | Check Ollama, provider mode, model, and permission status |
| `/diagnostics` (`/diag`, `/processes`) | Show local process and resource diagnostics |
| `/provider` | Configure a hosted provider key with masked input |
| `/mode` | List the four modes and their contracts, or switch: `/mode <name>` or `/mode:<name>` |
| `/model` | Select or switch the active hosted model |
| `/publish` | Publish agent templates through the Savant backend |
| `/feedback` (`/bug`, `/report`) | Open the feedback flow |
| `/telemetry` (`/analytics`) | View or change remote analytics consent |
| `/theme:toggle` | Switch between light and dark themes |
| `/design` (`/ds`) | List, select, create, edit, import, validate, resume, discard, and reset design systems |
| `/bash` (`!`) | Run a shell command or enter Bash mode |
| `/image` (`/img`, `/attach`) | Attach an image for supported multimodal models |
| `/init` | Create starter agent types and `knowledge.md` |
| `/login` / `/logout` | Authenticate or end the current session |
| `/exit` (`/quit`, `/q`) | Quit the CLI |

---

## ECHO Protocol

This project ships with [ECHO Protocol v0.2.0](ECHO.md) — the single bootstrap
file for agent behavior.

### Core Principles

- **FID-Bound Execution** — Code is never written until the FID converges
- **Perfection Loop** — RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT →
  COMPLETE
- **Separation of Duties** — The agent that writes code cannot verify it
- **No Deferrals** — Every approved work item must be completed

### 15 Laws

4 immutable process laws (Read 0-EOF, Present Before Act, Verify Before Proceed,
Call-Graph Reachability) + 11 extended code laws. `strict: true` in TypeScript.

### Key Files

| File                     | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `ECHO.md`                | The 15 Laws + Perfection Loop FSM + FID lifecycle |
| `ARCHITECTURE.md`        | Agent roster and tool restrictions                |
| `protocol.config.yaml`   | Build commands, quality bar, paths                |
| `dev/fids/`              | Feature Implementation Documents                  |
| `dev/session-summaries/` | Session audit trail                               |
| `dev/LEARNINGS.md`       | Cross-session lessons                             |

---

## Configuration

| What                         | Where                  | Format                                    |
| ---------------------------- | ---------------------- | ----------------------------------------- |
| ECHO Protocol runtime config | `protocol.config.yaml` | YAML — language, commands, quality limits |
| TypeScript base config       | `tsconfig.json`        | JSON — `strict: true`                     |
| ESLint config                | `eslint.config.js`     | Flat config                               |
| Bun config                   | `bunfig.toml`          | TOML — `linker: "hoisted"`                |

---

## Validation

```bash
# Build
bun run build:sdk && bun run ci

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

## Privacy & Telemetry

Remote analytics and error reporting are **enabled by default** in the CLI
(FID-2026-0806-015). The CLI sends anonymous usage events and error reports to
help improve the product; no prompt content is transmitted as part of these
events.

- **Disable anytime** with `/telemetry disable` (or re-enable with
  `/telemetry enable`). `/telemetry status` shows the current state.
- **Local logs remain available** when remote analytics are disabled.
- **Contextual ads are separate** — disabled by default in the main CLI and
  controlled independently where available.
- First launch prints a one-line notice about this default; it is shown once
  and never again.

---

## Documentation

- [`ECHO.md`](ECHO.md) — The 15 Laws + Perfection Loop FSM
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Agent roster and tool restrictions
- [`protocol.config.yaml`](protocol.config.yaml) — Build commands, quality bar
- [`CHANGELOG.md`](CHANGELOG.md) — Release history
- [`docs/code-universe-export.md`](docs/code-universe-export.md) — `/export` conversation reports and
  `/graph-export` Code Universe guide
- [`docs/design/zero-trust-agentic-provenance.md`](docs/design/zero-trust-agentic-provenance.md) — ZTAP architecture,
  trust model, `/attest` workflow, verification, and operational boundaries
- [`docs/design/agent-steering-teacher-overview.md`](docs/design/agent-steering-teacher-overview.md) — the complete
  Agent-Steering Teacher overview: product, exercise loop, command reference, module map, trust model, progression + ZTAP
- [`docs/design/agent-steering-teacher-guide.md`](docs/design/agent-steering-teacher-guide.md) — the Agent-Steering
  Teacher: exercise loop, modules, trust model, `/learn` usage, and challenge authoring
- [`docs/design/design-system-library.md`](docs/design/design-system-library.md) —
  loadable design-system architecture, workflows, security, enforcement, and packaging
- [`docs/design/hook-system.md`](docs/design/hook-system.md) — the extensible
  lifecycle-hook system: `hooks:` config schema, events, and fail-open protocol
- [`docs/design/goal-mode.md`](docs/design/goal-mode.md) — the durable budgeted
  `/goal` workflow: command reference, state machine, and budgets
- [`dev/test-prompts/design-system-live-ux-performance.md`](dev/test-prompts/design-system-live-ux-performance.md) —
  live CLI usability, agent-feedback, and performance test prompt
- `dev/nova/outbox/archive/2026-08-11-fid-2026-0811-030-design-system-live-test-signoff-request.md` —
  [independent review request for the live test design and captured result](dev/nova/outbox/archive/2026-08-11-fid-2026-0811-030-design-system-live-test-signoff-request.md)
- [`docs/archive/launch/index.html`](docs/archive/launch/index.html) — Public
  landing page (archived launch artifact)
- [`dev/LEARNINGS.md`](dev/LEARNINGS.md) — Cross-session lessons
- [`dev/session-summaries/`](dev/session-summaries/) — Session audit trail

---

## License

[Apache-2.0](LICENSE) — see [LICENSE](LICENSE) for full text.

---

_Savant-Code is the public TypeScript monorepo for the Savant-Code agent
framework._

**Savant** • 2026
