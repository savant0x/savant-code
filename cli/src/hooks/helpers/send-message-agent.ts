import { resolveActiveModel } from '../../state/savant-free-model-store'
import { getAgentIdForMode } from '../../utils/savant-free-agent-selection'

import type { AgentMode } from '../../utils/constants'
import type { AgentDefinition, MessageContent } from '@savant-code/sdk'

// Choose the agent definition by explicit selection or mode-based fallback.
export const resolveAgent = (
  agentMode: AgentMode,
  agentId: string | undefined,
  agentDefinitions: AgentDefinition[],
): AgentDefinition | string => {
  const selectedAgentDefinition =
    agentId && agentDefinitions.length > 0
      ? agentDefinitions.find((definition) => definition.id === agentId)
      : undefined

  return selectedAgentDefinition ?? agentId ?? getAgentIdForMode(agentMode)
}

// FID-2026-0814-004 H-08/H-09: the UI model store is the SINGLE source of
// truth for the effective model. The old code-preference-only read left the
// main agent running a bundled paid default (minimax-m3) whenever the model
// was selected via the GUI/free store — resolveActiveModel() reads the store,
// which fail-safes to openrouter/free (paid) or the free-catalog default and
// can never resolve to a paid model on an empty store.
export const applySavantCodeModelOverride = (
  agent: AgentDefinition | string,
  agentDefinitions: AgentDefinition[],
): AgentDefinition | string => {
  const modelOverride = resolveActiveModel()
  if (!modelOverride) return agent

  // If agent is a string (agent ID), look it up
  const agentDef =
    typeof agent === 'string'
      ? agentDefinitions.find((def) => def.id === agent)
      : agent

  if (!agentDef) return agent

  // Only override if the model is actually different
  if (agentDef.model !== modelOverride) {
    return {
      ...agentDef,
      model: modelOverride,
    }
  }

  return agent
}

// Respect bash context, but avoid sending empty prompts when only images are attached.
export const buildPromptWithContext = (
  promptWithBashContext: string,
  messageContent: MessageContent[] | undefined,
) => {
  const trimmedPrompt = promptWithBashContext.trim()
  if (trimmedPrompt.length > 0) {
    return promptWithBashContext
  }

  if (messageContent && messageContent.length > 0) {
    return 'See attached image(s)'
  }

  return ''
}
