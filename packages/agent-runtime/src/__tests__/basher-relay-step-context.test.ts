import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import {
  createMockDbOperations,
  setupDbSpies,
} from '@savant-code/common/testing/mocks/database'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import {
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
import { clearAgentGeneratorCache } from '../run-programmatic-step'
import { findMessageArray } from './basher-relay-helpers'
import * as toolExecutor from '../tools/tool-executor'

import type { AgentTemplate, StepGenerator } from '../templates/types'
import type { DbSpies } from '@savant-code/common/testing/mocks/database'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0821-005 Workstream A / A8 — diagnostic-first relay probe.
 *
 * Drives a NON-inline basher-contract agent (includeMessageHistory:false;
 * handleSteps yields run_terminal_command -> consumes the generator return
 * -> BASHER-1 premise -> yields 'STEP'; mirrors agents/basher.ts :80-:124)
 * through loopAgentSteps — the layer where the summarizer STEP LLM call is
 * actually assembled (loop-iteration -> runAgentStep -> step.ts).
 *
 * Pass condition under test: the STEP call's provider-bound messages contain
 *   [assistant(tool-call), tool(json result), user(STEP_PROMPT)]
 * in order. A failure emits the observed roles sequence — that sequence IS
 * the A9 bisection evidence.
 */

describe('basher relay — summarizer STEP context (FID-2026-0821-005 A8)', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let agentRuntimeImpl: Omit<
    ReturnType<typeof createTestAgentRuntimeParams>,
    'agentTemplate' | 'localAgentTemplates'
  > & {
    promptAiSdkStream?: ReturnType<typeof mock>
  }
  let loopAgentStepsBaseParams: Parameters<typeof loopAgentSteps>[0]
  let dbSpies: DbSpies
  let providerCalls: unknown[][]
  let generatorFirstResultType: string | undefined

  beforeEach(() => {
    const {
      agentTemplate: _agentTemplate,
      localAgentTemplates: _localAgentTemplates,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()

    agentRuntimeImpl = {
      ...baseRuntimeParams,
    }

    providerCalls = []
    generatorFirstResultType = undefined

    dbSpies = setupDbSpies(createMockDbOperations())

    // The probe stream: record every provider call, then end the turn so the
    // loop terminates after the summarizer STEP.
    agentRuntimeImpl.promptAiSdkStream = mock(async function* (
      ...callArgs: unknown[]
    ) {
      providerCalls.push(callArgs)
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('relay-probe-message-id')
    })

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})
    spyOn(crypto, 'randomUUID').mockImplementation(
      () => 'mock-uuid-0000-0000-0000-000000000000' as const,
    )

    // Basher-contract replica (non-inline): no parent history seeding, the
    // terminal-command tool, and the STEP-yielding handleSteps core.
    mockTemplate = {
      id: 'relay-probe-agent',
      displayName: 'Relay Probe Agent',
      spawnerPrompt: 'Testing',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'last_message',
      includeMessageHistory: false,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['run_terminal_command', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'RELAY_PROBE_SYSTEM',
      instructionsPrompt: 'RELAY_PROBE_INSTRUCTIONS',
      stepPrompt: 'RELAY_PROBE_STEP',
      handleSteps: function* (): StepGenerator {
        const { toolResult } = (yield {
          toolName: 'run_terminal_command',
          input: { command: 'echo RELAY_MARKER_OUTPUT' },
        } as never) as {
          toolResult?: Array<{ type?: string; value?: unknown }>
        }
        const firstResult = toolResult?.[0]
        generatorFirstResultType = firstResult?.type

        // A10 writer side — mirrors agents/basher.ts: park a truncated
        // head/tail excerpt of the delivered output on agentState so
        // run-agent-step/step.ts injects it beside the STEP_PROMPT.
        const deliveredValue =
          firstResult?.type === 'json' ? firstResult.value : undefined
        const rawOutput =
          deliveredValue && typeof deliveredValue === 'object'
            ? (deliveredValue as { output?: unknown }).output
            : undefined
        const outputText =
          typeof rawOutput === 'string'
            ? rawOutput
            : JSON.stringify(deliveredValue ?? '')
        const DIGEST_HEAD = 400
        const relayDigest =
          outputText.length > DIGEST_HEAD * 2 + 40
            ? `${outputText.slice(0, DIGEST_HEAD)}\n…[elided ${outputText.length - DIGEST_HEAD * 2} chars]…\n${outputText.slice(-DIGEST_HEAD)}`
            : outputText
        if (relayDigest.length > 0) {
          mockAgentState.relayDigest = relayDigest
        }

        yield 'STEP'
      },
    } satisfies AgentTemplate as AgentTemplate

    // Non-inline seeding contract: includeMessageHistory:false -> the child
    // starts with an EMPTY history (spawn-agent-utils createAgentState).
    const sessionState = getInitialSessionState(mockFileContext)
    mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'relay-probe-agent-id',
      messageHistory: [],
      output: undefined,
      stepsRemaining: 10,
    }

    loopAgentStepsBaseParams = {
      ...agentRuntimeImpl,
      agentType: 'relay-probe-agent',
      localAgentTemplates: { 'relay-probe-agent': mockTemplate },
      repoId: undefined,
      repoUrl: undefined,
      userInputId: 'test-user-input',
      agentState: mockAgentState,
      prompt: 'RELAY_PROBE_SPAWN_PROMPT',
      spawnParams: { command: 'echo RELAY_MARKER_OUTPUT' },
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
  })

  it('delivers [tool-call, tool-result, STEP_PROMPT] to the provider on the STEP call', async () => {
    // Production-mirroring executor stub: push the delivered json ToolMessage
    // into BOTH the generator-facing results array AND the child history
    // (execute-tool-calls.ts pushes at ~:89/:171).
    const executeToolCallSpy = spyOn(
      toolExecutor,
      'executeToolCall',
    ).mockImplementation(async (options) => {
      const { toolName, toolResults, agentState } = options
      const toolResult = {
        role: 'tool' as const,
        toolName,
        toolCallId: `${toolName}-call-id`,
        content: [
          {
            type: 'json' as const,
            value: {
              output: 'RELAY_MARKER_OUTPUT\nexit code 0',
              exitCode: 0,
            },
          },
        ],
      }
      toolResults.push(toolResult)
      agentState.messageHistory.push(toolResult)
    })

    const result = (await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentTemplate: mockTemplate,
      localAgentTemplates: { 'relay-probe-agent': mockTemplate },
    })) as { agentState: AgentState }

    // Guard premise: the generator received a DELIVERED json result — i.e.
    // BASHER-1 passed and the STEP call was armed (agents/basher.ts:105-121).
    expect(generatorFirstResultType).toBe('json')
    void executeToolCallSpy

    // Hop-1 integrity: the ToolMessage reached the CHILD history.
    const historyToolMessage = (
      result.agentState.messageHistory as Array<Record<string, unknown>>
    ).find(
      (message) =>
        message.role === 'tool' &&
        JSON.stringify(message).includes('RELAY_MARKER_OUTPUT'),
    )
    expect(historyToolMessage).toBeDefined()

    // Hop-2 under test: the provider-bound messages of the STEP call. For a
    // handleSteps agent the loop makes EXACTLY ONE provider call (the STEP);
    // assert that too — an extra call would mean the initial-turn path fired.
    expect(providerCalls.length).toBe(1)
    const providerMessages = findMessageArray(providerCalls[0])
    expect(providerMessages).toBeDefined()
    if (!providerMessages) {
      return
    }

    const idxAssistant = providerMessages.findIndex(
      (message) => message.role === 'assistant',
    )
    const idxTool = providerMessages.findIndex(
      (message) =>
        message.role === 'tool' &&
        JSON.stringify(message).includes('RELAY_MARKER_OUTPUT'),
    )
    const idxUserStep = providerMessages.findIndex(
      (message) =>
        message.role === 'user' &&
        JSON.stringify(message).includes('RELAY_PROBE_STEP'),
    )

    // THE A8 PROBE: ordered [assistant(tool-call), tool(result), user(STEP)].
    if (!(
      idxAssistant >= 0 &&
      idxTool === idxAssistant + 1 &&
      idxUserStep > idxTool
    )) {
      const roles = providerMessages
        .map((message) => String(message.role))
        .join(' -> ')
      throw new Error(
        `A8 DIAGNOSTIC FAIL — provider-bound roles: [${roles}]; ` +
          `assistant@${idxAssistant} tool@${idxTool} userStep@${idxUserStep}`,
      )
    }

    // A10 defense-in-depth: the parked relay digest rides BESIDE the
    // STEP_PROMPT carrying ground truth even if the json ToolMessage fails
    // to render downstream.
    const idxRelayDigest = providerMessages.findIndex(
      (message) =>
        message.role === 'user' &&
        JSON.stringify(message).includes('relay safeguard') &&
        JSON.stringify(message).includes('RELAY_MARKER_OUTPUT'),
    )
    expect(idxRelayDigest).toBeGreaterThan(idxUserStep)

    // A10 consume-once contract: cleared after injection.
    expect(
      (result.agentState as { relayDigest?: string }).relayDigest,
    ).toBeUndefined()
  })
})
