import { getCliEnv } from '../env'
import {
  collectExistingPaths,
  inferThemeFromName,
  resolveZedSettingsPaths,
  safeReadFile,
  stripJsonStyleComments,
} from './ide-paths'
import { detectPlatformTheme } from './system-detect'

import type { CliEnv } from '../../types/env'
import type { ThemeName } from '../../types/theme-system'
import type { JSONValue } from '@savant-code/common/types/json'

export const isZedTerminal = (env: CliEnv = getCliEnv()): boolean => {
  const termProgram = env.TERM_PROGRAM?.toLowerCase()
  return termProgram === 'zed' || false
}

const extractZedTheme = (content: string): ThemeName | null => {
  try {
    const sanitized = stripJsonStyleComments(content)
    const parsed = JSON.parse(sanitized) as Record<string, JSONValue>
    const candidates: string[] = []

    const themeSetting = parsed.theme
    if (typeof themeSetting === 'string') {
      candidates.push(themeSetting)
    } else if (themeSetting && typeof themeSetting === 'object') {
      const themeConfig = themeSetting as Record<string, JSONValue>
      const modeRaw = themeConfig.mode
      if (typeof modeRaw === 'string') {
        const mode = modeRaw.toLowerCase()
        if (mode === 'system') {
          return null
        }
        if (mode === 'dark' || mode === 'light') {
          candidates.push(mode)
          const modeTheme = themeConfig[mode]
          if (typeof modeTheme === 'string') {
            candidates.push(modeTheme)
          }
        }
      }

      const darkTheme = themeConfig.dark
      if (typeof darkTheme === 'string') {
        candidates.push(darkTheme)
      }

      const lightTheme = themeConfig.light
      if (typeof lightTheme === 'string') {
        candidates.push(lightTheme)
      }
    }

    const appearance = parsed.appearance
    if (appearance && typeof appearance === 'object') {
      const appearanceTheme = (appearance as Record<string, JSONValue>).theme
      if (typeof appearanceTheme === 'string') {
        candidates.push(appearanceTheme)
      }

      const preference = (appearance as Record<string, JSONValue>)
        .theme_preference
      if (typeof preference === 'string') {
        candidates.push(preference)
      }
    }

    const ui = parsed.ui
    if (ui && typeof ui === 'object') {
      const uiTheme = (ui as Record<string, JSONValue>).theme
      if (typeof uiTheme === 'string') {
        candidates.push(uiTheme)
      }
    }

    for (const candidate of candidates) {
      const inferred = inferThemeFromName(candidate)
      if (inferred) {
        return inferred
      }
    }
  } catch {
    // Ignore malformed or partially written files
  }

  return null
}

export const detectZedTheme = (env: CliEnv = getCliEnv()): ThemeName | null => {
  if (!isZedTerminal(env)) {
    return null
  }

  const settingsPaths = collectExistingPaths(resolveZedSettingsPaths(env))
  for (const settingsPath of settingsPaths) {
    const content = safeReadFile(settingsPath)
    if (!content) continue

    const theme = extractZedTheme(content)
    if (theme) {
      return theme
    }

    try {
      const sanitized = stripJsonStyleComments(content)
      const parsed = JSON.parse(sanitized) as Record<string, JSONValue>
      const themeSetting = parsed.theme
      if (themeSetting && typeof themeSetting === 'object') {
        const themeConfig = themeSetting as Record<string, JSONValue>
        const modeRaw = themeConfig.mode
        if (typeof modeRaw === 'string' && modeRaw.toLowerCase() === 'system') {
          return detectPlatformTheme()
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return null
}
