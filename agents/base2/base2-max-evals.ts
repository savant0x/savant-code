import { createBase2 } from './base2'

const definition = {
  ...createBase2('max', { noAskUser: true }),
  id: 'base2-max-evals',
  displayName: 'Savant the Max Evals Orchestrator',
}

export default definition
