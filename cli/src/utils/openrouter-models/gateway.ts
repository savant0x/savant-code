/**
 * Combined gateway catalog — OpenRouter + TokenRouter + TokenHarbor + NVIDIA NIM
 * + OpenCode Go + CommandCode + Nous Research — plus subscription plumbing.
 */
import fs from 'node:fs'
import path from 'node:path'

import { getConfigDir } from '../config-dir'
import { logger } from '../logger'
import {
  __resetNousCacheForTest,
  fetchNousModels,
  getCachedNousModels,
} from './nous'
import {
  __resetNvidiaCacheForTest,
  fetchNvidiaModels,
  getCachedNvidiaModels,
} from './nvidia'
import {
  __resetOpenRouterCacheForTest,
  fetchOpenRouterModels,
  getCachedOpenRouterModels,
} from './openrouter'
import {
  fetchCommandCodeModels,
  fetchOpenCodeGoModels,
  fetchTokenRouterModels,
  getTokenHarborModels,
} from './static-catalogs'
import { CATALOG_TTL_MS } from './types'

import type { OpenRouterModel } from './types'

let gatewayCache: OpenRouterModel[] | null = null
let gatewayCacheAt = 0
let gatewayInflight: Promise<OpenRouterModel[]> | null = null
const gatewayCatalogListeners = new Set<(catalog: OpenRouterModel[]) => void>()

/** On-disk warm-start cache filename (FID-2026-0815-007 F-09). */
const GATEWAY_CATALOG_CACHE_FILE = 'gateway-catalog.json'

type GatewayCatalogDiskCache = {
  savedAt: number
  catalog: OpenRouterModel[]
}

function gatewayCatalogCachePath(): string {
  return path.join(getConfigDir(), GATEWAY_CATALOG_CACHE_FILE)
}

/** Loads a fresh gateway catalog from the disk cache, or null when absent/stale/corrupt. */
function loadGatewayCatalogFromDisk(): {
  catalog: OpenRouterModel[]
  savedAt: number
} | null {
  try {
    const raw = fs.readFileSync(gatewayCatalogCachePath(), 'utf8')
    const parsed = JSON.parse(raw) as GatewayCatalogDiskCache
    if (
      !Array.isArray(parsed.catalog) ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt >= CATALOG_TTL_MS
    ) {
      return null
    }
    return { catalog: parsed.catalog, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

/** Best-effort write-through of the combined catalog (never throws). */
async function writeGatewayCatalogToDisk(
  catalog: OpenRouterModel[],
): Promise<void> {
  try {
    await fs.promises.mkdir(getConfigDir(), { recursive: true })
    const cache: GatewayCatalogDiskCache = { savedAt: Date.now(), catalog }
    await fs.promises.writeFile(
      gatewayCatalogCachePath(),
      JSON.stringify(cache),
      'utf8',
    )
  } catch {
    // Best-effort — model metadata is a warm-start convenience only.
  }
}

/**
 * Synchronous read of the combined gateway catalog (cached or empty).
 * Includes OpenRouter, TokenRouter, NVIDIA NIM, and OpenCode Go models.
 */
export function getCachedGatewayModels(): OpenRouterModel[] {
  return gatewayCache ?? []
}

/**
 * Subscribe to gateway catalog updates.
 * The listener receives the full cached catalog whenever it is populated
 * or refreshed. Returns an unsubscribe function.
 */
export function subscribeGatewayCatalog(
  listener: (catalog: OpenRouterModel[]) => void,
): () => void {
  gatewayCatalogListeners.add(listener)
  return () => gatewayCatalogListeners.delete(listener)
}

function notifyGatewayCatalogListeners(catalog: OpenRouterModel[]): void {
  for (const listener of gatewayCatalogListeners) {
    try {
      listener(catalog)
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Gateway catalog listener threw; continuing with remaining listeners',
      )
    }
  }
}

/**
 * Fetch the combined model catalog from all providers:
 * - OpenRouter (live API, public)
 * - NVIDIA NIM (live API, public)
 * - TokenRouter (hardcoded, requires auth for API)
 * - TokenHarbor (hardcoded baseline; authenticated catalog intentionally skipped)
 * - OpenCode Go (hardcoded, subscription-gated)
 * - CommandCode (hardcoded, provider catalog)
 * - Nous Research (live API, authenticated)
 *
 * Fetches live sources in parallel via Promise.allSettled(). If a source fails,
 * uses cached/empty list for that provider. Returns a combined, sorted list.
 * Caches per-process with the same TTL as OpenRouter.
 */
export async function fetchGatewayModels(
  forceRefresh = false,
): Promise<OpenRouterModel[]> {
  const now = Date.now()
  const fresh =
    gatewayCache !== null &&
    !forceRefresh &&
    now - gatewayCacheAt < CATALOG_TTL_MS
  if (fresh && gatewayCache) return gatewayCache
  if (gatewayInflight) return gatewayInflight

  // FID-2026-0815-007 (F-09): warm-start disk cache. When the in-memory cache
  // is cold, a fresh on-disk catalog is loaded synchronously so the model
  // picker + model-info block have metadata without paying the network RTT.
  if (!forceRefresh && gatewayCache === null) {
    const disk = loadGatewayCatalogFromDisk()
    if (disk && disk.catalog.length > 0) {
      gatewayCache = disk.catalog
      gatewayCacheAt = disk.savedAt
      notifyGatewayCatalogListeners(disk.catalog)
      return disk.catalog
    }
  }

  gatewayInflight = (async () => {
    const [orResult, nvidiaResult, nousResult] = await Promise.allSettled([
      fetchOpenRouterModels(forceRefresh),
      fetchNvidiaModels(forceRefresh),
      fetchNousModels(forceRefresh),
    ])

    const orModels =
      orResult.status === 'fulfilled'
        ? orResult.value
        : getCachedOpenRouterModels()
    const nvidiaModels =
      nvidiaResult.status === 'fulfilled'
        ? nvidiaResult.value
        : getCachedNvidiaModels()
    const nousModels =
      nousResult.status === 'fulfilled'
        ? nousResult.value
        : getCachedNousModels()
    const tokenrouterModels = fetchTokenRouterModels()
    const tokenharborModels = getTokenHarborModels()
    const openCodeGoModels = fetchOpenCodeGoModels()
    const commandCodeModels = fetchCommandCodeModels()

    const combined = [
      ...orModels,
      ...tokenrouterModels,
      ...tokenharborModels,
      ...nvidiaModels,
      ...nousModels,
      ...openCodeGoModels,
      ...commandCodeModels,
    ]
    combined.sort((a, b) => a.id.localeCompare(b.id))
    gatewayCache = combined
    gatewayCacheAt = Date.now()
    notifyGatewayCatalogListeners(combined)
    // FID-2026-0815-007 (F-09): write-through so the next cold boot skips the RTT.
    await writeGatewayCatalogToDisk(combined)
    return combined
  })()

  return gatewayInflight
}

/**
 * Test-only: clear all in-memory catalog caches + in-flight requests so tests
 * start from a known state. Not used in production.
 */
export function __resetOpenRouterModelsCacheForTest(): void {
  __resetOpenRouterCacheForTest()
  __resetNvidiaCacheForTest()
  __resetNousCacheForTest()
  gatewayCache = null
  gatewayCacheAt = 0
  gatewayInflight = null
  // FID-2026-0815-007: also clear the on-disk warm-start cache so tests start
  // from a known state.
  try {
    fs.rmSync(gatewayCatalogCachePath(), { force: true })
  } catch {
    // Best-effort.
  }
  // Note: intentionally do not clear gatewayCatalogListeners here. This reset
  // is for cache state; listeners (including the gateway-catalog store) should
  // survive test resets so subscriptions remain intact.
}
