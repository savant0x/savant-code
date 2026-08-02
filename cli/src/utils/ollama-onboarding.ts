import {
  detectOllama,
  type OllamaDetectionResult,
} from '@savant-code/llm-providers/ollama'

import { getAuthToken, getAuthTokenDetails } from './auth'
import { logger } from './logger'
import {
  DEFAULT_SAVANT_CODE_MODEL_ID,
  loadSettings,
  saveSettings,
} from './settings'

/**
 * Whether Ollama was auto-configured as the default provider in this session.
 * Exported so callers can avoid prompting the user again.
 */
let ollamaAutoConfigured = false

/**
 * Pick a model that Ollama can serve locally. Cloud-backed Ollama entries are
 * excluded because they still require remote provider authentication.
 */
export function selectLocalOllamaModel(models: string[]): string | undefined {
  // Cloud-backed, embedding, and reranking models cannot serve chat
  // completions through the OpenAI-compatible endpoint.
  const usableModels = models.filter((model) => {
    const normalized = model.toLowerCase()
    return (
      !normalized.endsWith(':cloud') &&
      !normalized.includes('embed') &&
      !normalized.includes('rerank')
    )
  })

  // Prefer coding/chat models when several local models are installed, while
  // retaining a deterministic fallback for arbitrary Ollama model names.
  return (
    usableModels.find((model) =>
      /code|coder|chat|instruct|llama|qwen|mistral|deepseek|gemma/i.test(model),
    ) ?? usableModels[0]
  )
}

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

  // A direct provider already present in the environment was selected by the
  // shell or restored from a saved provider key; it takes precedence over an
  // older persisted Ollama choice.
  if (
    process.env.DIRECT_PROVIDER?.trim() ||
    process.env.INFERENCE_BASE_URL?.trim()
  ) {
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
export async function detectOllamaAndConfigureDirectProvider(
  detect: () => Promise<OllamaDetectionResult> = detectOllama,
): Promise<void> {
  // Respect explicit user configuration: if a real backend token or direct
  // provider is already set, do not override it. Direct-provider mode returns
  // a stub bypass token from auth.ts; that is not backend authentication and
  // must not prevent stale Ollama re-probing.
  const authSource = getAuthTokenDetails().source
  const hasBackendToken =
    authSource === 'credentials' || authSource === 'environment'
  const hasDirectProviderEnv =
    (process.env.DIRECT_PROVIDER ?? '').trim().length > 0 ||
    (process.env.INFERENCE_BASE_URL ?? '').trim().length > 0

  // `applyPersistedDirectProviderSettings` marks persisted Ollama state as
  // auto-configured. Re-probe that state so a stale gateway model preference
  // is replaced by a real local Ollama model. Explicit shell configuration is
  // never overridden. A non-default, non-auto-configured model is also an
  // explicit user choice and must not be silently replaced by local detection.
  const settings = loadSettings()
  const hasExplicitNonOllamaModelChoice =
    settings.savantCodeModelAutoConfigured !== true &&
    settings.savantCodeModelPreference !== undefined &&
    settings.savantCodeModelPreference !== DEFAULT_SAVANT_CODE_MODEL_ID &&
    settings.savantCodeModelProviderPreference !== 'ollama'

  if (
    hasBackendToken ||
    (hasDirectProviderEnv && !ollamaAutoConfigured) ||
    (!hasDirectProviderEnv && hasExplicitNonOllamaModelChoice)
  ) {
    return
  }

  logger.debug({}, 'Detecting local Ollama instance for frictionless onboarding')

  const ollama = await detect()

  const localModel = ollama.available
    ? selectLocalOllamaModel(ollama.models)
    : undefined

  if (!ollama.available || !localModel) {
    // A previously auto-configured Ollama session must not leave a stale
    // direct-provider environment behind when Ollama disappears or has no
    // usable chat model. Require an exact persisted/current-environment match
    // so an explicitly configured shell provider is never cleared.
    const persistedOllamaMatchesCurrentEnvironment =
      settings.directProvider === 'ollama' &&
      settings.directProviderBaseUrl === process.env.INFERENCE_BASE_URL &&
      process.env.DIRECT_PROVIDER === 'ollama'

    if (ollamaAutoConfigured && persistedOllamaMatchesCurrentEnvironment) {
      delete process.env.DIRECT_PROVIDER
      delete process.env.INFERENCE_BASE_URL
      ollamaAutoConfigured = false
      // Remove the persisted auto-provider fields as well. Otherwise the next
      // launch reapplies the same stale state before probing Ollama again.
      saveSettings({
        directProvider: undefined,
        directProviderBaseUrl: undefined,
        savantCodeModelPreference: DEFAULT_SAVANT_CODE_MODEL_ID,
        savantCodeModelProviderPreference: 'opencode-go',
        savantCodeModelAutoConfigured: false,
      })
    }
    logger.debug(
      { error: ollama.error, host: ollama.host },
      'Ollama unavailable or has no local chat model; direct provider disabled',
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

  // Persist both the provider and a real local model. Replace the gateway
  // default, a prior automatic choice, or a model selected for another
  // provider. Preserve an explicitly selected Ollama model across launches.
  const shouldSelectLocalModel =
    settings.savantCodeModelAutoConfigured === true ||
    settings.savantCodeModelPreference === DEFAULT_SAVANT_CODE_MODEL_ID ||
    settings.savantCodeModelProviderPreference !== 'ollama'

  saveSettings({
    savantCodeModelPreference: shouldSelectLocalModel
      ? localModel
      : settings.savantCodeModelPreference,
    savantCodeModelProviderPreference: 'ollama',
    savantCodeModelAutoConfigured: shouldSelectLocalModel,
    directProvider: 'ollama',
    directProviderBaseUrl: baseUrl,
  })

  logger.info(
    { host: ollama.host, models: ollama.models.length },
    'Auto-configured Ollama direct-provider mode',
  )
}
