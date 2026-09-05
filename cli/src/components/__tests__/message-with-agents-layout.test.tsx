// MessageWithAgents — callback invocation, layout across widths, and root
// message prefixes.
// Sibling of the Loop 331 decomposition (shared harness in
// message-with-agents-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { useMessageBlockStore } from '../../state/message-block-store'
import { MessageWithAgents } from '../message-with-agents'
import {
  createAiMessage,
  createUserMessage,
  defaultCallbacks,
  setupMessageWithAgentsTest,
} from './message-with-agents-test-harness'

setupMessageWithAgentsTest()

// =============================================================================
// Callback Integration Tests
// =============================================================================

describe('callback invocation', () => {
  test('callbacks are retrievable from store and callable', () => {
    let toggleCalledWith: string | undefined
    const mockToggle = (id: string) => {
      toggleCalledWith = id
    }

    useMessageBlockStore.getState().setCallbacks({
      ...defaultCallbacks,
      onToggleCollapsed: mockToggle,
    })

    // Verify callback is stored and retrievable
    const storedCallback =
      useMessageBlockStore.getState().callbacks.onToggleCollapsed
    storedCallback('test-message-id')

    expect(toggleCalledWith).toBe('test-message-id')
  })

  test('onFeedback callback receives messageId and options', () => {
    let feedbackMessageId: string | undefined
    let feedbackOptions: object | undefined
    const mockFeedback = (messageId: string, options?: object) => {
      feedbackMessageId = messageId
      feedbackOptions = options
    }

    useMessageBlockStore.getState().setCallbacks({
      ...defaultCallbacks,
      onFeedback: mockFeedback,
    })

    const storedCallback = useMessageBlockStore.getState().callbacks.onFeedback
    storedCallback('msg-123', { category: 'app_bug' })

    expect(feedbackMessageId).toBe('msg-123')
    expect(feedbackOptions).toEqual({ category: 'app_bug' })
  })
})

// =============================================================================
// Layout and visual structure tests
// =============================================================================

describe('layout handling', () => {
  test('renders correctly across different terminal widths', () => {
    const widths = [20, 80, 120, 300]

    for (const width of widths) {
      const message = createAiMessage(
        `width-${width}`,
        `Content at width ${width}`,
      )
      const markup = renderToStaticMarkup(
        <MessageWithAgents
          message={message}
          depth={0}
          isLastMessage={false}
          availableWidth={width}
        />,
      )
      expect(markup).toContain(`Content at width ${width}`)
    }
  })

  test('renders correctly with isLastMessage true and false', () => {
    const message = createAiMessage('last-msg-test', 'Test content')

    const lastMarkup = renderToStaticMarkup(
      <MessageWithAgents
        message={message}
        depth={0}
        isLastMessage={true}
        availableWidth={80}
      />,
    )

    const notLastMarkup = renderToStaticMarkup(
      <MessageWithAgents
        message={message}
        depth={0}
        isLastMessage={false}
        availableWidth={80}
      />,
    )

    expect(lastMarkup).toContain('Test content')
    expect(notLastMarkup).toContain('Test content')
  })
})

describe('root message prefixes', () => {
  test('renders standardized two-column prefixes for user and assistant messages', () => {
    const userMessage = createUserMessage('user-line', 'User content')
    const aiMessage = createAiMessage('ai-no-line', 'AI content')

    const userMarkup = renderToStaticMarkup(
      <MessageWithAgents
        message={userMessage}
        depth={0}
        isLastMessage={false}
        availableWidth={80}
      />,
    )

    const aiMarkup = renderToStaticMarkup(
      <MessageWithAgents
        message={aiMessage}
        depth={0}
        isLastMessage={false}
        availableWidth={80}
      />,
    )

    expect(userMarkup).toContain('&gt; ')
    expect(aiMarkup).toContain('◆ ')
    expect(userMarkup).toContain('width:2px')
    expect(aiMarkup).toContain('width:2px')
  })
})
