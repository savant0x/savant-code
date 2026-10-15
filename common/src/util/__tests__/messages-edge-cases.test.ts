// Messages test family — conversion edge cases: empty input, tool-call
// content, metadata preservation, and input immutability. Sibling of the
// Loop 320 decomposition.

import { describe, expect, it } from 'bun:test'
import { cloneDeep } from 'lodash'

import {
  convertCbToModelMessages,
  systemMessage,
  userMessage,
  assistantMessage,
} from '../messages'

import type { Message } from '../../types/messages/savant-code-message'

describe('convertCbToModelMessages — edge cases', () => {
  it('should handle empty messages array', () => {
    const result = convertCbToModelMessages({
      messages: [],
      includeCacheControl: false,
    })

    expect(result).toHaveLength(0)
  })

  it('should handle tool-call content in assistant messages', () => {
    const messages: Message[] = [
      assistantMessage({
        type: 'tool-call',
        toolCallId: 'call_123',
        toolName: 'test_tool',
        input: { param: 'value' },
      }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'assistant',
        sentAt: expect.any(Number),
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'test_tool',
            input: { param: 'value' },
          },
        ],
      },
    ])
  })

  it('should preserve message metadata during conversion', () => {
    const messages: Message[] = [
      userMessage({
        content: 'Test',
        tags: ['custom_tag'],
        timeToLive: 'agentStep',
        providerOptions: { anthropic: { someOption: 'value' } },
      }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    const resultMessage = result[0] as {
      tags?: string[]
      timeToLive?: string
      providerOptions?: Record<string, { someOption?: string }>
    }
    expect(resultMessage.tags).toEqual(['custom_tag'])
    expect(resultMessage.timeToLive).toBe('agentStep')
    expect(resultMessage.providerOptions?.anthropic?.someOption).toBe('value')
  })

  it('should not mutate original messages', () => {
    const originalMessages: Message[] = [
      systemMessage('Original'),
      userMessage('User message'),
    ]
    const messagesCopy = cloneDeep(originalMessages)

    convertCbToModelMessages({
      messages: originalMessages,
      includeCacheControl: true,
    })

    expect(originalMessages).toEqual(messagesCopy)
  })
})
