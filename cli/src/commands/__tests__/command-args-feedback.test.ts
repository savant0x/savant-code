import { describe, expect, mock, test } from 'bun:test'

import { useFeedbackStore } from '../../state/feedback-store'
import { COMMAND_REGISTRY } from '../command-registry'

import type { RouterParams } from '../command-registry'

// FID-2026-0819-005 Loop 175: feedback-command arg-handling suite split
// verbatim from command-args.test.ts; the createMockParams helper is copied
// verbatim so the file is self-contained.

const createMockParams = (
  overrides: Partial<RouterParams> = {},
): RouterParams =>
  ({
    abortControllerRef: { current: null },
    agentMode: 'HYBRID',
    inputRef: { current: null },
    inputValue: '/test',
    isChainInProgressRef: { current: false },
    isStreaming: false,
    logoutMutation: {} as RouterParams['logoutMutation'],
    streamMessageIdRef: { current: null },
    addToQueue: mock(() => {}),
    clearMessages: mock(() => {}),
    saveToHistory: mock(() => {}),
    scrollToLatest: mock(() => {}),
    sendMessage: mock(async () => {}),
    setCanProcessQueue: mock(() => {}),
    setInputFocused: mock(() => {}),
    setInputValue: mock(() => {}),
    setIsAuthenticated: mock(() => {}),
    setMessages: mock(() => {}),
    setUser: mock(() => {}),
    stopStreaming: mock(() => {}),
    ...overrides,
  }) as RouterParams

describe('command factory pattern', () => {
  describe('feedback command arg handling', () => {
    test('pre-populates feedback text when args are provided', () => {
      const feedbackCmd = COMMAND_REGISTRY.find((c) => c.name === 'feedback')
      expect(feedbackCmd).toBeDefined()

      // Reset the feedback store
      useFeedbackStore.getState().reset()

      const params = createMockParams({ inputValue: '/feedback my bug report' })
      feedbackCmd!.handler(params, 'my bug report')

      // Check that feedback text was pre-populated
      const state = useFeedbackStore.getState()
      expect(state.feedbackText).toBe('my bug report')
      expect(state.feedbackCursor).toBe('my bug report'.length)
    })

    test('opens feedback mode without pre-populating when no args', () => {
      const feedbackCmd = COMMAND_REGISTRY.find((c) => c.name === 'feedback')
      expect(feedbackCmd).toBeDefined()

      // Reset the feedback store
      useFeedbackStore.getState().reset()

      const params = createMockParams({ inputValue: '/feedback' })
      const result = feedbackCmd!.handler(params, '')

      // Should return openFeedbackMode
      expect(result).toEqual({ openFeedbackMode: true })

      // Feedback text should remain empty
      const state = useFeedbackStore.getState()
      expect(state.feedbackText).toBe('')
    })

    test('returns openFeedbackMode even with args', () => {
      const feedbackCmd = COMMAND_REGISTRY.find((c) => c.name === 'feedback')
      expect(feedbackCmd).toBeDefined()

      // Reset the feedback store
      useFeedbackStore.getState().reset()

      const params = createMockParams({ inputValue: '/feedback test' })
      const result = feedbackCmd!.handler(params, 'test')

      // Should still return openFeedbackMode
      expect(result).toEqual({ openFeedbackMode: true })
    })
  })
})
