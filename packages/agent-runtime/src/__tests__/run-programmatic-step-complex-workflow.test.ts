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
    it('should handle complex post-processing workflow', async () => {
      const workflowSteps: string[] = []
      let stepCount = 0

      const mockGenerator = (function* () {
        stepCount++
        workflowSteps.push(`generator run ${stepCount}`)

        // Initial processing
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['input.txt'] },
        }
        workflowSteps.push(
          `read completed, stepsComplete=${step1.stepsComplete}`,
        )

        if (step1.stepsComplete) {
          // Post-processing phase
          workflowSteps.push('entering post-processing')

          // Analyze the input
          yield {
            toolName: 'code_search',
            input: { pattern: 'TODO', flags: '-n' },
          }

          // Create analysis report
          yield {
            toolName: 'write_file',
            input: {
              path: 'analysis.md',
              instructions: 'Create analysis report',
              content: '# Analysis Report\n\nTODO items found.',
            },
          }

          // Add subgoal for tracking
          yield {
            toolName: 'add_subgoal',
            input: {
              id: 'analysis-complete',
              objective: 'Complete post-processing analysis',
              status: 'COMPLETE',
            },
          }

          // Set final output
          yield {
            toolName: 'set_output',
            input: {
              phase: 'post-processing',
              analysisCreated: true,
              subgoalAdded: true,
            },
          }

          // Continue for more processing
          const step2 = yield 'STEP'
          workflowSteps.push(
            `step after STEP: stepsComplete=${step2.stepsComplete}`,
          )

          if (step2.stepsComplete) {
            // Final cleanup
            yield {
              toolName: 'update_subgoal',
              input: {
                id: 'analysis-complete',
                log: 'All post-processing completed',
              },
            }
          }
        } else {
          // Normal processing
          workflowSteps.push('normal processing mode')
          yield {
            toolName: 'set_output',
            input: { phase: 'normal', message: 'Regular processing' },
          }
        }

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = [
        'read_files',
        'code_search',
        'write_file',
        'add_subgoal',
        'set_output',
        'update_subgoal',
        'end_turn',
      ]

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          } else if (options.toolName === 'add_subgoal') {
            options.agentState.agentContext[options.input.id as string] = {
              ...options.input,
              logs: [],
            }
          }
        },
      )

      // Call with stepsComplete=true to trigger post-processing
      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(workflowSteps).toEqual([
        'generator run 1',
        'read completed, stepsComplete=true',
        'entering post-processing',
      ])

      expect(result.endTurn).toBe(false) // Should not end due to STEP
      expect(result.agentState.output).toEqual({
        phase: 'post-processing',
        analysisCreated: true,
        subgoalAdded: true,
      })
      expect(result.agentState.agentContext['analysis-complete']).toBeDefined()
      expect(executeToolCallSpy).toHaveBeenCalledTimes(5) // read_files, code_search, write_file, add_subgoal, set_output
    })
  })
})
