import { create } from 'zustand'

import type { ModelProvider, OpenRouterModel } from '../utils/openrouter-models'

/**
 * Drives the interactive /model picker overlay.
 *
 * Opened by the /model command (which fetches the live OpenRouter catalog),
 * rendered as an overlay in chat.tsx, and navigated with the keyboard. On
 * select it persists the model via saveSavantCodeModelPreference (handled by the
 * picker's onSelect callback, keeping this store free of side effects).
 *
 * This is a generic, provider-agnostic picker — it is NOT coupled to the
 * SavantFree session/queue flow (unlike SavantFreeModelSelector). That keeps the
 * direct-provider launch mode self-contained.
 */
interface ModelPickerStore {
  isOpen: boolean
  query: string
  models: OpenRouterModel[]
  /**
   * FID-2026-1009-005: registered providers whose live catalog contributed
   * zero rows (keyed but fetch-failed/empty). Rendered as UNAVAILABLE group
   * headers so a configured provider never vanishes from /model silently.
   */
  unavailableProviders: readonly string[]
  selectedIndex: number
  open: (
    models: OpenRouterModel[],
    preferredProvider?: ModelProvider,
    unavailableProviders?: readonly string[],
  ) => void
  close: () => void
  setQuery: (query: string) => void
  setSelectedIndex: (index: number) => void
  /** Replace rows while open (FID-2026-1008-005 background refresh). */
  setModels: (
    models: OpenRouterModel[],
    unavailableProviders?: readonly string[],
  ) => void
}

function getProvider(model: OpenRouterModel): ModelProvider {
  return model.provider ?? 'openrouter'
}

function findPreferredProviderIndex(
  models: OpenRouterModel[],
  preferredProvider: ModelProvider,
): number {
  for (let i = 0; i < models.length; i++) {
    if (getProvider(models[i]) === preferredProvider) {
      return i
    }
  }
  return 0
}

export const useModelPickerStore = create<ModelPickerStore>((set) => ({
  isOpen: false,
  query: '',
  models: [],
  unavailableProviders: [],
  selectedIndex: 0,
  open: (models, preferredProvider, unavailableProviders) =>
    set({
      isOpen: true,
      query: '',
      models,
      unavailableProviders: unavailableProviders ?? [],
      selectedIndex:
        preferredProvider == null
          ? 0
          : findPreferredProviderIndex(models, preferredProvider),
    }),
  close: () =>
    set({
      isOpen: false,
      query: '',
      models: [],
      unavailableProviders: [],
      selectedIndex: 0,
    }),
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setModels: (models, unavailableProviders) =>
    set((state) => ({
      models,
      unavailableProviders: unavailableProviders ?? state.unavailableProviders,
      selectedIndex: Math.min(
        state.selectedIndex,
        Math.max(0, models.length - 1),
      ),
    })),
}))

/** Imperative read for non-React callers. */
export function isModelPickerOpen(): boolean {
  return useModelPickerStore.getState().isOpen
}
