# Savant-Code

Savant-Code is the multi-agent AI coding assistant built on the ECHO Protocol v0.2.0.

> **All work is governed by [ECHO Protocol](ECHO.md).** No code is written without a FID that has converged through the
  Perfection Loop.

## Key Technologies

- **TypeScript monorepo** (`strict: true`, `noImplicitReturns: true`)
- **Bun runtime + package manager** (≥ 1.3.11; root pins `1.3.14` per `engines.bun`)
- **OpenTUI + React CLI** (`@opentui/core` 0.5.3, `react` ^19)
- **JS/TS SDK** — embeddable via `SavantClient`
- **Composable agent runtime** — ECHO 10-agent roster with separation of duties
- **ECHO Protocol v0.2.0** — single bootstrap file

## Agent Roster (10 canonical ECHO roles)

The 10-agent roster is enforced in `ARCHITECTURE.md`. Each agent has restricted tools. See
[ARCHITECTURE.md](ARCHITECTURE.md) → "Helper Tool Libraries" for the distinction between the 10 runtime roles and the
filesystem entries in `agents/`.

| Agent | Phase | Role |
|---|---|---|
| Orchestrator | ALL | Routes work, enforces protocol, spawns agents |
| Detective | RED | Codebase analysis + grep call-graphs |
| Forge | GREEN | Implementation only — writes code from converged FID |
| Verifier | AUDIT | Double-audit, run tests, check call-graph, cite `file:line` evidence |
| Recorder | FID | Create, track, archive FIDs. Update CHANGELOG. |
| Thinker | Planning | Sequential reasoning via `sequentialthinking` tool |
| Scout | Explore | Glob/list_directory/read_files for context gathering |
| Researcher | Research | Web search + docs lookup |
| Scribe | Docs | Session summaries, LESSONS.md, knowledge files |
| Adversary | ADVERSARIAL | Meta-verification: refutes Verifier FAILs, re-audits unevidenced PASSes, verdicts override (FID-2026-0805-004) |

## Repo Map

| Workspace | Package | Purpose |
|---|---|---|
| `agents/` | `@savant-code/agents` | Public agent definitions shipped with the CLI (10 canonical + 6 helper tool-library/trace dirs) |
| `cli/` | `@savant-code/cli` | CLI source — UI, commands, state, hooks, OpenTUI/React components |
| `common/` | `@savant-code/common` | Shared types, tool definitions, utilities |
| `evals/` | `@savant-code/evals` | Eval benchmark runner + public eval fixtures |
| `savant-free/` | `@savant-code/savant-free` | CLI release + e2e tests for the free variant |
| `desktop/` | `@savant-code/desktop` | Tauri v2 desktop shell — Rust sidecar supervisor, React 19 renderer, 3D command deck |
| `packages/database/` | `@savant-code/database` | Database abstraction layer |
| `packages/agent-runtime/` | `@savant-code/agent-runtime` | Agent loop, tool executor, LLM API integration |
| `packages/code-map/` | `@savant-code/code-map` | tree-sitter code indexing, language detection |
| `packages/knowledge-graph/` | `@savant-code/knowledge-graph` | Deterministic codebase knowledge-graph engine (indexer, queries, clustering, export serializer) |
| `packages/llm-providers/` | `@savant-code/llm-providers` | Public LLM provider shims |
| `sdk/` | `@savant-code/sdk` | Public SDK — `SavantClient`, types, build + verify scripts |

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
- [**`docs/self-improving-harness.md`**](docs/self-improving-harness.md) —
  Self-improving harness + agent-created skills (full guide)

## Self-Improving Harness (FID-2026-0824-012)

Savant learns from its own failures and authors its own skills — under strict
operator governance. The agent can explain/demonstrate this on prompting;
key facts:

- **Mechanical capture** — `protocol.config.yaml` declares a
  `PostToolUseFailure` hook with `action: experience-capture` (in-process,
  fail-open): every tool failure appends one immutable record to
  `dev/experiences/raw-traces.jsonl` (never boot-read; context-hashed inputs;
  path-normalized keys). Dedup/recurrence: `bun run experiences:dedup` — a
  pattern must recur **≥3× within 14 days** to promote; expected failures
  (e.g. search 404s) never count.
- **Skill authoring** — the `skill_manage` tool (create/patch/edit/delete/
  write_file/remove_file/rollback) is **Scribe + Orchestrator only**.
  Everything an agent writes lands in `.agents/skills/.quarantine/`
  (invisible until trusted), versioned on-disk via
  `.agents/skills/<name>/versions/v<N>/` + `VERSIONS.jsonl` (git is NOT the
  ledger). Patches are capped at a 10% Levenshtein change ratio.
- **Operator-only release** — `/skills list|show|trust|untrust|rollback`.
  The agent can author; it cannot release. `immutable: true` skills reject
  every mutation (engine + EHEL pre-write gate).
- **Session-end review** — the SessionEnd hook runs `scripts/session-end-review.ts`
  (refresh `dev/agenda.md` ≤50 lines + FID-routing candidates); the
  Orchestrator end-of-turn directive spawns Scribe for the full-fidelity
  review, which routes ≥3-recurrence patterns to FIDs and drafts eligible
  lessons into quarantine skills (`bun run lessons:to-skills`).
  LEARNINGS retirement (`bun run learnings:retire`) and the evolution ritual
  (`bun run skills:evolve`) are operator-run.
- **When the user asks how it works** — run the live loop: `/skills` status
  → `bun run experiences:dedup` → author/trust a demo skill → show
  `VERSIONS.jsonl` + `versions/` → prove quarantine invisibility → show the
  immutable gate. Mark the NEEDS-REVIEW live boundaries honestly (real TUI
  smoke, live HYBRID hook behavior, real session-end Scribe review).

## Validation

```bash
# Typecheck × 4 (HARD GATE)
cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../packages/agent-runtime && bun run typecheck && cd ../../cli && bun run typecheck

# SDK test suite (HARD GATE)
cd sdk && bun test src/

# Lint (HARD GATE — enforced pre-push)
bun x eslint . --max-warnings 0

# Markdown lint (HARD GATE — enforced pre-push)
bun run lint:md

# Format
bun x prettier --write .
```

> **Pre-push gate:** a native git pre-push hook (`.githooks/pre-push`) runs the
> fail-closed pushed-range credential scan
> (`bun run scripts/pre-push-scan.ts`, which materializes the exact commit range
> being pushed and reuses `scanStagedCredentials` from the public-release script)
> plus `bun x eslint . --max-warnings 0` + `bun run lint:md`. It is
> auto-wired on `bun install` via the root `prepare` script
> (`git config core.hooksPath .githooks`). Bypass only with `git push --no-verify`.
