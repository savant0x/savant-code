/**
 * FID-2026-0819-005 Loop 312: split of the 1851-line send-message.test.ts
 * monolith. This module keeps the setupStreamingContext suite; the
 * completion-abort, finalize/reset, error, race-condition, and gate-error
 * suites live in focused sibling modules sharing the same harness contract
 * (env bootstrap + dynamic imports below).
 */
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
const { setupStreamingContext } = await import('../send-message')

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

describe('setupStreamingContext', () => {
  describe('abort flow', () => {
    test('abort handler appends interruption notice, marks complete, and releases chain lock', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const abortControllerRef = { current: null as AbortController | null }
      let _streamStatus: StreamStatus = 'idle'
      let _canProcessQueue = false
      let _chainInProgress = true
      let isRetrying = true

      const { updater, abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        abortControllerRef,
        setStreamStatus: (status: StreamStatus) => {
          _streamStatus = status
        },
        setCanProcessQueue: (can: boolean) => {
          _canProcessQueue = can
        },
        updateChainInProgress: (value: boolean) => {
          _chainInProgress = value
        },
        setIsRetrying: (value: boolean) => {
          isRetrying = value
        },
        setStreamingAgents: () => {},
      })

      // Trigger abort
      abortController.abort()

      // Verify wasAbortedByUser is set
      expect(streamRefs.state.wasAbortedByUser).toBe(true)

      // Verify stream status reset for UI feedback
      expect(_streamStatus).toBe('idle')

      // Chain lock is released immediately so new messages can be sent directly
      expect(_chainInProgress).toBe(false)
      expect(_canProcessQueue).toBe(true)

      // Verify retrying reset
      expect(isRetrying).toBe(false)

      // Verify timer stopped with 'aborted' outcome
      expect(timerController.stopCalls).toContain('aborted')

      // Flush any pending updates to check interruption notice
      updater.flush()

      // Verify interruption notice appended (the message should have been updated)
      const aiMessage = messages.find((m: ChatMessage) => m.id === 'ai-1')
      expect(aiMessage).toBeDefined()

      // The interruption notice should be added to blocks
      const lastBlock = aiMessage!.blocks?.[aiMessage!.blocks.length - 1]
      expect(lastBlock?.type).toBe('text')
      const textBlock = lastBlock as { type: 'text'; content: string }
      expect(textBlock?.content).toContain('[response interrupted]')

      // Verify message marked complete
      expect(aiMessage!.isComplete).toBe(true)
    })

    test('abort sets _canProcessQueue based on queue pause state', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const abortControllerRef = { current: null as AbortController | null }
      const isQueuePausedRef = { current: true }
      let _canProcessQueue = false
      let _canProcessQueueCallCount = 0

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        abortControllerRef,
        setStreamStatus: () => {},
        setCanProcessQueue: (can: boolean) => {
          _canProcessQueue = can
          _canProcessQueueCallCount++
        },
        isQueuePausedRef,
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      // Trigger abort
      abortController.abort()

      // Abort handler sets _canProcessQueue respecting queue pause state
      expect(_canProcessQueueCallCount).toBe(1)
      // Queue was paused, so _canProcessQueue stays false
      expect(_canProcessQueue).toBe(false)
    })

    test('abort resets isProcessingQueueRef', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const abortControllerRef = { current: null as AbortController | null }
      const isProcessingQueueRef = { current: true }

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        abortControllerRef,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        isProcessingQueueRef,
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      // Verify ref starts as true
      expect(isProcessingQueueRef.current).toBe(true)

      // Trigger abort
      abortController.abort()

      // isProcessingQueueRef is reset by abort handler so new messages can be sent
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('abort releases chain lock and processing state, respects queue pause', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const abortControllerRef = { current: null as AbortController | null }
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: true }
      let _streamStatus = 'streaming' as StreamStatus
      let _canProcessQueue = true
      let _chainInProgress = true
      let isRetrying = true

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        abortControllerRef,
        setStreamStatus: (status) => {
          _streamStatus = status
        },
        setCanProcessQueue: (can) => {
          _canProcessQueue = can
        },
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress: (value) => {
          _chainInProgress = value
        },
        setIsRetrying: (value) => {
          isRetrying = value
        },
        setStreamingAgents: () => {},
      })

      // Sanity check initial state
      expect(isProcessingQueueRef.current).toBe(true)
      expect(isQueuePausedRef.current).toBe(true)
      expect(_streamStatus).toBe('streaming')
      expect(_canProcessQueue).toBe(true)
      expect(_chainInProgress).toBe(true)
      expect(isRetrying).toBe(true)

      // Trigger abort
      abortController.abort()

      // After abort, chain lock and processing lock are released immediately
      // so new messages can be sent directly instead of being queued.
      expect(isProcessingQueueRef.current).toBe(false)
      expect(_canProcessQueue).toBe(false) // Respects isQueuePausedRef (true)
      expect(_chainInProgress).toBe(false) // Released immediately
      expect(isRetrying).toBe(false)
      expect(_streamStatus).toBe('idle')
    })
  })
})
