import { InvalidResponseDataError } from '@ai-sdk/provider'
import { generateId } from '@ai-sdk/provider-utils'

import { getResponseMetadata } from './get-response-metadata'
import { mapOpenAICompatibleFinishReason } from './map-openai-compatible-finish-reason'

import type { MetadataExtractor } from './openai-compatible-metadata-extractor'
import type {
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider'
import type { ParseResult } from '@ai-sdk/provider-utils'
import type { JSONValue } from '@savant-code/common/types/json'



type StreamExtractor = ReturnType<MetadataExtractor['createStreamExtractor']>

export type ParsedToolArguments =
  | { ok: true; value: Record<string, JSONValue> }
  | { ok: false; reason: 'invalid-json' }
  | { ok: false; reason: 'non-object'; value: JSONValue }

function isJsonObject(value: JSONValue): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonObjectArguments(args: string): ParsedToolArguments {
  try {
    const parsed = JSON.parse(args) as JSONValue
    return isJsonObject(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, reason: 'non-object', value: parsed }
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
}

function hasRequiredToolKeys(
  value: Record<string, JSONValue>,
  requiredKeys: readonly string[] | undefined,
): boolean {
  if (requiredKeys === undefined) {
    return Object.keys(value).length > 0
  }

  return requiredKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  )
}

function isCompleteKnownToolCallArguments(
  args: string,
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (!requiredToolKeys.has(toolName)) {
    return false
  }

  return isCompleteToolCallArguments(args, requiredToolKeys.get(toolName))
}

function isStaleToolArgumentFragment(
  args: string,
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  const requiredKeys = requiredToolKeys.get(toolName)
  if (requiredKeys === undefined) {
    return false
  }

  const parsed = parseToolCallArguments(args)
  return (
    (!parsed.ok && parsed.reason === 'non-object') ||
    (parsed.ok && !hasRequiredToolKeys(parsed.value, requiredKeys))
  )
}

export function getRequiredToolKeys(
  tools: LanguageModelV2CallOptions['tools'],
): ReadonlyMap<string, readonly string[]> {
  const requiredKeys = new Map<string, readonly string[]>()

  for (const tool of tools ?? []) {
    if (tool.type !== 'function') {
      continue
    }

    const schema = tool.inputSchema
    const keys = schema.required ?? []
    requiredKeys.set(tool.name, keys)
  }

  return requiredKeys
}

/**
 * Parse tool-call arguments and report whether they form a complete JSON object
 * with the declared top-level required keys present. Value types and semantic
 * constraints remain the executor's responsibility.
 */
// FID-2026-0803-002 LLM-7: the previous wrapper returned `parsed` from both
// branches — the length check was a no-op. Delegate directly.
export function parseToolCallArguments(args: string): ParsedToolArguments {
  return parseJsonObjectArguments(args)
}

/**
 * Returns true only when the accumulated arguments form a non-empty JSON object
 * with the required keys for the tool. An explicitly empty required-key list
 * permits `{}` for zero-argument tools, but an unknown schema does not.
 */
export function isCompleteToolCallArguments(
  args: string,
  requiredKeys?: readonly string[],
): boolean {
  const parsed = parseJsonObjectArguments(args)
  return parsed.ok && hasRequiredToolKeys(parsed.value, requiredKeys)
}

/**
 * Structural view of the OpenAI-compatible chat completion chunk consumed by
 * the stream transform. Mirrors the (deliberately narrow) zod chunk schema in
 * openai-compatible-chat-language-model.ts — kept as a plain type so the
 * transform can be unit-tested without re-parsing every chunk.
 */
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

  const toolCalls: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
    hasFinished: boolean
  }> = []

  let finishReason: LanguageModelV2FinishReason = 'unknown'
  const usage: {
    completionTokens: number | undefined
    completionTokensDetails: {
      reasoningTokens: number | undefined
      acceptedPredictionTokens: number | undefined
      rejectedPredictionTokens: number | undefined
    }
    promptTokens: number | undefined
    promptTokensDetails: {
      cachedTokens: number | undefined
    }
    totalTokens: number | undefined
  } = {
    completionTokens: undefined,
    completionTokensDetails: {
      reasoningTokens: undefined,
      acceptedPredictionTokens: undefined,
      rejectedPredictionTokens: undefined,
    },
    promptTokens: undefined,
    promptTokensDetails: {
      cachedTokens: undefined,
    },
    totalTokens: undefined,
  }
  let isFirstChunk = true
  let isActiveReasoning = false
  let isActiveText = false

  return new TransformStream<
    ParseResult<OpenAICompatibleChatChunkValue>,
    LanguageModelV2StreamPart
  >({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings })
    },

    transform(chunk, controller) {
      // handle failed chunk parsing / validation:
      if (!chunk.success) {
        finishReason = 'error'
        controller.enqueue({ type: 'error', error: chunk.error })
        return
      }
      const value = chunk.value

      // Emit raw chunk if requested (after success check so rawValue is guaranteed)
      if (includeRawChunks) {
        controller.enqueue({ type: 'raw', rawValue: chunk.rawValue })
      }

      metadataExtractor?.processChunk(
        chunk.rawValue as Record<string, JSONValue>,
      )

      // handle error chunks:
      if ('error' in value) {
        finishReason = 'error'
        controller.enqueue({ type: 'error', error: value.error.message })
        return
      }

      if (isFirstChunk) {
        isFirstChunk = false

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

        usage.promptTokens = prompt_tokens ?? undefined
        usage.completionTokens = completion_tokens ?? undefined
        usage.totalTokens = total_tokens ?? undefined
        if (completion_tokens_details?.reasoning_tokens != null) {
          usage.completionTokensDetails.reasoningTokens =
            completion_tokens_details?.reasoning_tokens
        }
        if (
          completion_tokens_details?.accepted_prediction_tokens != null
        ) {
          usage.completionTokensDetails.acceptedPredictionTokens =
            completion_tokens_details?.accepted_prediction_tokens
        }
        if (
          completion_tokens_details?.rejected_prediction_tokens != null
        ) {
          usage.completionTokensDetails.rejectedPredictionTokens =
            completion_tokens_details?.rejected_prediction_tokens
        }
        if (prompt_tokens_details?.cached_tokens != null) {
          usage.promptTokensDetails.cachedTokens =
            prompt_tokens_details?.cached_tokens
        }
      }

      const choice = value.choices[0]

      if (choice?.finish_reason != null) {
        finishReason = mapOpenAICompatibleFinishReason(
          choice.finish_reason,
        )
      }

      if (choice?.delta == null) {
        return
      }

      const delta = choice.delta

      // enqueue reasoning before text deltas:
      const reasoningContent = delta.reasoning_content ?? delta.reasoning
      if (reasoningContent) {
        if (!isActiveReasoning) {
          controller.enqueue({
            type: 'reasoning-start',
            id: 'reasoning-0',
          })
          isActiveReasoning = true
        }

        controller.enqueue({
          type: 'reasoning-delta',
          id: 'reasoning-0',
          delta: reasoningContent,
        })
      }

      if (delta.content) {
        if (!isActiveText) {
          controller.enqueue({ type: 'text-start', id: 'txt-0' })
          isActiveText = true
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

          if (toolCalls[index] == null) {
            if (toolCallDelta.function?.name == null) {
              throw new InvalidResponseDataError({
                data: toolCallDelta,
                message: `Expected 'function.name' to be a string.`,
              })
            }

            // UPDATED (James): Generate an ID if the provider doesn't include one (e.g., GLM models)
            const toolCallId = toolCallDelta.id ?? generateId()

            controller.enqueue({
              type: 'tool-input-start',
              id: toolCallId,
              toolName: toolCallDelta.function.name,
            })

            toolCalls[index] = {
              id: toolCallId,
              type: 'function',
              function: {
                name: toolCallDelta.function.name,
                arguments: toolCallDelta.function.arguments ?? '',
              },
              hasFinished: false,
            }

            const toolCall = toolCalls[index]

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
          const toolCall = toolCalls[index]

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
    },

    flush(controller) {
      if (isActiveReasoning) {
        controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' })
      }

      if (isActiveText) {
        controller.enqueue({ type: 'text-end', id: 'txt-0' })
      }

      // Go through all tool calls and close each input lifecycle exactly
      // once. Never emit a malformed or schema-incomplete candidate as an
      // executable tool-call.
      for (const toolCall of toolCalls.filter(
        (toolCall) => !toolCall.hasFinished,
      )) {
        controller.enqueue({
          type: 'tool-input-end',
          id: toolCall.id,
        })

        if (
          isCompleteKnownToolCallArguments(
            toolCall.function.arguments,
            toolCall.function.name,
            requiredToolKeys,
          )
        ) {
          controller.enqueue({
            type: 'tool-call',
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            input: toolCall.function.arguments,
          })
        } else {
          finishReason = 'error'
          controller.enqueue({
            type: 'error',
            error: {
              type: 'native-incomplete',
              toolName: toolCall.function.name,
            },
          })
        }
      }

      const providerMetadata: SharedV2ProviderMetadata = {
        [providerOptionsName]: {},
        ...metadataExtractor?.buildMetadata(),
      }
      if (
        usage.completionTokensDetails.acceptedPredictionTokens != null
      ) {
        providerMetadata[providerOptionsName].acceptedPredictionTokens =
          usage.completionTokensDetails.acceptedPredictionTokens
      }
      if (
        usage.completionTokensDetails.rejectedPredictionTokens != null
      ) {
        providerMetadata[providerOptionsName].rejectedPredictionTokens =
          usage.completionTokensDetails.rejectedPredictionTokens
      }

      controller.enqueue({
        type: 'finish',
        finishReason,
        usage: {
          inputTokens: usage.promptTokens ?? undefined,
          outputTokens: usage.completionTokens ?? undefined,
          totalTokens: usage.totalTokens ?? undefined,
          reasoningTokens:
            usage.completionTokensDetails.reasoningTokens ?? undefined,
          cachedInputTokens:
            usage.promptTokensDetails.cachedTokens ?? undefined,
        },
        providerMetadata,
      })
    },
  })
}
