import { logger } from './logger'

/**
 * Live OpenRouter model catalog.
 *
 * OpenRouter's model list changes frequently, so rather than hardcoding a
 * stale table we fetch the current catalog from their public API. The result
 * is cached per-process with a short TTL so the /model picker stays current
 * without hammering the endpoint. On any failure we degrade gracefully: the
 * caller falls back to free-text entry of an exact model id.
 */

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

/** How long a fetched catalog is considered fresh before a refresh. */
const CATALOG_TTL_MS = 5 * 60 * 1000

export type ModelProvider = 'openrouter' | 'tokenrouter' | 'nvidia'

export type OpenRouterModel = {
  /** Canonical model id, e.g. "anthropic/claude-sonnet-4". */
  id: string
  /** Human-readable name. */
  name: string
  /** Context window in tokens, if reported by the API. */
  contextLength?: number
  /** Prompt price per token, if reported. */
  promptPricePerToken?: number
  /** Completion price per token, if reported. */
  completionPricePerToken?: number
  /** Which provider this model belongs to. */
  provider?: ModelProvider
}

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: string
    name?: string
    context_length?: number
    pricing?: {
      prompt?: string
      completion?: string
    }
  }>
}

let cachedCatalog: OpenRouterModel[] | null = null
let cachedAt = 0
let inflight: Promise<OpenRouterModel[]> | null = null

function parseCatalog(json: OpenRouterModelsResponse): OpenRouterModel[] {
  const models = json.data ?? []
  const parsed: OpenRouterModel[] = []
  for (const m of models) {
    if (!m.id) continue
    const prompt = m.pricing?.prompt
    const completion = m.pricing?.completion
    parsed.push({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length,
      promptPricePerToken:
        prompt !== undefined ? Number(prompt) : undefined,
      completionPricePerToken:
        completion !== undefined ? Number(completion) : undefined,
    })
  }
  // Stable, predictable order for the picker.
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

/**
 * Fetch the live OpenRouter model catalog.
 *
 * Returns a cached copy when fresh; otherwise fetches and caches. Concurrent
 * callers share a single in-flight request. On failure, returns the last good
 * cache if available, else an empty list — callers must handle empty as
 * "show free-text entry". Never throws.
 */
export async function fetchOpenRouterModels(
  forceRefresh = false,
): Promise<OpenRouterModel[]> {
  const now = Date.now()
  const fresh = cachedCatalog !== null && !forceRefresh && now - cachedAt < CATALOG_TTL_MS

  if (fresh && cachedCatalog) {
    return cachedCatalog
  }

  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    try {
      const resp = await fetch(OPENROUTER_MODELS_URL, {
        headers: { Accept: 'application/json' },
        // Don't let a slow/hung catalog request block the picker forever.
        signal: AbortSignal.timeout(10_000),
      })
      if (!resp.ok) {
        throw new Error(`OpenRouter models HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as OpenRouterModelsResponse
      const parsed = parseCatalog(json)
      cachedCatalog = parsed
      cachedAt = Date.now()
      return parsed
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch OpenRouter model catalog; using cache or empty list',
      )
      // Degrade: prefer stale cache, else empty (free-text fallback).
      return cachedCatalog ?? []
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/**
 * Synchronous read of the current catalog (cached or empty).
 * Use this for rendering the picker immediately; call
 * {@link fetchOpenRouterModels} to populate/refresh it.
 */
export function getCachedOpenRouterModels(): OpenRouterModel[] {
  return cachedCatalog ?? []
}

/** Whether a live catalog has been loaded at least once. */
export function hasOpenRouterCatalog(): boolean {
  return cachedCatalog !== null
}

/**
 * Test-only: clear the in-memory catalog + in-flight request so tests start
 * from a known state. Not used in production.
 */
export function __resetOpenRouterModelsCacheForTest(): void {
  cachedCatalog = null
  cachedAt = 0
  inflight = null
}

// ============================================================================
// NVIDIA NIM — public /v1/models endpoint (no auth required for listing)
// ============================================================================

const NVIDIA_MODELS_URL = 'https://integrate.api.nvidia.com/v1/models'

type NvidiaModelsResponse = {
  data?: Array<{
    id?: string
  }>
}

let nvidiaCache: OpenRouterModel[] | null = null
let nvidiaCacheAt = 0
let nvidiaInflight: Promise<OpenRouterModel[]> | null = null

/**
 * Fetch available models from NVIDIA NIM's public /v1/models endpoint.
 * Returns a cached copy when fresh; degrades to empty list on failure.
 * Never throws.
 */
export async function fetchNvidiaModels(
  forceRefresh = false,
): Promise<OpenRouterModel[]> {
  const now = Date.now()
  const fresh = nvidiaCache !== null && !forceRefresh && now - nvidiaCacheAt < CATALOG_TTL_MS
  if (fresh && nvidiaCache) return nvidiaCache
  if (nvidiaInflight) return nvidiaInflight

  nvidiaInflight = (async () => {
    try {
      const resp = await fetch(NVIDIA_MODELS_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!resp.ok) throw new Error(`NVIDIA NIM models HTTP ${resp.status}`)
      const json = (await resp.json()) as NvidiaModelsResponse
      const models: OpenRouterModel[] = (json.data ?? [])
        .filter((m): m is { id: string } => !!m.id)
        .map((m) => ({
          id: `nvidia/${m.id}`,
          name: m.id,
          provider: 'nvidia' as const,
        }))
      models.sort((a, b) => a.id.localeCompare(b.id))
      nvidiaCache = models
      nvidiaCacheAt = Date.now()
      return models
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch NVIDIA NIM model catalog; using cache or empty list',
      )
      return nvidiaCache ?? []
    } finally {
      nvidiaInflight = null
    }
  })()

  return nvidiaInflight
}

// ============================================================================
// TokenRouter — requires auth for model list; use hardcoded catalog
// ============================================================================

const TOKENROUTER_CATALOG: OpenRouterModel[] = [
  { id: 'tokenrouter/kimi-k2p7-code', name: 'Kimi K2.7 Code', provider: 'tokenrouter' },
  { id: 'tokenrouter/kimi-k2p7-code-fast', name: 'Kimi K2.7 Code Fast', provider: 'tokenrouter' },
  { id: 'tokenrouter/kimi-k2p6', name: 'Kimi K2.6', provider: 'tokenrouter' },
  { id: 'tokenrouter/kimi-k2p5', name: 'Kimi K2.5', provider: 'tokenrouter' },
  { id: 'tokenrouter/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'tokenrouter' },
  { id: 'tokenrouter/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'tokenrouter' },
  { id: 'tokenrouter/qwen3p7-plus', name: 'Qwen 3.7 Plus', provider: 'tokenrouter' },
  { id: 'tokenrouter/qwen3p6-plus', name: 'Qwen 3.6 Plus', provider: 'tokenrouter' },
  { id: 'tokenrouter/glm-5p1', name: 'GLM 5.1', provider: 'tokenrouter' },
  { id: 'tokenrouter/glm-5p1-fast', name: 'GLM 5.1 Fast', provider: 'tokenrouter' },
  { id: 'tokenrouter/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'tokenrouter' },
  { id: 'tokenrouter/minimax-m3', name: 'MiniMax M3', provider: 'tokenrouter' },
  { id: 'tokenrouter/minimax-m2p7', name: 'MiniMax M2.7', provider: 'tokenrouter' },
]

/**
 * Return the TokenRouter model catalog.
 * TokenRouter requires auth for its /v1/models endpoint, so we use a
 * hardcoded list. This is always synchronous — returns instantly.
 */
export function fetchTokenRouterModels(): OpenRouterModel[] {
  return TOKENROUTER_CATALOG
}

// ============================================================================
// Combined gateway fetch — OpenRouter + TokenRouter + NVIDIA NIM
// ============================================================================

let gatewayCache: OpenRouterModel[] | null = null
let gatewayCacheAt = 0
let gatewayInflight: Promise<OpenRouterModel[]> | null = null

/**
 * Fetch the combined model catalog from all providers:
 * - OpenRouter (live API, public)
 * - NVIDIA NIM (live API, public)
 * - TokenRouter (hardcoded, requires auth for API)
 *
 * Fetches all three in parallel via Promise.allSettled(). If a source fails,
 * uses cached/empty list for that provider. Returns a combined, sorted list.
 * Caches per-process with the same TTL as OpenRouter.
 */
export async function fetchGatewayModels(
  forceRefresh = false,
): Promise<OpenRouterModel[]> {
  const now = Date.now()
  const fresh = gatewayCache !== null && !forceRefresh && now - gatewayCacheAt < CATALOG_TTL_MS
  if (fresh && gatewayCache) return gatewayCache
  if (gatewayInflight) return gatewayInflight

  gatewayInflight = (async () => {
    const [orResult, nvidiaResult] = await Promise.allSettled([
      fetchOpenRouterModels(forceRefresh),
      fetchNvidiaModels(forceRefresh),
    ])

    const orModels =
      orResult.status === 'fulfilled' ? orResult.value : cachedCatalog ?? []
    const nvidiaModels =
      nvidiaResult.status === 'fulfilled' ? nvidiaResult.value : nvidiaCache ?? []
    const tokenrouterModels = fetchTokenRouterModels()

    const combined = [...orModels, ...tokenrouterModels, ...nvidiaModels]
    combined.sort((a, b) => a.id.localeCompare(b.id))
    gatewayCache = combined
    gatewayCacheAt = Date.now()
    return combined
  })()

  return gatewayInflight
}
