/**
 * Generic live model-catalog fetcher (FID-2026-0809-001 Phase 3).
 *
 * Collapses the former openrouter.ts + nvidia.ts live fetchers into ONE
 * implementation: identical cache/TTL/inflight/degrade semantics, with a
 * per-provider URL, parser, and optional credential resolver. OpenRouter's
 * catalog fetch can authenticate via the master-key resolver (adversarial
 * finding 10); NVIDIA NIM's public endpoint needs no resolver.
 *
 * The result is cached per-process with a short TTL so the /model picker stays
 * current without hammering the endpoint. On any failure the fetcher degrades
 * gracefully: callers fall back to free-text entry of an exact model id.
 */
import { logger } from '../logger'
import { CATALOG_TTL_MS } from './types'

import type { OpenRouterModel } from './types'

export interface LiveCatalogFetcherOptions<TResponse = unknown> {
  /** Catalog endpoint, e.g. https://openrouter.ai/api/v1/models. */
  url: string
  /** Human label for log messages, e.g. 'OpenRouter' or 'NVIDIA NIM'. */
  logLabel: string
  /**
   * Provider-specific response parser. Receives the raw JSON body and returns
   * the normalized OpenRouterModel list (sorted, if the provider cares).
   */
  parse: (json: TResponse) => OpenRouterModel[]
  /**
   * Optional credential resolver. When it resolves to a key, the catalog
   * request is sent with `Authorization: Bearer <key>`. When it resolves to
   * undefined (or is absent), the request is public.
   */
  resolveKey?: () => Promise<string | undefined> | string | undefined
}

export interface LiveCatalogFetcher {
  fetchModels(forceRefresh?: boolean): Promise<OpenRouterModel[]>
  getCachedModels(): OpenRouterModel[]
  hasCatalog(): boolean
  resetForTest(): void
}

/**
 * Build a live-catalog fetcher for one provider. Concurrent callers share a
 * single in-flight request; on failure the last good cache is returned (or an
 * empty list when none exists). Never throws.
 */
export function createLiveCatalogFetcher<TResponse = unknown>(
  options: LiveCatalogFetcherOptions<TResponse>,
): LiveCatalogFetcher {
  let generation = 0
  let cachedCatalog: OpenRouterModel[] | null = null
  let cachedAt = 0
  let inflight: Promise<OpenRouterModel[]> | null = null

  const fetchModels = async (
    forceRefresh = false,
  ): Promise<OpenRouterModel[]> => {
    const now = Date.now()
    const fresh =
      cachedCatalog !== null && !forceRefresh && now - cachedAt < CATALOG_TTL_MS

    if (fresh && cachedCatalog) {
      return cachedCatalog
    }

    if (inflight) {
      return inflight
    }

    const owner = generation
    inflight = (async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        const key = await options.resolveKey?.()
        if (key) {
          headers.Authorization = `Bearer ${key}`
        }
        const resp = await fetch(options.url, {
          headers,
          // Don't let a slow/hung catalog request block the picker forever.
          signal: AbortSignal.timeout(10_000),
        })
        if (!resp.ok) {
          throw new Error(`${options.logLabel} models HTTP ${resp.status}`)
        }
        // The parser is provider-typed; the raw body is cast at this single
        // trust boundary (the network), matching the caller's declared shape.
        const json = (await resp.json()) as TResponse
        const parsed = options.parse(json)
        if (owner === generation) {
          cachedCatalog = parsed
          cachedAt = Date.now()
        }
        return parsed
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          `Failed to fetch ${options.logLabel} model catalog; using cache or empty list`,
        )
        // Degrade: prefer stale cache, else empty (free-text fallback).
        return cachedCatalog ?? []
      } finally {
        if (owner === generation) inflight = null
      }
    })()

    return inflight
  }

  /** Synchronous read of the current catalog (cached or empty). */
  const getCachedModels = (): OpenRouterModel[] => cachedCatalog ?? []

  /** Whether a live catalog has been loaded at least once. */
  const hasCatalog = (): boolean => cachedCatalog !== null

  /** Test-only: clear the cache + in-flight request. */
  const resetForTest = (): void => {
    generation++
    cachedCatalog = null
    cachedAt = 0
    inflight = null
  }

  return { fetchModels, getCachedModels, hasCatalog, resetForTest }
}
