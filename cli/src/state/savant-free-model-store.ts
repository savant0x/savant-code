import {
  DEFAULT_SAVANT_FREE_MODEL_ID,
  resolveAvailableSavantFreeModel,
} from '@savant-code/common/constants/savant-free-models'
import { create } from 'zustand'

import { IS_SAVANT_FREE } from '../utils/constants'
import {
  loadSavantFreeModelPreference,
  saveSavantFreeModelPreference,
} from '../utils/settings'

/**
 * Single source of truth for the active model.
 *
 * All model changes MUST go through `switchModel()` — it updates both the
 * in-memory store AND the persisted settings file atomically.
 *
 * Callers:
 *  - GUI model picker (`startSavantFreeSession`)
 *  - `/model <id>` command
 *  - Server-driven auto-flips (model_locked, takeover) — in-memory only via
 *    `setSelectedModel` to avoid overwriting user preference
 *
 * The sidebar, API calls, and billing all read from this store via
 * `getSelectedSavantFreeModel()`. No other store holds the model.
 */
interface SavantFreeModelStore {
  selectedModel: string
  /** In-memory only — used by server-driven auto-flips that should NOT persist. */
  setSelectedModel: (model: string) => void
  /** Unified: updates store + persists to settings. All user-initiated model changes go here. */
  switchModel: (model: string) => void
}

export const useSavantFreeModelStore = create<SavantFreeModelStore>((set) => ({
  selectedModel: (() => {
    const saved = loadSavantFreeModelPreference()
    if (saved) {
      // In paid mode, trust the user's raw model ID (e.g. "opencode-go/mimo-v2.5")
      // directly. resolveAvailableSavantFreeModel() only recognizes free-tier
      // model IDs and would strip paid models to a fallback, silently switching
      // the user to an unintended (and potentially expensive) model.
      return IS_SAVANT_FREE
        ? resolveAvailableSavantFreeModel(saved)
        : saved
    }
    return DEFAULT_SAVANT_FREE_MODEL_ID
  })(),
  setSelectedModel: (model) =>
    set({ selectedModel: model }),
  switchModel: (model) => {
    set({ selectedModel: model })
    saveSavantFreeModelPreference(model)
  },
}))

/** Imperative read for non-React callers (the session hook's tick loop and
 *  the chat-completions metadata builder). */
export function getSelectedSavantFreeModel(): string {
  return useSavantFreeModelStore.getState().selectedModel
}
