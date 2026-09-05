// Messages test family — convertCbToModelMessages basic conversion: role
// coercion, string-content fallbacks, and surrogate sanitization. Sibling of
// the Loop 320 decomposition (tool-result shapes have their own module).

import { describe, expect, it } from 'bun:test'

import {
  convertCbToModelMessages,
  systemMessage,
  userMessage,
  jsonToolResult,
} from '../messages'

import type { Message } from '../../types/messages/savant-code-message'

describe('convertCbToModelMessages — basic message conversion', () => {
  it('should convert system messages', () => {
    const messages: Message[] = [systemMessage('You are a helpful assistant')]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'system',
        content: 'You are a helpful assistant',
      },
    ])
  })

  it('should coerce string system message content to text', () => {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant',
      },
    ] as unknown as Message[]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'system',
        content: 'You are a helpful assistant',
      },
    ])
  })

  it('should coerce string user message content to text parts', () => {
    const messages = [
      {
        role: 'user' as const,
        content: 'Hello from the user',
      },
    ] as unknown as Message[]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello from the user' }],
      },
    ])
  })

  it('should coerce string assistant message content to text parts', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'Hello from the assistant',
      },
    ] as unknown as Message[]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from the assistant' }],
      },
    ])
  })

  it('should fall back to empty string for invalid system content', () => {
    const messages = [
      {
        role: 'system' as const,
        content: null,
      },
    ] as unknown as Message[]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'system',
        content: '',
      },
    ])
  })

  it('should fall back to empty content for invalid user content', () => {
    const messages = [
      {
        role: 'user' as const,
        content: null,
      },
    ] as unknown as Message[]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      {
        role: 'user',
        content: [],
      },
    ])
  })

  it('should convert user messages with array content', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
        ],
      },
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
            text: 'First part',
          },
          {
            type: 'text',
            text: 'Second part',
          },
        ],
      },
    ])
  })
})

describe('convertCbToModelMessages — lone surrogate sanitization', () => {
  // A lone (unpaired) UTF-16 surrogate — e.g. produced by slicing a file read
  // in the middle of an emoji — serializes to a syntactically-valid \uXXXX
  // escape that JS JSON.parse accepts but strict server-side parsers
  // (serde_json) reject with "unexpected end of hex escape", fatally aborting
  // the agent on every subsequent request. The converter must neutralize it.
  const LONE_HIGH = '\uD83D' // high surrogate of 😀 with the low half dropped
  const REPLACEMENT = '\uFFFD'

  const assertWellFormed = <T>(value: T): void => {
    const json = JSON.stringify(value)
    // matchAll over lone surrogates: there should be none left.
    const lone = json.match(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    )
    expect(lone).toBeNull()
  }

  it('sanitizes a lone surrogate in a user text part', () => {
    const result = convertCbToModelMessages({
      messages: [userMessage(`hello ${LONE_HIGH} world`)],
      includeCacheControl: false,
    })
    assertWellFormed(result)
    expect(JSON.stringify(result)).toContain(`hello ${REPLACEMENT} world`)
  })

  it('sanitizes a lone surrogate nested in a tool result value', () => {
    const result = convertCbToModelMessages({
      messages: [
        {
          role: 'tool',
          toolName: 'read_files',
          toolCallId: 'call_1',
          content: jsonToolResult([
            { path: 'big.ts', content: `truncated${LONE_HIGH}` },
          ]),
        },
      ],
      includeCacheControl: false,
    })
    assertWellFormed(result)
  })

  it('sanitizes a lone surrogate in a system message string', () => {
    const result = convertCbToModelMessages({
      messages: [systemMessage(`prompt ${LONE_HIGH}`)],
      includeCacheControl: false,
    })
    assertWellFormed(result)
  })

  it('leaves valid surrogate pairs (emoji) intact', () => {
    const result = convertCbToModelMessages({
      messages: [userMessage('keep the \u{1F600} emoji')],
      includeCacheControl: false,
    })
    assertWellFormed(result)
    expect(JSON.stringify(result)).toContain('keep the \u{1F600} emoji')
  })
})
