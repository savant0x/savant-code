import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { trimMessagesToFitTokenLimit } from '../../util/messages'
import * as tokenCounter from '../token-counter'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

// Mock logger for tests
const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

describe('trimMessagesToFitTokenLimit', () => {
  beforeEach(() => {
    // Mock countTokensJson to just count characters
    spyOn(tokenCounter, 'countTokensJson').mockImplementation((text) => {
      // Make token count high enough to trigger simplification
      return JSON.stringify(text).length
    })
  })

  afterEach(() => {
    mock.restore()
  })

  describe('keepDuringTruncation functionality', () => {
    it('preserves messages marked with keepDuringTruncation=true', () => {
      const messages: Message[] = [
        userMessage(
          'A'.repeat(500), // Large message to force truncation
        ),
        userMessage(
          'B'.repeat(500), // Large message to force truncation
        ),
        userMessage({
          content: 'Message 3 - keep me!',
          keepDuringTruncation: true,
        }),
        assistantMessage('C'.repeat(500)),
        userMessage({
          content: 'Message 5 - keep me too!',
          keepDuringTruncation: true,
        }),
      ]

      const result = trimMessagesToFitTokenLimit({
        messages,
        systemTokens: 0,
        // Below the messages' structured token total so truncation triggers.
        maxTotalTokens: 300,
        logger,
      })

      // Should contain the kept messages
      const keptMessages = result.filter(
        (msg) =>
          msg.content[0].type === 'text' &&
          (msg.content[0].text.includes('keep me!') ||
            msg.content[0].text.includes('keep me too!')),
      )
      expect(keptMessages).toHaveLength(2)

      // Should have replacement message for omitted content
      const hasReplacementMessage = result.some(
        (msg) =>
          msg.content[0].type === 'text' &&
          msg.content[0].text.includes(
            'Previous message(s) omitted due to length',
          ),
      )
      expect(hasReplacementMessage).toBe(true)
    })

    it('does not add replacement message when no messages are removed', () => {
      const messages = [
        userMessage('Short message 1'),
        userMessage({
          content: 'Short message 2',
          keepDuringTruncation: true,
        }),
      ]

      const result = trimMessagesToFitTokenLimit({
        messages,
        systemTokens: 0,
        maxTotalTokens: 10000,
        logger,
      })

      // Should be unchanged when under token limit
      expect(result).toHaveLength(2)
      expect(
        result[0].content[0].type === 'text' && result[0].content[0].text,
      ).toBe('Short message 1')
      expect(
        result[1].content[0].type === 'text' && result[1].content[0].text,
      ).toBe('Short message 2')
    })

    it('handles consecutive replacement messages correctly', () => {
      const messages: Message[] = [
        userMessage('A'.repeat(1000)), // Large message to be removed
        userMessage('B'.repeat(1000)), // Large message to be removed
        userMessage('C'.repeat(1000)), // Large message to be removed
        userMessage({ content: 'Keep this', keepDuringTruncation: true }),
      ]

      const result = trimMessagesToFitTokenLimit({
        messages,
        systemTokens: 0,
        // Below the messages' structured token total so truncation triggers.
        maxTotalTokens: 500,
        logger,
      })

      // Should only have one replacement message for consecutive removals
      const replacementMessages = result.filter(
        (msg) =>
          msg.content[0].type === 'text' &&
          msg.content[0].text.includes(
            'Previous message(s) omitted due to length',
          ),
      )
      expect(replacementMessages).toHaveLength(1)

      // Should keep the marked message
      const keptMessage = result.find(
        (msg) =>
          msg.content[0].type === 'text' &&
          msg.content[0].text.includes('Keep this'),
      )
      expect(keptMessage).toBeDefined()
    })

    it('calculates token removal correctly with keepDuringTruncation', () => {
      const messages: Message[] = [
        userMessage('A'.repeat(500)), // Will be removed
        userMessage('B'.repeat(500)), // Will be removed
        userMessage({
          content: 'Keep this short message',
          keepDuringTruncation: true,
        }),
        userMessage('C'.repeat(100)), // Might be kept
      ]

      const result = trimMessagesToFitTokenLimit({
        messages,
        systemTokens: 0,
        maxTotalTokens: 2000,
        logger,
      })

      // Should preserve the keepDuringTruncation message
      const keptMessage = result.find(
        (msg) =>
          msg.content[0].type === 'text' &&
          msg.content[0].text.includes('Keep this short message'),
      )
      expect(keptMessage).toBeDefined()

      // Total tokens should be under limit
      const finalTokens = tokenCounter.countTokensJson(
        result as unknown as JSONValue,
      )
      expect(finalTokens).toBeLessThan(2000)
    })

    it('handles mixed keepDuringTruncation and regular messages', () => {
      const messages: Message[] = [
        userMessage('A'.repeat(800)), // Large message to force truncation
        userMessage({ content: 'Keep 1', keepDuringTruncation: true }),
        userMessage('B'.repeat(800)), // Large message to force truncation
        userMessage({ content: 'Keep 2', keepDuringTruncation: true }),
        userMessage('C'.repeat(800)), // Large message to force truncation
      ]

      const result = trimMessagesToFitTokenLimit({
        messages,
        systemTokens: 0,
        maxTotalTokens: 500,
        logger,
      })

      // Should keep both marked messages
      const keptMessages = result.filter(
        (msg) =>
          msg.content[0].type === 'text' &&
          (msg.content[0].text.includes('Keep 1') ||
            msg.content[0].text.includes('Keep 2')),
      )
      expect(keptMessages).toHaveLength(2)

      // Should have replacement messages for removed content
      const replacementMessages = result.filter(
        (msg) =>
          msg.content[0].type === 'text' &&
          msg.content[0].text.includes(
            'Previous message(s) omitted due to length',
          ),
      )
      expect(replacementMessages.length).toBeGreaterThan(0)
    })
  })
})
