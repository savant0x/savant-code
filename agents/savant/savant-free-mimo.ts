import { SAVANT_FREE_MIMO_V25_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_MIMO_V25_MODEL_ID,
  }),
  id: 'savant-free-mimo',
  displayName: 'Savant the MiMo Free Orchestrator',
}

export default definition
