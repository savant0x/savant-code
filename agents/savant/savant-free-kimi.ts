import { SAVANT_FREE_KIMI_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_KIMI_MODEL_ID,
  }),
  id: 'savant-free-kimi',
  displayName: 'Savant the Kimi Free Orchestrator',
}

export default definition
