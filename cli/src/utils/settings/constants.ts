import type { AgentMode } from '../constants'
import type { ModelProvider } from '../openrouter-models'
import type { Settings } from './types'

const RELEASE_DEFAULT_MODEL_ID =
  process.env.SAVANT_CODE_DEFAULT_MODEL_ID?.trim()

export const DEFAULT_SAVANT_CODE_MODEL_ID =
  RELEASE_DEFAULT_MODEL_ID || ('openrouter/free' as const)
export const DEFAULT_SAVANT_CODE_MODEL_PROVIDER: ModelProvider = 'openrouter'

export const DEFAULT_SETTINGS: Settings = {
  mode: 'HYBRID' as const,
  adsEnabled: false,
  analyticsEnabled: true,
  savantCodeModelPreference: DEFAULT_SAVANT_CODE_MODEL_ID,
  savantCodeModelProviderPreference: DEFAULT_SAVANT_CODE_MODEL_PROVIDER,
  presenceEnabled: true,
}

// Legacy mode migration map (FID-031 + FID-2026-0805-001). Old
// DEFAULT/LITE/MAX/PLAN/FREE values collapse to HYBRID; EDIT is renamed to
// HYBRID (the label now describes the actual harness-bounded direct-write
// behavior) now that the toggle drives an execution-scope axis.
export const LEGACY_MODE_MIGRATION: Record<string, AgentMode> = {
  DEFAULT: 'HYBRID',
  LITE: 'HYBRID',
  MAX: 'HYBRID',
  PLAN: 'HYBRID',
  FREE: 'HYBRID',
  EDIT: 'HYBRID',
}
