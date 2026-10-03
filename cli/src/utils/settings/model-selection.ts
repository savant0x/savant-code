import {
  captureModelRoute,
  modelSelectionSchema,
  resolveModelRoute,
} from '@savant-code/common/providers/model-route'

import { loadSettings, saveSettings } from './io'
import { notifyProviderSelectionChanged } from '../provider-monitoring-events'

import type {
  ModelRoute,
  ModelSelection,
} from '@savant-code/common/providers/model-route'

export function loadModelSelection(): ModelSelection | undefined {
  const settings = loadSettings()
  if (settings.modelSelection) return settings.modelSelection
  const model = settings.savantCodeModelPreference
  if (!model) return undefined
  const explicitActive = process.env.DIRECT_PROVIDER ?? settings.activeProvider
  try {
    const route = resolveModelRoute(model, undefined, explicitActive)
    return route ? { version: 1, model, route } : undefined
  } catch {
    // Ambiguous legacy bytes remain untouched; request construction asks for reselection.
    return undefined
  }
}

export function saveModelSelection(
  model: string,
  route: ModelRoute,
): ModelSelection {
  const selection = modelSelectionSchema.parse({
    version: 1,
    model,
    route: resolveModelRoute(model, route),
  })
  // Validate registration/configuration before committing any preference.
  resolveModelRoute(selection.model, selection.route)
  saveSettings({
    modelSelection: selection,
    savantCodeModelPreference: selection.model,
    savantCodeModelProviderPreference: route.providerId,
    activeProvider: route.providerId,
    savantCodeModelAutoConfigured: false,
  })
  notifyProviderSelectionChanged()
  return selection
}

export function selectModelForProvider(
  model: string,
  providerId?: string,
): ModelSelection {
  const settings = loadSettings()
  const provider =
    providerId ??
    settings.modelSelection?.route.providerId ??
    process.env.DIRECT_PROVIDER ??
    settings.activeProvider ??
    'openrouter'
  return saveModelSelection(model, captureModelRoute(provider))
}
