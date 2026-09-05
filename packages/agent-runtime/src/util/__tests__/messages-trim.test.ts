import {
  assistantMessage,
  jsonToolResult,
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

  const testMessages: Message[] = [
    // Regular message without tool calls - should never be shortened, but won't fit in the final array
    assistantMessage(
      'This is a long assistant message that would normally be shortened but since it has no tool calls it should be preserved completely intact no matter what',
    ),
    // Regular message without tool calls - should never be shortened
    userMessage(
      'This is a long message that would normally be shortened but since it has no tool calls it should be preserved completely intact no matter what',
    ),
    {
      // Terminal output 0 (oldest) - should be simplified

      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-0',
      content: jsonToolResult(`Terminal output 0${'.'.repeat(2000)}`),
    },
    {
      // Terminal output 1 - should be preserved (shorter than '[Output omitted]')
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-1',
      content: jsonToolResult(`Short output 1`),
    },
    {
      // Terminal output 2 - should be simplified
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-2',
      content: jsonToolResult(`Terminal output 2${'.'.repeat(2000)}`),
    },
    {
      // Terminal output 3 - should be preserved (5th most recent)
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-3',
      content: jsonToolResult(`Terminal output 3`),
    },
    {
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-4',
      content: jsonToolResult(`Terminal output 4`),
    },
    // Regular message - should never be shortened
    userMessage({
      type: 'image',
      image: 'xyz',
      mediaType: 'image/jpeg',
    }),
    {
      // Terminal output 5 - should be preserved (3rd most recent)
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-5',
      content: jsonToolResult(`Terminal output 5`),
    },
    {
      // Terminal output 6 - should be preserved (2nd most recent)
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-6',
      content: jsonToolResult(`Terminal output 6`),
    },
    {
      // Terminal output 7 - should be preserved (most recent)
      role: 'tool',
      toolName: 'run_terminal_command',
      toolCallId: 'test-id-7',
      content: jsonToolResult(`Terminal output 7`),
    },
    // Regular message - should never be shortened
    assistantMessage(
      'Another long message that should never be shortened because it has no tool calls in it at all',
    ),
  ]

  it('handles all features working together correctly', () => {
    const maxTotalTokens = 3000
    const systemTokens = 0
    const result = trimMessagesToFitTokenLimit({
      messages: testMessages,
      systemTokens,
      maxTotalTokens,
      logger,
    })

    // Should have replacement message for omitted content
    expect(result.length).toBeGreaterThan(0)

    // Should contain a replacement message for omitted content
    const hasReplacementMessage = result.some(
      (msg) =>
        msg.content[0].type === 'text' &&
        msg.content[0].text.includes(
          'Previous message(s) omitted due to length',
        ),
    )
    expect(hasReplacementMessage).toBe(true)

    // Verify total tokens are under limit
    const finalTokens = tokenCounter.countTokensJson(
      result as unknown as JSONValue,
    )
    expect(finalTokens).toBeLessThan((maxTotalTokens - systemTokens) * 0.5)
  })

  it('subtracts system tokens from total tokens', () => {
    const maxTotalTokens = 10_000
    const systemTokens = 7_000
    const result = trimMessagesToFitTokenLimit({
      messages: testMessages,
      systemTokens,
      maxTotalTokens,
      logger,
    })

    // Should have replacement message for omitted content
    expect(result.length).toBeGreaterThan(0)

    // Should contain a replacement message for omitted content
    const hasReplacementMessage = result.some(
      (msg) =>
        msg.content[0].type === 'text' &&
        msg.content[0].text.includes(
          'Previous message(s) omitted due to length',
        ),
    )
    expect(hasReplacementMessage).toBe(true)

    // Verify total tokens are under limit
    const finalTokens = tokenCounter.countTokensJson(
      result as unknown as JSONValue,
    )
    expect(finalTokens).toBeLessThan((maxTotalTokens - systemTokens) * 0.5)
  })

  it('does not simplify if under token limit', () => {
    const maxTotalTokens = 10_000
    const systemTokens = 100
    const result = trimMessagesToFitTokenLimit({
      messages: testMessages,
      systemTokens,
      maxTotalTokens,
      logger,
    })

    // All messages should be unchanged
    expect(result).toHaveLength(testMessages.length)
    for (let i = 0; i < testMessages.length; i++) {
      expect(result[i].role).toEqual(testMessages[i].role)
      expect(result[i].content).toEqual(testMessages[i].content)
    }

    // Verify total tokens are under limit
    const finalTokens = tokenCounter.countTokensJson(
      result as unknown as JSONValue,
    )
    expect(finalTokens).toBeLessThan(maxTotalTokens - systemTokens)
  })

  it('handles empty messages array', () => {
    const maxTotalTokens = 200
    const systemTokens = 100
    const result = trimMessagesToFitTokenLimit({
      messages: [],
      systemTokens,
      maxTotalTokens,
      logger,
    })

    expect(result).toEqual([])
  })
})
