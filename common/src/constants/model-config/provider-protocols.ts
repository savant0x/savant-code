/**
 * Per-provider protocol maps (extracted from providers.ts — FID-2026-0819-005).
 * Pure metadata; the model catalogs live in the sibling providers module.
 */
import type {
  ProviderModelProtocol,
  ProviderProtocolMap,
} from '../../providers/types'

/**
 * Protocol metadata for CommandCode models — Claude models require the
 * Anthropic endpoint.
 *
 * FID-2026-0916-004: ids re-aligned to the vendor's renormalized roster
 * (dashed versions, no vendor prefixes, zai-org/GLM + canonical Kimi
 * casing, Qwen3.8 family). The 2025-era dotted/prefixed spellings are
 * gone from the vendor's published list.
 */
export const COMMANDCODE_PROTOCOLS: Record<string, ProviderModelProtocol> = {
  'commandcode/claude-opus-5': 'anthropic',
  'commandcode/claude-opus-4-8': 'anthropic',
  'commandcode/claude-opus-4-7': 'anthropic',
  'commandcode/claude-fable-5': 'anthropic',
  'commandcode/claude-fable-5-1': 'anthropic',
  'commandcode/claude-sonnet-5': 'anthropic',
  'commandcode/claude-sonnet-4-6': 'anthropic',
  'commandcode/claude-haiku-4-5-20251001': 'anthropic',
  'commandcode/xai/grok-4.5': 'openai',
  'commandcode/xai/grok-4.6': 'openai',
  'commandcode/zai-org/glm-5.2': 'openai',
  'commandcode/zai-org/glm-5.3': 'openai',
  'commandcode/moonshotai/Kimi-K3': 'openai',
  'commandcode/moonshotai/Kimi-K2.7-Code': 'openai',
  'commandcode/moonshotai/Kimi-K2.6': 'openai',
  'commandcode/MiniMaxAI/MiniMax-M3': 'openai',
  'commandcode/MiniMaxAI/MiniMax-M2.7': 'openai',
  'commandcode/deepseek/deepseek-v4-pro': 'openai',
  'commandcode/deepseek/deepseek-v4-flash': 'openai',
  'commandcode/deepseek/deepseek-v4.1-flash': 'openai',
  'commandcode/gpt-5.6-sol': 'openai',
  'commandcode/gpt-5.6-terra': 'openai',
  'commandcode/gpt-5.6-luna': 'openai',
  'commandcode/gpt-5.5': 'openai',
  'commandcode/gpt-5.3-codex': 'openai',
  'commandcode/Qwen/Qwen3.8-Max': 'openai',
  'commandcode/Qwen/Qwen3.8-27B': 'openai',
  'commandcode/Qwen/Qwen3.7-Max': 'openai',
  'commandcode/Qwen/Qwen3.7-Plus': 'openai',
  'commandcode/Qwen/Qwen3.7-Flash': 'openai',
  'commandcode/poolside/laguna-s-2.1-free': 'openai',
  'commandcode/inclusionai/ling-3.0-flash-sante:free': 'openai',
  'commandcode/meituan/LongCat-2.0:free': 'openai',
} as const

/**
 * Wire protocol per TokenRouter model id (FID-2026-0916-002).
 *
 * Source: the vendor's own keyed /v1/models `supported_endpoint_types`
 * (2026-09-16) — NOT family guesses. Before this map, the registry entry
 * was `protocol: 'openai'`, so every id dispatched chat/completions and the
 * Responses-only OpenAI family (gpt-5.3-codex → HTTP 404 "Use the
 * v1/responses endpoint instead"), the Anthropic-only Claude family, and
 * the Gemini-only id all failed at request time.
 *
 * Endpoint-type → protocol translation: `openai` → 'openai';
 * `openai-response` → 'responses'; `anthropic`/`anthropic-compatible` →
 * 'anthropic'; `gemini` → 'gemini'. Dual-eps ids dispatch 'openai' (the
 * chat-completions shape the OpenAI SDK sends natively).
 */
export const TOKENROUTER_PROTOCOLS: Record<string, ProviderModelProtocol> = {
  // Anthropic-only family.
  'tokenrouter/anthropic/claude-fable-5': 'anthropic',
  'tokenrouter/anthropic/claude-opus-4.8': 'anthropic',
  'tokenrouter/anthropic/claude-opus-4.8-fast': 'anthropic',
  'tokenrouter/anthropic/claude-opus-4.7': 'anthropic',
  'tokenrouter/anthropic/claude-opus-4.7-fast': 'anthropic',
  'tokenrouter/anthropic/claude-opus-4.6': 'anthropic',
  'tokenrouter/anthropic/claude-sonnet-5': 'anthropic',
  // Responses-only OpenAI family.
  'tokenrouter/openai/gpt-5.3-codex': 'responses',
  'tokenrouter/openai/gpt-5.4': 'responses',
  'tokenrouter/openai/gpt-5.5': 'responses',
  'tokenrouter/openai/gpt-5.5-pro': 'responses',
  'tokenrouter/openai/gpt-5.6-sol': 'responses',
  'tokenrouter/openai/gpt-5.6-terra': 'responses',
  // Gemini-only.
  'tokenrouter/google/gemini-3.1-pro-preview': 'gemini',
  // openai / dual-eps (openai + openai-response) — chat completions.
  'tokenrouter/deepseek/deepseek-v4-pro': 'openai',
  'tokenrouter/deepseek/deepseek-v3.2': 'openai',
  'tokenrouter/qwen/qwen3.7-max': 'openai',
  'tokenrouter/qwen/qwen3.7-plus': 'openai',
  'tokenrouter/qwen/qwen3.6-plus': 'openai',
  'tokenrouter/qwen/qwen3.5-397b-a17b': 'openai',
  'tokenrouter/qwen/qwen3.5-122b-a10b': 'openai',
  'tokenrouter/z-ai/glm-5.2': 'openai',
  'tokenrouter/z-ai/glm-5.1': 'openai',
  'tokenrouter/x-ai/grok-4.5': 'openai',
  'tokenrouter/x-ai/grok-4.3': 'openai',
  'tokenrouter/moonshotai/kimi-k3': 'openai',
  'tokenrouter/moonshotai/kimi-k2.7-code': 'openai',
  'tokenrouter/xiaomi/mimo-v2.5-pro': 'openai',
  'tokenrouter/nvidia/nemotron-3-super-120b-a12b': 'openai',
  'tokenrouter/openai/gpt-oss-120b': 'openai',
  'tokenrouter/MiniMax-M3': 'openai',
} as const

/**
 * Single shared protocol-map record. Both the registry validator
 * (`providers/validate.ts`) and the SDK factory
 * (`sdk/src/impl/model-provider/model-factories.ts`) resolve through this —
 * one function, one truth (Law 13). Adding a map means one entry here plus
 * one member on `ProviderProtocolMap`; no call-site switch grows.
 */
export const PROVIDER_PROTOCOL_MAPS: Record<
  ProviderProtocolMap,
  Record<string, ProviderModelProtocol>
> = {
  COMMANDCODE_PROTOCOLS,
  TOKENROUTER_PROTOCOLS,
}
