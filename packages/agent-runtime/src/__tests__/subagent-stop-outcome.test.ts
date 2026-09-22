import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { assistantMessage } from '@savant-code/common/util/messages'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { mockFileContext } from './test-utils'
import { HookEngine } from '../hooks/engine'
import { buildSubagentOutcome } from '../hooks/subagent-outcome'
import * as runAgentStep from '../run-agent-step'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { HookInputData } from '../hooks/types'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'

/**
 * FID-2026-0919-029 — the SubagentStop outcome payload.
 *
 * These pins run through the REAL spawn boundary (`handleSpawnAgents` →
 * `runSingleSubagent` → `executeSubagent`), not a direct `buildSubagentOutcome`
 * call, because the defect being pinned was at the call site: the contract
 * already supported `tool_result`/`error_message` and simply was not used.
 * A builder-only test would have passed against the broken code.
 */

function template(id: string): AgentTemplate {
  return {
    id,
    displayName: `Mock ${id}`,
    outputMode: 'last_message',
    inputSchema: {
      prompt: {
        safeParse: () => ({ success: true }),
      } as unknown as AgentTemplate['inputSchema']['prompt'],
    },
    spawnerPrompt: '',
    model: 'test/model',
    includeMessageHistory: false,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames: [],
    spawnableAgents: ['child-agent'],
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  }
}

const spawnToolCall = (): SavantCodeToolCall<'spawn_agents'> => ({
  toolName: 'spawn_agents' as const,
  toolCallId: 'call-1',
  input: { agents: [{ agent_type: 'child-agent', prompt: 'do it' }] },
})

type SpawnOutcome = {
  fired: HookInputData[]
  reports: { value?: { errorMessage?: string } }[]
}

/**
 * Drive one real batch spawn with a scripted child loop. Returns every hook the
 * boundary fired plus the parent-facing reports (so a failure that the batch
 * path converts into `errorMessage` is still observable).
 */
async function spawnOnce(
  childLoop: () => Promise<{ agentState: never; output: never }>,
  prepare?: (session: ReturnType<typeof getInitialSessionState>) => void,
): Promise<SpawnOutcome> {
  const fired: HookInputData[] = []
  spyOn(HookEngine.prototype, 'fireAndForgetTrigger').mockImplementation(
    (input: HookInputData) => {
      fired.push(input)
    },
  )
  spyOn(runAgentStep, 'loopAgentSteps').mockImplementation(childLoop as never)

  const session = getInitialSessionState(mockFileContext)
  prepare?.(session)

  const result = await handleSpawnAgents({
    ...TEST_AGENT_RUNTIME_IMPL,
    ancestorRunIds: [],
    clientSessionId: 'test-session',
    fingerprintId: 'test-fingerprint',
    fileContext: mockFileContext,
    repoId: undefined,
    repoUrl: undefined,
    previousToolCallFinished: Promise.resolve(),
    sendSubagentChunk: () => {},
    signal: new AbortController().signal,
    system: 'Test system prompt',
    tools: {},
    userId: 'test-user',
    userInputId: 'test-input',
    writeToClient: () => {},
    agentState: session.mainAgentState,
    agentTemplate: template('parent'),
    localAgentTemplates: { 'child-agent': template('child-agent') },
    toolCall: spawnToolCall(),
  } as never)

  // The handler returns a JSON tool result whose value is the per-agent report
  // list (`jsonToolResult(reports)`).
  const parts = result.output as unknown as {
    value?: { value?: { errorMessage?: string } }[]
  }[]

  return { fired, reports: parts[0]?.value ?? [] }
}

function completedOutput() {
  return { type: 'lastMessage', value: [assistantMessage('done')] }
}

function hookOf(
  fired: HookInputData[],
  event: 'SubagentStart' | 'SubagentStop',
): HookInputData | undefined {
  return fired.find((input) => input.hook_event_name === event)
}

afterEach(() => {
  mock.restore()
})

describe('SubagentStop outcome payload (FID-2026-0919-029)', () => {
  it('reports a finished child as completed, with identity and output shape', async () => {
    const { fired } = await spawnOnce(async () => {
      const session = getInitialSessionState(mockFileContext)
      const agentState = session.mainAgentState
      agentState.runId = 'child-run-1'
      agentState.creditsUsed = 42
      return {
        agentState: agentState as never,
        output: completedOutput() as never,
      }
    })

    const stop = hookOf(fired, 'SubagentStop')

    expect(stop).toBeDefined()
    expect(stop?.subagent_type).toBe('child-agent')
    expect(stop?.tool_result).toEqual({
      status: 'completed',
      agentType: 'child-agent',
      runId: 'child-run-1',
      creditsUsed: 42,
      outputType: 'lastMessage',
    })
    // A completed child must not carry an error_message.
    expect(stop?.error_message).toBeUndefined()
  })

  it('keeps SubagentStart outcome-free so the pair is distinguishable', async () => {
    const { fired } = await spawnOnce(async () => {
      const agentState = getInitialSessionState(mockFileContext).mainAgentState
      return {
        agentState: agentState as never,
        output: completedOutput() as never,
      }
    })

    const start = hookOf(fired, 'SubagentStart')

    expect(start).toBeDefined()
    expect(start?.subagent_type).toBe('child-agent')
    // Start is not the signal operators use to learn the outcome.
    expect(start?.tool_result).toBeUndefined()
    expect(start?.error_message).toBeUndefined()
    expect(hookOf(fired, 'SubagentStop')).toBeDefined()
  })

  it('reports a child whose loop returned the error form as failed', async () => {
    const { fired } = await spawnOnce(async () => {
      const agentState = getInitialSessionState(mockFileContext).mainAgentState
      agentState.runId = 'child-run-2'
      return {
        agentState: agentState as never,
        output: {
          type: 'error',
          message: 'No assistant turn was produced',
        } as never,
      }
    })

    const stop = hookOf(fired, 'SubagentStop')

    expect(stop?.tool_result).toMatchObject({
      status: 'failed',
      runId: 'child-run-2',
      outputType: 'error',
    })
    expect(stop?.error_message).toBe('No assistant turn was produced')
  })

  it('reports a thrown child as failed with the cause, and the batch path surfaces it', async () => {
    const { fired, reports } = await spawnOnce(async () => {
      throw new Error('provider exploded')
    })

    const stop = hookOf(fired, 'SubagentStop')

    expect(stop?.tool_result).toMatchObject({
      status: 'failed',
      outputType: null,
    })
    expect(stop?.error_message).toBe('provider exploded')
    // The same failure is what the parent sees — hook and caller agree.
    expect(reports[0]?.value?.errorMessage).toContain('provider exploded')
  })
})

describe('buildSubagentOutcome contract', () => {
  it('treats a missing result as failed rather than assuming success', () => {
    expect(buildSubagentOutcome({ agentType: 'x' })).toEqual({
      status: 'failed',
      agentType: 'x',
      runId: null,
      creditsUsed: 0,
      outputType: null,
      errorMessage: 'Subagent finished without a result',
    })
  })

  it('reports a non-Error rejection without throwing', () => {
    const outcome = buildSubagentOutcome({
      agentType: 'x',
      error: { code: 402 },
    })

    expect(outcome.status).toBe('failed')
    expect(outcome.errorMessage).toBe('{"code":402}')
  })

  it('never reports a failure without a reason', () => {
    const outcome = buildSubagentOutcome({
      agentType: 'x',
      error: new Error('boom'),
    })

    expect(outcome.status).toBe('failed')
    expect(outcome.errorMessage).toBe('boom')
  })
})
