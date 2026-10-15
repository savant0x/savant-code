import {
  smallerTokenLimit,
  validTokenLimit,
} from '@savant-code/common/util/model-request-limits'

import type { OpenRouterModel } from './types'

export function contextLengthOf(
  model: OpenRouterModel | undefined,
): number | undefined {
  return smallerTokenLimit(
    model?.contextLength,
    model?.topProvider?.contextLength,
  )
}

export function maxCompletionOf(
  model: OpenRouterModel | undefined,
): number | undefined {
  return (
    validTokenLimit(model?.topProvider?.maxCompletionTokens) ??
    validTokenLimit(model?.maxCompletionTokens)
  )
}
