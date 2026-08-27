/**
 * FID-2026-0822-012 P1 — local deck module state.
 *
 * Projection state stays with the deck (missed-question 10): the toggle
 * reads/writes its own localStorage key through the deck-view-mode helpers;
 * the FID-2026-0820-010 session store is never consulted.
 */

import { create } from 'zustand'

import {
  browserStorage,
  loadDeckViewMode,
  saveDeckViewMode,
} from './deck-view-mode'

import type { DeckViewMode } from './deck-view-mode'

interface DeckStoreState {
  readonly viewMode: DeckViewMode
  setViewMode(mode: DeckViewMode): void
}

export const useDeckStore = create<DeckStoreState>()((set, get) => ({
  viewMode: loadDeckViewMode(browserStorage()),
  setViewMode: (mode) => {
    if (get().viewMode === mode) return
    saveDeckViewMode(mode, browserStorage())
    set({ viewMode: mode })
  },
}))
