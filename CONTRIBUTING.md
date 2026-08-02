# Contributing

This is the open-source monorepo for **Savant-Code** — the public TypeScript workspace that ships two products
(Savant-Code + Savant-Free) from one source tree. The repository is the source of truth; patches go directly here.

All work in this repo is governed by **[ECHO Protocol v0.2.0](ECHO.md)** and the **FID-Bound Perfection Loop**. Please
read ECHO.md end-to-end before contributing — it's a strict discipline, not a style preference.

---

## ECHO Protocol + FID Workflow

**Every change flows through a FID (Feature Implementation Document):**

```text
RED (Detective finds issues, catalogs evidence)
  → GREEN (Thinker proposes fix, Recorder writes FID)
  → AUDIT (Verifier double-checks source + runtime + call-graph)
  → SELF-CORRECT (if AUDIT failed, Thinker + Recorder revise the FID)
  → COMPLETE (Recorder archives FID to dev/fids/archive/ + adds CHANGELOG entry)
  → Forge implements the change against the converged FID
```

**Separation of duties (non-negotiable):**

| Role | What it does | What it cannot do |
|---|---|---|
| **Orchestrator** | Routes work, spawns agents | Write source code (delegates to Forge) |
| **Detective** | RED — code_search, catalogs evidence | Write fixes |
| **Forge** | GREEN — writes code from the FID | Verify its own work (no bash) |
| **Verifier** | AUDIT — reads history, double-checks | Write anything (no tools) |
| **Recorder** | FID lifecycle, CHANGELOG, archive | Verify other agents |
| **Thinker** | Sequential reasoning | Write code or bash |
| **Scout / Researcher / Scribe** | Read-only / write-only | Mix roles |

**Before you contribute:**

1. Read [`ECHO.md`](ECHO.md) end-to-end — 15 laws, Perfection Loop FSM, FID lifecycle.
2. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) — agent roster and tool restrictions.
3. Check [`dev/fids/`](dev/fids/) for open work — your change may overlap.
4. File a new FID (`dev/fids/FID-YYYY-MMDD-NNN-{title}.md`) using
   [`templates/FID-TEMPLATE.md`](templates/FID-TEMPLATE.md) before writing code.
5. Run the agent's Perfection Loop on your FID: RED → GREEN → AUDIT → COMPLETE.
6. Only after AUDIT PASS should Forge implement the code change.

---

## Development Setup

Install dependencies:

```bash
bun install
```

Run the CLI in dev mode (paid variant):

```bash
bun run dev
```

Run the CLI in dev mode (free variant):

```bash
bun run dev:savant-free
```

Verify your work before opening a PR:

```bash
bun run typecheck      # All 4 packages must exit 0
bun test               # SDK test suite must pass
bun x eslint . --max-warnings 0
```

---

## Where to Contribute

**Good public PRs are usually scoped to:**

- `cli/` — TUI client, OpenTUI/React components, commands
- `sdk/` — public SDK, types, build scripts
- `common/` — shared types, tool definitions, validators
- `agents/` — public agent definitions shipped with the CLI
- `packages/agent-runtime/` — agent loop, tool executor, LLM API integration
- `packages/code-map/` — source parsing helpers
- `packages/llm-providers/` — public LLM
