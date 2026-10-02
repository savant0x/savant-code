/**
 * FID-2026-0928-012 — custats catalog lift (pure).
 *
 * Own module so the untrusted-input defensive lift stays testable and
 * cycle-free: `free-options.ts` re-exports `liftCatalog`, keeping ONE import
 * surface for callers (Law 13) while the file split keeps both modules under
 * the 300-line ceiling (FID-2026-1001-002 Loop 2).
 */
import type {
  FreeCatalogEnvelope,
  FreeCatalogModel,
} from './free-options-types'

/** Defensive lift; null on structural mismatch (untrusted input). */
export function liftCatalog(raw: unknown): FreeCatalogEnvelope | null {
  if (typeof raw !== 'object' || raw === null) return null
  const j = raw as Record<string, unknown>
  const fetchedAt = typeof j['fetchedAt'] === 'string' ? j['fetchedAt'] : null
  if (!fetchedAt || !Array.isArray(j['models'])) return null
  const models: FreeCatalogModel[] = []
  for (const entry of j['models']) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const id = typeof e['id'] === 'string' ? e['id'] : null
    const providerId =
      typeof e['providerId'] === 'string' ? e['providerId'] : null
    if (!id || !providerId) continue
    const contextLength =
      typeof e['context_length'] === 'number' ? e['context_length'] : null
    models.push({ id, providerId, context_length: contextLength })
  }
  const newModelIds = Array.isArray(j['newModelIds'])
    ? j['newModelIds'].filter((v): v is string => typeof v === 'string')
    : []
  const archivedModels: FreeCatalogEnvelope['archivedModels'] = []
  if (Array.isArray(j['archivedModels'])) {
    for (const entry of j['archivedModels']) {
      if (typeof entry !== 'object' || entry === null) continue
      const a = entry as Record<string, unknown>
      const id = typeof a['id'] === 'string' ? a['id'] : null
      const removedAt =
        typeof a['removedAt'] === 'string' ? a['removedAt'] : null
      if (id && removedAt) {
        archivedModels.push({
          id,
          providerId:
            typeof a['providerId'] === 'string' ? a['providerId'] : null,
          removedAt,
        })
      }
    }
  }
  return {
    fetchedAt,
    totalModels:
      typeof j['totalModels'] === 'number' ? j['totalModels'] : models.length,
    models,
    newModelIds,
    archivedModels,
  }
}
