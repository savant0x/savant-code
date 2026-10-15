/**
 * Provider completion-audit contract (FID-2026-0809-008).
 *
 * The registry remains the only provider metadata source. This module does not
 * route requests or alter settings; it makes intentional provider-specific
 * behavior explicit and fails closed when a registry change is not accompanied
 * by its exception evidence.
 */
import { validateProviderRegistry } from './validate'

export { PROVIDER_EXCEPTION_MANIFEST } from './provider-exception-manifest'
export type {
  ProviderExceptionKind,
  ProviderExceptionManifestEntry,
} from './provider-exception-manifest'
import type {
  ProviderExceptionKind,
  ProviderExceptionManifestEntry,
} from './provider-exception-manifest'
import type { ProviderConfig } from './types'

function requiredExceptionKinds(
  config: ProviderConfig,
): Set<ProviderExceptionKind> {
  const kinds = new Set<ProviderExceptionKind>()
  if (config.credentials.resolver !== undefined)
    kinds.add('credential-resolver')
  if (config.catalog.source === 'live') kinds.add('live-catalog')
  if (config.protocol === 'openai-anthropic') kinds.add('dual-protocol')
  if (config.protocol === 'multi') kinds.add('multi-protocol')
  if ((config.credentials.extra?.length ?? 0) > 0)
    kinds.add('extra-credentials')
  if (config.idTransform === 'cf-rewrite') kinds.add('id-rewrite')
  if (config.kind === 'local') kinds.add('local-runtime')
  if (!config.setupAvailable) kinds.add('setup-exclusion')
  return kinds
}

/**
 * Validate the registry and its exception manifest as one bounded contract.
 * Empty output means the registry has no unowned or stale exceptions.
 */
export function validateProviderAudit(
  registry: Record<string, ProviderConfig>,
  manifest: readonly ProviderExceptionManifestEntry[],
  options: { evidenceExists?: (path: string) => boolean } = {},
): string[] {
  const evidenceExists = options.evidenceExists ?? (() => true)
  const problems = validateProviderRegistry(registry).map(
    (problem) => `registry: ${problem}`,
  )
  const registryIds = new Set(Object.keys(registry))
  const seenProviders = new Set<string>()

  for (const entry of manifest) {
    if (!registryIds.has(entry.providerId)) {
      problems.push(
        `manifest: '${entry.providerId}' is not present in the provider registry`,
      )
    }
    if (seenProviders.has(entry.providerId)) {
      problems.push(
        `manifest: '${entry.providerId}' appears more than once; consolidate its exception entry`,
      )
    }
    seenProviders.add(entry.providerId)
    if (entry.kinds.length === 0) {
      problems.push(`manifest: '${entry.providerId}' has no exception kinds`)
    }
    if (new Set(entry.kinds).size !== entry.kinds.length) {
      problems.push(`manifest: '${entry.providerId}' repeats an exception kind`)
    }
    if (!entry.owner.trim()) {
      problems.push(`manifest: '${entry.providerId}' has no owner`)
    } else if (!evidenceExists(entry.owner)) {
      problems.push(
        `manifest: '${entry.providerId}' owner path does not exist: ${entry.owner}`,
      )
    }
    if (
      entry.evidence.length === 0 ||
      entry.evidence.some((path) => !path.trim())
    ) {
      problems.push(
        `manifest: '${entry.providerId}' has incomplete evidence paths`,
      )
    } else {
      for (const evidencePath of entry.evidence) {
        if (!evidenceExists(evidencePath)) {
          problems.push(
            `manifest: '${entry.providerId}' evidence path does not exist: ${evidencePath}`,
          )
        }
      }
    }
  }

  for (const [providerId, config] of Object.entries(registry)) {
    const entry = manifest.find(
      (candidate) => candidate.providerId === providerId,
    )
    const required = requiredExceptionKinds(config)
    const actual = new Set(entry?.kinds ?? [])

    for (const kind of required) {
      if (!actual.has(kind)) {
        problems.push(
          `manifest: '${providerId}' is missing required exception kind '${kind}'`,
        )
      }
    }
    for (const kind of actual) {
      if (!required.has(kind)) {
        problems.push(
          `manifest: '${providerId}' declares stale exception kind '${kind}'`,
        )
      }
    }

    if (required.size > 0 && entry === undefined) {
      problems.push(`manifest: '${providerId}' has unowned provider exceptions`)
    }
  }

  return problems
}

export type ProviderSurfaceSnapshot = {
  validProviderIds: readonly string[]
  setupProviderIds: readonly string[]
  routedProviderIds: readonly string[]
  documentedProviderIds: readonly string[]
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

/**
 * Check that materialized provider surfaces agree with the registry. Callers
 * supply observations from their own boundary (settings, setup, routing, and
 * generated docs); this function never imports those surfaces or mutates them.
 */
export function validateProviderSurfaceSnapshot(
  registry: Record<string, ProviderConfig>,
  snapshot: ProviderSurfaceSnapshot,
): string[] {
  const problems: string[] = []
  const registryIds = Object.keys(registry)
  const registrySet = new Set(registryIds)
  const expectedSetupIds = registryIds.filter(
    (id) => registry[id]?.setupAvailable,
  )
  const expectedRoutedIds = registryIds.filter(
    (id) => registry[id]?.kind !== 'local',
  )

  const checkSurface = (
    label: string,
    actual: readonly string[],
    expected: readonly string[],
  ): void => {
    for (const duplicate of duplicateValues(actual)) {
      problems.push(`${label}: '${duplicate}' appears more than once`)
    }
    for (const id of actual) {
      if (!registrySet.has(id)) {
        problems.push(
          `${label}: '${id}' is not present in the provider registry`,
        )
      }
    }
    const expectedSet = new Set(expected)
    for (const id of expected) {
      if (!actual.includes(id)) {
        problems.push(
          `${label}: '${id}' is missing from the materialized surface`,
        )
      }
    }
    for (const id of actual) {
      if (!expectedSet.has(id)) {
        problems.push(`${label}: stale provider '${id}' is materialized`)
      }
    }
  }

  checkSurface('valid-provider-ids', snapshot.validProviderIds, registryIds)
  checkSurface(
    'setup-provider-ids',
    snapshot.setupProviderIds,
    expectedSetupIds,
  )
  checkSurface(
    'routed-provider-ids',
    snapshot.routedProviderIds,
    expectedRoutedIds,
  )
  checkSurface(
    'documented-provider-ids',
    snapshot.documentedProviderIds,
    registryIds,
  )
  return problems
}

/** Detects duplicate ownership of provider URLs before routing can drift. */
export function validateProviderUrlOwnership(
  registry: Record<string, ProviderConfig>,
): string[] {
  const owners = new Map<string, string>()
  const problems: string[] = []
  for (const [providerId, config] of Object.entries(registry)) {
    for (const url of [
      config.baseUrl,
      ...(config.catalog.source === 'live' ? [config.catalog.url] : []),
    ]) {
      const owner = owners.get(url)
      if (owner !== undefined && owner !== providerId) {
        problems.push(
          `url: '${url}' is owned by both '${owner}' and '${providerId}'`,
        )
      } else {
        owners.set(url, providerId)
      }
    }
  }
  return problems
}

/**
 * Resolve a persisted provider safely. Removed/unknown values fall back to a
 * valid default, or return undefined when no valid fallback is available.
 */
export function resolveProviderFallback(
  providerId: string | undefined,
  validProviderIds: readonly string[],
  fallbackProviderId: string,
): string | undefined {
  const valid = new Set(validProviderIds)
  if (providerId !== undefined && valid.has(providerId)) return providerId
  return valid.has(fallbackProviderId) ? fallbackProviderId : undefined
}

export function isProviderAuditValid(
  registry: Record<string, ProviderConfig>,
  manifest: readonly ProviderExceptionManifestEntry[],
): boolean {
  return validateProviderAudit(registry, manifest).length === 0
}
