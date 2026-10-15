import type { OpenRouterModel } from './openrouter-models'

/**
 * FID-2026-1008-005 item 1: stale-while-revalidate for the /model picker.
 *
 * When the in-memory gateway catalog has rows, the picker opens immediately
 * from that snapshot and a background refresh replaces the rows if the picker
 * is still open. When the cache is cold, the picker waits for the first load
 * exactly as before. Seams are injected so the ordering is testable without a
 * renderer or network.
 *
 * FID-2026-1009-005: the picker also carries the UNAVAILABLE provider set —
 * registered live providers whose catalog contributed zero rows (the
 * CodeCraft stale-key class, where a keyed provider vanished from /model
 * with only a developer-facing logger warning). The set comes from the
 * existing coverage seam (`computeCatalogGaps`), never a parallel detector.
 */
export interface OpenModelPickerDeps {
  readCached: () => OpenRouterModel[]
  refresh: () => Promise<OpenRouterModel[]>
  /**
   * Keyed live providers with zero rows in the given catalog. Optional so
   * existing callers keep their shape; absent means no unavailable groups.
   */
  readUnavailable?: (models: OpenRouterModel[]) => Promise<readonly string[]>
  open: (models: OpenRouterModel[], unavailable?: readonly string[]) => void
  setModels: (
    models: OpenRouterModel[],
    unavailable?: readonly string[],
  ) => void
  isOpen: () => boolean
}

async function resolveUnavailable(
  deps: OpenModelPickerDeps,
  models: OpenRouterModel[],
): Promise<readonly string[]> {
  if (!deps.readUnavailable) return []
  try {
    return await deps.readUnavailable(models)
  } catch {
    // The visibility signal is best-effort; a resolver failure must never
    // block the picker from opening.
    return []
  }
}

/** Returns true when the picker opened; false when no rows could be loaded. */
export async function openModelPicker(
  deps: OpenModelPickerDeps,
): Promise<boolean> {
  const cached = deps.readCached()
  if (cached.length > 0) {
    const unavailable = await resolveUnavailable(deps, cached)
    deps.open(cached, unavailable)
    void deps
      .refresh()
      .then(async (fresh) => {
        if (fresh.length > 0 && deps.isOpen()) {
          deps.setModels(fresh, await resolveUnavailable(deps, fresh))
        }
      })
      .catch(() => {
        // Background refresh is best-effort; the cached snapshot stays.
      })
    return true
  }
  const models = await deps.refresh()
  if (models.length === 0) return false
  deps.open(models, await resolveUnavailable(deps, models))
  return true
}
