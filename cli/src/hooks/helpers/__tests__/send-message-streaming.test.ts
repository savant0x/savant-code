import { describe, expect, test } from 'bun:test'

import type { ChatMessage } from '../../../types/chat'
import type { SendMessageTimerController } from '../../../utils/send-message-timer'

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
    test('abort handler stores abortController in ref', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const abortControllerRef = { current: null as AbortController | null }

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
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      // Verify abortController is stored in ref
      expect(abortControllerRef.current).toBe(abortController)
    })

    test('setupStreamingContext resets streamRefs and starts timer', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      // Pre-populate some state
      streamRefs.state.rootStreamBuffer = 'some old content'
      streamRefs.state.rootStreamSeen = true

      const timerController = createMockTimerController()
      const abortControllerRef = { current: null as AbortController | null }

      setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        abortControllerRef,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      // Verify streamRefs was reset
      expect(streamRefs.state.rootStreamBuffer).toBe('')
      expect(streamRefs.state.rootStreamSeen).toBe(false)

      // Verify timer was started with correct message ID
      expect(timerController.startCalls).toContain('ai-1')
    })
  })
})
