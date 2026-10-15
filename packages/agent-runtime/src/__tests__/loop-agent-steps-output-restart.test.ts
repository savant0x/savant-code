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
import { z } from 'zod/v4'

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

  it('should restart loop when agent finishes without setting required output', async () => {
    // Test that when an agent has outputSchema but finishes without calling set_output,
    // the loop restarts with a system message

    const outputSchema = z.object({
      result: z.string(),
      status: z.string(),
    })

    const templateWithOutputSchema = {
      ...mockTemplate,
      outputSchema,
      toolNames: ['set_output', 'end_turn'], // Add set_output to available tools
      handleSteps: undefined, // LLM-only agent
    }

    const localAgentTemplates = {
      'test-agent': templateWithOutputSchema,
    }

    let llmCallNumber = 0
    let capturedAgentState: AgentState | null = null

    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({}) {
      llmCallNumber++
      if (llmCallNumber === 1) {
        // First call: agent tries to end turn without setting output
        yield {
          type: 'text' as const,
          text: 'First response without output\n\n',
        }
        yield createToolCallChunk('end_turn', {})
      } else if (llmCallNumber === 2) {
        // Second call: agent sets output after being reminded
        // Manually set the output to simulate the set_output tool execution
        if (capturedAgentState) {
          capturedAgentState.output = {
            result: 'test result',
            status: 'success',
          }
        }
        yield { type: 'text' as const, text: 'Setting output now\n\n' }
        yield createToolCallChunk('set_output', {
          result: 'test result',
          status: 'success',
        })
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
      } else {
        // Safety: if called more than twice, just end
        yield { type: 'text' as const, text: 'Ending\n\n' }
        yield createToolCallChunk('end_turn', {})
      }
      return promptSuccess('mock-message-id')
    }

    mockAgentState.output = undefined
    capturedAgentState = mockAgentState

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // Should call LLM twice: once to try ending without output, once after reminder
    expect(llmCallNumber).toBe(2)

    // Should have output set after the second attempt
    expect(result.agentState.output).toEqual({
      result: 'test result',
      status: 'success',
    })

    // Check that a system message was added to message history
    const systemMessages = result.agentState.messageHistory.filter(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text.includes('set_output'),
    )
    expect(systemMessages.length).toBeGreaterThan(0)
  })

  it('should not restart loop if output is set correctly', async () => {
    // Test that when an agent has outputSchema and sets output correctly,
    // the loop ends normally without restarting

    const outputSchema = z.object({
      result: z.string(),
    })

    const templateWithOutputSchema = {
      ...mockTemplate,
      outputSchema,
      toolNames: ['set_output', 'end_turn'],
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': templateWithOutputSchema,
    }

    let llmCallNumber = 0
    let capturedAgentState: AgentState | null = null

    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({}) {
      llmCallNumber++
      // Agent sets output correctly on first call
      if (capturedAgentState) {
        capturedAgentState.output = { result: 'success' }
      }
      yield { type: 'text' as const, text: 'Setting output\n\n' }
      yield createToolCallChunk('set_output', { result: 'success' })
      yield { type: 'text' as const, text: '\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    mockAgentState.output = undefined
    capturedAgentState = mockAgentState

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // Should only call LLM once since output was set correctly
    expect(llmCallNumber).toBe(1)

    // Should have output set
    expect(result.agentState.output).toEqual({ result: 'success' })
  })
})
