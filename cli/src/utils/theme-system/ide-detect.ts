import { getCliEnv } from '../env'
import {
  collectExistingPaths,
  inferThemeFromName,
  resolveJetBrainsLafPaths,
  resolveVSCodeSettingsPaths,
  resolveZedSettingsPaths,
  safeReadFile,
} from './ide-paths'
import { detectPlatformTheme } from './system-detect'
import { detectZedTheme } from './zed-detect'

export { isZedTerminal } from './zed-detect'

import type { CliEnv } from '../../types/env'
import type { ThemeName } from '../../types/theme-system'

const extractVSCodeTheme = (content: string): ThemeName | null => {
  // Try standard colorTheme setting
  const colorThemeMatch = content.match(
    /"workbench\.colorTheme"\s*:\s*"([^"]+)"/i,
  )
  if (colorThemeMatch) {
    const inferred = inferThemeFromName(colorThemeMatch[1])
    if (inferred) return inferred
  }

  // Check if auto-detect is enabled and try preferred themes
  const autoDetectMatch = content.match(
    /"window\.autoDetectColorScheme"\s*:\s*(true|false)/i,
  )
  const autoDetectEnabled = autoDetectMatch?.[1]?.toLowerCase() === 'true'

  if (autoDetectEnabled) {
    // Try to extract both preferred themes and infer from their names
    const preferredDarkMatch = content.match(
      /"workbench\.preferredDarkColorTheme"\s*:\s*"([^"]+)"/i,
    )
    if (preferredDarkMatch) {
      const inferred = inferThemeFromName(preferredDarkMatch[1])
      if (inferred) return inferred
    }

    const preferredLightMatch = content.match(
      /"workbench\.preferredLightColorTheme"\s*:\s*"([^"]+)"/i,
    )
    if (preferredLightMatch) {
      const inferred = inferThemeFromName(preferredLightMatch[1])
      if (inferred) return inferred
    }
  }

  return null
}

const extractJetBrainsTheme = (content: string): ThemeName | null => {
  // Check if autodetect is enabled (Sync with OS setting)
  const autodetectMatch = content.match(
    /<component[^>]+name="LafManager"[^>]+autodetect="(true|false)"/i,
  )
  if (autodetectMatch?.[1]?.toLowerCase() === 'true') {
    // When syncing with OS, return null to trigger platform detection
    return null
  }

  const normalized = content.toLowerCase()
  if (normalized.includes('darcula') || normalized.includes('dark')) {
    return 'dark'
  }

  if (normalized.includes('light')) {
    return 'light'
  }

  return null
}

export const isVSCodeFamilyTerminal = (env: CliEnv = getCliEnv()): boolean => {
  if (env.TERM_PROGRAM?.toLowerCase() === 'vscode') {
    return true
  }

  // Check VS Code family env keys
  if (
    env.VSCODE_GIT_IPC_HANDLE ||
    env.VSCODE_PID ||
    env.VSCODE_CWD ||
    env.VSCODE_NLS_CONFIG ||
    env.CURSOR_PORT ||
    env.CURSOR
  ) {
    return true
  }

  return false
}

export const isJetBrainsTerminal = (env: CliEnv = getCliEnv()): boolean => {
  if (env.TERMINAL_EMULATOR?.toLowerCase().includes('jetbrains')) {
    return true
  }

  // Check JetBrains env keys
  if (
    env.JETBRAINS_REMOTE_RUN ||
    env.IDEA_INITIAL_DIRECTORY ||
    env.IDE_CONFIG_DIR ||
    env.JB_IDE_CONFIG_DIR
  ) {
    return true
  }

  return false
}

const detectVSCodeTheme = (env: CliEnv = getCliEnv()): ThemeName | null => {
  if (!isVSCodeFamilyTerminal(env)) {
    return null
  }

  const settingsPaths = collectExistingPaths(resolveVSCodeSettingsPaths(env))

  for (const settingsPath of settingsPaths) {
    const content = safeReadFile(settingsPath)
    if (!content) continue
    const theme = extractVSCodeTheme(content)
    if (theme) {
      return theme
    }

    // If extractVSCodeTheme returned null but auto-detect is enabled,
    // use platform theme as fallback
    const autoDetectMatch = content.match(
      /"window\.autoDetectColorScheme"\s*:\s*(true|false)/i,
    )
    if (autoDetectMatch?.[1]?.toLowerCase() === 'true') {
      return detectPlatformTheme()
    }
  }

  const themeKindEnv = env.VSCODE_THEME_KIND ?? env.VSCODE_COLOR_THEME_KIND
  if (themeKindEnv) {
    const normalized = themeKindEnv.trim().toLowerCase()
    if (normalized === 'dark' || normalized === 'hc') return 'dark'
    if (normalized === 'light') return 'light'
  }

  return null
}

const detectJetBrainsTheme = (env: CliEnv = getCliEnv()): ThemeName | null => {
  if (!isJetBrainsTerminal(env)) {
    return null
  }

  const lafPaths = collectExistingPaths(resolveJetBrainsLafPaths(env))

  for (const lafPath of lafPaths) {
    const content = safeReadFile(lafPath)
    if (!content) continue
    const theme = extractJetBrainsTheme(content)
    if (theme) {
      return theme
    }

    // If extractJetBrainsTheme returned null, check if autodetect is enabled
    // and fall back to platform detection
    const autodetectMatch = content.match(
      /<component[^>]+name="LafManager"[^>]+autodetect="(true|false)"/i,
    )
    if (autodetectMatch?.[1]?.toLowerCase() === 'true') {
      return detectPlatformTheme()
    }
  }

  return null
}

export const detectIDETheme = (env: CliEnv = getCliEnv()): ThemeName | null => {
  const theme = detectVSCodeTheme(env)
  if (theme) return theme

  const jbTheme = detectJetBrainsTheme(env)
  if (jbTheme) return jbTheme

  const zedTheme = detectZedTheme(env)
  if (zedTheme) return zedTheme

  return null
}

export const getIDEThemeConfigPaths = (env: CliEnv = getCliEnv()): string[] => {
  const paths = new Set<string>()
  for (const path of resolveVSCodeSettingsPaths(env)) {
    paths.add(path)
  }
  for (const path of resolveJetBrainsLafPaths(env)) {
    paths.add(path)
  }
  for (const path of resolveZedSettingsPaths(env)) {
    paths.add(path)
  }
  return [...paths]
}
