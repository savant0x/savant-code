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
