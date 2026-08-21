/** FID-2026-0806-003 Phase 3 — compaction lifecycle tests. */
import { describe, expect, test } from 'bun:test'

import {
  assistantMessage,
  makeAgentState,
  userMessage,
} from './context-pruner-phase3-test-fixtures'

import type { JSONValue } from '../types/util-types'

describe('FID-2026-0814-001 — savant handleSteps compaction lifecycle', () => {
  async function driveSavant(
    contextTokenCount: number,
    opts: { lastPrunerCompletionAt?: number } = {},
  ): Promise<{
    spawned: boolean
    spawnParams: Record<string, JSONValue> | undefined
    agentState: ReturnType<typeof makeAgentState>
  }> {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = contextTokenCount
    agentState.maxContextLength = 250_000
    if (opts.lastPrunerCompletionAt !== undefined) {
      agentState.lastPrunerCompletionAt = opts.lastPrunerCompletionAt
    }

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let spawned = false
    let spawnParams: Record<string, JSONValue> | undefined
    let result = generator.next()
    while (!result.done) {
      const value = result.value
      if (
        value &&
        value !== 'STEP' &&
        value !== 'STEP_ALL' &&
        'toolName' in value
      ) {
        const call = value as {
          toolName: string
          input: {
            agent_type: string
            params?: Record<string, JSONValue>
          }
        }
        if (
          call.toolName === 'spawn_agent_inline' &&
          call.input.agent_type === 'context-pruner'
        ) {
          spawned = true
          spawnParams = call.input.params
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete: true,
        nResponses: [],
      })
    }
    return { spawned, spawnParams, agentState }
  }

  test('the proactive spawn sets a live `compacting` status', async () => {
    const { spawned, agentState } = await driveSavant(220_000)
    expect(spawned).toBe(true)
    expect(agentState.compactionStatus?.phase).toBe('compacting')
  })

  test('a recent pruner completion backs off the proactive spawn (cooldown)', async () => {
    const { spawned, agentState } = await driveSavant(220_000, {
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(false)
    expect(agentState.compactionStatus).toBeUndefined()
  })

  test('the force path still spawns during cooldown (hard-overflow safety)', async () => {
    const { spawned, spawnParams } = await driveSavant(240_000, {
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(true)
    expect(spawnParams?.force).toBe(true)
  })
})
