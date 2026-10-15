import { getLastAssistantTurnMessages } from '../util/agent-output'

import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Signed verdict payload (master D7) — the verbatim model output plus the
 * write it binds to. The `over` hash covers exactly these fields.
 */
export type VerdictPayload = {
  changeHash: string
  phase: 'audit' | 'adversarial'
  agentType: string
  agentId: string
  verdictText: string
  timestamp: string
}

/** Build the canonical verdict payload a Verifier/Adversary signs. */
export function buildVerdictPayload(params: VerdictPayload): VerdictPayload {
  return {
    changeHash: params.changeHash,
    phase: params.phase,
    agentType: params.agentType,
    agentId: params.agentId,
    verdictText: params.verdictText,
    timestamp: params.timestamp,
  }
}

/**
 * Extract the verdict payload from a completed Verifier/Adversary subagent:
 * the selected final assistant turn text (outputMode 'last_message').
 * FID-2026-0813-004 (D7) — the verbatim text is the signed evidence; no
 * parsing happens here.
 */
export function extractVerdictText(agentState: AgentState): string {
  return getLastAssistantTurnMessages(agentState.messageHistory)
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.content)
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}
