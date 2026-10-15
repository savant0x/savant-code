import { SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
  }),
  id: 'savant-free-deepseek-flash',
  displayName: 'Savant the DeepSeek Flash Free Orchestrator',
}

export default definition
