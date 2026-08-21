import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  emptyMcpServers,
  testLogger,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { mockFileContext } from './test-utils'
import * as toolExecutor from '../tools/tool-executor'

import type { AgentTemplate, StepGenerator } from '../templates/types'
import type { executeToolCall } from '../tools/tool-executor'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'

describe('runProgrammaticStep', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let mockParams: ParamsOf<typeof runProgrammaticStep>
  let executeToolCallSpy: ReturnType<
    typeof spyOn<typeof toolExecutor, 'executeToolCall'>
  >
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

  beforeEach(() => {
    agentRuntimeImpl = {
      ...TEST_AGENT_RUNTIME_IMPL,
      addAgentStep: async () => 'test-agent-step-id',

      sendAction: () => {},
    }

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

    // Create mock template
    mockTemplate = {
      id: 'test-agent',
      displayName: 'Test Agent',
      spawnerPrompt: 'Testing',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['read_files', 'write_file', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test user prompt',
      stepPrompt: 'Test agent step prompt',
      handleSteps: undefined, // Will be set in individual tests
    } as AgentTemplate

    // Create mock agent state
    const sessionState = getInitialSessionState(mockFileContext)
    mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'test-agent-id',
      runId:
        'test-run-id' as `${string}-${string}-${string}-${string}-${string}`,
      messageHistory: [
        userMessage('Initial message'),
        assistantMessage('Initial response'),
      ],
      output: undefined,
      directCreditsUsed: 0,
      childRunIds: [],
    }

    // Create mock params
    mockParams = {
      ...agentRuntimeImpl,
      runId: 'test-run-id',
      ancestorRunIds: [],
      repoId: undefined,
      repoUrl: undefined,
      agentState: mockAgentState,
      template: mockTemplate,
      prompt: 'Test prompt',
      toolCallParams: { testParam: 'value' },
      userId: TEST_USER_ID,
      userInputId: 'test-user-input',
      clientSessionId: 'test-session',
      fingerprintId: 'test-fingerprint',
      onResponseChunk: () => {},
      onCostCalculated: async () => {},
      fileContext: mockFileContext,
      localAgentTemplates: {},
      system: 'Test system prompt',
      stepsComplete: false,
      stepNumber: 1,
      tools: {},

      logger: testLogger,
      signal: new AbortController().signal,
    }
  })

  afterEach(() => {
    mock.restore()
    // Clear the generator cache between tests
    clearAgentGeneratorCache({ logger: testLogger })
  })

  describe('stepsComplete parameter', () => {
    it('should pass stepsComplete=false by default', async () => {
      let receivedStepsComplete: boolean | undefined

      const mockGenerator = (function* () {
        const input = yield {
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
        }
        receivedStepsComplete = input.stepsComplete
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep({
        ...mockParams,
        stepsComplete: false,
      })

      expect(receivedStepsComplete).toBe(false)
    })

    it('should pass stepsComplete=true when specified', async () => {
      let receivedStepsComplete: boolean | undefined

      const mockGenerator = (function* () {
        const input = yield {
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
        }
        receivedStepsComplete = input.stepsComplete
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(receivedStepsComplete).toBe(true)
    })

    it('should handle post-processing when stepsComplete=true', async () => {
      const executionLog: string[] = []

      const mockGenerator = (function* () {
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['file1.txt'] },
        }
        executionLog.push(`step1: stepsComplete=${step1.stepsComplete}`)

        if (step1.stepsComplete) {
          // Post-processing step
          executionLog.push('performing post-processing')
          yield {
            toolName: 'set_output',
            input: { message: 'Post-processing completed' },
          }
        }

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = ['read_files', 'set_output', 'end_turn']

      // Mock executeToolCall to update state for set_output
      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(executionLog).toEqual([
        'step1: stepsComplete=true',
        'performing post-processing',
      ])
      expect(result.agentState.output).toEqual({
        message: 'Post-processing completed',
      })
      expect(executeToolCallSpy).toHaveBeenCalledTimes(3) // read_files + set_output + end_turn
    })

    it('should clear STEP_ALL mode when stepsComplete=true', async () => {
      // First, set up a generator that will be marked as STEP_ALL
      let generatorCallCount = 0
      const createGenerator = () => {
        generatorCallCount++
        if (generatorCallCount === 1) {
          return (function* () {
            yield 'STEP_ALL'
          })() as StepGenerator
        } else {
          return (function* () {
            yield {
              toolName: 'set_output',
              input: { status: 'finalized' },
            }
            yield { toolName: 'end_turn', input: {} }
          })() as StepGenerator
        }
      }

      mockTemplate.handleSteps = createGenerator
      mockTemplate.toolNames = ['set_output', 'end_turn']

      // First call to set STEP_ALL state
      const result1 = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: false,
      })
      expect(result1.endTurn).toBe(false)
      expect(generatorCallCount).toBe(1)

      // Second call with stepsComplete=false should return early due to STEP_ALL
      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        stepsComplete: false,
      })
      expect(result2.endTurn).toBe(false)
      expect(generatorCallCount).toBe(1) // Should not create new generator

      // Third call with stepsComplete=true should clear STEP_ALL and continue with existing generator
      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const result3 = await runProgrammaticStep({
        ...mockParams,
        agentState: result2.agentState,
        stepsComplete: true,
      })

      expect(result3.endTurn).toBe(true)
      // The existing generator continues execution rather than creating a new one
      expect(generatorCallCount).toBe(1)
    })
  })
})
