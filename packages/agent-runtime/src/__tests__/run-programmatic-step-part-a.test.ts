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
    spyOn(toolExecutor, 'executeToolCall').mockImplementation(async () => {})

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

  describe('generator lifecycle', () => {
    it('should create new generator when none exists', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState).toBeDefined()
    })

    it('should not reuse existing generator for same agent', async () => {
      // Note: this behavior of creating a new generator after the first generator ended prevents memory leaks.
      let callCount = 0
      const createGenerator = () => {
        callCount++
        return (function* () {
          yield { toolName: 'end_turn', input: {} }
        })() as StepGenerator
      }

      mockTemplate.handleSteps = createGenerator
      // First call
      await runProgrammaticStep(mockParams)
      expect(callCount).toBe(1)

      // Second call with same agent ID should create a new generator
      await runProgrammaticStep(mockParams)
      expect(callCount).toBe(2) // Should create new generator
    })

    it('should handle STEP_ALL generator state', async () => {
      // First, set up a generator that will be marked as STEP_ALL
      const mockGenerator = (function* () {
        yield 'STEP_ALL'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      // First call to set STEP_ALL state
      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.endTurn).toBe(false)

      // Second call should return early due to STEP_ALL state
      // Use the same agent state with the same runId
      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
      })
      expect(result2.endTurn).toBe(false)
      expect(result2.agentState.agentId).toEqual(result1.agentState.agentId)
    })

    it('should throw error when template has no handleStep', async () => {
      mockTemplate.handleSteps = undefined

      await expect(runProgrammaticStep(mockParams)).rejects.toThrow(
        'No step handler found for agent template test-agent',
      )
    })

    it('SEC1: prefers live handleStepsFn over stringified handleSteps (no eval)', async () => {
      // A string that would throw a ReferenceError if eval'd and stepped
      // (references an out-of-scope identifier). The live fn must be preferred
      // so the eval trust boundary is never crossed in-process.
      mockTemplate.handleSteps =
        'function* () { yield { toolName: "end_turn", input: {} }; const x = someUndefinedBundlerHelper; }'
      mockTemplate.handleStepsFn = () =>
        (function* () {
          yield { toolName: 'end_turn', input: {} }
        })() as StepGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toBeUndefined()
    })
  })
})
