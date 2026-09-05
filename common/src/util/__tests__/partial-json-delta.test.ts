import { describe, expect, it } from 'bun:test'

import { parsePartialJsonObjectSingle } from '../partial-json-delta'

describe('parsePartialJsonObjectSingle', () => {
  describe('complete valid JSON', () => {
    it('should parse complete valid JSON', () => {
      const input = '{"name": "test", "value": 42}'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { name: 'test', value: 42 },
      })
    })

    it('should parse empty object', () => {
      const input = '{}'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({ lastParamComplete: true, params: {} })
    })

    it('should parse nested objects', () => {
      const input = '{"user": {"name": "John", "age": 30}}'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { user: { name: 'John', age: 30 } },
      })
    })

    it('should parse arrays', () => {
      const input = '{"items": [1, 2, 3]}'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { items: [1, 2, 3] },
      })
    })
  })

  describe('incomplete JSON - missing closing brace', () => {
    it('should parse object missing final closing brace', () => {
      const input = '{"name": "test", "value": 42'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { name: 'test' },
      })
    })

    it('should parse nested object missing final closing brace', () => {
      const input = '{"user": {"name": "John", "age": 30}'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { user: { name: 'John', age: 30 } },
      })
    })

    it('should parse object with incomplete string value', () => {
      const input = '{"name": "test", "incomplete": "partial'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: false,
        params: { name: 'test', incomplete: 'partial' },
      })
    })
  })

  describe('incomplete JSON - trailing comma handling', () => {
    it('should handle trailing comma by removing last property', () => {
      const input = '{"name": "test", "value": 42, "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { name: 'test', value: 42 },
      })
    })

    it('should handle multiple trailing commas', () => {
      const input = '{"a": 1, "b": 2, "c": 3, "d":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { a: 1, b: 2, c: 3 },
      })
    })

    it('should handle nested object with trailing comma', () => {
      const input = '{"user": {"name": "John", "age": 30}, "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { user: { name: 'John', age: 30 } },
      })
    })

    it('should handle array with trailing comma', () => {
      const input = '{"items": [1, 2, 3], "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { items: [1, 2, 3] },
      })
    })
  })

  describe('comma search optimization', () => {
    it('should efficiently find last valid comma in deeply nested incomplete JSON', () => {
      // This tests the O(n) backward comma search optimization
      const input = '{"a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { a: 1, b: 2, c: 3, d: 4, e: 5 },
      })
    })

    it('should handle comma inside string value when searching backwards', () => {
      // Comma inside a string should not be treated as a separator
      const input = '{"message": "Hello, world", "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { message: 'Hello, world' },
      })
    })

    it('should find valid comma after skipping invalid parse attempts', () => {
      // Multiple commas, need to find the right one
      const input = '{"x": [1, 2, 3], "y": {"a": 1, "b": 2}, "z":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { x: [1, 2, 3], y: { a: 1, b: 2 } },
      })
    })
  })

  describe('edge cases', () => {
    it('should return empty object for empty string', () => {
      const input = ''
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({ lastParamComplete: true, params: {} })
    })

    it('should return empty object for invalid JSON', () => {
      const input = 'not json at all'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({ lastParamComplete: true, params: {} })
    })

    it('should return empty object for malformed JSON', () => {
      const input = '{"name": test}'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({ lastParamComplete: true, params: {} })
    })

    it('should handle JSON with only opening brace', () => {
      const input = '{'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({ lastParamComplete: true, params: {} })
    })

    it('should handle JSON with whitespace', () => {
      const input = '  {"name": "test"}  '
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { name: 'test' },
      })
    })

    it('should handle complex nested incomplete JSON', () => {
      const input =
        '{"data": {"users": [{"name": "John"}, {"name": "Jane"}], "count": 2}, "meta":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: {
          data: {
            users: [{ name: 'John' }, { name: 'Jane' }],
            count: 2,
          },
        },
      })
    })
  })

  describe('real-world streaming scenarios', () => {
    it('should handle partial JSON from streaming response', () => {
      const input =
        '{"status": "processing", "progress": 0.5, "message": "Working on'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: false,
        params: {
          status: 'processing',
          progress: 0.5,
          message: 'Working on',
        },
      })
    })

    it('should handle JSON with boolean and null values', () => {
      const input =
        '{"active": true, "deleted": false, "metadata": null, "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { active: true, deleted: false, metadata: null },
      })
    })

    it('should handle JSON with numbers', () => {
      const input =
        '{"integer": 42, "float": 3.14, "negative": -10, "incomplete":'
      const result = parsePartialJsonObjectSingle(input)
      expect(result).toEqual({
        lastParamComplete: true,
        params: { integer: 42, float: 3.14, negative: -10 },
      })
    })
  })
})
