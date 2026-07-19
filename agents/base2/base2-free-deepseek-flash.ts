import { FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@savant-code/common/constants/savant-free-models'
import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  }),
  id: 'base2-free-deepseek-flash',
  displayName: 'Savant the DeepSeek Flash Free Orchestrator',
}

export default definition
