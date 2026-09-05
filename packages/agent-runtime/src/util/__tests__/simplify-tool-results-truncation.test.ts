// simplify-tool-results — deterministic truncation limits (P2c).
// Sibling of the Loop 327 decomposition.

import { describe, expect, it } from 'bun:test'

import {
  TOOL_OUTPUT_LIMITS,
  truncateToolOutputValue,
} from '../simplify-tool-results'

import type { JSONValue } from '@savant-code/common/types/json'

describe('truncateToolOutputValue (P2c deterministic limits)', () => {
  it('passes small values through untouched by reference', () => {
    const value: JSONValue = { ok: true, results: ['a', 'b'] }
    const result = truncateToolOutputValue(value)
    expect(result).toBe(value) // by reference — no-op
  })

  it('truncates an over-byte-limit value and attaches metadata', () => {
    const big = { data: 'x'.repeat(TOOL_OUTPUT_LIMITS.maxBytes + 100) }
    const result = truncateToolOutputValue(big) as Record<string, JSONValue>
    expect(result.truncated).toBeDefined()
    const meta = result.truncated as Record<string, unknown>
    expect(meta.reason).toContain('bytes')
    expect(meta.preview).toBeDefined()
    // The original object keys are preserved alongside the marker.
    expect(result.data).toBeDefined()
  })

  it('truncates an over-line-limit value by lines', () => {
    // JSON.stringify preserves the embedded \n chars, so the serialized form
    // genuinely exceeds the line cap while staying under the byte cap.
    const manyLines = {
      log: Array.from(
        { length: TOOL_OUTPUT_LIMITS.maxLines + 50 },
        (_, i) => `line ${i}\n`,
      ).join(''),
    }
    const result = truncateToolOutputValue(manyLines) as Record<
      string,
      JSONValue
    >
    expect(result.truncated).toBeDefined()
    const meta = result.truncated as Record<string, unknown>
    expect(meta.reason).toContain('lines')
    expect(meta.preview).toBeDefined()
  })

  it('accepts custom limits', () => {
    const small: JSONValue = { data: 'x'.repeat(5_000) }
    const result = truncateToolOutputValue(small, {
      maxBytes: 1_000,
      maxLines: 100,
      previewChars: 50,
    }) as Record<string, JSONValue>
    expect(result.truncated).toBeDefined()
  })

  it('never throws on non-serializable values', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = truncateToolOutputValue(circular as unknown as JSONValue)
    expect(() =>
      truncateToolOutputValue(circular as unknown as JSONValue),
    ).not.toThrow()
    expect(result).toBe(circular as unknown as JSONValue)
  })
})
