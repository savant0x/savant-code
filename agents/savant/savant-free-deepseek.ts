import { SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
  }),
  id: 'savant-free-deepseek',
  displayName: 'Savant the DeepSeek Free Orchestrator',
}

export default definition
