/**
 * Pure registry validation (FID-2026-0809-001 Phase 5, decision 5).
 *
 * Every check is a pure function over an injected registry — production passes
 * PROVIDER_REGISTRY, tests pass fixture registries — so the "Cloudflare-class"
 * drift gap (a provider missing from one surface) becomes a test failure, and
 * a malformed new provider entry fails the suite before it ships.
 *
 * Design note (Loop 8): decision 5 also floated a Zod schema validating the
 * registry at module load. That is deliberately NOT implemented — the registry
 * is a compile-time constant (`satisfies Record<string, ProviderConfig>`),
 * data-only, with no user-editable failure path, so a per-process runtime
 * parse would add cost without a reachable failure mode. Enforcement lives at
 * compile time (exhaustiveness) + this enforced test suite, which is strictly
 * stronger than a one-time module-load parse.
 */
import { MODEL_CATALOGS } from './model-catalogs'
import { PROVIDER_PROTOCOL_MAPS } from '../constants/model-config'

import type { ProviderConfig } from './types'

const KINDS = new Set<ProviderConfig['kind']>(['gateway', 'local', 'env-only'])
const PROTOCOLS = new Set<ProviderConfig['protocol']>([
  'openai',
  'anthropic',
  'openai-anthropic',
  'multi',
])
const ID_TRANSFORMS = new Set<ProviderConfig['idTransform']>([
  'strip',
  'keep',
  'cf-rewrite',
])
const CATALOG_SOURCES = new Set(['live', 'static', 'none'])

const PROTOCOL_MAPS = PROVIDER_PROTOCOL_MAPS

/**
 * Parse a registry URL, tolerating `{ENV_VAR}` placeholders (Cloudflare's
 * mid-path account id). Returns null when the string is not a valid http(s)
 * URL.
 */
function parseRegistryUrl(url: string): URL | null {
  try {
    // Braces are tolerated by the URL parser, but replace placeholders first
    // so the check reads the concrete shape rather than relying on parser
    // quirks.
    const concrete = url.replace(/\{[A-Z0-9_]+\}/g, 'account-id')
    const parsed = new URL(concrete)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Validate a provider registry. Returns a list of human-readable problems;
 * an empty array means the registry is structurally sound.
 */
export function validateProviderRegistry(
  registry: Record<string, ProviderConfig>,
): string[] {
  const problems: string[] = []
  const envVarOwners = new Map<
    string,
    { owner: string; resolver: ProviderConfig['credentials']['resolver'] }
  >()
  const ids = Object.keys(registry)

  const claimEnvVar = (
    envVar: string,
    owner: string,
    resolver: ProviderConfig['credentials']['resolver'],
  ): void => {
    const existing = envVarOwners.get(envVar)
    if (existing !== undefined) {
      // Intentional sharing: entries behind the SAME named resolver chain
      // resolve one shared credential (opencode-go + opencode-zen). Anything
      // else sharing a var is an accidental collision.
      if (resolver !== undefined && resolver === existing.resolver) {
        return
      }
      problems.push(
        `Env var ${envVar} is used by both '${existing.owner}' and '${owner}' — must be unique`,
      )
    } else {
      envVarOwners.set(envVar, { owner, resolver })
    }
  }

  for (const [key, config] of Object.entries(registry)) {
    if (config.id !== key) {
      problems.push(
        `Registry key '${key}' does not match config.id '${config.id}' — they must be identical`,
      )
    }

    if (!KINDS.has(config.kind)) {
      problems.push(`'${key}' has invalid kind: ${String(config.kind)}`)
    }
    if (!PROTOCOLS.has(config.protocol)) {
      problems.push(`'${key}' has invalid protocol: ${String(config.protocol)}`)
    }
    if (!ID_TRANSFORMS.has(config.idTransform)) {
      problems.push(
        `'${key}' has invalid idTransform: ${String(config.idTransform)}`,
      )
    }
    if (!CATALOG_SOURCES.has(config.catalog.source)) {
      problems.push(
        `'${key}' has invalid catalog source: ${String(config.catalog.source)}`,
      )
    }

    if (!Number.isInteger(config.order) || config.order < 0) {
      problems.push(
        `'${key}' has invalid order ${config.order} — must be a non-negative integer`,
      )
    }

    const baseUrl = parseRegistryUrl(config.baseUrl)
    if (baseUrl === null) {
      problems.push(`'${key}' has invalid baseUrl: ${config.baseUrl}`)
    }
    if (
      config.catalog.source === 'live' &&
      parseRegistryUrl(config.catalog.url) === null
    ) {
      problems.push(
        `'${key}' has invalid live catalog url: ${config.catalog.url}`,
      )
    }

    // Credential invariants.
    if (config.kind === 'gateway' && !config.credentials.envVar) {
      problems.push(
        `'${key}' is kind 'gateway' but has no credentials.envVar — every gateway needs a key`,
      )
    }
    if (config.kind === 'local' && config.credentials.envVar) {
      problems.push(
        `'${key}' is kind 'local' but declares credentials.envVar — local providers have no key`,
      )
    }
    if (
      config.setupAvailable &&
      config.kind !== 'local' &&
      !config.credentials.envVar
    ) {
      problems.push(
        `'${key}' is setupAvailable but has no credentials.envVar — the /provider picker needs one`,
      )
    }
    if (config.credentials.envVar) {
      claimEnvVar(
        config.credentials.envVar,
        key,
        config.credentials.resolver,
      )
    }
    for (const extra of config.credentials.extra ?? []) {
      claimEnvVar(extra.envVar, key, undefined)
    }

    // Static catalog: every model id must carry the routing prefix so
    // prefixed routing and the picker can never disagree with the registry.
    if (config.catalog.source === 'static') {
      const models = MODEL_CATALOGS[config.catalog.modelsRef]
      for (const [mapKey, modelId] of Object.entries(models)) {
        if (!modelId.startsWith(`${config.id}/`)) {
          problems.push(
            `'${key}' catalog model '${mapKey}' = '${modelId}' does not start with the routing prefix '${config.id}/'`,
          )
        }
      }
    }

    // Map-dispatched providers (`openai-anthropic` dual or `multi`):
    // protocol map required, and every static catalog model must be present
    // in it (or routing fails closed at request time). Live catalogs are not
    // enumerated — coverage is enforced by catalog tests, not here.
    if (config.protocol === 'openai-anthropic' || config.protocol === 'multi') {
      if (!config.protocolMap) {
        problems.push(
          `'${key}' is map-dispatched (${config.protocol}) but has no protocolMap — the generic factory fails closed without one`,
        )
      } else {
        const map = PROTOCOL_MAPS[config.protocolMap]
        for (const [mapKey] of Object.entries(map)) {
          if (!mapKey.startsWith(`${config.id}/`)) {
            problems.push(
              `'${key}' protocol map key '${mapKey}' does not start with the routing prefix '${config.id}/'`,
            )
          }
        }
        if (config.catalog.source === 'static') {
          const models = MODEL_CATALOGS[config.catalog.modelsRef]
          for (const modelId of Object.values(models)) {
            if (map[modelId] === undefined) {
              problems.push(
                `'${key}' catalog model '${modelId}' is missing from the ${config.protocolMap} protocol map — add it or routing fails closed`,
              )
            }
          }
        }
      }
    }
  }

  // Derivation-parity: valid ids are exactly the registry keys.
  if (new Set(ids).size !== ids.length) {
    problems.push('Registry keys are not unique')
  }

  return problems
}

/** Convenience: true when the registry has zero problems. */
export function isProviderRegistryValid(
  registry: Record<string, ProviderConfig>,
): boolean {
  return validateProviderRegistry(registry).length === 0
}
