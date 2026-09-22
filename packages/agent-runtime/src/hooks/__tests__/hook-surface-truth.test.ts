import { join } from 'node:path'

import {
  classifyHookEvent,
  FIRED_HOOK_EVENTS,
  HOOK_EVENTS,
  NEVER_FIRED_HOOK_EVENTS,
} from '@savant-code/common/types/hooks'
import { assistantMessage } from '@savant-code/common/util/messages'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { firedEventsFromSource } from '../../../../../scripts/hook-events-check'
import {
  mockFileContext,
  setupMainPromptTest,
} from '../../__tests__/main-prompt-harness'
import { mainPrompt } from '../../main-prompt'
import * as goalDriver from '../../run-agent-step/goal-driver'
import { createHookGate } from '../../tools/tool-executor/hook-gate'
import { HookEngine } from '../engine'
import { buildSessionOutcome } from '../run-outcome'

import type { HookInputData } from '../types'

/**
 * FID-2026-0919-030 — the hook surface tells the truth.
 *
 * Three pins, one per finding of the audit:
 *
 * 1. **Event delivery** — the vocabulary (`HOOK_EVENTS`) and the wiring are one
 *    enforced thing: the census reads the runtime source and must agree with
 *    `FIRED_HOOK_EVENTS` / `NEVER_FIRED_HOOK_EVENTS` in both directions, so an
 *    event can never be advertised without a firing site.
 * 2. **`PreToolUse` identity** — the only blocking event now names the acting
 *    agent, which is what makes the EHEL rule it composes with expressible.
 * 3. **Session outcome** — `SessionEnd` reports completion or failure the same
 *    way `SubagentStop` does (FID-2026-0919-029), with `SessionStart` staying
 *    outcome-free.
 *
 * The census helper is IMPORTED from the probe rather than reimplemented: one
 * authority, so a test can never quietly disagree with the shipped check.
 */

const repoRoot = join(import.meta.dir, '..', '..', '..', '..', '..')

function captureHookFires(): HookInputData[] {
  const fired: HookInputData[] = []
  spyOn(HookEngine.prototype, 'triggerBlock').mockImplementation(
    (input: HookInputData) => {
      fired.push(input)
      return Promise.resolve({ blocked: false, reasons: [], runs: [] })
    },
  )
  spyOn(HookEngine.prototype, 'fireAndForgetTrigger').mockImplementation(
    (input: HookInputData) => {
      fired.push(input)
    },
  )
  return fired
}

afterEach(() => {
  mock.restore()
})

describe('hook event delivery (FID-2026-0919-030)', () => {
  it('the source fires exactly the events classified as fired', () => {
    const fromSource = firedEventsFromSource(repoRoot)
    const firedInSource = [...fromSource.keys()].sort()
    const declaredFired = [...FIRED_HOOK_EVENTS].sort()

    // Bidirectional: a new site for an inert event OR a fired event that lost its
    // site fails here, so the classification cannot drift from the wiring.
    expect(firedInSource).toEqual(declaredFired)
  })

  it('every inert event has no firing site and a stated reason', () => {
    const fromSource = firedEventsFromSource(repoRoot)

    // FID-2026-0919-031 wired the last five events, so this record is empty and
    // the old "the record is non-empty" assertion was retired WITH them: an
    // empty record is now the stronger claim (every declared event is
    // delivered). The rule the loop encodes is unchanged — an event placed here
    // must have no reachable site and a blocker worth stating.
    for (const [event, reason] of Object.entries(NEVER_FIRED_HOOK_EVENTS) as [
      string,
      string,
    ][]) {
      expect(fromSource.has(event)).toBe(false)
      expect(classifyHookEvent(event)).toBe('never-fired')
      expect(reason.length).toBeGreaterThan(60)
    }
    expect(Object.keys(NEVER_FIRED_HOOK_EVENTS)).toHaveLength(0)
  })

  it('classifies every event in the vocabulary', () => {
    for (const event of HOOK_EVENTS) {
      expect(classifyHookEvent(event)).not.toBe('unknown')
    }
    expect(classifyHookEvent('UserPromptSubmit')).toBe('unknown')
  })
})

describe('PreToolUse names the acting agent (FID-2026-0919-030)', () => {
  async function payloadFor(agentType: string): Promise<HookInputData> {
    const fired = captureHookFires()
    const gate = createHookGate({
      logger: { debug: () => {}, warn: () => {}, error: () => {} } as never,
      onResponseChunk: () => {},
      hookProjectRoot: () => mockFileContext.projectRoot,
    })
    await gate({
      params: {
        agentState: { runId: 'run-1', agentId: 'agent-1', agentType },
        agentTemplate: { id: agentType },
      },
      toolCall: { toolName: 'write_file', input: { path: '/x.ts' } },
    } as never)

    const input = fired.find((i) => i.hook_event_name === 'PreToolUse')
    if (!input) throw new Error('PreToolUse did not fire')
    return input
  }

  it('reports the main agent', async () => {
    const input = await payloadFor('savant')
    expect(input.tool_name).toBe('write_file')
    expect(input.subagent_type).toBe('savant')
  })

  it('reports a subagent, which is the identity a policy needs', async () => {
    const input = await payloadFor('scout')
    expect(input.subagent_type).toBe('scout')
    // The session id is the CHILD's run — it identifies the child, not the
    // agent; without subagent_type a policy cannot tell which agent is acting.
    expect(input.session_id).toBe('run-1')
  })

  it('every PreToolUse site in the runtime passes the identity (no new bypass)', async () => {
    // A census rather than a fixture, so a THIRD PreToolUse site cannot be added
    // without the identity that makes the event's own contract expressible — a
    // gate that cannot name the actor is a gate an operator cannot configure.
    const source = firedEventsFromSource(repoRoot)
    expect(source.get('PreToolUse')?.length).toBeGreaterThanOrEqual(2)

    const { readFileSync } = await import('node:fs')
    for (const relative of source.get('PreToolUse') ?? []) {
      const text = readFileSync(join(repoRoot, relative), 'utf8')
      for (const match of text.matchAll(/event: 'PreToolUse'/g)) {
        // The call's own text: from the event literal to the close of the
        // `buildHookInput({ … })` call that contains it.
        const rest = text.slice(match.index)
        const end = rest.indexOf('})')
        const call = end === -1 ? rest : rest.slice(0, end)
        expect(call).toContain('subagentType')
      }
    }
  })
})

describe('session outcome (FID-2026-0919-030)', () => {
  function stopInput(fired: HookInputData[]): HookInputData | undefined {
    return fired.find((i) => i.hook_event_name === 'SessionEnd')
  }

  async function runOnce(
    loop: () => Promise<{ agentState: never; output: never }>,
  ): Promise<{ fired: HookInputData[]; thrown: unknown }> {
    const fired = captureHookFires()
    spyOn(goalDriver, 'driveGoalTurns').mockImplementation(loop as never)
    const { mainPromptBaseParams, mockLocalAgentTemplates } =
      setupMainPromptTest()
    const { getInitialSessionState } =
      await import('@savant-code/common/types/session-state')
    const sessionState = getInitialSessionState(mockFileContext)
    let thrown: unknown
    try {
      await mainPrompt({
        ...mainPromptBaseParams,
        action: {
          type: 'prompt' as const,
          prompt: 'test',
          sessionState,
          fingerprintId: 'test',
          promptId: 'test',
          toolResults: [],
        },
        localAgentTemplates: mockLocalAgentTemplates,
      })
    } catch (error) {
      thrown = error
    }
    return { fired, thrown }
  }

  it('reports a completed session, with SessionStart outcome-free', async () => {
    const { fired } = await runOnce(async () => {
      const { getInitialSessionState } =
        await import('@savant-code/common/types/session-state')
      const agentState = getInitialSessionState(mockFileContext).mainAgentState
      agentState.runId = 'session-run-1'
      agentState.creditsUsed = 7
      return {
        agentState: agentState as never,
        output: {
          type: 'lastMessage',
          value: [assistantMessage('done')],
        } as never,
      }
    })

    const stop = stopInput(fired)
    expect(stop?.tool_result).toEqual({
      status: 'completed',
      runId: 'session-run-1',
      creditsUsed: 7,
      outputType: 'lastMessage',
    })
    expect(stop?.error_message).toBeUndefined()

    const start = fired.find((i) => i.hook_event_name === 'SessionStart')
    expect(start?.tool_result).toBeUndefined()
    expect(start?.error_message).toBeUndefined()
  })

  it('reports an error-form run as failed', async () => {
    const { fired } = await runOnce(async () => {
      const { getInitialSessionState } =
        await import('@savant-code/common/types/session-state')
      const agentState = getInitialSessionState(mockFileContext).mainAgentState
      return {
        agentState: agentState as never,
        output: { type: 'error', message: 'provider down' } as never,
      }
    })

    const stop = stopInput(fired)
    expect(stop?.tool_result).toMatchObject({ status: 'failed' })
    expect(stop?.error_message).toBe('provider down')
  })

  it('reports a thrown run with the cause, and still rejects', async () => {
    const { fired, thrown } = await runOnce(async () => {
      throw new Error('session exploded')
    })

    const stop = stopInput(fired)
    expect(stop?.tool_result).toMatchObject({
      status: 'failed',
      outputType: null,
    })
    expect(stop?.error_message).toBe('session exploded')
    // The hook reports the failure; the caller still sees it.
    expect((thrown as Error)?.message).toBe('session exploded')
  })

  it('treats an unknown run as failed rather than successful', () => {
    const outcome = buildSessionOutcome({})
    expect(outcome.status).toBe('failed')
    expect(outcome.errorMessage).toBe('Session finished without a result')
    expect(outcome.runId).toBeNull()
  })
})
