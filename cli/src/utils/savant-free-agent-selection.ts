import { getSavantFreeRootAgentIdForModel } from '@savant-code/common/constants/free-agents'

import { AGENT_MODE_TO_ID, IS_SAVANT_FREE, type AgentMode } from './constants'
import { getSelectedSavantFreeModel } from '../state/savant-free-model-store'

export function getAgentIdForMode(agentMode: AgentMode): string {
  // In SavantFree the mode axis collapses to the free root agent. HYBRID is
  // the default mode (FID-2026-0805-001 renamed EDIT → HYBRID); the check is
  // mode-agnostic so any mode in a free build resolves to the free root agent.
  if (IS_SAVANT_FREE && agentMode === 'HYBRID') {
    return getSavantFreeRootAgentIdForModel(getSelectedSavantFreeModel())
  }

  return AGENT_MODE_TO_ID[agentMode]
}
