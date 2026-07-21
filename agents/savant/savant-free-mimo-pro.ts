import { SAVANT_FREE_MIMO_V25_PRO_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
  }),
  id: 'savant-free-mimo-pro',
  displayName: 'Savant the MiMo Pro Free Orchestrator',
}

export default definition
