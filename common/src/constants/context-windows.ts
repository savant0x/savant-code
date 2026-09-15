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
 * `inferContextLength` remains for the NAME-derived catalogs whose id sets
 * come from common model maps (tokenrouter/tokenharbor/opencode-go/
 * commandcode) and whose windows are documented conservative estimates
 * corrected by the live catalogs at runtime (lookup.ts ladder).
 */

import {
  commandcodeModels,
  hcnsecModels,
  infronModels,
  opencodeGoModels,
  tokenbomModels,
  tokenharborModels,
  tokenrouterModels,
  unorouterModels,
} from './model-config'

/** Conservative default for models with no published window available. */
export const CONTEXT_WINDOW_DEFAULT = 200_000

/**
 * Vendor-published context windows for the audited/curated gateway catalog
 * ids (exact model-id → window). Sources, per catalog:
 * - hcnsec: OpenRouter catalog 2026-09-13 (FID-2026-0913-001);
 *   Qwen3.8-Flash-Next is a nearest-family inference (NEEDS-REVIEW).
 * - tokenbom: OpenRouter catalog 2026-09-13; doubao-seed-2.1-pro has no
 *   OpenRouter listing — conservative default, flagged NEEDS-REVIEW.
 * - infron: vendor console metadata.contextWindow (FID-2026-0914-001).
 * - unorouter: vendor console metadata.contextWindow (api.unorouter.com,
 *   2026-09-14; qwen3.8-27b:free pins the metadata value over the
 *   conflicting 262.1K tag — flagged in the FID).
 */
export const CONTEXT_WINDOW_FALLBACKS: ReadonlyMap<string, number> = new Map([
  // --- hcnsec (FID-2026-0913-001) ---
  ['hcnsec/glm-5.3-flash', 1_310_720],
  ['hcnsec/DeepSeek-V4-Flash', 1_310_720],
  ['hcnsec/deepseek-v4-flash-vision-exp', 1_048_576],
  ['hcnsec/Qwen3.6-35B-A3B', 262_144],
  ['hcnsec/Qwen3.8-Flash-Next', 1_000_000],
  ['hcnsec/step-3.7-flash', 262_144],
  ['hcnsec/kimi-k3', 1_048_576],
  // --- tokenbom (FID-2026-0913-001) ---
  ['tokenbom/gpt-5.3-codex', 400_000],
  ['tokenbom/grok-4.6', 500_000],
  ['tokenbom/kimi-k3', 1_048_576],
  ['tokenbom/minimax-m3', 1_048_576],
  ['tokenbom/doubao-seed-2.1-pro', 200_000],
  ['tokenbom/gpt-5.6-luna', 1_050_000],
  ['tokenbom/gpt-5.5', 1_050_000],
  // --- infron (FID-2026-0914-001) ---
  ['infron/deepseek/deepseek-v4-flash:free', 1_048_580],
  ['infron/deepseek/deepseek-v4-flash-0731:free', 1_000_000],
  ['infron/qwen/qwen3.8-27b:free', 256_000],
  ['infron/nvidia/nemotron-3.5-lightning-30b-a3b:free', 1_048_576],
  ['infron/kwaipilot/kat-coder-pro-v2', 262_140],
  ['infron/moonshotai/kimi-k2.7-code', 262_144],
  ['infron/qwen/qwen3-coder-next', 262_144],
  ['infron/google/gemini-3.1-pro-preview', 1_048_576],
  ['infron/z-ai/glm-5.3-flash', 1_000_000],
  // --- unorouter (FID-2026-0914-001) ---
  ['unorouter/glm-5.3-flash:free', 1_000_000],
  ['unorouter/deepseek-v4-flash:free', 1_000_000],
  ['unorouter/gemini-3.6-flash:free', 1_000_000],
  ['unorouter/gpt-oss-120b:free', 131_072],
  ['unorouter/qwen3.6-35b-a3b:free', 262_100],
  ['unorouter/qwen3.8-27b:free', 65_536],
  ['unorouter/step-3.7-flash:free', 256_000],
  ['unorouter/codestral-latest:free', 256_000],
  ['unorouter/north-mini-code:free', 256_000],
  ['unorouter/seed-oss-36b:free', 524_288],
  ['unorouter/dots-3-note-preview:free', 512_000],
  ['unorouter/intern-s2-preview:free', 262_144],
  ['unorouter/claude-fable-5.1', 1_000_000],
  ['unorouter/gpt-5.5', 1_100_000],
  ['unorouter/gpt-6-astra', 1_100_000],
  ['unorouter/claude-opus-4.8', 1_000_000],
  ['unorouter/deepseek-v4-pro', 1_000_000],
])

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
  ...Object.values(opencodeGoModels),
  ...Object.values(commandcodeModels),
  ...Object.values(hcnsecModels),
  ...Object.values(tokenbomModels),
  ...Object.values(infronModels),
  ...Object.values(unorouterModels),
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
