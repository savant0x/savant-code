/**
 * FID-2026-1101-001 — the classified boundary reports retry attempts and the
 * delay it schedules, and never reports a retry after a partial emission.
 * Dependency injection only: the sleep function is supplied, no timers run.
 */
import { describe, expect, test } from 'bun:test'

import { runWithClassifiedRetry } from '../provider-boundary/classified-stream-retry'
import { resolveRetryPolicy } from '../provider-boundary/retry-policy'

import type { StreamRetryObservation } from '../provider-boundary/classified-stream-retry'

type Chunk = { type: 'text'; text: string }

function transientFailure(): Error {
  return Object.assign(new Error('reset'), { code: 'ECONNRESET' })
}

async function drain(generator: AsyncGenerator<Chunk, string>) {
  const chunks: Chunk[] = []
  let next = await generator.next()

  while (!next.done) {
    chunks.push(next.value)
    next = await generator.next()
  }

  return { chunks, result: next.value }
}

describe('classified retry telemetry', () => {
  test('reports the scheduled delay and attempt before sleeping', async () => {
    const observations: StreamRetryObservation[] = []
    let calls = 0
    const create = () => {
      calls += 1
      return (async function* (): AsyncGenerator<Chunk, string> {
        if (calls === 1) throw transientFailure()
        yield { type: 'text', text: 'ok' }
        return 'done'
      })()
    }

    const generator = runWithClassifiedRetry<Chunk, string>({
      policy: { ...resolveRetryPolicy(undefined), baseDelayMs: 5, maxDelayMs: 5 },
      create,
      sleep: async () => {},
      onRetry: (observation) => observations.push(observation),
    })

    const { chunks, result } = await drain(generator)

    expect(result).toBe('done')
    expect(chunks).toEqual([{ type: 'text', text: 'ok' }])
    expect(calls).toBe(2)
    expect(observations).toEqual([
      { attempt: 1, nextAttempt: 2, delayMs: 5, totalWaitMs: 5 },
    ])
  })

  test('never retries or reports a retry after a partial emission', async () => {
    const observations: StreamRetryObservation[] = []
    let calls = 0
    const create = () => {
      calls += 1
      return (async function* (): AsyncGenerator<Chunk, string> {
        yield { type: 'text', text: 'partial' }
        throw transientFailure()
      })()
    }

    const generator = runWithClassifiedRetry<Chunk, string>({
      policy: resolveRetryPolicy(undefined),
      create,
      sleep: async () => {},
      onRetry: (observation) => observations.push(observation),
    })

    await expect(drain(generator)).rejects.toThrow()
    expect(calls).toBe(1)
    expect(observations).toEqual([])
  })
})
