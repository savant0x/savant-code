import {
  resolveModelRoute,
  type ModelRoute,
} from '@savant-code/common/providers/model-route'
import { create } from 'zustand'

import {
  DEFAULT_SAVANT_CODE_MODEL_ID,
  loadSavantCodeModelPreference,
  loadModelSelection,
  saveModelSelection,
  selectModelForProvider,
  loadActiveProvider,
} from '../utils/settings'

/**
 * Single source of truth for the active model.
 *
 * All model changes MUST go through `switchModel()` — it updates both the
 * in-memory store AND the persisted settings file atomically.
 *
 * Callers:
 *  - GUI model picker (provider/model selection)
 *  - `/model <id>` command
 *  - In-memory selection updates via `setSelectedModel`
 *
 * The sidebar, API calls, and billing all read from this store via
 * `getSelectedSavantFreeModel()`. No other store holds the model.
 */
interface SavantFreeModelStore {
  selectedModel: string
  modelRoute?: ModelRoute
  /** In-memory only — used by server-driven auto-flips that should NOT persist. */
  setSelectedModel: (model: string) => void
  /** Unified: updates store + persists to settings. All user-initiated model changes go here. */
  switchModel: (model: string, route?: ModelRoute) => void
}

/**
 * Only the persisted Savant-Code selection is authoritative. The first
 * argument and exported store names retain caller compatibility; a stale
 * retired-product preference is ignored and never changes the active model.
 */
export function resolveInitialSelectedModel(
  _saved: string | undefined,
  savantCodePreference: string | undefined,
): string {
  return savantCodePreference ?? DEFAULT_SAVANT_CODE_MODEL_ID
}

export const useSavantFreeModelStore = create<SavantFreeModelStore>((set) => ({
  modelRoute: loadModelSelection()?.route,
  selectedModel: resolveInitialSelectedModel(
    undefined,
    loadSavantCodeModelPreference(),
  ),
  setSelectedModel: (model) =>
    set({ selectedModel: model, modelRoute: undefined }),
  switchModel: (model, route) => {
    const selection = route
      ? saveModelSelection(model, route)
      : selectModelForProvider(model)
    set({ selectedModel: model, modelRoute: selection.route })
  },
}))

/** Imperative read for non-React callers such as run construction. */
export function getSelectedSavantFreeModel(): string {
  return useSavantFreeModelStore.getState().selectedModel
}

/**
 * FID-2026-0814-004 H-08/H-09/H-12 — the SINGLE project-wide model decision.
 * Every run-construction path (main agent, teacher-forge, sub-agent spawn,
 * headless run) must resolve its model from here — never from a bundled
 * default, never from the savant-code preference alone, never a paid hardcode.
 * `getSelectedSavantFreeModel()` defaults to `openrouter/free`; it can NEVER
 * resolve to a paid model when the store is empty
 * (`resolveInitialSelectedModel` above).
 */
export function resolveActiveModel(): string {
  return getSelectedSavantFreeModel()
}

export function resolveActiveModelRoute(): ModelRoute | undefined {
  const state = useSavantFreeModelStore.getState()
  // Only an EXPLICIT selection may pin the serving route (D1): shell
  // DIRECT_PROVIDER or the persisted /provider selection. The picker-default
  // chain in getActiveProvider() ends in the openrouter fallback, and routing
  // a bare slug through that default would silently replace the operator's
  // INFERENCE_BASE_URL custom endpoint (FID-2026-0929-005 direct mode).
  return resolveModelRoute(
    state.selectedModel,
    state.modelRoute,
    process.env.DIRECT_PROVIDER ?? loadActiveProvider(),
  )
}
