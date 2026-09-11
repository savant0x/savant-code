import type { ProviderId } from '@savant-code/common/providers/registry'

/** How long a fetched catalog is considered fresh before a refresh. */
export const CATALOG_TTL_MS = 5 * 60 * 1000

/**
 * Derived from the unified provider registry (FID-2026-0910-004 Phase 1).
 * Phase-1 delta (b): the union gains `cloudflare` (routed in the SDK since
 * FID-2026-0806-009 but missing here — now derived, so it cannot drift).
 * FID-2026-0910-004 Step 9 (D8 widening): custom provider ids are legal as
 * plain strings — built-ins keep literal autocomplete, runtime truth stays
 * the effective-registry id set, so no cast is needed at the settings seams.
 */
export type ModelProvider = ProviderId | (string & {})

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

export type OpenRouterModelsResponse = {
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

export type NvidiaModelsResponse = {
  data?: Array<{
    id?: string
  }>
}
