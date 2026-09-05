// Agent Registry test family — agent-ID parsing and database fetch.
// Sibling of the Loop-341 decomposition (shared lifecycle in
// ./agent-registry-test-harness).
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { describe, expect, it } from 'bun:test'

import { getAgentTemplate } from '../agent-registry'
import {
  getImpl,
  registerAgentRegistryLifecycle,
  setImpl,
} from './agent-registry-test-harness'

import type { AgentTemplate } from '../types'

describe('Agent Registry', () => {
  registerAgentRegistryLifecycle()

  describe('parseAgentId (tested through getAgentTemplate)', () => {
    it('should handle agent IDs without publisher (local agents)', async () => {
      const localAgents = {
        'my-agent': {
          id: 'my-agent',
          displayName: 'My Agent',
          systemPrompt: 'Test',
          instructionsPrompt: 'Test',
          stepPrompt: 'Test',
          mcpServers: emptyMcpServers,
          toolNames: ['end_turn'],
          spawnableAgents: [],
          outputMode: 'last_message',
          includeMessageHistory: true,
          inheritParentSystemPrompt: false,
          model: 'anthropic/claude-4-sonnet-20250522',
          spawnerPrompt: 'Test',
          inputSchema: {},
        } as AgentTemplate,
      }

      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'my-agent',
        localAgentTemplates: localAgents,
      })
      expect(result).toBeTruthy()
      expect(result?.id).toBe('my-agent')
    })

    it('should handle agent IDs with publisher but no version', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'publisher/agent-name',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should handle agent IDs with publisher and version', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'publisher/agent-name@1.0.0',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should return null for invalid agent ID formats', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'invalid/format/with/too/many/slashes',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })
  })

  describe('fetchAgentFromDatabase', () => {
    it('should return null when agent not found in database', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'nonexistent/agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should handle database query for specific version', async () => {
      const mockAgentData: AgentTemplate = {
        id: 'test-publisher/test-agent@1.0.0',
        displayName: 'Test Agent',
        systemPrompt: 'Test system prompt',
        instructionsPrompt: 'Test instructions',
        stepPrompt: 'Test step prompt',
        toolNames: ['end_turn'],
        mcpServers: emptyMcpServers,
        inputSchema: {},
        spawnableAgents: [],
        outputMode: 'last_message',
        includeMessageHistory: true,
        inheritParentSystemPrompt: false,
        model: 'anthropic/claude-4-sonnet-20250522',
        spawnerPrompt: 'Test',
      }

      setImpl({
        ...getImpl(),
        fetchAgentFromDatabase: async () => mockAgentData,
      })

      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/test-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(result).toBeTruthy()
      expect(result?.id).toBe('test-publisher/test-agent@1.0.0')
    })
  })
})
