import { BYOK_OPENROUTER_HEADER } from '@savant-code/common/constants/byok'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@savant-code/llm-providers/openai-compatible'

import { fetchWithRetryableNetworkErrors } from './fetch-with-retry'
import { NOUS_REQUIRED_REQUEST_TAGS } from './model-factories'
import { getWebsiteUrl } from '../../constants'
import {
  getByokOpenrouterApiKeyFromEnv,
  getInferenceApiKeyFromEnv,
  getInferenceBaseUrlFromEnv,
} from '../../env'
import { resolveOpenRouterApiKey } from '../openrouter-key-resolver'

import type { OpenRouterUsageAccounting, ProviderParsedResponse } from './types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { LanguageModel } from 'ai'

/**
 * Create the default inference model — the generic OpenAI-compatible fallback
 * (renamed from createSavantCodeBackendModel per FID-2026-0809-001 decision 7;
 * the name previously implied a nonexistent backend).
 *
 * This is the fallback for model ids that match no registry provider prefix
 * (e.g. bare slugs like `anthropic/claude-sonnet-4.5`). When `INFERENCE_BASE_URL`
 * is set, routes directly to that base URL; otherwise targets the SavantCode
 * website URL. The passed apiKey authorizes the request (Phase 4, decision 10:
 * getModelForRequest supplies the ACTIVE provider's own key for bare slugs);
 * `INFERENCE_API_KEY` and the resolved OpenRouter key remain fallbacks for
 * callers that pass no key — unless `preferApiKey` is set, which makes the
 * passed key authoritative (used only when it was resolved from the active
 * provider, so the custom-endpoint INFERENCE_API_KEY escape hatch is
 * preserved).
 */
export async function createDefaultInferenceModel(
  apiKey: string,
  model: string,
  options?: { preferApiKey?: boolean; providerId?: string },
): Promise<LanguageModel> {
  const openrouterUsage: OpenRouterUsageAccounting = {
    cost: null,
    costDetails: {
      upstreamInferenceCost: null,
    },
  }

  const openrouterApiKey = getByokOpenrouterApiKeyFromEnv()
  const inferenceBaseUrl = getInferenceBaseUrlFromEnv()
  const resolvedOpenRouterKey = await resolveOpenRouterApiKey() // Decision 10: the ACTIVE provider's own key is authoritative when
  // resolved; otherwise legacy env fallbacks win over a caller key.
  const authorizationKey = options?.preferApiKey
    ? apiKey
    : (resolvedOpenRouterKey ?? getInferenceApiKeyFromEnv() ?? apiKey)

  const isOpenRouterCompatible =
    options?.providerId === undefined || options.providerId === 'openrouter'

  return new OpenAICompatibleChatLanguageModel(model, {
    provider: options?.providerId ?? 'savant-code',
    url: ({ path: endpoint }) => {
      const baseUrl = inferenceBaseUrl ?? getWebsiteUrl()
      // Ensure the base URL path is preserved: /api/v1 + /chat/completions
      // becomes /api/v1/chat/completions (not /chat/completions).
      const baseHref = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      return new URL(cleanPath, baseHref).toString()
    },
    headers: () => ({
      Authorization: `Bearer ${authorizationKey}`,
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code`,
      ...(isOpenRouterCompatible
        ? {
            'HTTP-Referer': getWebsiteUrl(),
            'X-OpenRouter-Title': 'SavantCode',
            'X-OpenRouter-Categories': 'cli-agent,cloud-agent,programming-app',
            ...(openrouterApiKey && {
              [BYOK_OPENROUTER_HEADER]: openrouterApiKey,
            }),
          }
        : {}),
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
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: isOpenRouterCompatible,
    extraBody:
      options?.providerId === 'nous' ? NOUS_REQUIRED_REQUEST_TAGS : undefined,
  })
}
