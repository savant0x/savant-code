/**
 * TokenHarbor model IDs published on https://tokenharbor.ai/models.
 * Keep the internal provider prefix so direct routing strips exactly one
 * `tokenharbor/` segment and preserves upstream suffixes such as `:free`.
 *
 * FID-2026-1010-001 live re-alignment (authenticated `/v1/models` probe,
 * 2026-10-10, HTTP 200, 68 rows). The id order below is the vendor's own
 * roster order, so refreshing this snapshot is a literal re-copy of the
 * endpoint's `data[].id` sequence. 52 ids added, `th-orchestra` removed
 * (absent from the callable roster), `gemini-3.6-flash` re-added (removed
 * as roster-absent by FID-2026-0916-004, callable again).
 *
 * Supersedes the FID-2026-0916-004 17-id snapshot, which removed
 * `gemini-3.6-flash` + `minimax-m3` (absent from the live roster) and
 * `kimi-k3:free` (the Kimi K3 launch event ended — the vendor's own 429
 * confirms the free channel no longer serves; `kimi-k3:free` remains
 * absent from the 2026-10-10 roster).
 * Move-only split for FID-2026-1010-002's repository quality gate.
 */
export const tokenharborModels = {
  tokenharbor_claude_sonnet_4_6: 'tokenharbor/claude-sonnet-4.6',
  tokenharbor_claude_opus_5_5: 'tokenharbor/claude-opus-5.5',
  tokenharbor_claude_opus_5: 'tokenharbor/claude-opus-5',
  tokenharbor_claude_sonnet_5: 'tokenharbor/claude-sonnet-5',
  tokenharbor_grok_4_6: 'tokenharbor/grok-4.6',
  tokenharbor_kimi_k3: 'tokenharbor/kimi-k3',
  tokenharbor_glm_5_3: 'tokenharbor/glm-5.3',
  tokenharbor_kimi_k2_6: 'tokenharbor/kimi-k2.6',
  tokenharbor_mimo_v2_5_pro: 'tokenharbor/mimo-v2.5-pro',
  tokenharbor_mimo_v2_5: 'tokenharbor/mimo-v2.5',
  tokenharbor_gemini_3_8_flash: 'tokenharbor/gemini-3.8-flash',
  tokenharbor_deepseek_v4_flash: 'tokenharbor/deepseek-v4-flash',
  tokenharbor_claude_fable_5_1: 'tokenharbor/claude-fable-5.1',
  tokenharbor_qwen3_7_max: 'tokenharbor/qwen3.7-max',
  tokenharbor_glm_5_1: 'tokenharbor/glm-5.1',
  tokenharbor_deepseek_v4_pro: 'tokenharbor/deepseek-v4-pro',
  tokenharbor_claude_fable_5: 'tokenharbor/claude-fable-5',
  tokenharbor_claude_opus_4_8: 'tokenharbor/claude-opus-4.8',
  tokenharbor_gpt_5_5: 'tokenharbor/gpt-5.5',
  tokenharbor_qwen3_8_max: 'tokenharbor/qwen3.8-max',
  tokenharbor_glm_5_3_flash: 'tokenharbor/glm-5.3-flash',
  tokenharbor_mimo_v2_6_pro: 'tokenharbor/mimo-v2.6-pro',
  tokenharbor_claude_sonnet_5_5: 'tokenharbor/claude-sonnet-5.5',
  tokenharbor_gpt_6_luna: 'tokenharbor/gpt-6-luna',
  tokenharbor_mistral_large_2512: 'tokenharbor/mistral-large-2512',
  tokenharbor_gemini_3_7_flash: 'tokenharbor/gemini-3.7-flash',
  tokenharbor_grok_4_5: 'tokenharbor/grok-4.5',
  tokenharbor_muse_spark_1_2: 'tokenharbor/muse-spark-1.2',
  tokenharbor_gpt_6_astra: 'tokenharbor/gpt-6-astra',
  tokenharbor_muse_spark_1_3: 'tokenharbor/muse-spark-1-3',
  tokenharbor_deepseek_v4_1_flash: 'tokenharbor/deepseek-v4.1-flash',
  tokenharbor_gemini_3_6_flash: 'tokenharbor/gemini-3.6-flash',
  tokenharbor_glm_5_2: 'tokenharbor/glm-5.2',
  tokenharbor_gpt_5_6_luna: 'tokenharbor/gpt-5.6-luna',
  tokenharbor_gpt_5_6_sol: 'tokenharbor/gpt-5.6-sol',
  tokenharbor_gpt_5_6_terra: 'tokenharbor/gpt-5.6-terra',
  tokenharbor_muse_spark_1_1: 'tokenharbor/muse-spark-1.1',
  tokenharbor_qwen3_6_27b: 'tokenharbor/qwen3.6-27b',
  tokenharbor_qwen3_6_flash: 'tokenharbor/qwen3.6-flash',
  tokenharbor_deepseek_v3_2: 'tokenharbor/deepseek-v3.2',
  tokenharbor_qwen3_5_27b: 'tokenharbor/qwen3.5-27b',
  tokenharbor_qwen3_7_flash: 'tokenharbor/qwen3.7-flash',
  tokenharbor_qwen3_8_27b: 'tokenharbor/qwen3.8-27b',
  tokenharbor_qwen3_8_flash: 'tokenharbor/qwen3.8-flash',
  tokenharbor_claude_opus_5_fast: 'tokenharbor/claude-opus-5-fast',
  tokenharbor_kimi_k3_fast: 'tokenharbor/kimi-k3-fast',
  tokenharbor_gpt_5_6_luna_fast: 'tokenharbor/gpt-5.6-luna-fast',
  tokenharbor_gpt_5_6_sol_fast: 'tokenharbor/gpt-5.6-sol-fast',
  tokenharbor_gpt_5_6_terra_fast: 'tokenharbor/gpt-5.6-terra-fast',
  tokenharbor_gpt_6_astra_fast: 'tokenharbor/gpt-6-astra-fast',
  tokenharbor_glm_5_3_fast: 'tokenharbor/glm-5.3-fast',
  tokenharbor_glm_5_3_flashx: 'tokenharbor/glm-5.3-flashx',
  tokenharbor_grok_4_7: 'tokenharbor/grok-4.7',
  tokenharbor_mimo_v2_6_flash: 'tokenharbor/mimo-v2.6-flash',
  tokenharbor_claude_opus_5_5_fast: 'tokenharbor/claude-opus-5.5-fast',
  tokenharbor_gpt_6_luna_fast: 'tokenharbor/gpt-6-luna-fast',
  tokenharbor_gpt_6_sol: 'tokenharbor/gpt-6-sol',
  tokenharbor_gpt_6_sol_fast: 'tokenharbor/gpt-6-sol-fast',
  tokenharbor_gpt_6_1_sol: 'tokenharbor/gpt-6.1-sol',
  tokenharbor_gpt_6_1_sol_fast: 'tokenharbor/gpt-6.1-sol-fast',
  tokenharbor_mistral_large_4: 'tokenharbor/mistral-large-4',
  tokenharbor_claude_haiku_5_5: 'tokenharbor/claude-haiku-5.5',
  tokenharbor_apex: 'tokenharbor/apex',
  tokenharbor_mimo_v2_5_free: 'tokenharbor/mimo-v2.5:free',
  tokenharbor_deepseek_v4_flash_free: 'tokenharbor/deepseek-v4-flash:free',
  tokenharbor_deepseek_v4_1_flash_free: 'tokenharbor/deepseek-v4.1-flash:free',
  tokenharbor_mimo_v2_6_flash_free: 'tokenharbor/mimo-v2.6-flash:free',
  tokenharbor_claude_haiku_5_5_free: 'tokenharbor/claude-haiku-5.5:free',
} as const
export type TokenHarborModel =
  (typeof tokenharborModels)[keyof typeof tokenharborModels]
