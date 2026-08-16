# Project knowledge

This file gives SavantCode context about this project: goals, commands,
conventions, and gotchas.

## Quickstart

- Setup: `bun install` (also auto-wires the pre-push git hook via the root
  `prepare` script).
- Dev: `bun run --cwd=cli dev` (launches the TUI). The SDK/CLI/runtime all
  build with `bun run typecheck`.
- Test: `bun run test` (all workspaces) or per-package
  `cd <pkg> && bun test src/`.

## Architecture

- **TypeScript monorepo** (`strict: true`), **Bun runtime + package manager**
  (pinned `1.3.14`).
- Key workspaces: `cli/` (TUI + commands), `sdk/` (public SDK +
  `SavantClient`), `common/` (shared types/tools),
  `packages/agent-runtime/` (agent loop + tool executor + LLM integration),
  `agents/` (bundled agent definitions), plus
  `packages/{knowledge-graph,code-map,database,llm-providers}` and `evals/`.
- **Data flow:** CLI → `createRunConfig` → SDK `run()` → agent-runtime step
  loop → tool executor (native + custom) → EHEL enforcement → back through
  `PrintModeEvent` stream.
- Governance is the **ECHO Protocol v0.2.0** (`ECHO.md`): 10-agent roster,
  Perfection Loop FSM, FID lifecycle. No code without a converged FID.
- Runtime subsystems: the **EHEL enforcement layer**, **ZTAP provenance**
  (`provenance.mode`), the **context compactor** (4-layer, `compression`
  config), the **hook system** (`hooks:` config), and the **durable goal
  engine** (`/goal`).

## Conventions

- Formatting/linting: Prettier + ESLint (`bun x eslint . --max-warnings 0`) +
  markdownlint (`bun run lint:md`). All three are hard pre-push gates.
- Typecheck gate: **×4** must pass before any merge — `sdk`, `common`,
  `packages/agent-runtime`, `cli`.
- New FIDs follow `dev/fids/FID-YYYY-MMDD-NNN-{title}.md`; close only after
  review boundaries resolve, then move to `dev/fids/archive/` and update
  `CHANGELOG.md`.
- Prefer dependency injection over module mocking; verify non-trivial changes
  with typecheck + relevant tests.

## Things to avoid

- Do **not** force-push `main`; do not run `git push`, deploys, or releases
  without explicit operator authorization.
- Do not hardcode a model slug — the UI-selected model is the **only** model
  used project-wide (headless, subagent, and teacher included; never a paid
  fallback).
- Do not hand-edit generated artifacts
  (`cli/src/agents/bundled-agents.generated.ts`,
  `common/src/constants/protocol-bundle.generated.ts`) — regenerate via their
  scripts.
- Do not treat a silent `200k` context fallback as acceptable: the CLI
  resolves the real model window and threads it through the SDK
  (`contextWindow`).

## Gotchas

- Windows shell is bash (Git Bash) — use POSIX syntax (`mv`/`rm`, forward-slash
  paths), never `dir`/`del`/PowerShell.
- Agent definitions are **serialized at prebuild**; changing
  `agents/savant/handle-steps.ts` (or config-driven literals) requires
  regenerating the bundled agents.
- `dev/scratchpad/` is gitignored (ephemeral); `dev/fids/`, `dev/nova/`,
  `dev/session-summaries/` are audit channels — preserve their history.
- The context compactor's display denominator, warning threshold, and pruner
  trigger must reference one resolved window (no drift between `autoCompact`,
  `maxContextLength`, and the sidebar percent).
