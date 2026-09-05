// MessageWithAgents component — rendering behavior across message variants.
// Sibling of the Loop 331 decomposition (shared harness in
// message-with-agents-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageWithAgents } from '../message-with-agents'
import {
  baseMessageWithAgentsProps,
  createAgentMessage,
  createAiMessage,
  createErrorMessage,
  createMalformedAgentMessage,
  createModeDividerMessage,
  createUserMessage,
  setupMessageWithAgentsTest,
} from './message-with-agents-test-harness'

setupMessageWithAgentsTest()

describe('MessageWithAgents', () => {
  describe('message variant rendering', () => {
    test('renders user message content', () => {
      const message = createUserMessage('user-1', 'Hello from user')

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      expect(markup).toContain('Hello from user')
    })

    test('renders AI message content', () => {
      const message = createAiMessage('ai-1', 'Hello from AI')

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      expect(markup).toContain('Hello from AI')
    })

    test('renders error message content', () => {
      const message = createErrorMessage('error-1', 'An error occurred')

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      expect(markup).toContain('An error occurred')
    })

    test('renders agent message with agent name displayed', () => {
      const message = createAgentMessage(
        'agent-1',
        'Agent response',
        'Code Searcher',
      )

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      expect(markup).toContain('Code Searcher')
      expect(markup).toContain('Agent response')
    })

    test('handles message with markdown content', () => {
      const message = createAiMessage('ai-md', '**Bold** and *italic*')

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      // Content should be present (markdown rendering may transform it)
      expect(markup).toContain('Bold')
      expect(markup).toContain('italic')
    })

    test('handles empty content without crashing', () => {
      const message = createAiMessage('ai-empty', '')

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      expect(markup).toBeDefined()
    })
  })

  describe('mode divider block rendering', () => {
    test('renders ModeDivider when message contains only a mode-divider block and ignores content', () => {
      const message = createModeDividerMessage('mode-1', 'Edit Mode')

      const markup = renderToStaticMarkup(
        <MessageWithAgents {...baseMessageWithAgentsProps} message={message} />,
      )

      // Mode text should appear
      expect(markup).toContain('Edit Mode')
      // Original message content should not be rendered
      expect(markup).not.toContain('this content should be ignored')
    })
  })

  describe('error handling', () => {
    test('shows error message when agent message is missing agent info', () => {
      const malformedMessage = createMalformedAgentMessage(
        'bad-agent',
        'This should fail',
      )

      const markup = renderToStaticMarkup(
        <MessageWithAgents
          {...baseMessageWithAgentsProps}
          message={malformedMessage}
        />,
      )

      expect(markup).toContain('Error')
      expect(markup).toContain('Missing agent info')
    })
  })

  describe('collapsed vs expanded agent state', () => {
    test('renders collapsed agent with preview and collapsed indicator', () => {
      const collapsedMessage = createAgentMessage(
        'collapsed-agent',
        'This is the full content\nwith multiple lines\nand the last line is shown',
        'Collapsed Agent',
        {
          metadata: { isCollapsed: true },
        },
      )

      const markup = renderToStaticMarkup(
        <MessageWithAgents
          {...baseMessageWithAgentsProps}
          message={collapsedMessage}
        />,
      )

      expect(markup).toContain('Collapsed Agent')
      // When collapsed, should show the collapsed indicator
      expect(markup).toContain('▸')
      // Preview should be the last line
      expect(markup).toContain('and the last line is shown')
      // First line of full content should not be present as a full block
      expect(markup).not.toContain('This is the full content')
    })

    test('renders expanded agent with full content and expanded indicator', () => {
      const expandedMessage = createAgentMessage(
        'expanded-agent',
        'Full expanded content here',
        'Expanded Agent',
        {
          metadata: { isCollapsed: false },
        },
      )

      const markup = renderToStaticMarkup(
        <MessageWithAgents
          {...baseMessageWithAgentsProps}
          message={expandedMessage}
        />,
      )

      expect(markup).toContain('Expanded Agent')
      expect(markup).toContain('Full expanded content here')
      // When expanded, should show the expanded indicator
      expect(markup).toContain('▾')
    })
  })
})
