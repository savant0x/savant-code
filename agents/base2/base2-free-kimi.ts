import { FREEBUFF_KIMI_MODEL_ID } from '@savant-code/common/constants/savant-free-models'
import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FREEBUFF_KIMI_MODEL_ID,
  }),
  id: 'base2-free-kimi',
  displayName: 'Savant the Kimi Free Orchestrator',
}

export default definition
