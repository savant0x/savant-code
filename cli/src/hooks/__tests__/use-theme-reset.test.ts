/**
 * FID-2026-1007-002 pin. `resetUseThemeState()` is called from
 * `cli/src/test-setup.ts` before every case, because the theme store is
 * process-lifetime state that every CLI test file in the single `bun test`
 * process shares. These two cases pin the properties that make wiring it safe:
 * the reset hands back a USABLE store (122 component tests render without
 * calling `initializeThemeStore()`), and a mutation made in one case does not
 * survive into the next.
 */
import { beforeEach, describe, expect, test } from 'bun:test'

import {
  initializeThemeStore,
  resetUseThemeState,
  useThemeStore,
} from '../use-theme'

describe('resetUseThemeState', () => {
  beforeEach(() => {
    initializeThemeStore()
  })

  test('leaves a usable store, so a file that never initializes one still renders', () => {
    resetUseThemeState()

    expect(() => useThemeStore.getState()).not.toThrow()
    expect(typeof useThemeStore.getState().theme.name).toBe('string')
  })

  test('drops a theme mutation made earlier in the same file', () => {
    const initial = useThemeStore.getState().theme.name
    const other = initial === 'dark' ? 'light' : 'dark'

    useThemeStore.getState().setThemeName(other)
    expect(useThemeStore.getState().theme.name).toBe(other)

    resetUseThemeState()
    expect(useThemeStore.getState().theme.name).toBe(initial)
  })
})
