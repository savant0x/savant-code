// use-input-history — edge cases (empty history, single entries, rapid
// navigation, special characters, unicode, long entries) and mode
// preservation.
// Sibling of the Loop 330 decomposition (shared harness in
// ./use-input-history-harness).

import { describe, test, expect } from 'bun:test'

import { createMockHistoryNavigator } from './use-input-history-harness'

describe('use-input-history - edge cases', () => {
  describe('empty history', () => {
    test('navigateUp does nothing with empty history', () => {
      const nav = createMockHistoryNavigator([])

      nav.state.inputValue = 'current text'
      nav.navigateUp()

      expect(nav.state.inputValue).toBe('current text')
      expect(nav.state.historyIndex).toBe(-1)
    })

    test('navigateDown does nothing with empty history', () => {
      const nav = createMockHistoryNavigator([])

      nav.state.inputValue = 'current text'
      nav.navigateDown()

      expect(nav.state.inputValue).toBe('current text')
      expect(nav.state.historyIndex).toBe(-1)
    })
  })

  describe('single entry history', () => {
    test('can navigate up and down with single entry', () => {
      const nav = createMockHistoryNavigator(['only entry'])
      nav.state.inputValue = 'draft'

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('only entry')
      expect(nav.state.historyIndex).toBe(0)

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('only entry')
      expect(nav.state.historyIndex).toBe(0)

      nav.navigateDown()
      expect(nav.state.inputValue).toBe('draft')
      expect(nav.state.historyIndex).toBe(-1)
    })
  })

  describe('navigateDown without prior navigateUp', () => {
    test('navigateDown at draft does nothing', () => {
      const nav = createMockHistoryNavigator(['entry 1', 'entry 2'])

      nav.state.inputValue = 'draft'
      nav.navigateDown()

      expect(nav.state.inputValue).toBe('draft')
      expect(nav.state.historyIndex).toBe(-1)
    })
  })

  describe('rapid navigation', () => {
    test('rapid up/down navigation works correctly', () => {
      const nav = createMockHistoryNavigator(['a', 'b', 'c'])
      nav.state.inputValue = 'draft'

      nav.navigateUp() // c
      nav.navigateUp() // b
      nav.navigateDown() // c
      nav.navigateUp() // b
      nav.navigateUp() // a
      nav.navigateDown() // b
      nav.navigateDown() // c
      nav.navigateDown() // draft

      expect(nav.state.inputValue).toBe('draft')
      expect(nav.state.historyIndex).toBe(-1)
    })
  })

  describe('special characters in history', () => {
    test('handles entries with special characters', () => {
      const nav = createMockHistoryNavigator([
        'entry with @mention',
        '!command with "quotes"',
        'entry with \nnewline',
      ])

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('entry with \nnewline')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('command with "quotes"')
      expect(nav.state.inputMode).toBe('bash')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('entry with @mention')
      expect(nav.state.inputMode).toBe('default')
    })
  })

  describe('unicode in history', () => {
    test('handles unicode characters in entries', () => {
      const nav = createMockHistoryNavigator([
        '日本語のテキスト',
        '!echo 🚀',
        'émojis 👍 and açcénts',
      ])

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('émojis 👍 and açcénts')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('echo 🚀')
      expect(nav.state.inputMode).toBe('bash')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('日本語のテキスト')
      expect(nav.state.inputMode).toBe('default')
    })
  })

  describe('very long entries', () => {
    test('handles very long history entries', () => {
      const longText = 'a'.repeat(10000)
      const longBashCommand = '!' + 'b'.repeat(10000)

      const nav = createMockHistoryNavigator([longText, longBashCommand])

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('b'.repeat(10000))
      expect(nav.state.inputMode).toBe('bash')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe(longText)
      expect(nav.state.inputMode).toBe('default')
    })
  })
})

describe('use-input-history - mode preservation', () => {
  test('preserves draft mode when navigating and returning', () => {
    const nav = createMockHistoryNavigator([
      'default 1',
      '!bash 1',
      'default 2',
      '!bash 2',
    ])

    nav.state.inputMode = 'default'
    nav.state.inputValue = 'my default draft'

    nav.navigateUp()
    nav.navigateUp()
    nav.navigateUp()
    nav.navigateUp()

    nav.navigateDown()
    nav.navigateDown()
    nav.navigateDown()
    nav.navigateDown()
    expect(nav.state.inputMode).toBe('default')
    expect(nav.state.inputValue).toBe('my default draft')
  })

  test('preserves bash mode draft when navigating through default entries', () => {
    const nav = createMockHistoryNavigator([
      'default 1',
      'default 2',
      'default 3',
    ])

    nav.state.inputMode = 'bash'
    nav.state.inputValue = 'npm test'

    nav.navigateUp()
    expect(nav.state.inputMode as string).toBe('default')

    nav.navigateUp()
    expect(nav.state.inputMode as string).toBe('default')

    nav.navigateUp()
    expect(nav.state.inputMode as string).toBe('default')

    nav.navigateDown()
    nav.navigateDown()
    nav.navigateDown()
    expect(nav.state.inputMode).toBe('bash')
    expect(nav.state.inputValue).toBe('npm test')
  })
})
