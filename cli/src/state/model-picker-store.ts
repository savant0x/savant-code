import { create } from 'zustand'

import type { OpenRouterModel } from '../utils/openrouter-models'

/**
 * Drives the interactive /model picker overlay.
 *
 * Opened by the /model command (which fetches the live OpenRouter catalog),
 * rendered as an overlay in chat.tsx, and navigated with the keyboard. On
 * select it persists the model via saveCodebuffModelPreference (handled by the
 * picker's onSelect callback, keeping this store free of side effects).
 *
 * This is a generic, provider-agnostic picker — it is NOT coupled to the
 * Freebuff session/queue flow (unlike FreebuffModelSelector). That keeps the
 * direct-provider launch mode self-contained.
 */
interface ModelPickerStore {
  isOpen: boolean
  query: string
  models: OpenRouterModel[]
  selectedIndex: number
  open: (models: OpenRouterModel[]) => void
  close: () => void
  setQuery: (query: string) => void
  setSelectedIndex: (index: number) => void
}

export const useModelPickerStore = create<ModelPickerStore>((set) => ({
  isOpen: false,
  query: '',
  models: [],
  selectedIndex: 0,
  open: (models) => set({ isOpen: true, query: '', models, selectedIndex: 0 }),
  close: () => set({ isOpen: false, query: '', models: [], selectedIndex: 0 }),
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
}))

/** Imperative read for non-React callers. */
export function isModelPickerOpen(): boolean {
  return useModelPickerStore.getState().isOpen
}
