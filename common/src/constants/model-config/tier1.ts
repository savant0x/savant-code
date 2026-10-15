import { TIER1_ROWS_A } from './tier1-rows-a'
import { TIER1_ROWS_B } from './tier1-rows-b'
import { TIER1_ROWS_C } from './tier1-rows-c'

import type { Tier1ModelRow } from './tier1-row-type'

/**
 * First-party catalog evidence fetched from models.dev on 2026-10-14 and
 * curated to coding-harness-compatible chat/text rows. Rows carry the vendor
 * id, display label, and published context limit so the static picker and
 * fallback-window table share one durable source.
 */
export const TIER1_MODEL_ROWS: readonly Tier1ModelRow[] = [
  ...TIER1_ROWS_A,
  ...TIER1_ROWS_B,
  ...TIER1_ROWS_C,
]

function providerId(modelId: string): string {
  const separator = modelId.indexOf('/')
  if (separator <= 0) {
    throw new Error(`Tier 1 model id lacks a provider prefix: ${modelId}`)
  }
  return modelId.slice(0, separator)
}

function buildCatalog(provider: string): Record<string, string> {
  const catalog: Record<string, string> = {}
  for (const [id] of TIER1_MODEL_ROWS) {
    if (providerId(id) === provider) catalog[id] = id
  }
  return catalog
}

export const anthropicModels = buildCatalog('anthropic')
export const googleModels = buildCatalog('google')
export const xaiModels = buildCatalog('xai')
export const deepseekTier1Models = buildCatalog('deepseek')
export const groqModels = buildCatalog('groq')
export const cohereModels = buildCatalog('cohere')
export const togetheraiModels = buildCatalog('togetherai')
export const cerebrasModels = buildCatalog('cerebras')
export const perplexityModels = buildCatalog('perplexity')
export const alibabaModels = buildCatalog('alibaba')
export const moonshotaiModels = buildCatalog('moonshotai')
export const zaiModels = buildCatalog('zai')
export const tier1MinimaxModels = buildCatalog('minimax')
export const metaModels = buildCatalog('meta')
export const fireworksAiModels = buildCatalog('fireworks-ai')
export const basetenModels = buildCatalog('baseten')

/** Static catalog ids that have checked-in picker maps. */
export const TIER1_STATIC_PROVIDER_IDS = [
  'anthropic',
  'google',
  'xai',
  'deepseek',
  'groq',
  'cohere',
  'togetherai',
  'cerebras',
  'perplexity',
  'alibaba',
  'moonshotai',
  'zai',
  'minimax',
  'meta',
  'fireworks-ai',
  'baseten',
] as const

export const TIER1_MODEL_NAMES: Readonly<Record<string, string>> =
  Object.fromEntries(TIER1_MODEL_ROWS.map(([id, name]) => [id, name]))

/** Positive published context limits used by the offline fallback resolver. */
export const TIER1_CONTEXT_WINDOWS: ReadonlyMap<string, number> = new Map(
  TIER1_MODEL_ROWS.filter(([, , contextLength]) => contextLength > 0).map(
    ([id, , contextLength]) => [id, contextLength],
  ),
)
