import { userMessage } from '@savant-code/common/util/messages'

import { getOrCreateEnforcement } from '../../echo/enforcement'
import { buildUserMessageContent } from '../../util/messages'

import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0810-002 Change 5: first-turn completion gate. When a MAIN agent
 * would end its turn while the protocol is unread (and the enforcement gate is
 * armed), inject corrective steering mirroring the existing ECHO_COMPLIANCE
 * pattern and force the loop to continue so the boot reads actually happen.
 * After the retry cap the completion gate disarms with a one-time notice and
 * the turn is allowed to proceed. Subagents (parentId) are exempt.
 *
 * (FID-2026-0819-005 Loop 300: extracted verbatim from `loop-iteration.ts`.)
 */
export function applyUngroundedCompletionGate(
  agentState: AgentState,
  wouldEndTurn: boolean,
): { agentState: AgentState; shouldEndTurn: boolean } {
  if (!wouldEndTurn || agentState.parentId) {
    return { agentState, shouldEndTurn: wouldEndTurn }
  }
  const enforcement = getOrCreateEnforcement(agentState)
  if (!enforcement) {
    return { agentState, shouldEndTurn: wouldEndTurn }
  }
  const result = enforcement.evaluateUngroundedTurnEnd()
  const text = result.steering ?? result.notice
  if (!result.blocked && !text) {
    return { agentState, shouldEndTurn: wouldEndTurn }
  }
  agentState.messageHistory = [
    ...agentState.messageHistory,
    userMessage({
      content: buildUserMessageContent(text!, undefined, undefined),
      tags: ['ECHO_COMPLIANCE'],
      keepDuringTruncation: true,
    }),
  ]
  if (result.blocked) {
    return { agentState, shouldEndTurn: false }
  }
  // Disarm notice: allow the turn to proceed (bounded escape hatch).
  return { agentState, shouldEndTurn: wouldEndTurn }
}
