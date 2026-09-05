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
import { APICallError } from 'ai'
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

  describe('API error handling', () => {
    it('should propagate error code and server message from 403 APICallError responseBody', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      // Mock promptAiSdkStream to throw an APICallError with a 403 status
      // and a responseBody containing the server's structured error
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        throw new APICallError({
          statusCode: 403,
          message: 'Forbidden',
          url: 'https://api.savant-code.com/v1/chat/completions',
          requestBodyValues: {},
          responseBody: JSON.stringify({
            error: 'free_mode_unavailable',
            message: 'Free mode is not available in your country.',
            countryCode: 'US',
            countryBlockReason: 'anonymous_network',
            ipPrivacySignals: ['vpn', 'hosting'],
          }),
          isRetryable: false,
        })
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        // Should use the server's message, NOT the generic "Forbidden"
        expect(result.output.message).toBe(
          'Free mode is not available in your country.',
        )
        // Should NOT have the 'Agent run error: ' prefix since message came from responseBody
        expect(result.output.message).not.toContain('Agent run error:')
        // Should propagate the error code so the CLI can match on it
        expect(result.output.error).toBe('free_mode_unavailable')
        // Should propagate the status code
        expect(result.output.statusCode).toBe(403)
        expect(result.output.countryCode).toBe('US')
        expect(result.output.countryBlockReason).toBe('anonymous_network')
        expect(result.output.ipPrivacySignals).toEqual(['vpn', 'hosting'])
      }
    })

    it('should prefix with "Agent run error:" when responseBody has no parseable message', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      // APICallError with no responseBody
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        throw new APICallError({
          statusCode: 500,
          message: 'Internal Server Error',
          url: 'https://api.savant-code.com/v1/chat/completions',
          requestBodyValues: {},
          responseBody: undefined,
          isRetryable: true,
        })
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        // Should have the prefix since there's no server message
        expect(result.output.message).toContain('Agent run error:')
        expect(result.output.message).toContain('Internal Server Error')
        // No error code since responseBody wasn't parseable
        expect(result.output.error).toBeUndefined()
      }
    })
  })
})
