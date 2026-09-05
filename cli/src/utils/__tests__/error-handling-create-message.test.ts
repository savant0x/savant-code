// error-handling test family — message constants + createErrorMessage.
// Sibling of the Loop 350 decomposition.
import { describe, test, expect } from 'bun:test'

import { createErrorMessage, OUT_OF_CREDITS_MESSAGE } from '../error-handling'

describe('error-handling', () => {
  describe('OUT_OF_CREDITS_MESSAGE', () => {
    test('contains usage URL', () => {
      expect(OUT_OF_CREDITS_MESSAGE).toContain('/usage')
    })

    test('contains out of credits message', () => {
      expect(OUT_OF_CREDITS_MESSAGE.toLowerCase()).toContain('out of credits')
    })

    test('contains add credits instruction', () => {
      expect(OUT_OF_CREDITS_MESSAGE.toLowerCase()).toContain('add credits')
    })
  })

  describe('createErrorMessage', () => {
    test('creates message from Error object', () => {
      const error = new Error('Something went wrong')
      const result = createErrorMessage(error, 'msg-123')

      expect(result.id).toBe('msg-123')
      expect(result.content).toContain('Something went wrong')
      expect(result.content).toContain('**Error:**')
      expect(result.isComplete).toBe(true)
      expect(result.blocks).toBeUndefined()
    })

    test('creates message from string error', () => {
      const result = createErrorMessage('String error', 'msg-456')

      expect(result.id).toBe('msg-456')
      expect(result.content).toContain('String error')
    })

    test('creates message from object with message property', () => {
      const error = { message: 'Object error message', code: 'ERR_001' }
      const result = createErrorMessage(error, 'msg-789')

      expect(result.content).toContain('Object error message')
    })

    test('uses fallback for unknown error types', () => {
      const result = createErrorMessage(null, 'msg-null')

      expect(result.content).toContain('Unknown error occurred')
    })

    test('includes stack trace when available', () => {
      const error = new Error('Error with stack')
      const result = createErrorMessage(error, 'msg-stack')

      expect(result.content).toContain('Error with stack')
      // Stack trace should be included
      expect(result.content).toContain('at')
    })

    test('handles error without message property', () => {
      const error = { code: 'ERR_UNKNOWN' }
      const result = createErrorMessage(error, 'msg-no-msg')

      expect(result.content).toContain('Unknown error occurred')
    })

    test('handles error with empty message', () => {
      const error = { message: '' }
      const result = createErrorMessage(error, 'msg-empty')

      expect(result.content).toContain('Unknown error occurred')
    })

    test('handles error with numeric message', () => {
      const error = { message: 123 }
      const result = createErrorMessage(error, 'msg-num')

      expect(result.content).toContain('Unknown error occurred')
    })

    test('handles out of credits error', () => {
      const error = { statusCode: 402, message: 'Payment required' }
      const result = createErrorMessage(error, 'msg-402')

      expect(result.content).toContain('Payment required')
    })

    test('preserves message ID', () => {
      const error = new Error('Test')
      const result = createErrorMessage(error, 'unique-id-123')

      expect(result.id).toBe('unique-id-123')
    })

    test('marks message as complete', () => {
      const error = new Error('Test')
      const result = createErrorMessage(error, 'msg-complete')

      expect(result.isComplete).toBe(true)
    })

    test('clears blocks from error message', () => {
      const error = new Error('Test')
      const result = createErrorMessage(error, 'msg-blocks')

      expect(result.blocks).toBeUndefined()
    })

    test('handles deeply nested error objects', () => {
      const error = {
        message: 'Outer error',
        cause: {
          message: 'Inner error',
          cause: {
            message: 'Root cause',
          },
        },
      }
      const result = createErrorMessage(error, 'msg-nested')

      // Should only extract the top-level message
      expect(result.content).toContain('Outer error')
    })

    test('handles API error responses', () => {
      const apiError = {
        message: 'API request failed',
        statusCode: 500,
        response: { error: 'Internal server error' },
      }
      const result = createErrorMessage(apiError, 'msg-api')

      expect(result.content).toContain('API request failed')
    })

    test('handles network timeout errors', () => {
      const timeoutError = new Error('Request timeout')
      ;(timeoutError as any).code = 'ETIMEDOUT'
      const result = createErrorMessage(timeoutError, 'msg-timeout')

      expect(result.content).toContain('Request timeout')
    })

    test('handles auth errors', () => {
      const authError = {
        statusCode: 401,
        message: 'Invalid authentication token',
      }
      const result = createErrorMessage(authError, 'msg-auth')

      expect(result.content).toContain('Invalid authentication token')
    })
  })
})
