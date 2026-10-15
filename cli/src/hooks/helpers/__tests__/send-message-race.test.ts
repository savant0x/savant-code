/**
 * CLI-level async race tests: reproduce the exact bug scenario where aborting
 * run A and attempting run B before A resolves would lose message history.
 *
 * These tests simulate the full lifecycle at the helper level:
 * 1. Start run A (setupStreamingContext)
 * 2. Abort run A mid-stream
 * 3. Attempt run B — verify it's blocked (chain lock held)
 * 4. Resolve run A (handleRunCompletion with updated state)
 * 5. Verify run B is now unblocked and can use state from A
 */
import { describe, expect, test } from 'bun:test'

import type { ChatMessage } from '../../../types/chat'
import type { SendMessageTimerController } from '../../../utils/send-message-timer'
import type { StreamStatus } from '../../use-message-queue'
import type { RunState } from '@savant-code/sdk'

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
const { handleRunCompletion, setupStreamingContext } =
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

describe('CLI-level race condition: abort run A, attempt run B before A resolves', () => {
  /**
   * Simulates the queue-processing gate checks from useMessageQueue.processNextMessage.
   * Returns true if a queued message would be allowed to proceed.
   */
  const canQueueProcessNextMessage = (opts: {
    isChainInProgress: boolean
    _canProcessQueue: boolean
    _streamStatus: StreamStatus
    isProcessingQueue: boolean
    isQueuePaused: boolean
  }): boolean => {
    if (opts.isQueuePaused) return false
    if (!opts._canProcessQueue) return false
    if (opts._streamStatus !== 'idle') return false
    if (opts.isChainInProgress) return false
    if (opts.isProcessingQueue) return false
    return true
  }

  test('run B can proceed immediately after abort (chain lock released by abort handler)', () => {
    // --- Shared mutable state (simulates React refs and state in the CLI) ---
    let _streamStatus: StreamStatus = 'idle'
    let _canProcessQueue = false
    let _chainInProgress = true // Set true at start of sendMessage
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }

    const setStreamStatus = (status: StreamStatus) => {
      _streamStatus = status
    }
    const setCanProcessQueue = (can: boolean) => {
      _canProcessQueue = can
    }
    const updateChainInProgress = (value: boolean) => {
      _chainInProgress = value
    }

    // --- PHASE 1: Start run A (setupStreamingContext) ---
    let messagesA = createBaseMessages()
    const streamRefsA = createStreamController()
    const timerControllerA = createMockTimerController()
    const abortControllerRefA = { current: null as AbortController | null }

    const { abortController: abortControllerA } = setupStreamingContext({
      aiMessageId: 'ai-1',
      timerController: timerControllerA,
      setMessages: (fn: any) => {
        messagesA = fn(messagesA)
      },
      streamRefs: streamRefsA,
      abortControllerRef: abortControllerRefA,
      setStreamStatus,
      setCanProcessQueue,
      isQueuePausedRef,
      isProcessingQueueRef,
      updateChainInProgress,
      setIsRetrying: () => {},
      setStreamingAgents: () => {},
    })

    // Simulate streaming has started
    _streamStatus = 'streaming'

    // Verify run A is actively streaming
    expect(_streamStatus).toBe('streaming')
    expect(_chainInProgress).toBe(true)

    // --- PHASE 2: User aborts run A ---
    abortControllerA.abort()

    // Abort handler fires synchronously: UI is updated AND chain lock is released
    expect(streamRefsA.state.wasAbortedByUser).toBe(true)
    expect(_streamStatus as StreamStatus).toBe('idle')
    expect(_chainInProgress).toBe(false) // Chain lock released immediately!
    expect(_canProcessQueue).toBe(true)

    // --- PHASE 3: User types run B — verify it's UNBLOCKED ---
    const canProcessRunB = canQueueProcessNextMessage({
      isChainInProgress: _chainInProgress,
      _canProcessQueue,
      _streamStatus,
      isProcessingQueue: isProcessingQueueRef.current,
      isQueuePaused: isQueuePausedRef.current,
    })

    // Run B can proceed immediately — this is the core fix.
    // New messages are sent directly instead of being queued.
    expect(canProcessRunB).toBe(true)
  })

  test('handleRunCompletion does not interfere after abort (no-op for aborted runs)', () => {
    // After abort releases the chain lock, handleRunCompletion should be a no-op
    // to avoid interfering with any new run that may have started.

    let _streamStatus: StreamStatus = 'idle'
    let _canProcessQueue = true
    let _chainInProgress = false // Already released by abort handler
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }

    const timerController = createMockTimerController()
    let messages = createBaseMessages()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    // Track calls
    let setStreamStatusCallCount = 0
    let updateChainInProgressCallCount = 0

    const runState: RunState = {
      traceSessionId: 'trace-test',
      sessionState: {} as any,
      output: { type: 'lastMessage' as const, value: [] },
    }

    handleRunCompletion({
      runState,
      actualCredits: undefined,
      agentMode: 'HYBRID',
      timerController,
      updater,
      aiMessageId: 'ai-1',
      wasAbortedByUser: true,
      setStreamStatus: () => {
        setStreamStatusCallCount++
      },
      setCanProcessQueue: (can: boolean) => {
        _canProcessQueue = can
      },
      updateChainInProgress: () => {
        updateChainInProgressCallCount++
      },
      setHasReceivedPlanResponse: () => {},
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    // handleRunCompletion should be a no-op for aborted runs
    expect(setStreamStatusCallCount).toBe(0)
    expect(updateChainInProgressCallCount).toBe(0)
    // State should be unchanged (still in the "released" state from abort handler)
    expect(_chainInProgress).toBe(false)
    expect(_canProcessQueue).toBe(true)
  })
})
