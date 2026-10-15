import { publisher } from './constants'
import { createContextPrunerHandleSteps } from './context-pruner/handle-steps'

import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'context-pruner',
  publisher,
  displayName: 'Context Pruner',
  // FID-2026-0814-009 B-08: display metadata only — inherits the operator's
  // model via withParentModel; `openrouter/free` is the safe free fallback.
  model: 'openrouter/free',

  spawnerPrompt: `Spawn this agent between steps to prune context, summarizing the conversation into a condensed format when context exceeds the limit.`,

  inputSchema: {
    params: {
      type: 'object',
      properties: {
        maxContextLength: {
          type: 'number',
        },
        assistantToolBudget: {
          type: 'number',
        },
        userBudget: {
          type: 'number',
        },
        cacheExpiryMs: {
          type: 'number',
        },
      },
      required: [],
    },
  },

  inheritParentSystemPrompt: true,
  includeMessageHistory: true,

  handleSteps: createContextPrunerHandleSteps(),
}

export default definition
