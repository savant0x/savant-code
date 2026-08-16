import { createTmuxCliHandleSteps } from './tmux-cli/handle-steps'
import { outputSchema } from './tmux-cli/output-schema'
import {
  inputSchema,
  instructionsPrompt,
  spawnerPrompt,
  systemPrompt,
} from './tmux-cli/prompts'

import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'tmux-cli',
  displayName: 'Tmux CLI Agent',
  // FID-2026-0814-009 B-08: display metadata only — inherits the operator's
  // model via withParentModel; `openrouter/free` is the safe free fallback.
  model: 'openrouter/free',
  // Privacy, not model billing: infra helpers deny data collection so browser/
  // DB/token/CLI content never reaches provider training data (B-06).
  providerOptions: {
    data_collection: 'deny',
  },

  spawnerPrompt,

  inputSchema,

  outputMode: 'structured_output',
  outputSchema,
  includeMessageHistory: false,

  toolNames: [
    'run_terminal_command',
    'read_files',
    'set_output',
    'add_message',
  ],

  systemPrompt,

  instructionsPrompt,

  handleSteps: createTmuxCliHandleSteps(),
}

export default definition
