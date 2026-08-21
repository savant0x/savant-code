import fs from 'fs'

import { deriveSetupConfig } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { resetOpenRouterApiKeyCache } from '@savant-code/sdk'

import { getAuthToken, getConfigDir, getCredentialsPath } from './auth'
import {
  readCredentialsRecord,
  readStoredProviderKeys,
} from './provider-credentials'
import {
  getActiveProvider,
  loadActiveProvider,
  saveActiveProvider,
  saveSavantCodeModelProviderPreference,
} from './settings'

export const PROVIDER_SETUP_DEFAULT = 'openrouter' as const

/**
 * Derived from the unified provider registry (FID-2026-0809-001 Phase 1):
 * the entries where `setupAvailable` is true. Cloudflare and Ollama are
 * intentionally absent — Cloudflare enters the setup flow in a later phase
 * (it needs two credentials), and Ollama is local (no key to set up).
 */
export const PROVIDER_SETUP_CONFIG = deriveSetupConfig(PROVIDER_REGISTRY)

export type ProviderSetupName = keyof typeof PROVIDER_SETUP_CONFIG

export type MissingProviderSetup =
  (typeof PROVIDER_SETUP_CONFIG)[ProviderSetupName] & {
    provider: ProviderSetupName
  }

export function getProviderSetupInfo(
  provider: string,
): MissingProviderSetup | undefined {
  const normalized = provider.trim().toLowerCase()
  if (!(normalized in PROVIDER_SETUP_CONFIG)) return undefined

  const providerName = normalized as ProviderSetupName
  return {
    provider: providerName,
    ...PROVIDER_SETUP_CONFIG[providerName],
  }
}

/**
 * Apply persisted direct-provider keys without overriding explicit shell env.
 * Environment variables are intentionally the higher-precedence configuration.
 */
export function applyPersistedProviderApiKeys(): void {
  const storedKeys = readStoredProviderKeys()

  for (const config of Object.values(PROVIDER_SETUP_CONFIG)) {
    if (process.env[config.envVar]?.trim()) continue

    const storedKey = storedKeys[config.envVar]
    if (storedKey) {
      process.env[config.envVar] = storedKey
    }
  }

  // A provider key saved by an earlier release may predate the persisted
  // direct-provider settings. Restore direct mode from the key itself so an
  // npm-installed CLI can use the saved credential without a shell env var.
  if (
    !process.env.DIRECT_PROVIDER?.trim() &&
    !process.env.INFERENCE_BASE_URL?.trim() &&
    !getAuthToken()
  ) {
    const configured = (
      Object.entries(PROVIDER_SETUP_CONFIG) as Array<
        [ProviderSetupName, (typeof PROVIDER_SETUP_CONFIG)[ProviderSetupName]]
      >
    ).find(([, config]) => Boolean(storedKeys[config.envVar]))
    if (configured) {
      const [provider, config] = configured
      process.env.DIRECT_PROVIDER = provider
      process.env.INFERENCE_BASE_URL = config.baseUrl
    }
  }
}

/**
 * Activate direct-provider mode for the selected gateway during first-run
 * onboarding. This intentionally does not require a key: it lets the user
 * reach `/provider` instead of being trapped in backend login, while the SDK
 * still reports the exact missing-key instruction when they submit a prompt.
 */
export function configureDefaultDirectProvider(): void {
  if (
    process.env.DIRECT_PROVIDER?.trim() ||
    process.env.INFERENCE_BASE_URL?.trim() ||
    getAuthToken()
  ) {
    return
  }

  // A persisted /provider selection is explicit and wins over environment
  // discovery. Otherwise, if exactly one hosted provider is configured in the
  // environment, prefer it over the OpenRouter bootstrap default. This makes a
  // `.env.local` with only `NOUS_API_KEY` self-select Nous without requiring a
  // second setup step, while preserving an existing user selection.
  const configuredProviders = getConfiguredProviderNames()
  const configuredProvider =
    configuredProviders.length === 1 ? configuredProviders[0] : undefined
  const provider =
    loadActiveProvider() ?? configuredProvider ?? getActiveProvider()
  const info = getProviderSetupInfo(provider)
  if (!info) return

  process.env.DIRECT_PROVIDER = info.provider
  process.env.INFERENCE_BASE_URL = info.baseUrl
}

/** Save one provider key and make it available to the current process. */
export function saveProviderApiKey(
  provider: ProviderSetupName,
  apiKey: string,
): void {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error('Provider API key cannot be empty.')
  }

  const config = PROVIDER_SETUP_CONFIG[provider]
  const credentialsPath = getCredentialsPath()
  const existing = readCredentialsRecord()
  const existingKeys = readStoredProviderKeys()

  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true })
  }

  const updated = {
    ...existing,
    providerApiKeys: {
      ...existingKeys,
      [config.envVar]: trimmedKey,
    },
  }
  fs.writeFileSync(credentialsPath, JSON.stringify(updated, null, 2))

  // Restrict permissions where the platform supports POSIX modes. Windows
  // ignores this mode, but the file remains inside the user config directory.
  try {
    fs.chmodSync(credentialsPath, 0o600)
  } catch {
    // Best effort only; do not make a valid Windows setup fail.
  }

  const hasShellKey = Boolean(process.env[config.envVar]?.trim())
  if (!hasShellKey) {
    process.env[config.envVar] = trimmedKey
  }

  const shellProvider = process.env.DIRECT_PROVIDER?.trim()
  const shellBaseUrl = process.env.INFERENCE_BASE_URL?.trim()
  let activated = false

  if (!shellProvider && !shellBaseUrl) {
    process.env.DIRECT_PROVIDER = provider
    process.env.INFERENCE_BASE_URL = config.baseUrl
    activated = true
  } else if (shellProvider === provider && !shellBaseUrl) {
    process.env.INFERENCE_BASE_URL = config.baseUrl
    activated = true
  } else if (shellProvider === provider && shellBaseUrl === config.baseUrl) {
    activated = true
  }

  if (activated) {
    // Phase 4 single-setting state: the selection is persisted as
    // activeProvider (the registry derives the base URL and env var). The
    // legacy directProvider/directProviderBaseUrl fields are no longer written
    // for gateway providers — only the local (Ollama) path keeps them.
    saveSavantCodeModelProviderPreference(provider)
    saveActiveProvider(provider)
  }

  if (provider === 'openrouter') {
    resetOpenRouterApiKeyCache()
  }
}

/**
 * Return the stored API key for a provider, or undefined when none is saved.
 * Shell environment keys are not read here; callers compose env precedence.
 */
export function getConfiguredProviderKey(provider: string): string | undefined {
  const info = getProviderSetupInfo(provider)
  if (!info) return undefined
  return readStoredProviderKeys()[info.envVar]
}

export function getConfiguredProviderNames(): ProviderSetupName[] {
  const storedKeys = readStoredProviderKeys()
  return (Object.keys(PROVIDER_SETUP_CONFIG) as ProviderSetupName[]).filter(
    (provider) => {
      const envVar = PROVIDER_SETUP_CONFIG[provider].envVar
      return Boolean(process.env[envVar]?.trim() || storedKeys[envVar])
    },
  )
}
