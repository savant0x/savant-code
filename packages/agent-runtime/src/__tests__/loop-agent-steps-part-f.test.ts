import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
  testLogger,
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
import { clearThinkerConvergenceStateForTests } from '../tools/thinker-convergence-gate'
import { clearAllThoughtSessionsForTests } from '../tools/thought-session-store'

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

  describe('native tool-call recovery (FID-2026-0801-010)', () => {
    it('retries twice, then fails visibly without a fourth model call', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }
      let finishStatus: string | undefined
      let finishError: string | undefined

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallCount++
        yield {
          type: 'error' as const,
          message: 'Incomplete arguments for tool sequentialthinking',
          errorClass: 'native-incomplete' as const,
          toolName: 'sequentialthinking',
        }
        return promptSuccess(`native-incomplete-${llmCallCount}`)
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
        finishAgentRun: mock(
          async (params: { status: string; errorMessage?: string }) => {
            finishStatus = params.status
            finishError = params.errorMessage
          },
        ),
      })

      expect(llmCallCount).toBe(3)
      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain(
          'Native tool-call recovery failed repeatedly',
        )
        expect(result.output.message).toContain('(tool: sequentialthinking)')
        expect(result.output.message).toContain('Re-spawn with the work split')
      }
      expect(finishStatus).toBe('failed')
      expect(finishError).toContain(
        'Native tool-call recovery failed repeatedly',
      )
      expect(finishError).toContain('(tool: sequentialthinking)')

      const history = result.agentState.messageHistory
      expect(
        history.some(
          (message) =>
            message.role === 'assistant' &&
            message.content.some((part) => part.type === 'tool-call'),
        ),
      ).toBe(false)
      expect(history.some((message) => message.role === 'tool')).toBe(false)
      expect(
        history.some(
          (message) =>
            message.role === 'user' &&
            message.tags?.includes('TOOL_CALL_ERROR'),
        ),
      ).toBe(true)
    })

    it('recovers on the next step with one valid sequentialthinking result', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        id: 'thinker-test-agent',
        handleSteps: undefined,
        toolNames: ['sequentialthinking', 'end_turn'],
      } satisfies AgentTemplate

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallCount++
        if (llmCallCount === 1) {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool sequentialthinking',
            errorClass: 'native-incomplete' as const,
            toolName: 'sequentialthinking',
          }
        } else {
          yield createToolCallChunk('sequentialthinking', {
            thought: 'The continuation is executing the complete native call.',
            thoughtNumber: 1,
            totalThoughts: 1,
            nextThoughtNeeded: false,
          })
          yield createToolCallChunk('end_turn', {})
        }
        return promptSuccess(`recovery-${llmCallCount}`)
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(llmCallCount).toBe(2)
      expect(result.output.type).not.toBe('error')

      const assistantToolCalls = result.agentState.messageHistory.filter(
        (message) =>
          message.role === 'assistant' &&
          message.content.some(
            (part) =>
              part.type === 'tool-call' &&
              part.toolName === 'sequentialthinking',
          ),
      )
      const sequentialThinkingResults = result.agentState.messageHistory.filter(
        (message) =>
          message.role === 'tool' && message.toolName === 'sequentialthinking',
      )

      expect(assistantToolCalls).toHaveLength(1)
      expect(sequentialThinkingResults).toHaveLength(1)
      expect(
        result.agentState.messageHistory.some(
          (message) =>
            message.role === 'user' &&
            message.tags?.includes('TOOL_CALL_ERROR'),
        ),
      ).toBe(true)

      // FID-2026-0816-012: non-payload tools keep the generic message — no
      // split-steering appended.
      const errorMessage = result.agentState.messageHistory.find(
        (message) =>
          message.role === 'user' && message.tags?.includes('TOOL_CALL_ERROR'),
      )
      const errorContent = errorMessage
        ? typeof errorMessage.content === 'string'
          ? errorMessage.content
          : JSON.stringify(errorMessage.content)
        : ''
      expect(errorContent).not.toContain('split the work into multiple')
    })

    it('steers large-payload tool retries toward splitting the work', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallCount++
        if (llmCallCount === 1) {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool write_file',
            errorClass: 'native-incomplete' as const,
            toolName: 'write_file',
          }
        } else {
          yield createToolCallChunk('end_turn', {})
        }
        return promptSuccess(`steer-${llmCallCount}`)
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(llmCallCount).toBe(2)
      expect(result.output.type).not.toBe('error')
      const errorMessage = result.agentState.messageHistory.find(
        (message) =>
          message.role === 'user' && message.tags?.includes('TOOL_CALL_ERROR'),
      )
      const errorContent = errorMessage
        ? typeof errorMessage.content === 'string'
          ? errorMessage.content
          : JSON.stringify(errorMessage.content)
        : ''
      expect(errorContent).toContain(
        'split the work into multiple smaller tool calls',
      )
    })

    it('warns on an incomplete call for an unknown tool and names it on exhaustion', async () => {
      const warnSpy = spyOn(testLogger, 'warn')
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallCount++
        yield {
          type: 'error' as const,
          message: 'Incomplete arguments for tool not_a_real_tool',
          errorClass: 'native-incomplete' as const,
          toolName: 'not_a_real_tool',
        }
        return promptSuccess(`drift-${llmCallCount}`)
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
      })

      expect(llmCallCount).toBe(3)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'not_a_real_tool' }),
        expect.stringContaining('unknown to the runtime'),
      )
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('(tool: not_a_real_tool)')
      }
    })

    it('resets the native-incomplete streak after an unrelated tool error', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }
      let finishStatus: string | undefined

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallCount++
        if (llmCallCount === 2) {
          yield {
            type: 'error' as const,
            message: 'An unrelated tool validation error',
          }
        } else {
          yield {
            type: 'error' as const,
            message: 'Incomplete arguments for tool sequentialthinking',
            errorClass: 'native-incomplete' as const,
            toolName: 'sequentialthinking',
          }
        }
        return promptSuccess(`recovery-${llmCallCount}`)
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentTemplate: llmOnlyTemplate,
        localAgentTemplates: { 'test-agent': llmOnlyTemplate },
        finishAgentRun: mock(async (params: { status: string }) => {
          finishStatus = params.status
        }),
      })

      // FID-2026-0816-012: with the 3-strike cap, the reset streak needs 3
      // consecutive incompletes (calls 3-5) after the unrelated error resets
      // call 1's streak.
      expect(llmCallCount).toBe(5)
      expect(result.output.type).toBe('error')
      expect(finishStatus).toBe('failed')
    })
  })

  describe('Thinker convergence gate integration (FID-2026-0801-012)', () => {
    const thinkerTemplate = (): AgentTemplate => ({
      ...mockTemplate,
      id: 'thinker-test-agent',
      outputMode: 'structured_output',
      outputSchema: z.object({
        status: z.string(),
        payload: z.object({ message: z.string() }).nullable(),
      }),
      toolNames: ['sequentialthinking', 'end_turn'],
      handleSteps: undefined,
    })

    afterEach(() => {
      clearAllThoughtSessionsForTests()
      clearThinkerConvergenceStateForTests()
    })

    it('sets output from the session snapshot and breaks without the set_output restart', async () => {
      // The Thinker converges with a single nextThoughtNeeded=false thought and
      // ends its turn. The gate must build the FinalArtifact from the session
      // snapshot and set agentState.output BEFORE the loop-top
      // `output === undefined && shouldEndTurn` restart check can inject the
      // "You must use set_output" message (which would reintroduce the null).
      const template = thinkerTemplate()
      let llmCallNumber = 0
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallNumber++
        yield createToolCallChunk('sequentialthinking', {
          thought: 'Conclusion: use the hybrid approach.',
          thoughtNumber: 1,
          totalThoughts: 1,
          nextThoughtNeeded: false,
        })
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
        return promptSuccess('mock-message-id')
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'thinker-test-agent',
        localAgentTemplates: { 'thinker-test-agent': template },
      })

      // Exactly one LLM call: the loop must NOT have restarted.
      expect(llmCallNumber).toBe(1)
      expect(result.agentState.output).toBeDefined()
      expect((result.agentState.output as { status?: string }).status).toBe(
        'success',
      )
      const restartMessages = result.agentState.messageHistory.filter(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('set_output'),
      )
      expect(restartMessages.length).toBe(0)
    })

    it('retries on non-convergence instead of restarting, then converges', async () => {
      // First turn: the model thinks (nextThoughtNeeded=true) and ends the turn
      // unconverged. The gate appends a typed retry message and keeps the loop
      // going — it must NOT hit the set_output restart path. Second turn
      // converges and the gate sets the artifact.
      const template = thinkerTemplate()
      let llmCallNumber = 0
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        llmCallNumber++
        if (llmCallNumber === 1) {
          yield createToolCallChunk('sequentialthinking', {
            thought: 'Partial analysis, not done yet.',
            thoughtNumber: 1,
            totalThoughts: 2,
            nextThoughtNeeded: true,
          })
        } else {
          yield createToolCallChunk('sequentialthinking', {
            thought: 'Final conclusion: hybrid wins.',
            thoughtNumber: 2,
            totalThoughts: 2,
            nextThoughtNeeded: false,
          })
        }
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
        return promptSuccess('mock-message-id')
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'thinker-test-agent',
        localAgentTemplates: { 'thinker-test-agent': template },
      })

      // Two LLM calls: first unconverged turn + retry, second converged turn.
      expect(llmCallNumber).toBe(2)
      expect(result.agentState.output).toBeDefined()
      expect((result.agentState.output as { status?: string }).status).toBe(
        'success',
      )
      // The typed retry message was appended after the first turn...
      const retryMessages = result.agentState.messageHistory.filter(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('nextThoughtNeeded=false'),
      )
      expect(retryMessages.length).toBeGreaterThan(0)
      // ...and the set_output restart message was never injected.
      const restartMessages = result.agentState.messageHistory.filter(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('set_output'),
      )
      expect(restartMessages.length).toBe(0)
    })
  })
})
