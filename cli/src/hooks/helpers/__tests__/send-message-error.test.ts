import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test'

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

const { useChatStore } = await import('../../../state/chat-store')
const { handleRunError } = await import('../send-message')
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

describe('handleRunError', () => {
  let originalGetState: typeof useChatStore.getState

  beforeEach(() => {
    originalGetState = useChatStore.getState
  })

  afterEach(() => {
    useChatStore.getState = originalGetState
  })

  test('stores error in userError field for regular errors', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'Partial streamed content',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    let _streamStatus: StreamStatus = 'idle'
    let _canProcessQueue = false
    let _chainInProgress = true
    let isRetrying = true

    handleRunError({
      error: new Error('Network timeout'),
      timerController,
      updater,
      setIsRetrying: (value: boolean) => {
        isRetrying = value
      },
      setStreamStatus: (status: StreamStatus) => {
        _streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        _canProcessQueue = can
      },
      updateChainInProgress: (value: boolean) => {
        _chainInProgress = value
      },
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    expect(aiMessage).toBeDefined()

    // Content should be preserved, error stored in userError
    expect(aiMessage!.content).toBe('Partial streamed content')
    expect(aiMessage!.userError).toBe('Network timeout')

    // Verify state resets
    expect(_streamStatus).toBe('idle')
    expect(_canProcessQueue).toBe(true)
    expect(_chainInProgress).toBe(false)
    expect(isRetrying).toBe(false)

    // Verify timer stopped with error
    expect(timerController.stopCalls).toContain('error')

    // Verify message marked complete
    expect(aiMessage!.isComplete).toBe(true)
  })

  test('handles empty existing content gracefully', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    handleRunError({
      error: new Error('Something failed'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    // Error should be in userError field
    expect(aiMessage!.userError).toBe('Something failed')
    expect(aiMessage!.isComplete).toBe(true)
  })

  test('handles regular errors without switching input mode', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    const setInputModeMock = mock(() => {})
    useChatStore.getState = () => ({
      ...originalGetState(),
      setInputMode: setInputModeMock,
    })

    handleRunError({
      error: new Error('Regular error'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })

    // Should NOT switch input mode for regular errors
    expect(setInputModeMock).not.toHaveBeenCalled()
  })

  test('resets isProcessingQueueRef to false on error', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })
    const isProcessingQueueRef = { current: true }

    // Verify ref starts as true
    expect(isProcessingQueueRef.current).toBe(true)

    handleRunError({
      error: new Error('Some error'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
      isProcessingQueueRef,
    })

    // Verify isProcessingQueueRef is reset to false
    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('respects isQueuePausedRef when setting _canProcessQueue on error', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })
    const isQueuePausedRef = { current: true }
    let _canProcessQueue = true

    handleRunError({
      error: new Error('Some error'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: (can: boolean) => {
        _canProcessQueue = can
      },
      updateChainInProgress: () => {},
      isQueuePausedRef,
    })

    // When queue was paused before streaming, _canProcessQueue should be false
    expect(_canProcessQueue).toBe(false)
  })
})
