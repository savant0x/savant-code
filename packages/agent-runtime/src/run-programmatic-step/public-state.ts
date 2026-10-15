import type { PublicAgentState } from '@savant-code/common/types/agent-template'
import type { AgentState } from '@savant-code/common/types/session-state'

export const getPublicAgentState = (
  agentState: AgentState & Required<Pick<AgentState, 'runId'>>,
): PublicAgentState => {
  const {
    agentId,
    runId,
    parentId,
    messageHistory,
    output,
    systemPrompt,
    toolDefinitions,
    contextTokenCount,
  } = agentState
  return {
    agentId,
    runId,
    parentId,
    // FID-2026-0802-005 L17: session-state AgentState and the PublicAgentState
    // projection (agent-definition) are structurally identical for these
    // fields — the previous `as unknown as` cast was unnecessary.
    messageHistory,
    output,
    systemPrompt,
    toolDefinitions,
    contextTokenCount,
  }
}
