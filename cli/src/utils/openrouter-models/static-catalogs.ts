/**
 * Static catalogs for providers whose model-list APIs require auth
 * (TokenRouter, TokenHarbor, OpenCode Go) or share the common model
 * configuration (CommandCode). All are synchronous.
 *
 * FID-2026-0809-001 Phase 3: every model ID set derives from the common
 * MODEL_CATALOGS maps (common/src/constants/model-config.ts) — the cli-side
 * hardcoded TOKENROUTER_CATALOG and OPENCODE_GO_CATALOG arrays were deleted.
 * Only display names remain cli-side, mirroring the TokenHarbor pattern.
 */
import { inferContextLength } from '@savant-code/common/constants/context-windows'
import {
  commandcodeModels,
  opencodeGoModels,
  tokenharborModels,
  tokenrouterModels,
} from '@savant-code/common/constants/model-config'

import type { OpenRouterModel } from './types'

/** Display names for TokenRouter model ids (id set derives from common). */
const TOKENROUTER_NAMES: Record<string, string> = {
  'tokenrouter/anthropic/claude-fable-5': 'Claude Fable 5',
  'tokenrouter/openai/gpt-5.6-sol': 'GPT 5.6 Sol',
  'tokenrouter/deepseek/deepseek-v4-pro': 'DeepSeek V4 Pro',
  'tokenrouter/qwen/qwen3.7-max': 'Qwen 3.7 Max',
  'tokenrouter/z-ai/glm-5.2': 'GLM 5.2',
  'tokenrouter/openai/gpt-5.5-pro': 'GPT 5.5 Pro',
  'tokenrouter/anthropic/claude-opus-4.8': 'Claude Opus 4.8',
  'tokenrouter/x-ai/grok-4.5': 'Grok 4.5',
  'tokenrouter/moonshotai/kimi-k3': 'Kimi K3',
  'tokenrouter/bytedance-seed/seedream-5.0-pro': 'Seedream 5.0 Pro',
  'tokenrouter/MiniMax-M3': 'MiniMax M3',
  'tokenrouter/anthropic/claude-sonnet-5': 'Claude Sonnet 5',
  'tokenrouter/openai/gpt-5.6-terra': 'GPT 5.6 Terra',
  'tokenrouter/qwen/qwen3.7-plus': 'Qwen 3.7 Plus',
  'tokenrouter/anthropic/claude-opus-4.8-fast': 'Claude Opus 4.8 Fast',
  'tokenrouter/google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'tokenrouter/anthropic/claude-opus-4.7': 'Claude Opus 4.7',
  'tokenrouter/anthropic/claude-opus-4.7-fast': 'Claude Opus 4.7 Fast',
  'tokenrouter/openai/gpt-5.5': 'GPT 5.5',
  'tokenrouter/z-ai/glm-5.2-free': 'GLM 5.2 Free',
  'tokenrouter/deepseek/deepseek-v3.2': 'DeepSeek V3.2',
  'tokenrouter/qwen/qwen3.6-plus': 'Qwen 3.6 Plus',
  'tokenrouter/moonshotai/kimi-k2.7-code': 'Kimi K2.7 Code',
  'tokenrouter/xiaomi/mimo-v2.5-pro': 'MiMo V2.5 Pro',
  'tokenrouter/z-ai/glm-5.1': 'GLM 5.1',
  'tokenrouter/openai/gpt-5.4': 'GPT 5.4',
  'tokenrouter/x-ai/grok-4.3': 'Grok 4.3',
  'tokenrouter/anthropic/claude-opus-4.6': 'Claude Opus 4.6',
  'tokenrouter/openai/gpt-5.3-codex': 'GPT 5.3 Codex',
  'tokenrouter/nvidia/nemotron-3-super-120b-a12b': 'Nemotron 3 Super 120B',
  'tokenrouter/miromind/mirothinker-1-7-deepresearch':
    'MiroThinker 1.7 DeepResearch',
  'tokenrouter/qwen/qwen3.5-397b-a17b': 'Qwen 3.5 397B',
  'tokenrouter/qwen/qwen3.5-122b-a10b': 'Qwen 3.5 122B',
  'tokenrouter/openai/gpt-oss-120b': 'GPT-OSS 120B',
  'tokenrouter/z-ai/glm-5.3-free': 'GLM 5.3 Free',
}

/** The TokenRouter model id keys, exported so tests can compare the static
 * catalog against the live common model config without importing runtime
 * helpers. This is the single source of truth for the keys the CLI tests
 * enumerate; do not read `tokenrouterModels` here because that object is
 * statically generated from common and re-exported under the same keys. */
export const TOKENROUTER_MODEL_IDS = Object.keys(tokenrouterModels) as Array<
  keyof typeof tokenrouterModels
>

const TOKENHARBOR_NAMES: Record<string, string> = {
  'tokenharbor/claude-opus-5': 'Claude Opus 5',
  'tokenharbor/claude-fable-5': 'Claude Fable 5',
  'tokenharbor/gpt-5.6-sol': 'GPT-5.6 Sol',
  'tokenharbor/kimi-k3': 'Kimi K3',
  'tokenharbor/qwen3.8-max': 'Qwen3.8 Max',
  'tokenharbor/gpt-5.6-terra': 'GPT-5.6 Terra',
  'tokenharbor/grok-4.5': 'Grok 4.5',
  'tokenharbor/claude-sonnet-5': 'Claude Sonnet 5',
  'tokenharbor/gemini-3.6-flash': 'Gemini 3.6 Flash',
  'tokenharbor/glm-5.2': 'GLM 5.2',
  'tokenharbor/gpt-5.6-luna': 'GPT-5.6 Luna',
  'tokenharbor/deepseek-v4-flash': 'DeepSeek V4 Flash',
  'tokenharbor/minimax-m3': 'MiniMax M3',
  'tokenharbor/deepseek-v4-pro': 'DeepSeek V4 Pro',
  'tokenharbor/mimo-v2.5-pro': 'MiMo V2.5 Pro',
  'tokenharbor/mimo-v2.5': 'MiMo V2.5',
  'tokenharbor/kimi-k3:free': 'Kimi K3 (Free)',
  'tokenharbor/deepseek-v4-flash:free': 'DeepSeek V4 Flash (Free)',
  'tokenharbor/mimo-v2.5:free': 'MiMo V2.5 (Free)',
  'tokenharbor/th-orchestra': 'TH Orchestra',
}

/** Display names for OpenCode Go model ids (id set derives from common). */
const OPENCODE_GO_NAMES: Record<string, string> = {
  'opencode-go/grok-4.5': 'Grok 4.5',
  'opencode-go/glm-5.2': 'GLM 5.2',
  'opencode-go/glm-5.1': 'GLM 5.1',
  'opencode-go/kimi-k3': 'Kimi K3',
  'opencode-go/kimi-k2.7-code': 'Kimi K2.7 Code',
  'opencode-go/kimi-k2.6': 'Kimi K2.6',
  'opencode-go/mimo-v2.5': 'MiMo V2.5',
  'opencode-go/mimo-v2.5-pro': 'MiMo V2.5 Pro',
  'opencode-go/deepseek-v4-pro': 'DeepSeek V4 Pro',
  'opencode-go/deepseek-v4-flash': 'DeepSeek V4 Flash',
  'opencode-go/minimax-m3': 'MiniMax M3',
  'opencode-go/minimax-m2.7': 'MiniMax M2.7',
  'opencode-go/qwen3.7-max': 'Qwen 3.7 Max',
  'opencode-go/qwen3.7-plus': 'Qwen 3.7 Plus',
  'opencode-go/qwen3.6-plus': 'Qwen 3.6 Plus',
}

/**
 * Return the TokenRouter model catalog, derived from the common model map.
 * TokenRouter requires auth for its /v1/models endpoint, so the id set is a
 * hardcoded common map with cli-side display names. Synchronous.
 */
export function fetchTokenRouterModels(): OpenRouterModel[] {
  return Object.values(tokenrouterModels).map((id) => {
    const name = TOKENROUTER_NAMES[id] ?? id.slice('tokenrouter/'.length)
    return {
      id,
      name,
      provider: 'tokenrouter' as const,
      contextLength: inferContextLength(name),
    }
  })
}

/**
 * Return the complete published TokenHarbor catalog snapshot from
 * https://tokenharbor.ai/models. TokenHarbor's /v1/models endpoint is
 * intentionally not queried here; refresh this checked-in snapshot when the
 * public models page changes.
 */
export function getTokenHarborModels(): OpenRouterModel[] {
  return Object.values(tokenharborModels).map((id) => ({
    id,
    name: TOKENHARBOR_NAMES[id] ?? id.slice('tokenharbor/'.length),
    provider: 'tokenharbor' as const,
  }))
}

/**
 * Return the OpenCode Go model catalog, derived from the common model map.
 * OpenCode Go requires auth for its API, so the id set is a hardcoded common
 * map with cli-side display names. Synchronous.
 */
export function fetchOpenCodeGoModels(): OpenRouterModel[] {
  return Object.values(opencodeGoModels).map((id) => {
    const name = OPENCODE_GO_NAMES[id] ?? id.slice('opencode-go/'.length)
    return {
      id,
      name,
      provider: 'opencode-go' as const,
      contextLength: inferContextLength(name),
    }
  })
}

/**
 * Return the CommandCode model catalog.
 * The IDs are maintained in common model configuration so routing and picker
 * entries cannot silently drift apart. Context lengths are conservative
 * family estimates until CommandCode exposes authoritative metadata.
 */
export function fetchCommandCodeModels(): OpenRouterModel[] {
  return Object.values(commandcodeModels)
    .map((id) => ({
      id,
      name: id.slice('commandcode/'.length),
      provider: 'commandcode' as const,
      contextLength: inferContextLength(id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
