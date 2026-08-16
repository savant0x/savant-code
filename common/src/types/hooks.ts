/**
 * FID-2026-0814-003: Extensible Hook System at EHEL enforcement points.
 *
 * Project-scoped lifecycle hooks declared in `protocol.config.yaml` under a
 * `hooks:` block. The runtime fires matching hooks at the documented lifecycle
 * points; `PreToolUse` can BLOCK a tool (additional gate — never a bypass of
 * EHEL), everything else is observation-only. Hooks are fail-open by default:
 * a missing binary, timeout, or malformed output ALLOWS execution; only the
 * documented block protocol (exit code 2, or JSON `permissionDecision:
 * "deny"`) blocks.
 */

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SessionStart',
  'SessionEnd',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'Stop',
  'Interrupt',
  'Notification',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

/**
 * One declared hook. `event` selects the lifecycle point; `matcher` (optional)
 * is a RegExp tested against the tool name for tool events; `command` is the
 * external command (tokenized; args are fine); `timeout` is seconds (default
 * 30); `cwd` overrides the working directory (default: project root); `env`
 * adds environment variables.
 */
export type HookConfig = {
  event: HookEvent
  /** RegExp tested against the tool name for tool events. */
  matcher?: string
  /** External command to run (tokenized, no shell). */
  command: string
  /** Timeout in seconds (default 30). */
  timeout?: number
  /** Working directory (default: project root). */
  cwd?: string
  /** Extra environment variables. */
  env?: Record<string, string>
}
