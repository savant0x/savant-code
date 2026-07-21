import { createSavant } from './savant'

const definition = {
  ...createSavant('default', { analyzeOnly: true }),
  id: 'savant-analyze',
  displayName: 'Savant the Analyzer',
  spawnerPrompt:
    'Read-only analysis agent. Answers questions, explores code, and performs research, but never writes files or transitions the ECHO FSM.',
}

export default definition
