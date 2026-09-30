/**
 * Non-streaming LLM prompt entry points (FID-2026-0805-003). Extracted from
 * impl/llm.ts verbatim.
 */

import { promptAborted, promptSuccess } from '@savant-code/common/util/error'
import { convertCbToModelMessages } from '@savant-code/common/util/messages'
import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'
import { generateText, generateObject } from 'ai'

import { getModelForRequest } from '../model-provider'
import {
  calculateUsedCredits,
  emitCacheDebugProviderRequest,
  emitCacheDebugUsage,
  extractCostOverrideDollars,
  getModelProvider,
  getProviderOptions,
} from './usage'

import type { ModelRequestParams } from '../model-provider'
import type {
  PromptAiSdkFn,
  PromptAiSdkStructuredInput,
  PromptAiSdkStructuredOutput,
} from '@savant-code/common/types/contracts/llm'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type z from 'zod/v4'

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
  const costOverrideDollars = extractCostOverrideDollars(providerMetadata)

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
  const costOverrideDollars = extractCostOverrideDollars(providerMetadata)

  // Call the cost callback if provided
  if (params.onCostCalculated && costOverrideDollars) {
    await params.onCostCalculated(
      calculateUsedCredits({ costDollars: costOverrideDollars }),
    )
  }

  return promptSuccess(content)
}
