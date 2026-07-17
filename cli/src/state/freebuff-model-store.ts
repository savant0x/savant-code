import {
  DEFAULT_FREEBUFF_MODEL_ID,
  resolveAvailableFreebuffModel,
} from '@codebuff/common/constants/freebuff-models'
import { create } from 'zustand'

import {
  loadFreebuffModelPreference,
  saveFreebuffModelPreference,
} from '../utils/settings'

/**
 * Single source of truth for the active model.
 *
 * All model changes MUST go through `switchModel()` — it updates both the
 * in-memory store AND the persisted settings file atomically.
 *
 * Callers:
 *  - GUI model picker (`startFreebuffSession`)
 *  - `/model <id>` command
 *  - Server-driven auto-flips (model_locked, takeover) — in-memory only via
 *    `setSelectedModel` to avoid overwriting user preference
 *
 * The sidebar, API calls, and billing all read from this store via
 * `getSelectedFreebuffModel()`. No other store holds the model.
 */
interface FreebuffModelStore {
  selectedModel: string
  /** In-memory only — used by server-driven auto-flips that should NOT persist. */
  setSelectedModel: (model: string) => void
  /** Unified: updates store + persists to settings. All user-initiated model changes go here. */
  switchModel: (model: string) => void
}

export const useFreebuffModelStore = create<FreebuffModelStore>((set) => ({
  selectedModel: resolveAvailableFreebuffModel(
    loadFreebuffModelPreference() ?? DEFAULT_FREEBUFF_MODEL_ID,
  ),
  setSelectedModel: (model) =>
    set({ selectedModel: model }),
  switchModel: (model) => {
    set({ selectedModel: model })
    saveFreebuffModelPreference(model)
  },
}))

/** Imperative read for non-React callers (the session hook's tick loop and
 *  the chat-completions metadata builder). */
export function getSelectedFreebuffModel(): string {
  return useFreebuffModelStore.getState().selectedModel
}
