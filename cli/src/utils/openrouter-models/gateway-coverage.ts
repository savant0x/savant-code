/**
 * Coverage validation for the warm-start gateway catalog snapshot
 * (FID-2026-1006-001 M2).
 *
 * The failure class this closes: a healthy, fully wired live provider ships
 * rows to `/model` only after a fresh catalog fetch, but a cold start served
 * the on-disk snapshot unconditionally — a snapshot written before a key was
 * configured stayed stale until TTL expiry, hiding that provider forever with
 * no signal. The warm-start load now validates snapshot COVERAGE against the
 * registry: any live provider whose key resolves (env or stored — the unified
 * `resolveProviderApiKey` is the ONE legal read of "resolvable") yet
 * contributes zero rows makes the snapshot stale, so the caller rebuilds.
 *
 * Pure + exported helpers keep every decision testable without network:
 * `rowProviderIds` and `computeGaps` are synchronous over typed inputs; the
 * async `computeCatalogGaps` adds only the key-resolution leg.
 */
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { resolveProviderApiKey } from '../provider-credentials'

import type { OpenRouterModel } from './types'
import type { WindowCoverageEntry } from '@savant-code/common/constants/window-coverage-register'

/** Cooldown between gateway rebuilds triggered by a coverage gap (anti-thrash). */
export const REFRESH_COOLDOWN_MS = 5 * 60 * 1000

/** Module-level last-rebuild timestamp (per-process; test-resettable). */
let lastRefreshAttemptAt: number | undefined

/** Clock-injectable read of the cooldown state. */
export function gatewayRefreshCooledDown(now: number = Date.now()): boolean {
  return (
    lastRefreshAttemptAt !== undefined &&
    now - lastRefreshAttemptAt < REFRESH_COOLDOWN_MS
  )
}

/** Record a rebuild attempt (called only when the caller actually refreshes). */
export function markGatewayRefreshAttempt(now: number = Date.now()): void {
  lastRefreshAttemptAt = now
}

/** Test-only reset of the module-level cooldown state. */
export function __resetGatewayRefreshCooldownForTest(): void {
  lastRefreshAttemptAt = undefined
}

/** The registry ids whose catalog source is `live`. */
export function liveProviderIds(): string[] {
  return (
    Object.keys(PROVIDER_REGISTRY) as Array<keyof typeof PROVIDER_REGISTRY>
  ).filter((id) => PROVIDER_REGISTRY[id].catalog.source === 'live')
}

/** The set of provider prefixes that actually contributed rows to a catalog. */
export function rowProviderIds(catalog: OpenRouterModel[]): Set<string> {
  const present = new Set<string>()
  for (const model of catalog) {
    const slash = model.id.indexOf('/')
    if (slash > 0) present.add(model.id.slice(0, slash))
  }
  return present
}

/**
 * Live providers that have a resolvable key (env or stored) — computed via
 * `resolveProviderApiKey`, the same chain the catalog fetchers use, so the
 * validator can never disagree with the fetchers about who is keyed.
 */
export async function resolveKeyedLiveProviders(
  ids: readonly string[],
): Promise<Set<string>> {
  const keyed = new Set<string>()
  for (const id of ids) {
    const key = await resolveProviderApiKey(id)
    if (key !== undefined) keyed.add(id)
  }
  return keyed
}

/**
 * Synchronous gap computation over typed inputs (the network-free test seam).
 * Returns the registry live providers that ARE key-resolvable but contributed
 * zero rows. No-key providers are never gaps — absence without a key is
 * "provider awaits key", not a cache defect.
 */
export function computeGaps(
  catalog: OpenRouterModel[],
  keyedProviderIds: ReadonlySet<string>,
  liveIds: readonly string[],
): string[] {
  const present = rowProviderIds(catalog)
  return liveIds.filter((id) => keyedProviderIds.has(id) && !present.has(id))
}

/**
 * Async convenience: compute the coverage gaps of a catalog snapshot end to
 * end. Used by `fetchGatewayModels` at warm start. Resolves keys ONLY for
 * providers ABSENT from the catalog — the fully-covered fast path performs
 * zero credential reads (Verifier FAIL 3, FID-2026-1006-001 audit).
 */
export async function computeCatalogGaps(
  catalog: OpenRouterModel[],
): Promise<string[]> {
  const live = liveProviderIds()
  const present = rowProviderIds(catalog)
  const absent = live.filter((id) => !present.has(id))
  const keyed = await resolveKeyedLiveProviders(absent)
  return absent.filter((id) => keyed.has(id))
}

/**
 * Live providers that contribute rows to a catalog but are declared
 * `no-runtime-rows` in WINDOW_COVERAGE_REGISTER (FID-2026-1006-001 M4).
 * The register is hand-maintained truth; this is the mechanical drift
 * detector that surfaces when reality outgrew the declaration. The register
 * is injectable so tests can pin behavior without touching the live table.
 */
export async function staleWindowCoverageLiveProviders(
  catalog: OpenRouterModel[],
  register: ReadonlyMap<string, WindowCoverageEntry> = WINDOW_COVERAGE_REGISTER,
): Promise<string[]> {
  const present = rowProviderIds(catalog)
  const stale: string[] = []
  for (const id of present) {
    const entry = register.get(id)
    if (entry?.disposition === 'no-runtime-rows') stale.push(id)
  }
  return stale.sort()
}

/**
 * Test isolation: clears the module-scope rebuild cooldown timestamp —
 * process-lifetime state `bun test` shares across files (FID-2026-1007-002).
 * Same seam as `__resetGatewayRefreshCooldownForTest`, under the reset name the
 * module-state audit recognizes.
 */
export function resetGatewayCoverageState(): void {
  lastRefreshAttemptAt = undefined
}
