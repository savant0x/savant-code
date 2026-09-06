// getAgentPrompt test family — structured-output schema addendum gating
// (FID-2026-0802-005 H6). Sibling of the Loop-339 decomposition (shared
// fixtures in ./strings-test-harness).
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { describe, test, expect } from 'bun:test'
import { z } from 'zod/v4'

import { getAgentPrompt } from '../strings'
import {
  createMockAgentState,
  createMockAgentTemplate,
  createMockFileContext,
  createMockLogger,
} from './strings-test-harness'

import type { AgentTemplate } from '../types'

describe('getAgentPrompt', () => {
  describe('spawnerPrompt inclusion in instructionsPrompt', () => {
    describe('output schema addendum (FID-2026-0802-005 H6)', () => {
      test('omits the set_output directive when the agent lacks the set_output tool', async () => {
        // Structured-output agents like the Thinker build their result via the
        // runtime convergence gate and are told NOT to call set_output — the
        // old unconditional addendum contradicted their own instructions.
        const agentTemplate = createMockAgentTemplate({
          id: 'thinker-like-agent',
          displayName: 'Thinker-like',
          outputMode: 'structured_output',
          outputSchema: z.object({
            status: z.string(),
            payload: z.object({ message: z.string() }),
          }),
          toolNames: ['sequentialthinking', 'end_turn'],
          instructionsPrompt: 'Think step by step.',
        })
        const agentTemplates: Record<string, AgentTemplate> = {
          'thinker-like-agent': agentTemplate,
        }

        const result = await getAgentPrompt({
          agentTemplate,
          promptType: { type: 'instructionsPrompt' },
          fileContext: createMockFileContext(),
          agentState: createMockAgentState('thinker-like-agent'),
          agentTemplates,
          additionalToolDefinitions: async () => ({}),
          logger: createMockLogger(),
          apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
          databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
          fetchAgentFromDatabase:
            TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
        })

        expect(result).toBeDefined()
        expect(result).toContain('Think step by step.')
        expect(result).not.toContain('set_output')
        expect(result).not.toContain('## Output Schema')
      })

      test('keeps the set_output directive when the agent has the set_output tool', async () => {
        // Agents that DO have set_output (e.g. tmux-cli) must keep the schema
        // addendum so their structured output matches the declared schema.
        const agentTemplate = createMockAgentTemplate({
          id: 'tmux-cli-like-agent',
          displayName: 'Tmux-cli-like',
          outputMode: 'structured_output',
          outputSchema: z.object({ result: z.string() }),
          toolNames: ['set_output', 'end_turn'],
          instructionsPrompt: 'Report results with set_output.',
        })
        const agentTemplates: Record<string, AgentTemplate> = {
          'tmux-cli-like-agent': agentTemplate,
        }

        const result = await getAgentPrompt({
          agentTemplate,
          promptType: { type: 'instructionsPrompt' },
          fileContext: createMockFileContext(),
          agentState: createMockAgentState('tmux-cli-like-agent'),
          agentTemplates,
          additionalToolDefinitions: async () => ({}),
          logger: createMockLogger(),
          apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
          databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
          fetchAgentFromDatabase:
            TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
        })

        expect(result).toBeDefined()
        expect(result).toContain('## Output Schema')
        expect(result).toContain('When using the set_output tool')
      })
    })
  })
})
