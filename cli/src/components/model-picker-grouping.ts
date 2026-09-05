import { deriveProviderOrder } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import type { OpenRouterModel } from '../utils/openrouter-models'

export type ModelProvider = NonNullable<OpenRouterModel['provider']>

export interface ModelItem {
  type: 'model'
  model: OpenRouterModel
  provider: ModelProvider
}

export interface HeaderItem {
  type: 'header'
  provider: ModelProvider
}

export type ListItem = ModelItem | HeaderItem

export function getProvider(model: OpenRouterModel): ModelProvider {
  return model.provider ?? 'openrouter'
}

export function getProviderOrder(provider: ModelProvider): number {
  // Derived from the registry (FID-2026-0809-001 Phase 1, delta (d)):
  // openrouter 0, tokenrouter 1, nvidia 2, opencode-go 3, and the 6-way tie
  // of tokenharbor/commandcode/ollama/cloudflare/kiosapi/opencode-zen at 4 —
  // replicating the historical switch exactly so picker ordering is unchanged.
  return deriveProviderOrder(PROVIDER_REGISTRY, provider)
}

export function buildGroupedItems(models: OpenRouterModel[]): ListItem[] {
  const byProvider = new Map<ModelProvider, OpenRouterModel[]>()
  for (const model of models) {
    const provider = getProvider(model)
    const group = byProvider.get(provider) ?? []
    group.push(model)
    byProvider.set(provider, group)
  }

  const providers = Array.from(byProvider.keys()).sort((a, b) => {
    const orderDiff = getProviderOrder(a) - getProviderOrder(b)
    if (orderDiff !== 0) return orderDiff
    return a.localeCompare(b)
  })

  const items: ListItem[] = []
  for (const provider of providers) {
    const group = byProvider.get(provider)
    if (!group || group.length === 0) continue
    group.sort((a, b) => a.id.localeCompare(b.id))
    items.push({ type: 'header', provider })
    for (const model of group) {
      items.push({ type: 'model', model, provider })
    }
  }

  return items
}
