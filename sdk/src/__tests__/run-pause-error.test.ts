import { describe, expect, test } from 'bun:test'

import { isRunPauseError } from '../run/types'

describe('isRunPauseError (FID-2026-0813-023)', () => {
  test('returns true for a SavantCodeRunPausedError-named error', () => {
    const error = new Error('paused')
    error.name = 'SavantCodeRunPausedError'
    expect(isRunPauseError(error)).toBe(true)
  })

  test('returns false for a plain Error', () => {
    expect(isRunPauseError(new Error('boom'))).toBe(false)
  })

  test('returns false for non-object values', () => {
    expect(isRunPauseError(undefined)).toBe(false)
    expect(isRunPauseError(null)).toBe(false)
    expect(isRunPauseError('string')).toBe(false)
    expect(isRunPauseError(42)).toBe(false)
  })

  test('only the name contract identifies a pause error', () => {
    // Regression: the corrupted rebrand-marker boolean branch was removed.
    // A non-matching name, with or without extra fields, must never match.
    expect(isRunPauseError({ name: 'OtherError' })).toBe(false)
    expect(isRunPauseError({ message: 'paused' })).toBe(false)
  })
})
