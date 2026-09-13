/**
 * Combined gateway catalog — OpenRouter + TokenRouter + TokenHarbor + NVIDIA NIM
 * + OpenCode Go + CommandCode + Nous Research + KiosAPI + APInex + OpenCode Zen
 * + OrcaRouter + B.AI + HCNSec + TokenBom — plus subscription plumbing.
 */
import fs from 'node:fs'

import { logger } from '../logger'
import {
  __resetApinexCacheForTest,
  fetchApinexModels,
  getCachedApinexModels,
} from './apinex'
import {
  __resetBaiCacheForTest,
  fetchBaiModels,
  getCachedBaiModels,
} from './bai'
import {
  __resetCustomCatalogsForTest,
  fetchAllCustomModels,
} from './custom-catalog'
import {
  gatewayCatalogCachePath,
  loadGatewayCatalogFromDisk,
  writeGatewayCatalogToDisk,
} from './gateway-disk-cache'
import {
  __resetKiosapiCacheForTest,
  fetchKiosapiModels,
  getCachedKiosapiModels,
} from './kiosapi'
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
  __resetZenCacheForTest,
  fetchZenModels,
  getCachedZenModels,
} from './opencode-zen'
import {
  __resetOpenRouterCacheForTest,
  fetchOpenRouterModels,
  getCachedOpenRouterModels,
} from './openrouter'
import {
  __resetOrcarouterCacheForTest,
  fetchOrcarouterModels,
  getCachedOrcarouterModels,
} from './orcarouter'
import {
  fetchCommandCodeModels,
  fetchHcnsecModels,
  fetchOpenCodeGoModels,
  fetchTokenBomModels,
  fetchTokenRouterModels,
  getTokenHarborModels,
} from './static-catalogs'
import { CATALOG_TTL_MS } from './types'

import type { OpenRouterModel } from './types'

let gatewayCache: OpenRouterModel[] | null = null
let gatewayCacheAt = 0
let gatewayInflight: Promise<OpenRouterModel[]> | null = null
const gatewayCatalogListeners = new Set<(catalog: OpenRouterModel[]) => void>()

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
 * - KiosAPI (live API, authenticated)
 * - APInex (live API, authenticated)
 * - OpenCode Zen (live API, public)
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
    const [orResult, nvidiaResult, ...restResults] = await Promise.allSettled([
      fetchOpenRouterModels(forceRefresh),
      fetchNvidiaModels(forceRefresh),
      fetchNousModels(forceRefresh),
      fetchKiosapiModels(forceRefresh),
      fetchApinexModels(forceRefresh),
      fetchOrcarouterModels(forceRefresh),
      fetchBaiModels(forceRefresh),
      fetchZenModels(forceRefresh),
      // FID-2026-0910-004 Step 9 remainder: custom catalogs (live + inline)
      // merge here; per-provider failures degrade to [] (D10 ladder).
      fetchAllCustomModels(forceRefresh),
    ])
    const [
      nousResult,
      kiosapiResult,
      apinexResult,
      orcarouterResult,
      baiResult,
      zenResult,
      customResult,
    ] = restResults

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
    const kiosapiModels =
      kiosapiResult.status === 'fulfilled'
        ? kiosapiResult.value
        : getCachedKiosapiModels()
    const apinexModels =
      apinexResult.status === 'fulfilled'
        ? apinexResult.value
        : getCachedApinexModels()
    const orcarouterModels =
      orcarouterResult.status === 'fulfilled'
        ? orcarouterResult.value
        : getCachedOrcarouterModels()
    const baiModels =
      baiResult.status === 'fulfilled' ? baiResult.value : getCachedBaiModels()
    const zenModels =
      zenResult.status === 'fulfilled' ? zenResult.value : getCachedZenModels()
    const customModels =
      customResult && customResult.status === 'fulfilled'
        ? customResult.value
        : []
    const tokenrouterModels = fetchTokenRouterModels()
    const tokenharborModels = getTokenHarborModels()
    const openCodeGoModels = fetchOpenCodeGoModels()
    const commandCodeModels = fetchCommandCodeModels()
    const hcnsecCatalog = fetchHcnsecModels()
    const tokenbomCatalog = fetchTokenBomModels()

    const combined = [
      ...orModels,
      ...tokenrouterModels,
      ...tokenharborModels,
      ...nvidiaModels,
      ...nousModels,
      ...kiosapiModels,
      ...apinexModels,
      ...orcarouterModels,
      ...baiModels,
      ...zenModels,
      ...openCodeGoModels,
      ...commandCodeModels,
      ...hcnsecCatalog,
      ...tokenbomCatalog,
      ...customModels,
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
  __resetKiosapiCacheForTest()
  __resetApinexCacheForTest()
  __resetOrcarouterCacheForTest()
  __resetBaiCacheForTest()
  __resetZenCacheForTest()
  // Step 9 remainder: lazily-built custom fetchers are cache state too.
  __resetCustomCatalogsForTest()
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
