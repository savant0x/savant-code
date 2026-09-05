// OpenAI-compatible chat message conversion — provider metadata: system,
// user, tool-call, and image metadata merging.
// Sibling of the Loop 323 decomposition (multi-part and assistant/tool
// metadata cases live in sibling files).

import { describe, it, expect } from 'bun:test'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'

describe('provider-specific metadata merging', () => {
  it('should merge system message metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'system',
        content: 'You are a helpful assistant.',
        providerOptions: {
          openaiCompatible: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ])

    expect(result).toEqual([
      {
        role: 'system',
        content: 'You are a helpful assistant.',
        cacheControl: { type: 'ephemeral' },
      },
    ])
  })

  it('should merge user message content metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cacheControl: { type: 'ephemeral' },
          },
        ],
      },
    ])
  })

  it('should keep both content-level and message-level metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        providerOptions: {
          openaiCompatible: {
            messageLevel: true,
          },
        },
        content: [
          {
            type: 'text',
            text: 'Hello',
            providerOptions: {
              openaiCompatible: {
                contentLevel: true,
              },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello', contentLevel: true }],
        messageLevel: true,
      },
    ])
  })

  it('should handle tool calls with metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'calculator',
            input: { x: 1, y: 2 },
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call1',
            type: 'function',
            function: {
              name: 'calculator',
              arguments: JSON.stringify({ x: 1, y: 2 }),
            },
            cacheControl: { type: 'ephemeral' },
          },
        ],
      },
    ])
  })

  it('should handle image content with metadata', async () => {
    const imageUrl = new URL('https://example.com/image.jpg')
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: imageUrl,
            mediaType: 'image/*',
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl.toString() },
            cacheControl: { type: 'ephemeral' },
          },
        ],
      },
    ])
  })

  it('should omit non-openaiCompatible metadata', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'system',
        content: 'Hello',
        providerOptions: {
          someOtherProvider: {
            shouldBeIgnored: true,
          },
        },
      },
    ])

    expect(result).toEqual([
      {
        role: 'system',
        content: 'Hello',
      },
    ])
  })
})
