import { create } from 'zustand'

import {
  getCachedGatewayModels,
  subscribeGatewayCatalog,
  type OpenRouterModel,
} from '../utils/openrouter-models'

/**
 * Reactive gateway model catalog.
 *
 * This store mirrors the cache held in `openrouter-models.ts`. Whenever the
 * combined gateway catalog is populated or refreshed, the store updates so
 * React subscribers can react without polling. It is populated lazily: the
 * catalog is empty until a caller (e.g., the `/model` command) fetches it.
 */
interface GatewayCatalogStore {
  /** Combined gateway catalog (OpenRouter + TokenRouter + NVIDIA + OpenCode Go). */
  catalog: OpenRouterModel[]
  /**
   * Timestamp (ms) of the most recent catalog load. Starts at 0 until the first
   * successful load. Components can depend on this primitive in effects to
   * refresh derived values such as the sidebar context-window max.
   */
  lastLoadedAt: number
  /** Update the stored catalog. Called by the subscription when the cache changes. */
  setCatalog: (catalog: OpenRouterModel[]) => void
}

export const useGatewayCatalogStore = create<GatewayCatalogStore>((set) => ({
  catalog: getCachedGatewayModels(),
  lastLoadedAt: 0,
  setCatalog: (catalog) => set({ catalog, lastLoadedAt: Date.now() }),
}))

/**
 * Keep the store in sync with the utility module's cache.
 *
 * The subscription is established at module load so any component that imports
 * the store automatically benefits from catalog updates, regardless of which
 * caller triggered `fetchGatewayModels()`.
 */
subscribeGatewayCatalog((catalog) => {
  useGatewayCatalogStore.getState().setCatalog(catalog)
})
