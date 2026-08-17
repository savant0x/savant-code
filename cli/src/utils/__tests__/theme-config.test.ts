import { describe, expect, test } from 'bun:test'

import { buildTheme } from '../theme-config'
import { chatThemes, cloneChatTheme } from '../theme-system/palette'

describe('buildTheme design-system mode layering', () => {
  test('uses the native near-black surface in dark mode', () => {
    const theme = buildTheme(cloneChatTheme(chatThemes.dark), 'dark')
    expect(theme.background).toBe('#050508')
    expect(theme.surface).toBe('#0b0b11')
  })

  test('preserves the light palette when native design system has no light variant', () => {
    const theme = buildTheme(cloneChatTheme(chatThemes.light), 'light')
    expect(theme.background).toBe('#ffffff')
    expect(theme.surface).toBe('#fafafa')
    expect(theme.foreground).toBe('#111114')
  })
})
