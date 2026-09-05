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

const { handleRunCompletion, handleRunError } = await import('../send-message')
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

describe('savant-free gate errors', () => {
  const makeUpdater = (messages: ChatMessage[]) => {
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      const next = fn(messages)
      messages.length = 0
      messages.push(...next)
    })
    return updater
  }

  const baseMessage = (): ChatMessage[] => [
    {
      id: 'ai-1',
      variant: 'ai',
      content: '',
      blocks: [],
      timestamp: 'now',
    },
  ]

  const gateError = (kind: string, statusCode: number) => ({
    error: kind,
    statusCode,
    message: 'server said so',
  })

  test('handleRunError maps 409 session_superseded to the restart-required message', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('session_superseded', 409),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toContain('Another savant-free CLI took over')
  })

  test('handleRunError suppresses the inline error for 410 session_expired (ended banner takes over)', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('session_expired', 410),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    // New contract: the gate handler flips the session store into `ended`
    // and the session-ended banner is the user-facing signal, so we do NOT
    // also surface an inline userError inside the chat transcript.
    expect(messages[0].userError).toBeUndefined()
  })

  test('handleRunError suppresses the inline error for 428 waiting_room_required (ended banner takes over)', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('waiting_room_required', 428),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toBeUndefined()
  })

  test('handleRunError maps 429 waiting_room_queued to the session-pending message', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('waiting_room_queued', 429),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toContain('still being set up')
  })

  test('handleRunError ignores gate-shaped errors with non-matching status code', () => {
    // An error body with error: 'session_superseded' but a 500 status should
    // NOT be classified as a gate error (prevents generic 5xx from mimicking
    // the structured gate responses).
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    const err = Object.assign(new Error('oops'), {
      error: 'session_superseded',
      statusCode: 500,
    })
    handleRunError({
      error: err,
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toBe('oops')
    expect(messages[0].userError).not.toContain('took over')
  })

  test('handleRunCompletion with gate error output routes through the gate handler', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    const runState: any = {
      traceSessionId: 'trace-test',
      sessionState: undefined,
      output: {
        type: 'error',
        message: 'server said so',
        error: 'session_expired',
        statusCode: 410,
      },
    }
    handleRunCompletion({
      runState,
      actualCredits: undefined,
      agentMode: 'HYBRID',
      timerController: createMockTimerController(),
      updater,
      aiMessageId: 'ai-1',
      wasAbortedByUser: false,
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
      setHasReceivedPlanResponse: () => {},
    })
    updater.flush()
    // 410 is now handled by the ended banner, not an inline error. The
    // assertion here just confirms routing happened via the gate handler
    // (which swallows the userError) rather than the generic error path
    // (which would set a userError from the message).
    expect(messages[0].userError).toBeUndefined()
  })
})
