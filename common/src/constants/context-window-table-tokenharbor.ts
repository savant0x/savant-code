/**
 * TokenHarbor fallback rows (FID-2026-1010-001 live realignment).
 * Move-only split for FID-2026-1010-002's repository quality gate.
 * Source rule: the vendor's own authenticated `/v1/models` publication is
 * binding (68-row probe, HTTP 200). The vendor publishes `context_length`
 * for 51 of 68 ids; the 17 it returns `null` for fall back to a
 * cross-gateway row from this same table, marked inline. Three ids have no
 * corroboration anywhere and take the table's documented conservative-pin
 * precedent (NEEDS-REVIEW) rather than a family guess. `th-orchestra` was
 * removed with the dead id; six retained rows were re-sourced DOWN to the
 * vendor's own advertisement (deepseek-v4-flash, deepseek-v4-flash:free,
 * glm-5.2, mimo-v2.5-pro, mimo-v2.5, mimo-v2.5:free) — strictly
 * conservative, never an over-allocation.
 */
export const TOKENHARBOR_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  ['tokenharbor/claude-sonnet-4.6', 1_000_000], // cross-vote: commandcode/claude-sonnet-4-6
  ['tokenharbor/claude-opus-5.5', 1_000_000],
  ['tokenharbor/claude-opus-5', 1_000_000],
  ['tokenharbor/claude-sonnet-5', 1_000_000],
  ['tokenharbor/grok-4.6', 500_000],
  ['tokenharbor/kimi-k3', 1_048_576],
  ['tokenharbor/glm-5.3', 200_000],
  ['tokenharbor/kimi-k2.6', 262_144],
  ['tokenharbor/mimo-v2.5-pro', 1_048_576], // vendor-published (was 1,050,000)
  ['tokenharbor/mimo-v2.5', 1_048_576], // vendor-published (was 1,050,000)
  ['tokenharbor/gemini-3.8-flash', 1_000_000],
  ['tokenharbor/deepseek-v4-flash', 1_000_000], // vendor-published (was 1,048,576; the operator-reported 131k bug)
  ['tokenharbor/claude-fable-5.1', 1_000_000],
  ['tokenharbor/qwen3.7-max', 1_000_000], // cross-vote: commandcode/Qwen/Qwen3.7-Max
  ['tokenharbor/glm-5.1', 204_800], // cross-vote: tokenrouter/z-ai/glm-5.1 (2-of-3)
  ['tokenharbor/deepseek-v4-pro', 1_048_576],
  ['tokenharbor/claude-fable-5', 1_000_000],
  ['tokenharbor/claude-opus-4.8', 1_000_000], // cross-vote: tokenrouter/anthropic/claude-opus-4.8
  ['tokenharbor/gpt-5.5', 1_050_000], // cross-vote: tokenrouter/openai/gpt-5.5
  ['tokenharbor/qwen3.8-max', 1_000_000],
  ['tokenharbor/glm-5.3-flash', 1_000_000],
  ['tokenharbor/mimo-v2.6-pro', 1_048_576],
  ['tokenharbor/claude-sonnet-5.5', 1_000_000],
  ['tokenharbor/gpt-6-luna', 1_050_000], // cross-vote: apinex + bai + chatanywhere consensus
  ['tokenharbor/mistral-large-2512', 524_288],
  ['tokenharbor/gemini-3.7-flash', 1_048_576],
  ['tokenharbor/grok-4.5', 500_000],
  ['tokenharbor/muse-spark-1.2', 1_048_576],
  ['tokenharbor/gpt-6-astra', 1_050_000],
  ['tokenharbor/muse-spark-1-3', 1_048_576],
  ['tokenharbor/deepseek-v4.1-flash', 1_048_576],
  ['tokenharbor/gemini-3.6-flash', 1_000_000],
  ['tokenharbor/glm-5.2', 1_000_000], // vendor-published (was 1,048,576, a 2-of-3 cross-vendor vote)
  ['tokenharbor/gpt-5.6-luna', 1_050_000],
  ['tokenharbor/gpt-5.6-sol', 1_050_000],
  ['tokenharbor/gpt-5.6-terra', 1_050_000],
  ['tokenharbor/muse-spark-1.1', 1_048_576],
  ['tokenharbor/qwen3.6-27b', 200_000], // NEEDS-REVIEW: no vendor window and no cross-gateway row; conservative pin
  ['tokenharbor/qwen3.6-flash', 200_000], // NEEDS-REVIEW: no vendor window and no cross-gateway row; conservative pin
  ['tokenharbor/deepseek-v3.2', 163_840], // cross-vote: tokenrouter/deepseek/deepseek-v3.2
  ['tokenharbor/qwen3.5-27b', 200_000], // NEEDS-REVIEW: no vendor window and no cross-gateway row; conservative pin
  ['tokenharbor/qwen3.7-flash', 1_000_000], // cross-vote: commandcode/Qwen/Qwen3.7-Flash
  ['tokenharbor/qwen3.8-27b', 991_808],
  ['tokenharbor/qwen3.8-flash', 983_616],
  ['tokenharbor/claude-opus-5-fast', 1_000_000],
  ['tokenharbor/kimi-k3-fast', 1_000_000],
  ['tokenharbor/gpt-5.6-luna-fast', 1_050_000],
  ['tokenharbor/gpt-5.6-sol-fast', 1_050_000],
  ['tokenharbor/gpt-5.6-terra-fast', 1_050_000],
  ['tokenharbor/gpt-6-astra-fast', 1_050_000],
  ['tokenharbor/glm-5.3-fast', 1_048_576],
  ['tokenharbor/glm-5.3-flashx', 1_000_000],
  ['tokenharbor/grok-4.7', 500_000], // cross-vote: kiosapi/grok-4.7
  ['tokenharbor/mimo-v2.6-flash', 1_048_576],
  ['tokenharbor/claude-opus-5.5-fast', 1_000_000],
  ['tokenharbor/gpt-6-luna-fast', 1_050_000],
  ['tokenharbor/gpt-6-sol', 1_050_000],
  ['tokenharbor/gpt-6-sol-fast', 1_050_000],
  ['tokenharbor/gpt-6.1-sol', 1_050_000],
  ['tokenharbor/gpt-6.1-sol-fast', 1_050_000],
  ['tokenharbor/mistral-large-4', 524_288],
  ['tokenharbor/claude-haiku-5.5', 1_000_000],
  ['tokenharbor/apex', 262_144],
  ['tokenharbor/mimo-v2.5:free', 1_048_576], // vendor-published (was 1,050,000)
  ['tokenharbor/deepseek-v4-flash:free', 1_000_000], // vendor-published (was 1,048,576)
  ['tokenharbor/deepseek-v4.1-flash:free', 1_048_576],
  ['tokenharbor/mimo-v2.6-flash:free', 1_048_576],
  ['tokenharbor/claude-haiku-5.5:free', 1_000_000],
]
