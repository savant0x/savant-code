import { beforeEach, describe, expect, it } from 'bun:test'

import { validateAgents } from '../templates/agent-validation'
import { getStubProjectFileContext } from '../util/file'

import type { ProjectFileContext } from '../util/file'
import type { Logger } from '@savant-code/common/types/contracts/logger'

describe('Agent Validation', () => {
  let mockFileContext: ProjectFileContext
  const logger: Logger = {
    debug: () => {},
    error: () => {},
    info: () => {},
    warn: () => {},
  }

  beforeEach(() => {
    mockFileContext = getStubProjectFileContext()
  })

  describe('Dynamic Agent Loading', () => {
    it('should load valid dynamic agent template', async () => {
      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates: {
          'brainstormer.ts': {
            id: 'brainstormer',
            version: '1.0.0',
            displayName: 'Brainy',
            spawnerPrompt: 'Creative thought partner',
            model: 'anthropic/claude-4-sonnet-20250522',
            systemPrompt: 'You are a creative brainstormer.',
            instructionsPrompt: 'Help brainstorm ideas.',
            stepPrompt: 'Continue brainstorming.',
            toolNames: ['end_turn', 'spawn_agents'],
            spawnableAgents: ['thinker', 'researcher'],
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
          },
        },
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors).toHaveLength(0)
      expect(result.templates).toHaveProperty('brainstormer')
      expect(result.templates.brainstormer.displayName).toBe('Brainy')
      expect(result.templates.brainstormer.id).toBe('brainstormer')
    })

    it('should merge static and dynamic templates', async () => {
      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates: {
          'custom.ts': {
            id: 'custom-agent',
            version: '1.0.0',
            displayName: 'Custom',
            spawnerPrompt: 'Custom agent',
            model: 'anthropic/claude-4-sonnet-20250522',
            systemPrompt: 'Custom system prompt',
            instructionsPrompt: 'Custom user prompt',
            stepPrompt: 'Custom step prompt',
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
            toolNames: ['end_turn'],
            spawnableAgents: [],
          },
        },
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      // Should have dynamic templates
      expect(result.templates).toHaveProperty('custom-agent') // Dynamic
    })

    it('should handle agents with JSON schemas', async () => {
      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates: {
          'schema-agent.ts': {
            id: 'schema-agent',
            version: '1.0.0',
            displayName: 'Schema Agent',
            spawnerPrompt: 'Agent with JSON schemas',
            model: 'anthropic/claude-4-sonnet-20250522',
            systemPrompt: 'Test system prompt',
            instructionsPrompt: 'Test user prompt',
            stepPrompt: 'Test step prompt',
            inputSchema: {
              prompt: {
                type: 'string',
                description: 'A test prompt',
              },
              params: {
                type: 'object',
                properties: {
                  temperature: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            },
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
            toolNames: ['end_turn'],
            spawnableAgents: [],
          },
        },
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors).toHaveLength(0)
      expect(result.templates).toHaveProperty('schema-agent')
      expect(result.templates['schema-agent'].inputSchema.prompt).toBeDefined()
      expect(result.templates['schema-agent'].inputSchema.params).toBeDefined()
    })

    it('should return validation errors for invalid schemas', async () => {
      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates: {
          'invalid-schema-agent.ts': {
            id: 'invalid-schema-agent',
            version: '1.0.0',
            displayName: 'Invalid Schema Agent',
            spawnerPrompt: 'Agent with invalid schemas',
            model: 'anthropic/claude-4-sonnet-20250522',
            systemPrompt: 'Test system prompt',
            instructionsPrompt: 'Test user prompt',
            stepPrompt: 'Test step prompt',
            inputSchema: {
              prompt: {} as { type: 'string' }, // invalid prompt schema
            },
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
            toolNames: ['end_turn'],
            spawnableAgents: [],
          },
        },
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors).toHaveLength(1)
      expect(result.validationErrors[0].message).toContain(
        'Schema validation failed',
      )
      expect(result.templates).not.toHaveProperty('invalid-schema-agent')
    })

    it('should handle missing override field as non-override template', async () => {
      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates: {
          'no-override-field.ts': {
            id: 'no-override-agent',
            version: '1.0.0',
            // No override field - should be treated as non-override
            displayName: 'No Override Agent',
            spawnerPrompt: 'Agent without override field',
            model: 'anthropic/claude-4-sonnet-20250522',
            systemPrompt: 'Test system prompt',
            instructionsPrompt: 'Test user prompt',
            stepPrompt: 'Test step prompt',
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
            toolNames: ['end_turn'],
            spawnableAgents: [],
          },
        },
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors).toHaveLength(0)
      expect(result.templates).toHaveProperty('no-override-agent')
    })

    it('should validate spawnable agents including dynamic agents from first pass', async () => {
      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates: {
          'git-committer.ts': {
            id: 'savant-code-git-committer',
            version: '0.0.1',
            displayName: 'Git Committer',
            spawnerPrompt: 'A git committer agent',
            model: 'google/gemini-2.5-pro',
            systemPrompt: 'You are an expert software developer.',
            instructionsPrompt: 'Create a commit message.',
            stepPrompt: 'Make sure to end your response.',
            spawnableAgents: [], // No spawnable agents
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
            toolNames: ['end_turn'],
          },
          'spawner.ts': {
            id: 'spawner-agent',
            version: '1.0.0',
            displayName: 'Spawner Agent',
            spawnerPrompt: 'Agent that can spawn git-committer',
            model: 'anthropic/claude-4-sonnet-20250522',
            systemPrompt: 'Test system prompt',
            instructionsPrompt: 'Test user prompt',
            stepPrompt: 'Test step prompt',
            spawnableAgents: ['savant-code-git-committer'], // Should be valid after first pass
            outputMode: 'last_message',
            includeMessageHistory: true,
            inheritParentSystemPrompt: false,
            inheritParentModel: true,
            toolNames: ['end_turn', 'spawn_agents'],
          },
        },
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors).toHaveLength(0)
      expect(result.templates).toHaveProperty('savant-code-git-committer')
      expect(result.templates).toHaveProperty('spawner-agent')
      expect(result.templates['spawner-agent'].spawnableAgents).toContain(
        'savant-code-git-committer', // Full agent ID with prefix
      )
    })
  })
})
