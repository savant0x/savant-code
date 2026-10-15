import { generateId } from '@ai-sdk/provider-utils'

import { getResponseMetadata } from '../get-response-metadata'
import { mapOpenAICompatibleFinishReason } from '../map-openai-compatible-finish-reason'
import {
  isCompleteKnownToolCallArguments,
  isStaleToolArgumentFragment,
} from './tool-arguments'

import type { ChatStreamTransformerState } from './state'
import type { OpenAICompatibleChatChunkValue, StreamExtractor } from './types'
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider'
import type { ParseResult } from '@ai-sdk/provider-utils'
import type { JSONValue } from '@savant-code/common/types/json'

export function transformChunk(params: {
  chunk: ParseResult<OpenAICompatibleChatChunkValue>
  controller: TransformStreamDefaultController<LanguageModelV2StreamPart>
  state: ChatStreamTransformerState
  includeRawChunks?: boolean
  metadataExtractor?: StreamExtractor
  requiredToolKeys: ReadonlyMap<string, readonly string[]>
}): void {
  const {
    chunk,
    controller,
    state,
    includeRawChunks,
    metadataExtractor,
    requiredToolKeys,
  } = params
  // handle failed chunk parsing / validation:
  if (!chunk.success) {
    state.finishReason = 'error'
    controller.enqueue({ type: 'error', error: chunk.error })
    return
  }
  const value = chunk.value

  // Emit raw chunk if requested (after success check so rawValue is guaranteed)
  if (includeRawChunks) {
    controller.enqueue({ type: 'raw', rawValue: chunk.rawValue })
  }

  metadataExtractor?.processChunk(chunk.rawValue as Record<string, JSONValue>)

  // handle error chunks:
  if ('error' in value) {
    state.finishReason = 'error'
    controller.enqueue({ type: 'error', error: value.error.message })
    return
  }

  if (state.isFirstChunk) {
    state.isFirstChunk = false

    controller.enqueue({
      type: 'response-metadata',
      ...getResponseMetadata(value),
    })
  }

  if (value.usage != null) {
    const {
      prompt_tokens,
      completion_tokens,
      total_tokens,
      prompt_tokens_details,
      completion_tokens_details,
    } = value.usage

    state.usage.promptTokens = prompt_tokens ?? undefined
    state.usage.completionTokens = completion_tokens ?? undefined
    state.usage.totalTokens = total_tokens ?? undefined
    if (completion_tokens_details?.reasoning_tokens != null) {
      state.usage.completionTokensDetails.reasoningTokens =
        completion_tokens_details?.reasoning_tokens
    }
    if (completion_tokens_details?.accepted_prediction_tokens != null) {
      state.usage.completionTokensDetails.acceptedPredictionTokens =
        completion_tokens_details?.accepted_prediction_tokens
    }
    if (completion_tokens_details?.rejected_prediction_tokens != null) {
      state.usage.completionTokensDetails.rejectedPredictionTokens =
        completion_tokens_details?.rejected_prediction_tokens
    }
    if (prompt_tokens_details?.cached_tokens != null) {
      state.usage.promptTokensDetails.cachedTokens =
        prompt_tokens_details?.cached_tokens
    }
  }

  const choice = value.choices[0]

  if (choice?.finish_reason != null) {
    state.finishReason = mapOpenAICompatibleFinishReason(choice.finish_reason)
  }

  if (choice?.delta == null) {
    return
  }

  const delta = choice.delta

  // enqueue reasoning before text deltas:
  const reasoningContent = delta.reasoning_content ?? delta.reasoning
  if (reasoningContent) {
    if (!state.isActiveReasoning) {
      controller.enqueue({
        type: 'reasoning-start',
        id: 'reasoning-0',
      })
      state.isActiveReasoning = true
    }

    controller.enqueue({
      type: 'reasoning-delta',
      id: 'reasoning-0',
      delta: reasoningContent,
    })
  }

  if (delta.content) {
    if (!state.isActiveText) {
      controller.enqueue({ type: 'text-start', id: 'txt-0' })
      state.isActiveText = true
    }

    controller.enqueue({
      type: 'text-delta',
      id: 'txt-0',
      delta: delta.content,
    })
  }

  if (delta.tool_calls != null) {
    for (const toolCallDelta of delta.tool_calls) {
      const index = toolCallDelta.index

      if (state.toolCalls[index] == null) {
        if (toolCallDelta.function?.name == null) {
          // FID-2026-1009-006: a tool-call delta without a function name
          // previously threw InvalidResponseDataError, killing the whole
          // session. Providers emit such orphan deltas at stream end or
          // after malformed native templating. Skip the orphan (it carries
          // no executable data) instead of throwing — the stream, and the
          // session, survive.
          continue
        }

        // UPDATED (James): Generate an ID if the provider doesn't include one (e.g., GLM models)
        const toolCallId = toolCallDelta.id ?? generateId()

        controller.enqueue({
          type: 'tool-input-start',
          id: toolCallId,
          toolName: toolCallDelta.function.name,
        })

        state.toolCalls[index] = {
          id: toolCallId,
          type: 'function',
          function: {
            name: toolCallDelta.function.name,
            arguments: toolCallDelta.function.arguments ?? '',
          },
          hasFinished: false,
        }

        const toolCall = state.toolCalls[index]

        if (
          toolCall.function?.name != null &&
          toolCall.function?.arguments != null
        ) {
          // Send a delta only when it contributes to the canonical
          // argument stream. Complete stale placeholders are held
          // back until a replacement object arrives.
          if (
            toolCall.function.arguments.length > 0 &&
            !isStaleToolArgumentFragment(
              toolCall.function.arguments,
              toolCall.function.name,
              requiredToolKeys,
            )
          ) {
            controller.enqueue({
              type: 'tool-input-delta',
              id: toolCall.id,
              delta: toolCall.function.arguments,
            })
          }

          // check if tool call is complete
          // (some providers send the full tool call in one chunk):
          if (
            isCompleteKnownToolCallArguments(
              toolCall.function.arguments,
              toolCall.function.name,
              requiredToolKeys,
            )
          ) {
            controller.enqueue({
              type: 'tool-input-end',
              id: toolCall.id,
            })

            controller.enqueue({
              type: 'tool-call',
              toolCallId: toolCall.id ?? generateId(),
              toolName: toolCall.function.name,
              input: toolCall.function.arguments,
            })
            toolCall.hasFinished = true
          }
        }

        continue
      }

      // existing tool call, merge if not finished
      const toolCall = state.toolCalls[index]

      if (toolCall.hasFinished) {
        continue
      }

      if (toolCallDelta.function?.arguments != null) {
        const delta = toolCallDelta.function.arguments
        const accumulated = toolCall.function!.arguments
        // A "stale fragment" is accumulated content that already
        // forms a complete JSON value but is not a usable object for
        // this tool (placeholder `{}`, an object missing declared
        // required keys, `[]`, `null`, a string literal, etc.).
        // Truncated JSON has `reason === 'invalid-json'` and is NOT
        // stale — it keeps accumulating.
        const isStaleFragment = isStaleToolArgumentFragment(
          accumulated,
          toolCall.function.name,
          requiredToolKeys,
        )

        // Replace a stale fragment with a fresh JSON object fragment
        // instead of concatenating into invalid JSON
        // (`[]{...}`, `{}{\"thought\":...`, `\"{...}\"{...}`).
        if (isStaleFragment && delta.trimStart().startsWith('{')) {
          toolCall.function!.arguments = delta
        } else {
          toolCall.function!.arguments += delta
        }
      }

      // send delta
      controller.enqueue({
        type: 'tool-input-delta',
        id: toolCall.id,
        delta: toolCallDelta.function.arguments ?? '',
      })

      // check if tool call is complete
      if (
        toolCall.function?.name != null &&
        toolCall.function?.arguments != null &&
        isCompleteKnownToolCallArguments(
          toolCall.function.arguments,
          toolCall.function.name,
          requiredToolKeys,
        )
      ) {
        controller.enqueue({
          type: 'tool-input-end',
          id: toolCall.id,
        })

        controller.enqueue({
          type: 'tool-call',
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        })
        toolCall.hasFinished = true
      }
    }
  }
}
