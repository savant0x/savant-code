/**
 * KiosAPI fallback-table rows — seam split from `context-window-table.ts`
 * (FID-2026-1003-008: the full 77-model Model Square roster pushed the
 * parent module over the 300-line quality ceiling; same move-only pattern
 * as the FID-2026-0919-019 split that created the parent table).
 *
 * KiosAPI publishes NO window fields on /v1/models (fields observed
 * 2026-10-03: id, created, object, owned_by, supported_endpoint_types), so
 * every row below is sourced from the upstream capability via the
 * OpenRouter public catalog (live probe 2026-10-03, FID-2026-1003-008),
 * cross-voted against existing rows for the same upstream model on other
 * gateways. Row-value rule: 2-of-3 vendor consensus where 2+ sources
 * publish; the single source where one does; conservative minimum on a 1:1
 * conflict; `-req` per-call variants inherit their parent model's window.
 *
 * Deliberately NO row (all resolve to the conservative 200k default):
 * - big-pickle / fledge-alpha / kilo-auto: stealth ids, no vendor spec,
 *   no aggregator value above the default (big-pickle precedent retained).
 * - longcat-2.5-preview: no upstream listing (commandcode's LongCat-2.0 row
 *   is a different model).
 * - gpt-image-2 / gpt-image-2.5 / -flare / -sunburst: image-generation
 *   models, not chat-completion ids — no context window semantics.
 * - grok-imagine-image / grok-imagine-image-edit /
 *   grok-imagine-image-quality / grok-imagine-image-2.0: image-generation
 *   models — deliberately non-applicable, no context window semantics.
 * - openrouter/free: router id, no single model context window —
 *   deliberately non-applicable (FID-2026-1008-001 closure, 2026-10-08).
 */
export const KIOSAPI_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- AgnesAI (vendor wiki "512K", FID-2026-0919-019; kept) ---
  ['kiosapi/agnes-2.0-flash', 524_288],
  ['kiosapi/agnes-2.5-flash', 524_288],
  ['kiosapi/agnes-3.0-flash', 524_288],
  // --- atria / sensenova / nvidia (vendor specs, FID-2026-0919-019; kept) ---
  ['kiosapi/atria-dawn-preview', 262_144],
  ['kiosapi/sensenova-6.8-flash-lite', 262_144],
  ['kiosapi/diffusiongemma-26b-a4b-it', 262_144],
  // --- OpenAI Codex family (OR-live 1,050,000; matches tokenbom/unorouter/
  // tokenharbor/commandcode rows for the same upstreams) ---
  ['kiosapi/gpt-5.5', 1_050_000],
  ['kiosapi/gpt-5.6-luna', 1_050_000],
  ['kiosapi/gpt-5.6-sol', 1_050_000],
  ['kiosapi/gpt-5.6-terra', 1_050_000],
  ['kiosapi/gpt-6-astra', 1_050_000],
  ['kiosapi/gpt-6-sol', 1_050_000],
  ['kiosapi/gpt-6.1-sol', 1_050_000],
  // --- Anthropic Claude family (OR-live 1,000,000; matches bazaarlink/
  // tokenrouter/commandcode rows) ---
  ['kiosapi/claude-fable-5', 1_000_000],
  ['kiosapi/claude-fable-5-1', 1_000_000],
  ['kiosapi/claude-opus-4-6', 1_000_000],
  ['kiosapi/claude-opus-4-7', 1_000_000],
  ['kiosapi/claude-opus-4-8', 1_000_000],
  // Per-call variant inherits claude-opus-4-8.
  ['kiosapi/claude-opus-4-8-req', 1_000_000],
  ['kiosapi/claude-opus-5', 1_000_000],
  ['kiosapi/claude-opus-5-5', 1_000_000],
  ['kiosapi/claude-sonnet-4-6', 1_000_000],
  ['kiosapi/claude-sonnet-5', 1_000_000],
  ['kiosapi/claude-sonnet-5-5', 1_000_000],
  // --- Google Gemini family (OR-live 1,048,576; gemini-3.1-pro-preview also
  // matches tokenrouter + infron rows) ---
  ['kiosapi/gemini-2.5-flash', 1_048_576],
  // NEEDS-REVIEW: no OpenRouter listing; family inference from the
  // uniform 1,048,576 of gemini-2.5/3.5/3.6/3.7/3.8-flash (hcnsec
  // Qwen3.8-Flash-Next precedent).
  ['kiosapi/gemini-3-flash', 1_048_576],
  ['kiosapi/gemini-3.1-pro-preview', 1_048_576],
  ['kiosapi/gemini-3.5-flash', 1_048_576],
  ['kiosapi/gemini-3.6-flash', 1_048_576],
  ['kiosapi/gemini-3.7-flash', 1_048_576],
  ['kiosapi/gemini-3.8-flash', 1_048_576],
  // --- Z.AI GLM family. OR-live 2026-10-03 reads glm-5.2 1,048,576
  // (agrees with the tokenrouter/tokenharbor 2-of-3) and glm-5.3
  // 1,048,576 / glm-5.3-flash 1,048,575 — a DOWNWARD drift from the
  // 1,310,720 OR published 2026-09-28 (FID-2026-0928-010 record) and from
  // the infron/unorouter glm-5.3-flash rows (1,310,720). Pinned at the
  // conservative live reading; re-derive if the vendors re-publish.
  ['kiosapi/glm-5.2', 1_048_576],
  ['kiosapi/glm-5.3', 1_048_576],
  ['kiosapi/glm-5.3-flash', 1_048_575],
  ['kiosapi/glm-5.3-flash-free', 1_048_575],
  // Per-call variant inherits glm-5.3-flash.
  ['kiosapi/glm-5.3-flash-req', 1_048_575],
  ['kiosapi/glm-5.3-free', 1_048_576],
  // --- DeepSeek family (OR-live 1,048,576; matches tokenrouter/commandcode/
  // hcnsec rows). deepseek-v4-pro: 2-of-3 vote 1,048,576 (tokenrouter +
  // commandcode) over OR-live 1,024,000. ---
  ['kiosapi/deepseek-v4-flash', 1_048_576],
  ['kiosapi/deepseek-v4-flash-free', 1_048_576],
  ['kiosapi/deepseek-v4-flash-vision-exp-free', 1_048_576],
  ['kiosapi/deepseek-v4-pro', 1_048_576],
  ['kiosapi/deepseek-v4.1-flash', 1_048_576],
  ['kiosapi/deepseek-v4.1-flash-free', 1_048_576],
  // Per-call variant inherits deepseek-v4.1-flash.
  ['kiosapi/deepseek-v4.1-flash-req', 1_048_576],
  // --- xAI Grok family (OR-live 500,000; matches tokenharbor/commandcode
  // rows) ---
  ['kiosapi/grok-4.5', 500_000],
  ['kiosapi/grok-4.5-free', 500_000],
  ['kiosapi/grok-4.6', 500_000],
  ['kiosapi/grok-4.7', 500_000],
  ['kiosapi/grok-4.7-free', 500_000],
  // --- Qwen (THE operator-reported bug row: qwen3.8-flash-free resolved to
  // the 200k default while the model serves 1M — the failed session hit
  // RequestInputBudgetError with its history steered by the 5x-small
  // denominator). OR-live qwen/qwen3.8-flash = 1,000,000; operator-stated
  // 1M. qwen3.8-27b-free matches the infron/unorouter/commandcode :free
  // rows (capability 1,000,000; providers serve 262,144). ---
  ['kiosapi/qwen3.8-27b-free', 1_000_000],
  ['kiosapi/qwen3.8-flash-free', 1_000_000],
  // --- Moonshot / Xiaomi / Meta / StepFun / Cohere / Dots (OR-live; several
  // cross-voted) ---
  ['kiosapi/kimi-k3-free', 1_048_576],
  // mimo-v2.5: 1:1 conflict (tokenharbor 1,050,000 vs OR-live 1,048,576) —
  // conservative minimum pinned.
  ['kiosapi/mimo-v2.5', 1_048_576],
  ['kiosapi/mimo-v2.6-flash', 1_048_576],
  ['kiosapi/muse-spark-1.2-contributor', 1_048_576],
  ['kiosapi/muse-spark-1.3-contributor', 1_048_576],
  // step-3.7-flash: 2-of-3 vote 262,144 (hcnsec + unorouter) over OR-live
  // 256,000.
  ['kiosapi/step-3.7-flash', 262_144],
  ['kiosapi/north-mini-code', 256_000],
  ['kiosapi/dots-3-note-preview', 512_000],
  // --- Poolside (OR-live: paid laguna-s-2.1 1,048,576, matching the
  // commandcode laguna-s-2.1-free row; its :free variant serves 262,144 —
  // kiosapi's id is the bare/paid variant. laguna-xs: 262,144 both.) ---
  ['kiosapi/laguna-s-2.1', 1_048_576],
  ['kiosapi/laguna-xs-2.1', 262_144],
  // --- AntGroup / Liquid / Apodex / Nvidia nemotron / OpenCode stealth ---
  ['kiosapi/ling-3.0-flash-sante', 262_144],
  ['kiosapi/ling-3.1-flash', 262_144],
  ['kiosapi/lfm-2.5-2.6b', 65_536],
  ['kiosapi/apodex-1.1-mini', 262_144],
  // nemotron bare ids map to the PAID OR listings (262,144); the inverted
  // :free listings (1,000,000) are NOT the ids kiosapi serves.
  ['kiosapi/nemotron-3-super-120b-a12b', 262_144],
  ['kiosapi/nemotron-3-ultra-550b-a55b', 262_144],
  ['kiosapi/nemotron-3.5-lightning', 262_144],
  // OR-live stealth/space-bunny-alpha = 1,000,000.
  ['kiosapi/space-bunny-alpha', 1_000_000],
]
