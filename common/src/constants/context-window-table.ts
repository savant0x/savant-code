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
import { APINEX_CONTEXT_WINDOW_FALLBACKS } from './context-window-table-apinex'
import { BAI_CONTEXT_WINDOW_FALLBACKS } from './context-window-table-bai'
import { CHATANYWHERE_CONTEXT_WINDOW_FALLBACKS } from './context-window-table-chatanywhere'
import { KIOSAPI_CONTEXT_WINDOW_FALLBACKS } from './context-window-table-kiosapi'
import { TIARINA_CONTEXT_WINDOW_FALLBACKS } from './context-window-table-tiarina'
import { TOKENHARBOR_CONTEXT_WINDOW_FALLBACKS } from './context-window-table-tokenharbor'

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
  // --- intern (FID-2026-1004-008: 10-model static catalog; windows are the
  // vendor's OWN authenticated /v1/models publication, read from
  // input_modalities[].supported_inputs.max_context_length.value on the LIVE
  // probe 2026-10-04 — NOT the family heuristic and NOT the `atria` twin's
  // values). NOTE the deliberate divergence: intern/Atria-Dawn-Preview is
  // 524,288 here while atria/Atria-Dawn-Preview is 262,144 — two different
  // deployments of the same upstream model. ---
  ['intern/Agents-A1', 262_144],
  ['intern/Atria-Dawn-Preview', 524_288],
  ['intern/deepseek-v4-flash-0731', 1_048_576],
  ['intern/deepseek-v4-flash-vision', 1_048_576],
  ['intern/deepseek-v4-pro-0813', 1_048_576],
  ['intern/glm-5.3', 1_048_576],
  ['intern/intern-s2', 262_144],
  ['intern/kimi-k2.6', 262_144],
  ['intern/minimax-m3', 1_048_576],
  ['intern/qwen3.8-27b', 262_144],
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
  // --- tokenharbor: move-only split (FID-2026-1010-002) ---
  ...TOKENHARBOR_CONTEXT_WINDOW_FALLBACKS,
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
  // FID-2026-0928-010: rows re-keyed to the live roster casing and
  // re-sourced to the gateway's own publication — the commandcode roster
  // publishes context_length per id, both GLM rows advertise 1,000,000
  // (keyless probe 2026-09-28). Upstream votes for the record: glm-5.2
  // 1,048,576 (2-of-3), glm-5.3 1,310,720 (OpenRouter 2026-09-28). A
  // gateway proxies at most the upstream window, so the gateway's own
  // advertisement is binding and the correction is strictly conservative.
  ['commandcode/zai-org/GLM-5.2', 1_000_000],
  ['commandcode/zai-org/GLM-5.3', 1_000_000],
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
  // --- orcarouter + nvidia chat-surface gap subsets (FID-2026-1004-002:
  // operator-ruled cross-gateway sourcing; both gateways publish windows for
  // most of their rows — these are only the silent-gap chat ids).
  // Deliberately NO row for the remaining silent ids, grouped:
  // - orcarouter non-chat (no context-window semantics): gemini-2.5/-3.8-*-tts,
  //   gpt-4o-mini-tts *, tts-1 *, gemini-embedding *, text-embedding-3 *,
  //   text-embedding-ada-002, imagen-4.0 *, gpt-image-1/-1-mini/-1.5/-2,
  //   kling-v2/v2-1/v2-5/v2-6/v3/v3-omni/video-o1, grok-imagine-image,
  //   gemini-robotics-er-1.6-preview, orca/dub, orcaverify-text1.0(+ -free),
  //   gpt-5-search-api (+ dated).
  // - orcarouter rolling `-latest` aliases (the window follows the target
  //   model — pinning would go stale): gemini-flash-latest,
  //   gemini-flash-lite-latest, gemini-pro-latest, gpt-5-chat-latest,
  //   gpt-5.1-chat-latest, gpt-5.2-chat-latest.
  // - orcarouter no cross-gateway row: gemini-3.1-flash-lite, gemma-4-31b-it,
  //   minimax-h3, qwen3-vl-235b-a22b-instruct, hy3-free, hy4-preview-free,
  //   gpt-3.5-turbo-0125/1106, gpt-4-0613, gpt-5.4-mini/nano (dated),
  //   orcarouter/free (stealth), codex-auto-review.
  // - vercel (23 silent ids): all non-chat voice/tts/transcribe
  //   (fish-audio s1/s2*, mai-voice/mai-transcribe *, gemini-*-tts,
  //   gpt-4o-*-transcribe, gpt-realtime-whisper, tts-1 *, whisper-1,
  //   grok-stt/grok-tts) — no context-window semantics for this surface.
  // - nvidia non-chat: embed-qa/nv-embedqa/nemotron-3-embed *,
  //   llama-3.2-nemoretriever/vlm-embed, nemoguard */content-safety/
  //   topic-control/safety-guard, nemotron-4-340b-reward, riva-translate *,
  //   nemotron-parse *, nvclip, deplot, kosmos-2, neva-22b, vila,
  //   muse-glimmer, ai-synthetic-video-detector, diffusiongemma,
  //   ising-calibration, arctic-embed.
  // - nvidia legacy chat / no cross-gateway row: yi-large, fuyu-8b,
  //   jamba-1.5-large, sea-lion-7b, starcoder2-15b, dbrx-instruct,
  //   deepseek-coder-6.7b, codegemma-1.1-7b/7b, gemma-2b/3-12b/3-4b/4-31b,
  //   recurrentgemma-2b, granite-3.0-3b/8b + granite-34b/8b-code,
  //   codellama-70b, llama-3.2-*-vision, llama-guard-4-12b, llama2-70b,
  //   phi-3-vision, phi-3.5-moe, codestral-22b, mistral-7b/large/large-2,
  //   mixtral-8x22b, nemotron-4-340b-instruct, nemotron-nano-3-30b,
  //   nemotron-3-nano-omni, llama3-chatqa-1.5-70b, mistral-nemo
  //   (-minitron), gpt-oss-20b, palmyra-creative/fin/med (+32k), zamba2-7b.
  ['orcarouter/deepseek/deepseek-v4-flash-free', 1_048_576], // KIO/-free + family consensus
  ['orcarouter/openai/gpt-5.5', 1_050_000], // UNO + CC + KIO
  // Dated snapshot inherits gpt-5.5 (consensus + OR-live 2026-10-04).
  ['orcarouter/openai/gpt-5.5-2026-04-23', 1_050_000],
  // Consensus: TR/openai/gpt-5.5-pro + OR-live 2026-10-04
  // (openai/gpt-5.5-pro = 1050000).
  ['orcarouter/openai/gpt-5.5-pro', 1_050_000],
  // Dated snapshot inherits gpt-5.5-pro (consensus + OR-live 2026-10-04).
  ['orcarouter/openai/gpt-5.5-pro-2026-04-23', 1_050_000],
  // Conservative minimum: KIO/glm-5.3-flash-free 1048575 vs OR-live 1048576
  // (2026-10-04) — min holds.
  ['orcarouter/z-ai/glm-5.3-flash-free', 1_048_575],
  // --- nvidia chat-surface gap subset ---
  ['nvidia/deepseek-ai/deepseek-v4.1-flash', 1_048_576], // CC + KIO
  // Consensus: CC/moonshotai/Kimi-K2.6 + OR-live 2026-10-04
  // (moonshotai/kimi-k2.6 = 262144).
  ['nvidia/moonshotai/kimi-k2.6', 262_144],
  ['nvidia/moonshotai/kimi-k3', 1_048_576], // HC + TB + TR + TH + CC + KIO
  ['nvidia/nvidia/nemotron-3-super-120b-a12b', 262_144], // TR + KIO
  // Consensus: KIO/nemotron-3-ultra-550b-a55b + OR-live 2026-10-04
  // (nvidia/nemotron-3-ultra-550b-a55b = 262144).
  ['nvidia/nvidia/nemotron-3-ultra-550b-a55b', 262_144],
  // INF 1,048,576 vs KIO 262,144 → conservative minimum.
  ['nvidia/nvidia/nemotron-3.5-lightning-30b-a3b', 262_144],
  // Consensus: KIO/laguna-xs-2.1 + OR-live 2026-10-04
  // (poolside/laguna-xs-2.1 = 262144).
  ['nvidia/poolside/laguna-xs-2.1', 262_144],
  // CC gateway-advertised 1,000,000 vs KIO 1,048,576 → minimum.
  ['nvidia/z-ai/glm-5.3', 1_000_000],
  ['nvidia/z-ai/glm-5.3-flash', 1_048_575], // KIO vs INF/UNO → minimum
  // --- kiosapi: seam-split to ./context-window-table-kiosapi
  // (FID-2026-1003-008 — the full 77-model Model Square roster outgrew this
  // module's 300-line quality ceiling; FID-2026-0919-019 researched the
  // original 6 rows). The spread keeps the single Map and every import
  // path stable. No-row ids are documented in the section file's header.
  ...KIOSAPI_CONTEXT_WINDOW_FALLBACKS,
  ...APINEX_CONTEXT_WINDOW_FALLBACKS,
  ...BAI_CONTEXT_WINDOW_FALLBACKS,
  // --- chatanywhere: seam-split (FID-2026-1005-010; the gateway publishes
  // no window fields — cross-gateway consensus rows; no-row ids documented
  // in the section file) ---
  ...CHATANYWHERE_CONTEXT_WINDOW_FALLBACKS,
  // --- tiarina: seam-split (FID-2026-1012-005; the gateway publishes no
  // window fields — cross-gateway consensus rows, two of them pinned at the
  // conservative minimum of two disagreeing >=2-row groups; the one no-row id
  // (glm-4.7-flash) is documented in the section file) ---
  ...TIARINA_CONTEXT_WINDOW_FALLBACKS,
])
