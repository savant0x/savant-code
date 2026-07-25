/**
 * Model provider abstraction for routing requests to the appropriate LLM provider.
 *
 * This module handles:
 * - ChatGPT OAuth: Direct requests to OpenAI API using user's OAuth token
 * - Default: Requests through SavantCode backend (which routes to OpenRouter)
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { BYOK_OPENROUTER_HEADER } from '@savant-code/common/constants/byok'
import {
  CHATGPT_BACKEND_BASE_URL,
  CHATGPT_OAUTH_ENABLED,
  isChatGptOAuthModelAllowed,
  isOpenAIProviderModel,
  toOpenAIModelId,
} from '@savant-code/common/constants/chatgpt-oauth'
import { OPENCODE_GO_PROTOCOLS } from '@savant-code/common/constants/model-config'
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
  getNvidiaApiKeyFromEnv,
  getOpenCodeGoApiKeyFromEnv,
  getTokenRouterApiKeyFromEnv,
  getCloudflareApiTokenFromEnv,
  getCloudflareAccountIdFromEnv,
} from '../env'
import {
  createChatGptBackendFetch,
  extractChatGptAccountId,
} from './chatgpt-backend-fetch'
import { resolveOpenRouterApiKey } from './openrouter-key-resolver'

import type { JSONValue } from '@savant-code/common/types/json'
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
 * Shape of the parsed API response body from the provider for usage extraction.
 * The provider returns usage data at response.usage.cost and response.usage.cost_details.upstream_inference_cost.
 */
interface ProviderParsedResponse {
  usage?: {
    cost?: number
    cost_details?: {
      upstream_inference_cost?: number
    }
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
  const { apiKey, model, skipChatGptOAuth } = params

  // Check if we should use ChatGPT OAuth direct
  // Only attempt for allowlisted models; non-allowlisted models silently fall through to backend.
  if (
    CHATGPT_OAUTH_ENABLED &&
    !skipChatGptOAuth &&
    isOpenAIProviderModel(model) &&
    isChatGptOAuthModelAllowed(model)
  ) {
    if (!isChatGptOAuthRateLimited()) {
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
    }
  }

  // Gateway providers: TokenRouter and NVIDIA NIM each have their own API key
  // and base URL. Check these before the SavantCode backend path — the
  // INFERENCE_BASE_URL dev-mode bypass must not affect gateway routing.
  if (isTokenRouterModel(model)) {
    const tokenRouterKey = getTokenRouterApiKeyFromEnv()
    if (!tokenRouterKey) {
      throw new Error(
        'TokenRouter API key not set. Set TOKENROUTER_API_KEY environment variable.',
      )
    }
    return {
      model: createTokenRouterModel(tokenRouterKey, model),
      isChatGptOAuth: false,
    }
  }

  if (isNvidiaModel(model)) {
    const nvidiaKey = getNvidiaApiKeyFromEnv()
    if (!nvidiaKey) {
      throw new Error(
        'NVIDIA API key not set. Set NVIDIA_API_KEY environment variable.',
      )
    }
    return {
      model: createNvidiaModel(nvidiaKey, model),
      isChatGptOAuth: false,
    }
  }

  if (isOpenCodeGoModel(model)) {
    const openCodeGoKey = getOpenCodeGoApiKeyFromEnv()
    if (!openCodeGoKey) {
      throw new Error(
        'OpenCode Go API key not set. Set OPENCODE_GO_API_KEY environment variable.',
      )
    }
    return {
      model: createOpenCodeGoModel(openCodeGoKey, model),
      isChatGptOAuth: false,
    }
  }

  if (isCloudflareModel(model)) {
    const cloudflareKey = getCloudflareApiTokenFromEnv()
    const cloudflareAccountId = getCloudflareAccountIdFromEnv()
    if (!cloudflareKey) {
      throw new Error(
        'Cloudflare API token not set. Set CLOUDFLARE_API_TOKEN environment variable.',
      )
    }
    if (!cloudflareAccountId) {
      throw new Error(
        'Cloudflare account ID not set. Set CLOUDFLARE_ACCOUNT_ID environment variable.',
      )
    }
    return {
      model: createCloudflareModel(cloudflareKey, cloudflareAccountId, model),
      isChatGptOAuth: false,
    }
  }

  // Default: use SavantCode backend
  return {
    model: await createSavantCodeBackendModel(apiKey, model),
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
  return globalThis.fetch(...args).catch((error) => {
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
 * Check if a model ID targets OpenCode Go (prefix: `opencode-go/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isOpenCodeGoModel(model: string): boolean {
  return model.startsWith('opencode-go/')
}

/**
 * Check if a model ID targets TokenRouter (prefix: `tokenrouter/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isTokenRouterModel(model: string): boolean {
  return model.startsWith('tokenrouter/')
}

/**
 * Check if a model ID targets NVIDIA NIM (prefix: `nvidia/`).
 * Subagents inherit the parent's model via `withParentModel()` in
 * spawn-agent-utils.ts — gateway model prefixes propagate correctly.
 */
export function isNvidiaModel(model: string): boolean {
  return model.startsWith('nvidia/')
}

/**
 * Check if a model ID targets Cloudflare Workers AI (prefix: `cloudflare/`).
 */
export function isCloudflareModel(model: string): boolean {
  return model.startsWith('cloudflare/')
}

/**
 * Create a TokenRouter model.
 * Strips the `tokenrouter/` prefix — the API expects bare model IDs (e.g.
 * `kimi-k2p6`, not `tokenrouter/kimi-k2p6`).
 */
function createTokenRouterModel(
  apiKey: string,
  model: string,
): LanguageModel {
  const apiModelId = model.slice('tokenrouter/'.length)
  return new OpenAICompatibleChatLanguageModel(apiModelId, {
    provider: 'tokenrouter',
    url: ({ path: endpoint }) => {
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      return new URL(cleanPath, 'https://api.tokenrouter.com/v1/').toString()
    },
    headers: () => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code-tokenrouter`,
    }),
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: false,
  })
}

/**
 * Create an NVIDIA NIM model.
 * Strips the `nvidia/` prefix — the API expects namespaced IDs (e.g.
 * `zai-org/glm-5.2`, not `nvidia/zai-org/glm-5.2`).
 */
function createNvidiaModel(
  apiKey: string,
  model: string,
): LanguageModel {
  const apiModelId = model.slice('nvidia/'.length)
  return new OpenAICompatibleChatLanguageModel(apiModelId, {
    provider: 'nvidia',
    url: ({ path: endpoint }) => {
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      return new URL(cleanPath, 'https://integrate.api.nvidia.com/v1/').toString()
    },
    headers: () => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code-nvidia`,
    }),
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: false,
  })
}

/**
 * Create a Cloudflare Workers AI model.
 * Strips the `cloudflare/` prefix and prepends `@cf/` to match Cloudflare's API model naming.
 * Base URL includes account ID in the path: /client/v4/accounts/{ACCOUNT_ID}/ai/v1/
 */
function createCloudflareModel(apiKey: string, accountId: string, model: string): LanguageModel {
  const apiModelId = `@cf/${model.slice('cloudflare/'.length)}`
  return new OpenAICompatibleChatLanguageModel(apiModelId, {
    provider: 'cloudflare',
    url: ({ path: endpoint }) => {
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      return new URL(
        cleanPath,
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/`,
      ).toString()
    },
    headers: () => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code-cloudflare`,
    }),
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: false,
  })
}

/**
 * Create an OpenCode Go model.
 *
 * OpenCode Go exposes dual-protocol endpoints:
 * - OpenAI-compatible (`/v1/chat/completions`): 10 models
 * - Anthropic-compatible (`/v1/messages`): 5 models
 *
 * The protocol is determined by the model catalog lookup in OPENCODE_GO_PROTOCOLS.
 * For OpenAI-compatible models, we reuse the existing OpenAICompatibleChatLanguageModel.
 * For Anthropic-compatible models, we use @ai-sdk/anthropic with a custom base URL.
 */
function createOpenCodeGoModel(
  apiKey: string,
  model: string,
): LanguageModel {
  const protocol = OPENCODE_GO_PROTOCOLS[model]
  if (!protocol) {
    throw new Error(
      `Unknown protocol for OpenCode Go model: ${model}. ` +
      `Model not found in OPENCODE_GO_PROTOCOLS catalog.`,
    )
  }

  const baseUrl = 'https://opencode.ai/zen/go/v1/'

  if (protocol === 'anthropic') {
    // Anthropic-compatible: use @ai-sdk/anthropic with custom base URL.
    // This avoids building a 700+ line custom adapter; @ai-sdk/anthropic is
    // already a workspace dependency and handles the /v1/messages protocol.
    // DEVIATION from FID-034 scope constraint: reference implementations
    // (opencode-dev, kilocode) were not available in the repo, so we use
    // the official SDK adapter instead of a custom Effect/Schema adapter.
    const anthropic = createAnthropic({
      baseURL: baseUrl,
      apiKey,
    })
    const apiModelId = model.slice('opencode-go/'.length)
    return anthropic(apiModelId)
  }

  // OpenAI-compatible: reuse existing adapter
  const apiModelId = model.slice('opencode-go/'.length)
  return new OpenAICompatibleChatLanguageModel(apiModelId, {
    provider: 'opencode-go',
    url: ({ path: endpoint }) => {
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      return new URL(cleanPath, baseUrl).toString()
    },
    headers: () => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code-opencode-go`,
    }),
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: false,
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
async function createSavantCodeBackendModel(
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
      'HTTP-Referer': getWebsiteUrl(),
      'X-OpenRouter-Title': 'SavantCode',
      'X-OpenRouter-Categories': 'cli-agent,cloud-agent,programming-app',
      ...(openrouterApiKey && { [BYOK_OPENROUTER_HEADER]: openrouterApiKey }),
    }),
    metadataExtractor: {
      extractMetadata: async ({
        parsedBody: rawParsedBody,
      }: {
        parsedBody: Record<string, JSONValue>
      }) => {
        const parsedBody = rawParsedBody as ProviderParsedResponse
        if (openrouterApiKey !== undefined) {
          return { 'savant-code': { usage: openrouterUsage } }
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
        return { 'savant-code': { usage: openrouterUsage } }
      },
      createStreamExtractor: () => ({
        processChunk: (rawParsedChunk: Record<string, JSONValue>) => {
          const parsedChunk = rawParsedChunk as ProviderParsedResponse
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
          return { 'savant-code': { usage: openrouterUsage } }
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
