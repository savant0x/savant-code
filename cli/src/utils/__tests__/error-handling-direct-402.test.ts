import { describe, expect, test } from 'bun:test'

import {
  isOutOfCreditsError,
  providerOutOfCreditsError,
} from '../error-handling'

/**
 * FID-2026-0929-002 — direct-provider 402 honesty pins.
 *
 * A 402 from a direct provider is the provider's account state. The selector
 * must quote the provider's payload, name the provider, and point at /health —
 * never the backend-branded "add credits at savant-code.com/usage" line, and
 * never a claim about *our* credits.
 */

const err402 = (message: string) =>
  Object.assign(new Error(message), { statusCode: 402 })

describe('providerOutOfCreditsError (FID-2026-0929-002)', () => {
  test('quotes the provider body message and names the provider', () => {
    const text = providerOutOfCreditsError(
      err402('Insufficient balance: 0.04 credits needed'),
      'apinex',
    )
    expect(text).toContain('APInex')
    expect(text).toContain('402 Payment Required')
    expect(text).toContain('Insufficient balance: 0.04 credits needed')
    expect(text).toContain('/health')
    expect(text).toContain('/provider')
  })

  test('falls back to the neutral generic when the body is useless', () => {
    const text = providerOutOfCreditsError(err402('Payment required'), 'apinex')
    expect(text).toContain('APInex')
    expect(text).toContain('402 Payment Required')
    expect(text).toContain('/health')
    expect(text).not.toContain('Payment required Payment required')
  })

  test('falls back again when the body carries no message at all', () => {
    const text = providerOutOfCreditsError(
      Object.assign(new Error(''), { statusCode: 402 }),
      'apinex',
    )
    expect(text).toContain('APInex')
    expect(text).toContain('/health')
  })

  test('uses a neutral subject when the provider id is unknown', () => {
    const text = providerOutOfCreditsError(err402('Out of credits'), undefined)
    expect(text).toContain('The provider')
    expect(text).not.toContain('undefined')
  })

  test('never emits backend billing language', () => {
    for (const body of [
      'Insufficient balance',
      'Payment required',
      'credit insufficient balance',
    ]) {
      const text = providerOutOfCreditsError(err402(body), 'apinex')
      expect(text).not.toContain('savant-code.com')
      expect(text).not.toContain('add credits')
    }
  })
})

describe('isOutOfCreditsError stays a pure 402 predicate (FID-2026-0929-002)', () => {
  // Mode-awareness lives at the consumer (run-results), not in the predicate —
  // environment-dependent guards are a known defect class (LEARNINGS 2026-08-23).
  test('402 is true regardless of mode', () => {
    expect(isOutOfCreditsError(err402('anything'))).toBe(true)
  })

  test('non-402 errors are false', () => {
    expect(
      isOutOfCreditsError(Object.assign(new Error('x'), { statusCode: 429 })),
    ).toBe(false)
    expect(isOutOfCreditsError(new Error('x'))).toBe(false)
    expect(isOutOfCreditsError(null)).toBe(false)
  })
})
