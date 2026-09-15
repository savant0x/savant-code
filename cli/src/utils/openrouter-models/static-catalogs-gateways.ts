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
  bazaarlinkModels,
  infronModels,
  unorouterModels,
} from '@savant-code/common/constants/model-config'

import type { OpenRouterModel } from './types'

/** Display names for Infron model ids (curated catalog, FID-2026-0914-001). */
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
 * Pinned context windows for Infron ids — the vendor's own catalog
 * `context_length` values (api.infron.ai, fetched 2026-09-14; FID
 * window table). NOT the family heuristic; a gateway may still cap
 * lower (surfaces as a vendor 400, never silent truncation).
 */
const INFRON_CONTEXT_WINDOWS: Record<string, number> = {
  'infron/deepseek/deepseek-v4-flash:free': 1_048_580,
  'infron/deepseek/deepseek-v4-flash-0731:free': 1_000_000,
  'infron/qwen/qwen3.8-27b:free': 256_000,
  'infron/nvidia/nemotron-3.5-lightning-30b-a3b:free': 1_048_576,
  'infron/kwaipilot/kat-coder-pro-v2': 262_140,
  'infron/moonshotai/kimi-k2.7-code': 262_144,
  'infron/qwen/qwen3-coder-next': 262_144,
  'infron/google/gemini-3.1-pro-preview': 1_048_576,
  'infron/z-ai/glm-5.3-flash': 1_000_000,
}

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
    // FID-2026-0914-002 (V6): the vendor fallback table replaces the
    // substring heuristic — every curated Infron id is pinned there.
    contextLength:
      INFRON_CONTEXT_WINDOWS[id] ?? getContextWindowFallback(id).contextWindow,
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
 * Pinned context windows for UnoRouter ids — the vendor console's own
 * `metadata.contextWindow` values (api.unorouter.com, fetched
 * 2026-09-14; FID window table). `qwen3.8-27b:free` pins the metadata
 * value (65,536) over the conflicting 262.1K tag — flagged in the FID.
 */
const UNOROUTER_CONTEXT_WINDOWS: Record<string, number> = {
  'unorouter/glm-5.3-flash:free': 1_000_000,
  'unorouter/deepseek-v4-flash:free': 1_000_000,
  'unorouter/gemini-3.6-flash:free': 1_000_000,
  'unorouter/gpt-oss-120b:free': 131_072,
  'unorouter/qwen3.6-35b-a3b:free': 262_100,
  'unorouter/qwen3.8-27b:free': 65_536,
  'unorouter/step-3.7-flash:free': 256_000,
  'unorouter/codestral-latest:free': 256_000,
  'unorouter/north-mini-code:free': 256_000,
  'unorouter/seed-oss-36b:free': 524_288,
  'unorouter/dots-3-note-preview:free': 512_000,
  'unorouter/intern-s2-preview:free': 262_144,
  'unorouter/claude-fable-5.1': 1_000_000,
  'unorouter/gpt-5.5': 1_100_000,
  'unorouter/gpt-6-astra': 1_100_000,
  'unorouter/claude-opus-4.8': 1_000_000,
  'unorouter/deepseek-v4-pro': 1_000_000,
}

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
    // FID-2026-0914-002 (V6): the vendor fallback table replaces the
    // substring heuristic — every curated UnoRouter id is pinned there.
    contextLength:
      UNOROUTER_CONTEXT_WINDOWS[id] ??
      getContextWindowFallback(id).contextWindow,
  }))
}

/** Display names for BazaarLink model ids (FID-2026-0915-006). */
const BAZAARLINK_NAMES: Record<string, string> = {
  'bazaarlink/qwen/qwen3.7-flash:free': 'Qwen 3.7 Flash (Free)',
}

/**
 * Return the BazaarLink catalog (FID-2026-0915-006) — the ONE
 * audited-genuine free channel (identity gauntlet T51-C; operator ruling
 * "Qwen free only"). Static by design: a live catalog would re-expose the
 * substituted deepseek channels. Synchronous.
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
 * Pinned context window for BazaarLink ids — the vendor's own
 * `context_length` from the keyed api.bazaarlink.ai/v1/models payload
 * (2026-09-15, FID-2026-0915-006). NOT the family heuristic.
 */
const BAZAARLINK_CONTEXT_WINDOWS: Record<string, number> = {
  'bazaarlink/qwen/qwen3.7-flash:free': 1_000_000,
}
