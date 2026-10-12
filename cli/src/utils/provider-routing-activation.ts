import { captureModelRoute } from '@savant-code/common/providers/model-route'

import { loadSavantCodeModelPreference, saveModelSelection } from './settings'

import type { ProviderSetupInfo } from '@savant-code/common/providers/derive'

/**
 * Apply the direct-provider routing/activation effects of a saved primary key.
 *
 * Extracted from `provider-key-store.ts` at the 300-line quality ceiling. The
 * function is pure with respect to its inputs — it reads only the process env
 * and the two settings helpers (no registry lookup), so the seam has no
 * dependency back on the key store (no cycle).
 */
export function activateProviderRouting(
  provider: string,
  config: ProviderSetupInfo,
): void {
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
    // Step 9 (FID-2026-0910-004 D8): the caller validates the id against the
    // effective setup set; no cast is needed at this seam.
    saveModelSelection(
      loadSavantCodeModelPreference() ?? 'openrouter/free',
      captureModelRoute(provider),
    )
  }
}
