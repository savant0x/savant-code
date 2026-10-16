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

/**
 * Atria AI catalog (FID-2026-0916-005) — the single upstream model the
 * gateway exposes. The vendor's docs (api.atria-asi.ai/docs) publish
 * exactly one model, `Atria-Dawn-Preview` (case-sensitive). A STATIC map
 * (not an authenticated-live fetch): the /v1/models endpoint is
 * key-protected and the one-model set is a checked-in constant (bazaarlink
 * precedent). Context window pinned to 256K in the fallback table
 * (vendor-published).
 */
export const atriaModels = {
  atria_dawn_preview: 'atria/Atria-Dawn-Preview',
} as const
export type AtriaModel = (typeof atriaModels)[keyof typeof atriaModels]

/**
 * Intern InkStone catalog (FID-2026-1004-008) — the Shanghai AI Laboratory
 * science-discovery platform behind discovery.intern-ai.org.cn (书生·端砚),
 * the China-hosted twin of the `atria` entry with a 10-model roster instead
 * of one. A STATIC map (not an authenticated-live fetch): the vendor's
 * /v1/models is key-protected (HTTP 401 keyless, probed 2026-10-04) AND
 * publishes windows in a non-OpenRouter `schema_version: "2.4"` shape
 * (`input_modalities[].supported_inputs.max_context_length.value`) that the
 * shared parser does not read — so this checked-in set is the source of
 * truth and the exact-id windows are pinned in the fallback table from the
 * LIVE authenticated probe (2026-10-04). Every value is the vendor's own
 * bare id; `intern/` is the internal routing prefix (`idTransform: 'strip'`).
 */
export const internModels = {
  intern_agents_a1: 'intern/Agents-A1',
  intern_atria_dawn_preview: 'intern/Atria-Dawn-Preview',
  intern_deepseek_v4_flash_0731: 'intern/deepseek-v4-flash-0731',
  intern_deepseek_v4_flash_vision: 'intern/deepseek-v4-flash-vision',
  intern_deepseek_v4_pro_0813: 'intern/deepseek-v4-pro-0813',
  intern_glm_5_3: 'intern/glm-5.3',
  intern_s2: 'intern/intern-s2',
  intern_kimi_k2_6: 'intern/kimi-k2.6',
  intern_minimax_m3: 'intern/minimax-m3',
  intern_qwen_3_8_27b: 'intern/qwen3.8-27b',
} as const
export type InternModel = (typeof internModels)[keyof typeof internModels]

/**
 * ChatAnywhere catalog (FID-2026-1005-010) — the gateway's full chat roster
 * (27 of the 30 rows on the keyed /v1/models probe 2026-10-05; the 3
 * text-embedding-* ids are excluded as non-chat). The gateway serves bare
 * upstream ids (`gpt-5.6-sol`) and publishes NO window fields on /v1/models
 * (row shape: id/object/created/owned_by), so this checked-in set is the
 * source of truth and windows live in the context-window-table-chatanywhere
 * seam (cross-gateway consensus; the intern precedent). Free-key tier:
 * 10,000 points/day (chatanywhere/gpt_api_free).
 */
export const chatanywhereModels = {
  chatanywhere_gpt_5: 'chatanywhere/gpt-5',
  chatanywhere_gpt_5_1: 'chatanywhere/gpt-5.1',
  chatanywhere_gpt_5_2: 'chatanywhere/gpt-5.2',
  chatanywhere_gpt_5_mini: 'chatanywhere/gpt-5-mini',
  chatanywhere_gpt_5_nano: 'chatanywhere/gpt-5-nano',
  chatanywhere_gpt_5_4: 'chatanywhere/gpt-5.4',
  chatanywhere_gpt_5_4_mini: 'chatanywhere/gpt-5.4-mini',
  chatanywhere_gpt_5_4_nano: 'chatanywhere/gpt-5.4-nano',
  chatanywhere_gpt_5_5: 'chatanywhere/gpt-5.5',
  chatanywhere_gpt_5_6_sol: 'chatanywhere/gpt-5.6-sol',
  chatanywhere_gpt_5_6_luna: 'chatanywhere/gpt-5.6-luna',
  chatanywhere_gpt_5_6_terra: 'chatanywhere/gpt-5.6-terra',
  chatanywhere_gpt_6_astra: 'chatanywhere/gpt-6-astra',
  chatanywhere_gpt_6_sol: 'chatanywhere/gpt-6-sol',
  chatanywhere_gpt_6_luna: 'chatanywhere/gpt-6-luna',
  chatanywhere_gpt_6_1_sol: 'chatanywhere/gpt-6.1-sol',
  chatanywhere_gpt_4_1: 'chatanywhere/gpt-4.1',
  chatanywhere_gpt_4_1_mini: 'chatanywhere/gpt-4.1-mini',
  chatanywhere_gpt_4_1_nano: 'chatanywhere/gpt-4.1-nano',
  chatanywhere_gpt_4o: 'chatanywhere/gpt-4o',
  chatanywhere_gpt_4o_mini: 'chatanywhere/gpt-4o-mini',
  chatanywhere_gpt_3_5_turbo: 'chatanywhere/gpt-3.5-turbo',
  chatanywhere_deepseek_v3_2: 'chatanywhere/deepseek-v3.2',
  chatanywhere_deepseek_chat: 'chatanywhere/deepseek-chat',
  chatanywhere_deepseek_v4_pro: 'chatanywhere/deepseek-v4-pro',
  chatanywhere_deepseek_v4_flash: 'chatanywhere/deepseek-v4-flash',
  chatanywhere_deepseek_v4_1_flash: 'chatanywhere/deepseek-v4.1-flash',
} as const
export type ChatanywhereModel =
  (typeof chatanywhereModels)[keyof typeof chatanywhereModels]

/**
 * Tiarina Cloud catalog (FID-2026-1012-005) — the AI Gateway of the Indonesian
 * PaaS at ai.tiarina.cloud, on its full measured chat roster (all 19 ids the
 * keyed /v1/models probe returned 2026-10-12, `ids.txt` under
 * dev/scratchpad/active/tiarina-2026-10-12/). Every row carried only
 * `id/object/created/owned_by` — **0 of 19 publish a window field** — so this
 * checked-in set is the source of truth and the exact-id windows live in the
 * context-window-table-tiarina seam (cross-gateway consensus; the chatanywhere
 * precedent). The gateway serves bare upstream ids and the `:free` /
 * `:cloudflare` suffixed ids are separate roster entries, not aliases.
 * The vendor's "Anthropic compatible" claim is refuted on the wire (keyed
 * POST /v1/messages -> 404), so no Anthropic-shaped id is catalogued here.
 */
export const tiarinaModels = {
  tiarina_deepseek_v4_1_flash: 'tiarina/deepseek-v4.1-flash',
  tiarina_deepseek_v4_1_flash_free: 'tiarina/deepseek-v4.1-flash:free',
  tiarina_deepseek_v4_flash_free: 'tiarina/deepseek-v4-flash:free',
  tiarina_deepseek_v4_pro: 'tiarina/deepseek-v4-pro',
  tiarina_deepseek_v4_pro_cloudflare: 'tiarina/deepseek-v4-pro:cloudflare',
  tiarina_kimi_k3: 'tiarina/kimi-k3',
  tiarina_kimi_k2_7_code: 'tiarina/kimi-k2.7-code',
  tiarina_kimi_k2_6: 'tiarina/kimi-k2.6',
  tiarina_glm_5_3: 'tiarina/glm-5.3',
  tiarina_glm_5_3_cloudflare: 'tiarina/glm-5.3:cloudflare',
  tiarina_glm_5_3_flash_free: 'tiarina/glm-5.3-flash:free',
  tiarina_glm_5_2: 'tiarina/glm-5.2',
  tiarina_glm_4_7_flash: 'tiarina/glm-4.7-flash',
  tiarina_qwen3_8_flash: 'tiarina/qwen3.8-flash',
  tiarina_qwen3_8_flash_free: 'tiarina/qwen3.8-flash:free',
  tiarina_qwen3_7_plus: 'tiarina/qwen3.7-plus',
  tiarina_qwen3_8_max: 'tiarina/qwen3.8-max',
  tiarina_mimo_v2_6_flash_free: 'tiarina/mimo-v2.6-flash:free',
  tiarina_gpt_oss_120b: 'tiarina/gpt-oss-120b',
} as const
export type TiarinaModel = (typeof tiarinaModels)[keyof typeof tiarinaModels]

/**
 * MarsAI free-tier catalog (FID-2026-1016-004) — the 14 ids from the
 * operator dashboard census 2026-10-16 (console-verified; see the registry
 * entry). STATIC by design: the vendor's /v1/models could not be probed
 * from this network (DNS hijack + TLS reset; DoH records 104.21.63.63 /
 * 172.67.143.237). `marsai/` is part of the real vendor slug — every
 * Model ID on the dashboard carries it — so dispatch keeps the full id
 * (`idTransform: 'keep'`, the openrouter shape). Windows live in
 * context-window-table-marsai.ts (10 sourced rows, 4 documented no-row).
 */
export const marsaiModels = {
  marsai_auto_free: 'marsai/auto-free',
  marsai_cat_jam_free: 'marsai/cat-jam-free',
  marsai_deepseek_v4_1_flash_free: 'marsai/deepseek-v4.1-flash-free',
  marsai_laguna_xs_2_1_free: 'marsai/laguna-xs-2.1-free',
  marsai_meta_llama_3_3_70b_instruct_free:
    'marsai/Meta-Llama-3_3-70B-Instruct-free',
  marsai_mimo_v2_6_flash_free: 'marsai/mimo-v2.6-flash-free',
  marsai_minimax_m2_7_free: 'marsai/MiniMax-M2.7-free',
  marsai_muse_spark_1_3_free: 'marsai/muse-spark-1.3-free',
  marsai_nemotron_3_super_120b_a12b_free:
    'marsai/nemotron-3-super-120b-a12b:free',
  marsai_nemotron_3_ultra_free: 'marsai/nemotron-3-ultra-free',
  marsai_north_mini_code_free: 'marsai/north-mini-code:free',
  marsai_qwen3_6_27b_free: 'marsai/Qwen3.6-27B-free',
  marsai_qwen3_8_27b_free: 'marsai/Qwen3.8-27B-free',
  marsai_step_5_preview_free: 'marsai/step-5-preview-free',
} as const
export type MarsaiModel = (typeof marsaiModels)[keyof typeof marsaiModels]
