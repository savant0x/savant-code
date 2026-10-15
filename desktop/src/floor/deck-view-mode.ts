/**
 * FID-2026-0822-012 P1 — deck view-mode persistence.
 *
 * Local deck module state (missed-question 10): the Deck/Chat toggle owns
 * its own storage key and never touches the FID-2026-0820-010 renderer
 * session store. Persistence is best-effort — quota or private-mode
 * failures leave the in-memory store authoritative.
 */

export const DECK_VIEW_STORAGE_KEY = 'savant.deck.viewMode'

export type DeckViewMode = 'deck' | 'chat'

const VALID_MODES: readonly DeckViewMode[] = ['deck', 'chat']

export interface ViewModeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function parseDeckViewMode(value: unknown): DeckViewMode {
  return VALID_MODES.includes(value as DeckViewMode)
    ? (value as DeckViewMode)
    : 'chat'
}

export function loadDeckViewMode(
  storage: ViewModeStorage | null,
): DeckViewMode {
  if (storage === null) return 'chat'
  try {
    return parseDeckViewMode(storage.getItem(DECK_VIEW_STORAGE_KEY))
  } catch {
    return 'chat'
  }
}

export function saveDeckViewMode(
  mode: DeckViewMode,
  storage: ViewModeStorage | null,
): void {
  if (storage === null) return
  try {
    storage.setItem(DECK_VIEW_STORAGE_KEY, mode)
  } catch {
    // Persistence is best-effort; the in-memory store stays authoritative.
  }
}

export function browserStorage(): ViewModeStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}
