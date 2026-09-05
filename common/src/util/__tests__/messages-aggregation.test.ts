// Messages test family — consecutive-message aggregation and the metadata
// that blocks it. Sibling of the Loop 320 decomposition.

import { describe, expect, it } from 'bun:test'

import {
  convertCbToModelMessages,
  systemMessage,
  userMessage,
  assistantMessage,
} from '../messages'

import type { Message } from '../../types/messages/savant-code-message'

describe('convertCbToModelMessages — message aggregation', () => {
  it('should aggregate consecutive system messages', () => {
    const messages: Message[] = [
      systemMessage({ content: 'First system message' }),
      systemMessage({ content: 'Second system message' }),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'system',
        content: 'First system message\n\nSecond system message',
      },
    ])
  })

  it('should aggregate consecutive user messages', () => {
    const messages: Message[] = [
      userMessage('First user message'),
      userMessage('Second user message'),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'First user message',
          },
          {
            type: 'text',
            text: 'Second user message',
          },
        ],
        sentAt: expect.any(Number),
      },
    ])
  })

  it('should aggregate consecutive assistant messages', () => {
    const messages: Message[] = [
      assistantMessage('First assistant message'),
      assistantMessage('Second assistant message'),
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'First assistant message',
          },
          {
            type: 'text',
            text: 'Second assistant message',
          },
        ],
        sentAt: expect.any(Number),
      },
    ])
  })

  it('should not aggregate messages with different timeToLive', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'First' }],
        timeToLive: 'agentStep',
      },

      {
        role: 'user',
        content: [{ type: 'text', text: 'Second' }],
        timeToLive: 'userPrompt',
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'First' }],
        timeToLive: 'agentStep',
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Second' }],
        timeToLive: 'userPrompt',
      },
    ])
  })

  it('should not aggregate messages with different providerOptions', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'First' }],
        providerOptions: { anthropic: { option1: 'value1' } },
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Second' }],
        providerOptions: { anthropic: { option1: 'value2' } },
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'First' }],
        providerOptions: { anthropic: { option1: 'value1' } },
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Second' }],
        providerOptions: { anthropic: { option1: 'value2' } },
      },
    ])
  })

  it('should not aggregate messages with different tags', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'First' }],
        tags: ['tag1'],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Second' }],
        tags: ['tag2'],
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'First' }],
        tags: ['tag1'],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Second' }],
        tags: ['tag2'],
      },
    ])
  })
})
