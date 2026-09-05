import { describe, expect, it } from 'bun:test'

import { ABORT_ERROR_MESSAGE, AbortError, isAbortError } from '../error'

describe('isAbortError edge cases', () => {
  describe('message matching with startsWith', () => {
    it('returns true for exact ABORT_ERROR_MESSAGE', () => {
      const error = new Error(ABORT_ERROR_MESSAGE)
      expect(isAbortError(error)).toBe(true)
    })

    it('returns true for message with suffix after ABORT_ERROR_MESSAGE (like AbortError with reason)', () => {
      // This is the format AbortError uses: 'Request aborted: reason'
      const error = new Error(`${ABORT_ERROR_MESSAGE}: timeout`)
      expect(isAbortError(error)).toBe(true)
    })

    it('returns false for message with non-colon suffix after ABORT_ERROR_MESSAGE', () => {
      // Only 'Request aborted' or 'Request aborted: <reason>' should match
      // Other patterns like 'Request aborted by user' should NOT match
      const error = new Error(`${ABORT_ERROR_MESSAGE} due to user action`)
      expect(isAbortError(error)).toBe(false)
    })

    it('returns false for message containing ABORT_ERROR_MESSAGE as substring (not prefix)', () => {
      const error = new Error(`Error: ${ABORT_ERROR_MESSAGE} by system`)
      expect(isAbortError(error)).toBe(false)
    })

    it('returns false for message with prefix before ABORT_ERROR_MESSAGE', () => {
      const error = new Error(`Something failed: ${ABORT_ERROR_MESSAGE}`)
      expect(isAbortError(error)).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    it('returns false for lowercase version of message', () => {
      const error = new Error('request aborted')
      expect(isAbortError(error)).toBe(false)
    })

    it('returns false for uppercase version of message', () => {
      const error = new Error('REQUEST ABORTED')
      expect(isAbortError(error)).toBe(false)
    })

    it('returns false for mixed case version of message', () => {
      const error = new Error('Request Aborted')
      expect(isAbortError(error)).toBe(false)
    })
  })

  describe('AbortError name detection', () => {
    it('returns true for Error with name set to AbortError', () => {
      const error = new Error('Some other message')
      error.name = 'AbortError'
      expect(isAbortError(error)).toBe(true)
    })

    it('returns false for name containing AbortError as substring', () => {
      const error = new Error('test')
      error.name = 'MyAbortErrorClass'
      expect(isAbortError(error)).toBe(false)
    })

    it('returns false for lowercase aborterror name', () => {
      const error = new Error('test')
      error.name = 'aborterror'
      expect(isAbortError(error)).toBe(false)
    })
  })

  describe('DOMException handling', () => {
    it('returns true for DOMException with name AbortError', () => {
      const error = new DOMException('The operation was aborted', 'AbortError')
      expect(isAbortError(error)).toBe(true)
    })

    it('returns true for DOMException with signal abort message', () => {
      const error = new DOMException(
        'signal is aborted without reason',
        'AbortError',
      )
      expect(isAbortError(error)).toBe(true)
    })

    it('returns false for DOMException with different name', () => {
      const error = new DOMException('test', 'NotFoundError')
      expect(isAbortError(error)).toBe(false)
    })
  })

  describe('Error subclasses', () => {
    it('returns true for AbortError instance', () => {
      const error = new AbortError('test reason')
      expect(isAbortError(error)).toBe(true)
    })

    it('returns true for TypeError with AbortError name', () => {
      const error = new TypeError('test')
      error.name = 'AbortError'
      expect(isAbortError(error)).toBe(true)
    })

    it('returns false for custom error class without AbortError characteristics', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }
      // Note: Using a message that's similar but NOT exact match to ABORT_ERROR_MESSAGE
      const error = new CustomError('Request was aborted by user')
      expect(isAbortError(error)).toBe(false)
    })

    it('returns true for custom error class with AbortError name', () => {
      class MyAbortError extends Error {
        constructor() {
          super('custom message')
          this.name = 'AbortError'
        }
      }
      const error = new MyAbortError()
      expect(isAbortError(error)).toBe(true)
    })
  })

  describe('non-Error types', () => {
    it('returns false for string', () => {
      expect(isAbortError(ABORT_ERROR_MESSAGE)).toBe(false)
    })

    it('returns false for object with message property', () => {
      expect(isAbortError({ message: ABORT_ERROR_MESSAGE })).toBe(false)
    })

    it('returns false for object with name property', () => {
      expect(isAbortError({ name: 'AbortError' })).toBe(false)
    })

    it('returns false for null', () => {
      expect(isAbortError(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isAbortError(undefined)).toBe(false)
    })

    it('returns false for number', () => {
      expect(isAbortError(42)).toBe(false)
    })

    it('returns false for array', () => {
      expect(isAbortError([ABORT_ERROR_MESSAGE])).toBe(false)
    })

    it('returns false for function', () => {
      expect(isAbortError(() => ABORT_ERROR_MESSAGE)).toBe(false)
    })
  })
})
