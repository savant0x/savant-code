import { userMessage } from '@savant-code/common/util/messages'

import { buildUserMessageContent } from '../../util/messages'

import type { EchoEnforcement } from '../../echo/enforcement'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Inject EHEL corrective steering into the agent's message history (mirrors
 * the tracker's ECHO_COMPLIANCE injection in loop-iteration): budgeted
 * corrective text the running agent sees on its next model step, tagged so
 * it is recognizably harness guidance rather than user dialogue.
 *
 * ECHO_STEERING is intentionally NOT in the context-pruner's tag exclusion
 * list (unlike GRAPH_EVIDENCE): the corrective guidance is genuine
 * conversation content the agent should retain, consistent with how the
 * tracker's ECHO_COMPLIANCE steering is summarized. Do not exclude it.
 *
 * (Extracted verbatim from `tool-executor/native.ts` — FID-2026-0905-001.)
 */
export function injectEhelSteering(
  agentState: AgentState,
  enforcement: EchoEnforcement,
): void {
  const steering = enforcement.takeSteeringMessages()
  if (steering.length === 0) return
  agentState.messageHistory = [
    ...agentState.messageHistory,
    ...steering.map((text) =>
      userMessage({
        content: buildUserMessageContent(text, undefined, undefined),
        tags: ['ECHO_STEERING'],
        keepDuringTruncation: true,
      }),
    ),
  ]
}
