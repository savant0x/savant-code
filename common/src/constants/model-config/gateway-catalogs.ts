/**
 * Gateway model catalogs — audited static allowlists (FID-2026-0913-001).
 *
 * The hcnsec + tokenbom gateways are identity-audited resellers: their live
 * /v1/models listings include substituted, prompt-injected, and dead ids
 * (docs/provider-identity-audit-2026-09-13.md), so their catalogs here are
 * STATIC — exactly the 14 chat models the audits confirmed genuine. The
 * picker can only offer this set; excluded listings stay excluded.
 *
 * Model ids are the UPSTREAM ids verbatim (case-exact as served), prefixed
 * with the internal routing prefix. Context windows are pinned per model
 * from OpenRouter's catalog (2026-09-13, source ids in the FID table) —
 * NOT the family heuristic, which is wrong on 9 of 14. A new upstream
 * model requires a FID-scoped catalog edit (deliberate friction, recorded
 * in the FID's Trust Provenance).
 *
 * This module exists because model-config/providers.ts sits at the 300-line
 * hard cap (registry-partition precedent for file splits).
 */

/** HCNSec allowlist — 7 audited-genuine channels (audit T43-E). */
export const hcnsecModels = {
  hcnsec_glm_5_3_flash: 'hcnsec/glm-5.3-flash',
  hcnsec_deepseek_v4_flash: 'hcnsec/DeepSeek-V4-Flash',
  hcnsec_deepseek_v4_flash_vision_exp: 'hcnsec/deepseek-v4-flash-vision-exp',
  hcnsec_qwen_3_6_35b_a3b: 'hcnsec/Qwen3.6-35B-A3B',
  hcnsec_qwen_3_8_flash_next: 'hcnsec/Qwen3.8-Flash-Next',
  hcnsec_step_3_7_flash: 'hcnsec/step-3.7-flash',
  hcnsec_kimi_k3: 'hcnsec/kimi-k3',
} as const
export type HcnsecModel = (typeof hcnsecModels)[keyof typeof hcnsecModels]

/**
 * TokenBom allowlist — 7 audited-genuine channels (gauntlet T44-C). The
 * two `gpt-5.6-luna` / `gpt-5.5` channels are Microsoft M365 Copilot
 * subscription-arbitrage suppliers, included by explicit operator ruling
 * ("the microsoft ones are fine to like the luna one"); ~46 tokens of
 * hidden M365 system prompt ride every request. Personal-use provenance —
 * not a community-release default.
 */
export const tokenbomModels = {
  tokenbom_gpt_5_3_codex: 'tokenbom/gpt-5.3-codex',
  tokenbom_grok_4_6: 'tokenbom/grok-4.6',
  tokenbom_kimi_k3: 'tokenbom/kimi-k3',
  tokenbom_minimax_m3: 'tokenbom/minimax-m3',
  tokenbom_doubao_seed_2_1_pro: 'tokenbom/doubao-seed-2.1-pro',
  tokenbom_gpt_5_6_luna: 'tokenbom/gpt-5.6-luna',
  tokenbom_gpt_5_5: 'tokenbom/gpt-5.5',
} as const
export type TokenbomModel = (typeof tokenbomModels)[keyof typeof tokenbomModels]

/**
 * Infron curated catalog (FID-2026-0914-001) — operator-ruled set:
 * 4 free (`:free` slugs) + 5 top coding. Chat-served models only — the
 * Responses-only Codex family is excluded (`eps=[openai-response]`; chat
 * would 404). Inference runs at llm.onerouter.pro/v1 (docs quickstart);
 * api.infron.ai is the catalog host. Context windows are the vendors' own
 * `context_length` values. `deepseek-v4-flash-0731:free` declares tool
 * support but ships blank endpoint metadata — included by explicit
 * operator ruling, flagged NEEDS-REVIEW (FID MQ4).
 */
export const infronModels = {
  infron_deepseek_v4_flash_free: 'infron/deepseek/deepseek-v4-flash:free',
  infron_deepseek_v4_flash_0731_free:
    'infron/deepseek/deepseek-v4-flash-0731:free',
  infron_qwen_3_8_27b_free: 'infron/qwen/qwen3.8-27b:free',
  infron_nemotron_3_5_lightning_free:
    'infron/nvidia/nemotron-3.5-lightning-30b-a3b:free',
  infron_kat_coder_pro_v2: 'infron/kwaipilot/kat-coder-pro-v2',
  infron_kimi_k2_7_code: 'infron/moonshotai/kimi-k2.7-code',
  infron_qwen_3_coder_next: 'infron/qwen/qwen3-coder-next',
  infron_gemini_3_1_pro_preview: 'infron/google/gemini-3.1-pro-preview',
  infron_glm_5_3_flash: 'infron/z-ai/glm-5.3-flash',
} as const
export type InfronModel = (typeof infronModels)[keyof typeof infronModels]

/**
 * UnoRouter curated catalog (FID-2026-0914-001) — operator-ruled set:
 * 12 free (`:free` never bills, per vendor docs) + 5 top coding. The
 * gateway is a QuantumNous New API reseller (multi-supplier failover is a
 * documented substitution surface; personal-use provenance — FID Trust
 * Provenance). 5 of the free channels were live-verified HTTP 200 this
 * session; the rest failed busy-class only (vendor-documented peak-hour
 * saturation). Context windows are the vendor console's own
 * `metadata.contextWindow` values.
 */
export const unorouterModels = {
  unorouter_glm_5_3_flash_free: 'unorouter/glm-5.3-flash:free',
  unorouter_deepseek_v4_flash_free: 'unorouter/deepseek-v4-flash:free',
  unorouter_gemini_3_6_flash_free: 'unorouter/gemini-3.6-flash:free',
  unorouter_gpt_oss_120b_free: 'unorouter/gpt-oss-120b:free',
  unorouter_qwen_3_6_35b_a3b_free: 'unorouter/qwen3.6-35b-a3b:free',
  unorouter_qwen_3_8_27b_free: 'unorouter/qwen3.8-27b:free',
  unorouter_step_3_7_flash_free: 'unorouter/step-3.7-flash:free',
  unorouter_codestral_free: 'unorouter/codestral-latest:free',
  unorouter_north_mini_code_free: 'unorouter/north-mini-code:free',
  unorouter_seed_oss_36b_free: 'unorouter/seed-oss-36b:free',
  unorouter_dots_3_note_free: 'unorouter/dots-3-note-preview:free',
  unorouter_intern_s2_free: 'unorouter/intern-s2-preview:free',
  unorouter_claude_fable_5_1: 'unorouter/claude-fable-5.1',
  unorouter_gpt_5_5: 'unorouter/gpt-5.5',
  unorouter_gpt_6_astra: 'unorouter/gpt-6-astra',
  unorouter_claude_opus_4_8: 'unorouter/claude-opus-4.8',
  unorouter_deepseek_v4_pro: 'unorouter/deepseek-v4-pro',
} as const
export type UnorouterModel =
  (typeof unorouterModels)[keyof typeof unorouterModels]

/**
 * BazaarLink catalog (FID-2026-0915-006, amended per operator ruling):
 * - The ONE audited-genuine free channel (identity gauntlet T51-C):
 *   consistent EN/ZH self-ID as Qwen (Alibaba Tongyi Lab), cleanest
 *   fingerprint of any audited gateway (prompt_tokens 23–37 — zero
 *   injection class), 1M vendor-published window.
 * - The top-coding paid tier (operator: "add the top 15 top models ranked
 *   on sep 15 2026 only", "for coding tasks"): the BenchLM SWE-bench Pro
 *   leaderboard dated exactly 2026-09-15, intersected with the LIVE keyed
 *   roster. 4 of the top 15 (Claude Mythos 5, Sakana Fugu-Ultra, Tencent
 *   Hy4 preview, Ornith-1.5-397B) are NOT served by the gateway, so the
 *   faithful set is the 11 available: Fable 5.1 (#1), Fable 5 (#3),
 *   Opus 5 (#4), Opus 4.8 (#6), Qwen3.8 Max (#7), Grok 4.5 (#10),
 *   GPT-5.6 Sol (#11), Opus 4.7 (#12), GPT-5.6 Terra (#13), Sonnet 5 (#14),
 *   GPT-5.6 Luna (#15). PAID channels added WITHOUT identity testing
 *   (account zero-credit; live 402 measured). Serving-name disclosure
 *   verified on the free channels (responses echo the routed model).
 *   Untested-paid provenance.
 * - EXCLUDED by the gauntlet: deepseek :free channels (substituted: EN
 *   self-IDs claimed GPT-4 / Claude Opus 4.1; ~60–70 hidden injected
 *   tokens) and `auto:free` (429 storm, 120–265s) — both by ruling.
 */
export const bazaarlinkModels = {
  bazaarlink_qwen_3_7_flash_free: 'bazaarlink/qwen/qwen3.7-flash:free',
  bazaarlink_claude_fable_5_1: 'bazaarlink/claude-fable-5.1',
  bazaarlink_claude_fable_5: 'bazaarlink/claude-fable-5',
  bazaarlink_claude_opus_5: 'bazaarlink/claude-opus-5',
  bazaarlink_claude_opus_4_8: 'bazaarlink/claude-opus-4.8',
  bazaarlink_claude_opus_4_7: 'bazaarlink/claude-opus-4.7',
  bazaarlink_claude_sonnet_5: 'bazaarlink/claude-sonnet-5',
  bazaarlink_grok_4_5: 'bazaarlink/grok-4.5',
  bazaarlink_gpt_5_6_sol: 'bazaarlink/gpt-5.6-sol',
  bazaarlink_gpt_5_6_terra: 'bazaarlink/gpt-5.6-terra',
  bazaarlink_gpt_5_6_luna: 'bazaarlink/gpt-5.6-luna',
  bazaarlink_qwen_3_8_max: 'bazaarlink/qwen3.8-max',
} as const
export type BazaarlinkModel =
  (typeof bazaarlinkModels)[keyof typeof bazaarlinkModels]
