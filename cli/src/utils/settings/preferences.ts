import { DEFAULT_SAVANT_CODE_MODEL_PROVIDER } from './constants'
import { loadSettings, saveSettings } from './io'

import type { AgentMode } from '../constants'
import type { ModelProvider } from '../openrouter-models'
import type { PermissionMode } from './types'

/**
 * Preference accessors over the persisted settings file
 * (FID-2026-0809-016: extracted from `cli/src/utils/settings.ts`).
 */

/**
 * Load the saved agent mode preference
 * @returns The saved mode, or 'HYBRID' if not found or invalid
 */
export const loadModePreference = (): AgentMode => {
  const settings = loadSettings()
  return settings.mode ?? 'HYBRID'
}

/**
 * Save the agent mode preference
 */
export const saveModePreference = (mode: AgentMode): void => {
  saveSettings({ mode })
}

/**
 * Load the saved sandbox permission mode preference.
 * @returns The saved permission mode, or 'prompt' if not found or invalid
 */
export const loadPermissionModePreference = (): PermissionMode => {
  return loadSettings().permissionMode ?? 'prompt'
}

/**
 * Save the sandbox permission mode preference.
 */
export const savePermissionModePreference = (mode: PermissionMode): void => {
  saveSettings({ permissionMode: mode })
}

/**
 * Return whether remote analytics and error reporting are enabled. Missing
 * values preserve the active-by-default policy for settings created by older
 * releases.
 */
export const loadAnalyticsEnabled = (): boolean => {
  return loadSettings().analyticsEnabled ?? true
}

/** Persist the user's remote analytics consent preference. */
export const saveAnalyticsEnabled = (enabled: boolean): void => {
  saveSettings({ analyticsEnabled: enabled })
}

/**
 * Whether the one-line analytics disclosure notice has been shown yet
 * (FID-2026-0806-015). False only for users who have never seen it.
 */
export const hasAnalyticsNoticeBeenShown = (): boolean => {
  return loadSettings().analyticsNoticeShown === true
}

/**
 * Discord Rich Presence enable/disable (FID-2026-0818-009). Defaults to
 * enabled; `/presence disable` persists false to settings.json.
 */
export const loadPresenceEnabled = (): boolean => {
  return loadSettings().presenceEnabled ?? true
}

/** Persist the operator's Discord Rich Presence consent. */
export const savePresenceEnabled = (enabled: boolean): void => {
  saveSettings({ presenceEnabled: enabled })
}

/**
 * The Savant Discord Application Client ID — hardcoded, NOT operator
 * configurable (FID-2026-0818-009, operator decision 2026-08-18). A mutable
 * client id is a feature-theft vector: pointing the presence transport at a
 * third-party application would let someone claim the Savant Rich Presence
 * asset as their own. The id is therefore compiled in; the `/presence
 * client <id>` surface and the settings/env override are removed.
 */
export const SAVANT_DISCORD_CLIENT_ID = '1539431002089328710'

/** Mark the analytics disclosure notice as shown. Idempotent. */
export const markAnalyticsNoticeShown = (): void => {
  if (loadSettings().analyticsNoticeShown === true) return
  saveSettings({ analyticsNoticeShown: true })
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
  saveSettings({
    savantCodeModelPreference: model,
    savantCodeModelAutoConfigured: false,
  })
}

/**
 * Load the saved savant-code model provider preference. Returns undefined if
 * none is saved yet — callers should default to the first model in the catalog.
 */
export const loadSavantCodeModelProviderPreference = ():
  ModelProvider | undefined => {
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
 * Load the persisted active provider selection (Phase 4). Returns undefined
 * when no explicit selection has been persisted yet — callers fall back to
 * the picker preference or DEFAULT_SAVANT_CODE_MODEL_PROVIDER via
 * {@link getActiveProvider}. Shell env (DIRECT_PROVIDER) remains authoritative
 * at the routing layer and is consulted separately.
 */
export const loadActiveProvider = (): ModelProvider | undefined => {
  return loadSettings().activeProvider
}

/**
 * The canonical active provider: the persisted /provider selection, else the
 * saved picker preference (the legacy routing source), else the openrouter
 * default (FID-2026-0809-001 decision 12).
 */
export const getActiveProvider = (): ModelProvider => {
  return (
    loadActiveProvider() ??
    loadSavantCodeModelProviderPreference() ??
    DEFAULT_SAVANT_CODE_MODEL_PROVIDER
  )
}

/**
 * Persist the active provider selection. Written by the /provider flow
 * (saveProviderApiKey) and Ollama onboarding; never writes DIRECT_PROVIDER /
 * INFERENCE_BASE_URL env, which stay authoritative overrides.
 */
export const saveActiveProvider = (provider: ModelProvider): void => {
  saveSettings({ activeProvider: provider })
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
export const loadDesignSystemProject = (): string | undefined =>
  loadSettings().designSystemProject
export const loadDesignSystemUser = (): string | undefined =>
  loadSettings().designSystemUser

export const markFirstPromptSubmitted = (): void => {
  if (loadSettings().hasSubmittedFirstPrompt === true) return
  saveSettings({ hasSubmittedFirstPrompt: true })
}
