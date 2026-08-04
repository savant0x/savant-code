import { describe, it, expect } from 'bun:test'

import type { LanguageModelV2StreamPart } from '@ai-sdk/provider'
import type { ParseResult } from '@ai-sdk/provider-utils'

import {
  createChatStreamTransformer,
  type OpenAICompatibleChatChunkValue,
} from './stream-transform'

/**
 * FID-2026-0803-010 LLM-A: previously these tests re-implemented a simulated
 * copy of the inline transform, so they could not catch regressions in the
 * real logic. They now run chunks through the ACTUAL TransformStream produced
 * by `createChatStreamTransformer` and assert on the emitted parts.
 */
async function runThroughStream(
  chunks: ParseResult<OpenAICompatibleChatChunkValue>[],
  options: { includeRawChunks?: boolean } = {},
): Promise<LanguageModelV2StreamPart[]> {
  const stream = createChatStreamTransformer({
    warnings: [],
    includeRawChunks: options.includeRawChunks,
    metadataExtractor: undefined,
    requiredToolKeys: new Map(),
    providerOptionsName: 'openai-compatible',
  })

  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()

  // Drain concurrently: the readable side's high-water mark is 1, so writing
  // before reading stalls on backpressure. The real consumer (the model's
  // pipeThrough) pulls continuously; this mirrors that.
  const parts: LanguageModelV2StreamPart[] = []
  const drain = (async () => {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      parts.push(value)
    }
  })()

  for (const chunk of chunks) {
    await writer.write(chunk)
  }
  await writer.close()
  await drain
  return parts
}

describe('createChatStreamTransformer', () => {
  it('does not access rawValue on failed parse result', async () => {
    const parts = await runThroughStream(
      [
        {
          success: false,
          rawValue: 'SENTINEL_RAW_VALUE_SHOULD_NOT_BE_ACCESSED',
          error: new Error('parse failed'),
        } as ParseResult<OpenAICompatibleChatChunkValue>,
      ],
      { includeRawChunks: true },
    )

    // The raw-chunk emit happens only after the success check, so a failed
    // parse must never surface its rawValue.
    expect(parts.some((part) => part.type === 'raw')).toBe(false)
    expect(parts.some((part) => part.type === 'error')).toBe(true)
  })

  it('emits raw chunk on successful parse when includeRawChunks is true', async () => {
    const rawValue = '{"choices":[{"delta":{"content":"hello"}}]}'
    const parts = await runThroughStream(
      [
        {
          success: true,
          rawValue,
          value: {
            id: '1',
            created: 1,
            model: 'test',
            choices: [{ delta: { content: 'hello' } }],
          },
        },
      ],
      { includeRawChunks: true },
    )

    expect(parts.find((part) => part.type === 'raw')).toEqual({
      type: 'raw',
      rawValue,
    })
  })

  it('emits an error part for provider error chunks', async () => {
    const parts = await runThroughStream([
      {
        success: true,
        rawValue: '{"error":{"message":"boom"}}',
        value: { error: { message: 'boom' } },
      },
    ])

    expect(parts.some((part) => part.type === 'error')).toBe(true)
  })
})
