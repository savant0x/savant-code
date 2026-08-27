import { describe, expect, test } from 'bun:test'

import { reconcileTokenCount } from '../run-agent-step/reconcile-token-count'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Logger spy for the FID-2026-0821-003-A decision line. */
function makeSpyLogger(): {
  logger: Logger
  debugCalls: Array<{ data: Record<string, unknown>; msg: string }>
} {
  const debugCalls: Array<{ data: Record<string, unknown>; msg: string }> = []
  const logger: Logger = {
    debug: (data, msg) => {
      debugCalls.push({ data: data as Record<string, unknown>, msg: msg ?? '' })
    },
    info: () => {},
    warn: () => {},
    error: () => {},
  }
  return { logger, debugCalls }
}

function stateWith(overrides: Partial<AgentState>): AgentState {
  return {
    agentId: 'test',
    agentType: null,
    agentContext: {},
    ancestorRunIds: [],
    subagents: [],
    childRunIds: [],
    messageHistory: [],
    stepsRemaining: 10,
    creditsUsed: 0,
    directCreditsUsed: 0,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: 0,
    ...overrides,
  }
}

describe('reconcileTokenCount (FID-2026-0821-001 P2-1)', () => {
  test('no usage on record: the local estimate stands (pre-first-response)', () => {
    const state = stateWith({})
    expect(
      reconcileTokenCount({ agentState: state, localEstimate: 12_000 }),
    ).toBe(12_000)
  })

  test('fresh provider usage overrides the estimator (BYOK truth)', () => {
    const state = stateWith({
      lastProviderUsage: { inputTokens: 91_000, capturedAt: 1_000 },
    })
    expect(
      reconcileTokenCount({ agentState: state, localEstimate: 120_000 }),
    ).toBe(91_000)
  })

  test('usage older than the last prune loses to the local recount', () => {
    const state = stateWith({
      lastProviderUsage: { inputTokens: 91_000, capturedAt: 1_000 },
      lastPrunerCompletionAt: 2_000,
    })
    expect(
      reconcileTokenCount({ agentState: state, localEstimate: 30_000 }),
    ).toBe(30_000)
  })

  test('usage at the exact compaction instant is stale (<= compare)', () => {
    const state = stateWith({
      lastProviderUsage: { inputTokens: 91_000, capturedAt: 2_000 },
      lastPrunerCompletionAt: 2_000,
    })
    expect(
      reconcileTokenCount({ agentState: state, localEstimate: 30_000 }),
    ).toBe(30_000)
  })

  test('FID-2026-0821-003-A: logs the decision with inputs when a logger is passed', () => {
    const { logger, debugCalls } = makeSpyLogger()
    const state = stateWith({
      lastProviderUsage: { inputTokens: 91_000, capturedAt: 2_000 },
      lastPrunerCompletionAt: 1_000,
    })
    reconcileTokenCount({
      agentState: state,
      localEstimate: 120_000,
      logger,
    })
    expect(debugCalls.length).toBe(1)
    expect(debugCalls[0]?.msg).toBe(
      'reconcileTokenCount: context token source decision',
    )
    expect(debugCalls[0]?.data).toMatchObject({
      choseProviderUsage: true,
      usageCapturedAt: 2_000,
      lastPrunerCompletionAt: 1_000,
      localEstimate: 120_000,
      result: 91_000,
      deltaFromEstimate: -29_000,
    })
  })

  test('FID-2026-0821-003-A: logs choseProviderUsage=false when usage is stale', () => {
    const { logger, debugCalls } = makeSpyLogger()
    const state = stateWith({
      lastProviderUsage: { inputTokens: 91_000, capturedAt: 1_000 },
      lastPrunerCompletionAt: 2_000,
    })
    const result = reconcileTokenCount({
      agentState: state,
      localEstimate: 30_000,
      logger,
    })
    expect(result).toBe(30_000)
    expect(debugCalls[0]?.data).toMatchObject({
      choseProviderUsage: false,
      result: 30_000,
    })
  })

  test('FID-2026-0821-003-A: a throwing logger never breaks the reconcile', () => {
    const throwingLogger: Logger = {
      debug: () => {
        throw new Error('logger exploded')
      },
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const state = stateWith({
      lastProviderUsage: { inputTokens: 91_000, capturedAt: 2_000 },
    })
    expect(
      reconcileTokenCount({
        agentState: state,
        localEstimate: 120_000,
        logger: throwingLogger,
      }),
    ).toBe(91_000)
  })
})
