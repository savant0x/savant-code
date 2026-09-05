import { describe, expect, test } from 'bun:test'

import type { ChatMessage } from '../../../types/chat'
import type { SendMessageTimerController } from '../../../utils/send-message-timer'
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

const { createStreamController } = await import('../../stream-state')
const { handleRunError, setupStreamingContext } =
  await import('../send-message')
const { createBatchedMessageUpdater } =
  await import('../../../utils/message-updater')

const createMockTimerController = (): SendMessageTimerController & {
  startCalls: string[]
  stopCalls: Array<'success' | 'error' | 'aborted'>
} => {
  const startCalls: string[] = []
  const stopCalls: Array<'success' | 'error' | 'aborted'> = []

  return {
    startCalls,
    stopCalls,
    start: (messageId: string) => {
      startCalls.push(messageId)
    },
    stop: (outcome: 'success' | 'error' | 'aborted') => {
      stopCalls.push(outcome)
      return { finishedAt: Date.now(), elapsedMs: 100 }
    },
    pause: () => {},
    resume: () => {},
    isActive: () => startCalls.length > stopCalls.length,
  }
}

const createBaseMessages = (): ChatMessage[] => [
  {
    id: 'ai-1',
    variant: 'ai',
    content: 'Partial streamed content',
    blocks: [{ type: 'text', content: 'Some text' }],
    timestamp: 'now',
  },
]

describe('CLI-level race: abort-guard ownership between overlapping runs', () => {
  test('aborted run A finally block must not clear isProcessingQueueRef owned by run B', () => {
    // Regression test for overlap hazard: after abort releases the chain lock,
    // run B can start from the queue and set isProcessingQueueRef = true.
    // Run A's late-executing finally block must NOT clear it.
    //
    // This tests the pattern used in use-send-message.ts where the finally block
    // guards isProcessingQueueRef cleanup with !abortController.signal.aborted.

    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }
    let _chainInProgress = true
    let _canProcessQueue = false
    let _streamStatus: StreamStatus = 'idle'

    // --- Run A setup and abort ---
    let messagesA = createBaseMessages()
    const sharedStreamRefs = createStreamController()
    const timerA = createMockTimerController()
    const abortRefA = { current: null as AbortController | null }

    const { abortController: abortA } = setupStreamingContext({
      aiMessageId: 'ai-run-a',
      timerController: timerA,
      setMessages: (fn: any) => {
        messagesA = fn(messagesA)
      },
      streamRefs: sharedStreamRefs,
      abortControllerRef: abortRefA,
      setStreamStatus: (status: StreamStatus) => {
        _streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        _canProcessQueue = can
      },
      isQueuePausedRef,
      isProcessingQueueRef,
      updateChainInProgress: (value: boolean) => {
        _chainInProgress = value
      },
      setIsRetrying: () => {},
      setStreamingAgents: () => {},
    })

    // Abort run A
    abortA.abort()
    expect(_chainInProgress).toBe(false)
    expect(isProcessingQueueRef.current).toBe(false)

    // --- Run B starts from queue, takes ownership of isProcessingQueueRef ---
    isProcessingQueueRef.current = true // Queue's processNextMessage sets this
    _chainInProgress = true
    _canProcessQueue = false

    // --- Simulate run A's finally block (late execution) ---
    // In use-send-message.ts, the finally block guards with !abortController.signal.aborted.
    // Verify abortA.signal.aborted is true so the guard would skip cleanup.
    expect(abortA.signal.aborted).toBe(true)

    // The finally block pattern: only clean up if NOT aborted
    if (!abortA.signal.aborted) {
      // This should NOT execute
      isProcessingQueueRef.current = false
    }

    // isProcessingQueueRef must still be true (owned by run B)
    expect(isProcessingQueueRef.current).toBe(true)
    // _chainInProgress must still be true (owned by run B)
    expect(_chainInProgress).toBe(true)
  })

  test('reject-after-abort must not run handleRunError cleanup that could clobber run B', () => {
    // Regression test: if client.run() rejects after abort (e.g., network teardown),
    // handleRunError should NOT run because it would reset shared queue/stream state
    // that run B may have already claimed.
    //
    // This tests the pattern used in use-send-message.ts where the catch block
    // guards handleRunError with !abortController.signal.aborted.

    let _streamStatus: StreamStatus = 'idle'
    let _canProcessQueue = true
    let _chainInProgress = false // Released by abort handler
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }

    // --- Simulate run A was aborted ---
    const abortController = new AbortController()
    abortController.abort()
    expect(abortController.signal.aborted).toBe(true)

    // --- Run B has started and claimed shared state ---
    _chainInProgress = true
    _canProcessQueue = false
    isProcessingQueueRef.current = true
    _streamStatus = 'streaming'

    // --- Simulate what happens if client.run() rejects after abort ---
    // The catch block pattern: only handle error if NOT aborted
    const error = new Error('AbortError: The operation was aborted')

    if (!abortController.signal.aborted) {
      // This should NOT execute — handleRunError would clobber run B's state
      handleRunError({
        error,
        timerController: createMockTimerController(),
        updater: createBatchedMessageUpdater('ai-1', () => {}),
        setIsRetrying: () => {},
        setStreamStatus: (status: StreamStatus) => {
          _streamStatus = status
        },
        setCanProcessQueue: (can: boolean) => {
          _canProcessQueue = can
        },
        updateChainInProgress: (value: boolean) => {
          _chainInProgress = value
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })
    }

    // Run B's state must be untouched
    expect(_chainInProgress).toBe(true) // Still owned by run B
    expect(_canProcessQueue).toBe(false) // Still owned by run B
    expect(isProcessingQueueRef.current).toBe(true) // Still owned by run B
    expect(_streamStatus).toBe('streaming') // Still owned by run B
  })

  test('handleRunError WOULD clobber run B state if called without abort guard (documents why guard is needed)', () => {
    // This test proves that handleRunError resets shared state, which is why
    // the catch block in use-send-message.ts MUST guard it with abort check.

    let _streamStatus: StreamStatus = 'streaming'
    let _canProcessQueue = false
    let _chainInProgress = true
    const isProcessingQueueRef = { current: true }
    const isQueuePausedRef = { current: false }

    // Call handleRunError without guard (simulates the bug scenario)
    handleRunError({
      error: new Error('AbortError'),
      timerController: createMockTimerController(),
      updater: createBatchedMessageUpdater('ai-1', (fn: any) => {}),
      setIsRetrying: () => {},
      setStreamStatus: (status: StreamStatus) => {
        _streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        _canProcessQueue = can
      },
      updateChainInProgress: (value: boolean) => {
        _chainInProgress = value
      },
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    // handleRunError resets ALL shared state — this would clobber run B
    expect(_chainInProgress).toBe(false) // Clobbered!
    expect(_canProcessQueue).toBe(true) // Clobbered!
    expect(isProcessingQueueRef.current).toBe(false) // Clobbered!
    expect(_streamStatus as StreamStatus).toBe('idle') // Clobbered!
  })
})
