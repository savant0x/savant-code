import fs from 'fs'

import { deriveSetupConfig } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { resetOpenRouterApiKeyCache } from '@savant-code/sdk'

import {
  getAuthToken,
  getAuthTokenDetails,
  getConfigDir,
  getCredentialsPath,
} from './auth'
import {
  getActiveProvider,
  loadActiveProvider,
  saveActiveProvider,
  saveSavantCodeModelProviderPreference,
} from './settings'

import type { JSONValue } from '@savant-code/common/types/json'

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

let activeProvider: ProviderSetupName = PROVIDER_SETUP_DEFAULT

export function beginProviderSetup(
  provider: string,
): ProviderSetupName | undefined {
  const info = getProviderSetupInfo(provider)
  if (!info) return undefined
  activeProvider = info.provider
  return activeProvider
}

export function getActiveProviderSetup(): ProviderSetupName {
  return activeProvider
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
 * Return setup metadata only when the active runtime needs a gateway key.
 * Backend credentials and local Ollama are intentionally not gateway setup
 * cases; direct-provider mode uses a stub backend token for bootstrapping.
 */
export function getMissingProviderSetup(): MissingProviderSetup | undefined {
  const authSource = getAuthTokenDetails().source
  if (authSource === 'credentials' || authSource === 'environment') {
    return undefined
  }

  const configuredProvider = process.env.DIRECT_PROVIDER?.trim()
  if (!configuredProvider && process.env.INFERENCE_BASE_URL?.trim()) {
    // A custom OpenAI-compatible endpoint has no provider-specific key
    // metadata; leave its authentication to the endpoint configuration.
    return undefined
  }

  // Readiness follows the active provider (Phase 4): shell DIRECT_PROVIDER
  // first, else the persisted selection (activeProvider -> picker preference ->
  // default). Ollama needs no key, so it never produces guidance.
  const provider = configuredProvider || getActiveProvider()
  if (provider.toLowerCase() === 'ollama') return undefined

  const info = getProviderSetupInfo(provider)
  if (!info || !process.env[info.envVar]?.trim()) return info
  return undefined
}

/**
 * Activate a provider that is already configured through the environment or
 * persisted provider-key store without asking the user to paste the key again.
 * Returns true when a usable key was found and the provider selection was
 * applied. Interactive selection is an explicit routing override; ordinary
 * startup configuration continues to preserve explicit shell routing.
 */
export function activateConfiguredProvider(
  provider: ProviderSetupName,
): boolean {
  const config = PROVIDER_SETUP_CONFIG[provider]
  applyPersistedProviderApiKeys()
  if (!process.env[config.envVar]?.trim()) return false

  // This function is called only after an explicit interactive provider
  // selection (/provider or the picker), so it intentionally replaces the
  // current bootstrap/custom route with the selected provider. The selected
  // provider's own shell key remains the credential source; stored keys are only
  // used when the shell has no key.
  process.env.DIRECT_PROVIDER = provider
  process.env.INFERENCE_BASE_URL = config.baseUrl
  saveSavantCodeModelProviderPreference(provider)
  saveActiveProvider(provider)
  return true
}

export function getProviderSetupGuidance(info: MissingProviderSetup): string {
  return [
    `${info.label} needs an API key before sending a prompt.`,
    `Run /provider ${info.provider} (or /provider) and paste the key into the masked prompt.`,
    `The key is stored globally at ${getCredentialsPath()} and is never added to chat history.`,
    `For automation, set ${info.envVar} in your shell before starting Savant-Code.`,
  ].join(' ')
}

function readCredentialsRecord(): Record<string, JSONValue> {
  const credentialsPath = getCredentialsPath()
  if (!fs.existsSync(credentialsPath)) return {}

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, JSONValue>
    }
  } catch {
    // Treat an unreadable credentials file as empty; auth.ts reports its own
    // parse diagnostics for the backend profile.
  }

  return {}
}

function readStoredProviderKeys(): Record<string, string> {
  const value = readCredentialsRecord().providerApiKeys
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const storedKeys: Record<string, string> = {}
  for (const [envVar, key] of Object.entries(value)) {
    if (typeof key === 'string' && key.trim().length > 0) {
      storedKeys[envVar] = key
    }
  }
  return storedKeys
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

// ─── Research API keys (BYOK) ────────────────────────────────────────────────
// FID-2026-0819-002: the research sources (Serper/Context7/Parallel/Tavily/Exa/
// Firecrawl) use the user's own keys. Saved to the same credentials.json (a
// `researchApiKeys` section alongside `providerApiKeys`), applied at boot, and
// never written to chat history — the same pattern as provider keys.

export const RESEARCH_KEY_SERVICES = {
  serper: { label: 'Serper', envVar: 'SERPER_API_KEY' },
  context7: { label: 'Context7', envVar: 'CONTEXT7_API_KEY' },
  parallel: { label: 'Parallel', envVar: 'PARALLEL_API_KEY' },
  tavily: { label: 'Tavily', envVar: 'TAVILY_API_KEY' },
  exa: { label: 'Exa', envVar: 'EXA_API_KEY' },
  firecrawl: { label: 'Firecrawl', envVar: 'FIRECRAWL_API_KEY' },
} as const

export type ResearchKeyService = keyof typeof RESEARCH_KEY_SERVICES

let activeResearchKeyService: ResearchKeyService = 'serper'

export function beginResearchKeySetup(
  service: string,
): ResearchKeyService | undefined {
  const normalized = service.trim().toLowerCase()
  if (!(normalized in RESEARCH_KEY_SERVICES)) return undefined
  activeResearchKeyService = normalized as ResearchKeyService
  return activeResearchKeyService
}

export function getActiveResearchKeyService(): ResearchKeyService {
  return activeResearchKeyService
}

export function getResearchKeyServiceInfo(
  service: string,
): { service: ResearchKeyService; label: string; envVar: string } | undefined {
  const normalized = service.trim().toLowerCase()
  if (!(normalized in RESEARCH_KEY_SERVICES)) return undefined
  const name = normalized as ResearchKeyService
  return { service: name, ...RESEARCH_KEY_SERVICES[name] }
}

function readStoredResearchKeys(): Record<string, string> {
  const value = readCredentialsRecord().researchApiKeys
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const storedKeys: Record<string, string> = {}
  for (const [envVar, key] of Object.entries(value)) {
    if (typeof key === 'string' && key.trim().length > 0) {
      storedKeys[envVar] = key
    }
  }
  return storedKeys
}

/** Apply persisted research keys without overriding explicit shell env. */
export function applyPersistedResearchApiKeys(): void {
  const storedKeys = readStoredResearchKeys()
  for (const config of Object.values(RESEARCH_KEY_SERVICES)) {
    if (process.env[config.envVar]?.trim()) continue
    const storedKey = storedKeys[config.envVar]
    if (storedKey) process.env[config.envVar] = storedKey
  }
}

/** Save one research key and make it available to the current process. */
export function saveResearchApiKey(
  service: ResearchKeyService,
  apiKey: string,
): void {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error('Research API key cannot be empty.')
  }

  const config = RESEARCH_KEY_SERVICES[service]
  const credentialsPath = getCredentialsPath()
  const existing = readCredentialsRecord()
  const existingKeys = readStoredResearchKeys()

  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true })
  }

  const updated = {
    ...existing,
    researchApiKeys: {
      ...existingKeys,
      [config.envVar]: trimmedKey,
    },
  }
  fs.writeFileSync(credentialsPath, JSON.stringify(updated, null, 2))

  try {
    fs.chmodSync(credentialsPath, 0o600)
  } catch {
    // Best effort only; do not make a valid Windows setup fail.
  }

  if (!process.env[config.envVar]?.trim()) {
    process.env[config.envVar] = trimmedKey
  }
}
