// Agent Registry test family — assembleLocalAgentTemplates (static/dynamic
// merging and validation errors). Sibling of the Loop-341 decomposition
// (shared lifecycle in ./agent-registry-test-harness).
import { describe, expect, it } from 'bun:test'

import { assembleLocalAgentTemplates } from '../agent-registry'
import {
  getFileContext,
  getImpl,
  registerAgentRegistryLifecycle,
} from './agent-registry-test-harness'

import type { DynamicAgentTemplate } from '@savant-code/common/types/dynamic-agent-template'
import type { ProjectFileContext } from '@savant-code/common/util/file'

describe('Agent Registry', () => {
  registerAgentRegistryLifecycle()

  describe('assembleLocalAgentTemplates', () => {
    it('should merge static and dynamic templates', () => {
      const fileContext: ProjectFileContext = {
        ...getFileContext(),
        agentTemplates: {
          'custom-agent.ts': {
            id: 'custom-agent',
            displayName: 'Custom Agent',
            systemPrompt: 'Custom system prompt',
            instructionsPrompt: 'Custom instructions',
            stepPrompt: 'Custom step prompt',
            toolNames: ['end_turn'],
            spawnableAgents: [],
            outputMode: 'last_message',
            includeMessageHistory: true,
            model: 'anthropic/claude-4-sonnet-20250522',
            spawnerPrompt: 'Custom test',
          },
        },
      }

      const result = assembleLocalAgentTemplates({
        ...getImpl(),
        fileContext,
      })

      // Should have dynamic template
      expect(result.agentTemplates).toHaveProperty('custom-agent')
      expect(result.agentTemplates['custom-agent'].displayName).toBe(
        'Custom Agent',
      )

      // Should have no validation errors
      expect(result.validationErrors).toHaveLength(0)
    })

    it('should handle validation errors in dynamic templates', () => {
      const fileContext: ProjectFileContext = {
        ...getFileContext(),
        agentTemplates: {
          'invalid-agent.ts': {
            id: 'invalid-agent',
            displayName: 'Invalid Agent',
            // Missing required fields to trigger validation error
          } as Partial<DynamicAgentTemplate>, // invalid - missing required fields
        },
      }

      const result = assembleLocalAgentTemplates({
        ...getImpl(),
        fileContext,
      })

      // Should not have invalid template
      expect(result.agentTemplates).not.toHaveProperty('invalid-agent')

      // Should have validation errors
      expect(result.validationErrors.length).toBeGreaterThan(0)
    })

    it('should handle empty agentTemplates', () => {
      const fileContext: ProjectFileContext = {
        ...getFileContext(),
        agentTemplates: {},
      }

      const result = assembleLocalAgentTemplates({
        ...getImpl(),
        fileContext,
      })

      // Should have no validation errors
      expect(result.validationErrors).toHaveLength(0)

      // Should return some agent templates (static ones from our mock)
      expect(Object.keys(result.agentTemplates).length).toBeGreaterThan(0)
    })
  })
})
