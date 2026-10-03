import { createOpenAI } from '@ai-sdk/openai'
import { BYOK_OPENROUTER_HEADER } from '@savant-code/common/constants/byok'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@savant-code/llm-providers/openai-compatible'

import { fetchWithRetryableNetworkErrors } from './fetch-with-retry'
import { NOUS_REQUIRED_REQUEST_TAGS } from './model-factories'
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
 * (e.g. bare slugs like `anthropic/claude-sonnet-4.5`). `INFERENCE_BASE_URL`
 * is REQUIRED: FID-2026-0929-005 (gut the backend) deleted the old
 * getWebsiteUrl() fallback — there is no SavantCode backend to target when
 * the env var is unset, so construction fails fast naming the env var. The
 * passed apiKey authorizes the request (Phase 4, decision 10:
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
  options?: {
    preferApiKey?: boolean
    providerId?: string
    /**
     * FID-2026-1001-001: the ACTIVE provider's resolved wire protocol.
     * 'responses' constructs an OpenAI Responses model against
     * INFERENCE_BASE_URL (api.openai.com 400s on chat/completions for
     * reasoning models with tools). Absent/undefined → the historical
     * chat-completions construction, byte-identical for every existing
     * provider.
     */
    protocol?: 'openai' | 'anthropic' | 'responses'
    /**
     * FID-2026-1003-006: the custom INFERENCE_BASE_URL endpoint owns its
     * credential. INFERENCE_API_KEY is the only authorizing secret — the
     * OpenRouter master-key chain is never resolved (no network exchange)
     * and no active-provider key can reach the operator's own endpoint.
     */
    endpointOwnsAuth?: boolean
  },
): Promise<LanguageModel> {
  const inferenceBaseUrl = getInferenceBaseUrlFromEnv()
  if (!inferenceBaseUrl) {
    throw new Error(
      `INFERENCE_BASE_URL is required for model "${model}": it matches no provider registry prefix, and with no SavantCode backend there is no fallback target (FID-2026-0929-005). Set INFERENCE_BASE_URL to your inference gateway's base URL.`,
    )
  }
  if (options?.endpointOwnsAuth && !getInferenceApiKeyFromEnv()?.trim()) {
    // FID-2026-1003-006: a guaranteed-401 request is pure waste and surfaces
    // a vendor error naming nothing. Fail fast on the named env var instead —
    // the same contract style as the INFERENCE_BASE_URL check above.
    throw new Error(
      "INFERENCE_API_KEY is required for the custom INFERENCE_BASE_URL endpoint: the active provider's key chain is never sent to a custom endpoint (FID-2026-1003-006).",
    )
  }
  const openrouterUsage: OpenRouterUsageAccounting = {
    cost: null,
    costDetails: {
      upstreamInferenceCost: null,
    },
  }

  const openrouterApiKey = getByokOpenrouterApiKeyFromEnv()
  // FID-2026-1003-006: when the endpoint owns its auth, the OpenRouter key
  // chain is never resolved — no master-key network exchange, and no vendor
  // key that could leak into the operator's own gateway.
  const resolvedOpenRouterKey = options?.endpointOwnsAuth
    ? undefined
    : await resolveOpenRouterApiKey() // Decision 10: the ACTIVE provider's own key is authoritative when
  // resolved; otherwise legacy env fallbacks win over a caller key.
  const authorizationKey = options?.endpointOwnsAuth
    ? (getInferenceApiKeyFromEnv() ?? '')
    : options?.preferApiKey
      ? apiKey
      : (resolvedOpenRouterKey ?? getInferenceApiKeyFromEnv() ?? apiKey)

  const isOpenRouterCompatible =
    options?.providerId === undefined || options.providerId === 'openrouter'

  // FID-2026-1001-001: a single-protocol Responses provider (api.openai.com)
  // must not receive chat/completions wire format — reasoning models with
  // tools 400 on that path. The bare-slug path mirrors createProviderModel's
  // existing responses branch (same factory, same credential, base URL from
  // INFERENCE_BASE_URL, which activateProviderRouting derives from the
  // registry entry). No retry/sanitizing composition here: this branch matches
  // the plain fetch shape the OAuth-lane responses model uses, and the
  // chat branch below keeps its existing composition untouched.
  if (options?.protocol === 'responses') {
    const openai = createOpenAI({
      baseURL: inferenceBaseUrl,
      apiKey: authorizationKey,
      fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    })
    return openai.responses(model)
  }

  return new OpenAICompatibleChatLanguageModel(model, {
    provider: options?.providerId ?? 'savant-code',
    url: ({ path: endpoint }) => {
      const baseUrl = inferenceBaseUrl
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
            // FID-2026-0929-005: the HTTP-Referer header (getWebsiteUrl()) is
            // deleted with the backend origin it pointed at. App-identity
            // headers stay: they describe the CLI, not a backend.
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
