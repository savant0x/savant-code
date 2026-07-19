/**
 * Model provider abstraction for routing requests to the appropriate LLM provider.
 *
 * This module handles:
 * - ChatGPT OAuth: Direct requests to OpenAI API using user's OAuth token
 * - Default: Requests through SavantCode backend (which routes to OpenRouter)
 */

import path from 'path'

import { BYOK_OPENROUTER_HEADER } from '@savant-code/common/constants/byok'
import { isFreeMode } from '@savant-code/common/constants/free-agents'
import {
  CHATGPT_BACKEND_BASE_URL,
  CHATGPT_OAUTH_ENABLED,
  isChatGptOAuthModelAllowed,
  isOpenAIProviderModel,
  toOpenAIModelId,
} from '@savant-code/common/constants/chatgpt-oauth'
import { isTransientNetworkError } from '@savant-code/common/util/error'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@savant-code/llm-providers/openai-compatible'
import { APICallError } from 'ai'

import { getWebsiteUrl } from '../constants'
import { getValidChatGptOAuthCredentials } from '../credentials'
import {
  getByokOpenrouterApiKeyFromEnv,
  getInferenceApiKeyFromEnv,
  getInferenceBaseUrlFromEnv,
} from '../env'
import { resolveOpenRouterApiKey } from './openrouter-key-resolver'
import {
  createChatGptBackendFetch,
  extractChatGptAccountId,
} from './chatgpt-backend-fetch'

import type { LanguageModel } from 'ai'

// ============================================================================
// ChatGPT OAuth Rate Limit Cache
// ============================================================================

/** Timestamp (ms) when ChatGPT OAuth rate limit expires, or null if not rate-limited */
let chatGptOAuthRateLimitedUntil: number | null = null

/**
 * Mark ChatGPT OAuth as rate-limited. Subsequent requests will skip direct ChatGPT OAuth
 * and use SavantCode backend until the reset time.
 */
export function markChatGptOAuthRateLimited(resetAt?: Date): void {
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
  chatGptOAuthRateLimitedUntil = resetAt
    ? resetAt.getTime()
    : fiveMinutesFromNow
}

/**
 * Check if ChatGPT OAuth is currently rate-limited.
 */
export function isChatGptOAuthRateLimited(): boolean {
  if (chatGptOAuthRateLimitedUntil === null) {
    return false
  }
  if (Date.now() >= chatGptOAuthRateLimitedUntil) {
    chatGptOAuthRateLimitedUntil = null
    return false
  }
  return true
}

/**
 * Reset the ChatGPT OAuth rate-limit cache.
 * Call this when user reconnects their ChatGPT subscription.
 */
export function resetChatGptOAuthRateLimit(): void {
  chatGptOAuthRateLimitedUntil = null
}

/**
 * Parameters for requesting a model.
 */
export interface ModelRequestParams {
  /** SavantCode API key for backend authentication */
  apiKey: string
  /** Model ID (OpenRouter format, e.g., "anthropic/claude-sonnet-4") */
  model: string
  /** If true, skip ChatGPT OAuth and use SavantCode backend (for fallback after rate limit) */
  skipChatGptOAuth?: boolean
  /** Cost mode (e.g. 'free') — affects fallback behavior for OAuth routes */
  costMode?: string
}

/**
 * Result from getModelForRequest.
 */
export interface ModelResult {
  /** The language model to use for requests */
  model: LanguageModel
  /** Whether this model uses ChatGPT OAuth direct (affects cost tracking) */
  isChatGptOAuth: boolean
}

// Usage accounting type for OpenRouter/SavantCode backend responses
type OpenRouterUsageAccounting = {
  cost: number | null
  costDetails: {
    upstreamInferenceCost: number | null
  }
}

/**
 * Get the appropriate model for a request.
 *
 * If ChatGPT OAuth credentials are available and the model is an OpenAI model,
 * returns an OpenAI direct model. Otherwise, returns the SavantCode backend model.
 *
 * This function is async because it may need to refresh the OAuth token.
 */
export async function getModelForRequest(
  params: ModelRequestParams,
): Promise<ModelResult> {
  const { apiKey, model, skipChatGptOAuth, costMode } = params

  // Check if we should use ChatGPT OAuth direct
  // Only attempt for allowlisted models; non-allowlisted models silently fall through to backend.
  if (
    CHATGPT_OAUTH_ENABLED &&
    !skipChatGptOAuth &&
    isOpenAIProviderModel(model) &&
    isChatGptOAuthModelAllowed(model)
  ) {
    // In free mode, rate-limited ChatGPT OAuth must not silently fall through to
    // the SavantCode backend — savant-free should only use the direct OpenAI route or fail.
    if (isChatGptOAuthRateLimited()) {
      if (isFreeMode(costMode)) {
        throw new Error(
          'ChatGPT rate limit reached. Please wait a few minutes and try again.',
        )
      }
    } else {
      const chatGptOAuthCredentials = await getValidChatGptOAuthCredentials()

      if (chatGptOAuthCredentials) {
        return {
          model: createOpenAIOAuthModel(
            model,
            chatGptOAuthCredentials.accessToken,
          ),
          isChatGptOAuth: true,
        }
      }

      // In free mode, if credentials are unavailable, don't fall through to backend.
      if (isFreeMode(costMode)) {
        throw new Error(
          'ChatGPT OAuth credentials unavailable. Please reconnect with /connect:chatgpt.',
        )
      }
    }
  }

  // Default: use SavantCode backend
  return {
    model: await createCodebuffBackendModel(apiKey, model),
    isChatGptOAuth: false,
  }
}

/**
 * Create an OpenAI model that routes through the ChatGPT backend API (Codex endpoint).
 * Uses a custom fetch that transforms between Chat Completions and Responses API formats.
 */
function createOpenAIOAuthModel(
  model: string,
  oauthToken: string,
): LanguageModel {
  const openAIModelId = toOpenAIModelId(model)
  const accountId = extractChatGptAccountId(oauthToken)

  return new OpenAICompatibleChatLanguageModel(openAIModelId, {
    provider: 'openai',
    url: () => `${CHATGPT_BACKEND_BASE_URL}/codex/responses`,
    headers: () => ({
      Authorization: `Bearer ${oauthToken}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'responses=experimental',
      originator: 'codex_cli_rs',
      accept: 'text/event-stream',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code-chatgpt-oauth`,
      ...(accountId ? { 'chatgpt-account-id': accountId } : {}),
    }),
    fetch: createChatGptBackendFetch(),
    supportsStructuredOutputs: true,
    includeUsage: undefined,
  })
}

/**
 * Wrap global fetch so transient connection failures (socket closed/reset,
 * connection refused) are rethrown as retryable APICallErrors.
 *
 * Bun's fetch throws these as plain Errors ("The socket connection was closed
 * unexpectedly...", code ECONNRESET/ConnectionClosed), which the AI SDK does
 * not recognize as retryable — it only auto-retries APICallError with
 * isRetryable=true. Marking them retryable lets streamText's built-in
 * exponential backoff (default 2 retries) absorb brief server/network blips
 * instead of failing the whole agent run.
 */
function fetchWithRetryableNetworkErrors(
  ...args: Parameters<typeof globalThis.fetch>
): ReturnType<typeof globalThis.fetch> {
  return globalThis.fetch(...args).catch((error: unknown) => {
    if (isTransientNetworkError(error)) {
      const input = args[0]
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      throw new APICallError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
        url,
        requestBodyValues: {},
        isRetryable: true,
      })
    }
    throw error
  })
}

/**
 * Create a model that routes through the SavantCode backend.
 * This is the existing behavior - requests go to SavantCode backend which forwards to OpenRouter.
 *
 * When `INFERENCE_BASE_URL` is set, routes directly to that base URL instead of
 * the SavantCode backend. When `INFERENCE_API_KEY` or `OR_MASTER_KEY` is set, uses
 * the resolved OpenRouter key for authorization.
 */
async function createCodebuffBackendModel(
  apiKey: string,
  model: string,
): Promise<LanguageModel> {
  const openrouterUsage: OpenRouterUsageAccounting = {
    cost: null,
    costDetails: {
      upstreamInferenceCost: null,
    },
  }

  const openrouterApiKey = getByokOpenrouterApiKeyFromEnv()
  const inferenceBaseUrl = getInferenceBaseUrlFromEnv()
  const resolvedOpenRouterKey = await resolveOpenRouterApiKey()
  const authorizationKey =
    resolvedOpenRouterKey ?? getInferenceApiKeyFromEnv() ?? apiKey

  return new OpenAICompatibleChatLanguageModel(model, {
    provider: 'savant-code',
    url: ({ path: endpoint }) => {
      const baseUrl =
        inferenceBaseUrl ?? getWebsiteUrl()
      // Ensure the base URL path is preserved: /api/v1 + /chat/completions
      // becomes /api/v1/chat/completions (not /chat/completions).
      const baseHref = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      return new URL(cleanPath, baseHref).toString()
    },
    headers: () => ({
      Authorization: `Bearer ${authorizationKey}`,
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code`,
      ...(openrouterApiKey && { [BYOK_OPENROUTER_HEADER]: openrouterApiKey }),
    }),
    metadataExtractor: {
      extractMetadata: async ({
        parsedBody,
      }: {
        parsedBody: any // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic API response shape from provider
      }) => {
        if (openrouterApiKey !== undefined) {
          return { savant-code: { usage: openrouterUsage } }
        }

        if (typeof parsedBody?.usage?.cost === 'number') {
          openrouterUsage.cost = parsedBody.usage.cost
        }
        if (
          typeof parsedBody?.usage?.cost_details?.upstream_inference_cost ===
          'number'
        ) {
          openrouterUsage.costDetails.upstreamInferenceCost =
            parsedBody.usage.cost_details.upstream_inference_cost
        }
        return { savant-code: { usage: openrouterUsage } }
      },
      createStreamExtractor: () => ({
        processChunk: (parsedChunk: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic SSE chunk shape from provider
          if (openrouterApiKey !== undefined) {
            return
          }

          if (typeof parsedChunk?.usage?.cost === 'number') {
            openrouterUsage.cost = parsedChunk.usage.cost
          }
          if (
            typeof parsedChunk?.usage?.cost_details?.upstream_inference_cost ===
            'number'
          ) {
            openrouterUsage.costDetails.upstreamInferenceCost =
              parsedChunk.usage.cost_details.upstream_inference_cost
          }
        },
        buildMetadata: () => {
          return { savant-code: { usage: openrouterUsage } }
        },
      }),
    },
    // Cast: Bun's fetch type also declares a `preconnect` helper, but the AI
    // SDK only ever invokes fetch as a plain function.
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: true,
  })
}
