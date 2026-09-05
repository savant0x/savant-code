// openai-compatible chat-language-model test family — exported argument
// helpers (FID-2026-0801-008). Sibling of the Loop 354 decomposition.
import { describe, it, expect } from 'bun:test'

import {
  isCompleteToolCallArguments,
  parseToolCallArguments,
} from './openai-compatible-chat-language-model'

describe('parseToolCallArguments', () => {
  it('returns ok for a complete non-empty JSON object', () => {
    const result = parseToolCallArguments(
      '{"thought":"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.thought).toBe('a')
      expect(result.value.thoughtNumber).toBe(1)
    }
  })

  it('parses an empty object but leaves completeness to the schema-aware helper', () => {
    const result = parseToolCallArguments('{}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({})
    }
  })

  it('parses a whitespace empty object', () => {
    const result = parseToolCallArguments('{ }')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({})
    }
  })

  it('returns not-ok for a string-literal encoding', () => {
    const result = parseToolCallArguments('"{\\"thought\\":\\"a\\"}"')
    expect(result).toEqual({
      ok: false,
      reason: 'non-object',
      value: '{"thought":"a"}',
    })
  })

  it('returns not-ok for an array', () => {
    const result = parseToolCallArguments('[]')
    expect(result.ok).toBe(false)
  })

  it('returns not-ok for null', () => {
    const result = parseToolCallArguments('null')
    expect(result.ok).toBe(false)
  })

  it('returns not-ok for truncated / malformed JSON', () => {
    expect(parseToolCallArguments('{"tho').ok).toBe(false)
    expect(parseToolCallArguments('{').ok).toBe(false)
    expect(parseToolCallArguments('').ok).toBe(false)
  })
})

describe('isCompleteToolCallArguments', () => {
  it('is true only for a complete non-empty object', () => {
    expect(
      isCompleteToolCallArguments(
        '{"thought":"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}',
      ),
    ).toBe(true)
    expect(isCompleteToolCallArguments('{}')).toBe(false)
    expect(isCompleteToolCallArguments('{}', [])).toBe(true)
    expect(
      isCompleteToolCallArguments('{}', ['thought', 'thoughtNumber']),
    ).toBe(false)
    expect(
      isCompleteToolCallArguments('{"thought":"a","thoughtNumber":1}', [
        'thought',
        'thoughtNumber',
      ]),
    ).toBe(true)
    expect(isCompleteToolCallArguments('{"tho')).toBe(false)
    expect(isCompleteToolCallArguments('"{}"')).toBe(false)
  })
})
