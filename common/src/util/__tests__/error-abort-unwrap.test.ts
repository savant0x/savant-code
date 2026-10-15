import { describe, expect, it } from 'bun:test'

import {
  AbortError,
  isAbortError,
  promptAborted,
  promptSuccess,
  unwrapPromptResult,
} from '../error'

describe('unwrapPromptResult with AbortError', () => {
  describe('successful results', () => {
    it('returns value for successful result', () => {
      const result = promptSuccess('test value')
      expect(unwrapPromptResult(result)).toBe('test value')
    })

    it('returns null for successful null result', () => {
      const result = promptSuccess(null)
      expect(unwrapPromptResult(result)).toBeNull()
    })

    it('returns undefined for successful undefined result', () => {
      const result = promptSuccess(undefined)
      expect(unwrapPromptResult(result)).toBeUndefined()
    })

    it('returns complex object for successful result', () => {
      const value = { nested: { array: [1, 2, 3] } }
      const result = promptSuccess(value)
      expect(unwrapPromptResult(result)).toEqual(value)
    })
  })

  describe('aborted results throw AbortError', () => {
    it('throws AbortError instance', () => {
      const result = promptAborted()
      try {
        unwrapPromptResult(result)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof AbortError).toBe(true)
      }
    })

    it('thrown error has name AbortError', () => {
      const result = promptAborted()
      try {
        unwrapPromptResult(result)
        expect(true).toBe(false)
      } catch (error) {
        expect((error as Error).name).toBe('AbortError')
      }
    })

    it('thrown error includes reason in message', () => {
      const result = promptAborted('User cancelled')
      try {
        unwrapPromptResult(result)
        expect(true).toBe(false)
      } catch (error) {
        expect((error as Error).message).toBe('Request aborted: User cancelled')
      }
    })

    it('thrown error is detectable with isAbortError', () => {
      const result = promptAborted()
      try {
        unwrapPromptResult(result)
        expect(true).toBe(false)
      } catch (error) {
        expect(isAbortError(error)).toBe(true)
      }
    })

    it('thrown error with reason is detectable with isAbortError', () => {
      const result = promptAborted('timeout')
      try {
        unwrapPromptResult(result)
        expect(true).toBe(false)
      } catch (error) {
        expect(isAbortError(error)).toBe(true)
      }
    })
  })
})
