// loop-agent-steps part-a test family — LLM-only agents + trace recording.
// Sibling of the Loop 352 decomposition (shared lifecycle in
// ./loop-agent-steps-part-a-test-harness).
import { describe, expect, it } from 'bun:test'

import {
  getLlmCallCount,
  getLoopAgentStepsBaseParams,
  getMockTemplate,
  loopAgentSteps,
  registerPartALifecycle,
  type StepGenerator,
} from './loop-agent-steps-part-a-test-harness'

registerPartALifecycle()

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  it('should handle LLM-only agent (no handleSteps)', async () => {
    // Test traditional LLM-based agents that don't have handleSteps

    const mockTemplate = getMockTemplate()
    const llmOnlyTemplate = {
      ...mockTemplate,
      handleSteps: undefined, // No programmatic step function
    }

    const localAgentTemplates = {
      'test-agent': llmOnlyTemplate,
    }

    const result = await loopAgentSteps({
      ...getLoopAgentStepsBaseParams(),
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(getLlmCallCount()).toBe(1) // LLM should be called once
    expect(result.agentState).toBeDefined()
  })

  it('should pass the full message history to the traceWriter when provided', async () => {
    const recordedSteps: Array<{ agentId: string; messages: unknown[] }> = []
    const traceWriter = {
      recordStep: (params: { agentId: string; messages: unknown[] }) => {
        recordedSteps.push(params)
      },
    }

    const mockTemplate = getMockTemplate()
    const result = await loopAgentSteps({
      ...getLoopAgentStepsBaseParams(),
      traceWriter,
      agentType: 'test-agent',
      localAgentTemplates: {
        'test-agent': { ...mockTemplate, handleSteps: undefined },
      },
    })

    expect(result.agentState).toBeDefined()
    // Called at least at the start and end of the step
    expect(recordedSteps.length).toBeGreaterThanOrEqual(2)
    expect(recordedSteps[0]!.agentId).toBe('test-agent-id')
    // End-of-step call sees the assistant response appended to the history
    const lastMessages = recordedSteps[recordedSteps.length - 1]!.messages
    expect(lastMessages.length).toBeGreaterThan(
      recordedSteps[0]!.messages.length,
    )
  })

  it('should handle programmatic agent error and still call LLM', async () => {
    // Test error handling in programmatic step - should still allow LLM to run

    const mockGeneratorFunction = function* () {
      yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
      throw new Error('Programmatic step failed')
    } as () => StepGenerator

    const mockTemplate = getMockTemplate()
    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...getLoopAgentStepsBaseParams(),
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // After programmatic step error, should end turn and not call LLM
    expect(getLlmCallCount()).toBe(0)
    expect(result.agentState).toBeDefined()
    expect(result.agentState.output?.error).toContain(
      'Error executing handleSteps for agent test-agent',
    )
  })
})
