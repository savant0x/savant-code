import { getContextWindowFallback } from '@savant-code/common/constants/context-windows'
import {
  modelRequestLimits,
  smallerTokenLimit,
} from '@savant-code/common/util/model-request-limits'
import { parseProviderTokenLimitError } from '@savant-code/common/util/provider-token-limit-error'
import { wrapLanguageModel } from 'ai'

import { assertTokenBudget, budgetModelRequest } from './request-budget-policy'
import { countRequestInputTokens } from './request-token-count'

import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
} from '@ai-sdk/provider'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ModelRequestLimitsStore } from '@savant-code/common/util/model-request-limits'

type BudgetOptions = {
  catalogId: string
  routeId: string
  fallbackModelId?: string
  contextWindow?: number
  logger?: Logger
  limitsStore?: ModelRequestLimitsStore
}

type BudgetRequest = (
  params: LanguageModelV2CallOptions,
  inputTokens: number,
) => LanguageModelV2CallOptions

function correctRejectedBudget(
  error: unknown,
  params: LanguageModelV2CallOptions,
  initial: LanguageModelV2CallOptions,
  estimatedInput: number,
  budget: BudgetRequest,
  options: BudgetOptions,
): LanguageModelV2CallOptions {
  if (params.abortSignal?.aborted) throw error
  const reported = parseProviderTokenLimitError(error)
  if (!reported) throw error
  ;(options.limitsStore ?? modelRequestLimits).observe(
    options.routeId,
    reported,
  )
  const corrected = budget(
    params,
    Math.max(estimatedInput, reported.inputTokens ?? 0),
  )
  if (
    corrected.maxOutputTokens === undefined ||
    (initial.maxOutputTokens !== undefined &&
      corrected.maxOutputTokens >= initial.maxOutputTokens)
  )
    throw error
  options.logger?.warn(
    {
      model: options.catalogId,
      contextWindow: reported.contextWindow,
      maxOutputTokens: corrected.maxOutputTokens,
    },
    'Retrying rejected request with corrected token budget',
  )
  return corrected
}

async function dispatchBudgetedRequest<T>(
  params: LanguageModelV2CallOptions,
  send: (params: LanguageModelV2CallOptions) => PromiseLike<T>,
  budget: BudgetRequest,
  options: BudgetOptions,
): Promise<T> {
  const estimatedInput = countRequestInputTokens(params)
  const initial = budget(params, estimatedInput)
  if (initial.maxOutputTokens !== params.maxOutputTokens) {
    options.logger?.debug(
      {
        model: options.catalogId,
        inputTokens: estimatedInput,
        requestedOutputTokens: params.maxOutputTokens,
        maxOutputTokens: initial.maxOutputTokens,
      },
      'Applied request token budget',
    )
  }
  try {
    return await send(initial)
  } catch (error) {
    const corrected = correctRejectedBudget(
      error,
      params,
      initial,
      estimatedInput,
      budget,
      options,
    )
    return await send(corrected)
  }
}

function createBudgetRequest(options: BudgetOptions): BudgetRequest {
  assertTokenBudget(options.contextWindow, 'contextWindow')
  const store = options.limitsStore ?? modelRequestLimits
  const catalogFallback = getContextWindowFallback(options.catalogId)
  const fallback =
    catalogFallback.source === 'fallback-table'
      ? catalogFallback
      : getContextWindowFallback(options.fallbackModelId ?? options.catalogId)

  return function budget(
    params: LanguageModelV2CallOptions,
    inputTokens: number,
  ): LanguageModelV2CallOptions {
    const known = store.get(options.catalogId, options.routeId)
    const catalog = store.getCatalog(options.catalogId)
    const capability =
      catalog.contextWindow ??
      (fallback.source === 'fallback-table'
        ? fallback.contextWindow
        : undefined)
    const contextWindow =
      smallerTokenLimit(
        known.contextWindow,
        options.contextWindow,
        capability,
      ) ?? fallback.contextWindow
    return budgetModelRequest(params, { ...known, contextWindow }, inputTokens)
  }
}

/** Shared by all SDK entry points; retries only a rejected initial dispatch. */
export function withRequestTokenBudget(
  model: LanguageModelV2,
  options: BudgetOptions,
): LanguageModelV2 {
  const budget = createBudgetRequest(options)

  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: ({ params }) =>
        dispatchBudgetedRequest(
          params,
          (request) => model.doGenerate(request),
          budget,
          options,
        ),
      wrapStream: ({ params }) =>
        dispatchBudgetedRequest(
          params,
          (request) => model.doStream(request),
          budget,
          options,
        ),
    },
  })
}
