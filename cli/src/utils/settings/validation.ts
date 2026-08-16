import { isSupportedSavantFreeModelId } from '@savant-code/common/constants/savant-free-models'
import { deriveValidProviderIds } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { AGENT_MODES, IS_SAVANT_FREE } from '../constants'
import { LEGACY_MODE_MIGRATION } from './constants'

import type { AgentMode } from '../constants'
import type { ModelProvider } from '../openrouter-models'
import type { PermissionMode, Settings } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Validate and sanitize settings from file
 */
export const validateSettings = (parsed: JSONValue): Settings => {
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

  // Validate permissionMode; drop unknown values and fall back to prompt.
  if (
    typeof obj.permissionMode === 'string' &&
    (obj.permissionMode === 'safe' ||
      obj.permissionMode === 'prompt' ||
      obj.permissionMode === 'unsafe')
  ) {
    settings.permissionMode = obj.permissionMode as PermissionMode
  }

  // Validate adsEnabled
  if (typeof obj.adsEnabled === 'boolean') {
    settings.adsEnabled = obj.adsEnabled
  }

  // Validate analyticsEnabled. Missing values intentionally inherit the active
  // default so existing settings files receive the same behavior as new users.
  if (typeof obj.analyticsEnabled === 'boolean') {
    settings.analyticsEnabled = obj.analyticsEnabled
  }

  // Validate savant-free model preference. In the SavantFree build, drop unknown
  // ids so a removed model doesn't strand the user on a non-existent queue.
  // Hidden-but-supported models are kept; access-tier resolution decides whether
  // they are selectable. In the paid build this key is written by /model and the
  // picker with arbitrary OpenRouter ids (free or paid) — the strict free-catalog
  // gate must NOT apply there, or a valid paid-CLI selection is silently dropped
  // on load and the sidebar falls back to a paid default (FID-2026-0814-002).
  // Backward-compat: migrate the legacy model preference key.
  const savantFreeModelPreference =
    obj.savantFreeModelPreference ?? obj.savantFreeModelPreferenceLegacy
  if (typeof savantFreeModelPreference === 'string') {
    if (
      !IS_SAVANT_FREE ||
      isSupportedSavantFreeModelId(savantFreeModelPreference)
    ) {
      settings.savantFreeModelPreference = savantFreeModelPreference
    }
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

  // Validate analyticsNoticeShown
  if (typeof obj.analyticsNoticeShown === 'boolean') {
    settings.analyticsNoticeShown = obj.analyticsNoticeShown
  }

  // Design-system selections are stable IDs only; paths are handled by the
  // design service after canonicalization, never trusted from settings JSON.
  if (
    typeof obj.designSystemProject === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(obj.designSystemProject)
  ) {
    settings.designSystemProject = obj.designSystemProject
  }
  if (
    typeof obj.designSystemUser === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(obj.designSystemUser)
  ) {
    settings.designSystemUser = obj.designSystemUser
  }

  // Validate savantCodeModelPreference — pass through any string; the /model
  // picker fetches live OpenRouter models so all returned ids are valid.
  // Backward-compat: migrate the legacy `savantCodeModelPreferenceLegacy` key.
  const savantCodeModelPreference =
    obj.savantCodeModelPreference ?? obj.savantCodeModelPreferenceLegacy
  if (typeof savantCodeModelPreference === 'string') {
    settings.savantCodeModelPreference = savantCodeModelPreference
  }

  // Validate provider settings against the registry — must be registry provider
  // ids (FID-2026-0809-001 Phase 1, delta (b): cloudflare is now valid here).
  // Drop unknown/legacy values so a removed provider doesn't strand the user
  // on an empty section.
  const validProviders = new Set<ModelProvider>(
    deriveValidProviderIds(PROVIDER_REGISTRY),
  )
  if (
    typeof obj.savantCodeModelProviderPreference === 'string' &&
    validProviders.has(obj.savantCodeModelProviderPreference as ModelProvider)
  ) {
    settings.savantCodeModelProviderPreference =
      obj.savantCodeModelProviderPreference as ModelProvider
  }
  if (typeof obj.savantCodeModelAutoConfigured === 'boolean') {
    settings.savantCodeModelAutoConfigured = obj.savantCodeModelAutoConfigured
  }

  // activeProvider — the canonical single provider selection (Phase 4).
  // Migrate the legacy directProvider choice onto it when it names a registry
  // provider; unknown/legacy values are dropped, matching the existing
  // validation pattern. An explicit activeProvider wins over a stale legacy
  // directProvider — but only when it is itself valid, so a removed provider
  // does not mask a still-valid legacy directProvider (review finding, Loop 7).
  const explicitActive = obj.activeProvider
  const legacyDirect = obj.directProvider
  const migratedActive =
    typeof explicitActive === 'string' &&
    validProviders.has(explicitActive as ModelProvider)
      ? explicitActive
      : typeof legacyDirect === 'string' &&
          validProviders.has(legacyDirect as ModelProvider)
        ? legacyDirect
        : undefined
  if (typeof migratedActive === 'string') {
    settings.activeProvider = migratedActive as ModelProvider
  }

  // Validate direct provider persistence fields. These are used to remember
  // a local-first (e.g. Ollama) setup across launches.
  if (typeof obj.directProvider === 'string') {
    settings.directProvider = obj.directProvider
  }
  if (typeof obj.directProviderBaseUrl === 'string') {
    settings.directProviderBaseUrl = obj.directProviderBaseUrl
  }

  return settings
}
