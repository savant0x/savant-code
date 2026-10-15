import { describe, test, expect } from 'bun:test'

import { parseAtInLine } from '../use-suggestion-engine'

// FID-2026-0819-005 Loop 218: comprehensive-edge-case and apostrophe-handling
// suites moved verbatim from use-suggestion-engine-mention.test.ts.

describe('parseAtInLine - comprehensive edge cases', () => {
  // Email variations
  test.each([
    ['user@mail.example.com', 'email with subdomain'],
    ['user123@example.com', 'email with numbers'],
    ['user_name@example.com', 'email with underscores'],
    ['user-name@example.com', 'email with hyphens'],
    ['first.last@example.com', 'email with dots in username'],
  ])('does NOT trigger for %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(false)
  })

  // URL variations
  test.each([
    ['http://example.com/@user', 'http URL'],
    ['https://example.com/@user', 'https URL'],
    ['http://localhost:3000/@user', 'URL with port'],
  ])('does NOT trigger for %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(false)
  })

  // Quote escape variations
  test('does NOT trigger for @ after escaped backslash in quotes', () => {
    const result = parseAtInLine('"\\\\@test"')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ when quote is escaped (string still open)', () => {
    // In "test\" @agent, the \" is an escaped quote, so the string is still open
    const result = parseAtInLine('"test\\" @agent')
    expect(result.active).toBe(false)
  })

  test('triggers for @ after quote with escaped backslash before it', () => {
    // In "test\\" @agent, the \\ is an escaped backslash, so the " closes the string
    const result = parseAtInLine('"test\\\\" @agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('handles multiple escaped quotes correctly', () => {
    const result = parseAtInLine('"test\\"more\\" @here"')
    expect(result.active).toBe(false)
  })

  // Mixed quote types
  test('handles single quote inside double quotes', () => {
    const result = parseAtInLine('"it\'s @here"')
    expect(result.active).toBe(false)
  })

  test('handles double quote inside single quotes', () => {
    const result = parseAtInLine('\'say "@hello"\'')
    expect(result.active).toBe(false)
  })

  test('handles backticks with quotes inside', () => {
    const result = parseAtInLine('`"@test"`')
    expect(result.active).toBe(false)
  })

  // Multiple @ symbols
  test('finds last @ when multiple exist outside quotes', () => {
    const result = parseAtInLine('@first "@quoted" @last')
    expect(result.active).toBe(true)
    expect(result.query).toBe('last')
  })

  test('finds last @ even if previous ones are in quotes', () => {
    const result = parseAtInLine('"@in_quotes" @real_one')
    expect(result.active).toBe(true)
    expect(result.query).toBe('real_one')
  })

  // Special characters after @
  test('does NOT trigger for @ followed by special characters', () => {
    const result = parseAtInLine('@!')
    expect(result.active).toBe(true)
    expect(result.query).toBe('!')
  })

  test('extracts alphanumeric query with underscores and hyphens', () => {
    const result = parseAtInLine('@my-agent_v2')
    expect(result.active).toBe(true)
    expect(result.query).toBe('my-agent_v2')
  })

  // Whitespace variations
  test.each([
    ['\t@agent', 'tab before @'],
    [' @agent', 'space before @'],
    ['text    @agent', 'multiple spaces before @'],
  ])('triggers with %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  // Empty and edge cases
  test('handles empty string', () => {
    const result = parseAtInLine('')
    expect(result.active).toBe(false)
  })

  test('handles just @', () => {
    const result = parseAtInLine('@')
    expect(result.active).toBe(true)
    expect(result.query).toBe('')
  })

  test('handles @ at end of string with query', () => {
    const result = parseAtInLine('text @query')
    expect(result.active).toBe(true)
    expect(result.query).toBe('query')
  })

  // Code-like contexts (where @ might appear)
  test.each([
    ['something.@decorator', 'decorator-like syntax'],
    ['array.@index', 'array access'],
  ])('does NOT trigger for %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(false)
  })

  // Social media handles (ambiguous - should these trigger?)
  test('triggers for Twitter-like handles after space', () => {
    const result = parseAtInLine('follow @username')
    expect(result.active).toBe(true)
    expect(result.query).toBe('username')
  })

  test('does NOT trigger when @ is part of word', () => {
    const result = parseAtInLine('user@mention')
    expect(result.active).toBe(false)
  })

  // Multiple quotes on same line
  test('handles alternating quotes correctly', () => {
    const result = parseAtInLine('"first" \'second\' "@third"')
    expect(result.active).toBe(false)
  })

  test('triggers after all quotes are closed', () => {
    const result = parseAtInLine('"first" \'second\' @third')
    expect(result.active).toBe(true)
    expect(result.query).toBe('third')
  })

  // Unclosed quotes
  test('does NOT trigger when inside unclosed double quote', () => {
    const result = parseAtInLine('"unclosed @mention')
    expect(result.active).toBe(false)
  })

  test('DOES trigger when inside unclosed single quote (apostrophes dont suppress)', () => {
    // Single quotes are treated as apostrophes, not string delimiters
    const result = parseAtInLine("'unclosed @mention")
    expect(result.active).toBe(true)
    expect(result.query).toBe('mention')
  })

  test('does NOT trigger when inside unclosed backtick', () => {
    const result = parseAtInLine('`unclosed @mention')
    expect(result.active).toBe(false)
  })
})

describe('single quote handling - apostrophes should NOT suppress @ menu', () => {
  // Common contractions with apostrophes - use test.each for repetitive cases
  const contractions = [
    ["don't", 'agent'],
    ["it's", 'agent'],
    ["I'm", 'agent'],
    ["can't", 'agent'],
    ["won't", 'agent'],
    ["you're", 'agent'],
    ["they're", 'agent'],
    ["doesn't", 'agent'],
  ] as const

  test.each(contractions)(
    'triggers @ after contraction "%s"',
    (contraction, expectedQuery) => {
      const result = parseAtInLine(`I ${contraction} @${expectedQuery}`)
      expect(result.active).toBe(true)
      expect(result.query).toBe(expectedQuery)
    },
  )

  // Possessives with apostrophes
  const possessives = [
    ["user's", 'mention'],
    ["file's", 'content'],
  ] as const

  test.each(possessives)(
    'triggers @ after possessive "%s"',
    (possessive, expectedQuery) => {
      const result = parseAtInLine(`${possessive} @${expectedQuery}`)
      expect(result.active).toBe(true)
      expect(result.query).toBe(expectedQuery)
    },
  )

  // Multiple apostrophes in sentence
  test('triggers @ with multiple apostrophes in sentence', () => {
    const result = parseAtInLine("I don't think it's working @agent")
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  // Single quotes that look like string delimiters
  test('triggers @ after space inside single-quoted-looking string', () => {
    // The @ triggers because there's a space before it, not because of single quotes
    const result = parseAtInLine("'hello @world'")
    expect(result.active).toBe(true)
    // Query includes the trailing quote since it's not a delimiter
    expect(result.query).toBe("world'")
  })

  test('does NOT trigger @ at start of single-quoted-looking string (whitespace required)', () => {
    // Single quotes don't create quoted regions, but whitespace before @ is still required
    const result = parseAtInLine("'@agent'")
    expect(result.active).toBe(false)
  })

  // Mixed quotes - double quotes still suppress
  test('does NOT trigger when @ is inside double quotes even with apostrophes', () => {
    const result = parseAtInLine('"I don\'t @agent"')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger when @ is inside backticks even with apostrophes', () => {
    const result = parseAtInLine("`I don't @agent`")
    expect(result.active).toBe(false)
  })

  // Real-world usage examples
  const realWorldExamples = [
    ["Why doesn't this work? @agent", 'agent'],
    ["That's what @file-picker", 'file-picker'],
    ["What's @commander", 'commander'],
  ] as const

  test.each(realWorldExamples)(
    'triggers in natural sentence: "%s"',
    (sentence, expectedQuery) => {
      const result = parseAtInLine(sentence)
      expect(result.active).toBe(true)
      expect(result.query).toBe(expectedQuery)
    },
  )
})
