import { beforeEach, describe, expect, test } from 'bun:test'

import { validateAgents } from '../templates/agent-validation'
import { DynamicAgentDefinitionSchema } from '../types/dynamic-agent-template'
import { getStubProjectFileContext } from '../util/file'

import type { DynamicAgentTemplate } from '../types/dynamic-agent-template'
import type { AgentState } from '../types/session-state'
import type { ProjectFileContext } from '../util/file'
import type { Logger } from '@savant-code/common/types/contracts/logger'

describe('Agent Validation', () => {
  let mockFileContext: ProjectFileContext
  let mockAgentTemplate: DynamicAgentTemplate
  const logger: Logger = {
    debug: () => {},
    error: () => {},
    info: () => {},
    warn: () => {},
  }

  beforeEach(() => {
    mockFileContext = getStubProjectFileContext()

    mockAgentTemplate = {
      id: 'test-agent',
      version: '1.0.0',
      displayName: 'Test Agent',
      spawnerPrompt: 'Testing',
      model: 'claude-3-5-sonnet-20241022',
      outputMode: 'structured_output' as const,
      mcpServers: {},
      toolNames: ['set_output'],
      spawnableAgents: [],
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      inheritParentModel: true,
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test user prompt',
      stepPrompt: 'Test agent step prompt',
    }
  })

  describe('HandleSteps Parsing', () => {
    test('should validate agent config with handleSteps function', () => {
      const agentConfig = {
        id: 'test-agent',
        version: '1.0.0',
        displayName: 'Test Agent',
        spawnerPrompt: 'Testing handleSteps',
        model: 'claude-3-5-sonnet-20241022',
        outputMode: 'structured_output' as const,
        toolNames: ['set_output'],
        systemPrompt: 'You are a test agent',
        instructionsPrompt: 'Process: {prompt}',
        stepPrompt: 'Continue processing',
        handleSteps: function* ({
          agentState,
          prompt,
          params,
        }: {
          agentState: AgentState
          prompt?: string
          params?: any
        }) {
          yield {
            toolName: 'set_output',
            input: { message: 'Test completed' },
          }
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(agentConfig)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(typeof result.data.handleSteps).toBe('function')
      }
    })

    test('should convert handleSteps function to string', async () => {
      const handleStepsFunction = function* ({
        agentState,
        prompt,
        params,
      }: {
        agentState: AgentState
        prompt?: string
        params?: any
      }) {
        yield {
          toolName: 'set_output',
          input: { message: 'Hello from generator' },
        }
      }

      const agentTemplates = {
        'test-agent.ts': {
          ...mockAgentTemplate,
          handleSteps: handleStepsFunction.toString(),
        },
      }

      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates,
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors).toHaveLength(0)
      expect(result.templates['test-agent']).toBeDefined()
      expect(typeof result.templates['test-agent'].handleSteps).toBe('string')
    })

    // Note: The validation that required set_output tool for structured_output mode was
    // intentionally disabled to allow handleSteps to use set_output while the LLM does not
    // have access to the set_output tool.
    test('should allow structured_output mode without set_output tool in toolNames', () => {
      const {
        DynamicAgentTemplateSchema,
      } = require('../types/dynamic-agent-template')

      const agentConfig = {
        id: 'test-agent',
        version: '1.0.0',
        displayName: 'Test Agent',
        spawnerPrompt: 'Testing',
        model: 'claude-3-5-sonnet-20241022',
        outputMode: 'structured_output' as const,
        systemPrompt: 'Test',
        instructionsPrompt: 'Test',
        stepPrompt: 'Test',
        toolNames: ['end_turn'], // Missing set_output - now allowed
        spawnableAgents: [],
        handleSteps:
          'function* () { yield { toolName: "set_output", input: {} } }',
      }

      const result = DynamicAgentTemplateSchema.safeParse(agentConfig)
      expect(result.success).toBe(true)
    })

    // Note: The validation that rejected set_output without structured_output mode was
    // intentionally disabled to allow parent agents to have set_output tool with 'last_message'
    // outputMode while their subagents use 'structured_output' (preserves prompt caching).
    test('should allow set_output tool without structured_output mode', () => {
      const {
        DynamicAgentTemplateSchema,
      } = require('../types/dynamic-agent-template')

      const agentConfig = {
        id: 'test-agent',
        version: '1.0.0',
        displayName: 'Test Agent',
        spawnerPrompt: 'Testing',
        model: 'claude-3-5-sonnet-20241022',
        outputMode: 'last_message' as const, // Not structured_output
        toolNames: ['end_turn', 'set_output'], // Has set_output - now allowed
        spawnableAgents: [],
        systemPrompt: 'Test',
        instructionsPrompt: 'Test',
        stepPrompt: 'Test',
      }

      const result = DynamicAgentTemplateSchema.safeParse(agentConfig)
      expect(result.success).toBe(true)
    })

    test('should validate that handleSteps is a generator function', async () => {
      const agentTemplates = {
        'test-agent.ts': {
          ...mockAgentTemplate,
          handleSteps: 'function () { return "not a generator" }', // Missing *
        },
      }

      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates,
      }

      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.validationErrors[0].message).toContain('generator function')
      expect(result.validationErrors[0].message).toContain('function*')
    })
    test('should verify loaded template handleSteps matches original function toString', async () => {
      // Create a generator function
      const originalFunction = function* ({
        agentState,
        prompt,
        params,
      }: {
        agentState: AgentState
        prompt?: string
        params?: any
      }) {
        yield {
          toolName: 'set_output',
          input: { message: 'Test output', data: params },
        }
      }

      // Get the string representation
      const expectedStringified = originalFunction.toString()

      // Create agent templates with the function
      const agentTemplates = {
        'test-agent.ts': {
          ...mockAgentTemplate,
          handleSteps: expectedStringified,
        },
      }

      const fileContext: ProjectFileContext = {
        ...mockFileContext,
        agentTemplates,
      }

      // Load agents through the service
      const result = validateAgents({
        agentTemplates: fileContext.agentTemplates || {},
        logger,
      })

      // Verify no validation errors
      expect(result.validationErrors).toHaveLength(0)
      expect(result.templates['test-agent']).toBeDefined()

      // Verify the loaded template's handleSteps field matches the original toString
      expect(result.templates['test-agent'].handleSteps).toBe(
        expectedStringified,
      )
      expect(typeof result.templates['test-agent'].handleSteps).toBe('string')
    })
  })
})
