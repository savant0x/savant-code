import { getCliEnv } from './env'
import {
  detectIDETheme,
  getIDEThemeConfigPaths,
} from './theme-system/ide-detect'
import {
  mergeThemeOverrides,
  parseThemeOverrides,
} from './theme-system/overrides'
import {
  chatThemes,
  cloneChatTheme,
  createMarkdownPalette,
  resolveThemeColor,
} from './theme-system/palette'
import {
  detectPlatformTheme,
  detectTerminalOverrides,
} from './theme-system/system-detect'
import {
  enableManualThemeRefresh,
  getLastDetectedTheme,
  getOscDetectedTheme,
  initializeThemeWatcher,
  setLastDetectedTheme,
  setOscDetectedTheme,
  setThemeResolver,
  setupFileWatchers,
} from './theme-system/watcher'

import type { CliEnv } from '../types/env'
import type { ThemeName } from '../types/theme-system'

/**
 * Check if the terminal supports truecolor (24-bit color).
 * Terminals like macOS Terminal.app only support 256 colors and cannot
 * render hex colors properly - they need ANSI color name fallbacks.
 */
// Cache the truecolor support result since it won't change during runtime
let _truecolorSupport: boolean | null = null

export function supportsTruecolor(env: CliEnv = getCliEnv()): boolean {
  if (_truecolorSupport !== null) {
    return _truecolorSupport
  }

  const termProgram = env.TERM_PROGRAM?.toLowerCase() ?? ''

  // Terminal.app (Apple_Terminal) does NOT support truecolor - only 256 colors
  if (termProgram === 'apple_terminal') {
    _truecolorSupport = false
    return false
  }

  const colorterm = env.COLORTERM?.toLowerCase()
  if (colorterm === 'truecolor' || colorterm === '24bit') {
    _truecolorSupport = true
    return true
  }

  // Some terminals that are known to support truecolor
  const truecolorTerminals = [
    'iterm.app',
    'hyper',
    'wezterm',
    'alacritty',
    'kitty',
    'ghostty',
    'vscode',
  ]

  if (truecolorTerminals.some((t) => termProgram.includes(t))) {
    _truecolorSupport = true
    return true
  }

  // Check TERM for known truecolor-capable values
  const term = env.TERM?.toLowerCase() ?? ''
  if (term.includes('truecolor') || term.includes('24bit')) {
    _truecolorSupport = true
    return true
  }

  // xterm-kitty, alacritty, etc.
  if (
    term === 'xterm-kitty' ||
    term === 'alacritty' ||
    term.includes('ghostty')
  ) {
    _truecolorSupport = true
    return true
  }

  _truecolorSupport = false
  return false
}

/**
 * Get the block color for the logo based on theme and terminal capabilities.
 * In dark mode: white (#ffffff or 'white')
 * In light mode: black (#000000 or 'black')
 */
export function getLogoBlockColor(
  themeName: ThemeName,
  env: CliEnv = getCliEnv(),
): string {
  const isTruecolor = supportsTruecolor(env)
  if (themeName === 'dark') {
    return isTruecolor ? '#18faf9' : 'cyan' // Neon cyan — matching accent
  }
  return isTruecolor ? '#0891b2' : 'cyan' // Cyan-600 for light mode
}

/**
 * Get the accent color for the logo based on theme and terminal capabilities.
 * Returns the primary green color with appropriate fallback.
 */
export function getLogoAccentColor(
  themeName: ThemeName,
  env: CliEnv = getCliEnv(),
): string {
  const isTruecolor = supportsTruecolor(env)
  // The primary cyan color
  if (themeName === 'dark') {
    return isTruecolor ? '#18faf9' : 'cyan' // Neon cyan
  }
  return isTruecolor ? '#0891b2' : 'cyan' // Cyan-600 for light mode
}

export {
  chatThemes,
  cloneChatTheme,
  createMarkdownPalette,
  detectIDETheme,
  detectPlatformTheme,
  detectTerminalOverrides,
  enableManualThemeRefresh,
  getIDEThemeConfigPaths,
  getLastDetectedTheme,
  getOscDetectedTheme,
  initializeThemeWatcher,
  mergeThemeOverrides,
  parseThemeOverrides,
  resolveThemeColor,
  setLastDetectedTheme,
  setOscDetectedTheme,
  setThemeResolver,
  setupFileWatchers,
}

/**
 * Test isolation: clears the memoized truecolor probe — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 */
export function resetTruecolorSupport(): void {
  _truecolorSupport = null
}
