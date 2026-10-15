/**
 * FID-2026-1005-006 — breaker FSM, retry-policy shape validation (the
 * measured nested-`backoff` NaN defect), and the classified stream-retry
 * boundary (zero-emission retries only; 429 at most once). Declared gate.
 */
import { describe, expect, test } from 'bun:test'

import { runWithClassifiedRetry } from '../provider-boundary/classified-stream-retry'
import { ClassifiedProviderError } from '../provider-boundary/failure-class'
import {
  PROVIDER_BREAKER_COOLDOWN_BASE_MS,
  PROVIDER_BREAKER_COOLDOWN_MAX_MS,
  ProviderCircuitBreaker,
} from '../provider-boundary/provider-circuit-breaker'
import {
  DEFAULT_RETRY_POLICY,
  resolveRetryPolicy,
  retryDelayMs,
  validateRetryPolicy,
} from '../provider-boundary/retry-policy'

import type { FailureVerdict } from '../provider-boundary/failure-class'

const TRANSIENT: FailureVerdict = {
  class: 'transient',
  reason: 'server',
  retryable: true,
}
const ADMIN: FailureVerdict = {
  class: 'administrative',
  reason: 'auth',
  retryable: false,
}
const UNKNOWN: FailureVerdict = {
  class: 'unknown',
  reason: 'unrecognized',
  retryable: false,
}

function makeBreaker() {
  let now = 1_000_000
  const breaker = new ProviderCircuitBreaker(() => now)
  return { breaker, advance: (ms: number) => (now += ms) }
}

function failingStream(
  error: unknown,
  emitted: string[] = [],
): AsyncGenerator<string, string> {
  return (async function* () {
    for (const chunk of emitted) yield chunk
    throw error
  })()
}

function okStream(value: string): AsyncGenerator<string, string> {
  return (async function* () {
    return value
  })()
}

async function drain(gen: AsyncGenerator<string, string>): Promise<string> {
  // Manual iteration preserves the generator's RETURN value (for-await
  // discards it).
  let next = await gen.next()
  while (!next.done) next = await gen.next()
  return next.value as string
}

describe('provider circuit breaker (FID-2026-1005-006)', () => {
  test('trips open after 3 consecutive transient failures', () => {
    const { breaker } = makeBreaker()
    breaker.recordOutcome(TRANSIENT)
    breaker.recordOutcome(TRANSIENT)
    expect(breaker.getState()).toBe('closed')
    breaker.recordOutcome(TRANSIENT)
    expect(breaker.getState()).toBe('open')
    expect(breaker.checkCooldown().allowed).toBe(false)
  })

  test('administrative/unknown outcomes neither trip nor reset', () => {
    const { breaker } = makeBreaker()
    breaker.recordOutcome(TRANSIENT)
    breaker.recordOutcome(TRANSIENT)
    breaker.recordOutcome(ADMIN)
    breaker.recordOutcome(UNKNOWN)
    expect(breaker.getState()).toBe('closed') // neutral
    breaker.recordOutcome(TRANSIENT) // third counted transient
    expect(breaker.getState()).toBe('open') // admin did not reset the counter
  })

  test('half_open admits exactly one bounded probe; success closes', () => {
    const { breaker, advance } = makeBreaker()
    for (let i = 0; i < 3; i++) breaker.recordOutcome(TRANSIENT)
    advance(PROVIDER_BREAKER_COOLDOWN_BASE_MS)
    expect(breaker.checkCooldown()).toEqual({ allowed: true }) // the probe
    expect(breaker.checkCooldown().allowed).toBe(false) // second is blocked
    breaker.recordSuccess()
    expect(breaker.getState()).toBe('closed')
    expect(breaker.checkCooldown().allowed).toBe(true)
  })

  test('probe failure reopens with exponential cooldown, capped at 120min', () => {
    const { breaker, advance } = makeBreaker()
    for (let i = 0; i < 3; i++) breaker.recordOutcome(TRANSIENT)
    let expected = PROVIDER_BREAKER_COOLDOWN_BASE_MS
    for (const round of [60, 120, 120]) {
      advance(expected)
      expect(breaker.checkCooldown().allowed).toBe(true) // probe
      breaker.recordOutcome(TRANSIENT) // probe failed
      expected = round * 60_000
      expect(breaker.checkCooldown().allowed).toBe(false) // escalated reopen
      advance(expected - 60_000) // jump to just before next window end
    }
    expect(expected).toBe(PROVIDER_BREAKER_COOLDOWN_MAX_MS)
  })

  test('manual forceProbe is never throttled (it IS the probe)', () => {
    const { breaker } = makeBreaker()
    for (let i = 0; i < 3; i++) breaker.recordOutcome(TRANSIENT)
    // Open with the full cooldown remaining — forceProbe admits anyway.
    breaker.forceProbe()
    expect(breaker.getState()).toBe('half_open')
    expect(breaker.checkCooldown().allowed).toBe(true)
    expect(breaker.checkCooldown().allowed).toBe(false)
    breaker.recordSuccess()
    expect(breaker.getState()).toBe('closed')
  })
})

describe('retry-policy shape validation (FID-2026-1005-006)', () => {
  test('the measured nested-backoff defect fails at load, naming the path', () => {
    const malformed = {
      maxAttempts: 3,
      retryableClasses: ['transient'],
      backoff: { baseDelayMs: 500, maxDelayMs: 5000 },
    }
    expect(() => validateRetryPolicy(malformed)).toThrow(/retryPolicy\.backoff/)
  })

  test('non-finite or inverted timing values fail at load', () => {
    expect(() =>
      validateRetryPolicy({ ...DEFAULT_RETRY_POLICY, baseDelayMs: NaN }),
    ).toThrow(/baseDelayMs/)
    expect(() =>
      validateRetryPolicy({ ...DEFAULT_RETRY_POLICY, maxDelayMs: 10 }),
    ).toThrow(/maxDelayMs/)
    expect(() =>
      validateRetryPolicy({ ...DEFAULT_RETRY_POLICY, maxAttempts: 0 }),
    ).toThrow(/maxAttempts/)
  })

  test('flat valid policy passes; every producible delay is finite', () => {
    const policy = resolveRetryPolicy({
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 900,
      retryableClasses: ['transient'],
    })
    for (let attempt = 1; attempt <= 10; attempt++) {
      const delay = retryDelayMs(attempt, policy)
      expect(Number.isFinite(delay)).toBe(true)
      expect(delay).toBeLessThanOrEqual(policy.maxDelayMs)
    }
  })

  test('undefined resolves to the default (one bounded in-turn retry)', () => {
    expect(resolveRetryPolicy(undefined)).toEqual(DEFAULT_RETRY_POLICY)
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(2)
  })
})

describe('classified stream-retry boundary (FID-2026-1005-006)', () => {
  const sleeps: number[] = []
  const sleep = async (ms: number) => void sleeps.push(ms)

  test('zero-emission transient failure retries once then succeeds', async () => {
    sleeps.length = 0
    let calls = 0
    const result = await drain(
      runWithClassifiedRetry({
        policy: DEFAULT_RETRY_POLICY,
        sleep,
        create: () =>
          calls++ === 0 ? failingStream({ status: 503 }) : okStream('done'),
      }),
    )
    expect(result).toBe('done')
    expect(calls).toBe(2)
    expect(sleeps).toHaveLength(1)
  })

  test('administrative failure surfaces immediately with its verdict', async () => {
    let calls = 0
    const run = drain(
      runWithClassifiedRetry({
        policy: DEFAULT_RETRY_POLICY,
        sleep,
        create: () => {
          calls++
          return failingStream({ status: 401 })
        },
      }),
    )
    await expect(run).rejects.toBeInstanceOf(ClassifiedProviderError)
    expect(calls).toBe(1)
  })

  test('a synchronous stream-construction failure is classified too', async () => {
    let calls = 0
    const result = await drain(
      runWithClassifiedRetry({
        policy: DEFAULT_RETRY_POLICY,
        sleep,
        create: () => {
          calls++
          if (calls === 1) throw { status: 503 }
          return okStream('constructed')
        },
      }),
    )
    expect(result).toBe('constructed')
    expect(calls).toBe(2)
  })

  test('a partially-emitted stream is never re-issued (no duplication)', async () => {
    let calls = 0
    const chunks: string[] = []
    const gen = runWithClassifiedRetry({
      policy: DEFAULT_RETRY_POLICY,
      sleep,
      create: () => {
        calls++
        return failingStream({ status: 503 }, ['partial-answer'])
      },
    })
    await expect(
      (async () => {
        for await (const chunk of gen) chunks.push(chunk)
      })(),
    ).rejects.toBeInstanceOf(ClassifiedProviderError)
    expect(chunks).toEqual(['partial-answer'])
    expect(calls).toBe(1)
  })

  test('429 is retried at most once even with a larger policy', async () => {
    let calls = 0
    const wide = validateRetryPolicy({
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 2,
      retryableClasses: ['transient'],
    })
    await expect(
      drain(
        runWithClassifiedRetry({
          policy: wide,
          sleep,
          create: () => {
            calls++
            return failingStream({ status: 429 })
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ClassifiedProviderError)
    expect(calls).toBe(2) // initial + one retry, then surfaced
  })

  test('unknown shapes are logged once per distinct shape', async () => {
    const logged: string[] = []
    for (const error of [
      new Error('odd-a'),
      new Error('odd-b'),
      { detail: 'odd-c' },
    ]) {
      await expect(
        drain(
          runWithClassifiedRetry({
            policy: DEFAULT_RETRY_POLICY,
            sleep,
            onUnknownShape: (m) => logged.push(m),
            create: () => failingStream(error),
          }),
        ),
      ).rejects.toBeInstanceOf(ClassifiedProviderError)
    }
    expect(logged).toHaveLength(2)
  })
})
