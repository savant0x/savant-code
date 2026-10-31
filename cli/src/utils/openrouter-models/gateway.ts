/** Combined live and static gateway catalog, plus subscription plumbing. */
import fs from 'node:fs'

import { modelRequestLimits } from '@savant-code/common/util/model-request-limits'

import { logger } from '../logger'
import { __resetAihubmixCacheForTest } from './aihubmix'
import { __resetApinexCacheForTest } from './apinex'
import { __resetApixoCacheForTest } from './apixo'
import { __resetAshnaCacheForTest } from './ashna'
import { __resetBaiCacheForTest } from './bai'
import { __resetBlazerailCacheForTest } from './blazerail'
import { __resetCleanApisCacheForTest } from './cleanapis'
import { __resetCodecraftCacheForTest } from './codecraft'
import { __resetCustomCatalogsForTest } from './custom-catalog'
import { __resetDeepInfraCacheForTest } from './deepinfra'
import { assembleGatewayCatalog } from './gateway-catalog-merge'
import {
  computeCatalogGaps,
  gatewayRefreshCooledDown,
  markGatewayRefreshAttempt,
  staleWindowCoverageLiveProviders,
} from './gateway-coverage'
import {
  gatewayCatalogCachePath,
  loadGatewayCatalogFromDisk,
  writeGatewayCatalogToDisk,
} from './gateway-disk-cache'
import {
  fetchGatewayLiveCatalogs,
  resolveGatewayLiveCatalogs,
} from './gateway-live-results'
import { __resetHyperCacheForTest } from './hyper'
import { __resetKiosapiCacheForTest } from './kiosapi'
import { __resetMistralCacheForTest } from './mistral'
import { __resetNousCacheForTest } from './nous'
import { __resetNvidiaCacheForTest } from './nvidia'
import { __resetOpenAiCacheForTest } from './openai'
import { __resetOpenRouterCacheForTest } from './openrouter'
import { __resetOrcarouterCacheForTest } from './orcarouter'
import { __resetRiverCacheForTest } from './river'
import { CATALOG_TTL_MS } from './types'
import { __resetVeniceCacheForTest } from './venice'
import { __resetVercelCacheForTest } from './vercel'
import { __resetXkiroCacheForTest } from './xkiro'
import { __resetZyloCacheForTest } from './zylo'

import type { OpenRouterModel } from './types'

let gatewayCache: OpenRouterModel[] | null = null
let gatewayCacheAt = 0
let gatewayInflight: Promise<OpenRouterModel[]> | null = null
/**
 * FID-2026-1007-006: the owner of the catalog cache. Every path that PUBLISHES
 * a catalog (the warm-start snapshot and the full rebuild) claims this token
 * first; a build whose token is no longer current still returns its own
 * catalog to its caller but must not write the process-wide cache. Without it,
 * a slow build from an earlier caller overwrote a later one — measured as a
 * cross-file leak in this workspace's suite, where one test file's assertion
 * read a catalog assembled by another file (the `bun run test` red).
 */
let gatewayBuildToken = 0
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
  // OpenRouter leaves provider unset for historical picker semantics. Budget
  // knowledge still needs its serving identity, including on disk warm-start.
  modelRequestLimits.replaceCatalog(catalog, 'openrouter')
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
 * - CommandCode (hardcoded, provider catalog)
 * - Nous Research (live API, authenticated)
 * - KiosAPI (live API, authenticated)
 * - APInex (live API, authenticated)
 * - OpenAI (live API, authenticated — FID-2026-1001-001)
 * - OrcaRouter (live API, public)
 * - B.AI (live API, authenticated)
 * - HCNSec / TokenBom / Infron / UnoRouter / BazaarLink / Atria AI /
 *   Intern InkStone (static audited catalogs)
 * - ChatAnywhere (static audited catalog — FID-2026-1007-005)
 * - Vercel AI Gateway (live API, public)
 * - Mistral AI (live API, authenticated — FID-2026-1009-005)
 * - Apixo (live API, public — FID-2026-1013-003)
 * - AIHubMix (live API, public — FID-2026-1013-004)
 * - DeepInfra (live API, public — FID-2026-1012-026)
 * - Venice AI (live API, public — FID-2026-1012-026)
 * - Ashna (live API, authenticated — FID-2026-1016-018)
 * - BlazeRail (live API, public — FID-2026-1017-013)
 * - River AI (live API, authenticated — FID-2026-1017-015)
 * - Zylo AI (live text catalog, public — FID-2026-1017-016)
 * - Hyper (live API, public catalog — FID-2026-1030-004)
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

  // FID-2026-1007-006: claim the cache and supersede every build before this
  // one, so a later publish always wins.
  const buildToken = ++gatewayBuildToken

  const inflight = (async () => {
    // FID-2026-0815-007 (F-09): warm-start disk cache. When the in-memory cache
    // is cold, a fresh on-disk catalog is loaded synchronously so the model
    // picker + model-info block have metadata without paying the network RTT.
    // FID-2026-1006-001 M2: coverage-validate the snapshot before serving it —
    // a keyed live provider contributing zero rows means the snapshot predates
    // the key and would hide that provider from /model with no signal.
    if (!forceRefresh && gatewayCache === null) {
      const disk = loadGatewayCatalogFromDisk()
      if (disk && disk.catalog.length > 0) {
        const gaps = await computeCatalogGaps(disk.catalog)
        if (gaps.length === 0) {
          if (buildToken === gatewayBuildToken) {
            gatewayCache = disk.catalog
            gatewayCacheAt = disk.savedAt
            notifyGatewayCatalogListeners(disk.catalog)
          }
          return disk.catalog
        }
        if (gatewayRefreshCooledDown()) {
          // A rebuild ran recently and still left a gap (e.g. 401). Serve the
          // snapshot rather than thrash the upstream within the cooldown.
          logger.warn(
            { providers: gaps },
            'Gateway warm-start snapshot has coverage gaps; serving snapshot (refresh cooled down)',
          )
          if (buildToken === gatewayBuildToken) {
            gatewayCache = disk.catalog
            gatewayCacheAt = disk.savedAt
            notifyGatewayCatalogListeners(disk.catalog)
          }
          return disk.catalog
        }
        markGatewayRefreshAttempt()
        logger.warn(
          { providers: gaps },
          'Gateway warm-start snapshot missing keyed live providers; rebuilding',
        )
        // Fall through to the full refresh path.
      }
    }

    const { orResult, nvidiaResult, restResults } =
      await fetchGatewayLiveCatalogs(forceRefresh)
    // FID-2026-1001-001: the settled ladder and the merge order live in their
    // own 300-line-cap modules (gateway-live-results.ts,
    // gateway-catalog-merge.ts); each documents its own positional contract.
    const combined = assembleGatewayCatalog(
      resolveGatewayLiveCatalogs(orResult, nvidiaResult, restResults),
    )
    // FID-2026-1007-006: a superseded build returns its own catalog but
    // publishes nothing — neither the cache, nor the listeners, nor the disk.
    if (buildToken !== gatewayBuildToken) return combined
    gatewayCache = combined
    gatewayCacheAt = Date.now()
    notifyGatewayCatalogListeners(combined)
    // FID-2026-0815-007 (F-09): write-through so the next cold boot skips the RTT.
    await writeGatewayCatalogToDisk(combined)
    // FID-2026-1006-001 M4: surface window-coverage register drift mechanically.
    for (const id of await staleWindowCoverageLiveProviders(combined)) {
      logger.warn(
        { provider: id },
        'WINDOW_COVERAGE_REGISTER stale for this provider — run window-coverage:check --fix',
      )
    }
    return combined
  })()

  gatewayInflight = inflight
  try {
    return await inflight
  } finally {
    // FID-2026-1007-006: clear the slot on settle. It used to hold a completed
    // promise for the rest of the process, so the post-TTL path returned the
    // stale catalog instead of rebuilding — CATALOG_TTL_MS never took effect.
    if (buildToken === gatewayBuildToken) gatewayInflight = null
  }
}

/**
 * FID-2026-1011-006 R20: drop the process-wide catalog after a CREDENTIAL
 * mutation. A keyed live provider contributes rows only when its key resolves,
 * so the merged catalog — and the warm-start snapshot written from it — is
 * stale the moment a credential changes. Scoped to that one event (never to a
 * picker read), and it carries no key material: no value, name or digest from
 * a credential reaches the cache, its metadata, or a log line.
 */
/**
 * Drop every per-provider catalog cache. A credential change is only fully
 * honoured once the provider fetchers are dropped too — the merged catalog is
 * rebuilt FROM them, so clearing the merge cache alone would rebuild the same
 * rows (measured: the refresh issued no new request). One list, two callers
 * (Law 13).
 */
function resetProviderCatalogCaches(): void {
  __resetOpenRouterCacheForTest()
  __resetNvidiaCacheForTest()
  __resetNousCacheForTest()
  __resetKiosapiCacheForTest()
  __resetApinexCacheForTest()
  __resetOpenAiCacheForTest()
  __resetOrcarouterCacheForTest()
  __resetBaiCacheForTest()
  __resetVercelCacheForTest()
  __resetCleanApisCacheForTest()
  __resetCodecraftCacheForTest()
  __resetMistralCacheForTest()
  __resetXkiroCacheForTest()
  __resetApixoCacheForTest()
  __resetAihubmixCacheForTest()
  __resetDeepInfraCacheForTest()
  __resetVeniceCacheForTest()
  __resetAshnaCacheForTest()
  __resetBlazerailCacheForTest()
  __resetRiverCacheForTest()
  __resetZyloCacheForTest()
  __resetHyperCacheForTest()
  // Step 9 remainder: lazily-built custom fetchers are cache state too.
  __resetCustomCatalogsForTest()
}

export function invalidateGatewayCatalog(): void {
  // Supersede any build that is already in flight, so a pre-mutation refresh
  // cannot publish its own result into the cache afterwards (the ownership
  // rule below applies here too).
  gatewayBuildToken += 1
  gatewayCache = null
  gatewayCacheAt = 0
  gatewayInflight = null
  modelRequestLimits.replaceCatalog([])
  resetProviderCatalogCaches()
  try {
    // The snapshot is served at cold boot, before any network call, so it must
    // go with the in-memory cache.
    fs.rmSync(gatewayCatalogCachePath(), { force: true })
  } catch {
    // Best-effort: an unwritable snapshot is rebuilt by the next refresh.
  }
}

/**
 * Test-only: clear all in-memory catalog caches + in-flight requests so tests
 * start from a known state. Not used in production.
 */
export function __resetOpenRouterModelsCacheForTest(): void {
  resetProviderCatalogCaches()
  gatewayCache = null
  modelRequestLimits.replaceCatalog([])
  gatewayCacheAt = 0
  gatewayInflight = null
  // FID-2026-1007-006: supersede any build still in flight, so a promise
  // started before this reset cannot publish into the cache afterwards.
  gatewayBuildToken += 1
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
