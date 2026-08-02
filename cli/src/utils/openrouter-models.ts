import { commandcodeModels } from '@savant-code/common/constants/model-config'

import { getContextWindowForModel } from './constants'
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

export type ModelProvider =
  | 'openrouter'
  | 'tokenrouter'
  | 'nvidia'
  | 'opencode-go'
  | 'ollama'
  | 'commandcode'

export type OpenRouterModel = {
  /** Canonical model id, e.g. "anthropic/claude-sonnet-4". */
  id: string
  /** Human-readable name. */
  name: string
  /** Description of the model, if reported by the API. */
  description?: string
  /** Context window in tokens, if reported by the API. */
  contextLength?: number
  /** Max completion tokens, if reported by the API. */
  maxCompletionTokens?: number
  /** Prompt price per token, if reported. */
  promptPricePerToken?: number
  /** Completion price per token, if reported. */
  completionPricePerToken?: number
  /** Input cache read price per token, if reported. */
  inputCacheReadPricePerToken?: number
  /** Web search price per token, if reported. */
  webSearchPricePerToken?: number
  /** Which provider this model belongs to. */
  provider?: ModelProvider
  /** Modality string (e.g. "text+image"), if reported. */
  modality?: string
  /** Tokenizer identifier, if reported. */
  tokenizer?: string
  /** Instruct type, if reported. */
  instructType?: string
  /** Knowledge cutoff date, if reported. */
  knowledgeCutoff?: string
  /** Creation date (ISO string), if reported. */
  created?: string
  /** Reasoning configuration, if reported. */
  reasoning?: {
    mandatory?: boolean
    default_enabled?: boolean
  }
  /** Top-provider overrides (context length, max completion tokens, moderation). */
  topProvider?: {
    contextLength?: number
    maxCompletionTokens?: number
    isModerated?: boolean
  }
  /** Benchmark data, if reported. */
  benchmarks?: unknown
  /** Links to details/docs, if reported. */
  links?: {
    details?: string
  }
}

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: string
    name?: string
    description?: string
    context_length?: number
    max_completion_tokens?: number
    pricing?: {
      prompt?: string
      completion?: string
      input_cache_read?: string
      web_search?: string
    }
    provider?: string
    modality?: string
    tokenizer?: string
    instruct_type?: string
    knowledge_cutoff?: string
    created?: string
    reasoning?: {
      mandatory?: boolean
      default_enabled?: boolean
    }
    top_provider?: {
      context_length?: number
      max_completion_tokens?: number
      is_moderated?: boolean
    }
    benchmarks?: unknown
    links?: {
      details?: string
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
    const inputCacheRead = m.pricing?.input_cache_read
    const webSearch = m.pricing?.web_search
    parsed.push({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description,
      contextLength: m.context_length,
      maxCompletionTokens: m.max_completion_tokens,
      promptPricePerToken: prompt !== undefined ? Number(prompt) : undefined,
      completionPricePerToken:
        completion !== undefined ? Number(completion) : undefined,
      inputCacheReadPricePerToken:
        inputCacheRead !== undefined ? Number(inputCacheRead) : undefined,
      webSearchPricePerToken:
        webSearch !== undefined ? Number(webSearch) : undefined,
      provider: undefined,
      modality: m.modality,
      tokenizer: m.tokenizer,
      instructType: m.instruct_type,
      knowledgeCutoff: m.knowledge_cutoff,
      created: m.created,
      reasoning: m.reasoning,
      topProvider: m.top_provider
        ? {
            contextLength: m.top_provider.context_length,
            maxCompletionTokens: m.top_provider.max_completion_tokens,
            isModerated: m.top_provider.is_moderated,
          }
        : undefined,
      benchmarks: m.benchmarks,
      links: m.links,
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
  const fresh =
    cachedCatalog !== null && !forceRefresh && now - cachedAt < CATALOG_TTL_MS

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

/**
 * Synchronous read of the combined gateway catalog (cached or empty).
 * Includes OpenRouter, TokenRouter, NVIDIA NIM, and OpenCode Go models.
 */
export function getCachedGatewayModels(): OpenRouterModel[] {
  return gatewayCache ?? []
}

/** Whether a live catalog has been loaded at least once. */
export function hasOpenRouterCatalog(): boolean {
  return cachedCatalog !== null
}

/** Infer a display provider from a model id like "openai/gpt-5". */
export function getProviderFromModelId(modelId: string): string {
  const [provider] = modelId.split('/')
  return provider ?? modelId
}

/**
 * Format a markdown block describing a model for injection into the agent
 * system prompt. Unknown fields are omitted. When no metadata is available,
 * a minimal fallback using the model id is produced.
 */
export function formatModelInfo(
  modelId: string,
  model?: OpenRouterModel,
): string {
  if (!model) {
    return `# Model Information

You are running on **${modelId}**.

Full metadata unavailable; the model was not found in the cached OpenRouter catalog.`
  }

  const lines: string[] = []
  lines.push(`# Model Information`)
  lines.push(``)
  lines.push(`You are running on **${model.name}** (\`${model.id}\`).`)
  lines.push(``)
  const provider = model.provider ?? getProviderFromModelId(modelId)
  if (provider) {
    lines.push(`- **Provider:** ${provider}`)
  }
  if (model.description) {
    lines.push(`- **Description:** ${model.description}`)
  }
  if (typeof model.contextLength === 'number') {
    lines.push(
      `- **Context window:** ${model.contextLength.toLocaleString()} tokens`,
    )
  }
  if (typeof model.maxCompletionTokens === 'number') {
    lines.push(
      `- **Max completion tokens:** ${model.maxCompletionTokens.toLocaleString()}`,
    )
  }
  if (typeof model.promptPricePerToken === 'number') {
    lines.push(
      `- **Input price:** $${(model.promptPricePerToken * 1_000_000).toFixed(2)} per 1M tokens`,
    )
  }
  if (typeof model.completionPricePerToken === 'number') {
    lines.push(
      `- **Output price:** $${(model.completionPricePerToken * 1_000_000).toFixed(2)} per 1M tokens`,
    )
  }
  if (model.modality) {
    lines.push(`- **Modalities:** ${model.modality}`)
  }
  if (model.knowledgeCutoff) {
    lines.push(`- **Knowledge cutoff:** ${model.knowledgeCutoff}`)
  }
  if (model.tokenizer) {
    lines.push(`- **Tokenizer:** ${model.tokenizer}`)
  }
  if (model.instructType) {
    lines.push(`- **Instruct type:** ${model.instructType}`)
  }
  if (model.created) {
    lines.push(`- **Created:** ${model.created}`)
  }

  return lines.join('\n')
}

/**
 * Strip provider prefixes (tokenrouter/, nvidia/, opencode-go/) and variant
 * suffixes (-free, -fast, :free) from a model ID to get the canonical
 * OpenRouter model ID for context-window lookup.
 *
 * Examples:
 *   "tokenrouter/z-ai/glm-5.2-free" → "z-ai/glm-5.2"
 *   "tokenrouter/openai/gpt-5.5-pro" → "openai/gpt-5.5-pro"
 *   "z-ai/glm-5.2" → "z-ai/glm-5.2"
 */
function toCanonicalModelId(modelId: string): string {
  let id = modelId
  // Strip gateway provider prefixes: tokenrouter/, nvidia/, opencode-go/
  id = id.replace(/^(?:tokenrouter|nvidia|opencode-go)\//, '')
  // Strip variant suffixes: -free, -fast, :free, :beta
  id = id.replace(/-(?:free|fast|beta)$/, '')
  id = id.replace(/:(?:free|beta)$/, '')
  return id
}

/**
 * Look up a model in the cached gateway catalog by id, falling back to a
 * provider-prefixed match and then a base-family match.
 *
 * When the initial match comes from a hardcoded catalog (TokenRouter, OpenCode
 * Go) that has an *inferred* context length (not from the API), this function
 * also checks the live OpenRouter catalog for the canonical model ID to find
 * the real context length.
 */
export function findGatewayModel(modelId: string): OpenRouterModel | undefined {
  const catalog = getCachedGatewayModels()

  // Exact match
  const exact = catalog.find((m) => m.id === modelId)
  if (exact) return exact

  // Provider prefix variants (e.g. "openai/gpt-5" vs "gpt-5")
  const withoutProvider = catalog.find(
    (m) => m.id === modelId.replace(/^[a-z0-9-]+\//, ''),
  )
  if (withoutProvider) return withoutProvider

  // Base family match (e.g. "anthropic/claude-sonnet-4" vs "anthropic/claude-sonnet-4.8")
  // Also handles v-prefixed versions: "mimo-v2.5" → "mimo"
  const familyId = modelId.replace(/-v?\d+(\.\d+)?$/, '')
  if (familyId && familyId !== modelId) {
    const family = catalog.find((m) => m.id.startsWith(familyId))
    if (family) return family
  }

  return undefined
}

/**
 * Find the real context length for a model by checking the live OpenRouter
 * catalog. Strips provider prefixes and variant suffixes to find the base
 * model (e.g. "tokenrouter/z-ai/glm-5.2-free" → "z-ai/glm-5.2").
 *
 * This is called by {@link resolveContextWindowForModel} when the gateway
 * catalog match has no contextLength or only an inferred one.
 */
function findContextLengthFromOpenRouter(modelId: string): number | undefined {
  const openRouterCatalog = getCachedOpenRouterModels()
  if (openRouterCatalog.length === 0) return undefined

  const canonical = toCanonicalModelId(modelId)

  // Helper: extract contextLength preferring topProvider if available.
  const ctx = (m: OpenRouterModel | undefined): number | undefined => {
    if (!m) return undefined
    // Prefer topProvider.contextLength when present — the OpenRouter API
    // often omits the top-level context_length for resold models.
    const tp = m.topProvider?.contextLength
    if (typeof tp === 'number') return tp
    if (typeof m.contextLength === 'number') return m.contextLength
    return undefined
  }

  // 1. Exact canonical match (e.g. "z-ai/glm-5.2" → "z-ai/glm-5.2")
  const exact = openRouterCatalog.find((m) => m.id === canonical)
  if (ctx(exact) !== undefined) return ctx(exact)!

  // 2. Try without any provider prefix at all
  const withoutProvider = canonical.replace(/^[a-z0-9-]+\//, '')
  const byBase = openRouterCatalog.find((m) => m.id === withoutProvider)
  if (ctx(byBase) !== undefined) return ctx(byBase)!

  // 3. Family match: strip version suffix and match by prefix
  // Handles v-prefixed versions: "mimo-v2.5" → "mimo" → matches "xiaomi/mimo-v2.5"
  const familyId = canonical.replace(/-v?\d+(\.\d+)?$/, '')
  if (familyId && familyId !== canonical) {
    const family = openRouterCatalog.find((m) => m.id.startsWith(familyId))
    if (ctx(family) !== undefined) return ctx(family)!
  }

  // 3b. Name-family match: when the ID-based family match misses (e.g.
  //     canonical "mimo-v2.5" → family "mimo" but OpenRouter has
  //     "xiaomi/mimo-v2.5" which doesn't start with "mimo"), fall back
  //     to matching by normalized model name.
  const familyName = familyId.split('/').pop() ?? familyId
  if (familyName && familyName !== canonical) {
    const byFamilyName = openRouterCatalog.find((m) => {
      const mFamily =
        m.id
          .split('/')
          .pop()
          ?.replace(/-v?\d+(\.\d+)?$/, '') ?? ''
      return mFamily === familyName
    })
    if (ctx(byFamilyName) !== undefined) return ctx(byFamilyName)!
  }

  // 4. Name-based fallback: when gateway model IDs (e.g.
  //    "opencode-go/mimo-v2.5") don't map 1:1 to OpenRouter IDs
  //    (e.g. "xiaomi/mimo-v2.5"), match by the human-readable name
  //    which both catalogs share.
  const gatewayModel = findGatewayModel(modelId)
  if (gatewayModel?.name) {
    const nameLower = gatewayModel.name.toLowerCase()
    // First try exact name match.
    const byName = openRouterCatalog.find(
      (m) => m.name?.toLowerCase() === nameLower,
    )
    if (ctx(byName) !== undefined) return ctx(byName)!

    // Fuzzy: match when one name contains the other (handles suffixes
    // like "MiMo V2.5" vs "MiMo V2.5 Pro").
    const byFuzzyName = openRouterCatalog.find((m) => {
      const mName = m.name?.toLowerCase() ?? ''
      return mName.includes(nameLower) || nameLower.includes(mName)
    })
    if (ctx(byFuzzyName) !== undefined) return ctx(byFuzzyName)!
  }

  return undefined
}

/**
 * Resolve the best-known context window for a model id.
 * Priority:
 * 1. Live OpenRouter catalog (via canonical model ID lookup)
 * 2. Cached gateway catalog (TokenRouter/NVIDIA/OpenCode Go)
 * 3. Name-based heuristic fallback
 * 4. 200k default
 */
export function resolveContextWindowForModel(modelId: string): number {
  // Check the live OpenRouter catalog first — it has the real context lengths
  // from the API, whereas hardcoded catalogs (TokenRouter, OpenCode Go) use
  // inferred values that may be wrong (e.g. GLM 5.2 has 1M context, not 128k).
  const fromOpenRouter = findContextLengthFromOpenRouter(modelId)
  if (typeof fromOpenRouter === 'number') return fromOpenRouter

  // Fall back to the gateway catalog (may have inferred context lengths)
  const fromCatalog = findGatewayModel(modelId)
  if (typeof fromCatalog?.contextLength === 'number') {
    return fromCatalog.contextLength
  }

  return getContextWindowForModel(modelId)
}

/**
 * Test-only: clear the in-memory catalog + in-flight request so tests start
 * from a known state. Not used in production.
 */
export function __resetOpenRouterModelsCacheForTest(): void {
  cachedCatalog = null
  cachedAt = 0
  inflight = null
  gatewayCache = null
  gatewayCacheAt = 0
  gatewayInflight = null
  // Note: intentionally do not clear gatewayCatalogListeners here. This reset
  // is for cache state; listeners (including the gateway-catalog store) should
  // survive test resets so subscriptions remain intact.
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
  const fresh =
    nvidiaCache !== null &&
    !forceRefresh &&
    now - nvidiaCacheAt < CATALOG_TTL_MS
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
  // Tier 1 — Elite Flagships
  {
    id: 'tokenrouter/anthropic/claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/openai/gpt-5.6-sol',
    name: 'GPT 5.6 Sol',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/qwen/qwen3.7-max',
    name: 'Qwen 3.7 Max',
    provider: 'tokenrouter',
  },
  { id: 'tokenrouter/z-ai/glm-5.2', name: 'GLM 5.2', provider: 'tokenrouter' },
  {
    id: 'tokenrouter/openai/gpt-5.5-pro',
    name: 'GPT 5.5 Pro',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/anthropic/claude-opus-4.8',
    name: 'Claude Opus 4.8',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/x-ai/grok-4.5',
    name: 'Grok 4.5',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/moonshotai/kimi-k3',
    name: 'Kimi K3',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/bytedance-seed/seedream-5.0-pro',
    name: 'Seedream 5.0 Pro',
    provider: 'tokenrouter',
  },
  { id: 'tokenrouter/MiniMax-M3', name: 'MiniMax M3', provider: 'tokenrouter' },
  // Tier 2 — Frontier Performers
  {
    id: 'tokenrouter/anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/openai/gpt-5.6-terra',
    name: 'GPT 5.6 Terra',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/qwen/qwen3.7-plus',
    name: 'Qwen 3.7 Plus',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/anthropic/claude-opus-4.8-fast',
    name: 'Claude Opus 4.8 Fast',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/anthropic/claude-opus-4.7',
    name: 'Claude Opus 4.7',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/anthropic/claude-opus-4.7-fast',
    name: 'Claude Opus 4.7 Fast',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/openai/gpt-5.5',
    name: 'GPT 5.5',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/z-ai/glm-5.2-free',
    name: 'GLM 5.2 Free',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/qwen/qwen3.6-plus',
    name: 'Qwen 3.6 Plus',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/moonshotai/kimi-k2.7-code',
    name: 'Kimi K2.7 Code',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/xiaomi/mimo-v2.5-pro',
    name: 'MiMo V2.5 Pro',
    provider: 'tokenrouter',
  },
  { id: 'tokenrouter/z-ai/glm-5.1', name: 'GLM 5.1', provider: 'tokenrouter' },
  {
    id: 'tokenrouter/openai/gpt-5.4',
    name: 'GPT 5.4',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/x-ai/grok-4.3',
    name: 'Grok 4.3',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/openai/gpt-5.3-codex',
    name: 'GPT 5.3 Codex',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/miromind/mirothinker-1-7-deepresearch',
    name: 'MiroThinker 1.7 DeepResearch',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/qwen/qwen3.5-397b-a17b',
    name: 'Qwen 3.5 397B',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/qwen/qwen3.5-122b-a10b',
    name: 'Qwen 3.5 122B',
    provider: 'tokenrouter',
  },
  {
    id: 'tokenrouter/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'tokenrouter',
  },
]

/**
 * Return the TokenRouter model catalog.
 * TokenRouter requires auth for its /v1/models endpoint, so we use a
 * hardcoded list. This is always synchronous — returns instantly.
 */
export function fetchTokenRouterModels(): OpenRouterModel[] {
  return TOKENROUTER_CATALOG.map((m) => ({
    ...m,
    contextLength: m.contextLength ?? inferContextLength(m.name),
  }))
}

// ============================================================================
// OpenCode Go — subscription-gated; use hardcoded catalog (like TokenRouter)
// ============================================================================

const OPENCODE_GO_CATALOG: OpenRouterModel[] = [
  // OpenAI-compatible models
  { id: 'opencode-go/grok-4.5', name: 'Grok 4.5', provider: 'opencode-go' },
  { id: 'opencode-go/glm-5.2', name: 'GLM 5.2', provider: 'opencode-go' },
  { id: 'opencode-go/glm-5.1', name: 'GLM 5.1', provider: 'opencode-go' },
  { id: 'opencode-go/kimi-k3', name: 'Kimi K3', provider: 'opencode-go' },
  {
    id: 'opencode-go/kimi-k2.7-code',
    name: 'Kimi K2.7 Code',
    provider: 'opencode-go',
  },
  { id: 'opencode-go/kimi-k2.6', name: 'Kimi K2.6', provider: 'opencode-go' },
  { id: 'opencode-go/mimo-v2.5', name: 'MiMo V2.5', provider: 'opencode-go' },
  {
    id: 'opencode-go/mimo-v2.5-pro',
    name: 'MiMo V2.5 Pro',
    provider: 'opencode-go',
  },
  {
    id: 'opencode-go/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'opencode-go',
  },
  {
    id: 'opencode-go/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'opencode-go',
  },
  // Anthropic-compatible models
  { id: 'opencode-go/minimax-m3', name: 'MiniMax M3', provider: 'opencode-go' },
  {
    id: 'opencode-go/minimax-m2.7',
    name: 'MiniMax M2.7',
    provider: 'opencode-go',
  },
  {
    id: 'opencode-go/qwen3.7-max',
    name: 'Qwen 3.7 Max',
    provider: 'opencode-go',
  },
  {
    id: 'opencode-go/qwen3.7-plus',
    name: 'Qwen 3.7 Plus',
    provider: 'opencode-go',
  },
  {
    id: 'opencode-go/qwen3.6-plus',
    name: 'Qwen 3.6 Plus',
    provider: 'opencode-go',
  },
]

/**
 * Return the OpenCode Go model catalog.
 * OpenCode Go requires auth for its API, so we use a hardcoded list.
 * This is always synchronous — returns instantly.
 */
export function fetchOpenCodeGoModels(): OpenRouterModel[] {
  return OPENCODE_GO_CATALOG.map((m) => ({
    ...m,
    contextLength: m.contextLength ?? inferContextLength(m.name),
  }))
}

// ============================================================================
// CommandCode — dual-protocol provider; use the shared model catalog
// ============================================================================

/**
 * Return the CommandCode model catalog.
 * The IDs are maintained in common model configuration so routing and picker
 * entries cannot silently drift apart. Context lengths are conservative
 * family estimates until CommandCode exposes authoritative metadata.
 */
export function fetchCommandCodeModels(): OpenRouterModel[] {
  return Object.values(commandcodeModels)
    .map((id) => ({
      id,
      name: id.slice('commandcode/'.length),
      provider: 'commandcode' as const,
      contextLength: inferContextLength(id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ============================================================================
// Combined gateway fetch — OpenRouter + TokenRouter + NVIDIA NIM + OpenCode Go + CommandCode
// ============================================================================

/**
 * Infer a reasonable context-window from a model name when the gateway does not
 * return one (e.g. hardcoded TokenRouter / OpenCode Go catalogs).
 */
function inferContextLength(name: string): number {
  const lower = name.toLowerCase()
  // FID-2026-0725-085 CTX-010: Corrected model family context windows.
  // These are conservative estimates based on known model capabilities.
  // The live OpenRouter catalog (resolveContextWindowForModel) takes priority;
  // these only apply to hardcoded TokenRouter/OpenCode Go catalogs.
  if (lower.includes('gemini')) return 1_048_576
  if (lower.includes('claude')) return 200_000
  if (lower.includes('kimi')) return 256_000
  if (lower.includes('deepseek')) return 131_072
  // Grok-4.x: xAI models have 1M+ context windows
  if (lower.includes('grok')) return 1_000_000
  // GPT-5.x: OpenAI flagship models have 256k+ context
  if (lower.includes('gpt')) return 256_000
  // Qwen-3.x: 128k-256k depending on variant; use 128k as floor
  if (lower.includes('qwen')) return 128_000
  // GLM-5.x: Zhipu AI models have 1M context
  if (lower.includes('glm')) return 1_000_000
  // MiMo V2.5: Xiaomi reasoning models, 128k context
  if (lower.includes('mimo')) return 128_000
  // MiniMax M3: 256k context
  if (lower.includes('minimax')) return 256_000
  // Nemotron: NVIDIA models, 128k context
  if (lower.includes('nemotron')) return 128_000
  // MiroThinker: 128k context
  if (lower.includes('mirothinker')) return 128_000
  // Seedream: Image generation model, 128k context
  if (lower.includes('seedream')) return 128_000
  return 200_000
}

let gatewayCache: OpenRouterModel[] | null = null
let gatewayCacheAt = 0
let gatewayInflight: Promise<OpenRouterModel[]> | null = null
const gatewayCatalogListeners = new Set<(catalog: OpenRouterModel[]) => void>()

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
 * - OpenCode Go (hardcoded, subscription-gated)
 * - CommandCode (hardcoded, provider catalog)
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

  gatewayInflight = (async () => {
    const [orResult, nvidiaResult] = await Promise.allSettled([
      fetchOpenRouterModels(forceRefresh),
      fetchNvidiaModels(forceRefresh),
    ])

    const orModels =
      orResult.status === 'fulfilled' ? orResult.value : (cachedCatalog ?? [])
    const nvidiaModels =
      nvidiaResult.status === 'fulfilled'
        ? nvidiaResult.value
        : (nvidiaCache ?? [])
    const tokenrouterModels = fetchTokenRouterModels()
    const openCodeGoModels = fetchOpenCodeGoModels()
    const commandCodeModels = fetchCommandCodeModels()

    const combined = [
      ...orModels,
      ...tokenrouterModels,
      ...nvidiaModels,
      ...openCodeGoModels,
      ...commandCodeModels,
    ]
    combined.sort((a, b) => a.id.localeCompare(b.id))
    gatewayCache = combined
    gatewayCacheAt = Date.now()
    notifyGatewayCatalogListeners(combined)
    return combined
  })()

  return gatewayInflight
}
