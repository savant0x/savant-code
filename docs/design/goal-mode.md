<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Durable Budgeted Goal Mode

`/goal` turns a natural-language objective into a durable, budgeted goal run:
the agent iterates until the objective is verifiably complete, a genuine
impasse blocks it, or a budget you set is exhausted — with the goal state
surviving across turns and visible in the sidebar.

## Command reference

```text
/goal <objective> [--budget tokens=N turns=N time=MS]
/goal status
/goal pause
/goal resume
/goal cancel
```

| Command | Purpose |
|---|---|
| `/goal <objective>` | Start a durable goal run (e.g. `/goal refactor the state layer`) |
| `--budget tokens=N` | Cap total tokens the goal run may spend |
| `--budget turns=N` | Cap the number of continuation turns |
| `--budget time=MS` | Cap wall-clock time in milliseconds |
| `/goal status` | Show the current goal, state, and budget consumption |
| `/goal pause` | Pause the goal (the record persists) |
| `/goal resume` | Resume a paused goal |
| `/goal cancel` | Cancel the goal (no further continuation turns) |

Budgets may be combined: `/goal refactor --budget turns=8 time=600000`.

## State machine

A goal is event-sourced onto the agent state and moves through four states:

| State | Meaning |
|---|---|
| `active` | The continuation driver is running goal turns |
| `paused` | Goal retained but no continuation turns run |
| `blocked` | The agent hit a genuine impasse it cannot resolve |
| `complete` | The model verified the objective via the `update_goal` tool |

## How it works

1. The objective is wrapped in `<untrusted_objective>` so the model treats it
   as **data, never instructions** — it cannot be used to prompt-inject the
   agent.
2. A runtime continuation driver runs goal turns until one of:
   - the model verifies completion via `update_goal`,
   - a budget (`tokens` / `turns` / `time`) is exhausted,
   - the ECHO circuit breaker stops the loop,
   - you `pause` or `cancel`.
3. The model has two goal tools — `update_goal` (report progress / verify
   completion) and `get_goal` (read the current goal record) — and the sidebar
   shows live goal + budget consumption.

## Why budgets matter

Without a budget, an ambiguous goal can burn unbounded tokens across many
turns. `--budget` makes the cost ceiling explicit and deterministic: `turns=N`
grants exactly `N` continuation turns, and the run stops hard at the limit.

## Source

- State machine: `packages/agent-runtime/src/run-agent-step/goal-engine.ts`
- Continuation driver: `packages/agent-runtime/src/run-agent-step/goal-driver.ts`
- Tools: `packages/agent-runtime/src/tools/handlers/tool/{update-goal,get-goal}.ts`
- CLI: `cli/src/commands/goal.ts`
- Directive serialization: `common/src/util/goal-directives.ts`
