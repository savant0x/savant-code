// error-handling test family — free-mode rate-limit message extraction.
// Sibling of the Loop 350 decomposition.
import { describe, test, expect } from 'bun:test'

import {
  getSavantFreeRateLimitErrorMessage,
  SAVANT_FREE_RATE_LIMIT_MESSAGE,
} from '../error-handling'

describe('error-handling', () => {
  describe('getSavantFreeRateLimitErrorMessage', () => {
    test('returns the generic message for untyped 429 errors', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          statusCode: 429,
          message: 'Too Many Requests',
        }),
      ).toBe(SAVANT_FREE_RATE_LIMIT_MESSAGE)
    })

    test('returns the generic message for thrown API errors with status 429', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          status: 429,
          message: 'Too Many Requests',
        }),
      ).toBe(SAVANT_FREE_RATE_LIMIT_MESSAGE)
    })

    test('returns the generic message for retry-wrapped untyped 429 errors', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          message: 'Failed after 4 attempts. Last error: Too Many Requests',
          lastError: {
            statusCode: 429,
            message: 'Too Many Requests',
          },
        }),
      ).toBe(SAVANT_FREE_RATE_LIMIT_MESSAGE)
    })

    test('returns null for non-429 status codes', () => {
      expect(getSavantFreeRateLimitErrorMessage({ statusCode: 402 })).toBe(null)
      expect(getSavantFreeRateLimitErrorMessage({ statusCode: 500 })).toBe(null)
    })

    test('returns null for string statusCode', () => {
      expect(getSavantFreeRateLimitErrorMessage({ statusCode: '429' })).toBe(
        null,
      )
    })

    test('preserves normalized free mode quota messages', () => {
      const message =
        'Free mode rate limit exceeded (1 minute limit). Try again in 30 seconds.'

      expect(
        getSavantFreeRateLimitErrorMessage({
          statusCode: 429,
          error: 'free_mode_rate_limited',
          message,
        }),
      ).toBe(message)
    })

    test('preserves responseBody free mode quota messages', () => {
      const message =
        'Free mode rate limit exceeded (1 minute limit). Try again in 30 seconds.'

      expect(
        getSavantFreeRateLimitErrorMessage({
          statusCode: 429,
          message: 'Too Many Requests',
          responseBody: JSON.stringify({
            error: 'free_mode_rate_limited',
            message,
          }),
        }),
      ).toBe(message)
    })

    test('preserves retry-wrapped free mode quota messages', () => {
      const message =
        'Free mode rate limit exceeded (1 minute limit). Try again in 30 seconds.'

      expect(
        getSavantFreeRateLimitErrorMessage({
          message: 'Failed after 4 attempts. Last error: Too Many Requests',
          lastError: {
            statusCode: 429,
            message: 'Too Many Requests',
            responseBody: JSON.stringify({
              error: 'free_mode_rate_limited',
              message,
            }),
          },
        }),
      ).toBe(message)
    })

    test('falls back to the generic message when typed quota errors have no message', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          statusCode: 429,
          error: 'free_mode_rate_limited',
        }),
      ).toBe(SAVANT_FREE_RATE_LIMIT_MESSAGE)
    })

    test('appends detail from agent-run output objects for untyped 429s', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          type: 'error',
          statusCode: 429,
          message: 'Model is at capacity. Please try again later.',
        }),
      ).toBe(
        `${SAVANT_FREE_RATE_LIMIT_MESSAGE} (Model is at capacity. Please try again later.)`,
      )
    })

    test('appends detail from OpenAI-style nested provider error bodies', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          statusCode: 429,
          message: 'Too Many Requests',
          responseBody: JSON.stringify({
            error: {
              message: 'Model is at capacity. Please try again later.',
              code: null,
              type: 'rate_limit_error',
            },
          }),
        }),
      ).toBe(
        `${SAVANT_FREE_RATE_LIMIT_MESSAGE} (Model is at capacity. Please try again later.)`,
      )
    })

    test('does not echo bare HTTP status text from output objects', () => {
      expect(
        getSavantFreeRateLimitErrorMessage({
          type: 'error',
          statusCode: 429,
          message: 'Too Many Requests',
        }),
      ).toBe(SAVANT_FREE_RATE_LIMIT_MESSAGE)
    })
  })

  describe('SAVANT_FREE_RATE_LIMIT_MESSAGE', () => {
    test('encourages retry without mentioning credits or payment', () => {
      const message = SAVANT_FREE_RATE_LIMIT_MESSAGE.toLowerCase()
      expect(message).toContain('try again')
      expect(message).not.toContain('credit')
      expect(message).not.toContain('pay')
    })
  })
})
