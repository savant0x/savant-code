import fs from 'fs'
import path from 'path'

import { isSupportedSavantFreeModelId } from '@savant-code/common/constants/savant-free-models'


import { getConfigDir } from './auth'
import { AGENT_MODES } from './constants'
import { logger } from './logger'

import type { AgentMode } from './constants'
import type { ModelProvider } from './openrouter-models'
import type { JSONValue } from '@savant-code/common/types/json'

const DEFAULT_SETTINGS: Settings = {
  mode: 'EDIT' as const,
  adsEnabled: true,
}

// Legacy mode migration map (FID-031). Old DEFAULT/LITE/MAX/PLAN/FREE values
// all collapse to EDIT now that the toggle drives an execution-scope axis.
const LEGACY_MODE_MIGRATION: Record<string, AgentMode> = {
  DEFAULT: 'EDIT',
  LITE: 'EDIT',
  MAX: 'EDIT',
  PLAN: 'EDIT',
  FREE: 'EDIT',
}

/**
 * Settings schema - add new settings here as the product evolves
 */
export interface Settings {
  mode?: AgentMode
  adsEnabled?: boolean
  /** Last model the user picked in the savant-free model selector. Restored on
   *  next savant-free launch so users land in the queue for their preferred
   *  model without re-picking. Persisted as the canonical model id. */
  savantFreeModelPreference?: string
  /** Last model the user picked in the savant-code model selector. Restored on
   *  next launch so users default to their preferred model. */
  savantCodeModelPreference?: string
  /** Last provider the user picked a model from in the savant-code model
   *  selector. The /model picker defaults to the first model of this provider
   *  on future opens so users land in the same catalog section. */
  savantCodeModelProviderPreference?: ModelProvider
  /** @deprecated Use server-side fallbackToALaCarte setting instead */
  alwaysUseALaCarte?: boolean
  /** @deprecated Use server-side fallbackToALaCarte setting instead */
  fallbackToALaCarte?: boolean
  /** Set once the user has submitted their first prompt. Used to gate the
   *  first-time onboarding suggested prompts so they only show to brand-new
   *  users and quietly retire afterwards. */
  hasSubmittedFirstPrompt?: boolean
  /** Set when the user acknowledges the SCAFFOLD-mode confirmation dialog.
   *  Persists the first-click warning so it only appears once per user. */
  scaffoldAcknowledged?: boolean
}

/**
 * Get the settings file path
 */
export const getSettingsPath = (): string => {
  return path.join(getConfigDir(), 'settings.json')
}

/**
 * Ensure the config directory exists, creating it if necessary
 */
const ensureConfigDirExists = (): void => {
  const configDir = getConfigDir()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
}

/**
 * Load all settings from file system
 * @returns The saved settings object, with defaults for missing values
 */
export const loadSettings = (): Settings => {
  const settingsPath = getSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    ensureConfigDirExists()
    // Create default settings file
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2))
    return DEFAULT_SETTINGS
  }

  try {
    const settingsFile = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(settingsFile) as JSONValue
    return validateSettings(parsed)
  } catch (error) {
    logger.debug(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error reading settings',
    )
    return {}
  }
}

/**
 * Validate and sanitize settings from file
 */
const validateSettings = (parsed: JSONValue): Settings => {
  if (typeof parsed !== 'object' || parsed === null) {
    return {}
  }

  const settings: Settings = {}
  const obj = parsed as Record<string, JSONValue>

  // Validate mode; migrate legacy DEFAULT/LITE/MAX/PLAN/FREE values to EDIT.
  if (typeof obj.mode === 'string') {
    const migrated = LEGACY_MODE_MIGRATION[obj.mode] ?? obj.mode
    if (AGENT_MODES.includes(migrated as AgentMode)) {
      settings.mode = migrated as AgentMode
    }
  }

  // Validate adsEnabled
  if (typeof obj.adsEnabled === 'boolean') {
    settings.adsEnabled = obj.adsEnabled
  }

  // Validate savant-free model preference — drop unknown ids so a removed model
  // doesn't strand the user on a non-existent queue. Hidden-but-supported models
  // are kept; access-tier resolution decides whether they are selectable.
  // Backward-compat: migrate the legacy model preference key.
  const savantFreeModelPreference =
    obj.savantFreeModelPreference ?? obj.freebuffModelPreference ?? obj.savantFreeModelPreferenceLegacy
  if (
    typeof savantFreeModelPreference === 'string' &&
    isSupportedSavantFreeModelId(savantFreeModelPreference)
  ) {
    settings.savantFreeModelPreference = savantFreeModelPreference
  }

  // Validate alwaysUseALaCarte (legacy)
  if (typeof obj.alwaysUseALaCarte === 'boolean') {
    settings.alwaysUseALaCarte = obj.alwaysUseALaCarte
  }

  // Validate fallbackToALaCarte (legacy)
  if (typeof obj.fallbackToALaCarte === 'boolean') {
    settings.fallbackToALaCarte = obj.fallbackToALaCarte
  }

  // Validate hasSubmittedFirstPrompt
  if (typeof obj.hasSubmittedFirstPrompt === 'boolean') {
    settings.hasSubmittedFirstPrompt = obj.hasSubmittedFirstPrompt
  }

  // Validate scaffoldAcknowledged
  if (typeof obj.scaffoldAcknowledged === 'boolean') {
    settings.scaffoldAcknowledged = obj.scaffoldAcknowledged
  }

  // Validate savantCodeModelPreference — pass through any string; the /model
  // picker fetches live OpenRouter models so all returned ids are valid.
  // Backward-compat: migrate the legacy `savantCode$1` key.
  const savantCodeModelPreference =
    obj.savantCodeModelPreference ?? obj.savantCode$1
  if (typeof savantCodeModelPreference === 'string') {
    settings.savantCodeModelPreference = savantCodeModelPreference
  }

  // Validate savantCodeModelProviderPreference — must be one of the known
  // gateway providers. Drop unknown/legacy values so a removed provider doesn't
  // strand the user on an empty section.
  const validProviders = new Set<ModelProvider>([
    'openrouter',
    'tokenrouter',
    'nvidia',
  ])
  if (
    typeof obj.savantCodeModelProviderPreference === 'string' &&
    validProviders.has(obj.savantCodeModelProviderPreference as ModelProvider)
  ) {
    settings.savantCodeModelProviderPreference =
      obj.savantCodeModelProviderPreference as ModelProvider
  }

  return settings
}

/**
 * Save settings to file system (merges with existing settings)
 */
export const saveSettings = (newSettings: Partial<Settings>): void => {
  const settingsPath = getSettingsPath()

  try {
    ensureConfigDirExists()

    // Load existing settings and merge
    const existingSettings = loadSettings()
    const mergedSettings = { ...existingSettings, ...newSettings }

    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2))
  } catch (error) {
    logger.debug(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error saving settings',
    )
  }
}

/**
 * Load the saved agent mode preference
 * @returns The saved mode, or 'EDIT' if not found or invalid
 */
export const loadModePreference = (): AgentMode => {
  const settings = loadSettings()
  return settings.mode ?? 'EDIT'
}

/**
 * Save the agent mode preference
 */
export const saveModePreference = (mode: AgentMode): void => {
  saveSettings({ mode })
}

/**
 * Load the saved savant-free model preference. Returns undefined if none is
 * saved yet — callers should fall back to DEFAULT_SAVANT_FREE_MODEL_ID.
 */
export const loadSavantFreeModelPreference = (): string | undefined => {
  return loadSettings().savantFreeModelPreference
}

/**
 * Save the savant-free model preference. Called whenever the user picks a model
 * on the landing screen so the next launch defaults to it.
 */
export const saveSavantFreeModelPreference = (model: string): void => {
  saveSettings({ savantFreeModelPreference: model })
}

/**
 * Load the saved savant-code model preference. Returns undefined if none is
 * saved yet — callers should fall back to the agent definition's model.
 */
export const loadSavantCodeModelPreference = (): string | undefined => {
  return loadSettings().savantCodeModelPreference
}

/**
 * Save the savant-code model preference. Called whenever the user picks a model
 * in the CLI so the next launch defaults to it.
 */
export const saveSavantCodeModelPreference = (model: string): void => {
  saveSettings({ savantCodeModelPreference: model })
}

/**
 * Load the saved savant-code model provider preference. Returns undefined if
 * none is saved yet — callers should default to the first model in the catalog.
 */
export const loadSavantCodeModelProviderPreference = ():
  | ModelProvider
  | undefined => {
  return loadSettings().savantCodeModelProviderPreference
}

/**
 * Save the savant-code model provider preference. Called whenever the user picks
 * a model in the CLI so the next /model open defaults to that provider's
 * section.
 */
export const saveSavantCodeModelProviderPreference = (
  provider: ModelProvider,
): void => {
  saveSettings({ savantCodeModelProviderPreference: provider })
}

/**
 * Whether the user has ever submitted a prompt. False only for brand-new
 * users, who get the onboarding suggested prompts on an empty chat.
 */
export const hasSubmittedFirstPrompt = (): boolean => {
  return loadSettings().hasSubmittedFirstPrompt === true
}

/**
 * Mark that the user has submitted their first prompt, retiring the onboarding
 * suggested prompts on future launches. Idempotent.
 */
export const markFirstPromptSubmitted = (): void => {
  if (loadSettings().hasSubmittedFirstPrompt === true) return
  saveSettings({ hasSubmittedFirstPrompt: true })
}
