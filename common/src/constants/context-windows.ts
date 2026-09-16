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
 */

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
  // --- bazaarlink (FID-2026-0915-006, amended: +11 available top-coding
  // paid ids per the BenchLM SWE-bench Pro leaderboard dated 2026-09-15 ∩
  // the LIVE keyed roster; windows are the vendor's OWN keyed
  // /v1/models context_length values, 2026-09-15) ---
  ['bazaarlink/qwen/qwen3.7-flash:free', 1_000_000],
  ['bazaarlink/claude-fable-5.1', 1_000_000],
  ['bazaarlink/claude-fable-5', 1_000_000],
  ['bazaarlink/claude-opus-5', 1_000_000],
  ['bazaarlink/claude-opus-4.8', 1_000_000],
  ['bazaarlink/claude-opus-4.7', 1_000_000],
  ['bazaarlink/claude-sonnet-5', 1_000_000],
  ['bazaarlink/grok-4.5', 500_000],
  ['bazaarlink/gpt-5.6-sol', 1_050_000],
  ['bazaarlink/gpt-5.6-terra', 1_050_000],
  ['bazaarlink/gpt-5.6-luna', 1_050_000],
  ['bazaarlink/qwen3.8-max', 1_000_000],
  // --- atria (FID-2026-0916-005: single one-model static catalog;
  // 256K window is vendor-published in api.atria-asi.ai/docs) ---
  ['atria/Atria-Dawn-Preview', 262_144],
  // --- tokenrouter (FID-2026-0916-002: the pre-program catalog finally
  // migrated off the family heuristic. Sources: bazaarlink + orcarouter
  // keyed /v1/models rosters 2026-09-16; OpenRouter public catalog as
  // tiebreak. Two vendors publishing the same upstream window is the
  // cross-check; 2-of-3 votes marked inline. TokenRouter's own roster
  // publishes NO window fields.) ---
  ['tokenrouter/anthropic/claude-fable-5', 1_000_000],
  ['tokenrouter/openai/gpt-5.6-sol', 1_050_000],
  ['tokenrouter/deepseek/deepseek-v4-pro', 1_048_576],
  ['tokenrouter/qwen/qwen3.7-max', 1_000_000],
  ['tokenrouter/z-ai/glm-5.2', 1_048_576], // 2-of-3: bazaarlink+OpenRouter vs orcarouter 1,000,000
  ['tokenrouter/openai/gpt-5.5-pro', 1_050_000],
  ['tokenrouter/anthropic/claude-opus-4.8', 1_000_000],
  ['tokenrouter/anthropic/claude-opus-4.8-fast', 1_000_000],
  ['tokenrouter/x-ai/grok-4.5', 500_000],
  ['tokenrouter/moonshotai/kimi-k3', 1_048_576],
  ['tokenrouter/MiniMax-M3', 1_048_576],
  ['tokenrouter/anthropic/claude-sonnet-5', 1_000_000],
  ['tokenrouter/openai/gpt-5.6-terra', 1_050_000],
  ['tokenrouter/qwen/qwen3.7-plus', 1_000_000],
  ['tokenrouter/anthropic/claude-opus-4.7', 1_000_000],
  ['tokenrouter/anthropic/claude-opus-4.7-fast', 1_000_000],
  ['tokenrouter/openai/gpt-5.5', 1_050_000],
  ['tokenrouter/deepseek/deepseek-v3.2', 163_840],
  ['tokenrouter/qwen/qwen3.6-plus', 1_000_000], // 2-of-3: bazaarlink+OpenRouter vs orcarouter 1,048,576
  ['tokenrouter/moonshotai/kimi-k2.7-code', 262_144],
  ['tokenrouter/xiaomi/mimo-v2.5-pro', 1_050_000],
  ['tokenrouter/z-ai/glm-5.1', 204_800], // 2-of-3: bazaarlink+OpenRouter vs orcarouter 200,000
  ['tokenrouter/openai/gpt-5.4', 1_050_000],
  ['tokenrouter/x-ai/grok-4.3', 1_000_000],
  ['tokenrouter/anthropic/claude-opus-4.6', 1_000_000],
  ['tokenrouter/openai/gpt-5.3-codex', 400_000],
  ['tokenrouter/nvidia/nemotron-3-super-120b-a12b', 262_144],
  ['tokenrouter/qwen/qwen3.5-397b-a17b', 262_144],
  ['tokenrouter/qwen/qwen3.5-122b-a10b', 262_144],
  ['tokenrouter/openai/gpt-oss-120b', 131_072],
  ['tokenrouter/google/gemini-3.1-pro-preview', 1_048_576],
  // --- tokenharbor (FID-2026-0916-002; re-aligned FID-2026-0916-004) ---
  ['tokenharbor/claude-opus-5', 1_000_000],
  ['tokenharbor/claude-fable-5', 1_000_000],
  ['tokenharbor/gpt-5.6-sol', 1_050_000],
  ['tokenharbor/kimi-k3', 1_048_576],
  ['tokenharbor/qwen3.8-max', 1_000_000],
  ['tokenharbor/gpt-5.6-terra', 1_050_000],
  ['tokenharbor/grok-4.5', 500_000],
  ['tokenharbor/claude-sonnet-5', 1_000_000],
  ['tokenharbor/glm-5.2', 1_048_576], // 2-of-3
  ['tokenharbor/gpt-5.6-luna', 1_050_000],
  ['tokenharbor/deepseek-v4-flash', 1_048_576], // the operator-reported 131k bug
  ['tokenharbor/deepseek-v4-pro', 1_048_576],
  ['tokenharbor/mimo-v2.5-pro', 1_050_000],
  ['tokenharbor/mimo-v2.5', 1_050_000],
  ['tokenharbor/deepseek-v4-flash:free', 1_048_576],
  ['tokenharbor/mimo-v2.5:free', 1_050_000],
  ['tokenharbor/th-orchestra', 200_000], // NEEDS-REVIEW: ensemble router, no vendor window published; conservative default pinned
  // FID-2026-0916-004: opencode-go rows removed with the provider (zen
  // free-tier gate). commandcode rows re-keyed to the vendor's renormalized
  // roster spellings (dashed versions, no vendor prefixes, zai-org/GLM,
  // canonical Kimi casing); removed rows: gemini-3.6-flash, minimax-m3
  // (roster-absent), kimi-k3:free (launch event ended).
  // --- commandcode (FID-2026-0916-004 roster spellings) ---
  ['commandcode/claude-opus-5', 1_000_000],
  ['commandcode/claude-opus-4-8', 1_000_000],
  ['commandcode/claude-opus-4-7', 1_000_000],
  ['commandcode/claude-fable-5', 1_000_000],
  ['commandcode/claude-fable-5-1', 1_000_000],
  ['commandcode/claude-sonnet-5', 1_000_000],
  ['commandcode/claude-sonnet-4-6', 1_000_000],
  ['commandcode/claude-haiku-4-5-20251001', 200_000],
  ['commandcode/xai/grok-4.5', 500_000],
  ['commandcode/xai/grok-4.6', 500_000],
  ['commandcode/zai-org/glm-5.2', 1_048_576], // 2-of-3
  ['commandcode/zai-org/glm-5.3', 1_048_576],
  ['commandcode/moonshotai/Kimi-K3', 1_048_576],
  ['commandcode/moonshotai/Kimi-K2.7-Code', 262_144],
  ['commandcode/moonshotai/Kimi-K2.6', 262_144],
  ['commandcode/MiniMaxAI/MiniMax-M3', 1_048_576],
  ['commandcode/MiniMaxAI/MiniMax-M2.7', 204_800],
  ['commandcode/deepseek/deepseek-v4-pro', 1_048_576],
  ['commandcode/deepseek/deepseek-v4-flash', 1_048_576],
  ['commandcode/deepseek/deepseek-v4.1-flash', 1_048_576],
  ['commandcode/gpt-5.6-sol', 1_050_000],
  ['commandcode/gpt-5.6-terra', 1_050_000],
  ['commandcode/gpt-5.6-luna', 1_050_000],
  ['commandcode/gpt-5.5', 1_050_000],
  ['commandcode/gpt-5.3-codex', 400_000],
  ['commandcode/Qwen/Qwen3.8-Max', 1_000_000],
  ['commandcode/Qwen/Qwen3.8-27B', 262_144],
  ['commandcode/Qwen/Qwen3.7-Max', 1_000_000],
  ['commandcode/Qwen/Qwen3.7-Plus', 1_000_000],
  ['commandcode/Qwen/Qwen3.7-Flash', 1_000_000],
  ['commandcode/poolside/laguna-s-2.1-free', 1_048_576],
  ['commandcode/inclusionai/ling-3.0-flash-sante:free', 262_144],
  ['commandcode/meituan/LongCat-2.0:free', 1_048_576],
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
