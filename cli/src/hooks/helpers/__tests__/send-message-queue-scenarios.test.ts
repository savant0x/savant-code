import { describe, expect, test } from 'bun:test'

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

const { resetEarlyReturnState } = await import('../send-message')

describe('resetEarlyReturnState complete early return scenarios', () => {
  test('queue can process next message after prepareUserMessage exception', () => {
    // Scenario: Message was being processed from queue, prepareUserMessage throws
    let _chainInProgress = true
    let _canProcessQueue = false
    const isProcessingQueueRef = { current: true }
    const isQueuePausedRef = { current: false }

    // After exception, reset is called
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

    // Queue should be able to process next message
    expect(_chainInProgress).toBe(false)
    expect(_canProcessQueue).toBe(true)
    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('queue can process next message after validation returns success=false', () => {
    // Scenario: Message was being processed, validation returns failure
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

    // All locks released, queue can continue
    expect(_chainInProgress).toBe(false)
    expect(_canProcessQueue).toBe(true)
    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('queue can process next message after validation throws exception', () => {
    // Scenario: Message was being processed, validation throws
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

    // All locks released, queue can continue
    expect(_chainInProgress).toBe(false)
    expect(_canProcessQueue).toBe(true)
    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('queue remains blocked after error if user had paused it', () => {
    // Scenario: User paused queue, then an error occurred
    // Queue should remain paused after error recovery
    let _chainInProgress = true
    let _canProcessQueue = true
    const isProcessingQueueRef = { current: true }
    const isQueuePausedRef = { current: true } // User explicitly paused

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

    // Chain is no longer in progress
    expect(_chainInProgress).toBe(false)
    // But queue should remain blocked because user paused it
    expect(_canProcessQueue).toBe(false)
    // Processing lock is released though
    expect(isProcessingQueueRef.current).toBe(false)
  })
})
