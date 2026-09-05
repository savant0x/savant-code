import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { clearMockedModules } from '@savant-code/common/testing/mock-modules'
import {
  createMockDbOperations,
  setupDbSpies,
} from '@savant-code/common/testing/mocks/database'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { createToolCallChunk, mockFileContext } from './test-utils'
import { loopAgentSteps } from '../run-agent-step'
import { clearAgentGeneratorCache } from '../run-programmatic-step'

import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@savant-code/common/testing/mocks/database'
import type { StepGenerator } from '@savant-code/common/types/agent-template'
import type { AgentState } from '@savant-code/common/types/session-state'

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  // Counted by the default mock stream; these tests override the stream and
  // assert on their own counters instead.
  let _llmCallCount: number
  let agentRuntimeImpl: Omit<
    ReturnType<typeof createTestAgentRuntimeParams>,
    'agentTemplate' | 'localAgentTemplates'
  > & {
    promptAiSdkStream?: ReturnType<typeof mock>
  }
  let loopAgentStepsBaseParams: Parameters<typeof loopAgentSteps>[0]
  let dbSpies: DbSpies

  beforeAll(async () => {
    // Set up mocks.
  })

  beforeEach(() => {
    const {
      agentTemplate: _,
      localAgentTemplates: __,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()

    agentRuntimeImpl = {
      ...baseRuntimeParams,
    }

    _llmCallCount = 0

    // Setup spies for database operations using typed helper
    dbSpies = setupDbSpies(createMockDbOperations())

    agentRuntimeImpl.promptAiSdkStream = mock(async function* ({}) {
      _llmCallCount++
      yield { type: 'text' as const, text: 'LLM response\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    })

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    // Mock crypto.randomUUID
    spyOn(crypto, 'randomUUID').mockImplementation(
      () => 'mock-uuid-0000-0000-0000-000000000000' as const,
    )

    // Create mock template with programmatic agent
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
    } satisfies AgentTemplate as AgentTemplate

    // Create mock agent state
    const sessionState = getInitialSessionState(mockFileContext)
    mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'test-agent-id',
      messageHistory: [
        userMessage('Initial message'),
        assistantMessage('Initial response'),
      ],
      output: undefined,
      stepsRemaining: 10, // Ensure we don't hit the limit
    }

    loopAgentStepsBaseParams = {
      ...agentRuntimeImpl,
      agentType: 'test-agent',
      localAgentTemplates: { 'test-agent': mockTemplate },
      repoId: undefined,
      repoUrl: undefined,
      userInputId: 'test-user-input',
      agentState: mockAgentState,
      prompt: 'Test prompt',
      spawnParams: undefined,
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      userId: TEST_USER_ID,
      clientSessionId: 'test-session',
      ancestorRunIds: [],
      onResponseChunk: () => {},
      signal: new AbortController().signal,
    }
  })

  afterEach(() => {
    clearAgentGeneratorCache(agentRuntimeImpl)
    dbSpies.restore()
    mock.restore()
    const {
      agentTemplate: _,
      localAgentTemplates: __,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()
    agentRuntimeImpl = {
      ...baseRuntimeParams,
    }
  })

  afterAll(() => {
    clearMockedModules()
  })

  it('should pass shouldEndTurn: true as stepsComplete when end_turn tool is called', async () => {
    // Test that when LLM calls end_turn, shouldEndTurn (stepsComplete) is correctly passed
    // to the handleSteps generator via the step result.
    //
    // Flow:
    // 1. Generator yields 'STEP', runProgrammaticStep returns
    // 2. loopAgentSteps calls runAgentStep (LLM), which calls end_turn -> shouldEndTurn = true
    // 3. loopAgentSteps calls runProgrammaticStep again with stepsComplete: true
    // 4. Generator resumes from yield 'STEP' and receives { stepsComplete: true }

    let stepsCompleteValues: boolean[] = []

    const mockGeneratorFunction = function* () {
      // First STEP - after LLM runs and calls end_turn, we receive stepsComplete: true
      const result1 = yield 'STEP'
      stepsCompleteValues.push(result1.stepsComplete)

      // Since stepsComplete was true, we should end gracefully
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // Verify that stepsComplete was passed correctly:
    // After yielding STEP and LLM running (which calls end_turn),
    // the generator receives stepsComplete: true
    expect(stepsCompleteValues).toHaveLength(1)
    expect(stepsCompleteValues[0]).toBe(true)
  })

  it('should continue loop when handleSteps returns endTurn: false even if LLM calls end_turn', async () => {
    // Test that handleSteps endTurn: false takes precedence over LLM end_turn tool call

    let programmaticStepCount = 0
    let llmStepCount = 0

    const mockGeneratorFunction = function* () {
      // First iteration: return endTurn: false
      programmaticStepCount++
      yield 'STEP'

      // Second iteration: also return endTurn: false
      programmaticStepCount++
      yield 'STEP'

      // Third iteration: finally return endTurn: true to end the loop
      programmaticStepCount++
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    // Mock LLM to always call end_turn, but handleSteps should override it
    let promptCallCount = 0
    loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
      promptCallCount++
      llmStepCount++

      // LLM always tries to end turn
      yield { type: 'text' as const, text: 'LLM response\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess(`mock-message-id-${promptCallCount}`)
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // Verify handleSteps ran 3 times (yielded STEP twice, then end_turn)
    expect(programmaticStepCount).toBe(3)

    // Verify LLM was called 2 times (once per STEP yield)
    expect(llmStepCount).toBe(2)

    // This confirms that even though LLM called end_turn every time,
    // the loop continued because handleSteps kept yielding STEP before finally ending
  })
})
