/**
 * AI models available for agents. Pick from our selection of recommended models or choose any model in OpenRouter.
 *
 * See available models at https://openrouter.ai/models
 */
export type ModelName =
  // Recommended Models

  // OpenAI
  | 'openai/gpt-5.3'
  | 'openai/gpt-5.3-codex'
  | 'openai/gpt-5.2'
  | 'openai/gpt-5.1'
  | 'openai/gpt-5.1-chat'
  | 'openai/gpt-5-mini'
  | 'openai/gpt-5-nano'

  // Anthropic
  | 'anthropic/claude-fable-5'
  | 'anthropic/claude-sonnet-4.6'
  | 'anthropic/claude-opus-4.8'
  | 'anthropic/claude-opus-4.7'
  | 'anthropic/claude-opus-4.6'
  | 'anthropic/claude-opus-4.5'
  | 'anthropic/claude-haiku-4.5'
  | 'anthropic/claude-sonnet-4.5'
  | 'anthropic/claude-opus-4.1'

  // Gemini
  | 'google/gemini-3.1-pro-preview'
  | 'google/gemini-3-pro-preview'
  | 'google/gemini-3-flash-preview'
  | 'google/gemini-3.1-flash-lite'
  | 'google/gemini-2.5-pro'
  | 'google/gemini-2.5-flash'
  | 'google/gemini-2.5-flash-lite'

  // X-AI
  | 'x-ai/grok-4-fast'
  | 'x-ai/grok-4.1-fast'
  | 'x-ai/grok-code-fast-1'

  // Qwen
  | 'qwen/qwen3-max'
  | 'qwen/qwen3-coder-plus'
  | 'qwen/qwen3-coder'
  | 'qwen/qwen3-coder:nitro'
  | 'qwen/qwen3-coder-flash'
  | 'qwen/qwen3-235b-a22b-2507'
  | 'qwen/qwen3-235b-a22b-2507:nitro'
  | 'qwen/qwen3-235b-a22b-thinking-2507'
  | 'qwen/qwen3-235b-a22b-thinking-2507:nitro'
  | 'qwen/qwen3-30b-a3b'
  | 'qwen/qwen3-30b-a3b:nitro'

  // DeepSeek
  | 'deepseek/deepseek-v4-pro'
  | 'deepseek-v4-pro'
  | 'deepseek/deepseek-v4-flash'
  | 'deepseek-v4-flash'
  | 'deepseek/deepseek-chat-v3-0324'
  | 'deepseek/deepseek-chat-v3-0324:nitro'
  | 'deepseek/deepseek-r1-0528'
  | 'deepseek/deepseek-r1-0528:nitro'

  // Xiaomi MiMo
  | 'mimo/mimo-v2.5'
  | 'mimo-v2.5'
  | 'mimo/mimo-v2.5-pro'
  | 'mimo-v2.5-pro'

  // Other open source models
  | 'moonshotai/kimi-k2'
  | 'moonshotai/kimi-k2:nitro'
  | 'moonshotai/kimi-k2.6'
  | 'moonshotai/kimi-k2.7-code'
  | 'z-ai/glm-5'
  | 'z-ai/glm-5.1'
  | 'z-ai/glm-4.6'
  | 'z-ai/glm-4.6:nitro'
  | 'z-ai/glm-4.7'
  | 'z-ai/glm-4.7:nitro'
  | 'z-ai/glm-4.7-flash'
  | 'z-ai/glm-4.7-flash:nitro'
  | 'minimax/minimax-m2.5'
  | 'minimax/minimax-m3'
  | (string & {})
