import { mimoModels } from '@savant-code/common/constants/model-config'

import { createSavant } from './savant'

const definition = {
  ...createSavant('default', {
    model: mimoModels.mimoV25Pro,
  }),
  id: 'savant-mimo',
  displayName: 'Savant the MiMo Orchestrator',
}

export default definition
