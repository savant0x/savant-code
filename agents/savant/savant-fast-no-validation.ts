import { createSavant } from './savant'

const definition = {
  ...createSavant('fast', { hasNoValidation: true }),
  id: 'savant-fast-no-validation',
  displayName: 'Savant the Fast No Validation Orchestrator',
}

export default definition
