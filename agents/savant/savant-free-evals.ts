import { createSavant } from './savant'

const definition = {
  ...createSavant('free', { noAskUser: true }),
  id: 'savant-free-evals',
  displayName: 'Savant the Free Evals Orchestrator',
}

export default definition
