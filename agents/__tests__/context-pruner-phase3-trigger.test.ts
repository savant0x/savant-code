/** FID-2026-0806-003 Phase 3 — single-trigger authority tests. */
import { describe, expect, test } from 'bun:test'

import {
  assistantMessage,
  makeAgentState,
  userMessage,
} from './context-pruner-phase3-test-fixtures'

import type { JSONValue } from '../types/util-types'

describe('FID-2026-0814-011 — single trigger authority (autoCompactDue)', () => {
  async function driveSavantTrigger(opts: {
    contextTokenCount: number
    maxContextLength?: number
    autoCompactDue?: boolean
    lastPrunerCompletionAt?: number
    useSerializedRoundTrip?: boolean
  }): Promise<{
    spawned: boolean
    force: unknown
  }> {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    let handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    if (opts.useSerializedRoundTrip) {
      const source = (
        handleSteps as unknown as { toString(): string }
      ).toString()
      handleSteps = eval(`(${source})`) as typeof handleSteps
    }
    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = opts.contextTokenCount
    agentState.maxContextLength = opts.maxContextLength ?? 250_000
    if (opts.autoCompactDue !== undefined) {
      agentState.autoCompactDue = opts.autoCompactDue
    }
    if (opts.lastPrunerCompletionAt !== undefined) {
      agentState.lastPrunerCompletionAt = opts.lastPrunerCompletionAt
    }

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let spawned = false
    let force: unknown
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
          input: { agent_type: string; params?: Record<string, JSONValue> }
        }
        if (
          call.toolName === 'spawn_agent_inline' &&
          call.input.agent_type === 'context-pruner'
        ) {
          spawned = true
          force = call.input.params?.force
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete: true,
        nResponses: [],
      })
    }
    return { spawned, force }
  }

  test('autoCompactDue drives the spawn even below the 0.8 ratio threshold', async () => {
    const { spawned } = await driveSavantTrigger({
      contextTokenCount: 100_000,
      autoCompactDue: true,
    })
    expect(spawned).toBe(true)
  })

  test('a recent pruner completion still backs off the autoCompactDue spawn (cooldown)', async () => {
    const { spawned } = await driveSavantTrigger({
      contextTokenCount: 100_000,
      autoCompactDue: true,
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(false)
  })

  test('force path fires with autoCompactDue during cooldown (hard-overflow safety)', async () => {
    const { spawned, force } = await driveSavantTrigger({
      contextTokenCount: 240_000,
      autoCompactDue: true,
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(true)
    expect(force).toBe(true)
  })

  test('serialized round-trip (toString → eval) preserves the single-trigger authority', async () => {
    const { spawned } = await driveSavantTrigger({
      contextTokenCount: 100_000,
      autoCompactDue: true,
      useSerializedRoundTrip: true,
    })
    expect(spawned).toBe(true)
  })

  test('generated source carries the fail-loud guard and never silently adopts the baked default', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    const source = (handleSteps as unknown as { toString(): string }).toString()
    expect(source).toContain('resolvedMaxContextLength')
    expect(source).toContain('autoCompactDue')
    expect(source).toContain("'savant handleSteps: maxContextLength unresolved")
    expect(source).not.toContain(
      'agentState.maxContextLength ?? asNumber(p.maxContextLength) ??',
    )
  })
})
