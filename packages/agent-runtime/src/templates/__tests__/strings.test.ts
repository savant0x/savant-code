// getAgentPrompt test family — placeholder replacement (CURRENT_DATE,
// MODEL_INFO) and the per-step reminder. Sibling of the Loop-339
// decomposition (shared fixtures in ./strings-test-harness).
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
  test('an inherited Thinker phase note advertises only its own tools', async () => {
    const agentTemplate = createMockAgentTemplate({
      id: 'thinker',
      toolNames: ['sequentialthinking', 'end_turn'],
      inheritParentSystemPrompt: true,
    })
    const result = await getAgentPrompt({
      agentTemplate,
      promptType: { type: 'instructionsPrompt' },
      fileContext: createMockFileContext(),
      agentState: createMockAgentState('thinker'),
      agentTemplates: { thinker: agentTemplate },
      additionalToolDefinitions: async () => ({}),
      logger: createMockLogger(),
      useParentTools: true,
    })

    expect(result).toContain(
      'only has access to the following tools: sequentialthinking, end_turn',
    )
    const phaseNote = result?.split('Phase availability:')[1]?.split('\n')[0]
    expect(phaseNote).toBeDefined()
    expect(phaseNote).toContain('sequentialthinking (Thinker only)')
    expect(phaseNote).not.toContain('read_files')
    expect(phaseNote).not.toContain('run_readonly_command')
    expect(phaseNote).not.toContain('write_file')
  })

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
    })

    // The step reminder carries a fresh timestamp each step (FID-2026-0815-010).
    expect(result).toContain('<system_reminder>')
    expect(result).toMatch(
      /Current date and time: (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), /,
    )
    expect(result).toContain('Work on the task.')
  })
})
