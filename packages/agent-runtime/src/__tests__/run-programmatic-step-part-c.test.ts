import * as analytics from '@savant-code/common/analytics'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'
import { cloneDeep } from 'lodash'

import {
  createRunProgrammaticStepFixture,
  logger,
} from './run-programmatic-step-part-c-fixtures'
import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import * as toolExecutor from '../tools/tool-executor'

import type { RunProgrammaticStepFixture } from './run-programmatic-step-part-c-fixtures'
import type { StepGenerator } from '../templates/types'
import type { executeToolCall } from '../tools/tool-executor'
import type { ParamsOf } from '@savant-code/common/types/function-params'

describe('runProgrammaticStep', () => {
  let mockTemplate: RunProgrammaticStepFixture['mockTemplate']
  let mockAgentState: RunProgrammaticStepFixture['mockAgentState']
  let mockParams: RunProgrammaticStepFixture['mockParams']
  let executeToolCallSpy: ReturnType<
    typeof spyOn<typeof toolExecutor, 'executeToolCall'>
  >

  beforeEach(() => {
    const fixture = createRunProgrammaticStepFixture()
    mockTemplate = fixture.mockTemplate
    mockAgentState = fixture.mockAgentState
    mockParams = fixture.mockParams

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    // Mock executeToolCall
    executeToolCallSpy = spyOn(
      toolExecutor,
      'executeToolCall',
    ).mockImplementation(async () => {})

    // Mock crypto.randomUUID
    spyOn(crypto, 'randomUUID').mockImplementation(
      () =>
        'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
    )
  })

  afterEach(() => {
    mock.restore()
    // Clear the generator cache between tests
    clearAgentGeneratorCache({ logger })
  })

  describe('generator control flow', () => {
    it('should handle STEP value to break execution', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield 'STEP'
        yield {
          toolName: 'write_file',
          input: { path: 'test.txt', content: 'test' },
        }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(1) // Only first tool call
      expect(result.endTurn).toBe(false)
    })

    it('should handle generator completion', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        return // Generator completes
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
    })

    it('should end turn when end_turn tool is called', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
        yield {
          toolName: 'write_file',
          input: { path: 'test.txt', content: 'test' },
        } // Should not execute
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(2) // read_files + end_turn
      expect(result.endTurn).toBe(true)
    })
  })

  describe('state management', () => {
    it('should preserve agent state changes', async () => {
      const mockGenerator = (function* () {
        yield {
          toolName: 'set_output',
          input: { status: 'complete' },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames.push('set_output')

      // Mock executeToolCall to update state
      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = { status: 'complete' }
          }
        },
      )

      const result = await runProgrammaticStep(mockParams)

      expect(result.agentState.output).toEqual({ status: 'complete' })
    })

    it('should preserve message history', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator
      const previousMessageHistory = cloneDeep(mockAgentState.messageHistory)

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      // Verify previous messages are preserved
      expect(result.agentState.messageHistory.length).toBeGreaterThanOrEqual(
        previousMessageHistory.length,
      )
      // Check first messages match
      expect(result.agentState.messageHistory[0]).toEqual(
        previousMessageHistory[0],
      )
      expect(result.agentState.messageHistory[1]).toEqual(
        previousMessageHistory[1],
      )
      // Verify an assistant message was added (with native tools, this is a tool-call structure)
      const lastMessage =
        result.agentState.messageHistory[
          result.agentState.messageHistory.length - 1
        ]
      expect(lastMessage.role).toBe('assistant')
      // With native tools, the tool call is structured differently than the old XML format
      expect(lastMessage.content[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'end_turn',
      })
    })
  })

  describe('error handling', () => {
    it('should handle generator errors gracefully', async () => {
      const mockGenerator = (function* () {
        throw new Error('Generator error')
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain('Generator error')
      expect(
        responseChunks.some(
          (chunk) =>
            typeof chunk === 'string' && chunk.includes('Generator error'),
        ),
      ).toBe(true)
    })

    it('should handle tool execution errors', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      executeToolCallSpy.mockRejectedValue(new Error('Tool execution failed'))

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain('Tool execution failed')
    })

    it('should handle non-Error exceptions', async () => {
      const mockGenerator = (function* () {
        throw 'String error'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain('Unknown error')
    })
  })
})
