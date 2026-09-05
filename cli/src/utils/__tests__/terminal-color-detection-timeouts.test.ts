// FID-2026-0819-005 Loop 279: the withTimeout, terminalSupportsOSC, and
// timeout-constants suites moved verbatim from
// terminal-color-detection.test.ts (renamed -parsing in this split);
// env reset harness (beforeEach/afterEach) copied verbatim.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  terminalSupportsOSC,
  withTimeout,
  getGlobalOscTimeout,
  getQueryOscTimeout,
} from '../terminal-color-detection'

// ============================================================================
// withTimeout Tests
// ============================================================================

describe('withTimeout', () => {
  test('returns promise result if it resolves before timeout', async () => {
    const fastPromise = Promise.resolve('success')
    const result = await withTimeout(fastPromise, 1000, 'timeout')
    expect(result).toBe('success')
  })

  test('returns timeout value if promise takes too long', async () => {
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 500)
    })
    const result = await withTimeout(slowPromise, 50, 'timeout')
    expect(result).toBe('timeout')
  })

  test('returns null timeout value', async () => {
    const slowPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => resolve('late'), 500)
    })
    const result = await withTimeout(slowPromise, 50, null)
    expect(result).toBeNull()
  })

  test('clears timeout after promise resolves', async () => {
    const fastPromise = Promise.resolve('success')
    // This should not cause any issues with dangling timeouts
    await withTimeout(fastPromise, 10000, 'timeout')
    // If the timeout wasn't cleared, this test would hang
  })

  test('handles rejected promises', async () => {
    const failingPromise = Promise.reject(new Error('test error'))
    await expect(withTimeout(failingPromise, 1000, 'timeout')).rejects.toThrow(
      'test error',
    )
  })

  test('handles immediate resolution', async () => {
    const result = await withTimeout(Promise.resolve(42), 0, -1)
    // Promise.resolve is always faster than setTimeout(0)
    expect(result).toBe(42)
  })
})

// ============================================================================
// terminalSupportsOSC Tests
// ============================================================================

describe('terminalSupportsOSC', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env to original values
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns true for iTerm.app', () => {
    process.env.TERM_PROGRAM = 'iTerm.app'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for Apple_Terminal', () => {
    process.env.TERM_PROGRAM = 'Apple_Terminal'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for vscode', () => {
    process.env.TERM_PROGRAM = 'vscode'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for kitty via TERM', () => {
    process.env.TERM_PROGRAM = ''
    process.env.TERM = 'xterm-kitty'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for xterm-256color', () => {
    process.env.TERM_PROGRAM = ''
    process.env.TERM = 'xterm-256color'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for alacritty via TERM', () => {
    process.env.TERM_PROGRAM = ''
    process.env.TERM = 'alacritty'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for WezTerm', () => {
    process.env.TERM_PROGRAM = 'WezTerm'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for Ghostty', () => {
    process.env.TERM_PROGRAM = 'Ghostty'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('checks for partial match in TERM_PROGRAM', () => {
    process.env.TERM_PROGRAM = 'something-vscode-something'
    expect(terminalSupportsOSC()).toBe(true)
  })
})

// ============================================================================
// Timeout Constants Tests
// ============================================================================

describe('timeout constants', () => {
  test('global timeout is reasonable', () => {
    const timeout = getGlobalOscTimeout()
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(5000) // Should be at most 5 seconds
  })

  test('query timeout is less than global timeout', () => {
    const queryTimeout = getQueryOscTimeout()
    const globalTimeout = getGlobalOscTimeout()
    expect(queryTimeout).toBeLessThan(globalTimeout)
  })

  test('query timeout is reasonable', () => {
    const timeout = getQueryOscTimeout()
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(2000) // Should be at most 2 seconds
  })
})
