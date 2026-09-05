import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
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
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'

const logger: Logger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

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

      logger,
      signal: new AbortController().signal,
    }
  })

  afterEach(() => {
    mock.restore()
    // Clear the generator cache between tests
    clearAgentGeneratorCache({ logger })
  })

  describe('continued stepping after completion', () => {
    it('should allow agent to continue with STEP after initial completion', async () => {
      const executionSteps: string[] = []

      const mockGenerator = (function* () {
        executionSteps.push('initial execution')
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['config.txt'] },
        }

        if (step1.stepsComplete) {
          executionSteps.push('post-processing detected')
          yield {
            toolName: 'write_file',
            input: {
              path: 'summary.txt',
              instructions: 'Create summary',
              content: 'Processing completed',
            },
          }

          // Force agent to continue with another step
          executionSteps.push('requesting continuation')
          const step2 = yield 'STEP'
          executionSteps.push(`step2: stepsComplete=${step2.stepsComplete}`)

          if (!step2.stepsComplete) {
            yield {
              toolName: 'set_output',
              input: { message: 'Continued processing' },
            }
          }
        }

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = [
        'read_files',
        'write_file',
        'set_output',
        'end_turn',
      ]

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      // First call with stepsComplete=true (post-processing mode)
      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(executionSteps).toEqual([
        'initial execution',
        'post-processing detected',
        'requesting continuation',
      ])
      expect(result.endTurn).toBe(false) // Should not end due to STEP
      expect(executeToolCallSpy).toHaveBeenCalledTimes(2) // read_files + write_file

      const finalResult = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: false,
      })

      expect(executionSteps).toEqual([
        'initial execution',
        'post-processing detected',
        'requesting continuation',
        'step2: stepsComplete=false',
      ])
      expect(finalResult.endTurn).toBe(true) // Should end from end_turn
      expect(executeToolCallSpy).toHaveBeenCalledTimes(4) // read_files + write_file + set_output + end_turn
    })

    it('should allow agent to continue with STEP_ALL after initial completion', async () => {
      const executionSteps: string[] = []

      const mockGenerator = (function* () {
        executionSteps.push('initial execution')
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['data.txt'] },
        }

        if (step1.stepsComplete) {
          executionSteps.push('post-processing with STEP_ALL')
          yield {
            toolName: 'write_file',
            input: {
              path: 'processed.txt',
              instructions: 'Create processed file',
              content: 'Data processed',
            },
          }

          // Force agent to continue with STEP_ALL
          yield 'STEP_ALL'
          executionSteps.push('STEP_ALL requested')
        }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = ['read_files', 'write_file', 'end_turn']

      // First call with stepsComplete=true
      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(executionSteps).toEqual([
        'initial execution',
        'post-processing with STEP_ALL',
      ])
      expect(result.endTurn).toBe(false) // Should not end due to STEP_ALL
      expect(executeToolCallSpy).toHaveBeenCalledTimes(2) // read_files + write_file
    })
  })
})
