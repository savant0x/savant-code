import { createSavantDeep } from './savant-deep'

const definition = {
  ...createSavantDeep({ noAskUser: true }),
  id: 'savant-deep-evals',
  displayName: 'Savant the Codex Evals Orchestrator',
}

export default definition
