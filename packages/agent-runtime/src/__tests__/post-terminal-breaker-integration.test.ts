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
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { createToolCallChunk, mockFileContext } from './test-utils'
import { loopAgentSteps } from '../run-agent-step'
import { POST_TERMINAL_CONTINUATION_LIMIT } from '../run-agent-step/post-terminal-breaker'
import { clearAgentGeneratorCache } from '../run-programmatic-step'

import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@savant-code/common/testing/mocks/database'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0822-003 wiring proof: the post-terminal terminator must fire at
 * exactly POST_TERMINAL_CONTINUATION_LIMIT consecutive overridden completions
 * (synthetic-only inputs) and must NEVER fire for autonomous continuations
 * (Auto Drive / active goal). The injected echoCompliance tracker stands in
 * for the real synthetic-injection source: its steering flips every clean
 * completion back into the loop, reproducing the live runaway cycle.
 */
describe('FID-2026-0822-003 post-terminal terminator wiring', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let agentRuntimeImpl: Omit<
    ReturnType<typeof createTestAgentRuntimeParams>,
    'agentTemplate' | 'localAgentTemplates'
  > & {
    promptAiSdkStream?: ReturnType<typeof mock>
  }
  let baseParams: Parameters<typeof loopAgentSteps>[0]
  let dbSpies: DbSpies
  let llmCallCount: number
  let chunks: unknown[]

  const complianceTracker = () =>
    ({
      mode: 'strict',
      evaluateAtStepBoundary: () => [
        { law: 15, severity: 'warning', message: 'synthetic' },
      ],
      takeSteeringMessages: () => ['synthetic nudge'],
    }) as unknown as NonNullable<AgentState['echoCompliance']>

  beforeEach(() => {
    const {
      agentTemplate: _a,
      localAgentTemplates: _b,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()
    agentRuntimeImpl = { ...baseRuntimeParams }
    llmCallCount = 0
    chunks = []
    dbSpies = setupDbSpies(createMockDbOperations())
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})
    spyOn(crypto, 'randomUUID').mockImplementation(
      () => 'mock-uuid-0000-0000-0000-000000000000' as const,
    )

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
      toolNames: ['read_files', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test user prompt',
      stepPrompt: 'Test agent step prompt',
      handleSteps: undefined,
    } satisfies AgentTemplate as AgentTemplate

    const sessionState = getInitialSessionState(mockFileContext)
    mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'test-agent-id',
      messageHistory: [
        userMessage('Initial message'),
        assistantMessage('Initial response'),
      ],
      output: undefined,
      stepsRemaining: 30,
    }

    baseParams = {
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
      onResponseChunk: (chunk) => {
        chunks.push(chunk)
      },
      signal: new AbortController().signal,
    }

    baseParams.promptAiSdkStream = async function* () {
      llmCallCount++
      yield { type: 'text' as const, text: 'Done.\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }
  })

  afterEach(() => {
    clearAgentGeneratorCache(agentRuntimeImpl)
    dbSpies.restore()
    mock.restore()
  })

  afterAll(() => {
    clearMockedModules()
  })

  it('auto-ends after exactly LIMIT post-terminal continuations', async () => {
    mockAgentState.echoCompliance = complianceTracker()
    await loopAgentSteps({ ...baseParams })

    // Every LLM call completed cleanly (text + end_turn); compliance steering
    // overrode each completion back into the loop until the breaker tripped.
    expect(llmCallCount).toBe(POST_TERMINAL_CONTINUATION_LIMIT)
    expect(
      chunks.some(
        (chunk) =>
          typeof chunk === 'string' &&
          chunk.includes('Turn auto-ended: no operator input'),
      ),
    ).toBe(true)
  })

  it('never fires for Auto Drive continuations (operator carve-out)', async () => {
    mockAgentState.echoCompliance = complianceTracker()
    mockAgentState.drive = {
      driveId: 'drive-1',
      goal: 'autonomous work',
      acceptanceCriteria: [],
      status: 'active',
      startedAt: Date.now(),
    }

    await loopAgentSteps({ ...baseParams })

    // The breaker is bypassed entirely: the run proceeds until the generic
    // stepsRemaining backstop (30) ends it, with NO terminator notice.
    expect(llmCallCount).toBe(30)
    expect(
      chunks.some(
        (chunk) =>
          typeof chunk === 'string' &&
          chunk.includes('Turn auto-ended: no operator input'),
      ),
    ).toBe(false)
  })
})
