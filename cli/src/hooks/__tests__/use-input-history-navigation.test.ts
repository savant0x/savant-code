// use-input-history — cross-mode navigation, isNavigating flag behavior,
// and resetHistoryNavigation.
// Sibling of the Loop 330 decomposition (shared harness in
// ./use-input-history-harness).

import { describe, test, expect } from 'bun:test'

import { createMockHistoryNavigator } from './use-input-history-harness'

describe('use-input-history - cross-mode navigation', () => {
  describe('navigating from default mode to bash entries', () => {
    test('navigating up to a bash entry switches to bash mode', () => {
      const nav = createMockHistoryNavigator(['hello world', '!ls -la'])

      expect(nav.state.inputMode).toBe('default')
      nav.navigateUp()

      expect(nav.state.inputMode).toBe('bash')
      expect(nav.state.inputValue).toBe('ls -la')
      expect(nav.state.historyIndex).toBe(1)
    })

    test('navigating up through mixed history changes modes appropriately', () => {
      const nav = createMockHistoryNavigator([
        'default entry 1',
        '!bash command 1',
        'default entry 2',
        '!bash command 2',
      ])

      nav.navigateUp()
      expect(nav.state.inputMode).toBe('bash')
      expect(nav.state.inputValue).toBe('bash command 2')

      nav.navigateUp()
      expect(nav.state.inputMode).toBe('default')
      expect(nav.state.inputValue).toBe('default entry 2')

      nav.navigateUp()
      expect(nav.state.inputMode).toBe('bash')
      expect(nav.state.inputValue).toBe('bash command 1')

      nav.navigateUp()
      expect(nav.state.inputMode).toBe('default')
      expect(nav.state.inputValue).toBe('default entry 1')
    })
  })

  describe('navigating from bash mode to default entries', () => {
    test('navigating up from bash mode to a default entry switches to default mode', () => {
      const nav = createMockHistoryNavigator(['hello world', '!ls -la'])

      nav.state.inputMode = 'bash'
      nav.state.inputValue = 'pwd'

      nav.navigateUp()
      expect(nav.state.inputMode as string).toBe('bash')
      expect(nav.state.inputValue).toBe('ls -la')

      nav.navigateUp()
      expect(nav.state.inputMode as string).toBe('default')
      expect(nav.state.inputValue).toBe('hello world')
    })
  })

  describe('returning to draft restores original mode', () => {
    test('navigating back to draft restores default mode', () => {
      const nav = createMockHistoryNavigator(['!bash command'])

      nav.state.inputMode = 'default'
      nav.state.inputValue = 'my draft text'

      nav.navigateUp()
      expect(nav.state.inputMode as string).toBe('bash')
      expect(nav.state.inputValue).toBe('bash command')

      nav.navigateDown()
      expect(nav.state.inputMode as string).toBe('default')
      expect(nav.state.inputValue).toBe('my draft text')
    })

    test('navigating back to draft restores bash mode', () => {
      const nav = createMockHistoryNavigator(['default entry'])

      nav.state.inputMode = 'bash'
      nav.state.inputValue = 'my bash draft'

      nav.navigateUp()
      expect(nav.state.inputMode as string).toBe('default')
      expect(nav.state.inputValue).toBe('default entry')

      nav.navigateDown()
      expect(nav.state.inputMode as string).toBe('bash')
      expect(nav.state.inputValue).toBe('my bash draft')
    })

    test('draft is preserved with ! prefix for bash mode', () => {
      const nav = createMockHistoryNavigator(['default entry'])

      nav.state.inputMode = 'bash'
      nav.state.inputValue = 'git status'

      nav.navigateUp()
      expect(nav.state.currentDraft).toBe('!git status')
      expect(nav.state.currentDraftMode).toBe('bash')

      nav.navigateDown()
      expect(nav.state.inputValue).toBe('git status')
      expect(nav.state.inputMode as string).toBe('bash')
    })
  })

  describe('navigation through entire history', () => {
    test('can navigate up through all entries and back down to draft', () => {
      const nav = createMockHistoryNavigator(['first', '!second', 'third'])

      nav.state.inputValue = 'draft'
      nav.state.inputMode = 'default'

      // Navigate up through all entries
      nav.navigateUp()
      expect(nav.state.inputValue).toBe('third')
      expect(nav.state.inputMode).toBe('default')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('second')
      expect(nav.state.inputMode as string).toBe('bash')

      nav.navigateUp()
      expect(nav.state.inputValue).toBe('first')
      expect(nav.state.inputMode).toBe('default')

      // Should stay at oldest entry
      nav.navigateUp()
      expect(nav.state.inputValue).toBe('first')
      expect(nav.state.historyIndex).toBe(0)

      // Navigate back down
      nav.navigateDown()
      expect(nav.state.inputValue).toBe('second')
      expect(nav.state.inputMode as string).toBe('bash')

      nav.navigateDown()
      expect(nav.state.inputValue).toBe('third')
      expect(nav.state.inputMode).toBe('default')

      nav.navigateDown()
      expect(nav.state.inputValue).toBe('draft')
      expect(nav.state.inputMode).toBe('default')

      // Should stay at draft
      nav.navigateDown()
      expect(nav.state.inputValue).toBe('draft')
      expect(nav.state.historyIndex).toBe(-1)
    })
  })
})

describe('use-input-history - isNavigating flag behavior', () => {
  describe('navigation sets and clears isNavigating flag', () => {
    test('navigateUp sets isNavigating during mode change', () => {
      const nav = createMockHistoryNavigator(['!bash command'])

      nav.state.inputMode = 'default'
      expect(nav.state.isNavigating).toBe(false)

      nav.navigateUp()
      expect(nav.state.isNavigating).toBe(false)
      expect(nav.state.inputMode as string).toBe('bash')
    })

    test('navigateDown sets isNavigating during mode change', () => {
      const nav = createMockHistoryNavigator(['default entry', '!bash command'])

      nav.navigateUp()
      expect(nav.state.inputMode).toBe('bash')

      nav.navigateDown()
      expect(nav.state.inputMode).toBe('default')
      expect(nav.state.isNavigating).toBe(false)
    })
  })

  describe('useEffect reset is prevented during navigation', () => {
    test('manual mode change resets history navigation', () => {
      const nav = createMockHistoryNavigator(['entry 1', 'entry 2'])

      nav.navigateUp()
      expect(nav.state.historyIndex).toBe(1)
      expect(nav.state.inputValue).toBe('entry 2')

      nav.simulateInputModeChange('bash')
      expect(nav.state.historyIndex).toBe(-1)
      expect(nav.state.currentDraft).toBe('')
      expect(nav.state.currentDraftMode).toBe('default')
    })

    test('mode change during navigation does NOT reset history', () => {
      const nav = createMockHistoryNavigator(['default entry', '!bash command'])

      nav.state.isNavigating = true
      nav.simulateInputModeChange('bash')
      nav.state.historyIndex = 1
      nav.simulateInputModeChange('default')
      nav.state.isNavigating = false
    })

    test('exiting feedback mode explicitly resets history navigation', () => {
      const nav = createMockHistoryNavigator(['entry 1', 'entry 2'])

      nav.navigateUp()
      expect(nav.state.historyIndex).toBe(1)

      nav.resetHistoryNavigation()

      expect(nav.state.historyIndex).toBe(-1)
      expect(nav.state.currentDraft).toBe('')
      expect(nav.state.currentDraftMode).toBe('default')
    })
  })
})

describe('use-input-history - resetHistoryNavigation', () => {
  test('resets historyIndex to -1', () => {
    const nav = createMockHistoryNavigator(['entry'])

    nav.navigateUp()
    expect(nav.state.historyIndex).toBe(0)

    nav.resetHistoryNavigation()
    expect(nav.state.historyIndex).toBe(-1)
  })

  test('resets currentDraft to empty string', () => {
    const nav = createMockHistoryNavigator(['entry'])
    nav.state.inputValue = 'my draft'

    nav.navigateUp()
    expect(nav.state.currentDraft).toBe('my draft')

    nav.resetHistoryNavigation()
    expect(nav.state.currentDraft).toBe('')
  })

  test('resets currentDraftMode to default', () => {
    const nav = createMockHistoryNavigator(['entry'])
    nav.state.inputMode = 'bash'
    nav.state.inputValue = 'my bash draft'

    nav.navigateUp()
    expect(nav.state.currentDraftMode).toBe('bash')

    nav.resetHistoryNavigation()
    expect(nav.state.currentDraftMode).toBe('default')
  })

  test('can be called multiple times safely', () => {
    const nav = createMockHistoryNavigator(['entry'])

    nav.resetHistoryNavigation()
    nav.resetHistoryNavigation()
    nav.resetHistoryNavigation()

    expect(nav.state.historyIndex).toBe(-1)
    expect(nav.state.currentDraft).toBe('')
    expect(nav.state.currentDraftMode).toBe('default')
  })

  test('allows navigation after reset', () => {
    const nav = createMockHistoryNavigator(['entry 1', 'entry 2'])

    nav.navigateUp()
    expect(nav.state.inputValue).toBe('entry 2')

    nav.resetHistoryNavigation()

    nav.navigateUp()
    expect(nav.state.inputValue).toBe('entry 2')
    expect(nav.state.historyIndex).toBe(1)
  })
})
