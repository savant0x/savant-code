/**
 * FID-2026-0928-012 — shared types for the free-options discovery surface.
 * Own module so the lib, renderers, and command handler can import them
 * without pulling in the fetch/IO half (Law 13, cycle-free).
 */
import type { QuotaStateReading } from '@savant-code/common/providers/provider-quota-state'
import type { FactEvidence } from '@savant-code/common/providers/types'

/** One free-model row we consume from the custats catalog. */
export type FreeCatalogModel = {
  id: string
  providerId: string
  context_length: number | null
  expirationDate?: string | null
}

/** The catalog envelope shape we rely on (defensive lift at the boundary). */
export type FreeCatalogEnvelope = {
  fetchedAt: string
  totalModels: number
  models: FreeCatalogModel[]
  newModelIds: string[]
  archivedModels: Array<{
    id: string
    providerId: string | null
    removedAt: string
  }>
}

/** Registry attribution for one catalog provider id. */
export type FreeProviderAttribution = {
  id: string
  label: string
  envVar: string
  setupCommand: string
  credentialReady?: boolean
}

/** Everything the pure builder needs about the user's machine. */
export type FreeOptionsContext = {
  nowMs: number
  /** Env vars with non-empty values (store ∪ environment), BYOK truth. */
  wiredEnvVars: ReadonlySet<string>
  /** Catalog providerId → registry attribution (known providers only). */
  registryByProviderId: Record<string, FreeProviderAttribution>
  /** Key-less local providers (registry `kind: 'local'`). */
  localProviders: Array<{ id: string; label: string; setupCommand: string }>
}

export type FreeLane = {
  providerId: string
  label: string
  models: string[]
}

/**
 * One advertised feed offer as the display needs it (FID-2026-1016-010).
 * Structured rather than a pre-rendered string so the renderers can bound,
 * group and attribute the same rows; `providerLabels` empty means the offer's
 * prose names no provider in the registry — still discovery, never an action.
 */
export type FreeOfferRow = {
  title: string
  /** Category lifted from the description tail; null when no tail parsed. */
  category: string | null
  /**
   * What the feed actually states: `advertised deadline <yyyy-mm-dd>`,
   * `no advertised deadline` (the offer is ongoing), or `deadline unverified`
   * (a claim we hold but could not resolve).
   */
  deadlineLabel: string
  /** Registry labels the offer's prose attributes to; [] when unattributed. */
  providerLabels: string[]
  url: string
}

export type FreeOptionsReport = {
  fetchedAt: string | null
  stale: boolean
  /** Provenance of the free-model claims, separate from account eligibility. */
  catalogEvidence?: FactEvidence
  /** The best observed account quota state; absent data is unknown. */
  quotaReading?: QuotaStateReading
  /** Labels of every registry provider with credentials configured
   *  (FID-2026-1008-003). Labels only; never key values. */
  configuredProviders: string[]
  wiredFree: Array<FreeLane>
  notWired: Array<FreeLane & { setupCommand: string }>
  localFree: Array<{ id: string; label: string; setupCommand: string }>
  discoveryOnly?: FreeLane[]
  discoveryOffers?: FreeOfferRow[]
  /** Offers ending within 72h (FID-2026-1008-004). Absent means 0. */
  discoveryOffersEndingSoon?: number
  /**
   * Catalog delta: model ids newly advertised since the previous catalog
   * (FID-2026-1016-010). Absent or empty means the envelope carried none.
   */
  newModelIds?: string[]
}
