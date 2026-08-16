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
 * the final assistant message text (outputMode 'last_message').
 * FID-2026-0813-004 (D7) — the verbatim text is the signed evidence; no
 * parsing happens here.
 */
export function extractVerdictText(agentState: AgentState): string {
  const history = agentState.messageHistory
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i]
    if (message.role !== 'assistant') continue
    const content = message.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      const parts = content
        .filter(
          (part): part is { type: 'text'; text: string } =>
            typeof part === 'object' &&
            part !== null &&
            part.type === 'text' &&
            typeof (part as { text?: unknown }).text === 'string',
        )
        .map((part) => part.text)
      if (parts.length > 0) return parts.join('\n')
    }
  }
  return ''
}
