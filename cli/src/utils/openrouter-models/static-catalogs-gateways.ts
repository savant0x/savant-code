/**
 * Gateway static catalogs (file split, 300-line cap — FID-2026-0914-001).
 *
 * New gateway providers' display names, pinned context windows, and fetch
 * functions land here; the older static catalogs remain in
 * `static-catalogs.ts`. All functions are synchronous and derive the id
 * set from the common MODEL_CATALOGS maps — only display names and
 * vendor-pinned windows are cli-side, mirroring the HCNSec/TokenBom
 * pattern (FID-2026-0913-001).
 */
import { getContextWindowFallback } from '@savant-code/common/constants/context-windows'
import {
  atriaModels,
  bazaarlinkModels,
  infronModels,
  internModels,
  marsaiModels,
  unorouterModels,
} from '@savant-code/common/constants/model-config'

import type { OpenRouterModel } from './types'

/**
 * Display names for Infron model ids (curated catalog, FID-2026-0914-001).
 */
const INFRON_NAMES: Record<string, string> = {
  'infron/deepseek/deepseek-v4-flash:free': 'DeepSeek V4 Flash (Free)',
  'infron/deepseek/deepseek-v4-flash-0731:free':
    'DeepSeek V4 Flash 0731 (Free)',
  'infron/qwen/qwen3.8-27b:free': 'Qwen 3.8 27B (Free)',
  'infron/nvidia/nemotron-3.5-lightning-30b-a3b:free':
    'Nemotron 3.5 Lightning (Free)',
  'infron/kwaipilot/kat-coder-pro-v2': 'KAT Coder Pro V2',
  'infron/moonshotai/kimi-k2.7-code': 'Kimi K2.7 Code',
  'infron/qwen/qwen3-coder-next': 'Qwen 3 Coder Next',
  'infron/google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'infron/z-ai/glm-5.3-flash': 'GLM 5.3 Flash',
}

/**
 * FID-2026-0919-020: the shadow `INFRON_CONTEXT_WINDOWS` /
 * `UNOROUTER_CONTEXT_WINDOWS` pin tables are DELETED — they duplicated the
 * fallback table and drifted from it the moment live windows moved (this
 * audit's exact failure). The vendor fallback table
 * (context-window-table.ts) is the single source of truth (Law 13); every
 * curated id has full coverage there, pinned by the window-truth suite.
 */

/**
 * Return the Infron curated catalog (FID-2026-0914-001). Static by
 * design: the operator ruled a curated set out of the 458-entry live
 * catalog (chat-served models only; the free tier additionally requires
 * a funded team account). Synchronous.
 */
export function fetchInfronModels(): OpenRouterModel[] {
  return Object.values(infronModels).map((id) => ({
    id,
    name: INFRON_NAMES[id] ?? id.slice('infron/'.length),
    provider: 'infron' as const,
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}

/** Display names for UnoRouter model ids (curated catalog, FID-2026-0914-001). */
const UNOROUTER_NAMES: Record<string, string> = {
  'unorouter/glm-5.3-flash:free': 'GLM 5.3 Flash (Free)',
  'unorouter/deepseek-v4-flash:free': 'DeepSeek V4 Flash (Free)',
  'unorouter/gemini-3.6-flash:free': 'Gemini 3.6 Flash (Free)',
  'unorouter/gpt-oss-120b:free': 'GPT-OSS 120B (Free)',
  'unorouter/qwen3.6-35b-a3b:free': 'Qwen 3.6 35B A3B (Free)',
  'unorouter/qwen3.8-27b:free': 'Qwen 3.8 27B (Free)',
  'unorouter/step-3.7-flash:free': 'Step 3.7 Flash (Free)',
  'unorouter/codestral-latest:free': 'Codestral (Free)',
  'unorouter/north-mini-code:free': 'North Mini Code (Free)',
  'unorouter/seed-oss-36b:free': 'Seed OSS 36B (Free)',
  'unorouter/dots-3-note-preview:free': 'Dots 3 Note Preview (Free)',
  'unorouter/intern-s2-preview:free': 'Intern S2 Preview (Free)',
  'unorouter/claude-fable-5.1': 'Claude Fable 5.1',
  'unorouter/gpt-5.5': 'GPT 5.5',
  'unorouter/gpt-6-astra': 'GPT 6 Astra',
  'unorouter/claude-opus-4.8': 'Claude Opus 4.8',
  'unorouter/deepseek-v4-pro': 'DeepSeek V4 Pro',
}

/**
 * FID-2026-0919-020: the shadow `UNOROUTER_CONTEXT_WINDOWS` pin table was
 * deleted with the Infron one (same drift; its 65,536 qwen3.8-27b pin —
 * a flagged FID-2026-0914-001 judgment — is superseded by the live audit's
 * 1M capability row).
 */

/**
 * Return the UnoRouter curated catalog (FID-2026-0914-001). Static by
 * design: the operator ruled a curated set out of the 128-row free tier
 * + paid catalog; multi-supplier failover is a documented substitution
 * surface (personal-use provenance). Synchronous.
 */
export function fetchUnorouterModels(): OpenRouterModel[] {
  return Object.values(unorouterModels).map((id) => ({
    id,
    name: UNOROUTER_NAMES[id] ?? id.slice('unorouter/'.length),
    provider: 'unorouter' as const,
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}

/** Display names for BazaarLink model ids (FID-2026-0915-006, amended). */
const BAZAARLINK_NAMES: Record<string, string> = {
  'bazaarlink/qwen/qwen3.7-flash:free': 'Qwen 3.7 Flash (Free)',
  'bazaarlink/claude-fable-5.1': 'Claude Fable 5.1',
  'bazaarlink/claude-fable-5': 'Claude Fable 5',
  'bazaarlink/claude-opus-5': 'Claude Opus 5',
  'bazaarlink/claude-opus-4.8': 'Claude Opus 4.8',
  'bazaarlink/claude-opus-4.7': 'Claude Opus 4.7',
  'bazaarlink/claude-sonnet-5': 'Claude Sonnet 5',
  'bazaarlink/grok-4.5': 'Grok 4.5',
  'bazaarlink/gpt-5.6-sol': 'GPT 5.6 Sol',
  'bazaarlink/gpt-5.6-terra': 'GPT 5.6 Terra',
  'bazaarlink/gpt-5.6-luna': 'GPT 5.6 Luna',
  'bazaarlink/qwen3.8-max': 'Qwen 3.8 Max',
}

/**
 * Return the BazaarLink catalog (FID-2026-0915-006, amended per operator
 * ruling): the audited-genuine free channel + the 11 gateway-available
 * top-coding models (BenchLM SWE-bench Pro leaderboard dated 2026-09-15 ∩
 * the LIVE keyed roster; 4 of the top 15 are not served by the vendor).
 * PAID channels added WITHOUT identity testing — zero-credit account,
 * live 402 measured; serving-name disclosure verified on free channels.
 * Static by design: a live catalog would re-expose the substituted
 * deepseek :free channels. Synchronous.
 */
export function fetchBazaarlinkModels(): OpenRouterModel[] {
  return Object.values(bazaarlinkModels).map((id) => ({
    id,
    name: BAZAARLINK_NAMES[id] ?? id.slice('bazaarlink/'.length),
    provider: 'bazaarlink' as const,
    // The vendor's own keyed /v1/models publishes context_length —
    // pinned in the common fallback table (1,000,000).
    contextLength:
      BAZAARLINK_CONTEXT_WINDOWS[id] ??
      getContextWindowFallback(id).contextWindow,
  }))
}

/**
 * Pinned context windows for BazaarLink ids — the vendor's own
 * `context_length` values from the keyed api.bazaarlink.ai/v1/models
 * payload (2026-09-15, FID-2026-0915-006 amended). NOT the family
 * heuristic.
 */
const BAZAARLINK_CONTEXT_WINDOWS: Record<string, number> = {
  'bazaarlink/qwen/qwen3.7-flash:free': 1_000_000,
  'bazaarlink/claude-fable-5.1': 1_000_000,
  'bazaarlink/claude-fable-5': 1_000_000,
  'bazaarlink/claude-opus-5': 1_000_000,
  'bazaarlink/claude-opus-4.8': 1_000_000,
  'bazaarlink/claude-opus-4.7': 1_000_000,
  'bazaarlink/claude-sonnet-5': 1_000_000,
  'bazaarlink/grok-4.5': 500_000,
  'bazaarlink/gpt-5.6-sol': 1_050_000,
  'bazaarlink/gpt-5.6-terra': 1_050_000,
  'bazaarlink/gpt-5.6-luna': 1_050_000,
  'bazaarlink/qwen3.8-max': 1_000_000,
}

/** Display names for Atria AI model ids (FID-2026-0916-005). */
const ATRIA_NAMES: Record<string, string> = {
  'atria/Atria-Dawn-Preview': 'Atria Dawn Preview',
}

/**
 * Return the Atria AI catalog (FID-2026-0916-005) — the single upstream
 * model the gateway exposes. Static by design: the /v1/models endpoint is
 * key-protected (401 without a key) and the one-model set is a checked-in
 * constant (bazaarlink precedent). The 256K window is vendor-published
 * (api.atria-asi.ai/docs) and pinned in the common fallback table.
 * Synchronous.
 */
export function fetchAtriaModels(): OpenRouterModel[] {
  return Object.values(atriaModels).map((id) => ({
    id,
    name: ATRIA_NAMES[id] ?? id.slice('atria/'.length),
    provider: 'atria' as const,
    // FID-2026-0916-002 (V6): the vendor fallback table replaces the
    // substring heuristic — every curated Atria id is pinned there.
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}

/** Display names for Intern InkStone model ids (FID-2026-1004-008). */
const INTERN_NAMES: Record<string, string> = {
  'intern/Agents-A1': 'Agents A1',
  'intern/Atria-Dawn-Preview': 'Atria Dawn Preview',
  'intern/deepseek-v4-flash-0731': 'DeepSeek V4 Flash 0731',
  'intern/deepseek-v4-flash-vision': 'DeepSeek V4 Flash Vision',
  'intern/deepseek-v4-pro-0813': 'DeepSeek V4 Pro 0813',
  'intern/glm-5.3': 'GLM 5.3',
  'intern/intern-s2': 'Intern S2',
  'intern/kimi-k2.6': 'Kimi K2.6',
  'intern/minimax-m3': 'MiniMax M3',
  'intern/qwen3.8-27b': 'Qwen 3.8 27B',
}

/**
 * Return the Intern InkStone catalog (FID-2026-1004-008) — the Shanghai AI
 * Laboratory science-discovery platform's 10-model roster (the China-hosted
 * twin of `atria`). Static by design: the vendor's /v1/models is
 * key-protected (401 keyless) and publishes windows in a non-OpenRouter
 * `schema_version: "2.4"` shape the shared parser does not read, so the
 * checked-in set is the source of truth (the atria precedent). Every id's
 * window is pinned in the common fallback table from the LIVE authenticated
 * probe (2026-10-04). Synchronous.
 */
export function fetchInternModels(): OpenRouterModel[] {
  return Object.values(internModels).map((id) => ({
    id,
    name: INTERN_NAMES[id] ?? id.slice('intern/'.length),
    provider: 'intern' as const,
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}

/** Display names for MarsAI model ids (FID-2026-1016-004). */
const MARSAI_NAMES: Record<string, string> = {
  'marsai/auto-free': 'Auto (Free)',
  'marsai/cat-jam-free': 'Cat Jam (Free)',
  'marsai/deepseek-v4.1-flash-free': 'DeepSeek V4.1 Flash (Free)',
  'marsai/laguna-xs-2.1-free': 'Laguna XS 2.1 (Free)',
  'marsai/Meta-Llama-3_3-70B-Instruct-free': 'Llama 3.3 70B Instruct (Free)',
  'marsai/mimo-v2.6-flash-free': 'MiMo V2.6 Flash (Free)',
  'marsai/MiniMax-M2.7-free': 'MiniMax M2.7 (Free)',
  'marsai/muse-spark-1.3-free': 'Muse Spark 1.3 (Free)',
  'marsai/nemotron-3-super-120b-a12b:free': 'Nemotron 3 Super 120B A12B (Free)',
  'marsai/nemotron-3-ultra-free': 'Nemotron 3 Ultra (Free)',
  'marsai/north-mini-code:free': 'North Mini Code (Free)',
  'marsai/Qwen3.6-27B-free': 'Qwen 3.6 27B (Free)',
  'marsai/Qwen3.8-27B-free': 'Qwen 3.8 27B (Free)',
  'marsai/step-5-preview-free': 'Step 5 Preview (Free)',
}

/**
 * Return the MarsAI catalog (FID-2026-1016-004) — the 14 free-tier ids from
 * the operator dashboard census 2026-10-16 (console-verified). Static by
 * design: the vendor's /v1/models is unreachable from this network (DNS
 * hijack + TLS reset; DoH records 104.21.63.63 / 172.67.143.237), so the
 * checked-in set is the source of truth. Windows resolve through the
 * context-window-table-marsai seam. Synchronous.
 */
export function fetchMarsaiModels(): OpenRouterModel[] {
  return Object.values(marsaiModels).map((id) => ({
    id,
    name: MARSAI_NAMES[id] ?? id.slice('marsai/'.length),
    provider: 'marsai' as const,
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}
