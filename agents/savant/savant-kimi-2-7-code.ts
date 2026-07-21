import { moonshotModels } from '@savant-code/common/constants/model-config'

import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    model: moonshotModels.kimiK27Code,
  }),
  id: 'savant-kimi-2-7-code',
  displayName: 'Savant the Kimi K2.7 Code Orchestrator',
}

export default definition
