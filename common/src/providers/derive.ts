/**
 * Derivation functions for the Unified Provider Registry (FID-2026-0809-001).
 *
 * Every derive function is a pure function over an injected registry — the
 * first argument is always the registry — so production passes
 * PROVIDER_REGISTRY and tests pass a fixture registry. No function imports the
 * singleton, which is what makes the fixture-provider test and the
 * derivation-parity suite possible without global mutation.
 */
import type { ProviderConfig } from './types'

export interface ProviderSetupInfo {
  label: string
  envVar: string
  baseUrl: string
  /**
   * Additional required credentials (T61 Option A, FID-2026-0928-008):
   * `credentials.extra` carried into the setup flow so a dual-credential
   * provider can be onboarded completely — the wizard prompts for each
   * extra after the primary key, and the key store persists them by their
   * own env-var name. Absent for single-credential providers, so the
   * derived shape of every existing entry is unchanged.
   */
  extraEnvVars?: Array<{ envVar: string; label: string }>
}

/** Ids whose registry entry has setupAvailable: true (literal-preserving). */
export type SetupAvailableIds<R extends Record<string, ProviderConfig>> = {
  [K in keyof R]: R[K] extends { setupAvailable: true } ? K : never
}[keyof R]

/** Allowed routing prefixes = org slugs + registry ids. */
export function deriveAllowedModelPrefixes(
  registry: Record<string, ProviderConfig>,
  orgPrefixes: readonly string[],
): string[] {
  return [...orgPrefixes, ...Object.keys(registry)]
}

/** Favicon/logo domains = org-slug domains + registry domains (id-keyed). */
export function deriveProviderDomains(
  registry: Record<string, ProviderConfig>,
  orgDomains: Record<string, string>,
): Record<string, string> {
  const domains: Record<string, string> = { ...orgDomains }
  for (const [id, config] of Object.entries(registry)) {
    if (config.domain) {
      domains[id] = config.domain
    }
  }
  return domains
}

/** Return the registry domain for a registry-prefixed model id, if any. */
export function deriveLogoDomain(
  registry: Record<string, ProviderConfig>,
  modelName: string,
): string | undefined {
  for (const [id, config] of Object.entries(registry)) {
    if (config.domain && modelName.startsWith(`${id}/`)) {
      return config.domain
    }
  }
  return undefined
}

/**
 * Live-catalog endpoint URL for a registry entry whose catalog is `live`.
 * Returns undefined for static/none catalogs — the single source for live
 * catalog URLs lives in the registry (drift-kill: no second copy).
 */
export function deriveLiveCatalogUrl(
  registry: Record<string, ProviderConfig>,
  providerId: string,
): string | undefined {
  const catalog = registry[providerId]?.catalog
  return catalog?.source === 'live' ? catalog.url : undefined
}

/** Deterministic picker group order; unknown providers sort last (4). */
export function deriveProviderOrder(
  registry: Record<string, ProviderConfig>,
  providerId: string,
): number {
  return registry[providerId]?.order ?? 4
}

/** Valid persisted provider ids (settings.validProviders source). */
export function deriveValidProviderIds<
  R extends Record<string, ProviderConfig>,
>(registry: R): Array<keyof R & string> {
  return Object.keys(registry) as Array<keyof R & string>
}

/**
 * Setup-picker config = registry entries where setupAvailable is true,
 * narrowed to the literal setup-available ids.
 */
export function deriveSetupConfig<R extends Record<string, ProviderConfig>>(
  registry: R,
): Record<Extract<SetupAvailableIds<R>, string>, ProviderSetupInfo> {
  const result = {} as Record<
    Extract<SetupAvailableIds<R>, string>,
    ProviderSetupInfo
  >
  for (const [id, config] of Object.entries(registry)) {
    if (config.setupAvailable && config.credentials.envVar) {
      ;(result as Record<string, ProviderSetupInfo>)[id] = {
        label: config.label,
        envVar: config.credentials.envVar,
        baseUrl: config.baseUrl,
        ...(config.credentials.extra && config.credentials.extra.length > 0
          ? {
              extraEnvVars: config.credentials.extra.map((e) => ({
                envVar: e.envVar,
                label: e.label,
              })),
            }
          : {}),
      }
    }
  }
  return result
}
