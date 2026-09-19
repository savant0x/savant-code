/**
 * Context-window resolution constants.
 *
 * FID-2026-0914-002: the family substring heuristics are deprecated as
 * FINAL fallbacks. A substring guess silently under-windows modern models
 * (a "glm" id the table cannot match → 200k default vs the real 1M; every
 * new gateway free-model id → the 200k default with no provenance) — the
 * operator's bar is "not artificially restricted on any model", so the
 * offline fallback is now a vendor-published exact-id table with explicit
 * provenance, and unknown ids get the conservative default FLAGGED as
 * 'default' instead of a false family guess.
 *
 * FID-2026-0916-002: the last four family-heuristic consumers
 * (tokenrouter/tokenharbor/opencode-go/commandcode static catalogs) now
 * resolve through `getContextWindowFallback` like every other catalog, and
 * the fallback table carries exact-id vendor rows for all of them. The
 * closed-world invariant is pinned in
 * cli/src/utils/openrouter-models/__tests__/window-truth.test.ts.
 * `inferContextLength` itself remains only for legacy callers of the
 * name-derived catalogs and is deprecated for new use.
 *
 * FID-2026-0919-019: the table itself moved verbatim to
 * `context-window-table.ts` (300-line quality ceiling; re-exported here so
 * every import path stays stable).
 */

import { CONTEXT_WINDOW_FALLBACKS } from './context-window-table'
import {
  atriaModels,
  bazaarlinkModels,
  commandcodeModels,
  hcnsecModels,
  infronModels,
  tokenbomModels,
  tokenharborModels,
  tokenrouterModels,
  unorouterModels,
} from './model-config'

/** Conservative default for models with no published window available. */
export const CONTEXT_WINDOW_DEFAULT = 200_000

export { CONTEXT_WINDOW_FALLBACKS } from './context-window-table'

/** How a context window was resolved — surfaced in the UI (MQ4 badge). */
export type ContextWindowSource = 'fallback-table' | 'default'

export type ContextWindowResolution = {
  contextWindow: number
  source: ContextWindowSource
}

/**
 * Resolve a model id's offline fallback window with explicit provenance:
 * a vendor-published table hit ('fallback-table') or the conservative
 * default ('default'). Never a family guess.
 */
export function getContextWindowFallback(
  modelId: string,
): ContextWindowResolution {
  const window = CONTEXT_WINDOW_FALLBACKS.get(modelId)
  if (typeof window === 'number') {
    return { contextWindow: window, source: 'fallback-table' }
  }
  return { contextWindow: CONTEXT_WINDOW_DEFAULT, source: 'default' }
}

/** Union of every name-derived catalog id (windows stay family-estimated). */
const NAME_CATALOG_MODEL_IDS: readonly string[] = [
  ...Object.values(tokenrouterModels),
  ...Object.values(tokenharborModels),
  ...Object.values(commandcodeModels),
  ...Object.values(hcnsecModels),
  ...Object.values(tokenbomModels),
  ...Object.values(infronModels),
  ...Object.values(unorouterModels),
  ...Object.values(bazaarlinkModels),
  ...Object.values(atriaModels),
]

/**
 * Infer a reasonable context-window from a model NAME when the gateway does
 * not return one (e.g. hardcoded TokenRouter / OpenCode Go catalogs).
 * DEPRECATED as a final fallback (FID-2026-0914-002): the runtime ladder
 * (lookup.ts resolveContextWindowForModel) ends in getContextWindowFallback
 * above, never here. Name-catalog entries keep this for their documented
 * conservative estimates; the live catalogs correct them at runtime.
 */
export function inferContextLength(name: string): number {
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
  // MiMo V2.5: Xiaomi reasoning models, 1M context
  if (lower.includes('mimo')) return 1_000_000
  // MiniMax M3: 256k context
  if (lower.includes('minimax')) return 256_000
  // Nemotron: NVIDIA models, 128k context
  if (lower.includes('nemotron')) return 128_000
  // MiroThinker: 128k context
  if (lower.includes('mirothinker')) return 128_000
  // Seedream: Image generation model, 128k context
  if (lower.includes('seedream')) return 128_000
  return CONTEXT_WINDOW_DEFAULT
}

/** True when the id belongs to a name-derived catalog (estimate-backed). */
export function isNameCatalogModelId(modelId: string): boolean {
  return NAME_CATALOG_MODEL_IDS.includes(modelId)
}
