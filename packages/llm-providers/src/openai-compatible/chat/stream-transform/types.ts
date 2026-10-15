import type { MetadataExtractor } from '../openai-compatible-metadata-extractor'
import type { LanguageModelV2CallWarning } from '@ai-sdk/provider'

export type StreamExtractor = ReturnType<
  MetadataExtractor['createStreamExtractor']
>

type OpenAICompatibleChatTokenUsage = {
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  prompt_tokens_details?: { cached_tokens?: number | null } | null
  completion_tokens_details?: {
    reasoning_tokens?: number | null
    accepted_prediction_tokens?: number | null
    rejected_prediction_tokens?: number | null
  } | null
}

export type OpenAICompatibleChatChunkValue =
  | {
      id?: string | null
      created?: number | null
      model?: string | null
      choices: Array<{
        delta?: {
          role?: 'assistant' | null
          content?: string | null
          reasoning_content?: string | null
          reasoning?: string | null
          tool_calls?: Array<{
            index: number
            id?: string | null
            function: {
              name?: string | null
              arguments?: string | null
            }
          }> | null
        } | null
        finish_reason?: string | null
      }>
      usage?: OpenAICompatibleChatTokenUsage | null
    }
  | { error: { message: string } }

export interface ChatStreamTransformerParams {
  warnings: LanguageModelV2CallWarning[]
  includeRawChunks?: boolean
  metadataExtractor?: StreamExtractor
  requiredToolKeys: ReadonlyMap<string, readonly string[]>
  providerOptionsName: string
}

/**
 * FID-2026-0803-010 LLM-A: the streaming transform was inline in
 * openai-compatible-chat-language-model.ts; it now lives here so the unit
 * tests exercise the REAL logic (previously they simulated a copy and could
 * not catch regressions in the most-FID'd code in the repo).
 */
