import { FREEBUFF_MIMO_V25_MODEL_ID } from '@savant-code/common/constants/savant-free-models'
import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FREEBUFF_MIMO_V25_MODEL_ID,
  }),
  id: 'base2-free-mimo',
  displayName: 'Savant the MiMo Free Orchestrator',
}

export default definition
