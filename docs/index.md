<!-- markdownlint-disable MD013 -->
# Savant Code

**A terminal-native multi-agent AI coding assistant that audits every change before it touches your repo.**

Built with TypeScript/Bun, governed by the ECHO Protocol, and designed for local-first use with Ollama or any OpenAI-compatible provider.

---

## Why Savant Code?

Most coding agents work as a single model guessing at your code. They generate changes, maybe run a linter, and hope for the best. When they fail, they fail silently — or worse, they fail confidently.

Savant Code takes a different approach. It uses **10 specialized agents** with strict separation of duties to audit every change before it reaches your files.

**The core insight:** Code quality isn't a model problem, it's a configuration problem. Models will keep getting smarter, but they'll also keep failing in unexpected ways because unexpected failure modes are fundamental to non-deterministic systems. The solution isn't waiting for GPT-6 — it's engineering a harness that catches mistakes structurally.

---

## Quick Start

```bash
npm install -g savant-code   # or: npm i savant-code -g
cd your-project
savant-code
```

[`savant-code` on npm](https://www.npmjs.com/package/savant-code)

If Ollama is installed and running, it is detected automatically:

```bash
ollama serve
savant-code
```

---

## The 10 Agents

Savant Code deploys 10 specialized agents, each with a distinct role and restricted tool permissions:

| Agent | Role | What It Does |
|-------|------|--------------|
| **Savant** | Orchestrator | Routes work, enforces protocol, spawns agents |
| **Detective** | RED Phase | Discovers bugs and issues with evidence before code is written |
| **Forge** | GREEN Phase | Implements code changes from a converged plan |
| **Verifier** | AUDIT Phase | Independent double-audit after implementation |
| **Adversary** | ADVERSARIAL Phase | Read-only devil's advocate that refutes every audit claim and re-checks PASSes with evidence |
| **Thinker** | Planning | Deep sequential reasoning for complex problems |
| **Scout** | Explore | Explores codebases to gather context |
| **Researcher** | Research | Web search and documentation lookup |
| **Recorder** | FID Lifecycle | Manages FID creation, tracking, and archiving |
| **Scribe** | Documentation | Session summaries and knowledge capture |

Each agent has exactly the tools it needs — no more. Detective gets read-only access. Forge gets write access. Thinker gets sequential thinking. No agent has more power than its role allows.

---

## The ECHO Perfection Loop

Every code change follows a strict pipeline:

1. **RED** — Identify ALL failures and issues with evidence (Detective phase)
2. **GREEN** — Fix with minimal, surgical changes (Forge phase)
3. **AUDIT** — Independent verification by a separate agent (Verifier phase)
4. **ADVERSARIAL** — Read-only adversarial review that refutes every claim and re-checks PASSes (Adversary phase)
5. **SELF-CORRECT** — Fix any blockers found during audit
6. **COMPLETE** — Document results, archive tracking (Recorder phase)

No code is written without a plan. No plan is accepted without audit. No audit passes without evidence. This isn't optional — it's enforced by the protocol.

---

## Key Features

- **Multi-agent orchestration** — 10 canonical agents coordinate through ECHO with explicit separation of duties
- **Tool permission boundaries** — Each agent gets exactly the tools it needs via strict allowlist filtering
- **Context compaction** — 4-layer progressive auto-compaction with a single trigger authority keeps sessions running through large codebases; `/compact` forces an immediate compact-and-stop pass
- **Checkpoint & Rewind** — Persistent per-turn edit checkpoints with `/rewind` modes for code, conversation, both, or session fork
- **Fail-closed streaming** — Incomplete or malformed tool calls are rejected, not coerced
- **Provider flexibility** — Works with Ollama (local-first), OpenRouter (default boot provider, free tier `openrouter/free`), OpenCode Go, TokenHarbor, NVIDIA NIM, CommandCode, or any OpenAI-compatible API
- **Research (web search + docs)** — `web_search`, `read_docs`, and `deep_research` work keylessly out of the box (Qwant + DuckDuckGo search; a self-populating local SQLite docset cache), with optional Bring-Your-Own-Key sources (`/research-keys`) and keyless version-aware freshness
- **GitHub integration** — Read-only PR/issue/CI review via official MCP server
- **Database helper** — 4 native tools with adapter-enforced safety (read-only by default, LIMIT injection, SQL redaction)
- **Knowledge graph** — Deterministic, incremental codebase graph with blast-radius/node-edge/cluster queries and a branded interactive offline export
- **HTML export** — Fully self-contained branded HTML reports of conversations
- **Design systems** — `/design` manages a project-local token system (create/edit/import/drafts/reset) that the agent applies to every visual output; built-ins are immutable and persistence is atomic
- **Release automation** — `/release preview \| diagnose \| go \| resume \| status` drives a fail-closed public-release pipeline with receipts and a structured audit trail
- **Universal session-init grounding** — every session deterministically boots by reading the harness protocol local-first, with a drift-checked embedded fallback for npm-installed copies (FID-2026-0810-002)
- **Agent-Steering Teacher (`/learn`)** — local-first exercises for directing and reviewing an AI coding agent, with a capability-sandboxed execution boundary and ZTAP-signed versioned progression
- **Zero-Trust Agentic Provenance (ZTAP)** — per-role Ed25519-signed write receipts at the native write boundary, an append-only hash-only session ledger, a read-only live Trust Matrix, and `/attest` JSON + offline HTML receipts (see the [ZTAP guide](design/zero-trust-agentic-provenance.md))
- **Durable budgeted goal mode** — `/goal <objective> [--budget tokens=N turns=N time=MS]` drives a budgeted, resumable goal run with token/turn/wall-clock ceilings and an honest `<untrusted_objective>` injection boundary (see the [goal-mode guide](design/goal-mode.md))
- **Auto Drive (`/auto-drive`)** — clarify → plan → approve → run-to-completion autonomous execution that decomposes the plan into a FID backlog, runs it in dependency order, and certifies completion (aliases `/auto`, `/drive`, `/autodrive`; see the [Auto Drive blueprint](design/Auto Drive Architecture Blueprint.md) and the [FAQ](faq.md))
- **Discord Rich Presence (`/presence`)** — externalizes the active agent, phase, project basename, and model to Discord with a mechanical privacy boundary (paths, arguments, FID titles, and search queries redacted; fail-closed Zod fallback) — see the [Discord Presence blueprint](design/Discord Presence For Savant-Code.md)
- **Extensible hook system** — a project-scoped `hooks:` block in `protocol.config.yaml` runs external commands at the tool-executor lifecycle (`PreToolUse`/`PostToolUse`/session/subagent events), composing with the EHEL gate and fail-open by default (see the [hook-system guide](design/hook-system.md))
- **One model project-wide** — the model selected in the UI panel is the only model used: the main agent, teacher-forge, headless runs, and every spawned subagent resolve the operator's selection (never a hardcoded paid fallback). The paid build resolves its boot model only from the `/model` selection (`openrouter/free` when unset) and never reads the unreleased savant-free catalog or its preference key, so a stale free-model preference cannot silently switch the operator to a paid model (FID-2026-0814-004 H-08..H-12, FID-2026-0814-010)

---

## Technical Stack

- **Runtime:** TypeScript/Bun
- **Agent System:** ECHO Protocol v0.2.0
- **License:** Apache 2.0 (fully open source)
- **Architecture:** Monorepo with shared packages

---

## Links

- [GitHub](https://github.com/savant0x/savant-code)
- [npm](https://www.npmjs.com/package/savant-code)
- [ECHO Protocol](echo-protocol.md)
- [Agent Roster](agents.md)
- [Features](features.md)
- [Knowledge Graph](knowledge-graph.md)
- [Export Workflows & Code Universe](code-universe-export.md)
- [Agent-Steering Teacher](design/agent-steering-teacher-overview.md)
- [Self-Improving Harness & Agent-Created Skills](self-improving-harness.md)
- [Zero-Trust Agentic Provenance](design/zero-trust-agentic-provenance.md)
- [Hook System](design/hook-system.md)
- [Goal Mode](design/goal-mode.md)
- [Auto Drive](design/Auto Drive Architecture Blueprint.md)
- [Discord Rich Presence](design/Discord Presence For Savant-Code.md)
- [FAQ](faq.md)
- [Installation](installation.md)

### Reference

- [Agents & Tools](agents-and-tools.md) · [Modes](savant-code-modes.md) · [Testing](testing.md) · [Privacy](privacy.md) · [Installation](installation.md) · [Versioning](SAVANT-VERSIONING.md) · [Public Release Workflow](public-release.md) · [Gravity Index starter](gravity-integration-starter.md)

### Archives

- [Design](design/) · [Launch](archive/launch/) · [Reports](archive/reports/) · [Research](archive/research/)
