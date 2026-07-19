# Savant-Code

Savant-Code is the multi-agent AI coding assistant built on the ECHO Protocol v0.2.0.

> **All work is governed by [ECHO Protocol](ECHO.md).** No code is written without a FID that has converged through the Perfection Loop.

## Key Technologies

- **TypeScript monorepo** (`strict: true`, `noImplicitReturns: true`)
- **Bun runtime + package manager** (≥ 1.3.11; root pins `1.3.14` per `engines.bun`)
- **OpenTUI + React CLI** (`@opentui/core` 0.2.2, `react` ^19)
- **JS/TS SDK** — embeddable via `SavantClient`
- **Composable agent runtime** — ECHO 9-agent roster with separation of duties
- **ECHO Protocol v0.2.0** — single bootstrap file

## Agent Roster (9 canonical ECHO roles)

The 9-agent roster is enforced in `ARCHITECTURE.md`. Each agent has restricted tools. See [ARCHITECTURE.md](ARCHITECTURE.md) → "Helper Tool Libraries" for the distinction between the 9 runtime roles and the 14 filesystem entries in `agents/`.

| Agent | Phase | Role |
|---|---|---|
| Orchestrator | ALL | Routes work, enforces protocol, spawns agents |
| Detective | RED | Codebase analysis + grep call-graphs |
| Forge | GREEN | Implementation only — writes code from converged FID |
| Verifier | AUDIT | Double-audit, run tests, check call-graph |
| Recorder | FID | Create, track, archive FIDs. Update CHANGELOG. |
| Thinker | Planning | Sequential reasoning via `sequentialthinking` tool |
| Scout | Explore | Glob/list_directory/read_files for context gathering |
| Researcher | Research | Web search + docs lookup |
| Scribe | Docs | Session summaries, LESSONS.md, knowledge files |

## Repo Map

| Workspace | Package | Purpose |
|---|---|---|
| `agents/` | `@codebuff/agents` | Public agent definitions shipped with the CLI (9 canonical + 5 helper tool-library dirs) |
| `cli/` | `@codebuff/cli` | CLI source — UI, commands, state, hooks, OpenTUI/React components |
| `common/` | `@codebuff/common` | Shared types, tool definitions, utilities |
| `evals/` | `@codebuff/evals` | Buffbench benchmark runner + public eval fixtures |
| `freebuff/` | `@codebuff/freebuff` | CLI release + e2e tests for the free variant |
| `packages/database/` | `@codebuff/database` | Database abstraction layer |
| `packages/agent-runtime/` | `@codebuff/agent-runtime` | Agent loop, tool executor, LLM API integration |
| `packages/code-map/` | `@codebuff/code-map` | tree-sitter code indexing, language detection |
| `packages/llm-providers/` | `@codebuff/llm-providers` | Public LLM provider shims |
| `sdk/` | `@codebuff/sdk` | Public SDK — `SavantClient`, types, build + verify scripts |

## Conventions

- Use `bun install` and `bun run`.
- Prefer dependency injection over module mocking.
- Run interactive CLI tests in tmux.
- Do not force-push `main`.
- All typecheck × 4 must pass before any merge: `sdk`, `common`, `packages/agent-runtime`, `cli`.
- New FIDs follow the format `dev/fids/FID-YYYY-MMDD-NNN-{title}.md`.

## Docs

- [**ECHO.md**](ECHO.md) — The 15 Laws + Perfection Loop FSM + FID lifecycle *(READ 0-EOF FIRST)*
- [**ARCHITECTURE.md**](ARCHITECTURE.md) — Agent roster and tool restrictions
- [**CONTRIBUTING.md**](CONTRIBUTING.md) — This file (ECHO Protocol contributor guide)
- [**protocol.config.yaml**](protocol.config.yaml) — Build commands, quality bar, paths
- [**CHANGELOG.md**](CHANGELOG.md) — Reverse-chronological release history (FID-archived entries)
- [**dev/fids/**](dev/fids/) — Active FIDs awaiting resolution
- [**dev/fids/archive/**](dev/fids/archive/) — Closed FIDs (per Auto-Archive rule)
- [**dev/LEARNINGS.md**](dev/LEARNINGS.md) — Cross-session lessons
- [**dev/session-summaries/**](dev/session-summaries/) — Session audit trail
- [**dev/test-prompts/**](dev/test-prompts/) — A-Z test prompts and reports
- [**dev/nova/inbox/**](dev/nova/inbox/) + [**outbox/**](dev/nova/outbox/) — Third-party audit channel
- [**dev/scratchpad/**](dev/scratchpad/) — Ephemeral working area (Orchestrator writes via `/dev override`)
- [**`.agents/skills/`**](.agents/skills/) — 7 coding standards as `SKILL.md` skills (auto-loaded)

## Validation

```bash
# Typecheck × 4 (HARD GATE)
cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../packages/agent-runtime && bun run typecheck && cd ../../cli && bun run typecheck

# SDK test suite (HARD GATE)
cd sdk && bun test src/

# Lint
bun x eslint . --max-warnings 0

# Format
bun x prettier --write .
```
