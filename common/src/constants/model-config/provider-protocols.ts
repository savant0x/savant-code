/**
 * Per-provider protocol maps (extracted from providers.ts — FID-2026-0819-005).
 * Pure metadata; the model catalogs live in the sibling providers module.
 */

/** Protocol metadata for CommandCode models — Claude models require the Anthropic endpoint. */
export const COMMANDCODE_PROTOCOLS: Record<string, 'openai' | 'anthropic'> = {
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

export const OPENCODE_GO_PROTOCOLS: Record<string, 'openai' | 'anthropic'> = {
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
