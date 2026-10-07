/**
 * FID-2026-1005-006 — exhaustive classification table (converged design:
 * "exhaustive table tests over the error surface, including the 'unknown
 * stays conservative' rule"). Declared gate for this FID.
 */
import { describe, expect, test } from 'bun:test'

import {
  ClassifiedProviderError,
  ProviderBoundaryBlockedError,
  classifyFailure,
  logUnknownShapeOnce,
} from '../provider-boundary/failure-class'

import type { FailureVerdict } from '../provider-boundary/failure-class'

const TABLE: Array<[string, unknown, FailureVerdict]> = [
  [
    'TimeoutError',
    Object.assign(new Error('t'), { name: 'TimeoutError' }),
    { class: 'transient', reason: 'timeout', retryable: true },
  ],
  [
    'ETIMEDOUT code',
    Object.assign(new Error('t'), { code: 'ETIMEDOUT' }),
    { class: 'transient', reason: 'timeout', retryable: true },
  ],
  [
    'timeout wording',
    new Error('request TIMED OUT upstream'),
    { class: 'transient', reason: 'timeout', retryable: true },
  ],
  [
    'HTTP 429',
    { status: 429 },
    { class: 'transient', reason: 'rate-limit', retryable: true },
  ],
  [
    'HTTP 408',
    { statusCode: 408 },
    { class: 'transient', reason: 'timeout', retryable: true },
  ],
  [
    'HTTP 500',
    { status: 500 },
    { class: 'transient', reason: 'server', retryable: true },
  ],
  [
    'HTTP 503',
    { status: 503 },
    { class: 'transient', reason: 'server', retryable: true },
  ],
  [
    'nested response.status 502',
    { response: { status: 502 } },
    { class: 'transient', reason: 'server', retryable: true },
  ],
  [
    'ECONNRESET',
    Object.assign(new Error('r'), { code: 'ECONNRESET' }),
    { class: 'transient', reason: 'network', retryable: true },
  ],
  [
    'ENOTFOUND',
    Object.assign(new Error('n'), { code: 'ENOTFOUND' }),
    { class: 'transient', reason: 'network', retryable: true },
  ],
  [
    'HTTP 401',
    { status: 401 },
    { class: 'administrative', reason: 'auth', retryable: false },
  ],
  [
    'HTTP 403',
    { status: 403 },
    { class: 'administrative', reason: 'permission', retryable: false },
  ],
  [
    'HTTP 400',
    { status: 400 },
    { class: 'administrative', reason: 'invalid-request', retryable: false },
  ],
  [
    'HTTP 422',
    { status: 422 },
    { class: 'administrative', reason: 'invalid-request', retryable: false },
  ],
  [
    'HTTP 404 (model)',
    { status: 404 },
    { class: 'administrative', reason: 'model-unavailable', retryable: false },
  ],
  [
    'AbortError (user cancel)',
    Object.assign(new Error('a'), { name: 'AbortError' }),
    { class: 'unknown', reason: 'unrecognized', retryable: false },
  ],
  [
    'plain error',
    new Error('boom'),
    { class: 'unknown', reason: 'unrecognized', retryable: false },
  ],
  [
    'empty object',
    {},
    { class: 'unknown', reason: 'unrecognized', retryable: false },
  ],
  [
    'null',
    null,
    { class: 'unknown', reason: 'unrecognized', retryable: false },
  ],
  [
    'string',
    'weird',
    { class: 'unknown', reason: 'unrecognized', retryable: false },
  ],
]

describe('failure classification (FID-2026-1005-006)', () => {
  for (const [label, input, expected] of TABLE) {
    test(`classifies ${label}`, () => {
      expect(classifyFailure(input)).toEqual(expected)
    })
  }

  test('retryable is a pure function of the class (never of raw strings)', () => {
    for (const [, input, expected] of TABLE) {
      const verdict = classifyFailure(input)
      expect(verdict.retryable).toBe(expected.class === 'transient')
    }
  })

  test('unknown stays conservative: never retryable', () => {
    for (const input of [null, undefined, 42, 'x', {}, new Error('x')]) {
      const verdict = classifyFailure(input)
      if (verdict.class === 'unknown') expect(verdict.retryable).toBe(false)
    }
  })

  test('ClassifiedProviderError carries the verdict and cause', () => {
    const cause = { status: 401 }
    const error = new ClassifiedProviderError(classifyFailure(cause), cause)
    expect(error.verdict).toEqual({
      class: 'administrative',
      reason: 'auth',
      retryable: false,
    })
    expect(error.cause).toBe(cause)
    expect(error.name).toBe('ClassifiedProviderError')
  })

  test('ProviderBoundaryBlockedError is a gate refusal, not a verdict', () => {
    const error = new ProviderBoundaryBlockedError('breaker open — 30min')
    expect(error.name).toBe('ProviderBoundaryBlockedError')
    expect(error.message).toContain('breaker open')
  })

  test('logUnknownShapeOnce is bounded: one log per distinct shape', () => {
    const messages: string[] = []
    const seen = new Set<string>()
    const log = (m: string) => messages.push(m)
    expect(logUnknownShapeOnce(log, new Error('secret-one'), seen)).toBe(true)
    expect(logUnknownShapeOnce(log, new Error('secret-two'), seen)).toBe(false)
    expect(logUnknownShapeOnce(log, { detail: 'secret-three' }, seen)).toBe(
      true,
    )
    expect(messages).toHaveLength(2)
    expect(messages[0]).toContain('taxonomy growth')
    expect(messages.join(' ')).not.toContain('secret')
  })
})
