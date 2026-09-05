import { feedbackRequestSchema } from '@savant-code/common/schemas/feedback'
import { describe, expect, test } from 'bun:test'

import { buildFeedbackPayload, buildMessageContext } from '../feedback-helpers'

import type { ChatMessage } from '../../types/chat'

const createMessage = (
  overrides: Partial<ChatMessage> & { id: string },
): ChatMessage => ({
  variant: 'ai',
  content: 'test content',
  timestamp: new Date().toISOString(),
  ...overrides,
})

// FID-2026-0819-005 Loop 289: the Cross-layer validation suites moved verbatim from feedback-helpers.test.ts; createMessage helper copied verbatim.
describe('Cross-layer validation', () => {
  test('buildFeedbackPayload output satisfies server-side zod schema', () => {
    const messages = [
      createMessage({ id: 'msg-1', variant: 'user' }),
      createMessage({
        id: 'msg-2',
        variant: 'ai',
        completionTime: '2.5s',
        credits: 1.2,
      }),
    ]

    const { target, recentMessages } = buildMessageContext(messages, 'msg-2')
    const payload = buildFeedbackPayload({
      text: 'Great feature!',
      feedbackCategory: 'good_result',
      feedbackMessageId: 'msg-2',
      target,
      recentMessages,
      agentMode: 'SCAFFOLD',
      sessionCreditsUsed: 3.5,
      errors: [{ id: 'err-1', message: 'Something went wrong' }],
      clientFeedbackId: 'c3d4e5f6-a7b8-4012-8def-123456789012',
    })

    const result = feedbackRequestSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  test('minimal buildFeedbackPayload output satisfies server-side zod schema', () => {
    const payload = buildFeedbackPayload({
      text: 'Bug report',
      feedbackCategory: 'app_bug',
      feedbackMessageId: null,
      target: null,
      recentMessages: [],
      agentMode: null,
      sessionCreditsUsed: null,
      errors: null,
      clientFeedbackId: 'd4e5f6a7-b8c9-4123-9efa-234567890123',
    })

    const result = feedbackRequestSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  test('payload always includes source field', () => {
    const payload = buildFeedbackPayload({
      text: 'test',
      feedbackCategory: 'other',
      feedbackMessageId: null,
      target: null,
      recentMessages: [],
      agentMode: null,
      sessionCreditsUsed: null,
      errors: null,
      clientFeedbackId: 'e5f6a7b8-c9d0-4234-afab-345678901234',
    })

    expect(payload.source).toBe('cli')
    const result = feedbackRequestSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  test('schema rejects type=message without messageId', () => {
    const payload = {
      text: 'test',
      category: 'other',
      type: 'message',
      source: 'cli',
    }

    const result = feedbackRequestSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})
