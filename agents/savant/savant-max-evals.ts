import { createSavant } from './savant'

const definition = {
  ...createSavant('max', { noAskUser: true }),
  id: 'savant-max-evals',
  displayName: 'Savant the Max Evals Orchestrator',
}

export default definition
