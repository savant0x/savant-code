import fs from 'fs'

import {
  getAuthToken,
  getAuthTokenDetails,
  getConfigDir,
  getCredentialsPath,
} from './auth'
import {
  DEFAULT_SAVANT_CODE_MODEL_PROVIDER,
  loadSavantCodeModelProviderPreference,
  saveSettings,
} from './settings'

import type { JSONValue } from '@savant-code/common/types/json'

export const PROVIDER_SETUP_DEFAULT = 'opencode-go' as const

export const PROVIDER_SETUP_CONFIG = {
  'opencode-go': {
    label: 'OpenCode Go',
    envVar: 'OPENCODE_GO_API_KEY',
    baseUrl: 'https://opencode.ai/zen/go/v1',
  },
  tokenrouter: {
    label: 'TokenRouter',
    envVar: 'TOKENROUTER_API_KEY',
    baseUrl: 'https://api.tokenrouter.com/v1',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    envVar: 'NVIDIA_API_KEY',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
  },
  commandcode: {
    label: 'CommandCode',
    envVar: 'COMMAND_CODE_API_KEY',
    baseUrl: 'https://api.commandcode.ai/provider/v1',
  },
} as const

export type ProviderSetupName = keyof typeof PROVIDER_SETUP_CONFIG

export type MissingProviderSetup = (typeof PROVIDER_SETUP_CONFIG)[ProviderSetupName] & {
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

  const provider = configuredProvider || PROVIDER_SETUP_DEFAULT
  if (provider.toLowerCase() === 'ollama') return undefined

  const info = getProviderSetupInfo(provider)
  if (!info || !process.env[info.envVar]?.trim()) return info
  return undefined
}

export function getProviderSetupGuidance(
  info: MissingProviderSetup,
): string {
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

  const provider =
    loadSavantCodeModelProviderPreference() ??
    DEFAULT_SAVANT_CODE_MODEL_PROVIDER
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

  process.env[config.envVar] = trimmedKey
  process.env.DIRECT_PROVIDER = provider
  process.env.INFERENCE_BASE_URL = config.baseUrl
  saveSettings({
    savantCodeModelProviderPreference: provider,
    directProvider: provider,
    directProviderBaseUrl: config.baseUrl,
  })
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
