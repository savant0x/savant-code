import { createSavant } from './savant'

const definition = {
  ...createSavant('free', {
    noAskUser: true,
    model: 'google/gemini-3.1-pro-preview',
    providerOptions: {},
  }),
  id: 'savant-gemini-evals',
  displayName: 'Savant the Gemini Orchestrator',
}

export default definition
