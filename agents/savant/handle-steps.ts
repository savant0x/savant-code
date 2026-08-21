import { SAVANT_FREE_KIMI_MODEL_ID } from '@savant-code/common/constants/savant-free-models'

import {
  createSavantHandleSteps,
  handleSteps250k,
  handleSteps400k,
  handleStepsFree250k,
  handleStepsFree400k,
  type SavantHandleSteps,
} from './handle-steps-factory'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'

export function getSavantContextPrunerMaxContextLength(
  model: SecretAgentDefinition['model'],
): 250_000 | 400_000 {
  if (model === SAVANT_FREE_KIMI_MODEL_ID) return 250_000
  return 400_000
}

export function getSavantHandleSteps({
  isFree,
  maxContextLength,
  keepRecentTokens,
  autoCompactRatio,
  forceCompactOffset,
}: {
  isFree: boolean
  maxContextLength: 250_000 | 400_000
  /** FID-2026-0814-004 H-07 — threaded into the factory (defaults match
   *  protocol.config.yaml `compression`). */
  keepRecentTokens?: number
  autoCompactRatio?: number
  forceCompactOffset?: number
}): SavantHandleSteps {
  // FID-2026-0814-004 H-07: when the caller threads compression config
  // (protocol.config.yaml), build a fresh variant so the values land in the
  // serialized literals. Otherwise reuse the pre-baked module variants.
  if (
    keepRecentTokens !== undefined ||
    autoCompactRatio !== undefined ||
    forceCompactOffset !== undefined
  ) {
    return createSavantHandleSteps({
      defaultMaxContextLength: maxContextLength,
      cacheExpiryMs: isFree ? 30 * 60 * 1000 : undefined,
      keepRecentTokens,
      autoCompactRatio,
      forceCompactOffset,
    })
  }
  if (isFree) {
    if (maxContextLength === 250_000) return handleStepsFree250k
    return handleStepsFree400k
  }
  if (maxContextLength === 250_000) return handleSteps250k
  return handleSteps400k
}
