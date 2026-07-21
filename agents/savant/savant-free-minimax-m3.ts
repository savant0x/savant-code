import { SAVANT_FREE_MINIMAX_M3_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_MINIMAX_M3_MODEL_ID,
  }),
  id: 'savant-free-minimax-m3',
  displayName: 'Savant the MiniMax M3 Free Orchestrator',
}

export default definition
