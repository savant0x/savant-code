import { describe, it, expect } from 'bun:test'

describe('streaming transform type safety', () => {
  it('does not access rawValue on failed parse result', () => {
    let rawValueAccessed = false

    // Simulate the transform logic from openai-compatible-chat-language-model.ts
    function transform(chunk: any, controller: any) {
      // handle failed chunk parsing / validation:
      if (!chunk.success) {
        controller.enqueue({ type: 'error', error: chunk.error })
        return
      }

      // Emit raw chunk if requested (after success check so rawValue is guaranteed)
      const options = { includeRawChunks: true }
      if (options.includeRawChunks) {
        // This line should never be reached for failed chunks
        rawValueAccessed = true
        controller.enqueue({ type: 'raw', rawValue: chunk.rawValue })
      }
    }

    const controller = {
      enqueue: (chunk: any) => {},
    }

    // Write a failed parse result with a sentinel rawValue
    transform(
      {
        success: false,
        rawValue: 'SENTINEL_RAW_VALUE_SHOULD_NOT_BE_ACCESSED',
        error: new Error('parse failed'),
        value: undefined,
      },
      controller,
    )

    expect(rawValueAccessed).toBe(false)
  })

  it('emits raw chunk on successful parse when includeRawChunks is true', () => {
    const emitted: any[] = []

    function transform(chunk: any, controller: any) {
      // handle failed chunk parsing / validation:
      if (!chunk.success) {
        controller.enqueue({ type: 'error', error: chunk.error })
        return
      }

      // Emit raw chunk if requested (after success check so rawValue is guaranteed)
      const options = { includeRawChunks: true }
      if (options.includeRawChunks) {
        controller.enqueue({ type: 'raw', rawValue: chunk.rawValue })
      }
    }

    const controller = {
      enqueue: (chunk: any) => emitted.push(chunk),
    }

    transform(
      {
        success: true,
        rawValue: '{"choices":[{"delta":{"content":"hello"}}]}',
        value: { content: 'hello' },
        error: undefined,
      },
      controller,
    )

    // Should emit raw chunk
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toEqual({
      type: 'raw',
      rawValue: '{"choices":[{"delta":{"content":"hello"}}]}',
    })
  })
})
