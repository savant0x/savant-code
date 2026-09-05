// Messages test family — convertCbToModelMessages tool-result shapes:
// JSON output, media output, empty content, string coercion, aggregation.
// Sibling of the Loop 320 decomposition.

import { describe, expect, it } from 'bun:test'

import {
  convertCbToModelMessages,
  jsonToolResult,
  mediaToolResult,
} from '../messages'

import type { Message } from '../../types/messages/savant-code-message'
import type { ToolResultPart } from 'ai'

describe('convertCbToModelMessages — tool message conversion', () => {
  it('should convert tool messages with JSON output', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'test_tool',
        toolCallId: 'call_123',
        content: jsonToolResult({ result: 'success' }),
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      expect.objectContaining({
        role: 'tool',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'test_tool',
            output: { type: 'json', value: { result: 'success' } },
          } satisfies ToolResultPart),
        ],
      }),
    ])
  })

  it('should convert tool messages with media output', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'test_tool',
        toolCallId: 'call_123',
        content: mediaToolResult({
          data: 'base64data',
          mediaType: 'image/png',
        }),
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      expect.objectContaining({
        role: 'user',
        content: [
          expect.objectContaining({
            type: 'file',
          }),
        ],
      }),
    ])
  })

  it('should convert tool messages with empty content', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'scraper_page_to_markdown',
        toolCallId: 'call_empty',
        content: [],
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      expect.objectContaining({
        role: 'tool',
        toolCallId: 'call_empty',
        toolName: 'scraper_page_to_markdown',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'call_empty',
            toolName: 'scraper_page_to_markdown',
            output: { type: 'json', value: '' },
          } satisfies ToolResultPart),
        ],
      }),
    ])
  })

  it('should coerce string tool content into a json tool result', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'call_compact',
        content: '[compacted]' as unknown as never,
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    expect(result).toEqual([
      expect.objectContaining({
        role: 'tool',
        toolCallId: 'call_compact',
        toolName: 'read_files',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'call_compact',
            toolName: 'read_files',
            output: { type: 'json', value: '[compacted]' },
          } satisfies ToolResultPart),
        ],
      }),
    ])
  })

  it('should handle multiple tool outputs', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'test_tool',
        toolCallId: 'call_123',
        content: [
          { type: 'json', value: { result1: 'success' } },
          { type: 'json', value: { result2: 'also success' } },
        ],
      },
    ]

    const result = convertCbToModelMessages({
      messages,
      includeCacheControl: false,
    })

    // Multiple tool outputs are aggregated into one user message
    expect(result).toEqual([
      expect.objectContaining({
        role: 'tool',
      }),
      expect.objectContaining({
        role: 'tool',
      }),
    ])
  })
})
