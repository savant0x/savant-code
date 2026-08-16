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
start/stop — with a strict **fail-open** contract so a hook can never brick a
session.

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
| `command` | yes | External command, tokenized and run directly (**no shell interpolation**) |
| `matcher` | no | RegExp tested against the tool name for tool-scoped events |
| `timeout` | no | Seconds (default 30). A timed-out hook always **allows**. |
| `cwd` | no | Working directory (default: project root) |
| `env` | no | Extra environment variables |

Invalid entries (unknown event, missing command, non-positive timeout) are
**dropped fail-safe** at parse time — a malformed hook can never block.

## Events

| Event | Fires | Can block? |
|---|---|---|
| `PreToolUse` | Before a tool executes, composing with the EHEL gate | **yes** |
| `PostToolUse` | After a tool succeeds | no |
| `PostToolUseFailure` | After a tool fails | no |
| `SessionStart` / `SessionEnd` | Session lifecycle | no |
| `SubagentStart` / `SubagentStop` | Around the `executeSubagent` funnel | no |
| `PreCompact` / `PostCompact` | Around compaction | no |
| `Stop` / `Interrupt` | Cancellation / interruption | no |
| `Notification` | Observability signal | no |

Only `PreToolUse` can block a tool; every other event is observation-only.

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

Event-specific fields are added where relevant (`tool_result`,
`error_message`, `subagent_type`).

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

- Schema: `common/src/types/hooks.ts`
- Parser: `common/src/util/protocol-config.ts` (`parseHookConfigs`)
- Runner: `packages/agent-runtime/src/hooks/runner.ts` (fail-open contract)
- Engine: `packages/agent-runtime/src/hooks/engine.ts` (matching, parallel
  execution, allow/block aggregation)
- Wiring: `packages/agent-runtime/src/tools/tool-executor/native.ts` /
  `custom.ts` (tool events) · `main-prompt.ts` (session events) ·
  `spawn-agent-utils.ts` (subagent events)
