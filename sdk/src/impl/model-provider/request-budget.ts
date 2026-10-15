import { getContextWindowFallback } from '@savant-code/common/constants/context-windows'
import {
  modelRequestLimits,
  smallerTokenLimit,
} from '@savant-code/common/util/model-request-limits'
import { parseProviderTokenLimitError } from '@savant-code/common/util/provider-token-limit-error'
import { wrapLanguageModel } from 'ai'

import {
  assertTokenBudget,
  budgetModelRequest,
  RequestInputBudgetError,
  trimPromptToFit,
} from './request-budget-policy'
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
  /**
   * FID-2026-1009-003 L2: overflow seam. Invoked when the initial budget
   * check would throw RequestInputBudgetError, before the prompt is
   * trimmed and retried once. The host may compact its shared session
   * state (the next step benefits) and observe the overflow. Awaited;
   * a throwing seam is logged and never blocks the trim recovery.
   */
  onContextOverflow?: (info: {
    inputTokens: number
    contextWindow: number
  }) => void | Promise<void>
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

/**
 * FID-2026-1009-003 L2: budget with overflow recovery. The plain budget
 * throws RequestInputBudgetError when the input estimate leaves no output
 * headroom. Before failing the run, invoke the host seam (it may compact
 * the shared session state), then trim the oldest turns of THIS prompt
 * until it fits and retry exactly once. A prompt that cannot fit even
 * trimmed rethrows the original error — the run still fails, but only
 * after the seam and the trim had their chance.
 */
async function budgetOrRecover(
  params: LanguageModelV2CallOptions,
  estimatedInput: number,
  budget: BudgetRequest,
  options: BudgetOptions,
): Promise<LanguageModelV2CallOptions> {
  try {
    return budget(params, estimatedInput)
  } catch (error) {
    if (!(error instanceof RequestInputBudgetError)) throw error
    if (options.onContextOverflow) {
      try {
        await options.onContextOverflow({
          inputTokens: error.inputTokens,
          contextWindow: error.contextWindow,
        })
      } catch (seamError) {
        options.logger?.debug(
          {
            error:
              seamError instanceof Error
                ? seamError.message
                : String(seamError),
          },
          'onContextOverflow seam threw; continuing with prompt trim',
        )
      }
    }
    const trimmed = trimPromptToFit(params, error.contextWindow)
    if (trimmed === null) throw error
    options.logger?.warn(
      {
        model: options.catalogId,
        inputTokens: error.inputTokens,
        contextWindow: error.contextWindow,
      },
      'Request exceeded the context budget; trimmed oldest turns and retrying once',
    )
    return budget(trimmed, countRequestInputTokens(trimmed))
  }
}

async function dispatchBudgetedRequest<T>(
  params: LanguageModelV2CallOptions,
  send: (params: LanguageModelV2CallOptions) => PromiseLike<T>,
  budget: BudgetRequest,
  options: BudgetOptions,
): Promise<T> {
  const estimatedInput = countRequestInputTokens(params)
  const initial = await budgetOrRecover(params, estimatedInput, budget, options)
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
