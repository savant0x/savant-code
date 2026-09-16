/**
 * Model-id matching and context-window resolution across the OpenRouter and
 * gateway catalogs. The markdown model-info block lives in `model-info.ts`
 * (FID-2026-0913-002 split); this module re-exports it so every import path
 * stays stable.
 */
import {
  getContextWindowFallback,
  type ContextWindowSource,
} from '@savant-code/common/constants/context-windows'

import { getContextWindowForModel } from '../constants'
import { getCachedGatewayModels } from './gateway'
import { getCachedOpenRouterModels } from './openrouter'
import {
  PINNED_MAX_OUTPUT_TOKENS,
  type PinnedMaxOutputTokens,
} from './static-catalogs'

import type { OpenRouterModel } from './types'

export { formatModelInfo, getProviderFromModelId } from './model-info'

/**
 * Strip provider prefixes (tokenrouter/, tokenharbor/, nvidia/)
 * and variant suffixes (-free, -fast, :free) from a model ID to get the canonical
 * OpenRouter model ID for context-window lookup.
 *
 * Examples:
 *   "tokenrouter/z-ai/glm-5.2-free" → "z-ai/glm-5.2"
 *   "tokenrouter/openai/gpt-5.5-pro" → "openai/gpt-5.5-pro"
 *   "z-ai/glm-5.2" → "z-ai/glm-5.2"
 */
function toCanonicalModelId(modelId: string): string {
  let id = modelId
  // Strip gateway provider prefixes while preserving the upstream model path.
  id = id.replace(/^(?:tokenrouter|tokenharbor|nvidia)\//, '')
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
 * Field picker for {@link findModelFieldFromOpenRouter}: the model's context
 * length, preferring topProvider when present — the OpenRouter API often
 * omits the top-level context_length for resold models.
 */
const contextLengthOf = (
  m: OpenRouterModel | undefined,
): number | undefined => {
  if (!m) return undefined
  const tp = m.topProvider?.contextLength
  if (typeof tp === 'number') return tp
  if (typeof m.contextLength === 'number') return m.contextLength
  return undefined
}

/**
 * Field picker for {@link findModelFieldFromOpenRouter}: the model's max
 * completion tokens (the output budget), preferring topProvider when present.
 */
const maxCompletionOf = (
  m: OpenRouterModel | undefined,
): number | undefined => {
  if (!m) return undefined
  const tp = m.topProvider?.maxCompletionTokens
  if (typeof tp === 'number') return tp
  if (typeof m.maxCompletionTokens === 'number') return m.maxCompletionTokens
  return undefined
}

/**
 * Find a numeric model field by checking the live OpenRouter catalog.
 * Strips provider prefixes and variant suffixes to find the base model
 * (e.g. "tokenrouter/z-ai/glm-5.2-free" → "z-ai/glm-5.2").
 * TokenHarbor model IDs follow the same internal-prefix convention.
 *
 * FID-2026-0909-008 Step 4: the ladder (canonical → base → family →
 * name-family → name → fuzzy-name) was extracted from the former
 * `findContextLengthFromOpenRouter` so context-window and output-cap
 * resolution share one match truth (Law 13) — the ladder is identical,
 * only the field picker differs.
 *
 * Called by {@link resolveContextWindowForModel} and
 * {@link resolveMaxOutputTokensForModel}.
 */
function findModelFieldFromOpenRouter(
  modelId: string,
  field: (m: OpenRouterModel | undefined) => number | undefined,
): number | undefined {
  const openRouterCatalog = getCachedOpenRouterModels()
  if (openRouterCatalog.length === 0) return undefined

  const canonical = toCanonicalModelId(modelId)

  // 1. Exact canonical match (e.g. "z-ai/glm-5.2" → "z-ai/glm-5.2")
  const exact = openRouterCatalog.find((m) => m.id === canonical)
  if (field(exact) !== undefined) return field(exact)!

  // 2. Try without any provider prefix at all
  const withoutProvider = canonical.replace(/^[a-z0-9-]+\//, '')
  const byBase = openRouterCatalog.find((m) => m.id === withoutProvider)
  if (field(byBase) !== undefined) return field(byBase)!

  // 3. Family match: strip version suffix and match by prefix
  // Handles v-prefixed versions: "mimo-v2.5" → "mimo" → matches "xiaomi/mimo-v2.5"
  const familyId = canonical.replace(/-v?\d+(\.\d+)?$/, '')
  if (familyId && familyId !== canonical) {
    const family = openRouterCatalog.find((m) => m.id.startsWith(familyId))
    if (field(family) !== undefined) return field(family)!
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
    if (field(byFamilyName) !== undefined) return field(byFamilyName)!
  }

  // 4. Name-based fallback: when gateway model IDs (e.g.
  //    "tokenharbor/mimo-v2.5") don't map 1:1 to OpenRouter IDs
  //    (e.g. "xiaomi/mimo-v2.5"), match by the human-readable name
  //    which both catalogs share.
  const gatewayModel = findGatewayModel(modelId)
  if (gatewayModel?.name) {
    const nameLower = gatewayModel.name.toLowerCase()
    // First try exact name match.
    const byName = openRouterCatalog.find(
      (m) => m.name?.toLowerCase() === nameLower,
    )
    if (field(byName) !== undefined) return field(byName)!

    // Fuzzy: match when one name contains the other (handles suffixes
    // like "MiMo V2.5" vs "MiMo V2.5 Pro").
    const byFuzzyName = openRouterCatalog.find((m) => {
      const mName = m.name?.toLowerCase() ?? ''
      return mName.includes(nameLower) || nameLower.includes(mName)
    })
    if (field(byFuzzyName) !== undefined) return field(byFuzzyName)!
  }

  return undefined
}

/**
 * Resolve the best-known context window for a model id.
 * Priority:
 * 1. Live OpenRouter catalog (via canonical model ID lookup)
 * 2. Cached gateway catalog (TokenRouter/TokenHarbor/NVIDIA/OpenCode Go)
 * 3. Vendor-published fallback table (exact id → window, provenance-tagged)
 * 4. Conservative default (200k) — explicit, never a family guess
 *
 * FID-2026-0914-002: tier 3 was a name-substring heuristic that silently
 * under-windowed unmatched ids (e.g. a "glm" id missing the table → 200k
 * vs the real 1M). It is retired: the fallback table + default now close
 * the ladder with explicit provenance (see resolveContextWindowSourceForModel).
 */
export function resolveContextWindowForModel(modelId: string): number {
  // Check the live OpenRouter catalog first — it has the real context lengths
  // from the API, whereas hardcoded catalogs (TokenRouter, TokenHarbor,
  // OpenCode Go) use
  // inferred values that may be wrong (e.g. GLM 5.2 has 1M context, not 128k).
  const fromOpenRouter = findModelFieldFromOpenRouter(modelId, contextLengthOf)
  if (typeof fromOpenRouter === 'number') return fromOpenRouter

  // Fall back to the gateway catalog (may have inferred context lengths)
  const fromCatalog = findGatewayModel(modelId)
  if (typeof fromCatalog?.contextLength === 'number') {
    return fromCatalog.contextLength
  }

  return getContextWindowForModel(modelId)
}

/**
 * FID-2026-0914-002 (MQ4): provenance of the resolved window — 'catalog'
 * when the live/cached catalogs answered, else the final-fallback source
 * ('fallback-table' | 'default'). Surfaced in the sidebar so the operator
 * can see when a model is running on the conservative default.
 */
export function resolveContextWindowSourceForModel(
  modelId: string,
): 'catalog' | ContextWindowSource {
  const fromOpenRouter = findModelFieldFromOpenRouter(modelId, contextLengthOf)
  if (typeof fromOpenRouter === 'number') return 'catalog'
  const fromCatalog = findGatewayModel(modelId)
  if (typeof fromCatalog?.contextLength === 'number') return 'catalog'
  return getContextWindowFallback(modelId).source
}

/**
 * Resolve the model's documented output budget (max completion tokens).
 * Priority:
 * 1. Authoritative pin (`PINNED_MAX_OUTPUT_TOKENS`, injectable for tests) —
 *    overrides the live catalogs where the API reports an incorrect value
 *    (historically GLM 5.3 Free reported 943717 but capped at 131072;
 *    trusting the API value hard-rejected every request)
 * 2. Live OpenRouter catalog — top-level `max_completion_tokens` with the
 *    `top_provider.max_completion_tokens` override, as reported by the API
 * 3. Cached gateway catalog (same field, normalized by every live adapter)
 * 4. undefined — NEVER an invented value
 *
 * FID-2026-0909-008 Step 4: the resolved budget is threaded CLI → SDK →
 * agent loop → stream call site so chat-completions requests carry an
 * explicit, model-appropriate `max_tokens` instead of an unset field that
 * lets provider defaults truncate large native tool calls mid-JSON.
 * When no catalog reports a cap, `undefined` omits `max_tokens` from the
 * request (the provider default governs) and the Steps 1–3
 * `finishReason: 'length'` detection + split-payload steering remain the
 * recovery net — an invented number (a fraction of the input window or a
 * fixed constant) can exceed a provider's true cap and turn recoverable
 * truncation into hard request rejection.
 */
export function resolveMaxOutputTokensForModel(
  modelId: string,
  pinnedMaxOutput: PinnedMaxOutputTokens = PINNED_MAX_OUTPUT_TOKENS,
): number | undefined {
  // Authoritative pins first — a wrong API-reported value must never win
  // over a verified provider cap. `typeof` guards inherited Object.prototype
  // members for arbitrary model-id inputs ("toString" etc.).
  const pinned = pinnedMaxOutput[modelId]
  if (typeof pinned === 'number') return pinned

  const fromOpenRouter = findModelFieldFromOpenRouter(modelId, maxCompletionOf)
  if (typeof fromOpenRouter === 'number') return fromOpenRouter

  const fromCatalog = findGatewayModel(modelId)
  if (typeof fromCatalog?.maxCompletionTokens === 'number') {
    return fromCatalog.maxCompletionTokens
  }

  return undefined
}
