import { describe, expect, test } from 'bun:test'

import {
  buildFeedbackPayload,
  type RecentMessageSummary,
} from '../feedback-helpers'

import type { ChatMessage } from '../../types/chat'

const createMessage = (
  overrides: Partial<ChatMessage> & { id: string },
): ChatMessage => ({
  variant: 'ai',
  content: 'test content',
  timestamp: new Date().toISOString(),
  ...overrides,
})

// FID-2026-0819-005 Loop 289: the buildFeedbackPayload suites moved verbatim from feedback-helpers.test.ts; createMessage helper copied verbatim.
describe('buildFeedbackPayload', () => {
  const baseParams = {
    text: 'Great feature!',
    feedbackCategory: 'good_result' as const,
    feedbackMessageId: null as string | null,
    target: null as ReturnType<typeof createMessage> | null,
    recentMessages: [] as RecentMessageSummary[],
    agentMode: null as string | null,
    sessionCreditsUsed: null as number | null,
    errors: null as Array<{ id: string; message: string }> | null,
    clientFeedbackId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  }

  test('builds minimal general feedback payload', () => {
    const payload = buildFeedbackPayload(baseParams)

    expect(payload).toEqual({
      text: 'Great feature!',
      category: 'good_result',
      type: 'general',
      clientFeedbackId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      source: 'cli',
    })
  })

  test('always includes source: cli', () => {
    const payload = buildFeedbackPayload(baseParams)
    expect(payload.source).toBe('cli')
  })

  test('passes through the provided clientFeedbackId', () => {
    const payload = buildFeedbackPayload(baseParams)
    expect(payload.clientFeedbackId).toBe(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    )
  })

  test('uses the exact clientFeedbackId provided', () => {
    const specificId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    const payload = buildFeedbackPayload({
      ...baseParams,
      clientFeedbackId: specificId,
    })
    expect(payload.clientFeedbackId).toBe(specificId)
  })

  test('sets type to message when feedbackMessageId is present', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      feedbackMessageId: 'msg-123',
    })

    expect(payload.type).toBe('message')
    expect(payload.messageId).toBe('msg-123')
  })

  test('sends messageId even when target message is not found', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      feedbackMessageId: 'msg-deleted',
      target: null,
    })

    expect(payload.type).toBe('message')
    expect(payload.messageId).toBe('msg-deleted')
    expect(payload.messageVariant).toBeUndefined()
    expect(payload.credits).toBeUndefined()
    expect(payload.completionTime).toBeUndefined()
  })

  test('includes target message details when target is found', () => {
    const target = createMessage({
      id: 'msg-1',
      variant: 'ai',
      completionTime: '2.5s',
      credits: 1.2,
    })

    const payload = buildFeedbackPayload({
      ...baseParams,
      feedbackMessageId: 'msg-1',
      target,
    })

    expect(payload.messageId).toBe('msg-1')
    expect(payload.messageVariant).toBe('ai')
    expect(payload.completionTime).toBe('2.5s')
    expect(payload.credits).toBe(1.2)
  })

  test('includes target credits: 0 (not dropped)', () => {
    const target = createMessage({
      id: 'msg-1',
      credits: 0,
    })

    const payload = buildFeedbackPayload({
      ...baseParams,
      feedbackMessageId: 'msg-1',
      target,
    })

    expect(payload.credits).toBe(0)
  })

  test('includes optional fields when present', () => {
    const recentMessages: RecentMessageSummary[] = [
      { type: 'user', id: 'msg-1' },
    ]
    const errors = [{ id: 'err-1', message: 'Something went wrong' }]

    const payload = buildFeedbackPayload({
      ...baseParams,
      agentMode: 'SCAFFOLD',
      sessionCreditsUsed: 3.5,
      recentMessages,
      errors,
    })

    expect(payload.agentMode).toBe('SCAFFOLD')
    expect(payload.sessionCreditsUsed).toBe(3.5)
    expect(payload.recentMessages).toEqual(recentMessages)
    expect(payload.errors).toEqual(errors)
  })

  test('includes sessionCreditsUsed: 0 (not dropped)', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      sessionCreditsUsed: 0,
    })

    expect(payload.sessionCreditsUsed).toBe(0)
  })

  test('omits empty recentMessages', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      recentMessages: [],
    })

    expect(payload.recentMessages).toBeUndefined()
  })

  test('omits null errors', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      errors: null,
    })

    expect(payload.errors).toBeUndefined()
  })

  test('omits empty string agentMode', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      agentMode: '',
    })

    expect(payload.agentMode).toBeUndefined()
  })

  test('omits empty string completionTime from target', () => {
    const target = createMessage({
      id: 'msg-1',
      completionTime: '',
    })

    const payload = buildFeedbackPayload({
      ...baseParams,
      feedbackMessageId: 'msg-1',
      target,
    })

    expect(payload.completionTime).toBeUndefined()
  })

  test('truncates errors to schema limits', () => {
    const largeErrors = Array.from({ length: 60 }, (_, i) => ({
      id: 'e'.repeat(300),
      message: 'a'.repeat(3000),
    }))

    const payload = buildFeedbackPayload({
      ...baseParams,
      errors: largeErrors,
    })

    expect(payload.errors).toHaveLength(50)
    expect(payload.errors![0].message).toHaveLength(2000)
    expect(payload.errors![0].id).toHaveLength(200)
  })

  test('treats empty feedbackMessageId as general type', () => {
    const payload = buildFeedbackPayload({
      ...baseParams,
      feedbackMessageId: '',
    })

    expect(payload.type).toBe('general')
    expect(payload.messageId).toBeUndefined()
  })
})
