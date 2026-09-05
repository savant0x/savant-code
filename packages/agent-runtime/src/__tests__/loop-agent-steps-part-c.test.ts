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

  it('should pass generateN from programmatic step to runAgentStep as n parameter', async () => {
    // Test that when programmatic step returns generateN, it's passed to runAgentStep

    let agentStepN: number | undefined

    const mockGeneratorFunction = function* () {
      // Yield GENERATE_N to trigger n parameter
      yield { type: 'GENERATE_N', n: 5 }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    // Mock promptAiSdk to capture the n parameter
    loopAgentStepsBaseParams.promptAiSdk = async (params: any) => {
      agentStepN = params.n
      return promptSuccess(
        JSON.stringify([
          'Response 1',
          'Response 2',
          'Response 3',
          'Response 4',
          'Response 5',
        ]),
      )
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // Verify generateN was passed to runAgentStep as n
    expect(agentStepN).toBe(5)
  })

  it('should pass nResponses from runAgentStep back to programmatic step', async () => {
    // Test that nResponses returned by runAgentStep are passed to next programmatic step

    let receivedNResponses: string[] | undefined

    const mockGeneratorFunction = function* () {
      const { nResponses } = yield { type: 'GENERATE_N', n: 3 }
      receivedNResponses = nResponses
      const _step = yield {
        toolName: 'read_files',
        input: { paths: ['test.txt'] },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const expectedResponses = [
      'Implementation A',
      'Implementation B',
      'Implementation C',
    ]
    loopAgentStepsBaseParams.promptAiSdk = async () => {
      return promptSuccess(JSON.stringify(expectedResponses))
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(receivedNResponses).toEqual(expectedResponses)
  })

  it('should allow agents without outputSchema to end normally', async () => {
    // Test that agents without outputSchema can end without setting output

    const templateWithoutOutputSchema = {
      ...mockTemplate,
      outputSchema: undefined,
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': templateWithoutOutputSchema,
    }

    let llmCallNumber = 0
    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({}) {
      llmCallNumber++
      yield { type: 'text' as const, text: 'Response without output\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // Should only call LLM once and end normally
    expect(llmCallNumber).toBe(1)

    // Output should be undefined since no outputSchema required
    expect(result.agentState.output).toBeUndefined()
  })
})
