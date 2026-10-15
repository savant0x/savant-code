import { flushStream } from './stream-transform/flush-handler'
import { createChatStreamTransformerState } from './stream-transform/state'
import { transformChunk } from './stream-transform/transform-handler'

import type {
  OpenAICompatibleChatChunkValue,
  ChatStreamTransformerParams,
} from './stream-transform/types'
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider'
import type { ParseResult } from '@ai-sdk/provider-utils'

export type { ParsedToolArguments } from './stream-transform/tool-arguments'
export {
  getRequiredToolKeys,
  isCompleteToolCallArguments,
  parseToolCallArguments,
} from './stream-transform/tool-arguments'
export type {
  ChatStreamTransformerParams,
  OpenAICompatibleChatChunkValue,
} from './stream-transform/types'

export function createChatStreamTransformer(
  params: ChatStreamTransformerParams,
): TransformStream<
  ParseResult<OpenAICompatibleChatChunkValue>,
  LanguageModelV2StreamPart
> {
  const {
    warnings,
    includeRawChunks,
    metadataExtractor,
    requiredToolKeys,
    providerOptionsName,
  } = params

  const state = createChatStreamTransformerState()

  return new TransformStream<
    ParseResult<OpenAICompatibleChatChunkValue>,
    LanguageModelV2StreamPart
  >({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings })
    },

    transform(chunk, controller) {
      transformChunk({
        chunk,
        controller,
        state,
        includeRawChunks,
        metadataExtractor,
        requiredToolKeys,
      })
    },

    flush(controller) {
      flushStream({
        controller,
        state,
        metadataExtractor,
        providerOptionsName,
        requiredToolKeys,
      })
    },
  })
}
