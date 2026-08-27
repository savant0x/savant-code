import { getAuthTokenDetails, getCredentialsPath } from './auth'
import {
  applyPersistedProviderApiKeys,
  getProviderSetupInfo,
  PROVIDER_SETUP_CONFIG,
  PROVIDER_SETUP_DEFAULT,
  type MissingProviderSetup,
  type ProviderSetupName,
} from './provider-key-store'
import {
  getActiveProvider,
  saveActiveProvider,
  saveSavantCodeModelProviderPreference,
} from './settings'

// Re-export the provider + research key surfaces from the original module
// path (call-graph preserved for consumers in commands/router/index).
export {
  PROVIDER_SETUP_CONFIG,
  PROVIDER_SETUP_DEFAULT,
  applyPersistedProviderApiKeys,
  configureDefaultDirectProvider,
  getConfiguredProviderKey,
  getConfiguredProviderNames,
  getProviderSetupInfo,
  saveProviderApiKey,
  type MissingProviderSetup,
  type ProviderSetupName,
} from './provider-key-store'
export {
  RESEARCH_KEY_SERVICES,
  applyPersistedResearchApiKeys,
  beginResearchKeySetup,
  getActiveResearchKeyService,
  getResearchKeyServiceInfo,
  saveResearchApiKey,
  type ResearchKeyService,
} from './research-key-store'

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
  // default). getActiveProvider() reads the persisted settings — the module
  // activeProvider var is interactive-session state for the /provider flow
  // (inputMode 'providerSetup'), not the persisted selection, so it must not
  // be consulted here (FID-2026-0822-010 follow-up test failure). Ollama needs
  // no key, so it never produces guidance.
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
