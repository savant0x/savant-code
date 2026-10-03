import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { captureModelRoute } from '@savant-code/common/providers/model-route'
import {
  canonicalProviderId,
  hasProviderCredentials,
} from '@savant-code/common/providers/readiness'

import { readCachedFreeCatalog, isCacheFresh } from './free-options'
import { readStoredProviderKeys } from './provider-credentials'
import { providerNotifications } from './provider-notifications'
import { loadSettings } from './settings'

import type { ProviderAlternative } from '@savant-code/common/providers/provider-alternatives'

/** Profile cache only: a project does not need the developer harvester tree. */
export function readProviderAlternatives(
  now = Date.now(),
): ProviderAlternative[] {
  loadSettings()
  const catalog = readCachedFreeCatalog()
  if (!catalog || !isCacheFresh(catalog.fetchedAt, now)) return []
  const registry = getEffectiveProviderRegistry()
  const state = providerNotifications.storage.read()
  const values = {
    ...readStoredProviderKeys(),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v?.trim()),
    ),
  }
  return catalog.models.flatMap((model) => {
    const providerId = canonicalProviderId(model.providerId)
    if (!Object.hasOwn(registry, providerId)) return []
    const config = registry[providerId]
    try {
      return [
        {
          providerId,
          host: new URL(config.baseUrl).hostname,
          modelId: model.id,
          observedAt: Math.min(
            Date.parse(catalog.fetchedAt),
            state.sourceTimes[`health-${providerId}`] ?? 0,
          ),
          supported: true,
          credentialReady: hasProviderCredentials(config, values),
          boundary:
            state.facts[`health-config:${providerId}`] ===
              captureModelRoute(providerId).configRevision &&
            state.facts[`health-${providerId}:${providerId}`] === 'up-verified'
              ? 'boundary-ok'
              : 'boundary-unverifiable',
        },
      ]
    } catch {
      return []
    }
  })
}
