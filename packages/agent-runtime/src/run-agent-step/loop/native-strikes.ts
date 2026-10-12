import { userMessage } from '@savant-code/common/util/messages'

import { withSystemTags } from '../../util/messages'
import {
  buildNativeToolCallExhaustedMessage,
  buildToolUnavailableExhaustedMessage,
  getSteeringMessage,
  NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES,
  NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES,
  TOOL_UNAVAILABLE_RECOVERY_MAX_STRIKES,
} from '../constants'

import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Native-incomplete strike handling (FID-2026-0819-005 Loop 300: extracted
 * verbatim from `loop-iteration.ts`; the caller increments the strike
 * counter so it stays the single writer of the persisted streak).
 *
 * Returns `exhausted` when the strike budget is spent — the caller then
 * marks the step failed with `buildStepExhaustedError`.
 */
export function applyNativeStrikeHandling(params: {
  currentAgentState: AgentState
  /** Strike count including the current native-incomplete step. */
  consecutiveNativeIncompleteSteps: number
  lastIncompleteToolName: string | undefined
  /** The agent's own allowlist — decides the failure class (FID-2026-1012-002). */
  availableToolNames: readonly string[]
}): { exhausted: boolean } {
  const {
    currentAgentState,
    consecutiveNativeIncompleteSteps,
    lastIncompleteToolName,
    availableToolNames,
  } = params

  // FID-2026-1012-002: a name this agent does not have is not a payload-size
  // problem, so it must not consume the payload ladder's budget. One corrective
  // retry (the strike counter includes the current step, so 2 = one retry) and
  // then an honest failure beats three wasted steps on a call that can never
  // succeed.
  const isUnavailableToolCall =
    lastIncompleteToolName !== undefined &&
    !availableToolNames.includes(lastIncompleteToolName)
  // FID-2026-0819-004: run_terminal_command gets extra retries (5 vs 3)
  // because flash-class models need more attempts to learn from steering.
  const maxStrikes = isUnavailableToolCall
    ? TOOL_UNAVAILABLE_RECOVERY_MAX_STRIKES
    : lastIncompleteToolName === 'run_terminal_command'
      ? NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES
      : NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES
  if (consecutiveNativeIncompleteSteps >= maxStrikes) {
    return { exhausted: true }
  }
  if (consecutiveNativeIncompleteSteps >= 2 && !isUnavailableToolCall) {
    // FID-2026-0819-004: append escalating steering on retry. The first
    // error (strike 1) already has a hint from stream-parser.ts. Strikes
    // 2+ get increasingly specific guidance via getSteeringMessage.
    const escalatingHint = getSteeringMessage(
      lastIncompleteToolName,
      consecutiveNativeIncompleteSteps,
    )
    if (escalatingHint) {
      currentAgentState.messageHistory = [
        ...currentAgentState.messageHistory,
        userMessage({
          content: withSystemTags(
            `Native tool call still failing. Try a different approach.${escalatingHint}`,
          ),
          tags: ['TOOL_CALL_ERROR'],
        }),
      ]
    }
  }
  return { exhausted: false }
}

/**
 * Builds the typed step-failure message when the strike budget exhausts.
 *
 * FID-2026-1012-002: the unavailable-tool class gets its own message. The
 * truncation message prescribes splitting the payload and re-spawning with
 * smaller steps — advice about a problem that did not occur, sent to the parent
 * of a run that died because the model named a tool it never had.
 */
export function buildStepExhaustedError(
  lastIncompleteToolName: string | undefined,
  availableToolNames: readonly string[] = [],
): string {
  const isUnavailableToolCall =
    lastIncompleteToolName !== undefined &&
    !availableToolNames.includes(lastIncompleteToolName)
  return isUnavailableToolCall
    ? buildToolUnavailableExhaustedMessage(
        lastIncompleteToolName,
        availableToolNames,
      )
    : buildNativeToolCallExhaustedMessage(lastIncompleteToolName)
}
