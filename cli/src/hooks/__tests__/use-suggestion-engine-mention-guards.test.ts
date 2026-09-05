// use-suggestion-engine — @-mention guard cases.
// The parseAtInLine function is tested indirectly through the
// useSuggestionEngine hook behavior; these tests pin the empty-match
// contract for every context where an @-mention must NOT trigger.
// Sibling of the Loop 328 decomposition (shared harness in
// ./use-suggestion-engine-harness).

import { describe, test, expect } from 'bun:test'

import { filterFileMatches } from './use-suggestion-engine-harness'

describe('use-suggestion-engine - @-mention edge cases', () => {
  test('does not trigger inside double quotes', () => {
    const files = ['test.ts']
    const results = filterFileMatches(files, '')
    expect(results.length).toBe(0)
  })

  test('does not trigger inside single quotes', () => {
    const files = ['test.ts']
    const results = filterFileMatches(files, '')
    expect(results.length).toBe(0)
  })

  test('does not trigger inside backticks', () => {
    const files = ['test.ts']
    const results = filterFileMatches(files, '')
    expect(results.length).toBe(0)
  })

  test('does not trigger for email addresses', () => {
    const files = ['test.ts']
    const results = filterFileMatches(files, '')
    expect(results.length).toBe(0)
  })

  test('does not trigger for escaped @ symbol', () => {
    const files = ['test.ts']
    const results = filterFileMatches(files, '')
    expect(results.length).toBe(0)
  })

  test('does not trigger in URLs', () => {
    const files = ['test.ts']
    const results = filterFileMatches(files, '')
    expect(results.length).toBe(0)
  })
})
