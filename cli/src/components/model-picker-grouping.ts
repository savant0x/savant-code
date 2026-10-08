import { advertisedModelVisible } from '@savant-code/common/providers/availability-state'
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { deriveProviderOrder } from '@savant-code/common/providers/derive'

import { FREE_BADGE, hasFreeToken } from '../utils/free-badge'

import type { OpenRouterModel } from '../utils/openrouter-models'

export type ModelProvider = NonNullable<OpenRouterModel['provider']>

export interface ModelItem {
  type: 'model'
  model: OpenRouterModel
  provider: ModelProvider
}

export interface HeaderItem {
  type: 'header'
  /** Provider-group headers carry the id; synthetic sections (free-key) null. */
  provider: ModelProvider | null
  /** Display text (provider uppercased, or the synthetic section title). */
  label: string
}

export type ListItem = ModelItem | HeaderItem

export function getProvider(model: OpenRouterModel): ModelProvider {
  return model.provider ?? 'openrouter'
}

/**
 * Registry group order for a provider — retained as the registry-derivation
 * contract (custom providers carry order 5), exercised by
 * `utils/__tests__/custom-catalog.test.ts`. The picker no longer groups by it:
 * `buildGroupedItems` orders provider groups alphabetically by id
 * (FID-2026-1007-017).
 */
export function getProviderOrder(provider: ModelProvider): number {
  return deriveProviderOrder(getEffectiveProviderRegistry(), provider)
}

export function buildGroupedItems(models: OpenRouterModel[]): ListItem[] {
  // FID-2026-1007-017: the ⭐ FREE KEY section hoists only the entries that
  // carry the free token THEMSELVES and renders NO key lane — the free-key
  // provider appears as an ordinary provider group (with its ⭐ rows), not as a
  // synthetic section header. Provider groups are ordered alphabetically by
  // provider id; the registry `order` field no longer drives picker grouping.
  const free: ModelItem[] = []
  const byProvider = new Map<ModelProvider, OpenRouterModel[]>()
  for (const model of models) {
    const provider = getProvider(model)
    if (!advertisedModelVisible(provider, model.id)) continue
    if (hasFreeToken(model)) {
      free.push({ type: 'model', model, provider })
      continue
    }
    const group = byProvider.get(provider) ?? []
    group.push(model)
    byProvider.set(provider, group)
  }

  const items: ListItem[] = []
  // Section first, when it has anything to say (hoisted free-token entries).
  // Absent otherwise, so provider-group ordering is untouched for input with
  // nothing free-related.
  if (free.length > 0) {
    free.sort((a, b) =>
      a.provider === b.provider
        ? a.model.id.localeCompare(b.model.id)
        : a.provider.localeCompare(b.provider),
    )
    items.push({
      type: 'header',
      provider: null,
      label: `${FREE_BADGE} FREE KEY`,
    })
    items.push(...free)
  }

  const providers = Array.from(byProvider.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  for (const provider of providers) {
    const group = byProvider.get(provider)
    if (!group || group.length === 0) continue
    group.sort((a, b) => a.id.localeCompare(b.id))
    items.push({
      type: 'header',
      provider,
      label: provider.toUpperCase(),
    })
    for (const model of group) {
      items.push({ type: 'model', model, provider })
    }
  }

  return items
}
