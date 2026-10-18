/** Keyless free-model catalog with a profile cache and durable notice deltas.
 * Configured credentials, advertised offerings and account access remain separate.
 * Refresh failure retains the last-good cache; boot delivery uses the coordinator.
 */
import fs from 'node:fs'
import path from 'node:path'

import { advertisedModelVisible } from '@savant-code/common/providers/availability-state'
import { canonicalProviderId } from '@savant-code/common/providers/readiness'

import { renderFreeOptionsArtifact } from './free-options-artifact'
import { liftCatalog } from './free-options-catalog'
import { buildMachineContext } from './free-options-context'
import { freeOptionsPaths } from './free-options-paths'
import { buildFreeOptionsView } from './free-options-view'
import { providerNotifications } from './provider-notifications'
import {
  countOffersEndingSoon,
  readProviderOfferDiscovery,
} from './provider-offers'
import { writeFileAtomic } from './write-file-atomic'

import type {
  FreeCatalogEnvelope,
  FreeLane,
  FreeOptionsContext,
  FreeOptionsExportStatus,
  FreeOptionsReport,
} from './free-options-types'

// Re-export the surface the command handler and tests consume, so callers
// keep ONE import module while the ceiling keeps the file split (Law 13).
export { liftCatalog } from './free-options-catalog'
export {
  renderCommandOutput,
  renderFreeOptionsMarkdown,
} from './free-options-render'
export {
  renderFreeOptionsArtifact,
  verifyFreeOptionsArtifact,
} from './free-options-artifact'
export { buildFreeOptionsView } from './free-options-view'
export type { FreeOptionsView } from './free-options-view'
export { freeOptionsPaths } from './free-options-paths'
export type {
  FreeCatalogEnvelope,
  FreeCatalogModel,
  FreeLane,
  FreeOptionsContext,
  FreeOptionsReport,
  FreeProviderAttribution,
} from './free-options-types'

const CATALOG_URL = 'https://free-llm-models.custats.info/free_models.json'
const CACHE_MAX_AGE_MS = 24 * 3600_000
const FETCH_TIMEOUT_MS = 5_000
const USER_AGENT =
  'savant-code-free-options (+https://github.com/savant0x/savant-code)'

/** True when `fetchedAt` parses and is within the 24h TTL of `nowMs`. */
export function isCacheFresh(fetchedAt: string | null, nowMs: number): boolean {
  if (!fetchedAt) return false
  const ts = Date.parse(fetchedAt)
  if (Number.isNaN(ts)) return false
  const age = nowMs - ts
  return age >= 0 && age <= CACHE_MAX_AGE_MS
}

/** Keyless fetch of the catalog; null on ANY failure (soft-degrade). */
export async function fetchFreeCatalog(): Promise<FreeCatalogEnvelope | null> {
  try {
    const r = await fetch(CATALOG_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!r.ok) return null
    const catalog = liftCatalog(await r.json())
    return catalog && isCacheFresh(catalog.fetchedAt, Date.now())
      ? catalog
      : null
  } catch {
    return null
  }
}

/**
 * Build the BYOK split. `catalog === null` means offline-with-no-cache: the
 * report still carries local lanes so the command never hard-fails.
 */
export function buildFreeOptionsReport(
  catalog: FreeCatalogEnvelope | null,
  context: FreeOptionsContext,
): FreeOptionsReport {
  const wiredFree: Array<FreeLane> = []
  const notWired: Array<FreeLane & { setupCommand: string }> = []
  const discoveryOnly: FreeLane[] = []

  if (catalog) {
    // Group models by providerId first, then partition by wired state.
    const byProvider = new Map<string, string[]>()
    for (const model of catalog.models) {
      const id = canonicalProviderId(model.providerId)
      if (!advertisedModelVisible(id, model.id)) continue
      const list = byProvider.get(id)
      if (list) list.push(model.id)
      else byProvider.set(id, [model.id])
    }
    for (const [providerId, models] of byProvider) {
      const attribution = context.registryByProviderId[providerId]
      if (!attribution) {
        discoveryOnly.push({ providerId, label: providerId, models })
        continue
      }
      const lane = { providerId, label: attribution.label, models }
      if (
        attribution.credentialReady ??
        context.wiredEnvVars.has(attribution.envVar)
      ) {
        wiredFree.push(lane)
      } else {
        notWired.push({ ...lane, setupCommand: attribution.setupCommand })
      }
    }
    notWired.sort((a, b) => a.providerId.localeCompare(b.providerId))
  }

  const configuredProviders = Object.values(context.registryByProviderId)
    .filter(
      (attribution) =>
        attribution.credentialReady ??
        context.wiredEnvVars.has(attribution.envVar),
    )
    .map((attribution) => attribution.label)
    .sort((a, b) => a.localeCompare(b))

  return {
    fetchedAt: catalog?.fetchedAt ?? null,
    catalogModels: catalog?.models.map((model) => ({ ...model })) ?? [],
    stale: catalog !== null && !isCacheFresh(catalog.fetchedAt, context.nowMs),
    ...(catalog
      ? {
          catalogEvidence: {
            class: 'api-public' as const,
            source: CATALOG_URL,
          },
        }
      : {}),
    quotaReading: { state: 'unknown', source: 'none' },
    configuredProviders,
    wiredFree,
    notWired,
    localFree: context.localProviders.map((p) => ({ ...p })),
    discoveryOnly,
    // The envelope's own delta; surfaced in both headers (FID-2026-1016-010).
    newModelIds: catalog?.newModelIds ?? [],
  }
}

/**
 * Render and write the markdown artifact, returning the outcome instead of
 * swallowing it (FID-2026-1017-005). A failure leaves the in-memory report
 * complete, so the panel and command stay truthful about the data and
 * explicit about the missing file.
 */
export function persistFreeOptionsArtifact(
  report: FreeOptionsReport,
  markdownPath: string,
  generatedAt: string,
): FreeOptionsExportStatus {
  const view = buildFreeOptionsView(report, { markdownPath, generatedAt })
  const artifact = renderFreeOptionsArtifact(view)
  try {
    const written = writeFileAtomic(markdownPath, artifact.text)
    return {
      path: markdownPath,
      ok: true,
      generatedAt,
      generationId: artifact.generationId,
      durability: written.durability,
    }
  } catch (error) {
    return {
      path: markdownPath,
      ok: false,
      generatedAt,
      generationId: artifact.generationId,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Assemble the machine context (wired env vars ∪ persisted store) and run
 * one refresh cycle: fetch-if-stale, persist cache + markdown, return the
 * report. Used by the `/provider free` handler.
 */
let refreshInFlight: Promise<FreeOptionsReport> | undefined
export function refreshFreeOptions(): Promise<FreeOptionsReport> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = refreshFreeOptionsOnce().finally(() => {
    refreshInFlight = undefined
  })
  return refreshInFlight
}
async function refreshFreeOptionsOnce(): Promise<FreeOptionsReport> {
  const paths = freeOptionsPaths()
  const nowMs = Date.now()

  let catalog = await fetchFreeCatalog()
  const fetched = catalog !== null
  const previous = readCachedFreeCatalog()
  if (
    catalog &&
    previous &&
    Date.parse(catalog.fetchedAt) < Date.parse(previous.fetchedAt)
  )
    catalog = previous
  let fetchedAt: string | null = catalog?.fetchedAt ?? null

  if (catalog === null) {
    // Offline / failed: serve the cache if one exists.
    try {
      if (fs.existsSync(paths.cache)) {
        catalog = liftCatalog(JSON.parse(fs.readFileSync(paths.cache, 'utf8')))
      }
    } catch {
      catalog = null
    }
    if (catalog) fetchedAt = catalog.fetchedAt
  }

  const report = buildFreeOptionsReport(catalog, buildMachineContext(nowMs))
  report.fetchedAt = fetchedAt
  report.catalogSource = fetched ? 'network' : catalog ? 'cache' : 'none'
  report.discoveryOffers = readProviderOfferDiscovery(nowMs)
  report.discoveryOffersEndingSoon = countOffersEndingSoon(nowMs)

  if (catalog !== null) {
    try {
      fs.mkdirSync(path.dirname(paths.cache), { recursive: true })
      writeFileAtomic(paths.cache, JSON.stringify(catalog, null, 2))
    } catch {
      // The cache is a fast-boot convenience; a failed cache write is visible
      // on the next boot as a refetch, and the panel's data is unaffected.
    }
    report.exportStatus = persistFreeOptionsArtifact(
      report,
      paths.markdown,
      new Date(nowMs).toISOString(),
    )
    if (fetched)
      try {
        providerNotifications.observeCatalog(catalog)
      } catch {
        /* Inbox failure retains its previous snapshot. */
      }
  }
  return report
}

/**
 * FID-2026-1001-002 — read the LOCAL cache (never fetches) and build the
 * BYOK split with the live machine context. Null when no cache exists or
 * the cached JSON is corrupt (fail-silent). Used by the boot announce;
 * `/provider free`'s refresh remains the fetch path.
 */
export function readCachedFreeOptionsReport(): FreeOptionsReport | null {
  let catalog: FreeCatalogEnvelope | null = null
  try {
    const paths = freeOptionsPaths()
    if (fs.existsSync(paths.cache)) {
      catalog = liftCatalog(JSON.parse(fs.readFileSync(paths.cache, 'utf8')))
    }
  } catch {
    catalog = null
  }
  if (!catalog) return null
  const report = buildFreeOptionsReport(
    catalog,
    buildMachineContext(Date.now()),
  )
  report.catalogSource = 'cache'
  report.discoveryOffers = readProviderOfferDiscovery()
  report.discoveryOffersEndingSoon = countOffersEndingSoon()
  return report
}

export function readCachedFreeCatalog(): FreeCatalogEnvelope | null {
  try {
    return liftCatalog(
      JSON.parse(fs.readFileSync(freeOptionsPaths().cache, 'utf8')),
    )
  } catch {
    return null
  }
}

/**
 * Test isolation: drops the in-flight refresh promise — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 */
export function resetRefreshInFlight(): void {
  refreshInFlight = undefined
}
