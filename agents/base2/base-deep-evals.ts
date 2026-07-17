import { createBaseDeep } from './base-deep'

const definition = {
  ...createBaseDeep({ noAskUser: true }),
  id: 'base-deep-evals',
  displayName: 'Savant the Codex Evals Orchestrator',
}

export default definition
