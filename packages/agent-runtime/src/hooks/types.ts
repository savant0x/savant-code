import type { HookEvent } from '@savant-code/common/types/hooks'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-0814-003 — runtime hook payload types.
 *
 * The input sent to a hook command is snake_case JSON on stdin (kimi parity):
 * `hook_event_name`, `session_id`, `cwd`, and event-specific fields such as
 * `tool_name` / `tool_input`.
 */
export type HookInputData = {
  hook_event_name: HookEvent
  session_id: string
  cwd: string
  tool_name?: string
  tool_input?: Record<string, JSONValue>
  tool_result?: JSONValue
  error_message?: string
  subagent_type?: string
  [key: string]: unknown
}

/** Result of one hook command execution. */
export type HookRunResult = {
  outcome: 'allowed' | 'blocked'
  reason?: string
  /** True when the hook hit its timeout (always fail-open). */
  timedOut?: boolean
  /** True when the command could not be spawned (always fail-open). */
  spawnError?: string
}
