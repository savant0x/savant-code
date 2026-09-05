// FID-2026-0819-005 Loop 169: steering suite split verbatim from
// loop-agent-steps-part-d.test.ts (imports + harness duplicated
// verbatim so each file is self-contained).

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

  describe('steering (drainSteeringMessages)', () => {
    it('appends a steering message at the step boundary and continues the turn', async () => {
      // The mock LLM ends the turn after one step. A steering message that arrives
      // during that step should be appended to history and keep the turn going, so
      // the agent runs a second step that can see (and act on) the new message.
      const steerText = 'Also rename the variable to fooBar'
      let drainCalls = 0
      const drainSteeringMessages = () => {
        drainCalls++
        return drainCalls === 1 ? [steerText] : []
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        drainSteeringMessages,
      })

      // Step 1 wanted to end the turn, but the steer kept it going → a 2nd step ran.
      expect(llmCallCount).toBe(2)

      // The steered text landed in history as a user message.
      const steered = result.agentState.messageHistory.find(
        (m) =>
          m.role === 'user' && JSON.stringify(m.content).includes(steerText),
      )
      expect(steered).toBeDefined()
      expect((steered as { tags?: string[] }).tags).toContain('USER_PROMPT')
    })

    it('does not extend the turn when no steering messages arrive', async () => {
      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        drainSteeringMessages: () => [],
      })

      // No steer → the agent ends the turn after its single step, as usual.
      expect(llmCallCount).toBe(1)
      expect(result.agentState).toBeDefined()
    })
  })
})
