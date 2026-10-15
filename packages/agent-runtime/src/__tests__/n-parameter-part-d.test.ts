import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptAborted, promptSuccess } from '@savant-code/common/util/error'
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
import { clearAgentGeneratorCache } from '../run-programmatic-step'
import { mockFileContext } from './test-utils'

import type { AgentTemplate } from '../templates/types'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'

const logger: Logger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

describe('n parameter and GENERATE_N functionality', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let agentRuntimeImpl: any
  let runAgentStepBaseParams: any

  beforeEach(() => {
    agentRuntimeImpl = {
      ...createTestAgentRuntimeParams(),

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
    clearAgentGeneratorCache({ logger })
  })

  describe('runAgentStep n parameter edge cases', () => {
    it('should handle promptAiSdk returning malformed JSON', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptSuccess('Not valid JSON')),
      )

      await expect(
        runAgentStep({
          ...runAgentStepBaseParams,
          n: 3,
        }),
      ).rejects.toThrow()
    })

    it('should update agentState.creditsUsed when using n parameter', async () => {
      // Create a fresh agent state with zero credits for this test
      const freshAgentState = {
        ...mockAgentState,
        creditsUsed: 0,
        directCreditsUsed: 0,
      }

      runAgentStepBaseParams.promptAiSdk = mock(
        async (params: ParamsOf<PromptAiSdkFn>): ReturnType<PromptAiSdkFn> => {
          // Call onCostCalculated to simulate cost tracking
          await params.onCostCalculated?.(100)
          return promptSuccess(JSON.stringify(['R1', 'R2', 'R3']))
        },
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        agentState: freshAgentState,
        n: 3,
      })

      // Verify onCostCalculated was called in promptAiSdk
      expect(runAgentStepBaseParams.promptAiSdk).toHaveBeenCalled()

      // Verify credits were updated from 0 to 100
      expect(result.agentState.creditsUsed).toBe(100)
      expect(result.agentState.directCreditsUsed).toBe(100)
    })

    it('should preserve messageHistory when using n parameter', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptSuccess(JSON.stringify(['R1', 'R2']))),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 2,
      })

      // Message history should include the user prompt that was added
      // The implementation adds user prompt message before calling promptAiSdk
      expect(result.agentState.messageHistory.length).toBeGreaterThanOrEqual(
        mockAgentState.messageHistory.length,
      )

      // Verify the messages are preserved
      expect(result.agentState.messageHistory).toBeDefined()
    })

    it('should return early with shouldEndTurn: true when promptAiSdk returns aborted', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted('User cancelled')),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 3,
      })

      // Verify promptAiSdk was called
      expect(runAgentStepBaseParams.promptAiSdk).toHaveBeenCalled()

      // Verify early return values for aborted request
      expect(result.fullResponse).toBe('')
      expect(result.shouldEndTurn).toBe(true)
      expect(result.messageId).toBe(null)
      expect(result.nResponses).toBeUndefined()
    })

    it('should return early when promptAiSdk returns aborted without reason', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted()),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 2,
      })

      expect(result.fullResponse).toBe('')
      expect(result.shouldEndTurn).toBe(true)
      expect(result.messageId).toBe(null)
      expect(result.nResponses).toBeUndefined()
    })

    it('should not modify agentState.creditsUsed when promptAiSdk is aborted before onCostCalculated', async () => {
      const freshAgentState = {
        ...mockAgentState,
        creditsUsed: 0,
        directCreditsUsed: 0,
      }

      // Mock promptAiSdk to return aborted without calling onCostCalculated
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted()),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        agentState: freshAgentState,
        n: 3,
      })

      // Credits should remain 0 since request was aborted
      expect(result.agentState.creditsUsed).toBe(0)
      expect(result.agentState.directCreditsUsed).toBe(0)
    })
  })
})
