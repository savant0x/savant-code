// simplify-tool-results — deterministic truncation limits (P2c).
// Sibling of the Loop 327 decomposition. FID-2026-1007-004 step 3 updated the
// marker these pins read: `truncated`/`fullOutput` became one `omitted` marker
// whose `retained` field is a locator or a named refusal, and a branch that
// REPLACES a payload now needs a retention handle before it may.

import { describe, expect, it } from 'bun:test'

import { rememberRetention } from '../../evidence/retention-registry'
import {
  TOOL_OUTPUT_LIMITS,
  truncateToolOutputValue,
} from '../simplify-tool-results'

import type { OmissionMarker } from '../simplify-tool-results'
import type { JSONValue } from '@savant-code/common/types/json'

/** Stand in for the tool-result boundary's verdict for one tool call. */
function grantHandle(toolCallId: string): void {
  rememberRetention(toolCallId, {
    retained: true,
    handle: {
      file: `${toolCallId}.jsonl`,
      toolCallId,
      sha256: 'a'.repeat(64),
      bytes: 1,
      redacted: false,
    },
  })
}

function omissionOf(value: JSONValue): OmissionMarker {
  return (value as Record<string, unknown>).omitted as OmissionMarker
}

describe('truncateToolOutputValue (P2c deterministic limits)', () => {
  it('passes small values through untouched by reference', () => {
    const value: JSONValue = { ok: true, results: ['a', 'b'] }
    const result = truncateToolOutputValue(value)
    expect(result).toBe(value) // by reference — no-op
  })

  it('keeps the object branch additive and truthful about what it omitted', () => {
    const big = { data: 'x'.repeat(TOOL_OUTPUT_LIMITS.maxBytes + 100) }
    const result = truncateToolOutputValue(big) as Record<string, JSONValue>
    const omitted = omissionOf(result)

    // The original object keys are preserved alongside the marker...
    expect(result.data).toBeDefined()
    // ...so nothing was omitted, and the marker no longer claims a byte cap it
    // did not apply (it used to report `output exceeded 50000 bytes` next to
    // `omittedChars: 0`).
    expect(omitted.omittedChars).toBe(0)
    expect(omitted.reason).not.toContain('bytes')
    // No retention verdict exists for this call, and the marker says so.
    expect(omitted.retained).toEqual({
      ok: false,
      why: 'no-retention-verdict',
    })
  })

  it('reports an over-line-limit object without claiming a byte cap', () => {
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
    const omitted = omissionOf(result)

    expect(omitted.omittedChars).toBe(0)
    expect(omitted.reason).not.toContain('lines')
    expect(omitted.preview).toBeDefined()
  })

  it('accepts custom limits, and a string payload is dropped only with a handle', () => {
    const payload = 'x'.repeat(5_000)
    const limits = { maxBytes: 1_000, maxLines: 100, previewChars: 50 }

    // No verdict for this call: the payload is returned untouched, not taken.
    expect(truncateToolOutputValue(payload, limits)).toBe(payload)

    grantHandle('call-custom')
    const result = truncateToolOutputValue(payload, limits, 'call-custom')
    const omitted = omissionOf(result)

    expect(omitted.reason).toContain('bytes')
    expect(omitted.omittedChars).toBeGreaterThan(0)
    expect(omitted.retained).toEqual(
      expect.objectContaining({ ok: true, toolCallId: 'call-custom' }),
    )
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
