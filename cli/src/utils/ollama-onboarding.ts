import { detectOllama } from '@savant-code/llm-providers/ollama'

import { getAuthToken } from './auth'
import { logger } from './logger'
import {
  loadSavantCodeModelPreference,
  loadSettings,
  saveSettings,
} from './settings'

/**
 * Whether Ollama was auto-configured as the default provider in this session.
 * Exported so callers can avoid prompting the user again.
 */
let ollamaAutoConfigured = false

export function isOllamaAutoConfigured(): boolean {
  return ollamaAutoConfigured
}

/** Test-only helper to reset the module-level auto-config flag. */
export function __resetOllamaAutoConfigured(): void {
  ollamaAutoConfigured = false
}

/**
 * Apply persisted direct-provider settings to the current process. This lets
 * users who previously chose local Ollama keep using it across launches
 * without re-detection.
 *
 * Intentionally skips when a real SavantCode backend token is present so that
 * logging in always takes precedence over a previous local-only setup.
 */
export function applyPersistedDirectProviderSettings(): void {
  // A real backend token means the user wants the SavantCode backend, not a
  // previously persisted local provider.
  if (getAuthToken()) {
    return
  }

  const settings = loadSettings()
  if (settings.directProvider === 'ollama' && settings.directProviderBaseUrl) {
    try {
      // Validate the persisted URL before using it.
      new URL(settings.directProviderBaseUrl)
    } catch {
      logger.warn(
        { baseUrl: settings.directProviderBaseUrl },
        'Ignoring malformed persisted direct-provider base URL',
      )
      return
    }
    process.env.DIRECT_PROVIDER = 'ollama'
    process.env.INFERENCE_BASE_URL = settings.directProviderBaseUrl
    ollamaAutoConfigured = true
  }
}

/**
 * On first run, if the user has no SavantCode backend token and has not
 * explicitly chosen a direct provider, detect a local Ollama instance and
 * automatically route inference to it.
 *
 * This makes the "single-command install" path frictionless: users with
 * `ollama serve` running can start coding immediately without creating an
 * account or entering an API key.
 */
export async function detectOllamaAndConfigureDirectProvider(): Promise<void> {
  // Respect explicit user configuration: if a backend token or direct provider
  // is already set, do not override it.
  const hasBackendToken = Boolean(getAuthToken())
  const hasDirectProviderEnv =
    (process.env.DIRECT_PROVIDER ?? '').trim().length > 0 ||
    (process.env.INFERENCE_BASE_URL ?? '').trim().length > 0

  if (hasBackendToken || hasDirectProviderEnv) {
    return
  }

  // If the user has already chosen a savant-code model preference, they have
  // already interacted with the model picker; leave them alone.
  if (loadSavantCodeModelPreference()) {
    return
  }

  logger.debug({}, 'Detecting local Ollama instance for frictionless onboarding')

  const ollama = await detectOllama()

  if (!ollama.available) {
    logger.debug(
      { error: ollama.error },
      'Ollama not detected; leaving provider mode unset',
    )
    return
  }

  // Derive the OpenAI-compatible base URL from the detected host. This
  // preserves custom OLLAMA_HOST values (e.g. a remote or port-forwarded
  // Ollama instance).
  const baseUrl = ollama.host.endsWith('/v1')
    ? ollama.host
    : `${ollama.host}/v1`

  process.env.DIRECT_PROVIDER = 'ollama'
  process.env.INFERENCE_BASE_URL = baseUrl
  ollamaAutoConfigured = true

  // Persist the choice so future launches reuse it. The actual model id will
  // be resolved by the SDK from the Ollama /models endpoint at run time.
  saveSettings({
    savantCodeModelProviderPreference: 'ollama',
    directProvider: 'ollama',
    directProviderBaseUrl: baseUrl,
  })

  logger.info(
    { host: ollama.host, models: ollama.models.length },
    'Auto-configured Ollama direct-provider mode',
  )
}
