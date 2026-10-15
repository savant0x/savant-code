// Agent Registry test family — getAgentTemplate priority order (local
// templates resolve, unknown ids return null). Sibling of the Loop-341
// decomposition (shared lifecycle in ./agent-registry-test-harness).
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { describe, expect, it } from 'bun:test'

import { getAgentTemplate } from '../agent-registry'
import {
  getImpl,
  registerAgentRegistryLifecycle,
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

    it('should return null for a publisher-qualified id with no local match', async () => {
      // FID-2026-0929-005: the database fallback is gone — published-agent
      // lookups resolve from local templates only.
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'test-publisher/cached-agent@1.0.0',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })
  })
})
