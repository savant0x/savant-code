import { describe, expect, test } from 'bun:test'

import type { StreamStatus } from '../../use-message-queue'

// Ensure required env vars exist so logger/env parsing succeeds in tests
const ensureEnv = () => {
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT =
    process.env.NEXT_PUBLIC_CB_ENVIRONMENT || 'test'
  process.env.NEXT_PUBLIC_SAVANT_CODE_APP_URL =
    process.env.NEXT_PUBLIC_SAVANT_CODE_APP_URL ||
    'https://app.savant-code.test'
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@savant-code.test'
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY =
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_test_key'
  process.env.NEXT_PUBLIC_POSTHOG_HOST_URL =
    process.env.NEXT_PUBLIC_POSTHOG_HOST_URL ||
    'https://posthog.savant-code.test'
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
  process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL =
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL ||
    'https://stripe.savant-code.test'
  process.env.NEXT_PUBLIC_WEB_PORT = process.env.NEXT_PUBLIC_WEB_PORT || '3000'
}

ensureEnv()

const { finalizeQueueState, resetEarlyReturnState } =
  await import('../send-message')

describe('finalizeQueueState', () => {
  test('sets stream status to idle and resets queue state', () => {
    let _streamStatus = 'streaming' as StreamStatus
    let _canProcessQueue = false
    let _chainInProgress = true
    const isProcessingQueueRef = { current: true }

    finalizeQueueState({
      setStreamStatus: (status) => {
        _streamStatus = status
      },
      setCanProcessQueue: (can) => {
        _canProcessQueue = can
      },
      updateChainInProgress: (value) => {
        _chainInProgress = value
      },
      isProcessingQueueRef,
    })

    expect(_streamStatus).toBe('idle')
    expect(_canProcessQueue).toBe(true)
    expect(_chainInProgress).toBe(false)
    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('calls resumeQueue instead of setCanProcessQueue when provided', () => {
    let _streamStatus = 'streaming' as StreamStatus
    let _canProcessQueueCalled = false
    let resumeQueueCalled = false
    let _chainInProgress = true

    finalizeQueueState({
      setStreamStatus: (status) => {
        _streamStatus = status
      },
      setCanProcessQueue: () => {
        _canProcessQueueCalled = true
      },
      updateChainInProgress: (value) => {
        _chainInProgress = value
      },
      resumeQueue: () => {
        resumeQueueCalled = true
      },
    })

    expect(_streamStatus).toBe('idle')
    expect(resumeQueueCalled).toBe(true)
    expect(_canProcessQueueCalled).toBe(false)
    expect(_chainInProgress).toBe(false)
  })

  test('respects isQueuePausedRef when no resumeQueue provided', () => {
    let _canProcessQueue = true
    const isQueuePausedRef = { current: true }

    finalizeQueueState({
      setStreamStatus: () => {},
      setCanProcessQueue: (can) => {
        _canProcessQueue = can
      },
      updateChainInProgress: () => {},
      isQueuePausedRef,
    })

    // When queue was paused before streaming, _canProcessQueue should be false
    expect(_canProcessQueue).toBe(false)
  })
})

/**
 * Tests for early return queue state reset in sendMessage.
 * These test the resetEarlyReturnState helper used across multiple early return paths:
 * - prepareUserMessage exception
 * - validation failure (success: false)
 * - validation exception
 */
describe('resetEarlyReturnState', () => {
  describe('prepareUserMessage exception path', () => {
    test('resets chain in progress to false', () => {
      let _chainInProgress = true

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          _chainInProgress = value
        },
        setCanProcessQueue: () => {},
      })

      expect(_chainInProgress).toBe(false)
    })

    test('sets _canProcessQueue to true when queue is not paused', () => {
      let _canProcessQueue = false
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isQueuePausedRef,
      })

      expect(_canProcessQueue).toBe(true)
    })

    test('sets _canProcessQueue to false when queue is paused', () => {
      let _canProcessQueue = true
      const isQueuePausedRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isQueuePausedRef,
      })

      expect(_canProcessQueue).toBe(false)
    })

    test('resets isProcessingQueueRef to false', () => {
      const isProcessingQueueRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: () => {},
        isProcessingQueueRef,
      })

      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('handles missing isProcessingQueueRef gracefully', () => {
      // Should not throw when isProcessingQueueRef is undefined
      expect(() => {
        resetEarlyReturnState({
          updateChainInProgress: () => {},
          setCanProcessQueue: () => {},
        })
      }).not.toThrow()
    })

    test('handles missing isQueuePausedRef gracefully (defaults to _canProcessQueue=true)', () => {
      let _canProcessQueue = false

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        // No isQueuePausedRef - should default to !undefined = true
      })

      expect(_canProcessQueue).toBe(true)
    })
  })

  describe('validation failure path (success: false)', () => {
    test('resets all queue state correctly when processing queued message', () => {
      let _chainInProgress = true
      let _canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          _chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(_chainInProgress).toBe(false)
      expect(_canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('respects queue paused state after validation failure', () => {
      let _chainInProgress = true
      let _canProcessQueue = true
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          _chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(_chainInProgress).toBe(false)
      expect(_canProcessQueue).toBe(false) // Queue was paused, should stay paused
      expect(isProcessingQueueRef.current).toBe(false)
    })
  })

  describe('validation exception path', () => {
    test('resets all queue state correctly when validation throws', () => {
      let _chainInProgress = true
      let _canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      // Simulating what happens after catching validation exception
      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          _chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(_chainInProgress).toBe(false)
      expect(_canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('preserves queue pause state when validation throws', () => {
      let _canProcessQueue = true
      const isQueuePausedRef = { current: true }
      const isProcessingQueueRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      // Queue was explicitly paused before, should remain paused after error
      expect(_canProcessQueue).toBe(false)
      // But processing lock should be released to allow manual resume
      expect(isProcessingQueueRef.current).toBe(false)
    })
  })
})
