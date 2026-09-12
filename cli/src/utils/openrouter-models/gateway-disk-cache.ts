/**
 * On-disk warm-start cache for the combined gateway catalog
 * (FID-2026-0815-007 F-09). Extracted from gateway.ts (300-line file
 * cap) — persistence boundary only; the catalog aggregation state
 * remains in gateway.ts.
 */
import fs from 'node:fs'
import path from 'node:path'

import { getConfigDir } from '../config-dir'
import { CATALOG_TTL_MS } from './types'

import type { OpenRouterModel } from './types'

/** On-disk warm-start cache filename (FID-2026-0815-007 F-09). */
export const GATEWAY_CATALOG_CACHE_FILE = 'gateway-catalog.json'

export type GatewayCatalogDiskCache = {
  savedAt: number
  catalog: OpenRouterModel[]
}

export function gatewayCatalogCachePath(): string {
  return path.join(getConfigDir(), GATEWAY_CATALOG_CACHE_FILE)
}

/** Loads a fresh gateway catalog from the disk cache, or null when absent/stale/corrupt. */
export function loadGatewayCatalogFromDisk(): {
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
export async function writeGatewayCatalogToDisk(
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
