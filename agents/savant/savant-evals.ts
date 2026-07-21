import { createSavant } from './savant'

const definition = {
  ...createSavant('default', { noAskUser: true }),
  id: 'savant-evals',
  displayName: 'Savant the Evals Orchestrator',
}

export default definition
