import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
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

import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { mockFileContext } from './test-utils'
import * as toolExecutor from '../tools/tool-executor'

import type { AgentTemplate, StepGenerator } from '../templates/types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'

const logger: Logger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

// FID-2026-0803-001 ECHO-1: handleSteps tool calls must be bounded by
// toolNames ∪ programmaticToolNames ∪ PROGRAMMATIC_PRIMITIVES. Anything else
// fails closed with a diagnosable error instead of executing.
describe('programmatic tool authorization (ECHO-1)', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let mockParams: ParamsOf<typeof runProgrammaticStep>
  let executeToolCallSpy: ReturnType<
    typeof spyOn<typeof toolExecutor, 'executeToolCall'>
  >
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

  beforeEach(() => {
    agentRuntimeImpl = {
      ...TEST_AGENT_RUNTIME_IMPL,
      addAgentStep: async () => 'test-agent-step-id',
      sendAction: () => {},
    }

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    executeToolCallSpy = spyOn(
      toolExecutor,
      'executeToolCall',
    ).mockImplementation(async () => {})

    spyOn(crypto, 'randomUUID').mockImplementation(
      () =>
        'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
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
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test user prompt',
      stepPrompt: 'Test agent step prompt',
      handleSteps: undefined,
    } as AgentTemplate

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

    mockParams = {
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
      tools: {},
      logger,
      signal: new AbortController().signal,
    }
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
  })

  it('executes tools declared in toolNames', async () => {
    mockTemplate.toolNames = ['read_files', 'end_turn']
    mockTemplate.handleSteps = () =>
      (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

    const result = await runProgrammaticStep(mockParams)

    expect(result.endTurn).toBe(true)
    expect(result.agentState.output?.error).toBeUndefined()
    expect(executeToolCallSpy).toHaveBeenCalledTimes(2)
  })

  it('executes PROGRAMMATIC_PRIMITIVES without declaration', async () => {
    // set_output is an internal plumbing primitive — no declaration needed.
    // end_turn is NOT a primitive: it stays declaration-required (here via
    // toolNames) so generators never get a free end-turn.
    mockTemplate.toolNames = ['end_turn']
    mockTemplate.handleSteps = () =>
      (function* () {
        yield { toolName: 'set_output', input: { status: 'ok' } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

    const result = await runProgrammaticStep(mockParams)

    expect(result.agentState.output?.error).toBeUndefined()
    expect(executeToolCallSpy).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'set_output' }),
    )
  })

  it('executes programmaticToolNames without exposing them to the model (thinker-with-files case)', async () => {
    // ECHO-2: the thinker keeps toolNames empty (model sees no tools) while the
    // generator reads the passed filePaths via programmaticToolNames.
    mockTemplate.programmaticToolNames = ['read_files', 'end_turn']
    mockTemplate.handleSteps = () =>
      (function* () {
        yield { toolName: 'read_files', input: { paths: ['a.ts'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

    const result = await runProgrammaticStep(mockParams)

    expect(result.endTurn).toBe(true)
    expect(result.agentState.output?.error).toBeUndefined()
    expect(executeToolCallSpy).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'read_files' }),
    )
  })

  it('rejects undeclared non-primitive yields with a diagnosable error', async () => {
    mockTemplate.handleSteps = () =>
      (function* () {
        yield {
          toolName: 'write_file',
          input: { path: 'x.txt', content: 'x' },
        }
      })() as StepGenerator

    const responseChunks: unknown[] = []
    mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

    const result = await runProgrammaticStep(mockParams)

    // Fails closed: endTurn set, no tool executed, error surfaced.
    expect(result.endTurn).toBe(true)
    expect(executeToolCallSpy).not.toHaveBeenCalled()
    expect(result.agentState.output?.error).toContain(
      'not declared in toolNames/programmaticToolNames',
    )
    expect(result.agentState.output?.error).toContain('write_file')
    expect(
      responseChunks.some(
        (chunk) => typeof chunk === 'string' && chunk.includes('write_file'),
      ),
    ).toBe(true)
  })
})
