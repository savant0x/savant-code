import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { describe, test, expect, mock } from 'bun:test'
import { z } from 'zod/v4'

import {
  buildAgentToolInputSchema,
  buildAgentToolSet,
} from '../templates/prompts'
import { tryTransformAgentToolCall } from '../tools/tool-executor'

import type { AgentTemplate } from '../templates/types'
import type { JSONValue } from '@savant-code/common/types/json'

/** Create a mock logger using bun:test mock() for better test consistency */
const createMockLogger = () => ({
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
})

// FID-2026-0819-005 Loop 291: templates/prompts schema-recovery + direct subagent tool-name suites remain; tools and lookup clusters moved verbatim to sibling files.
describe('Schema handling error recovery', () => {
  describe('ensureJsonSchemaCompatible in templates/prompts.ts', () => {
    test('handles schema that cannot be converted to JSON Schema', async () => {
      // Create a schema that will fail JSON Schema conversion
      // z.function() cannot be converted to JSON Schema
      const problematicSchema = z.function()

      const agentTemplate: AgentTemplate = {
        id: 'test-agent',
        displayName: 'Test Agent',
        spawnerPrompt: 'Test spawner prompt',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string().describe('A test prompt'),
          params: problematicSchema as z.ZodTypeAny as z.ZodSchema<
            Record<string, JSONValue> | undefined
          >,
        },
        outputMode: 'last_message',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      // buildAgentToolSet uses ensureJsonSchemaCompatible internally
      // It should not throw even with problematic schema
      const toolSet = await buildAgentToolSet({
        spawnableAgents: ['test-agent'],
        agentTemplates: { 'test-agent': agentTemplate },
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      // Should have created a tool without throwing
      expect(toolSet['test_agent']).toBeDefined()
      expect(toolSet['test-agent']).toBeUndefined()
    })

    test('buildAgentToolInputSchema handles valid schemas', () => {
      const agentTemplate: AgentTemplate = {
        id: 'valid-agent',
        displayName: 'Valid Agent',
        spawnerPrompt: 'Valid spawner prompt',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string().describe('A valid prompt'),
          params: z.object({ foo: z.string() }),
        },
        outputMode: 'last_message',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const inputSchema = buildAgentToolInputSchema(agentTemplate)

      // Should return a valid schema that can be converted to JSON Schema
      expect(() => z.toJSONSchema(inputSchema, { io: 'input' })).not.toThrow()
    })

    test('buildAgentToolInputSchema handles empty inputSchema', () => {
      const agentTemplate: AgentTemplate = {
        id: 'empty-schema-agent',
        displayName: 'Empty Schema Agent',
        spawnerPrompt: 'Empty schema spawner prompt',
        model: 'gpt-4o-mini',
        inputSchema: {},
        outputMode: 'last_message',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const inputSchema = buildAgentToolInputSchema(agentTemplate)

      // Should return a valid schema
      expect(() => z.toJSONSchema(inputSchema, { io: 'input' })).not.toThrow()
    })
  })

  describe('direct subagent tool names', () => {
    test('uses underscored tool aliases while preserving hyphenated agent IDs', () => {
      const transformed = tryTransformAgentToolCall({
        toolName: 'scout',
        input: { prompt: 'Find relevant files' },
        spawnableAgents: ['savant-code/scout@1.0.0'],
      })

      expect(transformed).toEqual({
        toolName: 'spawn_agents',
        input: {
          agents: [
            {
              agent_type: 'savant-code/scout@1.0.0',
              prompt: 'Find relevant files',
            },
          ],
        },
      })
    })
  })
})
