// OpenAI-compatible chat message conversion — user messages.
// Parent of the Loop 323 decomposition (tool-call, metadata, and
// consecutive-assistant suites live in sibling files).

import { describe, it, expect } from 'bun:test'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'

describe('user messages', () => {
  it('should keep messages with only a text part', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ])

    expect(result).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ])
  })

  it('should convert messages with image parts', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: Buffer.from([0, 1, 2, 3]).toString('base64'),
            mediaType: 'image/png',
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ])
  })

  it('should convert messages with image parts from Uint8Array', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hi' },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'image/png',
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hi' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ])
  })

  it('should handle URL-based images', async () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new URL('https://example.com/image.jpg'),
            mediaType: 'image/*',
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
            image_url: { url: 'https://example.com/image.jpg' },
          },
        ],
      },
    ])
  })
})
