import type {
  ExperienceErrorClass,
  ExperienceExpectedness,
} from '@savant-code/common/types/experience'
import type { HookEvent } from '@savant-code/common/types/hooks'
import type { JSONValue } from '@savant-code/common/types/json'
import type { CommandExecutionMetadata } from '@savant-code/common/util/command-execution'

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
  error_class?: ExperienceErrorClass
  expectedness?: ExperienceExpectedness
  arguments_truncated?: boolean
  finish_reason?: string
  subagent_type?: string
  /**
   * FID-2026-1012-023: identity of a failed command execution — the caller
   * (`tool_name`) and the tool that actually ran. Narrowed metadata only; it
   * never carries output, arguments or an exception.
   */
  command_execution?: CommandExecutionMetadata
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
