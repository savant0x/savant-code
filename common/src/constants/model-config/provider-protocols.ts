/**
 * Per-provider protocol maps (extracted from providers.ts — FID-2026-0819-005).
 * Pure metadata; the model catalogs live in the sibling providers module.
 */
import type {
  ProviderModelProtocol,
  ProviderProtocolMap,
} from '../../providers/types'

/** Protocol metadata for CommandCode models — Claude models require the Anthropic endpoint. */
export const COMMANDCODE_PROTOCOLS: Record<string, ProviderModelProtocol> = {
  'commandcode/claude-opus-5': 'anthropic',
  'commandcode/claude-opus-4.8': 'anthropic',
  'commandcode/claude-sonnet-5': 'anthropic',
  'commandcode/claude-sonnet-4.6': 'anthropic',
  'commandcode/claude-haiku-4.5': 'anthropic',
  'commandcode/x-ai/grok-4.5': 'openai',
  'commandcode/z-ai/glm-5.2': 'openai',
  'commandcode/z-ai/glm-5.1': 'openai',
  'commandcode/moonshotai/kimi-k3': 'openai',
  'commandcode/moonshotai/kimi-k2.7-code': 'openai',
  'commandcode/moonshotai/kimi-k2.6': 'openai',
  'commandcode/xiaomi/mimo-v2.5': 'openai',
  'commandcode/xiaomi/mimo-v2.5-pro': 'openai',
  'commandcode/deepseek/deepseek-v4-pro': 'openai',
  'commandcode/deepseek/deepseek-v4-flash': 'openai',
  'commandcode/deepseek/deepseek-v3.2': 'openai',
  'commandcode/openai/gpt-5.6-sol': 'openai',
  'commandcode/openai/gpt-5.6-terra': 'openai',
  'commandcode/openai/gpt-5.6-luna': 'openai',
  'commandcode/openai/gpt-5.5': 'openai',
  'commandcode/openai/gpt-5.3-codex': 'openai',
  'commandcode/qwen/qwen3.7-max': 'openai',
  'commandcode/qwen/qwen3.7-plus': 'openai',
  'commandcode/qwen/qwen3.6-plus': 'openai',
  'commandcode/minimax-m3': 'openai',
  'commandcode/minimaxai/minimax-m2.7': 'openai',
  'commandcode/lagunaai/laguna-s-2.1': 'openai',
  'commandcode/minimaxai/ling-3.0-flash': 'openai',
} as const

export const OPENCODE_GO_PROTOCOLS: Record<string, ProviderModelProtocol> = {
  'opencode-go/grok-4.5': 'openai',
  'opencode-go/glm-5.2': 'openai',
  'opencode-go/glm-5.1': 'openai',
  'opencode-go/kimi-k3': 'openai',
  'opencode-go/kimi-k2.7-code': 'openai',
  'opencode-go/kimi-k2.6': 'openai',
  'opencode-go/mimo-v2.5': 'openai',
  'opencode-go/mimo-v2.5-pro': 'openai',
  'opencode-go/deepseek-v4-pro': 'openai',
  'opencode-go/deepseek-v4-flash': 'openai',
  'opencode-go/minimax-m3': 'anthropic',
  'opencode-go/minimax-m2.7': 'anthropic',
  'opencode-go/qwen3.7-max': 'anthropic',
  'opencode-go/qwen3.7-plus': 'anthropic',
  'opencode-go/qwen3.6-plus': 'anthropic',
} as const

/**
 * Protocol metadata for OpenCode Zen models (FID-2026-0905-003).
 *
 * Zen serves four wire formats from one base URL; the endpoint families come
 * straight from the official table at `opencode.ai/docs/zen` (planetary
 * truth: chat/completions for DeepSeek/MiniMax/GLM/Kimi/free models,
 * Anthropic messages for Claude/Qwen, Responses for GPT/Grok/Muse Spark,
 * native Gemini path for Gemini). Keys are FULL prefixed model ids matching
 * the map keys the factory looks up — an id missing here fails closed at
 * request time, so this map must cover every id the live catalog can return.
 */
export const OPENCODE_ZEN_PROTOCOLS: Record<string, ProviderModelProtocol> = {
  // Claude family — Anthropic messages.
  'opencode-zen/claude-fable-5': 'anthropic',
  'opencode-zen/claude-fable-5-1': 'anthropic',
  'opencode-zen/claude-opus-5': 'anthropic',
  'opencode-zen/claude-opus-4-8': 'anthropic',
  'opencode-zen/claude-opus-4-7': 'anthropic',
  'opencode-zen/claude-opus-4-6': 'anthropic',
  'opencode-zen/claude-opus-4-5': 'anthropic',
  'opencode-zen/claude-sonnet-5': 'anthropic',
  'opencode-zen/claude-sonnet-4-6': 'anthropic',
  'opencode-zen/claude-sonnet-4-5': 'anthropic',
  'opencode-zen/claude-sonnet-4': 'anthropic',
  'opencode-zen/claude-haiku-4-5': 'anthropic',
  // Qwen family — Anthropic messages.
  'opencode-zen/qwen3.6-plus': 'anthropic',
  'opencode-zen/qwen3.5-plus': 'anthropic',
  // GPT family — Responses API.
  'opencode-zen/gpt-6-astra': 'responses',
  'opencode-zen/gpt-5.6-sol': 'responses',
  'opencode-zen/gpt-5.6-terra': 'responses',
  'opencode-zen/gpt-5.6-luna': 'responses',
  'opencode-zen/gpt-5.5': 'responses',
  'opencode-zen/gpt-5.5-pro': 'responses',
  'opencode-zen/gpt-5.4': 'responses',
  'opencode-zen/gpt-5.4-pro': 'responses',
  'opencode-zen/gpt-5.4-mini': 'responses',
  'opencode-zen/gpt-5.4-nano': 'responses',
  'opencode-zen/gpt-5.3-codex-spark': 'responses',
  'opencode-zen/gpt-5.3-codex': 'responses',
  'opencode-zen/gpt-5.2': 'responses',
  'opencode-zen/gpt-5.2-codex': 'responses',
  'opencode-zen/gpt-5.1': 'responses',
  'opencode-zen/gpt-5.1-codex-max': 'responses',
  'opencode-zen/gpt-5.1-codex': 'responses',
  'opencode-zen/gpt-5.1-codex-mini': 'responses',
  'opencode-zen/gpt-5': 'responses',
  'opencode-zen/gpt-5-codex': 'responses',
  'opencode-zen/gpt-5-nano': 'responses',
  // Grok family — Responses API.
  'opencode-zen/grok-build-0.1': 'responses',
  'opencode-zen/grok-4.6': 'responses',
  'opencode-zen/grok-4.5': 'responses',
  // Muse Spark family — Responses API.
  'opencode-zen/muse-spark-1.3': 'responses',
  'opencode-zen/muse-spark-1.2': 'responses',
  'opencode-zen/muse-spark-1.3-contributor-free': 'responses',
  'opencode-zen/muse-spark-1.2-contributor-free': 'responses',
  // DeepSeek family — chat completions.
  'opencode-zen/deepseek-v4-pro': 'openai',
  'opencode-zen/deepseek-v4-flash': 'openai',
  'opencode-zen/deepseek-v4-flash-vision-exp': 'openai',
  'opencode-zen/deepseek-v4-flash-free': 'openai',
  // GLM family — chat completions.
  'opencode-zen/glm-5.3-flash': 'openai',
  'opencode-zen/glm-5.3': 'openai',
  'opencode-zen/glm-5.2': 'openai',
  'opencode-zen/glm-5.1': 'openai',
  'opencode-zen/glm-5': 'openai',
  // MiniMax family — chat completions.
  'opencode-zen/minimax-m3': 'openai',
  'opencode-zen/minimax-m2.7': 'openai',
  'opencode-zen/minimax-m2.5': 'openai',
  // Kimi family — chat completions.
  'opencode-zen/kimi-k3': 'openai',
  'opencode-zen/kimi-k2.7-code': 'openai',
  'opencode-zen/kimi-k2.6': 'openai',
  'opencode-zen/kimi-k2.5': 'openai',
  // Free / misc — chat completions.
  'opencode-zen/big-pickle': 'openai',
  'opencode-zen/mimo-v2.5-free': 'openai',
  'opencode-zen/ling-3.0-flash-fin-free': 'openai',
  'opencode-zen/nemotron-3-ultra-free': 'openai',
  'opencode-zen/nemotron-3.5-lightning-free': 'openai',
  // Gemini family — native Gemini path (spike-gated, FID-2026-0905-003 Step 5).
  'opencode-zen/gemini-3.6-flash': 'gemini',
  'opencode-zen/gemini-3.8-flash': 'gemini',
  'opencode-zen/gemini-3.7-flash': 'gemini',
  'opencode-zen/gemini-3.5-flash-lite': 'gemini',
  'opencode-zen/gemini-3.5-flash': 'gemini',
  'opencode-zen/gemini-3.1-pro': 'gemini',
  'opencode-zen/gemini-3-flash': 'gemini',
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
  OPENCODE_GO_PROTOCOLS,
  COMMANDCODE_PROTOCOLS,
  OPENCODE_ZEN_PROTOCOLS,
}
