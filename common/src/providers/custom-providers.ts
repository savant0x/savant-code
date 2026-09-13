/**
 * Custom provider definitions + merged effective registry
 * (FID-2026-0910-004 Steps 1-2; split under the 300-line cap by
 * FID-2026-0913-002 — the DATA-parsing half lives in
 * `custom-providers-parse.ts`, re-exported here so every existing import
 * path keeps working; this module owns the merge/registration lifecycle).
 *
 * The record is deliberately a flat, JSON-shaped subset of `ProviderConfig`:
 * the wizard produces it, settings.json stores it, and `toProviderConfig`
 * lifts it into a full registry entry so every consumer surface (routing,
 * picker, keys, catalogs) reads the SAME merged view via
 * `getEffectiveProviderRegistry`.
 *
 * Merge rules (D2, converged with the operator):
 * - Built-ins always win: a custom id colliding with a registry id or an
 *   ORG_PREFIXES slug is rejected at parse time, never silently shadowed.
 * - Credential safety: `apiKeyEnvVar` must not collide with any built-in
 *   claimed env var (re-verified by `validateProviderRegistry` on the merged
 *   view at registration) or the research BYOK vars.
 * - Registration lifecycle (D4): idempotent replace — a valid registration
 *   replaces the custom set; an EMPTY/undefined list is a no-op (a client
 *   constructed without `customProviders`, e.g. evals' direct construction,
 *   must never clear a previously registered set); invalid data throws
 *   fail-closed and leaves prior state untouched.
 */

import { parseCustomProviders as parseCustomProvidersData } from './custom-providers-parse'
import { PROVIDER_REGISTRY } from './registry'
import { validateProviderRegistry } from './validate'

import type { CustomProviderConfig, ProviderConfig } from './types'

// ---------------------------------------------------------------------------
// DATA-parsing half (custom-providers-parse.ts) — re-exported in place
// ---------------------------------------------------------------------------

export {
  CUSTOM_ID_PATTERN,
  ENV_VAR_PATTERN,
  getClaimedProviderEnvVars,
  getReservedCustomProviderIds,
} from './custom-providers-parse'
export type { ParseCustomProvidersResult } from './custom-providers-parse'

/**
 * Single validation truth (Law 13): every caller — settings IO, the SDK
 * option, the wizard finalize — parses through this re-export.
 */
export const parseCustomProviders = parseCustomProvidersData

/** D9: custom providers group after built-ins (built-in orders top out at 4). */
export const CUSTOM_PROVIDER_ORDER = 5

export type { CustomProviderConfig } from './types'

/**
 * Lift a validated custom record into a full `ProviderConfig` registry entry
 * (D1 constraints become concrete field values; D9 order groups customs
 * after built-ins). No `resolver` — the generic env-var read is the only
 * credential path (D6).
 */
export function toProviderConfig(custom: CustomProviderConfig): ProviderConfig {
  return {
    id: custom.id,
    label: custom.label,
    kind: 'gateway',
    credentials: { envVar: custom.apiKeyEnvVar },
    baseUrl: custom.baseUrl,
    // FID-2026-0911-003: the record may carry an explicit wire protocol
    // ('anthropic' for Claude-style /v1/messages outlier endpoints);
    // legacy records without the field default to 'openai'.
    protocol: custom.protocol ?? 'openai',
    idTransform: 'strip',
    catalog: custom.catalog,
    setupAvailable: true,
    order: CUSTOM_PROVIDER_ORDER,
  }
}

// ---------------------------------------------------------------------------
// Effective registry (Step 2)
// ---------------------------------------------------------------------------

let customConfigs: CustomProviderConfig[] = []

let cachedEffective: Record<string, ProviderConfig> | undefined

/**
 * Register (replace) the custom provider set. D4 lifecycle:
 * - A valid non-empty list replaces any previously registered set.
 * - An EMPTY/undefined list is a NO-OP — a client constructed without
 *   `customProviders` must never clear a previously registered set.
 * - An invalid list throws fail-closed and leaves prior state untouched.
 * The merged view is re-validated with the SAME `validateProviderRegistry`
 * used for the built-in registry (env-var claims, URL rules, catalog
 * invariants — zero new validation logic).
 */
export function registerCustomProviders(
  configs: CustomProviderConfig[] | undefined,
): void {
  if (configs === undefined || configs.length === 0) {
    return
  }
  // D2 defense-in-depth: a custom id shadowing a built-in is a merge-rule
  // violation even if the caller bypassed parsing (hostile hand-built list).
  // Reject BEFORE building anything so prior state stays untouched.
  for (const custom of configs) {
    if (custom.id in PROVIDER_REGISTRY) {
      throw new Error(
        `Invalid custom provider registration: id '${custom.id}' is reserved (built-in provider)`,
      )
    }
  }
  const merged = buildMerged(configs)
  const problems = validateProviderRegistry(merged)
  if (problems.length > 0) {
    throw new Error(
      `Invalid custom provider registration:\n${problems.join('\n')}`,
    )
  }
  customConfigs = configs
  cachedEffective = merged
}

/** Reset to built-ins-only (the test seam; /provider remove rebuilds via register). */
export function resetCustomProviders(): void {
  customConfigs = []
  cachedEffective = undefined
}

/**
 * The single merged view every consumer surface reads (FID consumer clusters
 * C1-C10). Returns the same frozen record until the custom set changes.
 */
export function getEffectiveProviderRegistry(): Record<string, ProviderConfig> {
  if (cachedEffective === undefined) {
    cachedEffective = buildMerged(customConfigs)
  }
  return cachedEffective
}

/** Build the merged record: built-ins first, customs appended (D2, D9). */
function buildMerged(
  configs: CustomProviderConfig[],
): Record<string, ProviderConfig> {
  const merged: Record<string, ProviderConfig> = {
    ...(PROVIDER_REGISTRY as unknown as Record<string, ProviderConfig>),
  }
  for (const custom of configs) {
    merged[custom.id] = toProviderConfig(custom)
  }
  return Object.freeze(merged)
}
