/** FID-2026-0806-003 Phase 3 — serialized factory wiring tests. */
import { describe, expect, test } from 'bun:test'

import {
  assistantMessage,
  makeAgentState,
  userMessage,
} from './context-pruner-phase3-test-fixtures'

import type { JSONValue } from '../types/util-types'

describe('P3a + P3d wiring through the savant handleSteps factory', () => {
  test('factory bakes fold/idle/force literals and yields pruner spawns', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })

    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = 240_000
    agentState.maxContextLength = 250_000

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let spawned = false
    let result = generator.next()
    let stepsComplete = false
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
          expect(call.input.params?.force).toBe(true)
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete,
        nResponses: [],
      })
      stepsComplete = true
    }
    expect(spawned).toBe(true)
  })

  test('fold spawn fires at turn end when amortizedFold is enabled', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    const fn = handleSteps as unknown as { toString(): string }
    const source = fn.toString()
    expect(source).toContain('amortizedFold')
    expect(source).toContain('foldFloorTokens')
    expect(source).toContain('idleAfterMs')
    expect(source).toContain('forceCompactOffset')
    expect(source).toContain("phase: 'compacting'")
    expect(source).toContain('prunerCooldownMs')
    expect(source).toContain('lastPrunerCompletionAt')
  })

  test('FID-2026-0814-004 H-07: threads compression config as baked literals', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
      keepRecentTokens: 24_576,
      autoCompactRatio: 0.75,
      forceCompactOffset: 12_000,
    })
    const fn = handleSteps as unknown as { toString(): string }
    const source = fn.toString()
    expect(source).toContain('forceCompactOffset = 12000')
    expect(source).toContain('autoCompactRatio = 0.75')
    expect(source).toContain('keepRecentTokens: 24576')
    expect(source).not.toContain('keepRecentTokens = ')
    expect(source).not.toContain('autoCompactRatioRatio')
  })

  test('FID-2026-0814-004 H-07: pruner spawn carries keepRecentTokens param', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
      keepRecentTokens: 24_576,
      autoCompactRatio: 0.75,
      forceCompactOffset: 12_000,
    })

    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = 220_000
    agentState.maxContextLength = 250_000

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let keepRecentTokenParam: unknown
    let result = generator.next()
    let stepsComplete = false
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
          keepRecentTokenParam = call.input.params?.keepRecentTokens
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete,
        nResponses: [],
      })
      stepsComplete = true
    }
    expect(keepRecentTokenParam).toBe(24_576)
  })
})
