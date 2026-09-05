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
import { APICallError, RetryError } from 'ai'
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
    it('should unwrap retry errors to propagate underlying 409 gate errors', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      const apiError = new APICallError({
        statusCode: 409,
        message: 'Conflict',
        url: 'https://api.savant-code.com/v1/chat/completions',
        requestBodyValues: {},
        responseBody: JSON.stringify({
          error: 'session_superseded',
          message:
            'Another instance of savant-free has taken over this session. Only one instance per account is allowed.',
        }),
        isRetryable: true,
      })

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        throw new RetryError({
          message: 'Failed after 4 attempts. Last error: Conflict',
          reason: 'maxRetriesExceeded',
          errors: [apiError],
        })
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe(
          'Another instance of savant-free has taken over this session. Only one instance per account is allowed.',
        )
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.error).toBe('session_superseded')
        expect(result.output.statusCode).toBe(409)
      }
    })

    it('should explain fetch idle timeouts instead of showing the raw runtime message', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      // Bun aborts a fetch after 5 minutes without receiving bytes, throwing a
      // DOMException named TimeoutError with this exact message.
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        const timeoutError = new Error('The operation timed out.')
        timeoutError.name = 'TimeoutError'
        throw timeoutError
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain(
          'no data was received from the server for 5 minutes',
        )
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.message).not.toBe('The operation timed out.')
      }
    })

    it('should explain dropped socket connections instead of showing the raw runtime message', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      // Bun's fetch throws a plain Error with this message (and code
      // ECONNRESET/ConnectionClosed) when the TCP connection is dropped.
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        const socketError = new Error(
          'The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()',
        ) as Error & { code: string }
        socketError.code = 'ECONNRESET'
        throw socketError
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('Connection interrupted')
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.message).not.toContain(
          'pass `verbose: true` in the second argument to fetch()',
        )
      }
    })
  })
})
