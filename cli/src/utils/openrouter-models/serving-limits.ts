import { getContextWindowFallback } from '@savant-code/common/constants/context-windows'
import { modelRequestLimits } from '@savant-code/common/util/model-request-limits'

import {
  resolveContextWindowForModel,
  resolveMaxOutputTokensForModel,
} from './lookup'
import { PINNED_MAX_OUTPUT_TOKENS } from './static-catalogs'

import type { ModelRoute } from '@savant-code/common/providers/model-route'

/** Explicit serving identity prevents a foreign catalog row from supplying budgets. */
export function resolveServingLimits(model: string, route?: ModelRoute) {
  if (!route)
    return {
      contextWindow: resolveContextWindowForModel(model),
      maxOutputTokens: resolveMaxOutputTokensForModel(model),
    }
  const id = model.startsWith(`${route.providerId}/`)
    ? model
    : `${route.providerId}/${model}`
  const limits = modelRequestLimits.getCatalog(id)
  return {
    contextWindow:
      limits.contextWindow ?? getContextWindowFallback(model).contextWindow,
    maxOutputTokens: PINNED_MAX_OUTPUT_TOKENS[id] ?? limits.maxOutputTokens,
  }
}
