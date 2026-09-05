// Agent Registry test family — clearDatabaseCache and agent-ID edge cases.
// Sibling of the Loop-341 decomposition (shared lifecycle in
// ./agent-registry-test-harness).
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { describe, expect, it, mock } from 'bun:test'

import { getAgentTemplate } from '../agent-registry'
import {
  getImpl,
  registerAgentRegistryLifecycle,
  setImpl,
} from './agent-registry-test-harness'

import type { AgentTemplate } from '../types'

describe('Agent Registry', () => {
  registerAgentRegistryLifecycle()

  describe('clearDatabaseCache', () => {
    it('should clear the database cache', async () => {
      const mockAgentData: AgentTemplate = {
        id: 'test-publisher/cache-test-agent@1.0.0',
        displayName: 'Cache Test Agent',
        systemPrompt: 'Cache test system prompt',
        instructionsPrompt: 'Cache test instructions',
        stepPrompt: 'Cache test step prompt',
        inputSchema: {},
        mcpServers: emptyMcpServers,
        toolNames: ['end_turn'],
        spawnableAgents: [],
        outputMode: 'last_message',
        includeMessageHistory: true,
        inheritParentSystemPrompt: false,
        model: 'anthropic/claude-4-sonnet-20250522',
        spawnerPrompt: 'Cache test',
      }

      const selectSpy = mock(async () => mockAgentData)
      setImpl({
        ...getImpl(),
        fetchAgentFromDatabase: selectSpy,
      })

      // First call - should hit database and populate cache
      await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/cache-test-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(selectSpy).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/cache-test-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(selectSpy).toHaveBeenCalledTimes(1)

      getImpl().databaseAgentCache.clear()

      // Third call - should hit database again after cache clear
      await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/cache-test-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(selectSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty agent ID', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: '',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should handle agent ID with multiple @ symbols', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'publisher/agent@1.0.0@extra',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should handle agent ID with only @ symbol', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'publisher/agent@',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })
  })
})
