/**
 * LLM entry points (FID-2026-0805-003). Implementation moved to
 * llm/{usage,errors,repair-tool-call,stream,prompts}.ts; this file preserves
 * the original public API surface.
 */

export {
  classifyChatGptOAuthStreamError,
  normalizeNativeToolCallStreamError,
} from './llm/errors'
export type { ChatGptOAuthStreamErrorPolicy } from './llm/errors'
export { promptAiSdk, promptAiSdkStructured } from './llm/prompts'
export { promptAiSdkStream } from './llm/stream'
export { getProviderOptions } from './llm/usage'
