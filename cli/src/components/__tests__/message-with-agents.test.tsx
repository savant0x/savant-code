// MessageBlockStore — store behavior, not JS built-ins.
// Parent of the Loop 331 decomposition (component rendering, callbacks,
// layout, and prefix suites live in sibling files; shared harness in
// message-with-agents-test-harness).

import { describe, expect, test } from 'bun:test'

import {
  createAgentMessage,
  defaultCallbacks,
  initializeStore,
  setupMessageWithAgentsTest,
  theme,
} from './message-with-agents-test-harness'
import { useMessageBlockStore } from '../../state/message-block-store'

import type { ChatMessage } from '../../types/chat'

setupMessageWithAgentsTest()

describe('MessageBlockStore', () => {
  describe('setContext', () => {
    test('performs partial merge, preserving unspecified values', () => {
      // Set initial state with specific values
      initializeStore({
        isWaitingForResponse: true,
        timerStartTime: 12345,
        availableWidth: 100,
      })

      // Update only one value
      useMessageBlockStore.getState().setContext({
        isWaitingForResponse: false,
      })

      const state = useMessageBlockStore.getState()
      // Updated value should change
      expect(state.context.isWaitingForResponse).toBe(false)
      // Other values should be preserved
      expect(state.context.timerStartTime).toBe(12345)
      expect(state.context.availableWidth).toBe(100)
      expect(state.context.theme).toBe(theme)
    })

    test('updates messageTree without affecting other context values', () => {
      const child1 = createAgentMessage('child-1', 'Content 1', 'Agent One')
      const child2 = createAgentMessage('child-2', 'Content 2', 'Agent Two')
      const newTree = new Map<string, ChatMessage[]>([
        ['parent-1', [child1, child2]],
      ])

      useMessageBlockStore.getState().setContext({
        messageTree: newTree,
      })

      const state = useMessageBlockStore.getState()
      expect(state.context.messageTree).toBe(newTree)
      expect(state.context.messageTree?.get('parent-1')).toHaveLength(2)
      // Theme should be unchanged
      expect(state.context.theme).toBe(theme)
    })

    test('can update multiple context values at once', () => {
      useMessageBlockStore.getState().setContext({
        isWaitingForResponse: true,
        timerStartTime: 99999,
        availableWidth: 200,
      })

      const state = useMessageBlockStore.getState()
      expect(state.context.isWaitingForResponse).toBe(true)
      expect(state.context.timerStartTime).toBe(99999)
      expect(state.context.availableWidth).toBe(200)
    })
  })

  describe('setCallbacks', () => {
    test('replaces entire callbacks object', () => {
      const mockToggle = () => {}
      const mockBuildFast = () => {}
      const mockBuildMax = () => {}
      const mockBuildFree = () => {}
      const mockFeedback = () => {}
      const mockCloseFeedback = () => {}

      useMessageBlockStore.getState().setCallbacks({
        onToggleCollapsed: mockToggle,
        onBuildFast: mockBuildFast,
        onBuildMax: mockBuildMax,
        onBuildLite: mockBuildFree,
        onFeedback: mockFeedback,
        onCloseFeedback: mockCloseFeedback,
        onAdClick: () => {},
        onAdImpression: () => {},
        onResponseAdsNeeded: () => {},
      })

      const state = useMessageBlockStore.getState()
      expect(state.callbacks.onToggleCollapsed).toBe(mockToggle)
      expect(state.callbacks.onBuildFast).toBe(mockBuildFast)
      expect(state.callbacks.onBuildMax).toBe(mockBuildMax)
      expect(state.callbacks.onBuildLite).toBe(mockBuildFree)
      expect(state.callbacks.onFeedback).toBe(mockFeedback)
      expect(state.callbacks.onCloseFeedback).toBe(mockCloseFeedback)
    })

    test('callbacks are independent from context', () => {
      const originalTheme = useMessageBlockStore.getState().context.theme

      useMessageBlockStore.getState().setCallbacks({
        ...defaultCallbacks,
        onToggleCollapsed: () => console.log('new toggle'),
      })

      // Context should be unchanged
      expect(useMessageBlockStore.getState().context.theme).toBe(originalTheme)
    })
  })

  describe('reset', () => {
    test('restores context to initial state', () => {
      // Modify state significantly
      useMessageBlockStore.getState().setContext({
        isWaitingForResponse: true,
        timerStartTime: 12345,
        availableWidth: 200,
        messageTree: new Map([['key', [createAgentMessage('a', 'b', 'c')]]]),
      })

      useMessageBlockStore.getState().reset()

      const state = useMessageBlockStore.getState()
      expect(state.context.theme).toBeNull()
      expect(state.context.isWaitingForResponse).toBe(false)
      expect(state.context.timerStartTime).toBeNull()
      expect(state.context.availableWidth).toBe(80)
    })

    test('restores callbacks to noop functions', () => {
      const mockFn = () => console.log('test')
      useMessageBlockStore.getState().setCallbacks({
        onToggleCollapsed: mockFn,
        onBuildFast: mockFn,
        onBuildMax: mockFn,
        onBuildLite: mockFn,
        onFeedback: mockFn,
        onCloseFeedback: mockFn,
        onAdClick: mockFn,
        onAdImpression: mockFn,
        onResponseAdsNeeded: mockFn,
      })

      useMessageBlockStore.getState().reset()

      const state = useMessageBlockStore.getState()
      // Callbacks should be noop functions (not undefined)
      expect(typeof state.callbacks.onToggleCollapsed).toBe('function')
      expect(typeof state.callbacks.onBuildFast).toBe('function')
      expect(typeof state.callbacks.onBuildLite).toBe('function')
      // They should not throw when called
      expect(() => state.callbacks.onToggleCollapsed('test-id')).not.toThrow()
    })
  })
})
