import { SAVANT_FREE_GLM_V52_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_GLM_V52_MODEL_ID,
  }),
  id: 'savant-free-glm',
  displayName: 'Savant the GLM 5.2 Free Orchestrator',
}

export default definition
