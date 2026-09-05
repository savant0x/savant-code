import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import {
  CHATGPT_BACKEND_BASE_URL,
  toOpenAIModelId,
} from '@savant-code/common/constants/chatgpt-oauth'
import { PROVIDER_PROTOCOL_MAPS } from '@savant-code/common/constants/model-config'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@savant-code/llm-providers/openai-compatible'
import { createSanitizingFetch } from '@savant-code/llm-providers/schema-sanitize'

import {
  createChatGptBackendFetch,
  extractChatGptAccountId,
} from '../chatgpt-backend-fetch'
import { fetchWithRetryableNetworkErrors } from './fetch-with-retry'

import type { FetchFunction } from '@ai-sdk/provider-utils'
import type {
  ProviderConfig,
  ProviderModelProtocol,
} from '@savant-code/common/providers/types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { LanguageModel } from 'ai'

/**
 * Create an OpenAI model that routes through the ChatGPT backend API (Codex endpoint).
 * Uses a custom fetch that transforms between Chat Completions and Responses API formats.
 */
export function createOpenAIOAuthModel(
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

/** Create a registry-provider model from its entry (FID-2026-0809-001).
 *  `idTransform` strip/keep/cf-rewrite rewrites the id; `baseUrl` may hold
 *  `{ENV_VAR}` placeholders; map-dispatched providers (`openai-anthropic`
 *  dual, `multi`) dispatch via the shared `PROVIDER_PROTOCOL_MAPS` record
 *  (openai/chat, anthropic/messages, responses, gemini); OpenRouter keeps
 *  its attribution + structured outputs. */
export function createProviderModel(
  config: ProviderConfig,
  apiKey: string,
  model: string,
  extraCreds: Record<string, string>,
): LanguageModel {
  const apiModelId = applyIdTransform(config, model)
  const baseUrl = resolveBaseUrl(config.baseUrl, extraCreds)
  const protocol = resolveProtocol(config, model)

  // Outbound schema hygiene (FID-2026-0905-004): SDK-native branches
  // serialize tool schemas raw — cycle-cut them in transport. Retry
  // semantics compose inside (same helper as the chat branch).
  const sanitizingFetch = createSanitizingFetch(
    fetchWithRetryableNetworkErrors as FetchFunction,
  )

  if (protocol === 'anthropic') {
    // Anthropic-compatible: use @ai-sdk/anthropic with the registry base URL.
    const anthropic = createAnthropic({
      baseURL: baseUrl,
      apiKey,
      fetch: sanitizingFetch,
    })
    return anthropic(apiModelId)
  }

  if (protocol === 'responses') {
    // OpenAI Responses API (e.g. Zen GPT/Grok/Muse Spark): use
    // @ai-sdk/openai with the registry base URL, as the provider docs
    // prescribe for `/responses` models.
    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey,
      fetch: sanitizingFetch,
    })
    return openai.responses(apiModelId)
  }

  if (protocol === 'gemini') {
    // Provider-native Gemini path (e.g. Zen `/v1/models/gemini-*`): use
    // @ai-sdk/google with the registry base URL. Spike outcome
    // (FID-2026-0905-003 Step 5): the SDK addresses
    // `{baseURL}/models/<id>:generateContent` while Zen documents the bare
    // `/v1/models/<id>` path — wired clean, suffix tolerance proven or
    // denied at live smoke (Step 9, operator key). If intolerant, add a
    // suffix-stripping fetch adapter; never silently exclude.
    const google = createGoogleGenerativeAI({
      baseURL: baseUrl,
      apiKey,
      fetch: sanitizingFetch,
    })
    return google(apiModelId)
  }

  const isOpenRouter = config.id === 'openrouter'
  return new OpenAICompatibleChatLanguageModel(apiModelId, {
    provider: config.id,
    url: ({ path: endpoint }) => {
      const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      // Ensure the base URL path is preserved: /v1 + /chat/completions
      // becomes /v1/chat/completions (not /chat/completions).
      const baseHref = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
      return new URL(cleanPath, baseHref).toString()
    },
    headers: () => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/savant-code-${config.id}`,
      // OpenRouter attribution headers (quickstart contract).
      ...(isOpenRouter
        ? {
            'HTTP-Referer': 'https://savant-code.com',
            'X-OpenRouter-Title': 'SavantCode',
            'X-OpenRouter-Categories': 'cli-agent,cloud-agent,programming-app',
          }
        : {}),
    }),
    fetch: fetchWithRetryableNetworkErrors as typeof globalThis.fetch,
    includeUsage: undefined,
    supportsStructuredOutputs: isOpenRouter,
    // Nous requires a `user=` tag from raw-key callers (400 "missing tags").
    extraBody: config.id === 'nous' ? NOUS_REQUIRED_REQUEST_TAGS : undefined,
  })
}

/** Nous `user=` tag shared by the prefixed and bare-slug routing paths. */
export const NOUS_REQUIRED_REQUEST_TAGS: Record<string, JSONValue> = {
  tags: ['user=savant-code'],
}

/** Apply the registry entry's id transform to a model id. */
function applyIdTransform(config: ProviderConfig, model: string): string {
  switch (config.idTransform) {
    case 'strip':
      return model.slice(`${config.id}/`.length)
    case 'cf-rewrite':
      return `@cf/${model.slice('cloudflare/'.length)}`
    case 'keep':
    default:
      return model
  }
}

/**
 * Resolve a registry base URL, substituting `{ENV_VAR}` placeholders from the
 * extra credentials (required for Cloudflare's mid-path account id).
 */
function resolveBaseUrl(
  template: string,
  extraCreds: Record<string, string>,
): string {
  return template.replace(/\{([A-Z0-9_]+)\}/g, (_, envVar: string) => {
    const value = extraCreds[envVar]
    if (value === undefined) {
      throw new Error(`${envVar} not set. Set ${envVar} environment variable.`)
    }
    return value
  })
}

/**
 * Resolve the wire protocol for a model. Single-protocol providers are
 * 'openai'. Map-dispatched providers (`openai-anthropic` dual, `multi`)
 * look up the shared `PROVIDER_PROTOCOL_MAPS` record by the FULL prefixed
 * model id (matching the map keys in model-config.ts), and fail closed for
 * unknown models instead of silently using the wrong schema.
 */
function resolveProtocol(
  config: ProviderConfig,
  model: string,
): ProviderModelProtocol {
  if (config.protocolMap === undefined) {
    if (config.protocol !== 'openai' && config.protocol !== 'anthropic') {
      // Fail closed: a map-dispatched provider without a protocol map would
      // silently dispatch with the wrong request schema (review finding, Loop 5).
      throw new Error(
        `No protocol map configured for ${config.label} (protocol: ${config.protocol}).`,
      )
    }
    return 'openai'
  }
  const map = PROVIDER_PROTOCOL_MAPS[config.protocolMap]
  if (map === undefined) {
    throw new Error(
      `Unknown protocol map configured for ${config.label}: ${config.protocolMap}.`,
    )
  }
  const protocol = map[model]
  if (protocol === undefined) {
    throw new Error(
      `Unknown protocol for ${config.label} model: ${model}. ` +
        `Model not found in ${config.protocolMap} catalog.`,
    )
  }
  return protocol
}
