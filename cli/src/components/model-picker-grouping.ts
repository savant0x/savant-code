import { advertisedModelVisible } from '@savant-code/common/providers/availability-state'
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { deriveProviderOrder } from '@savant-code/common/providers/derive'

import {
  FREE_BADGE,
  FREE_KEY_PROVIDERS,
  hasFreeToken,
  isFreeKeyProvider,
} from '../utils/free-badge'

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

/**
 * The blank free-key placeholder row (FID-2026-1005-010): names the key
 * slot and its readiness — never renders key material.
 */
export interface KeyItem {
  type: 'key'
  envVar: string
  ready: boolean
}

export type ListItem = ModelItem | HeaderItem | KeyItem

export function getProvider(model: OpenRouterModel): ModelProvider {
  return model.provider ?? 'openrouter'
}

export function getProviderOrder(provider: ModelProvider): number {
  // Derived from the registry (FID-2026-0809-001 Phase 1, delta (d)):
  // openrouter 0, tokenrouter 1, nvidia 2, and the order-4 tie
  // of tokenharbor/commandcode/ollama/cloudflare/kiosapi —
  // replicating the historical switch exactly so picker ordering is unchanged.
  // Step 9 remainder (D9): the EFFECTIVE registry is the order source —
  // custom providers carry order 5 from `toProviderConfig`, so they group
  // after every built-in; the built-in-only registry would tie them at the
  // unknown-id fallback (4).
  return deriveProviderOrder(getEffectiveProviderRegistry(), provider)
}

/**
 * The blank key-slot rows for the free-key section — one per free key whose
 * provider ACTUALLY contributed rows to this list (FID-2026-1007-005). A key
 * lane names a slot the operator can fill, so rendering one for a provider with
 * no rows was a promise with nothing behind it: the list asked for
 * `CHATANYWHERE_API_KEY` while containing no chatanywhere model at all.
 */
function freeKeyItems(presentProviders: ReadonlySet<string>): KeyItem[] {
  return FREE_KEY_PROVIDERS.filter(({ provider }) =>
    presentProviders.has(provider),
  ).map(({ envVar }) => ({
    type: 'key' as const,
    envVar,
    ready: (process.env[envVar] ?? '').length > 0,
  }))
}

export function buildGroupedItems(models: OpenRouterModel[]): ListItem[] {
  // FID-2026-1007-005: the FREE KEY section hoists the entries that carry the
  // free token THEMSELVES (FID-2026-1005-010's original rule for free-named
  // ids, unchanged), and never relocates a whole provider roster: a row from a
  // free-key provider stays in its own provider group and is starred there by
  // `freeBadgeFor`. The key slot is emitted only for a free-key provider that
  // contributed rows, so the section can no longer advertise a lane with
  // nothing behind it.
  const free: ModelItem[] = []
  const presentKeyProviders = new Set<string>()
  const byProvider = new Map<ModelProvider, OpenRouterModel[]>()
  for (const model of models) {
    const provider = getProvider(model)
    if (!advertisedModelVisible(provider, model.id)) continue
    if (isFreeKeyProvider(provider)) presentKeyProviders.add(provider)
    if (hasFreeToken(model)) {
      free.push({ type: 'model', model, provider })
      continue
    }
    const group = byProvider.get(provider) ?? []
    group.push(model)
    byProvider.set(provider, group)
  }

  const items: ListItem[] = []
  const keyItems = freeKeyItems(presentKeyProviders)
  // Section first, when it has anything to say — either hoisted free-token
  // entries or a free-key slot whose provider is present. Absent otherwise, so
  // provider-group ordering is untouched for input with neither.
  if (free.length > 0 || keyItems.length > 0) {
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
    items.push(...keyItems)
    items.push(...free)
  }

  const providers = Array.from(byProvider.keys()).sort((a, b) => {
    const orderDiff = getProviderOrder(a) - getProviderOrder(b)
    if (orderDiff !== 0) return orderDiff
    return a.localeCompare(b)
  })

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
