import type { OpenRouterModel } from './openrouter-models'

/**
 * FID-2026-1008-005 item 1: stale-while-revalidate for the /model picker.
 *
 * When the in-memory gateway catalog has rows, the picker opens immediately
 * from that snapshot and a background refresh replaces the rows if the picker
 * is still open. When the cache is cold, the picker waits for the first load
 * exactly as before. Seams are injected so the ordering is testable without a
 * renderer or network.
 */
export interface OpenModelPickerDeps {
  readCached: () => OpenRouterModel[]
  refresh: () => Promise<OpenRouterModel[]>
  open: (models: OpenRouterModel[]) => void
  setModels: (models: OpenRouterModel[]) => void
  isOpen: () => boolean
}

/** Returns true when the picker opened; false when no rows could be loaded. */
export async function openModelPicker(
  deps: OpenModelPickerDeps,
): Promise<boolean> {
  const cached = deps.readCached()
  if (cached.length > 0) {
    deps.open(cached)
    void deps
      .refresh()
      .then((fresh) => {
        if (fresh.length > 0 && deps.isOpen()) deps.setModels(fresh)
      })
      .catch(() => {
        // Background refresh is best-effort; the cached snapshot stays.
      })
    return true
  }
  const models = await deps.refresh()
  if (models.length === 0) return false
  deps.open(models)
  return true
}
