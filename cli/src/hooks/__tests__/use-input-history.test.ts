// use-input-history — parseHistoryItem: mode detection for history entries.
// Parent of the Loop 330 decomposition (cross-mode navigation, isNavigating
// flag, reset, edge cases, and mode-preservation suites live in sibling
// files; shared harness in ./use-input-history-harness).

import { describe, test, expect } from 'bun:test'

import { parseHistoryItem } from './use-input-history-harness'

describe('use-input-history - parseHistoryItem', () => {
  describe('default mode entries', () => {
    test('parses regular text as default mode', () => {
      const result = parseHistoryItem('hello world')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('hello world')
    })

    test('parses empty string as default mode', () => {
      const result = parseHistoryItem('')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('')
    })

    test('parses text with special characters as default mode', () => {
      const result = parseHistoryItem('fix the bug in @file.ts')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('fix the bug in @file.ts')
    })

    test('parses multiline text as default mode', () => {
      const result = parseHistoryItem('first line\nsecond line')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('first line\nsecond line')
    })
  })

  describe('bash mode entries', () => {
    test('parses !command as bash mode', () => {
      const result = parseHistoryItem('!ls -la')
      expect(result.mode).toBe('bash')
      expect(result.displayText).toBe('ls -la')
    })

    test('parses !git command as bash mode', () => {
      const result = parseHistoryItem('!git status')
      expect(result.mode).toBe('bash')
      expect(result.displayText).toBe('git status')
    })

    test('parses complex bash command as bash mode', () => {
      const result = parseHistoryItem('!npm run test -- --watch')
      expect(result.mode).toBe('bash')
      expect(result.displayText).toBe('npm run test -- --watch')
    })

    test('parses piped bash command as bash mode', () => {
      const result = parseHistoryItem('!cat file.txt | grep error')
      expect(result.mode).toBe('bash')
      expect(result.displayText).toBe('cat file.txt | grep error')
    })
  })

  describe('edge cases', () => {
    test('single ! is treated as default mode (not bash)', () => {
      const result = parseHistoryItem('!')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('!')
    })

    test('! in middle of text is default mode', () => {
      const result = parseHistoryItem('hello! world')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('hello! world')
    })

    test('! at end of text is default mode', () => {
      const result = parseHistoryItem('hello world!')
      expect(result.mode).toBe('default')
      expect(result.displayText).toBe('hello world!')
    })

    test('!! at start is bash mode with ! prefix command', () => {
      const result = parseHistoryItem('!!')
      expect(result.mode).toBe('bash')
      expect(result.displayText).toBe('!')
    })

    test('!  with space is bash mode', () => {
      const result = parseHistoryItem('! echo hello')
      expect(result.mode).toBe('bash')
      expect(result.displayText).toBe(' echo hello')
    })
  })
})
