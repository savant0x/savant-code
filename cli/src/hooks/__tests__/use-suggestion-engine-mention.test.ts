import { describe, test, expect } from 'bun:test'

import {
  isInsideStringDelimiters,
  parseAtInLine,
} from '../use-suggestion-engine'

describe('@ mention edge cases - quote detection', () => {
  test('isInsideStringDelimiters detects position inside double quotes', () => {
    expect(isInsideStringDelimiters('"hello @world"', 7)).toBe(true)
  })

  test('isInsideStringDelimiters does NOT detect position inside single quotes (apostrophes)', () => {
    // Single quotes are ignored - they're commonly used as apostrophes
    expect(isInsideStringDelimiters("'hello @world'", 7)).toBe(false)
  })

  test('isInsideStringDelimiters detects position inside backticks', () => {
    expect(isInsideStringDelimiters('`hello @world`', 7)).toBe(true)
  })

  test('isInsideStringDelimiters returns false for position outside quotes', () => {
    expect(isInsideStringDelimiters('"hello" @world', 8)).toBe(false)
  })

  test('isInsideStringDelimiters handles escaped quotes', () => {
    expect(isInsideStringDelimiters('"hello \\" @world"', 11)).toBe(true)
  })
})

describe('parseAtInLine - @ mention trigger logic', () => {
  test('triggers for @ at start of line', () => {
    const result = parseAtInLine('@agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('triggers for @ after whitespace', () => {
    const result = parseAtInLine('hello @agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('does NOT trigger for @ inside double quotes', () => {
    const result = parseAtInLine('"@agent"')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ immediately after single quote (whitespace still required)', () => {
    // Single quotes don't create quoted regions, but whitespace before @ is still required
    const result = parseAtInLine("'@agent'")
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ inside backticks', () => {
    const result = parseAtInLine('`@agent`')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for email addresses', () => {
    const result = parseAtInLine('user@example.com')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for escaped @ symbol', () => {
    const result = parseAtInLine('\\@agent')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ in URLs with colon', () => {
    const result = parseAtInLine('https://example.com/@user')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ after dot', () => {
    const result = parseAtInLine('file.@property')
    expect(result.active).toBe(false)
  })

  test('triggers after closing quote', () => {
    const result = parseAtInLine('"test" @agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('handles nested quotes correctly - @ inside outer quotes', () => {
    const result = parseAtInLine('"test \'nested\' @here"')
    expect(result.active).toBe(false)
  })

  test('extracts query correctly', () => {
    const result = parseAtInLine('@myagent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('myagent')
  })

  test('does NOT trigger if @ followed by space', () => {
    const result = parseAtInLine('@ agent')
    expect(result.active).toBe(false)
  })

  test('uses lastIndexOf to find the rightmost @', () => {
    const result = parseAtInLine('@first @second')
    expect(result.active).toBe(true)
    expect(result.query).toBe('second')
  })
})
