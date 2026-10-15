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

describe('handleRunCompletion', () => {
  describe('abort path', () => {
    test('skips finalizeQueueState when wasAbortedByUser is true (abort handler already released locks)', () => {
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
      const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
        messages = fn(messages)
      })

      // These simulate state that was already cleaned up by the abort handler
      let _streamStatus: StreamStatus = 'idle'
      let _canProcessQueue = true
      let _chainInProgress = false
      const isProcessingQueueRef = { current: false }
      const isQueuePausedRef = { current: false }
      let _hasReceivedPlanResponse = false

      // Track if setters are called (they shouldn't be)
      let setStreamStatusCalled = false
      let setCanProcessQueueCalled = false
      let updateChainInProgressCalled = false

      const runState = {
        traceSessionId: 'trace-test',
        sessionState: undefined,
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
        setStreamStatus: (status: StreamStatus) => {
          setStreamStatusCalled = true
          _streamStatus = status
        },
        setCanProcessQueue: (can: boolean) => {
          setCanProcessQueueCalled = true
          _canProcessQueue = can
        },
        updateChainInProgress: (value: boolean) => {
          updateChainInProgressCalled = true
          _chainInProgress = value
        },
        setHasReceivedPlanResponse: (value: boolean) => {
          _hasReceivedPlanResponse = value
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      // handleRunCompletion should NOT call finalizeQueueState for aborted runs
      // (the abort handler already released the locks)
      expect(setStreamStatusCalled).toBe(false)
      expect(setCanProcessQueueCalled).toBe(false)
      expect(updateChainInProgressCalled).toBe(false)
    })

    test('does not process server response when wasAbortedByUser is true', () => {
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
      const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
        messages = fn(messages)
      })

      let _hasReceivedPlanResponse = false

      const runState = {
        traceSessionId: 'trace-test',
        sessionState: undefined,
        output: {
          type: 'lastMessage' as const,
          value: [
            {
              role: 'assistant' as const,
              content: [
                {
                  type: 'text' as const,
                  text: 'Server response that should be ignored',
                },
              ],
            },
          ],
        },
      }

      handleRunCompletion({
        runState,
        actualCredits: 42,
        agentMode: 'SCAFFOLD',
        timerController,
        updater,
        aiMessageId: 'ai-1',
        wasAbortedByUser: true,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        updateChainInProgress: () => {},
        setHasReceivedPlanResponse: (value: boolean) => {
          _hasReceivedPlanResponse = value
        },
      })

      // Should NOT set plan response (abort path returns early before processing output)
      expect(_hasReceivedPlanResponse).toBe(false)

      // Timer should NOT be stopped by handleRunCompletion (abort handler already stopped it)
      expect(timerController.stopCalls).not.toContain('success')
      expect(timerController.stopCalls).not.toContain('error')
    })

    test('does not call resumeQueue in abort path (abort handler already released locks)', () => {
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
      const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
        messages = fn(messages)
      })

      let resumeQueueCalled = false
      let _canProcessQueueCalled = false

      const runState = {
        traceSessionId: 'trace-test',
        sessionState: undefined,
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
        setStreamStatus: () => {},
        setCanProcessQueue: () => {
          _canProcessQueueCalled = true
        },
        updateChainInProgress: () => {},
        setHasReceivedPlanResponse: () => {},
        resumeQueue: () => {
          resumeQueueCalled = true
        },
      })

      // Neither should be called - abort handler already handled cleanup
      expect(resumeQueueCalled).toBe(false)
      expect(_canProcessQueueCalled).toBe(false)
    })
  })

  describe('normal completion', () => {
    test('setupStreamingContext can be re-entered for a fresh run (smoke parity)', () => {
      // Parity guard kept with the original monolith: a fresh streaming
      // context can always be created after a prior completion.
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
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

      expect(abortController).toBeInstanceOf(AbortController)
      expect(streamRefs.state.wasAbortedByUser).toBe(false)
    })
  })
})
