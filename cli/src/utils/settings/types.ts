import type { AgentMode } from '../constants'
import type { ModelProvider } from '../openrouter-models'

/**
 * Settings schema - add new settings here as the product evolves
 */
export type PermissionMode = 'safe' | 'prompt' | 'unsafe'

export interface Settings {
  mode?: AgentMode
  /** Default sandbox permission mode. "safe" denies risky tools, "prompt" asks
   *  when possible (headless deny fallback), "unsafe" allows the agent to run
   *  any gated tool. Persisted so it survives across sessions. */
  permissionMode?: PermissionMode
  adsEnabled?: boolean
  /** Product analytics and remote error reporting consent. Defaults to true for
   * new users; users can change it with /telemetry enable|disable. */
  analyticsEnabled?: boolean
  /** Last model the user picked in the savant-free model selector. Restored on
   *  next savant-free launch so users land in the queue for their preferred
   *  model without re-picking. Persisted as the canonical model id. */
  savantFreeModelPreference?: string
  /** Default model for new users and the last model the user picked in the
   *  savant-code model selector. Restored on next launch so users default to
   *  their preferred model. */
  savantCodeModelPreference?: string
  /** Last provider the user picked a model from in the savant-code model
   *  selector. The /model picker defaults to the first model of this provider
   *  on future opens so users land in the same catalog section. */
  savantCodeModelProviderPreference?: ModelProvider
  /** True when the model preference was selected automatically by Ollama
   *  onboarding rather than explicitly chosen by the user. */
  savantCodeModelAutoConfigured?: boolean
  /** The active provider — the single provider selection (FID-2026-0809-001
   *  Phase 4). Persisted by the /provider flow and Ollama onboarding; drives
   *  routing base URL, key readiness guidance, and health. Distinct from
   *  savantCodeModelProviderPreference (which drives the picker default
   *  section only). */
  activeProvider?: ModelProvider
  /** When set, the CLI routes inference to a direct provider (e.g. local
   *  Ollama) instead of the SavantCode backend. Persists the user's local-first
   *  choice across launches. Legacy — Phase 4 migrates gateway choices onto
   *  activeProvider; kept for the local (Ollama) path. */
  directProvider?: string
  /** Base URL for the direct provider. For Ollama this is
   *  http://localhost:11434/v1. */
  directProviderBaseUrl?: string
  /** @deprecated Use server-side fallbackToALaCarte setting instead */
  alwaysUseALaCarte?: boolean
  /** @deprecated Use server-side fallbackToALaCarte setting instead */
  fallbackToALaCarte?: boolean
  /** Set once the user has submitted their first prompt. Used to gate the
   *  first-time onboarding suggested prompts so they only show to brand-new
   *  users and quietly retire afterwards. */
  hasSubmittedFirstPrompt?: boolean
  /** Set when the user acknowledges the SCAFFOLD-mode confirmation dialog.
   *  Persists the first-click warning so it only appears once per user. */
  scaffoldAcknowledged?: boolean
  /** Set once the analytics disclosure notice has been shown (FID-2026-0806-015).
   *  The one-line first-run notice only prints to brand-new users, then retires. */
  analyticsNoticeShown?: boolean
  /** Active design-system IDs by scope; invalid values fail closed at resolution. */
  designSystemProject?: string
  designSystemUser?: string
  /** Optional session-only design-system override, not persisted. */
  designSystemSession?: string
  /** Discord Rich Presence enable/disable (FID-2026-0818-009). Defaults on. */
  presenceEnabled?: boolean
}
