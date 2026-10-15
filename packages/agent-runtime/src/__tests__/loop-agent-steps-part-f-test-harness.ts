// Shared lifecycle/fixtures for the loopAgentSteps part-f test family.
// Sibling of the Loop-346 decomposition (suite files all import these).
// Holds the per-test runtime/template/params state behind accessors so the
// beforeEach/afterEach semantics of the original monolith are preserved
// exactly (including the afterEach impl reset and the llmCallCount reset).
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
  mock,
  spyOn,
} from 'bun:test'

import { createToolCallChunk, mockFileContext } from './test-utils'
import { clearAgentGeneratorCache } from '../run-programmatic-step'

import type { loopAgentSteps } from '../run-agent-step'
import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@savant-code/common/testing/mocks/database'
import type { AgentState } from '@savant-code/common/types/session-state'

// Re-exports so sibling suites keep the original import surface.
export { createToolCallChunk, mockFileContext } from './test-utils'
export { loopAgentSteps } from '../run-agent-step'
export { promptSuccess } from '@savant-code/common/util/error'
export { testLogger } from '@savant-code/common/testing/fixtures/agent-runtime'
export { mock, spyOn } from 'bun:test'

type RuntimeImpl = Omit<
  ReturnType<typeof createTestAgentRuntimeParams>,
  'agentTemplate' | 'localAgentTemplates'
> & {
  promptAiSdkStream?: ReturnType<typeof mock>
}

const state: {
  mockTemplate: AgentTemplate
  mockAgentState: AgentState
  llmCallCount: number
  agentRuntimeImpl: RuntimeImpl
  loopAgentStepsBaseParams: Parameters<typeof loopAgentSteps>[0]
  dbSpies: DbSpies
} = {
  mockTemplate: undefined as unknown as AgentTemplate,
  mockAgentState: undefined as unknown as AgentState,
  llmCallCount: 0,
  agentRuntimeImpl: undefined as unknown as RuntimeImpl,
  loopAgentStepsBaseParams: undefined as unknown as Parameters<
    typeof loopAgentSteps
  >[0],
  dbSpies: undefined as unknown as DbSpies,
}

export function getTemplate(): AgentTemplate {
  return state.mockTemplate
}

export function getBaseParams(): Parameters<typeof loopAgentSteps>[0] {
  return state.loopAgentStepsBaseParams
}

export function getLlmCallCount(): number {
  return state.llmCallCount
}

export function incrLlmCallCount(): number {
  state.llmCallCount += 1
  return state.llmCallCount
}

/** Register the family's per-test lifecycle at the caller's describe scope. */
export function registerLoopAgentStepsPartFLifecycle(): void {
  beforeAll(async () => {
    // Set up mocks.
  })

  beforeEach(() => {
    const {
      agentTemplate: _,
      localAgentTemplates: __,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()

    state.agentRuntimeImpl = {
      ...baseRuntimeParams,
    }

    state.llmCallCount = 0

    // Setup spies for database operations using typed helper
    state.dbSpies = setupDbSpies(createMockDbOperations())

    state.agentRuntimeImpl.promptAiSdkStream = mock(async function* ({}) {
      state.llmCallCount++
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
    state.mockTemplate = {
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
    state.mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'test-agent-id',
      messageHistory: [
        userMessage('Initial message'),
        assistantMessage('Initial response'),
      ],
      output: undefined,
      stepsRemaining: 10, // Ensure we don't hit the limit
    }

    state.loopAgentStepsBaseParams = {
      ...state.agentRuntimeImpl,
      agentType: 'test-agent',
      localAgentTemplates: { 'test-agent': state.mockTemplate },
      repoId: undefined,
      repoUrl: undefined,
      userInputId: 'test-user-input',
      agentState: state.mockAgentState,
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
    clearAgentGeneratorCache(state.agentRuntimeImpl)
    state.dbSpies.restore()
    mock.restore()
    const {
      agentTemplate: _,
      localAgentTemplates: __,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()
    state.agentRuntimeImpl = {
      ...baseRuntimeParams,
    }
  })

  afterAll(() => {
    clearMockedModules()
  })
}
