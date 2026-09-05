// loopAgentSteps part-f family — native tool-call recovery strike caps
// (FID-2026-0819-004 / FID-2026-0816-012). Sibling of the
// Loop-346/356 decomposition (shared lifecycle in
// ./loop-agent-steps-part-f-test-harness).
import { describe, expect, it } from 'bun:test'

import {
  getBaseParams,
  getLlmCallCount,
  getTemplate,
  incrLlmCallCount,
  loopAgentSteps,
  mock,
  promptSuccess,
  registerLoopAgentStepsPartFLifecycle,
} from './loop-agent-steps-part-f-test-harness'

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  registerLoopAgentStepsPartFLifecycle()

  describe('native tool-call recovery (FID-2026-0801-010)', () => {
    it('gives run_terminal_command 5 strikes before exhausting (FID-2026-0819-004)', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }
      let finishStatus: string | undefined

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        yield {
          type: 'error' as const,
          message: 'Incomplete arguments for tool run_terminal_command',
          errorClass: 'native-incomplete' as const,
          toolName: 'run_terminal_command',
        }
        return promptSuccess(`terminal-strikes-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
        finishAgentRun: mock(
          async (params: { status: string; errorMessage?: string }) => {
            finishStatus = params.status
          },
        ),
      })

      // FID-2026-0819-004: run_terminal_command gets 5 strikes, not 3
      expect(getLlmCallCount()).toBe(5)
      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain(
          'Native tool-call recovery failed repeatedly',
        )
        expect(result.output.message).toContain('(tool: run_terminal_command)')
      }
      expect(finishStatus).toBe('failed')

      // Verify escalating steering messages were appended (strikes 2-4)
      const toolCallErrors = result.agentState.messageHistory.filter(
        (message) =>
          message.role === 'user' && message.tags?.includes('TOOL_CALL_ERROR'),
      )
      // At least 3 error messages: strike 1 from stream-parser + strikes 2-4 from loop-iteration
      expect(toolCallErrors.length).toBeGreaterThanOrEqual(3)
    })

    it('gives non-terminal tools 3 strikes before exhausting', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        yield {
          type: 'error' as const,
          message: 'Incomplete arguments for tool write_file',
          errorClass: 'native-incomplete' as const,
          toolName: 'write_file',
        }
        return promptSuccess(`write-strikes-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      // Non-terminal tools still get 3 strikes
      expect(getLlmCallCount()).toBe(3)
      expect(result.output.type).toBe('error')
    })

    it('resets the native-incomplete streak after an unrelated tool error', async () => {
      const llmOnlyTemplate = {
        ...getTemplate(),
        handleSteps: undefined,
      }
      let finishStatus: string | undefined

      getBaseParams().promptAiSdkStream = async function* () {
        incrLlmCallCount()
        if (getLlmCallCount() === 2) {
          yield {
            type: 'error' as const,
            message: 'An unrelated tool validation error',
          }
        } else {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool sequentialthinking',
            errorClass: 'native-incomplete' as const,
            toolName: 'sequentialthinking',
          }
        }
        return promptSuccess(`recovery-${getLlmCallCount()}`)
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
        finishAgentRun: mock(async (params: { status: string }) => {
          finishStatus = params.status
        }),
      })

      // FID-2026-0816-012: with the 3-strike cap, the reset streak needs 3
      // consecutive incompletes (calls 3-5) after the unrelated error resets
      // call 1's streak.
      expect(getLlmCallCount()).toBe(5)
      expect(result.output.type).toBe('error')
      expect(finishStatus).toBe('failed')
    })
  })
})
