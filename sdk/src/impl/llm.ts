import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { models, PROFIT_MARGIN } from '@savant-code/common/old-constants'
import {
  isNativeToolCallError,
  type NativeToolCallError,
  type PromptAiSdkFn,
  type StreamErrorChunk,
  type PromptAiSdkStreamFn,
  type PromptAiSdkStructuredInput,
  type PromptAiSdkStructuredOutput,
} from '@savant-code/common/types/contracts/llm'
import { buildArray } from '@savant-code/common/util/array'
import { normalizeProviderRequestBodyForCacheDebug } from '@savant-code/common/util/cache-debug'
import {
  getErrorObject,
  promptAborted,
  promptSuccess,
} from '@savant-code/common/util/error'
import { convertCbToModelMessages } from '@savant-code/common/util/messages'
import { isExplicitlyDefinedModel } from '@savant-code/common/util/model-utils'
import { StopSequenceHandler } from '@savant-code/common/util/stop-sequence'
import {
  safeToJSONValue,
  toJSONValue,
} from '@savant-code/common/util/type-narrowing'
import {
  streamText,
  generateText,
  generateObject,
  NoSuchToolError,
  APICallError,
  ToolCallRepairError,
  InvalidToolInputError,
  TypeValidationError,
} from 'ai'

import {
  getModelForRequest,
  markChatGptOAuthRateLimited,
} from './model-provider'
import { refreshChatGptOAuthToken } from '../credentials'
import { getErrorStatusCode } from '../error-utils'

import type { ModelRequestParams } from './model-provider'
import type {
  OpenRouterProviderOptions,
  OpenRouterProviderRoutingOptions,
} from '@savant-code/common/types/agent-template'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { JSONValue, JSONObject } from '@savant-code/common/types/json'
import type { LanguageModel } from 'ai'
import type z from 'zod/v4'

// Provider routing documentation: https://openrouter.ai/docs/features/provider-routing
const providerOrder = {
  [models.openrouter_claude_sonnet_4]: [
    'Google',
    'Anthropic',
    'Amazon Bedrock',
  ],
  [models.openrouter_claude_sonnet_4_5]: [
    'Google',
    'Anthropic',
    'Amazon Bedrock',
  ],
  [models.openrouter_claude_opus_4]: ['Google', 'Anthropic'],
}

function calculateUsedCredits(params: { costDollars: number }): number {
  const { costDollars } = params

  return Math.round(costDollars * (1 + PROFIT_MARGIN) * 100)
}

export function getProviderOptions(params: {
  model: string
  runId: string
  clientSessionId: string
  providerOptions?: Record<string, JSONObject>
  agentProviderOptions?: OpenRouterProviderRoutingOptions
  n?: number
  cacheDebugCorrelation?: string
  extraSavantCodeMetadata?: Record<string, string>
}): { 'savant-code': JSONObject } {
  const {
    model,
    runId,
    clientSessionId,
    providerOptions,
    agentProviderOptions,
    n,
    cacheDebugCorrelation,
    extraSavantCodeMetadata,
  } = params

  // Both branches produce a provider routing config sent to OpenRouter.
  // When agentProviderOptions is provided, its full shape is used directly.
  // Otherwise, a minimal config with order and allow_fallbacks is built.
  let providerConfig:
    | OpenRouterProviderRoutingOptions
    | {
        order: string[] | undefined
        allow_fallbacks: boolean
      }

  // Use agent's provider options if provided, otherwise use defaults
  if (agentProviderOptions) {
    providerConfig = agentProviderOptions
  } else {
    // Set allow_fallbacks based on whether model is explicitly defined
    const isExplicitlyDefined = isExplicitlyDefinedModel(model)

    providerConfig = {
      order: providerOrder[model as keyof typeof providerOrder],
      allow_fallbacks: !isExplicitlyDefined,
    }
  }

  return {
    ...providerOptions,
    // Could either be "savant-code" or "openaiCompatible"
    'savant-code': {
      ...providerOptions?.['savant-code'],
      // All values here get appended to the request body
      savant_code_metadata: {
        // Caller-supplied keys go first so they can't override reserved
        // identifiers like run_id/client_id/cost_mode that the server trusts.
        ...(extraSavantCodeMetadata ?? {}),
        run_id: runId,
        client_id: clientSessionId,
        ...(n && { n }),
        ...(cacheDebugCorrelation && {
          cache_debug_correlation: cacheDebugCorrelation,
        }),
      },
      provider: providerConfig as JSONObject,
    },
  }
}

// Usage accounting type for OpenRouter/SavantCode backend responses
// Forked from https://github.com/OpenRouterTeam/ai-sdk-provider/
type OpenRouterUsageAccounting = {
  cost: number | null
  costDetails: {
    upstreamInferenceCost: number | null
  }
}

/**
 * Check if an error is an OAuth rate limit error that should trigger fallback.
 */
function isOAuthRateLimitError<T>(error: T): boolean {
  if (!error || typeof error !== 'object') return false

  // Check status code (handles both 'status' from AI SDK and 'statusCode' from our errors)
  const statusCode = getErrorStatusCode(error)
  if (statusCode === 429) return true

  // Check error message for rate limit indicators
  const err = error as {
    message?: string
    responseBody?: string
  }
  const message = (err.message || '').toLowerCase()
  const responseBody = (err.responseBody || '').toLowerCase()

  if (message.includes('rate_limit') || message.includes('rate limit'))
    return true
  if (
    responseBody.includes('rate_limit') ||
    responseBody.includes('rate limit')
  )
    return true

  return false
}

/**
 * Check if an error is an OAuth authentication error (expired/invalid token).
 * This indicates we should try refreshing the token.
 */
function isOAuthAuthError<T>(error: T): boolean {
  if (!error || typeof error !== 'object') return false

  // Check status code (handles both 'status' from AI SDK and 'statusCode' from our errors)
  const statusCode = getErrorStatusCode(error)
  if (statusCode === 401 || statusCode === 403) return true

  // Check error message for auth indicators
  const err = error as {
    message?: string
    responseBody?: string
  }
  const message = (err.message || '').toLowerCase()
  const responseBody = (err.responseBody || '').toLowerCase()

  if (message.includes('unauthorized') || message.includes('invalid_token'))
    return true
  if (message.includes('authentication') || message.includes('expired'))
    return true
  if (
    responseBody.includes('unauthorized') ||
    responseBody.includes('invalid_token')
  )
    return true
  if (
    responseBody.includes('authentication') ||
    responseBody.includes('expired')
  )
    return true

  return false
}

function getModelProvider(model: LanguageModel): string {
  if (typeof model === 'string') return model
  return model.provider
}

function emitCacheDebugProviderRequest(params: {
  callback?: (params: {
    provider: string
    rawBody: JSONValue
    normalizedBody?: JSONValue
  }) => void
  provider: string
  rawBody: JSONValue | null
}) {
  if (!params.callback || params.rawBody === null) return

  const normalized = normalizeProviderRequestBodyForCacheDebug({
    provider: params.provider,
    body: params.rawBody,
  })

  params.callback({
    provider: params.provider,
    rawBody: params.rawBody,
    normalizedBody:
      normalized === undefined ? undefined : toJSONValue(normalized),
  })
}

function emitCacheDebugUsage(params: {
  callback?: (usage: {
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    totalTokens: number
  }) => void
  usage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    cachedInputTokens?: number
  }
}) {
  if (!params.callback) return

  params.callback({
    inputTokens: params.usage.inputTokens ?? 0,
    outputTokens: params.usage.outputTokens ?? 0,
    cachedInputTokens: params.usage.cachedInputTokens ?? 0,
    totalTokens: params.usage.totalTokens ?? 0,
  })
}

export type ChatGptOAuthStreamErrorPolicy =
  'fallback-rate-limit' | 'fail-auth-reconnect' | 'fail-fast' | 'ignore'

export function classifyChatGptOAuthStreamError<T>(params: {
  isChatGptOAuth: boolean
  skipChatGptOAuth?: boolean
  hasYieldedContent: boolean
  error: T
}): ChatGptOAuthStreamErrorPolicy {
  const { isChatGptOAuth, skipChatGptOAuth, hasYieldedContent, error } = params

  if (!isChatGptOAuth || skipChatGptOAuth || hasYieldedContent) {
    return 'ignore'
  }

  if (isOAuthRateLimitError(error)) {
    return 'fallback-rate-limit'
  }

  if (isOAuthAuthError(error)) {
    return 'fail-auth-reconnect'
  }

  return 'fail-fast'
}

export function normalizeNativeToolCallStreamError(
  value: object,
): Extract<StreamErrorChunk, { errorClass: 'native-incomplete' }> | null {
  if (!isNativeToolCallError(value)) {
    return null
  }

  const nativeError: NativeToolCallError = value
  return {
    type: 'error',
    message: `Incomplete arguments for tool ${nativeError.toolName}; retry the tool call with a complete arguments object.`,
    errorClass: 'native-incomplete',
    toolName: nativeError.toolName,
  }
}

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

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping stream due to canceled user input',
    )
    return promptAborted('User cancelled input')
  }

  const modelParams: ModelRequestParams = {
    apiKey: params.apiKey,
    model: params.model,
    skipChatGptOAuth: params.skipChatGptOAuth,
  }
  const { model: aiSDKModel, isChatGptOAuth } =
    await getModelForRequest(modelParams)

  if (isChatGptOAuth) {
    trackEvent({
      event: AnalyticsEvent.CHATGPT_OAUTH_REQUEST,
      userId: userId ?? '',
      properties: {
        model: requestedModel,
        userInputId,
      },
      logger,
    })
  }

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
    // the tool name matches a spawnable agent - transform those to spawn_agents calls.
    experimental_repairToolCall: async ({ toolCall, tools, error }) => {
      const { spawnableAgents = [], localAgentTemplates = {} } = params
      const toolName = toolCall.toolName

      // Check if this is a NoSuchToolError for a spawnable agent
      // If so, transform to spawn_agents call
      if (NoSuchToolError.isInstance(error) && 'spawn_agents' in tools) {
        // Also check for underscore variant (e.g., "file_picker" -> "file-picker")
        const toolNameWithHyphens = toolName.replace(/_/g, '-')

        const matchingAgentId = spawnableAgents.find((agentId) => {
          const withoutVersion = agentId.split('@')[0]
          const parts = withoutVersion.split('/')
          const agentName = parts[parts.length - 1]
          return (
            agentName === toolName ||
            agentName === toolNameWithHyphens ||
            agentId === toolName
          )
        })
        const isSpawnableAgent = matchingAgentId !== undefined
        const isLocalAgent =
          toolName in localAgentTemplates ||
          toolNameWithHyphens in localAgentTemplates

        if (isSpawnableAgent || isLocalAgent) {
          // Transform agent tool call to spawn_agents
          const deepParseJson = (value: JSONValue): JSONValue => {
            if (typeof value === 'string') {
              try {
                return deepParseJson(toJSONValue(JSON.parse(value)))
              } catch {
                return value
              }
            }
            if (Array.isArray(value)) {
              return value.map((v) => deepParseJson(v))
            }
            if (value !== null && typeof value === 'object') {
              return Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, deepParseJson(v)]),
              )
            }
            return value
          }
          let input: Record<string, JSONValue> = {}
          try {
            const rawInput =
              typeof toolCall.input === 'string'
                ? (JSON.parse(toolCall.input) as JSONValue)
                : (toolCall.input as JSONValue)
            input = deepParseJson(rawInput) as Record<string, JSONValue>
          } catch {
            // If parsing fails, use empty object
          }

          const prompt =
            typeof input.prompt === 'string' ? input.prompt : undefined
          const agentParams = Object.fromEntries(
            Object.entries(input).filter(
              ([key, value]) =>
                !(key === 'prompt' && typeof value === 'string'),
            ),
          )

          // Use the matching agent ID or corrected name with hyphens
          const correctedAgentType =
            matchingAgentId ??
            (toolNameWithHyphens in localAgentTemplates
              ? toolNameWithHyphens
              : toolName)

          const spawnAgentsInput = {
            agents: [
              {
                agent_type: correctedAgentType,
                ...(prompt !== undefined && { prompt }),
                ...(Object.keys(agentParams).length > 0 && {
                  params: agentParams,
                }),
              },
            ],
          }

          logger.info(
            { originalToolName: toolName, transformedInput: spawnAgentsInput },
            'Transformed agent tool call to spawn_agents',
          )

          return {
            ...toolCall,
            toolName: 'spawn_agents',
            input: JSON.stringify(spawnAgentsInput),
          }
        }
      }

      // For all other cases (invalid args, unknown tools, etc.), pass through
      // the original tool call.
      logger.info(
        {
          toolName,
          errorType: error.name,
          error: error.message,
        },
        'Tool error - passing through for graceful error handling',
      )
      return toolCall
    },
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

  const responseValue = await response.response
  const messageId = responseValue.id

  const requestMetadata = await response.request
  emitCacheDebugProviderRequest({
    callback: params.onCacheDebugProviderRequestBuilt,
    provider: getModelProvider(aiSDKModel),
    rawBody: safeToJSONValue(requestMetadata.body),
  })

  const usageResult = await response.usage
  emitCacheDebugUsage({
    callback: params.onCacheDebugUsageReceived,
    usage: usageResult,
  })

  // Skip cost tracking for ChatGPT OAuth (user is on their own subscription)
  if (!isChatGptOAuth) {
    const providerMetadataResult = await response.providerMetadata
    const providerMetadata = providerMetadataResult ?? {}

    let costOverrideDollars: number | undefined
    if (providerMetadata['savant-code']) {
      if (providerMetadata['savant-code'].usage) {
        const openrouterUsage = providerMetadata['savant-code']
          .usage as OpenRouterUsageAccounting

        costOverrideDollars =
          (openrouterUsage.cost ?? 0) +
          (openrouterUsage.costDetails?.upstreamInferenceCost ?? 0)
      }
    }

    // Call the cost callback if provided
    if (params.onCostCalculated && costOverrideDollars) {
      await params.onCostCalculated(
        calculateUsedCredits({ costDollars: costOverrideDollars }),
      )
    }
  }

  return promptSuccess(messageId)
}

export async function promptAiSdk(
  params: ParamsOf<PromptAiSdkFn>,
): ReturnType<PromptAiSdkFn> {
  const { logger } = params

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping prompt due to canceled user input',
    )
    return promptAborted('User cancelled input')
  }

  const modelParams: ModelRequestParams = {
    apiKey: params.apiKey,
    model: params.model,
    skipChatGptOAuth: true, // Always use SavantCode backend for non-streaming
  }
  const { model: aiSDKModel } = await getModelForRequest(modelParams)

  const response = await generateText({
    ...params,
    prompt: undefined,
    model: aiSDKModel,
    messages: convertCbToModelMessages(params),
    providerOptions: getProviderOptions({
      ...params,
      agentProviderOptions: params.agentProviderOptions,
      cacheDebugCorrelation: params.cacheDebugCorrelation,
    }),
  })
  emitCacheDebugProviderRequest({
    callback: params.onCacheDebugProviderRequestBuilt,
    provider: getModelProvider(aiSDKModel),
    rawBody: safeToJSONValue(response.request?.body),
  })
  emitCacheDebugUsage({
    callback: params.onCacheDebugUsageReceived,
    usage: response.usage,
  })
  const content = response.text

  const providerMetadata = response.providerMetadata ?? {}
  let costOverrideDollars: number | undefined
  if (providerMetadata['savant-code']) {
    if (providerMetadata['savant-code'].usage) {
      const openrouterUsage = providerMetadata['savant-code']
        .usage as OpenRouterUsageAccounting

      costOverrideDollars =
        (openrouterUsage.cost ?? 0) +
        (openrouterUsage.costDetails?.upstreamInferenceCost ?? 0)
    }
  }

  // Call the cost callback if provided
  if (params.onCostCalculated && costOverrideDollars) {
    await params.onCostCalculated(
      calculateUsedCredits({ costDollars: costOverrideDollars }),
    )
  }

  return promptSuccess(content)
}

export async function promptAiSdkStructured<T>(
  params: PromptAiSdkStructuredInput<T>,
): PromptAiSdkStructuredOutput<T> {
  const { logger } = params

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping structured prompt due to canceled user input',
    )
    return promptAborted('User cancelled input')
  }
  const modelParams: ModelRequestParams = {
    apiKey: params.apiKey,
    model: params.model,
    skipChatGptOAuth: true, // Always use SavantCode backend for non-streaming
  }
  const { model: aiSDKModel } = await getModelForRequest(modelParams)

  const response = await generateObject<z.ZodType<T>, 'object'>({
    ...params,
    prompt: undefined,
    model: aiSDKModel,
    output: 'object',
    messages: convertCbToModelMessages(params),
    providerOptions: getProviderOptions({
      ...params,
      agentProviderOptions: params.agentProviderOptions,
      cacheDebugCorrelation: params.cacheDebugCorrelation,
    }),
  })

  emitCacheDebugProviderRequest({
    callback: params.onCacheDebugProviderRequestBuilt,
    provider: getModelProvider(aiSDKModel),
    rawBody: safeToJSONValue(response.request?.body),
  })
  emitCacheDebugUsage({
    callback: params.onCacheDebugUsageReceived,
    usage: response.usage,
  })

  const content = response.object

  const providerMetadata = response.providerMetadata ?? {}
  let costOverrideDollars: number | undefined
  if (providerMetadata['savant-code']) {
    if (providerMetadata['savant-code'].usage) {
      const openrouterUsage = providerMetadata['savant-code']
        .usage as OpenRouterUsageAccounting

      costOverrideDollars =
        (openrouterUsage.cost ?? 0) +
        (openrouterUsage.costDetails?.upstreamInferenceCost ?? 0)
    }
  }

  // Call the cost callback if provided
  if (params.onCostCalculated && costOverrideDollars) {
    await params.onCostCalculated(
      calculateUsedCredits({ costDollars: costOverrideDollars }),
    )
  }

  return promptSuccess(content)
}
