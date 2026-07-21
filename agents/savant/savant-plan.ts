import { createSavant } from './savant'

const definition = {
  ...createSavant('default', { planOnly: true }),
  id: 'savant-plan',
  displayName: 'Savant the Plan-Only Orchestrator',
}

export default definition
