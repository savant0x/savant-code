import { getSavantFreeRootAgentIdForModel } from '@savant-code/common/constants/free-agents'

import { AGENT_MODE_TO_ID, IS_SAVANT_FREE, type AgentMode } from './constants'
import { getSelectedSavantFreeModel } from '../state/savant-free-model-store'

export function getAgentIdForMode(agentMode: AgentMode): string {
  if (IS_SAVANT_FREE && agentMode === 'EDIT') {
    return getSavantFreeRootAgentIdForModel(getSelectedSavantFreeModel())
  }

  return AGENT_MODE_TO_ID[agentMode]
}
