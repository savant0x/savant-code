import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { hasProviderCredentials } from '@savant-code/common/providers/readiness'

import { getAuthTokenDetails, getCredentialsPath } from './auth'
import {
  getEffectiveProviderSetupConfig,
  applyPersistedProviderApiKeys,
  getProviderSetupInfo,
  PROVIDER_SETUP_DEFAULT,
  type MissingProviderSetup,
  type ProviderSetupName,
} from './provider-key-store'
import {
  getActiveProvider,
  loadSavantCodeModelPreference,
  saveSavantCodeModelProviderPreference,
  selectModelForProvider,
} from './settings'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'

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
  saveProviderApiKeyExtra,
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

/**
 * Dual-credential setup state (T61 Option A, FID-2026-0928-008): after the
 * primary key is saved, the setup flow may still owe the operator prompts
 * for `extraEnvVars` credentials (Cloudflare's account id). The queue holds
 * the remaining extras for the ACTIVE setup session only; it is not
 * persisted and is cleared when consumed or replaced.
 */
let pendingExtraCredentials: Array<{ envVar: string; label: string }> = []

/** Begin key setup for a provider and stage its extra-credential prompts. */
export function beginProviderSetup(
  provider: string,
): ProviderSetupName | undefined {
  const info = getProviderSetupInfo(provider)
  if (!info) return undefined
  activeProvider = info.provider
  pendingExtraCredentials = info.extraEnvVars
    ? info.extraEnvVars.filter((e) => !process.env[e.envVar]?.trim())
    : []
  return activeProvider
}

export function getActiveProviderSetup(): ProviderSetupName {
  return activeProvider
}

/** The next staged extra credential for the active setup, if any remain. */
export function getNextPendingExtraCredential():
  { envVar: string; label: string } | undefined {
  return pendingExtraCredentials[0]
}

/**
 * Consume the next staged extra credential (call after its value is
 * saved). Returns the one just consumed so the caller can reference it.
 */
export function consumeNextPendingExtraCredential():
  { envVar: string; label: string } | undefined {
  return pendingExtraCredentials.shift()
}

/** Drop any staged extra-credential prompts (setup cancelled/completed). */
export function clearPendingExtraCredentials(): void {
  pendingExtraCredentials = []
}

/**
 * Return setup metadata only when the active runtime needs a gateway key.
 * Local Ollama is intentionally not a gateway setup case.
 * FID-2026-0929-005: the backend-credential bypass ('environment' source) is
 * deleted with the credential it keyed on — a stored credentials.json token
 * is inert residue and no longer suppresses setup guidance.
 */
export function getMissingProviderSetup(): MissingProviderSetup | undefined {
  const authSource = getAuthTokenDetails().source
  if (authSource === 'credentials') {
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
  if (
    !info ||
    !hasProviderCredentials(
      getEffectiveProviderRegistry()[provider],
      process.env,
    )
  )
    return info
  return undefined
}

/**
 * Activate a provider that is already configured through the environment or
 * persisted provider-key store without asking the user to paste the key again.
 * Returns true when a usable key was found and the provider selection was
 * applied. Interactive selection is an explicit routing override; ordinary
 * startup configuration continues to preserve explicit shell routing.
 */
export function activateConfiguredProvider(provider: string): boolean {
  // Effective view (FID-2026-0910-004 Step 6): customs activate exactly like
  // built-ins once registered.
  const config = getEffectiveProviderSetupConfig()[provider]
  if (!config) return false
  applyPersistedProviderApiKeys()
  if (
    !hasProviderCredentials(
      getEffectiveProviderRegistry()[provider],
      process.env,
    )
  )
    return false

  // This function is called only after an explicit interactive provider
  // selection (/provider or the picker), so it intentionally replaces the
  // current bootstrap/custom route with the selected provider. The selected
  // provider's own shell key remains the credential source; stored keys are only
  // used when the shell has no key.
  commitProviderSelection(
    loadSavantCodeModelPreference() ?? 'openrouter/free',
    provider,
    config.baseUrl,
  )
  return true
}

/**
 * FID-2026-1008-005 item 3: true when a registry provider has setup metadata
 * but no usable credentials yet ("Not wired"). Picking its model starts the
 * key flow instead of activating the provider. Ollama needs no key.
 */
export function isModelProviderUnwired(provider: string): boolean {
  if (provider.toLowerCase() === 'ollama') return false
  if (!getProviderSetupInfo(provider)) return false
  return !hasProviderCredentials(
    getEffectiveProviderRegistry()[provider],
    process.env,
  )
}

/**
 * Apply a /model-picker selection end to end (FID-2026-0917-005).
 *
 * Resolves the model's provider (defaulting to 'openrouter' when unset),
 * persists the model preference, and activates the provider's runtime
 * routing via the same guarded seam the /provider picker uses. Without this,
 * the picker persisted the preference only — DIRECT_PROVIDER /
 * INFERENCE_BASE_URL stayed empty, so every downstream gate
 * (isDirectProviderMode, useUsageMonitor, getModelForRequest) saw no active
 * provider and requests passthrough-ed to the SavantCode backend
 * (402 "Out of credits").
 *
 * The provider preference is persisted when activation declines (unkeyed
 * provider) so the next /model open still defaults to that section;
 * activateConfiguredProvider persists it itself on success, so the write is
 * not duplicated on the happy path.
 */
export function applyModelPickerSelection(model: {
  id: string
  provider?: string
}): void {
  const provider = model.provider ?? 'openrouter'
  // The selection is persisted atomically with the SELECTED ROW's provider
  // (D7) — never inferred from the model id or the previous selection — so a
  // declined activation still records an identity-consistent route.
  selectModelForProvider(model.id, provider)
  const activated = activateConfiguredProvider(provider)
  if (!activated) {
    saveSavantCodeModelProviderPreference(provider)
  }
}

function commitProviderSelection(
  model: string,
  provider: string,
  baseUrl?: string,
): void {
  const priorProvider = process.env.DIRECT_PROVIDER
  const priorUrl = process.env.INFERENCE_BASE_URL
  try {
    process.env.DIRECT_PROVIDER = provider
    if (baseUrl) process.env.INFERENCE_BASE_URL = baseUrl
    useSavantFreeModelStore
      .getState()
      .switchModel(model, captureModelRoute(provider))
  } catch (error) {
    if (priorProvider === undefined) delete process.env.DIRECT_PROVIDER
    else process.env.DIRECT_PROVIDER = priorProvider
    if (priorUrl === undefined) delete process.env.INFERENCE_BASE_URL
    else process.env.INFERENCE_BASE_URL = priorUrl
    throw error
  }
}

export function getProviderSetupGuidance(info: MissingProviderSetup): string {
  return [
    `${info.label} needs an API key before sending a prompt.`,
    `Run /provider ${info.provider} (or /provider) and paste the key into the masked prompt.`,
    `The key is stored globally at ${getCredentialsPath()} and is never added to chat history.`,
    `For automation, set ${info.envVar} in your shell before starting Savant-Code.`,
  ].join(' ')
}

/**
 * Test isolation: restores the interactive setup selection to its default and
 * drops the staged extra-credential prompts — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 */
export function resetProviderSetupState(): void {
  activeProvider = PROVIDER_SETUP_DEFAULT
  pendingExtraCredentials = []
}
