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

  describe('Schema Validation', () => {
    describe('Default Schema Behavior', () => {
      it('should have no prompt schema when no inputSchema provided', async () => {
        const fileContext: ProjectFileContext = {
          ...mockFileContext,
          agentTemplates: {
            'no-prompt-schema.ts': {
              id: 'no-prompt-schema-agent',
              version: '1.0.0',
              displayName: 'No Prompt Schema Agent',
              spawnerPrompt: 'Test agent without prompt schema',
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
              // No inputSchema
            },
          },
        }

        const result = validateAgents({
          agentTemplates: fileContext.agentTemplates || {},
          logger,
        })

        expect(result.validationErrors).toHaveLength(0)
        expect(result.templates).toHaveProperty('no-prompt-schema-agent')
        expect(
          result.templates['no-prompt-schema-agent'].inputSchema.prompt,
        ).toBeUndefined()
      })

      it('should not have params schema when no paramsSchema provided', async () => {
        const fileContext: ProjectFileContext = {
          ...mockFileContext,
          agentTemplates: {
            'no-params-schema.ts': {
              id: 'no-params-schema-agent',
              version: '1.0.0',
              displayName: 'No Params Schema Agent',
              spawnerPrompt: 'Test agent without params schema',
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
              // No paramsSchema
            },
          },
        }

        const result = validateAgents({
          agentTemplates: fileContext.agentTemplates || {},
          logger,
        })

        expect(result.validationErrors).toHaveLength(0)
        expect(result.templates).toHaveProperty('no-params-schema-agent')
        expect(
          result.templates['no-params-schema-agent'].inputSchema.params,
        ).toBeUndefined()
      })
    })

    describe('Error Message Quality', () => {
      it('should include file path in error messages', async () => {
        const fileContext: ProjectFileContext = {
          ...mockFileContext,
          agentTemplates: {
            'error-context.ts': {
              id: 'error-context-agent',
              version: '1.0.0',
              displayName: 'Error Context Agent',
              spawnerPrompt: 'Test agent for error context',
              model: 'anthropic/claude-4-sonnet-20250522',
              systemPrompt: 'Test system prompt',
              instructionsPrompt: 'Test user prompt',
              stepPrompt: 'Test step prompt',
              inputSchema: {
                prompt: {} as { type: 'string' }, // Invalid - missing type at runtime
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
        expect(result.validationErrors[0].filePath).toBe('error-context.ts')
      })
    })

    describe('Edge Cases', () => {
      it('should handle git-committer agent schema correctly', async () => {
        const fileContext: ProjectFileContext = {
          ...mockFileContext,
          agentTemplates: {
            'git-committer.ts': {
              id: 'savant-code-git-committer',
              version: '0.0.1',
              displayName: 'Git Committer',
              spawnerPrompt:
                'A git committer agent specialized to commit current changes with an appropriate commit message.',
              model: 'google/gemini-2.5-pro',
              systemPrompt: 'Test system prompt',
              instructionsPrompt: 'Test user prompt',
              stepPrompt: 'Test step prompt',
              inputSchema: {
                prompt: {
                  type: 'string',
                  description: 'What changes to commit',
                },
                params: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                    },
                  },
                  required: ['message'],
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
        expect(result.templates).toHaveProperty('savant-code-git-committer')

        const template = result.templates['savant-code-git-committer']
        const paramsSchema = template.inputSchema.params!

        expect(paramsSchema.safeParse('').success).toBe(false) // Too short
        expect(template.inputSchema.params).toBeDefined()
        // Test that the params schema properly validates the message property
        // This should succeed with a message property
        const validResult = paramsSchema.safeParse({
          message: 'test commit message',
        })
        expect(validResult.success).toBe(true)

        // This should fail without the required message property
        const invalidResult = paramsSchema.safeParse({})
        expect(invalidResult.success).toBe(false)
      })

      it('should handle empty inputSchema object', async () => {
        const fileContext: ProjectFileContext = {
          ...mockFileContext,
          agentTemplates: {
            'empty-schema.ts': {
              id: 'empty-schema-agent',
              version: '1.0.0',
              displayName: 'Empty Schema Agent',
              model: 'anthropic/claude-4-sonnet-20250522',
              systemPrompt: 'Test system prompt',
              instructionsPrompt: 'Test user prompt',
              stepPrompt: 'Test step prompt',
              spawnerPrompt: 'Test agent with empty schema',
              inputSchema: {},
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
        expect(result.templates).toHaveProperty('empty-schema-agent')

        // Empty schemas should have no prompt schema
        expect(
          result.templates['empty-schema-agent'].inputSchema.prompt,
        ).toBeUndefined()
      })
    })
  })
})
