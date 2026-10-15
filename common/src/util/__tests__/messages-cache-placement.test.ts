// Messages test family — cache-control placement relative to tagged prompt
// boundaries. Sibling of the Loop 320 decomposition.

import { describe, expect, it, test } from 'bun:test'

import {
  convertCbToModelMessages,
  systemMessage,
  userMessage,
  assistantMessage,
} from '../messages'

import type { Message } from '../../types/messages/savant-code-message'

describe('convertCbToModelMessages — cache control', () => {
  // Note: Cache control is applied to content parts within messages, not to the messages themselves.
  // The implementation splits text content and adds cache control to specific parts based on tagged prompts.
  test('should add cache control when includeCacheControl is true', () => {
    const messages: Message[] = [
      systemMessage('System message'),
      userMessage('Context message'),
      assistantMessage('Response'),
      userMessage({
        content: 'User message',
        tags: ['USER_PROMPT'],
      }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

    // Cache control is on content parts of the assistant message (result[2])
    if (typeof result[2].content !== 'string' && result[2].content.length > 0) {
      const lastContentPart = result[2].content[
        result[2].content.length - 1
      ] as { providerOptions?: Record<string, unknown> }
      expect(
        (
          lastContentPart.providerOptions?.anthropic as
            { cache_control?: unknown } | undefined
        )?.cache_control,
      ).toEqual({
        type: 'ephemeral',
      })
    }
  })

  it('should not add cache control when includeCacheControl is false', () => {
    const messages: Message[] = [
      systemMessage('System message'),
      userMessage({
        content: 'User message',
        tags: ['USER_PROMPT'],
      }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result[0].providerOptions).toBeUndefined()
  })

  test('should add cache control before USER_PROMPT tag', () => {
    const messages: Message[] = [
      systemMessage('System'),
      userMessage('Context'),
      assistantMessage('Response'),
      userMessage('More context'),
      userMessage({
        content: 'User prompt',
        tags: ['USER_PROMPT'],
      }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

    // Cache control should be on content part before USER_PROMPT
    expect(result).toEqual([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user' }),
      expect.objectContaining({ role: 'assistant' }),
      {
        role: 'user',
        sentAt: expect.any(Number),
        content: [
          {
            type: 'text',
            text: 'More context',
            providerOptions: expect.objectContaining({
              openaiCompatible: {
                cache_control: {
                  type: 'ephemeral',
                },
              },
            }),
          },
        ],
      },
      expect.objectContaining({ role: 'user' }),
    ])
  })

  test('should handle system messages with cache control', () => {
    const messages: Message[] = [
      systemMessage('Long system prompt'),
      userMessage({ content: 'User', tags: ['USER_PROMPT'] }),
      assistantMessage('Response'),
      userMessage('User 2'),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

    expect(result).toEqual([
      {
        role: 'system',
        content: 'Long system prompt',
        providerOptions: expect.objectContaining({
          openaiCompatible: {
            cache_control: {
              type: 'ephemeral',
            },
          },
        }),
      },
      expect.objectContaining({ role: 'user' }),
      expect.objectContaining({ role: 'assistant' }),
      expect.objectContaining({ role: 'user' }),
    ])
  })

  it('should handle array content with cache control on non-text parts', () => {
    const messages: Message[] = [
      systemMessage('System'),
      userMessage([
        { type: 'text', text: 'Context' },
        { type: 'file', data: 'base64', mediaType: 'image/png' },
      ]),
      userMessage({ content: 'Next', tags: ['USER_PROMPT'] }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

    // Should add cache control to the file part (last non-text part)
    expect(result).toEqual([
      expect.objectContaining({ role: 'system' }),
      {
        role: 'user',
        sentAt: expect.any(Number),
        content: [
          {
            type: 'text',
            text: 'Context',
          },
          {
            type: 'file',
            data: 'base64',
            mediaType: 'image/png',
            providerOptions: expect.objectContaining({
              openaiCompatible: {
                cache_control: {
                  type: 'ephemeral',
                },
              },
            }),
          },
        ],
      },
      expect.objectContaining({ role: 'user' }),
    ])
  })

  it('should handle very short text content when finding cache control location', () => {
    const messages: Message[] = [
      systemMessage('System'),
      userMessage([
        { type: 'text', text: 'Longer text' },
        { type: 'text', text: 'X' }, // Short
      ]),
      userMessage({ content: 'Next', tags: ['USER_PROMPT'] }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

    expect(result).toEqual([
      expect.objectContaining({ role: 'system' }),
      {
        role: 'user',
        sentAt: expect.any(Number),
        content: [
          { type: 'text', text: 'Longer text' },
          {
            type: 'text',
            text: 'X',
            providerOptions: expect.objectContaining({
              openaiCompatible: {
                cache_control: {
                  type: 'ephemeral',
                },
              },
            }),
          },
        ],
      },
      expect.objectContaining({ role: 'user' }),
    ])
  })
})
