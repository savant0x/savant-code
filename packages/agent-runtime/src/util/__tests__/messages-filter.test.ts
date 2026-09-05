import {
  assistantMessage,
  jsonToolResult,
  systemMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { describe, expect, it } from 'bun:test'

import { filterUnfinishedToolCalls } from '../../util/messages'

import type { ToolCallPart } from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * Type guard to check if a content part is a tool-call part.
 */
function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'tool-call' &&
    'toolCallId' in part
  )
}

describe('filterUnfinishedToolCalls', () => {
  it('returns empty array when given empty messages', () => {
    const result = filterUnfinishedToolCalls([])
    expect(result).toEqual([])
  })

  it('keeps messages that are not assistant messages', () => {
    const messages: Message[] = [
      userMessage('Hello'),
      systemMessage('System prompt'),
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'tool-1',
        content: jsonToolResult({ files: [] }),
      },
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(3)
    expect(result).toEqual(messages)
  })

  it('keeps assistant messages with text content only', () => {
    const messages: Message[] = [
      userMessage('Hello'),
      assistantMessage('Hi there!'),
      userMessage('How are you?'),
      assistantMessage('I am doing well.'),
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(4)
    expect(result).toEqual(messages)
  })

  it('keeps tool calls that have corresponding tool responses', () => {
    const messages: Message[] = [
      userMessage('Read a file'),
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'read_files',
            input: { paths: ['test.ts'] },
          },
        ],
      },
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'call-1',
        content: jsonToolResult({ content: 'file content' }),
      },
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(3)
    expect(result[1].role).toBe('assistant')
    expect(result[1].content).toHaveLength(1)
    expect(result[1].content[0].type).toBe('tool-call')
  })

  it('removes tool calls that do not have corresponding tool responses', () => {
    const messages: Message[] = [
      userMessage('Read a file'),
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'read_files',
            input: { paths: ['test.ts'] },
          },
        ],
      },
      // No tool response for call-1
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(1) // Only the user message
    expect(result[0].role).toBe('user')
  })

  it('removes only unfinished tool calls from assistant messages with mixed content', () => {
    const messages: Message[] = [
      userMessage('Read files'),
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will read these files' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'read_files',
            input: { paths: ['file1.ts'] },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'read_files',
            input: { paths: ['file2.ts'] },
          },
        ],
      },
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'call-1',
        content: jsonToolResult({ content: 'file1 content' }),
      },
      // No tool response for call-2
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(3) // user, assistant (filtered), tool

    const assistantMsg = result[1]
    expect(assistantMsg.role).toBe('assistant')
    expect(assistantMsg.content).toHaveLength(2) // text + call-1 (call-2 removed)
    expect(assistantMsg.content[0].type).toBe('text')
    expect(assistantMsg.content[1].type).toBe('tool-call')
    const toolCallPart = assistantMsg.content[1]
    if (!isToolCallPart(toolCallPart))
      throw new Error('Expected tool-call part')
    expect(toolCallPart.toolCallId).toBe('call-1')
  })

  it('removes assistant message entirely if all content parts are unfinished tool calls', () => {
    const messages: Message[] = [
      userMessage('Do something'),
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'write_file',
            input: { path: 'test.ts', content: 'test' },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'read_files',
            input: { paths: ['other.ts'] },
          },
        ],
      },
      // No tool responses
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(1) // Only the user message
    expect(result[0].role).toBe('user')
  })

  it('handles multiple assistant messages with different tool call states', () => {
    const messages: Message[] = [
      userMessage('First request'),
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'read_files',
            input: { paths: ['file1.ts'] },
          },
        ],
      },
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'call-1',
        content: jsonToolResult({ content: 'content1' }),
      },
      userMessage('Second request'),
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'write_file',
            input: { path: 'test.ts', content: 'test' },
          },
        ],
      },
      // No tool response for call-2 (unfinished)
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(4) // user1, assistant1 (kept), tool1, user2
    expect(result[0].role).toBe('user')
    expect(result[1].role).toBe('assistant')
    expect(result[2].role).toBe('tool')
    expect(result[3].role).toBe('user')
  })

  it('preserves auxiliary message data on filtered assistant messages', () => {
    const messages: Message[] = [
      userMessage('Test'),
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Response' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'read_files',
            input: { paths: ['test.ts'] },
          },
        ],
        tags: ['important'],
        keepDuringTruncation: true,
      },
      // No tool response
    ]

    const result = filterUnfinishedToolCalls(messages)
    expect(result).toHaveLength(2)

    const assistantMsg = result[1]
    expect(assistantMsg.tags).toEqual(['important'])
    expect(assistantMsg.keepDuringTruncation).toBe(true)
    expect(assistantMsg.content).toHaveLength(1) // Only text, tool-call removed
  })
})
