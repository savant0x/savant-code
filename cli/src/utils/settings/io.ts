import fs from 'fs'
import path from 'path'

import {
  parseCustomProviders,
  registerCustomProviders,
} from '@savant-code/common/providers/custom-providers'

import { getConfigDir } from '../auth'
import { logger } from '../logger'
import { DEFAULT_SETTINGS } from './constants'
import { validateSettings } from './validation'
import { writeFileAtomic } from '../write-file-atomic'

import type { Settings } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

/** Get the settings file path. */
export const getSettingsPath = (): string => {
  return path.join(getConfigDir(), 'settings.json')
}

/** Ensure the config directory exists, creating it if necessary. */
const ensureConfigDirExists = (): void => {
  const configDir = getConfigDir()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
}

/** Load all settings from disk, validating and dropping unknown values. */
export const loadSettings = (): Settings => {
  const settingsPath = getSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    ensureConfigDirExists()
    const defaults = { ...DEFAULT_SETTINGS }
    writeFileAtomic(settingsPath, JSON.stringify(defaults, null, 2))
    return defaults
  }

  try {
    const settingsFile = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(settingsFile) as JSONValue
    // Register custom providers BEFORE validation (FID-2026-0910-004 Step 5):
    // the effective registry gains the customs first, so provider-field
    // validation below can accept persisted custom selections. Fail-closed:
    // an invalid stored set throws here — caught by the existing catch, which
    // logs and returns {} (built-ins only), never a half-registered state.
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'customProviders' in parsed
    ) {
      const { configs } = parseCustomProviders(parsed)
      registerCustomProviders(configs)
    }
    return validateSettings(parsed)
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Error reading settings',
    )
    return {}
  }
}

/**
 * Save settings to disk. An `undefined` value explicitly removes a persisted
 * key; this is required by reset-style preferences and avoids stale selection
 * state surviving a reset command.
 */
export const saveSettings = (newSettings: Partial<Settings>): void => {
  const settingsPath = getSettingsPath()

  try {
    ensureConfigDirExists()
    const existingSettings = loadSettings()
    const mergedSettings = { ...existingSettings }
    for (const [key, value] of Object.entries(newSettings) as Array<
      [keyof Settings, Settings[keyof Settings] | undefined]
    >) {
      if (value === undefined) {
        delete mergedSettings[key]
      } else {
        mergedSettings[key] = value as never
      }
    }
    writeFileAtomic(settingsPath, JSON.stringify(mergedSettings, null, 2))
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Error saving settings',
    )
    throw error
  }
}
