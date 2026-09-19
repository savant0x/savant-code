/**
 * Vendor-published context-window fallback table — move-only seam split
 * from `context-windows.ts` (FID-2026-0919-019 loop record: the kiosapi
 * rows pushed the module over the 300-line quality ceiling; the resolver
 * helpers stay in `context-windows.ts`, which re-exports this table).
 *
 * Exact model-id → window, per audited/curated gateway catalog. Sources:
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
  ['hcnsec/DeepSeek-V4-Flash', 1_310_720], // route-keyed: hcnsec serves 1,310,720 though upstream capability is 1,048,576 (live audit 2026-09-19, FID-2026-0919-020) — lowering would artificially restrict the route
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
  // FID-2026-0919-020 live audit 2026-09-19: OpenRouter capability
  // values (top-level context_length) corrected for 17 stale rows below.
  // Serving-limit caveats inline where providers under-serve capability.
  ['infron/deepseek/deepseek-v4-flash:free', 1_048_576],
  ['infron/deepseek/deepseek-v4-flash-0731:free', 1_310_720], // live capability 1,310,720 (was 1M; providers serve 1,048,576)
  ['infron/qwen/qwen3.8-27b:free', 1_000_000], // capability 1M (was 256K); providers serve 262,144
  ['infron/nvidia/nemotron-3.5-lightning-30b-a3b:free', 1_048_576], // gateway-roster-verified 2026-09-19
  ['infron/kwaipilot/kat-coder-pro-v2', 262_144],
  ['infron/moonshotai/kimi-k2.7-code', 262_144],
  ['infron/qwen/qwen3-coder-next', 262_144],
  ['infron/google/gemini-3.1-pro-preview', 1_048_576],
  ['infron/z-ai/glm-5.3-flash', 1_310_720], // live capability (was 1M)
  // --- unorouter (FID-2026-0914-001) ---
  ['unorouter/glm-5.3-flash:free', 1_310_720], // live capability (was 1M)
  ['unorouter/deepseek-v4-flash:free', 1_048_576], // live capability (was 1M)
  ['unorouter/gemini-3.6-flash:free', 1_048_576], // live capability (was 1M)
  ['unorouter/gpt-oss-120b:free', 131_072],
  ['unorouter/qwen3.6-35b-a3b:free', 262_144],
  ['unorouter/qwen3.8-27b:free', 1_000_000], // capability 1M (was 65,536); providers serve 262,144
  ['unorouter/step-3.7-flash:free', 262_144],
  ['unorouter/codestral-latest:free', 256_000], // gateway-roster-verified 2026-09-19
  ['unorouter/north-mini-code:free', 256_000], // gateway-roster-verified 2026-09-19 (Cohere docs: 256K)
  ['unorouter/seed-oss-36b:free', 524_288], // gateway-roster-verified 2026-09-19
  ['unorouter/dots-3-note-preview:free', 512_000], // gateway-roster-verified 2026-09-19
  ['unorouter/intern-s2-preview:free', 262_144], // INERT: dropped from unorouter roster (2026-09-19 audit); upstream HF: 262,144
  ['unorouter/claude-fable-5.1', 1_000_000],
  ['unorouter/gpt-5.5', 1_050_000], // corrected DOWN to live capability (was 1.1M over-allocation)
  ['unorouter/gpt-6-astra', 1_050_000], // corrected DOWN to live capability (was 1.1M over-allocation)
  ['unorouter/claude-opus-4.8', 1_000_000],
  ['unorouter/deepseek-v4-pro', 1_048_576], // live capability (was 1M)
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
  ['commandcode/zai-org/glm-5.3', 1_310_720], // live capability 2026-09-19 (was 1,048,576)
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
  ['commandcode/Qwen/Qwen3.8-27B', 1_000_000], // capability 1M (was 262,144); providers serve 262,144
  ['commandcode/Qwen/Qwen3.7-Max', 1_000_000],
  ['commandcode/Qwen/Qwen3.7-Plus', 1_000_000],
  ['commandcode/Qwen/Qwen3.7-Flash', 1_000_000],
  ['commandcode/poolside/laguna-s-2.1-free', 1_048_576],
  ['commandcode/inclusionai/ling-3.0-flash-sante:free', 262_144],
  ['commandcode/meituan/LongCat-2.0:free', 1_048_756], // live 2026-09-19 (was 1,048,576 — vendor's odd 1,048,756)
  // --- kiosapi (FID-2026-0919-019: live-roster sweep found 8/19 ids on the
  // 200k default; six vendor-published windows researched 2026-09-19) ---
  // Vendor wiki "512K" (deprecated model, page kept live). NEEDS-REVIEW:
  // AgnesAI GitHub README claims "256K after the June 2026 rollback"; the
  // live vendor wiki outranks the stale README.
  ['kiosapi/agnes-2.0-flash', 524_288],
  // Vendor wiki "512K" (GA model).
  ['kiosapi/agnes-2.5-flash', 524_288],
  // Vendor wiki full spec page "512K"; max output 65,536 confirms the
  // binary-K convention. The 262,144 in third-party posts is the
  // open-weight Preview checkpoint, NOT this production/API model.
  ['kiosapi/agnes-3.0-flash', 524_288],
  // Upstream window vendor-published in FID-2026-0916-005
  // (atria/Atria-Dawn-Preview); kiosapi is a second gateway for it.
  ['kiosapi/atria-dawn-preview', 262_144],
  // xKiro spec sheet "262K" (the "256K" secondary source is the same value
  // rounded).
  ['kiosapi/sensenova-6.8-flash-lite', 262_144],
  // NVIDIA model card "256K token context window"; vLLM recipe pins
  // --max-model-len 262144.
  ['kiosapi/diffusiongemma-26b-a4b-it', 262_144],
  // kiosapi/big-pickle: deliberately NO row — stealth Zen model with no
  // vendor spec; the only aggregator value (200K) equals the default.
])
