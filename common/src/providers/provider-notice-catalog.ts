import { canonicalProviderId } from './readiness'

import type {
  ProviderFact,
  ProviderNoticeState,
} from './provider-notifications'

export type NoticeCatalog = {
  fetchedAt: string
  totalModels: number
  models: Array<{
    id: string
    providerId: string
    expirationDate?: string | null
  }>
}

export function catalogProviderFacts(
  catalog: NoticeCatalog,
  state: ProviderNoticeState,
  selected: { model: string; providerId?: string },
  now: number,
): ProviderFact[] | null {
  const at = Date.parse(catalog.fetchedAt)
  const selectedModel =
    selected.providerId &&
    selected.providerId !== 'openrouter' &&
    selected.model.startsWith(`${selected.providerId}/`)
      ? selected.model.slice(selected.providerId.length + 1)
      : selected.model
  if (
    catalog.totalModels !== catalog.models.length ||
    !Number.isFinite(at) ||
    at > now ||
    now - at > 24 * 3600_000
  )
    return null
  const unique = new Map<string, NoticeCatalog['models'][number]>()
  for (const row of catalog.models) {
    if (!row.id || !row.providerId) return null
    const key = JSON.stringify([canonicalProviderId(row.providerId), row.id])
    if (unique.has(key)) return null
    unique.set(key, row)
  }
  const facts: ProviderFact[] = []
  for (const [key, row] of unique) {
    const providerId = canonicalProviderId(row.providerId)
    const isSelected =
      selectedModel === row.id && selected.providerId === providerId
    facts.push({
      key,
      value: 'available',
      providerId,
      modelId: row.id,
      selected: isSelected,
      kind: 'model-added',
      severity: 'info',
      message: `${providerId}: ${row.id} is advertised in the free catalog. Account access is unverified.`,
    })
    const deadline =
      row.expirationDate &&
      /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(row.expirationDate)
        ? Date.parse(row.expirationDate)
        : NaN
    const left = deadline - now
    const window =
      left <= 0
        ? 'expired'
        : left <= 24 * 3600_000
          ? '24h'
          : left <= 72 * 3600_000
            ? '72h'
            : undefined
    if (Number.isFinite(deadline) && window)
      facts.push({
        key: `expiry:${key}:${deadline}`,
        value: window,
        providerId,
        modelId: row.id,
        selected: isSelected,
        kind: 'expiry',
        severity: window === 'expired' ? 'critical' : 'warning',
        message: `${providerId}: advertised availability for ${row.id} ${window === 'expired' ? 'expired' : `ends within ${window}`}. This does not establish account credits.`,
      })
  }
  for (const key of Object.keys(state.facts)) {
    if (!key.startsWith('catalog:[')) continue
    const identity = key.slice('catalog:'.length)
    if (unique.has(identity)) continue
    const row = JSON.parse(identity) as [string, string]
    facts.push({
      key: identity,
      value: 'removed',
      providerId: row[0],
      modelId: row[1],
      selected: selected.providerId === row[0] && selectedModel === row[1],
      kind: 'model-removed',
      severity: 'warning',
      message: `${row[0]}: ${row[1]} is no longer advertised in the complete free catalog. Your model selection is unchanged.`,
    })
  }
  return facts
}
