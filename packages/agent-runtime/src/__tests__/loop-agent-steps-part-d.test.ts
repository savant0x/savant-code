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
import { AbortError, promptSuccess } from '@savant-code/common/util/error'
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
import type { AgentState } from '@savant-code/common/types/session-state'

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let llmCallCount: number
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

    llmCallCount = 0

    // Setup spies for database operations using typed helper
    dbSpies = setupDbSpies(createMockDbOperations())

    agentRuntimeImpl.promptAiSdkStream = mock(async function* ({}) {
      llmCallCount++
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

  describe('abort handling', () => {
    it('should handle AbortError and finish with cancelled status', async () => {
      // Test that when an AbortError is thrown (e.g., from a tool handler),
      // loopAgentSteps catches it, finishes with 'cancelled' status, and returns
      // an error output indicating the run was cancelled.

      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      // Track finishAgentRun calls
      let finishAgentRunStatus: string | undefined
      const mockFinishAgentRun = mock(async (params: { status: string }) => {
        finishAgentRunStatus = params.status
      })

      // Mock promptAiSdkStream to throw an AbortError (simulating user cancellation mid-stream)
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        // Yield some content first
        yield { type: 'text' as const, text: 'Starting work...\n' }
        // Then throw AbortError to simulate user cancellation
        throw new AbortError('User pressed Ctrl+C')
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
        finishAgentRun: mockFinishAgentRun,
      })

      // Verify the output indicates cancellation
      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe('Run cancelled by user')
      }

      // Verify finishAgentRun was called with 'cancelled' status
      expect(mockFinishAgentRun).toHaveBeenCalled()
      expect(finishAgentRunStatus).toBe('cancelled')
    })

    it('should distinguish AbortError from other errors', async () => {
      // Test that non-abort errors are NOT treated as cancellations

      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      // Track finishAgentRun calls
      let finishAgentRunStatus: string | undefined
      const mockFinishAgentRun = mock(async (params: { status: string }) => {
        finishAgentRunStatus = params.status
      })

      // Mock promptAiSdkStream to throw a regular error (not AbortError)
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        yield { type: 'text' as const, text: 'Starting...\n' }
        throw new Error('Network connection failed')
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
        finishAgentRun: mockFinishAgentRun,
      })

      // Verify the output indicates an error (not cancellation)
      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('Network connection failed')
        expect(result.output.message).not.toBe('Run cancelled by user')
      }

      // Verify finishAgentRun was called with 'failed' status (not 'cancelled')
      expect(mockFinishAgentRun).toHaveBeenCalled()
      expect(finishAgentRunStatus).toBe('failed')
    })

    it('should handle signal.aborted before loop starts', async () => {
      // Test that if signal is already aborted when loopAgentSteps is called,
      // it returns immediately with a cancelled message

      const abortController = new AbortController()
      abortController.abort() // Abort immediately

      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
        signal: abortController.signal,
      })

      // Verify the output indicates cancellation
      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe('Run cancelled by user')
      }

      // LLM should not have been called since we aborted before starting
      expect(llmCallCount).toBe(0)
    })
  })
})
