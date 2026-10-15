// error-handling test family — error classifiers.
// Sibling of the Loop 350 decomposition (per-suite imports; no shared
// lifecycle — the unit under test is pure functions).
import { describe, test, expect } from 'bun:test'

import {
  isOutOfCreditsError,
  isFreeModeUnavailableError,
} from '../error-handling'

describe('error-handling', () => {
  describe('isOutOfCreditsError', () => {
    test('returns true for error with statusCode 402', () => {
      const error = { statusCode: 402, message: 'Payment required' }
      expect(isOutOfCreditsError(error)).toBe(true)
    })

    test('returns false for error with statusCode 401', () => {
      const error = { statusCode: 401, message: 'Unauthorized' }
      expect(isOutOfCreditsError(error)).toBe(false)
    })

    test('returns false for error with statusCode 403', () => {
      const error = { statusCode: 403, message: 'Forbidden' }
      expect(isOutOfCreditsError(error)).toBe(false)
    })

    test('returns false for error with statusCode 500', () => {
      const error = { statusCode: 500, message: 'Server error' }
      expect(isOutOfCreditsError(error)).toBe(false)
    })

    test('returns false for null error', () => {
      expect(isOutOfCreditsError(null)).toBe(false)
    })

    test('returns false for undefined error', () => {
      expect(isOutOfCreditsError(undefined)).toBe(false)
    })

    test('returns false for string error', () => {
      expect(isOutOfCreditsError('error string')).toBe(false)
    })

    test('returns false for Error object without statusCode', () => {
      const error = new Error('Plain error')
      expect(isOutOfCreditsError(error)).toBe(false)
    })

    test('returns false for error with non-402 numeric statusCode', () => {
      const error = { statusCode: 400, message: 'Bad request' }
      expect(isOutOfCreditsError(error)).toBe(false)
    })

    test('returns false for error with string statusCode', () => {
      const error = { statusCode: '402', message: 'Payment required' }
      expect(isOutOfCreditsError(error)).toBe(false)
    })

    test('returns true for 402 errors with additional properties', () => {
      const error = {
        statusCode: 402,
        message: 'Payment required',
        details: { credits: 0 },
        timestamp: new Date().toISOString(),
      }
      expect(isOutOfCreditsError(error)).toBe(true)
    })
  })

  describe('isFreeModeUnavailableError', () => {
    test('returns true for error with statusCode 403 and error free_mode_unavailable', () => {
      const error = {
        statusCode: 403,
        error: 'free_mode_unavailable',
        message: 'Free mode is not available in your country.',
      }
      expect(isFreeModeUnavailableError(error)).toBe(true)
    })

    test('returns true for responseBody free_mode_unavailable errors', () => {
      expect(
        isFreeModeUnavailableError({
          statusCode: 403,
          responseBody: JSON.stringify({
            error: 'free_mode_unavailable',
            message: 'SavantFree cannot be used from VPN traffic.',
          }),
        }),
      ).toBe(true)
    })

    test('returns false for 403 without error field', () => {
      const error = { statusCode: 403, message: 'Forbidden' }
      expect(isFreeModeUnavailableError(error)).toBe(false)
    })

    test('returns false for 403 with different error code', () => {
      const error = {
        statusCode: 403,
        error: 'account_suspended',
        message: 'Suspended',
      }
      expect(isFreeModeUnavailableError(error)).toBe(false)
    })

    test('returns false for non-403 status with free_mode_unavailable error', () => {
      const error = {
        statusCode: 400,
        error: 'free_mode_unavailable',
        message: 'Bad request',
      }
      expect(isFreeModeUnavailableError(error)).toBe(false)
    })

    test('returns false for null', () => {
      expect(isFreeModeUnavailableError(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isFreeModeUnavailableError(undefined)).toBe(false)
    })

    test('returns false for plain Error object', () => {
      expect(isFreeModeUnavailableError(new Error('Forbidden'))).toBe(false)
    })
  })
})
