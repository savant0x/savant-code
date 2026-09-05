/** Streaming LLM prompt entry point (FID-2026-0805-003). */

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { type PromptAiSdkStreamFn } from '@savant-code/common/types/contracts/llm'
import { buildArray } from '@savant-code/common/util/array'
import { getErrorObject } from '@savant-code/common/util/error'
import { convertCbToModelMessages } from '@savant-code/common/util/messages'
import { StopSequenceHandler } from '@savant-code/common/util/stop-sequence'
import {
  streamText,
  NoSuchToolError,
  APICallError,
  ToolCallRepairError,
  InvalidToolInputError,
  TypeValidationError,
} from 'ai'

import { refreshChatGptOAuthToken } from '../../credentials'
import { markChatGptOAuthRateLimited } from '../model-provider'
import {
  classifyChatGptOAuthStreamError,
  normalizeNativeToolCallStreamError,
} from './errors'
import { createRepairToolCall } from './repair-tool-call-callback'
import { finalizeLlmStream } from './stream-finalize'
import { prepareLlmStreamRequest } from './stream-request-setup'
import { getProviderOptions } from './usage'

import type { OpenRouterProviderOptions } from '@savant-code/common/types/agent-template'
import type { ParamsOf } from '@savant-code/common/types/function-params'

export async function* promptAiSdkStream(
  params: ParamsOf<PromptAiSdkStreamFn> & {
    skipChatGptOAuth?: boolean
    chatGptOAuthRetried?: boolean
  },
): ReturnType<PromptAiSdkStreamFn> {
  const { providerOptions: originalProviderOptions, ...streamParams } = params

  const {
    logger,
    trackEvent,
    userId,
    userInputId,
    model: requestedModel,
  } = params
  const agentChunkMetadata =
    params.agentId != null ? { agentId: params.agentId } : undefined

  const prepared = await prepareLlmStreamRequest(params, {
    logger,
    trackEvent,
  })
  if (prepared.aborted) return prepared.result
  const { aiSDKModel, isChatGptOAuth } = prepared

  const response = streamText({
    ...streamParams,
    prompt: undefined,
    model: aiSDKModel,
    messages: convertCbToModelMessages(params),
    ...(isChatGptOAuth && { maxRetries: 0 }),
    // For ChatGPT OAuth direct, don't send savant-code metadata/provider options to OpenAI
    ...(isChatGptOAuth
      ? {}
      : {
          providerOptions: getProviderOptions({
            ...params,
            providerOptions: originalProviderOptions,
            agentProviderOptions: params.agentProviderOptions,
          }),
        }),
    // Handle tool call errors gracefully by passing them through to our validation layer
    // instead of throwing (which would halt the agent). The only special case is when
    // the tool name matches a spawnable agent - transform those to spawn_agents calls.    // Handle tool call errors gracefully by passing them through to our validation layer
    // instead of throwing (which would halt the agent). The only special case is when
    // the tool name matches a spawnable agent - transform those to spawn_agents calls.
    experimental_repairToolCall: createRepairToolCall({
      logger,
      params,
    }),
  })

  const stopSequenceHandler = new StopSequenceHandler(params.stopSequences)

  // Track if we've yielded any content - if so, we can't safely fall back
  let hasYieldedContent = false

  for await (const chunkValue of response.fullStream) {
    if (chunkValue.type !== 'text-delta') {
      const flushed = stopSequenceHandler.flush()
      if (flushed) {
        hasYieldedContent = true
        yield {
          type: 'text',
          text: flushed,
          ...(agentChunkMetadata ?? {}),
        }
      }
    }
    if (chunkValue.type === 'error') {
      // Error chunks from fullStream are non-network errors (tool failures, model issues, rate limits, etc.)
      // Network errors which cannot be recovered from are thrown, not yielded as chunks.
      // The OpenAI-compatible provider uses a typed object for incomplete native
      // arguments so this path never relies on parsing a user-facing message.
      if (typeof chunkValue.error === 'object' && chunkValue.error !== null) {
        const nativeError = normalizeNativeToolCallStreamError(chunkValue.error)
        if (nativeError !== null) {
          yield nativeError
          continue
        }
      }

      const errorBody = APICallError.isInstance(chunkValue.error)
        ? chunkValue.error.responseBody
        : undefined
      const mainErrorMessage =
        chunkValue.error instanceof Error
          ? chunkValue.error.message
          : typeof chunkValue.error === 'string'
            ? chunkValue.error
            : JSON.stringify(chunkValue.error)
      const errorMessage = buildArray([mainErrorMessage, errorBody]).join('\n')

      // Pass these errors back to the agent so it can see what went wrong and retry.
      // Note: If you find any other error types that should be passed through to the agent, add them here!
      if (
        NoSuchToolError.isInstance(chunkValue.error) ||
        InvalidToolInputError.isInstance(chunkValue.error) ||
        ToolCallRepairError.isInstance(chunkValue.error) ||
        TypeValidationError.isInstance(chunkValue.error)
      ) {
        logger.warn(
          {
            chunk: { ...chunkValue, error: undefined },
            error: getErrorObject(chunkValue.error),
            model: params.model,
          },
          'Tool call error in AI SDK stream - passing through to agent to retry',
        )
        yield {
          type: 'error',
          message: errorMessage,
        }
        continue
      }

      const chatGptErrorPolicy = classifyChatGptOAuthStreamError({
        isChatGptOAuth,
        skipChatGptOAuth: params.skipChatGptOAuth,
        hasYieldedContent,
        error: chunkValue.error,
      })

      if (chatGptErrorPolicy === 'fallback-rate-limit') {
        logger.warn(
          { error: getErrorObject(chunkValue.error) },
          'ChatGPT OAuth rate limited during stream',
        )

        trackEvent({
          event: AnalyticsEvent.CHATGPT_OAUTH_RATE_LIMITED,
          userId: userId ?? '',
          properties: {
            model: requestedModel,
            userInputId,
          },
          logger,
        })

        markChatGptOAuthRateLimited()

        const fallbackResult = yield* promptAiSdkStream({
          ...params,
          skipChatGptOAuth: true,
        })
        return fallbackResult
      }

      if (chatGptErrorPolicy === 'fail-auth-reconnect') {
        logger.info(
          { error: getErrorObject(chunkValue.error) },
          'ChatGPT OAuth auth error during stream, attempting token refresh',
        )

        trackEvent({
          event: AnalyticsEvent.CHATGPT_OAUTH_AUTH_ERROR,
          userId: userId ?? '',
          properties: {
            model: requestedModel,
            userInputId,
          },
          logger,
        })

        // Try refreshing the token and retrying once before failing/falling back
        if (!params.chatGptOAuthRetried) {
          const refreshed = await refreshChatGptOAuthToken()
          if (refreshed) {
            logger.info(
              { model: requestedModel },
              'ChatGPT OAuth token refreshed, retrying request',
            )
            const retryResult = yield* promptAiSdkStream({
              ...params,
              chatGptOAuthRetried: true,
            })
            return retryResult
          }
          logger.warn(
            { model: requestedModel },
            'ChatGPT OAuth token refresh failed, unable to recover',
          )
        }

        // Fall back to SavantCode backend
        const fallbackResult = yield* promptAiSdkStream({
          ...params,
          skipChatGptOAuth: true,
        })
        return fallbackResult
      }

      logger.error(
        {
          chunk: { ...chunkValue, error: undefined },
          error: getErrorObject(chunkValue.error),
          model: params.model,
        },
        'Error in AI SDK stream',
      )

      // For all other errors, throw them -- they are fatal.
      throw chunkValue.error
    }
    if (chunkValue.type === 'reasoning-delta') {
      const reasoningExcluded = (['openrouter', 'savant-code'] as const).some(
        (p) =>
          (params.providerOptions?.[p] as OpenRouterProviderOptions | undefined)
            ?.reasoning?.exclude,
      )
      if (!reasoningExcluded) {
        // FID-2026-0803-003 SDK-2: reasoning is user-visible output — once
        // streamed, a ChatGPT OAuth fallback would re-emit it.
        hasYieldedContent = true
        yield {
          type: 'reasoning',
          text: chunkValue.text,
        }
      }
    }
    if (chunkValue.type === 'text-delta') {
      if (!params.stopSequences) {
        if (chunkValue.text) {
          hasYieldedContent = true
          yield {
            type: 'text',
            text: chunkValue.text,
            ...(agentChunkMetadata ?? {}),
          }
        }
        continue
      }

      const stopSequenceResult = stopSequenceHandler.process(chunkValue.text)
      if (stopSequenceResult.text) {
        hasYieldedContent = true
        yield {
          type: 'text',
          text: stopSequenceResult.text,
          ...(agentChunkMetadata ?? {}),
        }
      }
    }
    if (chunkValue.type === 'tool-call') {
      // FID-2026-0803-003 SDK-2: tool calls are actionable output — falling
      // back after one is yielded would deliver it twice (double execution).
      hasYieldedContent = true
      yield chunkValue
    }
  }
  const flushed = stopSequenceHandler.flush()
  if (flushed) {
    yield {
      type: 'text',
      text: flushed,
      ...(agentChunkMetadata ?? {}),
    }
  }

  return finalizeLlmStream(response, aiSDKModel, isChatGptOAuth, params)
}
