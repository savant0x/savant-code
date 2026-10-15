/**
 * Theme Hooks
 *
 * Simple hooks for accessing theme from zustand store
 */

import { create } from 'zustand'

import { getCliEnv } from '../utils/env'
import { themeConfig, buildTheme } from '../utils/theme-config'
import {
  chatThemes,
  cloneChatTheme,
  detectIDETheme,
  detectPlatformTheme,
  detectTerminalOverrides,
  getOscDetectedTheme,
  initializeThemeWatcher,
  setThemeResolver,
  setLastDetectedTheme,
  setupFileWatchers,
} from '../utils/theme-system'

import type { ChatTheme, ThemeName } from '../types/theme-system'
import type { StoreApi, UseBoundStore } from 'zustand'

type ThemeStore = {
  theme: ChatTheme
  setThemeName: (name: ThemeName) => void
}

export let useThemeStore: UseBoundStore<StoreApi<ThemeStore>> = (() => {
  throw new Error('useThemeStore not initialized')
}) as unknown as UseBoundStore<StoreApi<ThemeStore>>
let themeStoreInitialized = false

type ThemeDetector = {
  description: string
  detect: () => ThemeName | null
}

const THEME_PRIORITY: ThemeDetector[] = [
  {
    description: 'Terminal override (e.g., OPENAI_THEME)',
    detect: detectTerminalOverrides,
  },
  {
    description: 'IDE configuration (VS Code, JetBrains, Zed)',
    detect: detectIDETheme,
  },
  {
    description: 'OSC terminal colors',
    detect: () => getOscDetectedTheme(),
  },
  {
    description: 'Operating system theme',
    detect: detectPlatformTheme,
  },
]

export const detectSystemTheme = (): ThemeName => {
  const env = getCliEnv()
  const envPreference = env.OPEN_TUI_THEME ?? env.OPENTUI_THEME
  const normalizedEnv = envPreference?.toLowerCase()

  if (normalizedEnv === 'dark' || normalizedEnv === 'light') {
    return normalizedEnv
  }

  const preferredTheme = (): ThemeName => {
    for (const detector of THEME_PRIORITY) {
      const result = detector.detect()
      if (result) {
        return result
      }
    }
    return 'dark'
  }

  const resolved = preferredTheme()

  if (normalizedEnv === 'opposite') {
    return resolved === 'dark' ? 'light' : 'dark'
  }

  return resolved
}

/**
 * Builds the theme for a resolved name. One truth for the construction, so the
 * boot path and the test-isolation reset cannot drift (FID-2026-1007-002).
 */
const themeFor = (name: ThemeName): ChatTheme =>
  buildTheme(
    cloneChatTheme(chatThemes[name]),
    name,
    themeConfig.customColors,
    themeConfig.plugins,
  )

/**
 * Creates the store over an initial theme. Extracted from
 * `initializeThemeStore` so the reset installs a store through the SAME factory
 * the boot path uses, instead of handing later cases a throwing stub.
 */
const createThemeStore = (
  initialTheme: ChatTheme,
): UseBoundStore<StoreApi<ThemeStore>> =>
  create<ThemeStore>((set, get) => ({
    theme: initialTheme,

    setThemeName: (name: ThemeName) => {
      const currentTheme = get().theme

      // Skip if theme name hasn't changed
      if (currentTheme.name === name) {
        return
      }

      set({ theme: themeFor(name) })
    },
  }))

export function initializeThemeStore() {
  if (themeStoreInitialized) {
    return
  }
  themeStoreInitialized = true

  setThemeResolver(detectSystemTheme)
  setupFileWatchers()

  const initialThemeName = detectSystemTheme()
  setLastDetectedTheme(initialThemeName)
  useThemeStore = createThemeStore(themeFor(initialThemeName))

  // Set up the theme watcher for reactive updates when system theme changes
  initializeThemeWatcher((name: ThemeName) => {
    useThemeStore.getState().setThemeName(name)
  })

  // Note: OSC detection is done earlier in index.tsx before OpenTUI starts,
  // so the result is already available via getOscDetectedTheme()
}

/**
 * Test isolation: installs a FRESH store built through the boot path's factory,
 * so a case starts from the theme the process would have initialized with rather
 * than inheriting whatever an earlier file left behind — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 *
 * It deliberately does NOT restore the throwing pre-init stub. 122 CLI
 * component tests render without calling `initializeThemeStore()` and relied on
 * an earlier file having created the store (measured: 122 failures,
 * `useThemeStore not initialized`), so a bare clear would have made those files
 * the fix. Rebuilding through the same factory gives the isolation that matters
 * here — a `setThemeName` mutation cannot leak across cases — without changing
 * what a case starts from. It performs no I/O: no watcher, resolver or file
 * watcher is re-armed (only `initializeThemeStore` owns those).
 */
export function resetUseThemeState(): void {
  themeStoreInitialized = false
  useThemeStore = createThemeStore(themeFor(detectSystemTheme()))
}

export const useTheme = (): ChatTheme => {
  return useThemeStore((state) => state.theme)
}
