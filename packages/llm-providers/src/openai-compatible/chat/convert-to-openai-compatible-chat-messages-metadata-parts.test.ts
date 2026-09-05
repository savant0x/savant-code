// OpenAI-compatible chat message conversion — provider metadata on
// multi-part user messages and flattening behavior.
// Sibling of the Loop 323 decomposition (basic metadata merging lives in
// the metadata-basics sibling; assistant/tool-call metadata in
// metadata-assistant).

import { describe, it, expect } from 'bun:test'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'

describe('provider-specific metadata merging (multi-part)', () => {
  it('should handle a user message with multiple content parts (text + image)', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello from part 1',
            providerOptions: {
              openaiCompatible: { sentiment: 'positive' },
              leftoverKey: { foo: 'some leftover data' },
            },
          },
          {
            type: 'file',
            data: Buffer.from([0, 1, 2, 3]).toString('base64'),
            mediaType: 'image/png',
            providerOptions: {
              openaiCompatible: { alt_text: 'A sample image' },
            },
          },
        ],
        providerOptions: {
          openaiCompatible: { priority: 'high' },
        },
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        priority: 'high', // hoisted from message-level providerOptions
        content: [
          {
            type: 'text',
            text: 'Hello from part 1',
            sentiment: 'positive', // hoisted from part-level openaiCompatible
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,AAECAw==',
            },
            alt_text: 'A sample image',
          },
        ],
      },
    ])
  })

  it('should handle a user message with multiple text parts (flattening disabled)', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      },
    ])

    // Because there are multiple text parts, the converter won't flatten them
    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      },
    ])
  })

  it('should handle multiple content parts with multiple metadata layers', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'user',
        providerOptions: {
          openaiCompatible: { messageLevel: 'global-metadata' },
          leftoverForMessage: { x: 123 },
        },
        content: [
          {
            type: 'text',
            text: 'Part A',
            providerOptions: {
              openaiCompatible: { textPartLevel: 'localized' },
              leftoverForText: { info: 'text leftover' },
            },
          },
          {
            type: 'file',
            data: Buffer.from([9, 8, 7, 6]).toString('base64'),
            mediaType: 'image/png',
            providerOptions: {
              openaiCompatible: { imagePartLevel: 'image-data' },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'user',
        messageLevel: 'global-metadata',
        content: [
          {
            type: 'text',
            text: 'Part A',
            textPartLevel: 'localized',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,CQgHBg==',
            },
            imagePartLevel: 'image-data',
          },
        ],
      },
    ])
  })
})
