import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
  testLogger,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
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

import { runAgentStep } from '../run-agent-step'
import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { mockFileContext } from './test-utils'

import type { AgentTemplate } from '../templates/types'
import type { AgentState } from '@savant-code/common/types/session-state'

describe('n parameter and GENERATE_N functionality', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let agentRuntimeImpl: any
  let runAgentStepBaseParams: any

  beforeEach(() => {
    agentRuntimeImpl = {
      ...createTestAgentRuntimeParams(),
      addAgentStep: async () => 'test-agent-step-id',

      sendAction: () => {},
    }

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

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
      handleSteps: undefined,
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

    runAgentStepBaseParams = {
      ...agentRuntimeImpl,
      additionalToolDefinitions: () => Promise.resolve({}),
      runId: 'test-run-id',
      ancestorRunIds: [],
      repoId: undefined,
      repoUrl: undefined,
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      clientSessionId: 'test-session',
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      onResponseChunk: () => {},
      agentType: 'test-agent',
      localAgentTemplates: { 'test-agent': mockTemplate },
      agentState: mockAgentState,
      prompt: 'Test prompt',
      spawnParams: undefined,
      system: 'Test system',
      signal: new AbortController().signal,
      tools: {},
    }
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger: testLogger })
  })

  describe('runAgentStep with n parameter', () => {
    it('should call promptAiSdk with n parameter when n is provided', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(
          promptSuccess(
            JSON.stringify(['Response 1', 'Response 2', 'Response 3']),
          ),
        ),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 3,
      })

      // Verify promptAiSdk was called with n: 3
      expect(runAgentStepBaseParams.promptAiSdk).toHaveBeenCalledWith(
        expect.objectContaining({
          n: 3,
        }),
      )

      // Verify return values
      expect(result.nResponses).toEqual([
        'Response 1',
        'Response 2',
        'Response 3',
      ])
      expect(result.shouldEndTurn).toBe(false)
      expect(result.messageId).toBe(null)
    })

    it('should return early without calling promptAiSdkStream when n is provided', async () => {
      runAgentStepBaseParams.promptAiSdkStream = mock(async function* () {
        yield { type: 'text' as const, text: 'Should not be called' }
        return 'mock-message-id'
      })

      runAgentStepBaseParams.promptAiSdk = mock(async () =>
        promptSuccess(JSON.stringify(['Response 1', 'Response 2'])),
      )

      await runAgentStep({
        ...runAgentStepBaseParams,
        n: 2,
      })

      // Verify stream was NOT called
      expect(runAgentStepBaseParams.promptAiSdkStream).not.toHaveBeenCalled()
    })

    it('should parse JSON response from promptAiSdk correctly', async () => {
      const responses = [
        'First implementation',
        'Second implementation',
        'Third implementation',
        'Fourth implementation',
        'Fifth implementation',
      ]

      runAgentStepBaseParams.promptAiSdk = mock(async () =>
        promptSuccess(JSON.stringify(responses)),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 5,
      })

      expect(result.nResponses).toEqual(responses)
      expect(result.nResponses?.length).toBe(5)
    })

    it('should use normal flow when n is undefined', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(async () =>
        promptSuccess('Should not be called'),
      )

      runAgentStepBaseParams.promptAiSdkStream = mock(async function* () {
        yield { type: 'text' as const, text: 'Normal response' }
        return promptSuccess('mock-message-id')
      })

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: undefined,
      })

      // Verify promptAiSdk was NOT called
      expect(runAgentStepBaseParams.promptAiSdk).not.toHaveBeenCalled()
      // Verify stream was called
      expect(runAgentStepBaseParams.promptAiSdkStream).toHaveBeenCalled()
      // nResponses should be undefined in normal flow
      expect(result.nResponses).toBeUndefined()
    })
  })

  describe('runProgrammaticStep with GENERATE_N', () => {
    it('should handle GENERATE_N with different n values', async () => {
      for (const nValue of [1, 3, 5, 10]) {
        mockTemplate.handleSteps = function* () {
          yield { type: 'GENERATE_N', n: nValue }
        }

        const result = await runProgrammaticStep({
          ...agentRuntimeImpl,
          runId: `test-run-id-${nValue}`,
          ancestorRunIds: [],
          repoId: undefined,
          repoUrl: undefined,
          agentState: {
            ...mockAgentState,
            runId:
              `test-run-id-${nValue}` as `${string}-${string}-${string}-${string}-${string}`,
          },
          template: mockTemplate,
          prompt: 'Test prompt',
          toolCallParams: {},
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
          logger: testLogger,
          signal: new AbortController().signal,
          tools: {},
        })

        expect(result.generateN).toBe(nValue)

        // Clear the generator cache between iterations
        clearAgentGeneratorCache({ logger: testLogger })
      }
    })

    it('should not set generateN when GENERATE_N is not yielded', async () => {
      mockTemplate.handleSteps = function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'write_file', input: { path: 'out.txt' } }
        yield { toolName: 'end_turn', input: {} }
      }

      const result = await runProgrammaticStep({
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test prompt',
        toolCallParams: {},
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
        logger: testLogger,
        signal: new AbortController().signal,
        tools: {},
      })

      expect(result.generateN).toBeUndefined()
      expect(result.endTurn).toBe(true)
    })
  })
})
