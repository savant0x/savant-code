<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Extensible Hook System

Savant lets a project register external commands (or internal callbacks) that
fire at the tool-executor lifecycle. Hooks are declared in `protocol.config.yaml`
under a `hooks:` block and are an **additional** enforcement gate on top of the
ECHO harness — never a bypass of it.

## Overview

The tool executor already has natural lifecycle points (`tool_started` /
`tool_finished` tracing and the EHEL `beforeToolCall` gate). The hook system
surfaces those points to the operator so a project can run arbitrary local
commands on lifecycle events — pre/post tool use, session start/end, subagent
start/stop, compaction, end-of-turn/cancel, and operator-attention — with a
strict **fail-open** contract so a hook can never brick a session.

## Configuration

Hooks live in `protocol.config.yaml`:

```yaml
hooks:
  - event: PreToolUse
    command: node ./hooks/audit-write.js
    matcher: write_file|str_replace
    timeout: 10
  - event: SessionStart
    command: ./hooks/notify-session.sh
  - event: PostToolUse
    command: python3 ./hooks/record-tool.py
```

| Field | Required | Meaning |
|---|---|---|
| `event` | yes | Lifecycle event (see table below) |
| `command` | one of | External command, tokenized and run directly (**no shell interpolation**) |
| `action` | one of | Builtin in-process sink, no spawn (allowlist: `experience-capture`) — either this or `command`, never both |
| `matcher` | no | RegExp tested against the tool name. Consulted only when the event carries a tool name — see [Matchers and tool-less events](#matchers-and-tool-less-events) |
| `timeout` | no | Seconds (default 30). A timed-out hook always **allows**. |
| `cwd` | no | Working directory (default: project root) |
| `env` | no | Extra environment variables |

Invalid entries (unknown event, missing command, non-positive timeout) are
**dropped fail-safe** at parse time — a malformed hook can never block.

## Events

The **Fires today?** column is the honest state of the runtime, not the intended
one. An event that is *accepted by the config parser* (the vocabulary is
`HOOK_EVENTS`) but never fired by the runtime is the one failure mode you cannot
observe: no parse error, no warning, a hook that simply never runs. Every event
in the vocabulary is classified in `common/src/types/hooks.ts` — either fired
(`FIRED_HOOK_EVENTS`, each with the module that fires it) or deliberately inert
(`NEVER_FIRED_HOOK_EVENTS`, each with the blocker that keeps it inert, **empty as
of FID-2026-0919-031**) — and `bun run scripts/hook-events-check.ts` verifies the
classification against the runtime source. For helper-mediated events the census
demands *reachability*, not spelling: naming an event in a helper's parameter type
is not a firing site, so the helper must be called from somewhere else. This
repository's own `protocol.config.yaml` is checked against the same
classification, so the table below cannot drift from the code.

| Event | Fires | Fires today? | Can block? |
|---|---|---|---|
| `PreToolUse` | Before a tool executes, composing with the EHEL gate | **yes** | **yes** |
| `PostToolUse` | After a tool succeeds | **yes** | no |
| `PostToolUseFailure` | After a tool fails | **yes** | no |
| `SessionStart` / `SessionEnd` | Session lifecycle | **yes** | no |
| `SubagentStart` / `SubagentStop` | Around the `executeSubagent` funnel | **yes** | no |
| `PreCompact` / `PostCompact` | Compaction attempt / compaction effect | **yes** | no |
| `Stop` / `Interrupt` | The turn finished / the turn was cancelled | **yes** | no |
| `Notification` | The runtime hands control to the operator | **yes** | no |

Only `PreToolUse` can block a tool; every other event is observation-only, so a
block signal (exit `2` / a deny decision) on any of them is ignored rather than
half-honoured.

### Semantics the events had to be given (FID-2026-0919-031)

The five events below were declared in the vocabulary with **no firing site** and
no boundary the runtime could implement against — the earlier version of this
document said so, and FID-2026-0919-030 classified each one with its blocker
rather than guess. The rulings are recorded in
`packages/agent-runtime/src/hooks/lifecycle-hooks.ts`, where the wiring lives.

- **`Stop` / `Interrupt`** — the split is **who ended the turn**, mutually
exclusive per turn. `Stop` means the agent finished on its own terms (with the
  outcome: `completed`, or `failed` under `Stop` when the loop returned the error
  form). `Interrupt` means it was **cancelled** — an operator abort, including an
  abort observed while handling a failure. A **failure fires neither**: the turn
  did not finish and was not cancelled, and `SessionEnd` carries the failure
  (FID-2026-0919-030). Both are gated to the main agent — a child run reports
  through `SubagentStop`, so a subagent can never claim the session boundary.
- **`PreCompact` / `PostCompact`** — the asymmetry IS the predicate.
  `PreCompact` is **attempt**-based and fires when the compaction attempt begins
  (the context-pruner spawn — the one path with a resolved trigger, a terminal
  status, and the `/compact` surface); a `Pre` event cannot know the effect.
  `PostCompact` is **effect**-based and fires only on the runtime's existing
  `pruned` predicate — `messagesRemoved > 0 && tokensSaved > 0`, the same
  condition as the `pruned` phase and the `compaction_summary` wire event. An
  ineffective attempt therefore emits a `PreCompact` with **no** matching
  `PostCompact`: a `PostCompact` there would claim the context was compacted when
  nothing changed, and the unmatched `PreCompact` (plus the `ineffective`
  compaction phase) is the real signal. The per-step L0 micro-compact pass is
  deliberately not an event source — it can run on most steps, so an event per
  step is noise, and its `compactionStatus` telemetry already covers it.
- **`Notification`** — the runtime handing control to the operator: an `ask_user`
  call, fired *before* the client call so the request is observable even if the
  operator never answers. It carries the questions as `tool_input` and the
  trigger as `tool_result.reason`.

### Matchers and tool-less events

`matcher` is a RegExp tested against the **tool name**, which only exists on the
tool events. When an event carries no tool name the matcher is not consulted and
the hook runs for that event regardless — deliberately, because the alternative
(never matching) would turn a config typo into a hook that silently never runs,
which is the failure mode this whole section exists to prevent. Pinned in
`packages/agent-runtime/src/hooks/__tests__/engine.test.ts`.

## Execution protocol

The hook receives its payload as JSON on stdin:

```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "…",
  "cwd": "/path/to/project",
  "tool_name": "write_file",
  "tool_input": { "path": "src/foo.ts", "content": "…" }
}
```

Event-specific fields are added where relevant:

| Field | Set by | Meaning |
|---|---|---|
| `tool_result` | `PostToolUse`, `PostToolUseFailure`, `SubagentStop`, `SessionEnd`, `Stop`, `Interrupt` | The tool result, or the terminal **outcome** of a run (`status`, `runId`, `creditsUsed`, `outputType`, and `errorMessage` on failure). On `Stop` / `Interrupt` the `status` is `completed` / `failed` / `cancelled` |
| `tool_result` (compaction) | `PreCompact`, `PostCompact` | The compaction facts the caller knows: the attempt's trigger and token count, the effect's `messagesRemoved` / `tokensSaved` / `percentUsed` |
| `tool_result` (notification) | `Notification` | `{ reason }` — why the runtime needed the operator |
| `error_message` | `PostToolUseFailure`, `SubagentStop`, `SessionEnd`, `Stop`, `Interrupt` | The failure or cancellation reason, so a hook can distinguish "ended" from "crashed" from "cancelled" |
| `subagent_type` | `SubagentStart`, `SubagentStop`, and **`PreToolUse`** | The **acting agent's** type. On `PreToolUse` this is what makes a per-agent policy expressible (e.g. "only `forge` may write"); the session id alone cannot say it, because a subagent's tool call carries the *child's* run id |
| `tool_name` / `tool_input` | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification` | The tool and its arguments (`Notification` sets `ask_user` and its questions) |

`SubagentStop` and `SessionEnd` report three distinct endings: `completed`, and
`failed` either because the loop returned the error form (including a user
cancellation and the no-assistant-turn case) or because it threw — the thrown
value becomes `error_message`. `SubagentStart` / `SessionStart` deliberately
carry no outcome. The payload carries identity and shape, never transcript
content: hook JSON is stdin for a command, so a transcript would be unbounded and
a content-leak path.

## Block protocol (fail-open by default)

Only two signals block a tool; **everything else allows it**:

| Outcome | Result |
|---|---|
| exit code `2` | **block** |
| stdout/stderr contains `"permissionDecision": "deny"` | **block** (optional `"permissionDecisionReason": "…"` is surfaced) |
| missing binary / bad args (spawn error) | **allow** |
| timeout | **allow** |
| malformed / empty output | **allow** |

Output capture is bounded (10,000 chars) so a chatty hook cannot balloon memory.
On timeout the process is killed with grace (`SIGTERM`, then `SIGKILL`; on
Windows the whole process tree is terminated).

## Security model

- Hooks run with the invoking user's privileges, in the project directory, with
  the environment you configured. Register hooks you trust.
- Hooks are an **additional** gate: a `PreToolUse` hook runs *in addition to*
  (never instead of) the EHEL `beforeToolCall` enforcement, so a hook cannot
  weaken ECHO law enforcement.
- The fail-open default means a hook can never break a session, but it also
  means a hook is not a hard security boundary by itself — for hard guarantees,
  use the EHEL enforcement layer and the permission mode (`/permissions`).

## Example

A `PreToolUse` hook that blocks writes to a protected path:

```js
// hooks/audit-write.js — reads JSON from stdin
let data = ''
process.stdin.on('data', (c) => (data += c))
process.stdin.on('end', () => {
  const input = JSON.parse(data)
  if (input.tool_input?.path?.startsWith('secrets/')) {
    process.stdout.write(
      JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason: 'protected path: ' + input.tool_input.path,
      }),
    )
    process.exit(2) // either signal blocks
  }
  process.exit(0)
})
```

```yaml
hooks:
  - event: PreToolUse
    command: node ./hooks/audit-write.js
    matcher: write_file|str_replace
```

## Source

- Schema + event classification: `common/src/types/hooks.ts`
  (`HOOK_EVENTS`, `FIRED_HOOK_EVENTS`, `NEVER_FIRED_HOOK_EVENTS`)
- Parser: `common/src/util/protocol-config-parser.ts` (`parseHookConfigs`, called
  from `protocol-config-sections.ts` → `applyHooksSection`); the loader is
  `common/src/util/protocol-config.ts`
- Runner: `packages/agent-runtime/src/hooks/runner.ts` (fail-open contract)
- Engine: `packages/agent-runtime/src/hooks/engine.ts` (matching, parallel
  execution, allow/block aggregation)
- Lifecycle helpers: `packages/agent-runtime/src/hooks/lifecycle-hooks.ts`
  (`Stop` / `Interrupt`, `PreCompact` / `PostCompact`, `Notification`) and
  `run-outcome.ts` (the terminal outcome both `SessionEnd` and `SubagentStop`
  report)
- Wiring: `tools/tool-executor/hook-gate.ts` (native `PreToolUse`) and
  `tools/tool-executor/custom.ts` (custom/MCP tools) · `result-lifecycle.ts` /
  `custom-result.ts` (`PostToolUse`, `PostToolUseFailure`) ·
  `main-prompt-run.ts` (session) · `tools/handlers/tool/execute-subagent.ts`
  (subagent) · `spawn-agent-inline.ts` / `spawn-agent-inline-pruner-outcome.ts`
  (compaction) · `tools/handlers/tool/ask-user.ts` (notification)
