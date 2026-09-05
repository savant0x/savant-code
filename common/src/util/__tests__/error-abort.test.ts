import { describe, expect, it } from 'bun:test'

import { ABORT_ERROR_MESSAGE, AbortError, isAbortError } from '../error'

describe('AbortError class', () => {
  describe('constructor', () => {
    it('creates error without reason', () => {
      const error = new AbortError()
      expect(error.message).toBe(ABORT_ERROR_MESSAGE)
      expect(error.name).toBe('AbortError')
    })

    it('creates error with reason', () => {
      const error = new AbortError('User cancelled')
      expect(error.message).toBe(`${ABORT_ERROR_MESSAGE}: User cancelled`)
      expect(error.name).toBe('AbortError')
    })

    it('creates error with empty string reason', () => {
      const error = new AbortError('')
      // Empty string is falsy, so no reason appended
      expect(error.message).toBe(ABORT_ERROR_MESSAGE)
    })

    it('is instanceof Error', () => {
      const error = new AbortError()
      expect(error instanceof Error).toBe(true)
      expect(error instanceof AbortError).toBe(true)
    })

    it('has stack trace', () => {
      const error = new AbortError('test')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('AbortError')
    })
  })

  describe('message format', () => {
    it('reason is appended after colon and space', () => {
      const error = new AbortError('timeout')
      expect(error.message).toBe('Request aborted: timeout')
    })

    it('preserves special characters in reason', () => {
      const error = new AbortError('User pressed Ctrl+C')
      expect(error.message).toBe('Request aborted: User pressed Ctrl+C')
    })

    it('handles multi-line reason', () => {
      const error = new AbortError('First line\nSecond line')
      expect(error.message).toBe('Request aborted: First line\nSecond line')
    })
  })
})

describe('ABORT_ERROR_MESSAGE constant', () => {
  it('has expected value', () => {
    expect(ABORT_ERROR_MESSAGE).toBe('Request aborted')
  })

  it('is used by AbortError class', () => {
    const error = new AbortError()
    expect(error.message).toBe(ABORT_ERROR_MESSAGE)
  })

  it('is detected by isAbortError', () => {
    const error = new Error(ABORT_ERROR_MESSAGE)
    expect(isAbortError(error)).toBe(true)
  })
})
