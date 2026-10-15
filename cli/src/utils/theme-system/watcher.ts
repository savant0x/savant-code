/**
 * Reactive Theme Detection
 * Watches for system theme changes and updates zustand store
 */
import { existsSync, watch } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

import { getCliEnv } from '../env'
import {
  isJetBrainsTerminal,
  isVSCodeFamilyTerminal,
  isZedTerminal,
} from './ide-detect'
import {
  resolveJetBrainsLafPaths,
  resolveVSCodeSettingsPaths,
  resolveZedSettingsPaths,
} from './ide-paths'

import type { ThemeName } from '../../types/theme-system'

// Debounce timing for file watcher events
const FILE_WATCHER_DEBOUNCE_MS = 250

let themeStoreUpdater: ((name: ThemeName) => void) | null = null
// OSC detections happen asynchronously and at most once.
// We cache the resolved value so synchronous theme code can read it later
// without triggering terminal I/O.
let oscDetectedTheme: ThemeName | null = null
let pendingRecomputeTimer: NodeJS.Timeout | null = null
let themeResolver: (() => ThemeName) | null = null

export const getOscDetectedTheme = (): ThemeName | null => oscDetectedTheme
export const setOscDetectedTheme = (theme: ThemeName | null): void => {
  oscDetectedTheme = theme
}
export const setThemeResolver = (resolver: () => ThemeName) => {
  themeResolver = resolver
}

/**
 * Initialize theme store updater
 * Called by theme-store on initialization to enable reactive updates
 * @param setter - Function to call when theme changes
 */
export const initializeThemeWatcher = (setter: (name: ThemeName) => void) => {
  themeStoreUpdater = setter
}

/**
 * Recompute system theme and update store if it changed
 */
const recomputeSystemTheme = () => {
  const env = getCliEnv()
  // Only recompute if theme is auto-detected (not explicitly set)
  const envPreference = env.OPEN_TUI_THEME ?? env.OPENTUI_THEME
  if (envPreference && envPreference.toLowerCase() !== 'opposite') {
    // User explicitly set theme, don't react to system changes
    return
  }

  if (!themeResolver) {
    return
  }

  const newTheme = themeResolver()

  // Always call the updater and let it decide if an update is needed
  if (themeStoreUpdater) {
    themeStoreUpdater(newTheme)
  }
}

/**
 * Debounced version of recomputeSystemTheme for file watcher events
 * Prevents excessive recomputations when files change rapidly
 */
const debouncedRecomputeSystemTheme = () => {
  if (pendingRecomputeTimer) {
    clearTimeout(pendingRecomputeTimer)
  }
  pendingRecomputeTimer = setTimeout(() => {
    pendingRecomputeTimer = null
    recomputeSystemTheme()
  }, FILE_WATCHER_DEBOUNCE_MS)
}

let lastDetectedTheme: ThemeName | null = null
export function setLastDetectedTheme(theme: ThemeName) {
  lastDetectedTheme = theme
}
export function getLastDetectedTheme(): ThemeName | null {
  return lastDetectedTheme
}

/**
 * Setup file watchers for theme changes
 * Watches parent directories which reliably catches all file modifications
 */
export const setupFileWatchers = () => {
  const watchTargets: string[] = []
  const watchedDirs = new Set<string>()

  // macOS system preferences
  if (process.platform === 'darwin') {
    watchTargets.push(
      join(homedir(), 'Library/Preferences/.GlobalPreferences.plist'),
      join(homedir(), 'Library/Preferences/com.apple.Terminal.plist'),
    )
  }

  // IDE config files - only watch for the active IDE terminal
  if (isVSCodeFamilyTerminal()) {
    watchTargets.push(...resolveVSCodeSettingsPaths())
  }
  if (isJetBrainsTerminal()) {
    watchTargets.push(...resolveJetBrainsLafPaths())
  }
  if (isZedTerminal()) {
    watchTargets.push(...resolveZedSettingsPaths())
  }

  // Watch parent directories instead of individual files
  // Directory watches are more reliable for catching all modifications including plist key deletions
  for (const target of watchTargets) {
    if (existsSync(target)) {
      const parentDir = dirname(target)

      // Only watch each directory once
      if (watchedDirs.has(parentDir)) continue
      watchedDirs.add(parentDir)

      try {
        // Watch the directory - catches all file modifications
        const watcher = watch(
          parentDir,
          { persistent: false },
          (eventType, filename) => {
            // Only respond to changes affecting our target files
            if (filename && watchTargets.some((t) => t.endsWith(filename))) {
              debouncedRecomputeSystemTheme()
            }
          },
        )

        watcher.on('error', () => {
          // Silently ignore watcher errors
        })
      } catch {
        // Silently ignore if we can't watch
      }
    }
  }
}

/**
 * SIGUSR2 signal handler for manual theme refresh
 * Users can send `kill -USR2 <pid>` to force theme recomputation
 */
export function enableManualThemeRefresh() {
  process.on('SIGUSR2', () => {
    recomputeSystemTheme()
  })
}

/**
 * Test isolation: clears the watcher's process-lifetime wiring and cached
 * detections — the debounce timer is cleared before its reference is dropped
 * — so no case inherits another's theme state (FID-2026-1007-002).
 */
export function resetWatcherState(): void {
  if (pendingRecomputeTimer) clearTimeout(pendingRecomputeTimer)
  pendingRecomputeTimer = null
  themeStoreUpdater = null
  oscDetectedTheme = null
  themeResolver = null
  lastDetectedTheme = null
}
