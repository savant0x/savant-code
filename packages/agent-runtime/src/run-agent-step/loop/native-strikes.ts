import { userMessage } from '@savant-code/common/util/messages'

import { withSystemTags } from '../../util/messages'
import {
  buildNativeToolCallExhaustedMessage,
  getSteeringMessage,
  NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES,
  NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES,
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
}): { exhausted: boolean } {
  const {
    currentAgentState,
    consecutiveNativeIncompleteSteps,
    lastIncompleteToolName,
  } = params

  // FID-2026-0819-004: run_terminal_command gets extra retries (5 vs 3)
  // because flash-class models need more attempts to learn from steering.
  const maxStrikes =
    lastIncompleteToolName === 'run_terminal_command'
      ? NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES
      : NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES
  if (consecutiveNativeIncompleteSteps >= maxStrikes) {
    return { exhausted: true }
  }
  if (consecutiveNativeIncompleteSteps >= 2) {
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

/** Builds the typed step-failure message when the strike budget exhausts. */
export function buildStepExhaustedError(
  lastIncompleteToolName: string | undefined,
): string {
  return buildNativeToolCallExhaustedMessage(lastIncompleteToolName)
}
