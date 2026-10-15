// Messages test family — cache-control placement before the
// LAST_ASSISTANT_MESSAGE / STEP_PROMPT tags and on the last message.
// Sibling of the Loop 320 decomposition.

import { describe, expect, test } from 'bun:test'

import {
  convertCbToModelMessages,
  systemMessage,
  userMessage,
  assistantMessage,
} from '../messages'

import type { Message } from '../../types/messages/savant-code-message'

describe('convertCbToModelMessages — cache control tag placement', () => {
  test('should add cache control before LAST_ASSISTANT_MESSAGE tag', () => {
    const messages: Message[] = [
      systemMessage('System'),
      userMessage('Context'),
      assistantMessage('Response'),
      userMessage('Instructions'),
      assistantMessage({
        content: 'Second response',
        tags: ['LAST_ASSISTANT_MESSAGE'],
      }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

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
            text: 'Instructions',
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
      expect.objectContaining({ role: 'assistant' }),
    ])
  })

  test('should add cache control before STEP_PROMPT tag', () => {
    const messages: Message[] = [
      systemMessage('System'),
      userMessage('Context'),
      assistantMessage('Response'),
      userMessage('More context'),
      userMessage({ content: 'Step', tags: ['STEP_PROMPT'] }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

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

  test('should add cache control to last message', () => {
    const messages: Message[] = [
      systemMessage('System'),
      userMessage('Context'),
      assistantMessage('Response'),
      userMessage('More context'),
      userMessage('User message'),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: true,
    })

    // Cache control is on content parts in the assistant message
    expect(result).toEqual([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user' }),
      expect.objectContaining({ role: 'assistant' }),
      {
        role: 'user',
        sentAt: expect.any(Number),
        content: [
          { type: 'text', text: 'More context' },
          {
            type: 'text',
            text: 'User message',
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
    ])
  })
})
