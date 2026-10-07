/** FID-2026-1007-007: a local breaker never refuses a user model attempt. */
import { expect, test } from 'bun:test'

import { runWithClassifiedRetry } from '../provider-boundary/classified-stream-retry'
import { ProviderCircuitBreaker } from '../provider-boundary/provider-circuit-breaker'
import { DEFAULT_RETRY_POLICY } from '../provider-boundary/retry-policy'

function openBreaker(): ProviderCircuitBreaker {
  const breaker = new ProviderCircuitBreaker()
  for (let attempt = 0; attempt < 3; attempt++) {
    breaker.recordOutcome({
      class: 'transient',
      reason: 'server',
      retryable: true,
    })
  }
  expect(breaker.getState()).toBe('open')
  return breaker
}

test('an open breaker admits the next user attempt and success resets it', async () => {
  const breaker = openBreaker()
  let calls = 0
  const chunks: string[] = []
  for await (const chunk of runWithClassifiedRetry({
    policy: DEFAULT_RETRY_POLICY,
    breaker,
    create: async function* () {
      calls++
      yield 'ok'
      return 'done'
    },
  })) {
    chunks.push(chunk)
  }
  expect(chunks).toEqual(['ok'])
  expect(calls).toBe(1)
  expect(breaker.getState()).toBe('closed')
})

test('an open breaker reports the upstream failure without a local lockout', async () => {
  const breaker = openBreaker()
  let calls = 0
  await expect(
    (async () => {
      for await (const chunk of runWithClassifiedRetry({
        policy: DEFAULT_RETRY_POLICY,
        breaker,
        create: async function* () {
          calls++
          throw { status: 429 }
        },
      })) {
        throw new Error(`unexpected chunk: ${String(chunk)}`)
      }
    })(),
  ).rejects.toMatchObject({
    name: 'ClassifiedProviderError',
    verdict: { class: 'transient', reason: 'rate-limit' },
  })
  expect(calls).toBe(1)
  expect(breaker.getState()).toBe('open')
})
