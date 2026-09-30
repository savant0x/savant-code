// getAgentPrompt test family — MODEL_INFO placeholder substitution. Sibling
// of the Loop-339 decomposition (shared fixtures in ./strings-test-harness).
import { describe, test, expect } from 'bun:test'

import { getAgentPrompt } from '../strings'
import { PLACEHOLDER } from '../types'
import {
  createMockAgentState,
  createMockAgentTemplate,
  createMockFileContext,
  createMockLogger,
} from './strings-test-harness'

import type { AgentTemplate } from '../types'

describe('getAgentPrompt', () => {
  describe('spawnerPrompt inclusion in instructionsPrompt', () => {
    test('replaces MODEL_INFO with provided modelInfoText', async () => {
      const agentTemplate = createMockAgentTemplate({
        id: 'model-info-agent',
        systemPrompt: `Model info: ${PLACEHOLDER.MODEL_INFO}`,
      })
      const agentTemplates: Record<string, AgentTemplate> = {
        'model-info-agent': agentTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate,
        promptType: { type: 'systemPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('model-info-agent'),
        agentTemplates,
        modelInfoText: 'You are running on Test Model.',
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
      })

      expect(result).toBe('Model info: You are running on Test Model.')
      expect(result).not.toContain(PLACEHOLDER.MODEL_INFO)
    })

    test('falls back to model id when MODEL_INFO is omitted', async () => {
      const agentTemplate = createMockAgentTemplate({
        id: 'model-info-fallback-agent',
        model: 'openai/gpt-4o',
        systemPrompt: `Model info: ${PLACEHOLDER.MODEL_INFO}.`,
      })
      const agentTemplates: Record<string, AgentTemplate> = {
        'model-info-fallback-agent': agentTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate,
        promptType: { type: 'systemPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('model-info-fallback-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
      })

      expect(result).toContain('Model info:')
      expect(result).toContain('openai/gpt-4o')
      expect(result).not.toContain(PLACEHOLDER.MODEL_INFO)
    })
  })
})
