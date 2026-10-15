/**
 * FID-2026-1005-007 — recovery-path tests with scripted upstream fakes
 * (dependency injection, no module mocking). Declared gate.
 */
import { describe, expect, test } from 'bun:test'

import { runWithClassifiedRetry } from '../provider-boundary/classified-stream-retry'
import { resolveRetryPolicy } from '../provider-boundary/retry-policy'
import { StreamCutError, accumulateChunk } from '../stream-recovery/outcome'
import { runTurnWithRecovery } from '../stream-recovery/recovery-executor'
import {
  RECOVERY_CHECKPOINT_CAP_CHARS,
  planRecovery,
} from '../stream-recovery/recovery-plan'

import type { TurnAccumulation } from '../stream-recovery/outcome'
import type {
  RecoveryAccountingRecord,
  RecoveryRequest,
} from '../stream-recovery/recovery-executor'

type Chunk = { type?: string; text?: string; toolCallId?: string }

function reasoningThenCut(text: string): AsyncGenerator<Chunk, string> {
  return (async function* () {
    yield { type: 'reasoning', text }
    return 'original-result'
  })()
}

function answerStream(text: string): AsyncGenerator<Chunk, string> {
  return (async function* () {
    yield { type: 'text', text }
    return 'recovered-result'
  })()
}

const observe = (turn: TurnAccumulation, chunk: Chunk) =>
  accumulateChunk(turn, chunk)
const closeKindOf = (): 'thrown' => 'thrown'
const GOOD_BUDGET = { elapsedMs: 10, remainingTokenBudget: 4096 }

function run(params: {
  create: () => AsyncGenerator<Chunk, string>
  createRecovery?: (request: RecoveryRequest) => AsyncGenerator<Chunk, string>
  budget?: { elapsedMs: number; remainingTokenBudget: number }
}) {
  const accounting: RecoveryAccountingRecord[] = []
  const requests: RecoveryRequest[] = []
  const chunks: Chunk[] = []
  return {
    accounting,
    requests,
    chunks,
    drain: async () => {
      const gen = runTurnWithRecovery({
        logicalTurnId: 'turn-1',
        originalInput: 'solve it',
        create: params.create,
        createRecovery: (request) => {
          requests.push(request)
          return params.createRecovery
            ? params.createRecovery(request)
            : (async function* () {
                return 'no-recovery-expected'
              })()
        },
        observeChunk: observe,
        closeKindOf,
        onAccounting: (record) => accounting.push(record),
        budget: params.budget ?? GOOD_BUDGET,
      })
      let next = await gen.next()
      while (!next.done) {
        chunks.push(next.value)
        next = await gen.next()
      }
      return next.value as string
    },
  }
}

describe('FID-2026-1011-006 iterator ownership', () => {
  test('return closes the nested retry source without starting recovery', async () => {
    let finalized = 0
    let recoveries = 0
    const source = async function* (): AsyncGenerator<Chunk, string> {
      try {
        yield { type: 'reasoning', text: 'thought' }
        return 'end'
      } finally {
        finalized++
      }
    }
    const wrapper = runTurnWithRecovery({
      logicalTurnId: 'x',
      originalInput: 'x',
      create: () =>
        runWithClassifiedRetry({
          create: source,
          policy: resolveRetryPolicy(undefined),
        }),
      createRecovery: () => {
        recoveries++
        return answerStream('no')
      },
      observeChunk: observe,
      closeKindOf,
      onAccounting: () => {},
      budget: GOOD_BUDGET,
    })
    await wrapper.next()
    await wrapper.return('cancelled')
    expect(finalized).toBe(1)
    expect(recoveries).toBe(0)
  })

  test('return closes the recovery leg', async () => {
    let finalized = false
    const wrapper = runTurnWithRecovery({
      logicalTurnId: 'x',
      originalInput: 'x',
      create: () => reasoningThenCut('thought'),
      createRecovery: () =>
        (async function* () {
          try {
            yield { type: 'text', text: 'answer' }
            return 'end'
          } finally {
            finalized = true
          }
        })(),
      observeChunk: observe,
      closeKindOf,
      onAccounting: () => {},
      budget: GOOD_BUDGET,
    })
    await wrapper.next()
    await wrapper.next()
    await wrapper.return('cancelled')
    expect(finalized).toBe(true)
  })
})

describe('bounded stream recovery (FID-2026-1005-007)', () => {
  test('one bounded recovery per turn; its answer becomes the turn result', async () => {
    const harness = run({
      create: () => reasoningThenCut('deep thought'),
      createRecovery: () => answerStream('the answer'),
    })
    expect(await harness.drain()).toBe('recovered-result')
    expect(harness.requests).toHaveLength(1)
    expect(harness.requests[0]?.physicalRequestIndex).toBe(2)
    // No replay: the live reasoning passed through once, then the recovery
    // leg's answer — the checkpoint is never re-emitted.
    expect(harness.chunks).toEqual([
      { type: 'reasoning', text: 'deep thought' },
      { type: 'text', text: 'the answer' },
    ])
  })

  test('tools are structurally disabled on the recovery request', async () => {
    const harness = run({
      create: () => reasoningThenCut('thought'),
      createRecovery: () => answerStream('answer'),
    })
    await harness.drain()
    expect(harness.requests[0]?.tools).toEqual({})
    expect(harness.requests[0]?.prompt).toContain('do not repeat it')
  })

  test('a second truncation during recovery is terminal (no third request)', async () => {
    const harness = run({
      create: () => reasoningThenCut('thought'),
      createRecovery: () =>
        (async function* () {
          yield { type: 'reasoning', text: 'more thought' }
          return 'never-used'
        })(),
    })
    await expect(harness.drain()).rejects.toBeInstanceOf(StreamCutError)
    expect(harness.requests).toHaveLength(1) // hard 2-request cap
  })

  test('below minimum token headroom the recovery is skipped', async () => {
    const harness = run({
      create: () => reasoningThenCut('thought'),
      createRecovery: () => answerStream('answer'),
      budget: { elapsedMs: 10, remainingTokenBudget: 511 },
    })
    await expect(harness.drain()).rejects.toBeInstanceOf(StreamCutError)
    expect(harness.requests).toHaveLength(0)
  })

  test('a classified retry that spent the second physical request prevents recovery', async () => {
    let recoveryCalls = 0
    const accounting: RecoveryAccountingRecord[] = []
    const stream = runTurnWithRecovery({
      logicalTurnId: 'retry-then-cut',
      originalInput: 'solve it',
      create: () => reasoningThenCut('thought'),
      createRecovery: () => {
        recoveryCalls += 1
        return answerStream('must not run')
      },
      observeChunk: observe,
      closeKindOf,
      onAccounting: (record) => accounting.push(record),
      budget: GOOD_BUDGET,
      canRecover: () => false,
      physicalRequestCount: () => 2,
    })
    await expect(
      (async () => {
        for await (const _chunk of stream) void _chunk
      })(),
    ).rejects.toBeInstanceOf(StreamCutError)
    expect(recoveryCalls).toBe(0)
    expect(accounting[0]?.physicalRequestIndex).toBe(2)
  })

  test('an upstream error is propagated when recovery is ineligible', async () => {
    const upstream = new Error('upstream failed')
    const stream = runTurnWithRecovery({
      logicalTurnId: 'failed-turn',
      originalInput: 'solve it',
      create: () =>
        (async function* () {
          throw upstream
        })(),
      createRecovery: () => answerStream('must not run'),
      observeChunk: observe,
      closeKindOf: () => 'error',
      onAccounting: () => {},
      budget: GOOD_BUDGET,
    })
    await expect(stream.next()).rejects.toBe(upstream)
  })

  test('no wall-clock budget remains → skipped', () => {
    const plan = planRecovery('r', {
      elapsedMs: 480_000,
      remainingTokenBudget: 4096,
    })
    expect(plan.go).toBe(false)
    expect(plan.skipReason).toContain('wall-clock')
  })

  test('checkpoint cap is enforced tail-first (the conclusion end survives)', () => {
    const checkpoint =
      'HEAD-' + 'a'.repeat(RECOVERY_CHECKPOINT_CAP_CHARS) + '-TAIL'
    const plan = planRecovery(checkpoint, GOOD_BUDGET)
    expect(plan.go).toBe(true)
    expect(plan.checkpoint).toHaveLength(RECOVERY_CHECKPOINT_CAP_CHARS)
    expect(plan.checkpoint.endsWith('-TAIL')).toBe(true)
    expect(plan.checkpoint.startsWith('HEAD-')).toBe(false)
  })

  test('accounting records the physical/logical split per turn', async () => {
    const recovered = run({
      create: () => reasoningThenCut('thought'),
      createRecovery: () => answerStream('answer'),
    })
    await recovered.drain()
    expect(
      recovered.accounting.map((r) => [
        r.logicalTurnId,
        r.physicalRequestIndex,
        r.recovered,
      ]),
    ).toEqual([['turn-1', 2, true]])

    const plain = run({ create: () => answerStream('direct') })
    expect(await plain.drain()).toBe('recovered-result')
    expect(
      plain.accounting.map((r) => [
        r.logicalTurnId,
        r.physicalRequestIndex,
        r.recovered,
      ]),
    ).toEqual([['turn-1', 1, false]])
  })
})
