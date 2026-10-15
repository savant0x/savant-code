// error-handling test family — end-to-end error scenarios.
// Sibling of the Loop 350 decomposition.
import { describe, test, expect } from 'bun:test'

import { createErrorMessage, isOutOfCreditsError } from '../error-handling'

describe('error-handling', () => {
  describe('error scenarios', () => {
    test('handles rate limit error (429)', () => {
      const rateLimitError = {
        statusCode: 429,
        message: 'Too many requests',
        retryAfter: 60,
      }

      expect(isOutOfCreditsError(rateLimitError)).toBe(false)

      const result = createErrorMessage(rateLimitError, 'msg-rate')
      expect(result.content).toContain('Too many requests')
    })

    test('handles server error (500)', () => {
      const serverError = {
        statusCode: 500,
        message: 'Internal server error',
      }

      expect(isOutOfCreditsError(serverError)).toBe(false)

      const result = createErrorMessage(serverError, 'msg-500')
      expect(result.content).toContain('Internal server error')
    })

    test('handles validation error (400)', () => {
      const validationError = {
        statusCode: 400,
        message: 'Invalid request parameters',
        errors: [{ field: 'prompt', message: 'Required' }],
      }

      expect(isOutOfCreditsError(validationError)).toBe(false)

      const result = createErrorMessage(validationError, 'msg-400')
      expect(result.content).toContain('Invalid request parameters')
    })

    test('handles forbidden error (403)', () => {
      const forbiddenError = {
        statusCode: 403,
        message: 'Access denied',
      }

      expect(isOutOfCreditsError(forbiddenError)).toBe(false)

      const result = createErrorMessage(forbiddenError, 'msg-403')
      expect(result.content).toContain('Access denied')
    })

    test('handles not found error (404)', () => {
      const notFoundError = {
        statusCode: 404,
        message: 'Resource not found',
      }

      expect(isOutOfCreditsError(notFoundError)).toBe(false)

      const result = createErrorMessage(notFoundError, 'msg-404')
      expect(result.content).toContain('Resource not found')
    })

    test('handles conflict error (409)', () => {
      const conflictError = {
        statusCode: 409,
        message: 'Conflict detected',
      }

      expect(isOutOfCreditsError(conflictError)).toBe(false)

      const result = createErrorMessage(conflictError, 'msg-409')
      expect(result.content).toContain('Conflict detected')
    })
  })
})
