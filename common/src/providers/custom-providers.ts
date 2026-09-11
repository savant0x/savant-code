/**
 * Custom provider definitions + merged effective registry
 * (FID-2026-0910-004 Steps 1-2).
 *
 * A custom provider is user-authored DATA — never code (D1: no dynamic
 * imports, bundle safety preserved; hostile-attacker answer). The record is
 * deliberately a flat, JSON-shaped subset of `ProviderConfig`: the wizard
 * produces it, settings.json stores it, and `toProviderConfig` lifts it into
 * a full registry entry so every consumer surface (routing, picker, keys,
 * catalogs) reads the SAME merged view via `getEffectiveProviderRegistry`.
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

import { ORG_PREFIXES } from './org'
import { PROVIDER_REGISTRY } from './registry'
import { parseRegistryUrl, validateProviderRegistry } from './validate'

import type { CustomProviderConfig, ProviderConfig } from './types'
import type { JSONValue } from '../types/json'

/** Research BYOK env vars (cli/src/utils/research-key-store.ts services). */
const RESEARCH_KEY_ENV_VARS: ReadonlySet<string> = new Set([
  'EXA_API_KEY',
  'TAVILY_API_KEY',
  'FIRECRAWL_API_KEY',
  'SERPER_API_KEY',
])

/** D1 shape: `id` slug charset matches the agent-id rule. */
export const CUSTOM_ID_PATTERN = /^[a-z0-9-]{2,32}$/
/** D1 shape: env var names are uppercase SNAKE_CASE (not starting with a digit). */
export const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/
/** D9: custom providers group after built-ins (built-in orders top out at 4). */
export const CUSTOM_PROVIDER_ORDER = 5

export type { CustomProviderConfig } from './types'

/**
 * Reserved custom-provider ids (D2): built-in registry ids + ORG_PREFIXES
 * org slugs. Single validation truth (Law 13) — consumed by
 * `parseCustomProviders` AND the /provider add wizard's per-step checks, so
 * the two surfaces can never drift.
 */
export function getReservedCustomProviderIds(): ReadonlySet<string> {
  return new Set<string>([...Object.keys(PROVIDER_REGISTRY), ...ORG_PREFIXES])
}

/**
 * Claimed provider env vars (D2): built-in credentials (primary + extra) +
 * research BYOK vars. Single validation truth (Law 13) shared by the parser
 * and the wizard. The registry's entries are heterogeneous literal types (not
 * every entry carries `extra`), so credential fields are read structurally
 * via a minimal record shape instead of the literal union.
 */
export function getClaimedProviderEnvVars(): ReadonlySet<string> {
  const builtinEnvVars = Object.values(
    PROVIDER_REGISTRY as unknown as Record<
      string,
      {
        credentials: {
          envVar?: string
          extra?: ReadonlyArray<{ envVar: string }>
        }
      }
    >,
  ).flatMap((config) =>
    [
      config.credentials.envVar,
      ...(config.credentials.extra ?? []).map((extra) => extra.envVar),
    ].filter((envVar): envVar is string => typeof envVar === 'string'),
  )
  return new Set<string>([...builtinEnvVars, ...RESEARCH_KEY_ENV_VARS])
}

/** Result of parsing user-authored custom-provider JSON. Never throws. */
export type ParseCustomProvidersResult = {
  configs: CustomProviderConfig[]
  problems: string[]
}

/**
 * Parse user-authored custom-provider data (the `customProviders` array from
 * settings.json / the SavantCodeClient option) into validated
 * `CustomProviderConfig` records. Fail-closed per entry: invalid entries
 * produce human-readable problems naming the entry index; only fully valid
 * entries are returned. Unrecognized extra keys are tolerated (forward
 * compatibility). Duplicate ids/env vars across entries are rejected.
 */
export function parseCustomProviders(
  value: JSONValue | undefined,
): ParseCustomProvidersResult {
  const problems: string[] = []
  const configs: CustomProviderConfig[] = []

  if (value === undefined) {
    problems.push('customProviders: field is missing')
    return { configs, problems }
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('customProviders' in value)
  ) {
    problems.push(
      'customProviders: expected an object with a customProviders array',
    )
    return { configs, problems }
  }
  const entries: unknown = (value as { customProviders: JSONValue })
    .customProviders
  if (!Array.isArray(entries)) {
    problems.push('customProviders: expected an array of provider objects')
    return { configs, problems }
  }

  const reservedIds = getReservedCustomProviderIds()
  const claimedEnvVars = getClaimedProviderEnvVars()
  const seenIds = new Set<string>()
  const seenEnvVars = new Set<string>()

  entries.forEach((entry, index) => {
    const label = `customProviders[${index}]`
    const entryProblems: string[] = []
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      problems.push(`${label}: expected an object`)
      return
    }
    const record = entry as Record<string, unknown>

    let id: string | undefined
    const rawId = record['id']
    if (typeof rawId !== 'string' || !CUSTOM_ID_PATTERN.test(rawId)) {
      entryProblems.push(
        `${label}: id must match ${CUSTOM_ID_PATTERN.source} (got ${describe(rawId)})`,
      )
    } else if (reservedIds.has(rawId)) {
      entryProblems.push(
        `${label}: id '${rawId}' is reserved (built-in provider or org prefix) — choose a different id`,
      )
    } else if (seenIds.has(rawId)) {
      entryProblems.push(`${label}: duplicate custom provider id '${rawId}'`)
    } else {
      id = rawId
      seenIds.add(rawId)
    }

    let apiKeyEnvVar: string | undefined
    const rawEnvVar = record['apiKeyEnvVar']
    if (typeof rawEnvVar !== 'string' || !ENV_VAR_PATTERN.test(rawEnvVar)) {
      entryProblems.push(
        `${label}: apiKeyEnvVar must be an uppercase SNAKE_CASE environment variable name (got ${describe(rawEnvVar)})`,
      )
    } else if (claimedEnvVars.has(rawEnvVar)) {
      entryProblems.push(
        `${label}: apiKeyEnvVar '${rawEnvVar}' is already claimed by a built-in provider or research service`,
      )
    } else if (seenEnvVars.has(rawEnvVar)) {
      entryProblems.push(
        `${label}: apiKeyEnvVar '${rawEnvVar}' is used by more than one custom provider`,
      )
    } else {
      apiKeyEnvVar = rawEnvVar
      seenEnvVars.add(rawEnvVar)
    }

    let baseUrl: string | undefined
    const rawBaseUrl = record['baseUrl']
    if (
      typeof rawBaseUrl !== 'string' ||
      parseRegistryUrl(rawBaseUrl) === null
    ) {
      entryProblems.push(
        `${label}: baseUrl must be a valid http(s) URL (got ${describe(rawBaseUrl)})`,
      )
    } else {
      baseUrl = rawBaseUrl
    }

    let configLabel: string | undefined
    const rawLabel = record['label']
    if (typeof rawLabel !== 'string' || rawLabel.trim() === '') {
      entryProblems.push(`${label}: label must be a non-empty string`)
    } else {
      configLabel = rawLabel
    }

    const catalog = parseCustomCatalog(
      record['catalog'],
      label,
      typeof rawId === 'string' ? rawId : undefined,
    )
    entryProblems.push(...catalog.problems)

    problems.push(...entryProblems)
    // Partial records never reach the merged view (fail-closed).
    if (
      entryProblems.length === 0 &&
      id !== undefined &&
      apiKeyEnvVar !== undefined &&
      baseUrl !== undefined &&
      configLabel !== undefined
    ) {
      configs.push({
        id,
        label: configLabel,
        baseUrl,
        apiKeyEnvVar,
        catalog: catalog.catalog,
      })
    }
  })

  return { configs, problems }
}

/** Human-readable description of an invalid field value. */
function describe(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  return typeof value
}

/** Catalog parsing: inline (models map), live (URL), or none. */
function parseCustomCatalog(
  value: unknown,
  label: string,
  providerId: string | undefined,
): { catalog: CustomProviderConfig['catalog']; problems: string[] } {
  if (value === undefined || value === null) {
    return { catalog: { source: 'none' }, problems: [] }
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      catalog: { source: 'none' },
      problems: [`${label}: catalog must be an object when present`],
    }
  }
  const record = value as Record<string, unknown>
  const source = record['source']
  if (source === 'none') {
    return { catalog: { source: 'none' }, problems: [] }
  }
  if (source === 'live') {
    const url = record['url']
    if (typeof url !== 'string' || parseRegistryUrl(url) === null) {
      return {
        catalog: { source: 'none' },
        problems: [`${label}: live catalog url must be a valid http(s) URL`],
      }
    }
    return { catalog: { source: 'live', url }, problems: [] }
  }
  if (source === 'inline') {
    const models = record['models']
    if (
      typeof models !== 'object' ||
      models === null ||
      Array.isArray(models)
    ) {
      return {
        catalog: { source: 'none' },
        problems: [
          `${label}: inline catalog models must be an object of model id -> display name`,
        ],
      }
    }
    const problems: string[] = []
    const entries: Record<string, string> = {}
    const prefix = typeof providerId === 'string' ? `${providerId}/` : undefined
    for (const [modelId, name] of Object.entries(
      models as Record<string, unknown>,
    )) {
      if (prefix === undefined || !modelId.startsWith(prefix)) {
        problems.push(
          `${label}: inline catalog model '${modelId}' does not start with the routing prefix '${providerId ?? '<invalid id>'}'`,
        )
        continue
      }
      if (typeof name !== 'string') {
        problems.push(
          `${label}: inline catalog model '${modelId}' must map to a string display name`,
        )
        continue
      }
      entries[modelId] = name
    }
    return { catalog: { source: 'inline', models: entries }, problems }
  }
  return {
    catalog: { source: 'none' },
    problems: [`${label}: catalog.source must be 'live', 'inline', or 'none'`],
  }
}

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
    protocol: 'openai',
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
