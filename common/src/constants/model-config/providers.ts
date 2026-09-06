/**
 * Per-provider model catalogs (extracted from model-config.ts — FID-2026-0809-016).
 * Pure data + derived types; the aggregation and helpers live in sibling modules.
 * The protocol metadata maps live in provider-protocols.ts.
 */

// Re-export the protocol maps from the sibling module (barrel unchanged).
export {
  COMMANDCODE_PROTOCOLS,
  OPENCODE_GO_PROTOCOLS,
  OPENCODE_ZEN_PROTOCOLS,
  PROVIDER_PROTOCOL_MAPS,
} from './provider-protocols'

export const openaiModels = {
  gpt4_1: 'gpt-4.1-2025-04-14',
  gpt4o: 'gpt-4o-2024-11-20',
  gpt4omini: 'gpt-4o-mini-2024-07-18',
  o3mini: 'o3-mini-2025-01-31',
  o3: 'o3-2025-04-16',
  o3pro: 'o3-pro-2025-06-10',
  o4mini: 'o4-mini-2025-04-16',
  generatePatch:
    'ft:gpt-4o-2024-08-06:manifold-markets:generate-patch-batch2:AKYtDIhk',
} as const
export type OpenAIModel = (typeof openaiModels)[keyof typeof openaiModels]

export const openrouterModels = {
  openrouter_claude_sonnet_4_5: 'anthropic/claude-sonnet-4.5',
  openrouter_claude_sonnet_4: 'anthropic/claude-4-sonnet-20250522',
  openrouter_claude_opus_4: 'anthropic/claude-opus-4.1',
  openrouter_claude_3_5_haiku: 'anthropic/claude-3.5-haiku-20241022',
  openrouter_claude_3_5_sonnet: 'anthropic/claude-3.5-sonnet-20240620',
  openrouter_gpt4o: 'openai/gpt-4o-2024-11-20',
  openrouter_gpt5: 'openai/gpt-5.1',
  openrouter_gpt5_chat: 'openai/gpt-5.1-chat',
  openrouter_gpt4o_mini: 'openai/gpt-4o-mini-2024-07-18',
  openrouter_gpt4_1_nano: 'openai/gpt-4.1-nano',
  openrouter_o3_mini: 'openai/o3-mini-2025-01-31',
  openrouter_gemini2_5_pro_preview: 'google/gemini-2.5-pro',
  openrouter_gemini2_5_flash: 'google/gemini-2.5-flash',
  openrouter_gemini2_5_flash_thinking:
    'google/gemini-2.5-flash-preview:thinking',
  openrouter_grok_4: 'x-ai/grok-4-07-09',
  openrouter_tencent_hy3: 'tencent/hy3',
  openrouter_tencent_hy3_free: 'tencent/hy3:free',
  openrouter_zai_glm_5_3_flash: 'z-ai/glm-5.3-flash',
  openrouter_zai_glm_5_3_free: 'z-ai/glm-5.3-free',
} as const
export type openrouterModel =
  (typeof openrouterModels)[keyof typeof openrouterModels]

export const openCodeZenModels = {
  opencode_kimi_k2_6: 'opencode/kimi-k2.6',
} as const
export type OpenCodeZenModel =
  (typeof openCodeZenModels)[keyof typeof openCodeZenModels]

export const TOKENROUTER_NAMES = {
  'tokenrouter/z-ai/glm-5.3-free': 'GLM 5.3 Free',
}

export const tokenrouterModels = {
  // Tier 1 — Elite Flagships
  tokenrouter_anthropic_claude_fable_5: 'tokenrouter/anthropic/claude-fable-5',
  tokenrouter_openai_gpt_5_6_sol: 'tokenrouter/openai/gpt-5.6-sol',
  tokenrouter_deepseek_v4_pro: 'tokenrouter/deepseek/deepseek-v4-pro',
  tokenrouter_qwen_qwen3_7_max: 'tokenrouter/qwen/qwen3.7-max',
  tokenrouter_zai_glm_5_2: 'tokenrouter/z-ai/glm-5.2',
  tokenrouter_openai_gpt_5_5_pro: 'tokenrouter/openai/gpt-5.5-pro',
  tokenrouter_anthropic_claude_opus_4_8:
    'tokenrouter/anthropic/claude-opus-4.8',
  tokenrouter_xai_grok_4_5: 'tokenrouter/x-ai/grok-4.5',
  tokenrouter_moonshotai_kimi_k3: 'tokenrouter/moonshotai/kimi-k3',
  tokenrouter_bytedance_seed_seedream_5_0_pro:
    'tokenrouter/bytedance-seed/seedream-5.0-pro',
  tokenrouter_minimax_m3: 'tokenrouter/MiniMax-M3',
  // Tier 2 — Frontier Performers
  tokenrouter_anthropic_claude_sonnet_5:
    'tokenrouter/anthropic/claude-sonnet-5',
  tokenrouter_openai_gpt_5_6_terra: 'tokenrouter/openai/gpt-5.6-terra',
  tokenrouter_qwen_qwen3_7_plus: 'tokenrouter/qwen/qwen3.7-plus',
  tokenrouter_anthropic_claude_opus_4_8_fast:
    'tokenrouter/anthropic/claude-opus-4.8-fast',
  tokenrouter_google_gemini_3_1_pro_preview:
    'tokenrouter/google/gemini-3.1-pro-preview',
  tokenrouter_anthropic_claude_opus_4_7:
    'tokenrouter/anthropic/claude-opus-4.7',
  tokenrouter_anthropic_claude_opus_4_7_fast:
    'tokenrouter/anthropic/claude-opus-4.7-fast',
  tokenrouter_openai_gpt_5_5: 'tokenrouter/openai/gpt-5.5',
  tokenrouter_zai_glm_5_2_free: 'tokenrouter/z-ai/glm-5.2-free',
  tokenrouter_deepseek_v3_2: 'tokenrouter/deepseek/deepseek-v3.2',
  tokenrouter_qwen_qwen3_6_plus: 'tokenrouter/qwen/qwen3.6-plus',
  tokenrouter_moonshotai_kimi_k2_7_code:
    'tokenrouter/moonshotai/kimi-k2.7-code',
  tokenrouter_xiaomi_mimo_v2_5_pro: 'tokenrouter/xiaomi/mimo-v2.5-pro',
  tokenrouter_zai_glm_5_1: 'tokenrouter/z-ai/glm-5.1',
  tokenrouter_openai_gpt_5_4: 'tokenrouter/openai/gpt-5.4',
  tokenrouter_xai_grok_4_3: 'tokenrouter/x-ai/grok-4.3',
  tokenrouter_anthropic_claude_opus_4_6:
    'tokenrouter/anthropic/claude-opus-4.6',
  tokenrouter_openai_gpt_5_3_codex: 'tokenrouter/openai/gpt-5.3-codex',
  tokenrouter_nvidia_nemotron_3_super_120b:
    'tokenrouter/nvidia/nemotron-3-super-120b-a12b',
  tokenrouter_miromind_mirothinker_1_7:
    'tokenrouter/miromind/mirothinker-1-7-deepresearch',
  tokenrouter_qwen_qwen3_5_397b: 'tokenrouter/qwen/qwen3.5-397b-a17b',
  tokenrouter_qwen_qwen3_5_122b: 'tokenrouter/qwen/qwen3.5-122b-a10b',
  tokenrouter_openai_gpt_oss_120b: 'tokenrouter/openai/gpt-oss-120b',
  tokenrouter_zai_glm_5_3_free: 'tokenrouter/z-ai/glm-5.3-free',
} as const
export type TokenrouterModel =
  (typeof tokenrouterModels)[keyof typeof tokenrouterModels]

/**
 * TokenHarbor model IDs published on https://tokenharbor.ai/models.
 * Keep the internal provider prefix so direct routing strips exactly one
 * `tokenharbor/` segment and preserves upstream suffixes such as `:free`.
 */
export const tokenharborModels = {
  // Frontier
  tokenharbor_claude_opus_5: 'tokenharbor/claude-opus-5',
  tokenharbor_claude_fable_5: 'tokenharbor/claude-fable-5',
  tokenharbor_gpt_5_6_sol: 'tokenharbor/gpt-5.6-sol',
  tokenharbor_kimi_k3: 'tokenharbor/kimi-k3',
  tokenharbor_qwen_3_8_max: 'tokenharbor/qwen3.8-max',
  tokenharbor_gpt_5_6_terra: 'tokenharbor/gpt-5.6-terra',
  tokenharbor_grok_4_5: 'tokenharbor/grok-4.5',
  tokenharbor_claude_sonnet_5: 'tokenharbor/claude-sonnet-5',
  tokenharbor_gemini_3_6_flash: 'tokenharbor/gemini-3.6-flash',
  // Value
  tokenharbor_glm_5_2: 'tokenharbor/glm-5.2',
  tokenharbor_gpt_5_6_luna: 'tokenharbor/gpt-5.6-luna',
  tokenharbor_deepseek_v4_flash: 'tokenharbor/deepseek-v4-flash',
  tokenharbor_minimax_m3: 'tokenharbor/minimax-m3',
  tokenharbor_deepseek_v4_pro: 'tokenharbor/deepseek-v4-pro',
  tokenharbor_mimo_v2_5_pro: 'tokenharbor/mimo-v2.5-pro',
  tokenharbor_mimo_v2_5: 'tokenharbor/mimo-v2.5',
  // Free
  tokenharbor_kimi_k3_free: 'tokenharbor/kimi-k3:free',
  tokenharbor_deepseek_v4_flash_free: 'tokenharbor/deepseek-v4-flash:free',
  tokenharbor_mimo_v2_5_free: 'tokenharbor/mimo-v2.5:free',
  // Orchestra
  tokenharbor_th_orchestra: 'tokenharbor/th-orchestra',
} as const
export type TokenHarborModel =
  (typeof tokenharborModels)[keyof typeof tokenharborModels]

export const nvidiaModels = {
  nvidia_glm5_2: 'nvidia/zai-org/glm-5.2',
  nvidia_llama33_70b: 'nvidia/meta/llama-3.3-70b-instruct',
  nvidia_nemotron_4_340b: 'nvidia/nvidia/nemotron-4-340b-instruct',
  nvidia_deepseek_v3: 'nvidia/deepseek-ai/deepseek-v3',
  nvidia_qwen25_72b: 'nvidia/qwen/qwen2.5-72b-instruct',
  nvidia_minimax_m27: 'nvidia/minimaxai/minimax-m2.7',
} as const
export type NvidiaModel = (typeof nvidiaModels)[keyof typeof nvidiaModels]

export const opencodeGoModels = {
  // OpenAI-compatible models
  opencode_go_grok_4_5: 'opencode-go/grok-4.5',
  opencode_go_glm_5_2: 'opencode-go/glm-5.2',
  opencode_go_glm_5_1: 'opencode-go/glm-5.1',
  opencode_go_kimi_k3: 'opencode-go/kimi-k3',
  opencode_go_kimi_k2_7_code: 'opencode-go/kimi-k2.7-code',
  opencode_go_kimi_k2_6: 'opencode-go/kimi-k2.6',
  opencode_go_mimo_v2_5: 'opencode-go/mimo-v2.5',
  opencode_go_mimo_v2_5_pro: 'opencode-go/mimo-v2.5-pro',
  opencode_go_deepseek_v4_pro: 'opencode-go/deepseek-v4-pro',
  opencode_go_deepseek_v4_flash: 'opencode-go/deepseek-v4-flash',
  // Anthropic-compatible models
  opencode_go_minimax_m3: 'opencode-go/minimax-m3',
  opencode_go_minimax_m2_7: 'opencode-go/minimax-m2.7',
  opencode_go_qwen3_7_max: 'opencode-go/qwen3.7-max',
  opencode_go_qwen3_7_plus: 'opencode-go/qwen3.7-plus',
  opencode_go_qwen3_6_plus: 'opencode-go/qwen3.6-plus',
} as const
export type OpencodeGoModel =
  (typeof opencodeGoModels)[keyof typeof opencodeGoModels]

/** Protocol metadata for OpenCode Go models — each model specifies its API protocol. */
export const commandcodeModels = {
  // Claude models (require Anthropic endpoint)
  commandcode_claude_opus_5: 'commandcode/claude-opus-5',
  commandcode_claude_opus_4_8: 'commandcode/claude-opus-4.8',
  commandcode_claude_sonnet_5: 'commandcode/claude-sonnet-5',
  commandcode_claude_sonnet_4_6: 'commandcode/claude-sonnet-4.6',
  commandcode_claude_haiku_4_5: 'commandcode/claude-haiku-4.5',
  // OpenAI-compatible models
  commandcode_grok_4_5: 'commandcode/x-ai/grok-4.5',
  commandcode_glm_5_2: 'commandcode/z-ai/glm-5.2',
  commandcode_glm_5_1: 'commandcode/z-ai/glm-5.1',
  commandcode_kimi_k3: 'commandcode/moonshotai/kimi-k3',
  commandcode_kimi_k2_7_code: 'commandcode/moonshotai/kimi-k2.7-code',
  commandcode_kimi_k2_6: 'commandcode/moonshotai/kimi-k2.6',
  commandcode_mimo_v2_5: 'commandcode/xiaomi/mimo-v2.5',
  commandcode_mimo_v2_5_pro: 'commandcode/xiaomi/mimo-v2.5-pro',
  commandcode_deepseek_v4_pro: 'commandcode/deepseek/deepseek-v4-pro',
  commandcode_deepseek_v4_flash: 'commandcode/deepseek/deepseek-v4-flash',
  commandcode_deepseek_v3_2: 'commandcode/deepseek/deepseek-v3.2',
  commandcode_gpt_5_6_sol: 'commandcode/openai/gpt-5.6-sol',
  commandcode_gpt_5_6_terra: 'commandcode/openai/gpt-5.6-terra',
  commandcode_gpt_5_6_luna: 'commandcode/openai/gpt-5.6-luna',
  commandcode_gpt_5_5: 'commandcode/openai/gpt-5.5',
  commandcode_gpt_5_3_codex: 'commandcode/openai/gpt-5.3-codex',
  commandcode_qwen3_7_max: 'commandcode/qwen/qwen3.7-max',
  commandcode_qwen3_7_plus: 'commandcode/qwen/qwen3.7-plus',
  commandcode_qwen3_6_plus: 'commandcode/qwen/qwen3.6-plus',
  commandcode_minimax_m3: 'commandcode/minimax-m3',
  commandcode_minimax_m2_7: 'commandcode/minimaxai/minimax-m2.7',
  // Free models
  commandcode_laguna_s_2_1: 'commandcode/lagunaai/laguna-s-2.1',
  commandcode_ling_3_0_flash: 'commandcode/minimaxai/ling-3.0-flash',
} as const
export type CommandcodeModel =
  (typeof commandcodeModels)[keyof typeof commandcodeModels]

export const cloudflareModels = {
  cloudflare_gpt_oss_120b: 'cloudflare/openai/gpt-oss-120b',
  cloudflare_gpt_oss_20b: 'cloudflare/openai/gpt-oss-20b',
  cloudflare_deepseek_r1_distill:
    'cloudflare/deepseek/deepseek-r1-distill-qwen-32b',
  cloudflare_gemma_4_26b: 'cloudflare/google/gemma-4-26b-a4b-it',
  cloudflare_llama_3_3_70b: 'cloudflare/meta/llama-3.3-70b-instruct-fp8-fast',
  cloudflare_llama_4_scout: 'cloudflare/meta/llama-4-scout-17b-16e-instruct',
  cloudflare_kimi_k2_7_code: 'cloudflare/moonshotai/kimi-k2.7-code',
  cloudflare_kimi_k2_6: 'cloudflare/moonshotai/kimi-k2.6',
  cloudflare_glm_5_2: 'cloudflare/zai-org/glm-5.2',
  cloudflare_glm_4_7_flash: 'cloudflare/zai-org/glm-4.7-flash',
  cloudflare_qwen3_30b: 'cloudflare/qwen/qwen3-30b-a3b-fp8',
  cloudflare_qwq_32b: 'cloudflare/qwen/qwq-32b',
  cloudflare_nemotron_3: 'cloudflare/nvidia/nemotron-3-120b-a12b',
  cloudflare_mistral_small:
    'cloudflare/mistralai/mistral-small-3.1-24b-instruct',
} as const
export type CloudflareModel =
  (typeof cloudflareModels)[keyof typeof cloudflareModels]

export const deepseekModels = {
  deepseekChat: 'deepseek-chat',
  deepseekReasoner: 'deepseek-reasoner',
  deepseekV4ProDirect: 'deepseek-v4-pro',
  deepseekV4Pro: 'deepseek/deepseek-v4-pro',
  deepseekV4FlashDirect: 'deepseek-v4-flash',
  deepseekV4Flash: 'deepseek/deepseek-v4-flash',
} as const
export type DeepseekModel = (typeof deepseekModels)[keyof typeof deepseekModels]

export const mimoModels = {
  mimoV25Direct: 'mimo-v2.5',
  mimoV25: 'mimo/mimo-v2.5',
  mimoV25ProDirect: 'mimo-v2.5-pro',
  mimoV25Pro: 'mimo/mimo-v2.5-pro',
} as const
export type MimoModel = (typeof mimoModels)[keyof typeof mimoModels]

export const minimaxModels = {
  minimaxM3: 'minimax/minimax-m3',
} as const
export type MiniMaxModel = (typeof minimaxModels)[keyof typeof minimaxModels]

export const moonshotModels = {
  kimiK26: 'moonshotai/kimi-k2.6',
  kimiK27Code: 'moonshotai/kimi-k2.7-code',
} as const
export type MoonshotModel = (typeof moonshotModels)[keyof typeof moonshotModels]

export const atlasCloudModels = {
  tencentHy3: 'tencent/hy3',
} as const
export type AtlasCloudModel =
  (typeof atlasCloudModels)[keyof typeof atlasCloudModels]

// Vertex uses "endpoint IDs" for finetuned models, which are just integers
export const finetunedVertexModels = {
  ft_filepicker_003: '196166068534771712',
  ft_filepicker_005: '8493203957034778624',
  ft_filepicker_007: '2589952415784501248',
  ft_filepicker_topk_001: '3676445825887633408',
  ft_filepicker_008: '2672143108984012800',
  ft_filepicker_topk_002: '1694861989844615168',
  ft_filepicker_010: '3808739064941641728',
  ft_filepicker_010_epoch_2: '6231675664466968576',
  ft_filepicker_topk_003: '1502192368286171136',
} as const
export const finetunedVertexModelNames: Record<string, string> = {
  [finetunedVertexModels.ft_filepicker_003]: 'ft_filepicker_003',
  [finetunedVertexModels.ft_filepicker_005]: 'ft_filepicker_005',
  [finetunedVertexModels.ft_filepicker_007]: 'ft_filepicker_007',
  [finetunedVertexModels.ft_filepicker_topk_001]: 'ft_filepicker_topk_001',
  [finetunedVertexModels.ft_filepicker_008]: 'ft_filepicker_008',
  [finetunedVertexModels.ft_filepicker_topk_002]: 'ft_filepicker_topk_002',
  [finetunedVertexModels.ft_filepicker_010]: 'ft_filepicker_010',
  [finetunedVertexModels.ft_filepicker_010_epoch_2]:
    'ft_filepicker_010_epoch_2',
  [finetunedVertexModels.ft_filepicker_topk_003]: 'ft_filepicker_topk_003',
}
export type FinetunedVertexModel =
  (typeof finetunedVertexModels)[keyof typeof finetunedVertexModels]
