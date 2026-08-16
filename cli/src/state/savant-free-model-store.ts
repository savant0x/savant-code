import {
  DEFAULT_SAVANT_FREE_MODEL_ID,
  resolveAvailableSavantFreeModel,
} from '@savant-code/common/constants/savant-free-models'
import { create } from 'zustand'

import { IS_SAVANT_FREE } from '../utils/constants'
import {
  DEFAULT_SAVANT_CODE_MODEL_ID,
  loadSavantCodeModelPreference,
  loadSavantFreeModelPreference,
  saveSavantCodeModelPreference,
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

/**
 * FID-2026-0814-010: resolve the boot-time model, build-aware.
 *
 * - Paid build (savant-code): ONLY the persisted /model + picker selection
 *   (`savantCodeModelPreference`) is authoritative, defaulting to
 *   `openrouter/free`. The savant-free preference and free catalog describe a
 *   separate, unreleased product and are never consulted — a stale free-model
 *   preference (e.g. minimax-m3, paid on OpenRouter) must never override the
 *   operator's paid selection on boot.
 * - Free build (savant-free): the savant-free picker preference is
 *   authoritative; unknown/unavailable ids resolve to the always-available
 *   fallback.
 *
 * Pure function so both branches are unit-testable.
 */
export function resolveInitialSelectedModel(
  saved: string | undefined,
  savantCodePreference: string | undefined,
): string {
  if (IS_SAVANT_FREE) {
    // Free build: the savant-free picker preference is authoritative. Unknown
    // or unavailable ids resolve to the always-available fallback.
    return saved
      ? resolveAvailableSavantFreeModel(saved)
      : DEFAULT_SAVANT_FREE_MODEL_ID
  }
  // Paid build (savant-code): ONLY the /model + picker selection is
  // authoritative. The savant-free preference and free catalog describe a
  // separate, unreleased product; the paid build must never read them, or a
  // stale free-model preference (e.g. minimax-m3, paid on OpenRouter) silently
  // overrides the operator's paid selection on every boot.
  return savantCodePreference ?? DEFAULT_SAVANT_CODE_MODEL_ID
}

export const useSavantFreeModelStore = create<SavantFreeModelStore>((set) => ({
  selectedModel: resolveInitialSelectedModel(
    loadSavantFreeModelPreference(),
    loadSavantCodeModelPreference(),
  ),
  setSelectedModel: (model) => set({ selectedModel: model }),
  switchModel: (model) => {
    set({ selectedModel: model })
    // Build-aware persistence: the paid build writes the operator's model to
    // the savant-code preference (the only key it reads on boot); the free
    // build writes the savant-free preference. Writing the free key in the
    // paid build polluted a shared settings file and let a stale free-model
    // selection (minimax-m3) override the paid selection on the next launch.
    if (IS_SAVANT_FREE) {
      saveSavantFreeModelPreference(model)
    } else {
      saveSavantCodeModelPreference(model)
    }
  },
}))

/** Imperative read for non-React callers (the session hook's tick loop and
 *  the chat-completions metadata builder). */
export function getSelectedSavantFreeModel(): string {
  return useSavantFreeModelStore.getState().selectedModel
}

/**
 * FID-2026-0814-004 H-08/H-09/H-12 — the SINGLE project-wide model decision.
 * Every run-construction path (main agent, teacher-forge, sub-agent spawn,
 * headless run) must resolve its model from here — never from a bundled
 * default, never from the savant-code preference alone, never a paid hardcode.
 * `getSelectedSavantFreeModel()` already fail-safes: paid build →
 * `openrouter/free`, free build → the free-catalog default; it can NEVER
 * resolve to a paid model when the store is empty
 * (`resolveInitialSelectedModel` above).
 */
export function resolveActiveModel(): string {
  return getSelectedSavantFreeModel()
}
