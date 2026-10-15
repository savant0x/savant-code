/**
 * Provider-options + usage accounting helpers for the LLM entry points
 * (FID-2026-0805-003). Extracted from impl/llm.ts verbatim.
 */

import { models, PROFIT_MARGIN } from '@savant-code/common/old-constants'
import { normalizeProviderRequestBodyForCacheDebug } from '@savant-code/common/util/cache-debug'
import { isExplicitlyDefinedModel } from '@savant-code/common/util/model-utils'
import { toJSONValue } from '@savant-code/common/util/type-narrowing'

import type { OpenRouterProviderRoutingOptions } from '@savant-code/common/types/agent-template'
import type { JSONObject, JSONValue } from '@savant-code/common/types/json'
import type { LanguageModel } from 'ai'

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

export function calculateUsedCredits(params: { costDollars: number }): number {
  const { costDollars } = params

  return Math.round(costDollars * (1 + PROFIT_MARGIN) * 100)
}

/**
 * Extract the OpenRouter cost override from provider metadata. Previously
 * triplicated across the three prompt entry points (FID-2026-0803-003 SDK-3);
 * returns undefined when no savant-code usage metadata is present.
 */
export function extractCostOverrideDollars(
  providerMetadata: unknown,
): number | undefined {
  const savantCodeMetadata = (
    providerMetadata as
      { 'savant-code'?: { usage?: OpenRouterUsageAccounting } } | undefined
  )?.['savant-code']
  const usage = savantCodeMetadata?.usage
  if (!usage) return undefined
  return (usage.cost ?? 0) + (usage.costDetails?.upstreamInferenceCost ?? 0)
}

// Usage accounting type for OpenRouter/SavantCode backend responses
// Forked from https://github.com/OpenRouterTeam/ai-sdk-provider/
export type OpenRouterUsageAccounting = {
  cost: number | null
  costDetails: {
    upstreamInferenceCost: number | null
  }
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

export function getModelProvider(model: LanguageModel): string {
  if (typeof model === 'string') return model
  return model.provider
}

export function emitCacheDebugProviderRequest(params: {
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

export function emitCacheDebugUsage(params: {
  callback?: (usage: {
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    totalTokens: number
    cachedInputTokensReported?: boolean
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
    // FID-2026-1007-009: preserve presence. The `?? 0` above keeps the shape
    // stable for existing consumers, but it also erased the difference
    // between "the provider reported no cache reuse" and "the provider does
    // not report caching at all" — the two are rendered differently in the
    // sidebar, so the fact has to survive normalization.
    cachedInputTokensReported: params.usage.cachedInputTokens !== undefined,
    totalTokens: params.usage.totalTokens ?? 0,
  })
}
