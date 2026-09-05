// Agent Registry test family — getAgentTemplate priority order (local over
// database, database caching). Sibling of the Loop-341 decomposition (shared
// lifecycle in ./agent-registry-test-harness).
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

  describe('getAgentTemplate priority order', () => {
    it('should prioritize local agents over database agents', async () => {
      const localAgents = {
        'test-agent': {
          id: 'test-agent',
          displayName: 'Local Test Agent',
          systemPrompt: 'Local system prompt',
          instructionsPrompt: 'Local instructions',
          stepPrompt: 'Local step prompt',
          mcpServers: emptyMcpServers,
          toolNames: ['end_turn'],
          spawnableAgents: [],
          outputMode: 'last_message',
          includeMessageHistory: true,
          inheritParentSystemPrompt: false,
          model: 'anthropic/claude-4-sonnet-20250522',
          spawnerPrompt: 'Local test',
          inputSchema: {},
        } as AgentTemplate,
      }

      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-agent',
        localAgentTemplates: localAgents,
      })
      expect(result).toBeTruthy()
      expect(result?.displayName).toBe('Local Test Agent')
    })

    it('should use database cache when available', async () => {
      const mockAgentData: AgentTemplate = {
        id: 'test-publisher/cached-agent@1.0.0',
        displayName: 'Cached Agent',
        systemPrompt: 'Cached system prompt',
        instructionsPrompt: 'Cached instructions',
        stepPrompt: 'Cached step prompt',
        inputSchema: {},
        mcpServers: emptyMcpServers,
        toolNames: ['end_turn'],
        spawnableAgents: [],
        outputMode: 'last_message',
        includeMessageHistory: true,
        inheritParentSystemPrompt: false,
        model: 'anthropic/claude-4-sonnet-20250522',
        spawnerPrompt: 'Cached test',
      }

      const spy = mock(async () => mockAgentData)
      setImpl({
        ...getImpl(),
        fetchAgentFromDatabase: spy,
      })

      // First call - should hit database
      const result1 = await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/cached-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(result1).toBeTruthy()
      expect(spy).toHaveBeenCalled()

      const spy2 = mock(async () => mockAgentData)
      setImpl({
        ...getImpl(),
        fetchAgentFromDatabase: spy2,
      })

      // Second call - should use cache
      const result2 = await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/cached-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(result2).toBeTruthy()
      expect(result2?.displayName).toBe('Cached Agent')
      expect(spy2).not.toHaveBeenCalled()
    })
  })
})
