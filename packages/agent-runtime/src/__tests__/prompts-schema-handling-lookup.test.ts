import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { describe, test, expect, mock } from 'bun:test'
import { z } from 'zod/v4'

import { handleLookupAgentInfo } from '../tools/handlers/tool/lookup-agent-info'

import type { AgentTemplate } from '../templates/types'

/** Create a mock logger using bun:test mock() for better test consistency */
const createMockLogger = () => ({
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
})

// FID-2026-0819-005 Loop 291: the lookup-agent-info toJSONSchema suites moved verbatim from prompts-schema-handling.test.ts; createMockLogger copied verbatim.
describe('Schema handling error recovery', () => {
  describe('toJSONSchema error handling in lookup-agent-info.ts', () => {
    test('handles schemas that cannot be converted to JSON Schema', async () => {
      // Create an agent template with a problematic output schema
      const agentTemplate: AgentTemplate = {
        id: 'problematic-output-agent',
        displayName: 'Problematic Output Agent',
        spawnerPrompt: 'Test',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string(),
        },
        outputMode: 'structured_output',
        outputSchema: z.function() as z.ZodTypeAny, // This cannot be converted
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const localAgentTemplates = {
        'problematic-output-agent': agentTemplate,
      }

      const result = await handleLookupAgentInfo({
        toolCall: {
          toolCallId: 'test-call',
          toolName: 'lookup_agent_info',
          input: { agentId: 'problematic-output-agent' },
        },
        previousToolCallFinished: Promise.resolve(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        localAgentTemplates,
        logger: createMockLogger(),
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      // Should return a result without throwing
      expect(result.output).toBeDefined()

      // Parse the output to check the fallback
      const outputValue = result.output[0]
      expect(outputValue.type).toBe('json')
      if (outputValue.type === 'json') {
        const parsed = outputValue.value as {
          found: boolean
          agent?: { outputSchema?: unknown }
        }
        expect(parsed.found).toBe(true)
        // The outputSchema should be the fallback
        expect(parsed.agent?.outputSchema).toEqual({
          type: 'object',
          description: 'Schema unavailable',
        })
      }
    })

    test('handles valid schemas correctly', async () => {
      const agentTemplate: AgentTemplate = {
        id: 'valid-output-agent',
        displayName: 'Valid Output Agent',
        spawnerPrompt: 'Test',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string().describe('User prompt'),
          params: z.object({
            verbose: z.boolean().optional(),
          }),
        },
        outputMode: 'structured_output',
        outputSchema: z.object({
          result: z.string(),
          success: z.boolean(),
        }),
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: ['read_files'],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const localAgentTemplates = {
        'valid-output-agent': agentTemplate,
      }

      const result = await handleLookupAgentInfo({
        toolCall: {
          toolCallId: 'test-call',
          toolName: 'lookup_agent_info',
          input: { agentId: 'valid-output-agent' },
        },
        previousToolCallFinished: Promise.resolve(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        localAgentTemplates,
        logger: createMockLogger(),
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      const outputValue = result.output[0]
      expect(outputValue.type).toBe('json')
      if (outputValue.type === 'json') {
        const parsed = outputValue.value as {
          found: boolean
          agent?: {
            outputSchema?: {
              type?: string
              properties?: Record<string, unknown>
            }
            inputSchema?: { prompt?: unknown; params?: unknown }
          }
        }
        expect(parsed.found).toBe(true)
        // Should have proper JSON Schema output
        expect(parsed.agent?.outputSchema?.type).toBe('object')
        expect(parsed.agent?.outputSchema?.properties).toHaveProperty('result')
        expect(parsed.agent?.outputSchema?.properties).toHaveProperty('success')
        // Input schema should also be converted
        expect(parsed.agent?.inputSchema?.prompt).toBeDefined()
        expect(parsed.agent?.inputSchema?.params).toBeDefined()
      }
    })

    test('returns not found for non-existent agent', async () => {
      const result = await handleLookupAgentInfo({
        toolCall: {
          toolCallId: 'test-call',
          toolName: 'lookup_agent_info',
          input: { agentId: 'non-existent-agent' },
        },
        previousToolCallFinished: Promise.resolve(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        localAgentTemplates: {},
        logger: createMockLogger(),
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      const outputValue = result.output[0]
      expect(outputValue.type).toBe('json')
      if (outputValue.type === 'json') {
        const parsed = outputValue.value as { found: boolean; error?: string }
        expect(parsed.found).toBe(false)
        expect(parsed.error).toContain('not found')
      }
    })
  })
})
