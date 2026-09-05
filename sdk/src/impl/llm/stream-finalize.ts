// FID-2026-0819-005 Loop 240: stream finalize, extracted verbatim from
// stream.ts (response metadata + cache-debug emissions + cost tracking +
// promptSuccess). Takes the awaited streamText response handle plus the
// values the parent already holds.

import {
  promptSuccess,
  type PromptResult,
} from '@savant-code/common/util/error'
import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import {
  calculateUsedCredits,
  emitCacheDebugProviderRequest,
  emitCacheDebugUsage,
  extractCostOverrideDollars,
  getModelProvider,
} from './usage'

import type { StreamTextResult, ToolSet } from 'ai'

export async function finalizeLlmStream<TOOLS extends ToolSet, PARTIAL_OUTPUT>(
  response: StreamTextResult<TOOLS, PARTIAL_OUTPUT>,
  aiSDKModel: Parameters<typeof getModelProvider>[0],
  isChatGptOAuth: boolean,
  params: {
    onCacheDebugProviderRequestBuilt?: Parameters<
      typeof emitCacheDebugProviderRequest
    >[0]['callback']
    onCacheDebugUsageReceived?: Parameters<
      typeof emitCacheDebugUsage
    >[0]['callback']
    onCostCalculated?: (credits: number) => void | Promise<void>
  },
): Promise<PromptResult<string | null>> {
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

    const costOverrideDollars = extractCostOverrideDollars(providerMetadata)

    // Call the cost callback if provided
    if (params.onCostCalculated && costOverrideDollars) {
      await params.onCostCalculated(
        calculateUsedCredits({ costDollars: costOverrideDollars }),
      )
    }
  }

  return promptSuccess(messageId)
}
