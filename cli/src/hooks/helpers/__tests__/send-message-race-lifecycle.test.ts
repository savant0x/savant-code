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

describe('CLI-level race: full two-run lifecycle with shared streamRefs', () => {
  test('full two-run lifecycle with shared streamRefs: run A abort → run B starts immediately', () => {
    // End-to-end test: two complete runs sharing the SAME streamRefs instance
    // (matching production behavior where streamRefs is reused across sends).
    // Verifies that run B can start immediately after abort, and that run A's
    // late-resolving handleRunCompletion does NOT interfere with run B.

    let _streamStatus: StreamStatus = 'idle'
    let _canProcessQueue = false
    let _chainInProgress = true
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }
    let previousRunState: RunState | null = null

    const setStreamStatus = (status: StreamStatus) => {
      _streamStatus = status
    }
    const setCanProcessQueue = (can: boolean) => {
      _canProcessQueue = can
    }
    const updateChainInProgress = (value: boolean) => {
      _chainInProgress = value
    }

    // CRITICAL: Use a single shared streamRefs instance, just like production.
    // In production, streamRefsRef is created once via useRef and reused.
    const sharedStreamRefs = createStreamController()

    // === RUN A ===
    let messagesA = createBaseMessages()
    const timerA = createMockTimerController()
    const abortRefA = { current: null as AbortController | null }

    const { updater: updaterA, abortController: abortA } =
      setupStreamingContext({
        aiMessageId: 'ai-run-a',
        timerController: timerA,
        setMessages: (fn: any) => {
          messagesA = fn(messagesA)
        },
        streamRefs: sharedStreamRefs,
        abortControllerRef: abortRefA,
        setStreamStatus,
        setCanProcessQueue,
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress,
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

    _streamStatus = 'streaming'

    // Abort run A
    abortA.abort()
    expect(_chainInProgress).toBe(false) // Lock released immediately!
    expect(_canProcessQueue).toBe(true)
    expect(sharedStreamRefs.state.wasAbortedByUser).toBe(true)

    // === RUN B starts immediately (before A's client.run() resolves) ===
    _chainInProgress = true
    _canProcessQueue = false

    let messagesB: ChatMessage[] = [
      {
        id: 'ai-run-b',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]
    const timerB = createMockTimerController()
    const abortRefB = { current: null as AbortController | null }

    // Run B's setupStreamingContext calls sharedStreamRefs.reset(),
    // which clears wasAbortedByUser. This is the key race condition.
    const { updater: updaterB, abortController: abortB } =
      setupStreamingContext({
        aiMessageId: 'ai-run-b',
        timerController: timerB,
        setMessages: (fn: any) => {
          messagesB = fn(messagesB)
        },
        streamRefs: sharedStreamRefs,
        abortControllerRef: abortRefB,
        setStreamStatus,
        setCanProcessQueue,
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress,
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

    // After B starts, shared streamRefs.wasAbortedByUser is reset to false.
    // This is why we use per-run abortController.signal.aborted instead.
    expect(sharedStreamRefs.state.wasAbortedByUser).toBe(false)

    // Now run A's client.run() resolves (after B has already started and reset shared state).
    // handleRunCompletion uses the per-run wasAbortedByUser boolean (from abortA.signal.aborted),
    // NOT the shared streamRefs, so it correctly knows A was aborted.
    const runStateA: RunState = {
      traceSessionId: 'trace-test-a',
      sessionState: {
        id: 'session-abc',
        messages: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'partial response before cancel' },
        ],
      } as any,
      output: { type: 'lastMessage' as const, value: [] },
    }
    previousRunState = runStateA

    handleRunCompletion({
      runState: runStateA,
      actualCredits: undefined,
      agentMode: 'HYBRID',
      timerController: timerA,
      updater: updaterA,
      aiMessageId: 'ai-run-a',
      wasAbortedByUser: abortA.signal.aborted, // per-run flag, not shared state
      setStreamStatus,
      setCanProcessQueue,
      updateChainInProgress,
      setHasReceivedPlanResponse: () => {},
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    // handleRunCompletion for aborted run A should be a no-op
    // (it should NOT interfere with run B's chain lock)
    expect(_chainInProgress).toBe(true) // Still true from run B!

    // Simulate run B completing normally
    const runStateB: RunState = {
      traceSessionId: 'trace-test-b',
      sessionState: {
        id: 'session-abc',
        messages: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'partial response before cancel' },
          { role: 'user', content: 'second message' },
          { role: 'assistant', content: 'full response to second message' },
        ],
      } as any,
      output: {
        type: 'lastMessage' as const,
        value: [
          {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: 'full response' }],
          },
        ],
      },
    }
    previousRunState = runStateB

    handleRunCompletion({
      runState: runStateB,
      actualCredits: 5,
      agentMode: 'HYBRID',
      timerController: timerB,
      updater: updaterB,
      aiMessageId: 'ai-run-b',
      wasAbortedByUser: abortB.signal.aborted, // per-run flag: false (B was not aborted)
      setStreamStatus,
      setCanProcessQueue,
      updateChainInProgress,
      setHasReceivedPlanResponse: () => {},
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    // Final state: run B completed normally
    expect(previousRunState!.sessionState as any).toEqual({
      id: 'session-abc',
      messages: [
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'partial response before cancel' },
        { role: 'user', content: 'second message' },
        { role: 'assistant', content: 'full response to second message' },
      ],
    })
    expect(_chainInProgress).toBe(false)
    expect(_canProcessQueue).toBe(true)
  })
})
