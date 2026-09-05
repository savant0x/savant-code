import { createPaymentRequiredError } from '@savant-code/sdk'
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

describe('handleRunError specialized errors', () => {
  let originalGetState: typeof useChatStore.getState

  beforeEach(() => {
    originalGetState = useChatStore.getState
  })

  afterEach(() => {
    useChatStore.getState = originalGetState
  })

  test('context length exceeded error (AI_APICallError) stores error in userError and preserves content', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'Partial streamed content before error',
        blocks: [{ type: 'text', content: 'some block content' }],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    // Create an error that matches the real AI_APICallError structure
    const contextLengthError = Object.assign(
      new Error(
        'This endpoint\'s maximum context length is 200000 tokens. However, you requested about 201209 tokens (158536 of text input, 10673 of tool input, 32000 in the output). Please reduce the length of either one, or use the "middle-out" transform to compress your prompt automatically.',
      ),
      {
        name: 'AI_APICallError',
        statusCode: 400,
      },
    )

    let _streamStatus = 'streaming' as StreamStatus
    let _canProcessQueue = false
    let _chainInProgress = true
    let isRetrying = true

    handleRunError({
      error: contextLengthError,
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

    // Content should be preserved
    expect(aiMessage!.content).toBe('Partial streamed content before error')

    // Blocks should be preserved
    expect(aiMessage!.blocks).toEqual([
      { type: 'text', content: 'some block content' },
    ])

    // Error should be stored in userError (displayed in UserErrorBanner)
    expect(aiMessage!.userError).toContain(
      'maximum context length is 200000 tokens',
    )
    expect(aiMessage!.userError).toContain('201209 tokens')

    // Message should be marked complete
    expect(aiMessage!.isComplete).toBe(true)

    // State should be reset
    expect(_streamStatus).toBe('idle')
    expect(_canProcessQueue).toBe(true)
    expect(_chainInProgress).toBe(false)
    expect(isRetrying).toBe(false)

    // Timer should be stopped with error
    expect(timerController.stopCalls).toContain('error')
  })

  test('Payment required error (402) uses setError, invalidates queries, and switches input mode', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'Partial streamed content',
        blocks: [{ type: 'text', content: 'some block' }],
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

    const paymentError = createPaymentRequiredError('Out of credits')

    handleRunError({
      error: paymentError,
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    expect(aiMessage).toBeDefined()

    // For PaymentRequiredError, setError sets userError (not content)
    // Content is preserved, error is stored in userError field
    expect(aiMessage!.content).toBe('Partial streamed content')
    expect(aiMessage!.userError).toContain('Out of credits')

    // Blocks should be preserved for debugging context
    expect(aiMessage!.blocks).toEqual([{ type: 'text', content: 'some block' }])

    // Message should be marked complete
    expect(aiMessage!.isComplete).toBe(true)

    // Input mode should switch to outOfCredits
    expect(setInputModeMock).toHaveBeenCalledWith('outOfCredits')

    // Timer should still be stopped with error
    expect(timerController.stopCalls).toContain('error')
  })
})
