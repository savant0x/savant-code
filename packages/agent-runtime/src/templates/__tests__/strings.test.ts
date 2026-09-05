// getAgentPrompt test family — placeholder replacement (CURRENT_DATE,
// MODEL_INFO) and the per-step reminder. Sibling of the Loop-339
// decomposition (shared fixtures in ./strings-test-harness).
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { describe, test, expect } from 'bun:test'

import { getAgentPrompt } from '../strings'
import { PLACEHOLDER } from '../types'
import {
  createMockAgentState,
  createMockAgentTemplate,
  createMockFileContext,
  createMockLogger,
} from './strings-test-harness'

import type { AgentTemplate } from '../types'

describe('getAgentPrompt', () => {
  test('replaces CURRENT_DATE with the current date and time when formatting prompts', async () => {
    const agentTemplate = createMockAgentTemplate({
      id: 'date-agent',
      systemPrompt: `Today is ${PLACEHOLDER.CURRENT_DATE}.`,
    })
    const agentTemplates: Record<string, AgentTemplate> = {
      'date-agent': agentTemplate,
    }

    const result = await getAgentPrompt({
      agentTemplate,
      promptType: { type: 'systemPrompt' },
      fileContext: createMockFileContext(),
      agentState: createMockAgentState('date-agent'),
      agentTemplates,
      additionalToolDefinitions: async () => ({}),
      logger: createMockLogger(),
      apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
      databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
      fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
    })

    // Structural, not exact-equality: the injected value includes the current
    // minute, so an exact match could flake across a minute boundary.
    expect(result).not.toContain(PLACEHOLDER.CURRENT_DATE)
    expect(result).toMatch(
      /^Today is (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), /,
    )
    expect(result).toContain(', 202')
  })

  test('injects a fresh current date and time into the per-step reminder', async () => {
    const agentTemplate = createMockAgentTemplate({
      id: 'step-agent',
      stepPrompt: 'Work on the task.',
    })
    const agentTemplates: Record<string, AgentTemplate> = {
      'step-agent': agentTemplate,
    }

    const result = await getAgentPrompt({
      agentTemplate,
      promptType: { type: 'stepPrompt' },
      fileContext: createMockFileContext(),
      agentState: createMockAgentState('step-agent'),
      agentTemplates,
      additionalToolDefinitions: async () => ({}),
      logger: createMockLogger(),
      apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
      databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
      fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
    })

    // The step reminder carries a fresh timestamp each step (FID-2026-0815-010).
    expect(result).toContain('<system_reminder>')
    expect(result).toMatch(
      /Current date and time: (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), /,
    )
    expect(result).toContain('Work on the task.')
  })
})
