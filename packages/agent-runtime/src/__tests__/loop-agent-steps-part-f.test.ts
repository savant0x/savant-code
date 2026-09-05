// loopAgentSteps part-f family — runAgentStep vs runProgrammaticStep
// behavior: native tool-call recovery (FID-2026-0801-010). Sibling of the
// Loop-346/356 decomposition (shared lifecycle in
// ./loop-agent-steps-part-f-test-harness).
import { describe, expect, it } from 'bun:test'

import {
  createToolCallChunk,
  getBaseParams,
  getLlmCallCount,
  getTemplate,
  incrLlmCallCount,
  loopAgentSteps,
  mock,
  promptSuccess,
  registerLoopAgentStepsPartFLifecycle,
  spyOn,
  testLogger,
} from './loop-agent-steps-part-f-test-harness'

import type { AgentTemplate } from '../templates/types'

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  registerLoopAgentStepsPartFLifecycle()

  describe('native tool-call recovery (FID-2026-0801-010)', () => {
    it('retries twice, then fails visibly without a fourth model call', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }
      let finishStatus: string | undefined
      let finishError: string | undefined

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        yield {
          type: 'error' as const,
          message: 'Incomplete arguments for tool sequentialthinking',
          errorClass: 'native-incomplete' as const,
          toolName: 'sequentialthinking',
        }
        return promptSuccess(`native-incomplete-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
        finishAgentRun: mock(
          async (params: { status: string; errorMessage?: string }) => {
            finishStatus = params.status
            finishError = params.errorMessage
          },
        ),
      })

      expect(getLlmCallCount()).toBe(3)
      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain(
          'Native tool-call recovery failed repeatedly',
        )
        expect(result.output.message).toContain('(tool: sequentialthinking)')
        expect(result.output.message).toContain('Re-spawn with the work split')
      }
      expect(finishStatus).toBe('failed')
      expect(finishError).toContain(
        'Native tool-call recovery failed repeatedly',
      )
      expect(finishError).toContain('(tool: sequentialthinking)')

      const history = result.agentState.messageHistory
      expect(
        history.some(
          (message) =>
            message.role === 'assistant' &&
            message.content.some((part) => part.type === 'tool-call'),
        ),
      ).toBe(false)
      expect(history.some((message) => message.role === 'tool')).toBe(false)
      expect(
        history.some(
          (message) =>
            message.role === 'user' &&
            message.tags?.includes('TOOL_CALL_ERROR'),
        ),
      ).toBe(true)
    })

    it('recovers on the next step with one valid sequentialthinking result', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        id: 'thinker-test-agent',
        handleSteps: undefined,
        toolNames: ['sequentialthinking', 'end_turn'],
      } satisfies AgentTemplate

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        if (getLlmCallCount() === 1) {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool sequentialthinking',
            errorClass: 'native-incomplete' as const,
            toolName: 'sequentialthinking',
          }
        } else {
          yield createToolCallChunk('sequentialthinking', {
            thought: 'The continuation is executing the complete native call.',
            thoughtNumber: 1,
            totalThoughts: 1,
            nextThoughtNeeded: false,
          })
          yield createToolCallChunk('end_turn', {})
        }
        return promptSuccess(`recovery-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(getLlmCallCount()).toBe(2)
      expect(result.output.type).not.toBe('error')

      const assistantToolCalls = result.agentState.messageHistory.filter(
        (message) =>
          message.role === 'assistant' &&
          message.content.some(
            (part) =>
              part.type === 'tool-call' &&
              part.toolName === 'sequentialthinking',
          ),
      )
      const sequentialThinkingResults = result.agentState.messageHistory.filter(
        (message) =>
          message.role === 'tool' && message.toolName === 'sequentialthinking',
      )

      expect(assistantToolCalls).toHaveLength(1)
      expect(sequentialThinkingResults).toHaveLength(1)
      expect(
        result.agentState.messageHistory.some(
          (message) =>
            message.role === 'user' &&
            message.tags?.includes('TOOL_CALL_ERROR'),
        ),
      ).toBe(true)

      // FID-2026-0816-012: non-payload tools keep the generic message — no
      // split-steering appended.
      const errorMessage = result.agentState.messageHistory.find(
        (message) =>
          message.role === 'user' && message.tags?.includes('TOOL_CALL_ERROR'),
      )
      const errorContent = errorMessage
        ? typeof errorMessage.content === 'string'
          ? errorMessage.content
          : JSON.stringify(errorMessage.content)
        : ''
      expect(errorContent).not.toContain('split the work into multiple')
    })

    it('steers large-payload tool retries with tool-specific guidance', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        if (getLlmCallCount() === 1) {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool write_file',
            errorClass: 'native-incomplete' as const,
            toolName: 'write_file',
          }
        } else {
          yield createToolCallChunk('end_turn', {})
        }
        return promptSuccess(`steer-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(getLlmCallCount()).toBe(2)
      expect(result.output.type).not.toBe('error')
      const errorMessage = result.agentState.messageHistory.find(
        (message) =>
          message.role === 'user' && message.tags?.includes('TOOL_CALL_ERROR'),
      )
      const errorContent = errorMessage
        ? typeof errorMessage.content === 'string'
          ? errorMessage.content
          : JSON.stringify(errorMessage.content)
        : ''
      // FID-2026-0819-004: write_file gets tool-specific steering
      expect(errorContent).toContain('write in chunks using str_replace')
    })

    it('steers run_terminal_command truncation with tool-specific guidance', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        if (getLlmCallCount() === 1) {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool run_terminal_command',
            errorClass: 'native-incomplete' as const,
            toolName: 'run_terminal_command',
          }
        } else {
          yield createToolCallChunk('end_turn', {})
        }
        return promptSuccess(`steer-terminal-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(getLlmCallCount()).toBe(2)
      expect(result.output.type).not.toBe('error')
      const errorMessage = result.agentState.messageHistory.find(
        (message) =>
          message.role === 'user' && message.tags?.includes('TOOL_CALL_ERROR'),
      )
      const errorContent = errorMessage
        ? typeof errorMessage.content === 'string'
          ? errorMessage.content
          : JSON.stringify(errorMessage.content)
        : ''
      // FID-2026-0819-004: run_terminal_command gets tool-specific steering
      expect(errorContent).toContain('ONE command per')
    })

    it('warns on an incomplete call for an unknown tool and names it on exhaustion', async () => {
      const warnSpy = spyOn(testLogger, 'warn')
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        yield {
          type: 'error' as const,
          message: 'Incomplete arguments for tool not_a_real_tool',
          errorClass: 'native-incomplete' as const,
          toolName: 'not_a_real_tool',
        }
        return promptSuccess(`drift-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(getLlmCallCount()).toBe(3)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'not_a_real_tool' }),
        expect.stringContaining('unknown to the runtime'),
      )
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('(tool: not_a_real_tool)')
      }
    })
  })
})
