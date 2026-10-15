// FID-2026-0819-005 Loop 140: the serialized-generator template (its
// self-contained function source) moved to handle-steps-template.ts; this
// module keeps the factory contract + the four baked variant exports. The
// template module owns the serialized-source invariants (see its header).
import {
  TRIGGER_THRESHOLD_INLINE_SOURCE,
  buildSavantHandleStepsSource,
} from './handle-steps-template'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'

export type SavantHandleSteps = Extract<
  NonNullable<SecretAgentDefinition['handleSteps']>,
  (...args: never[]) => unknown
>

export { TRIGGER_THRESHOLD_INLINE_SOURCE }

export function createSavantHandleSteps(config: {
  defaultMaxContextLength: 250_000 | 400_000
  cacheExpiryMs?: number
  /** P3a — fold one oldest exchange per completed turn (off by default). */
  amortizedFold?: boolean
  /** P3a — fold only above this context floor (tokens). */
  foldFloorTokens?: number
  /** P3c — idle compaction predicate (off by default). */
  idleCompaction?: {
    enabled: boolean
    idleAfterSeconds: number
    floorTokens: number
  }
  /** FID-2026-0814-004 H-07 — pruner tail budget (tokens), from
   *  `compression.keepRecentTokens`. Baked as a literal; the pruner reads it
   *  from its spawn params (`agents/context-pruner/main.ts:177-178`). */
  keepRecentTokens?: number
  /** FID-2026-0814-004 H-07 — proactive pruner ratio, from
   *  `compression.autoCompactRatio` (default 0.8). */
  autoCompactRatio?: number
  /** FID-2026-0814-013 — force pruner offset (tokens below the window), from
   *  `compression.forceCompactOffset` (default 15_000). */
  forceCompactOffset?: number
}): SavantHandleSteps {
  const {
    defaultMaxContextLength,
    cacheExpiryMs,
    amortizedFold = false,
    foldFloorTokens = 40_000,
    idleCompaction = {
      enabled: false,
      idleAfterSeconds: 1800,
      floorTokens: 40_000,
    },
    keepRecentTokens = 16_384,
    autoCompactRatio = 0.8,
    forceCompactOffset = 15_000,
  } = config
  const cacheExpiryParam =
    cacheExpiryMs === undefined ? '' : `cacheExpiryMs: ${cacheExpiryMs},`
  const keepRecentTokensParam = `keepRecentTokens: ${keepRecentTokens},`
  const autoCompactRatioLiteral = String(autoCompactRatio)
  const forceCompactOffsetLiteral = String(forceCompactOffset)
  const amortizedFoldLiteral = amortizedFold ? 'true' : 'false'
  const foldFloorLiteral = String(foldFloorTokens)
  const idleEnabledLiteral = idleCompaction.enabled ? 'true' : 'false'
  const idleAfterMsLiteral = String(idleCompaction.idleAfterSeconds * 1000)
  const idleFloorLiteral = String(idleCompaction.floorTokens)
  const source = buildSavantHandleStepsSource({
    defaultMaxContextLength,
    keepRecentTokensParam,
    cacheExpiryParam,
    amortizedFoldLiteral,
    foldFloorLiteral,
    idleEnabledLiteral,
    idleAfterMsLiteral,
    idleFloorLiteral,
    forceCompactOffsetLiteral,
    autoCompactRatioLiteral,
  })
  return eval(`(${source})`) as SavantHandleSteps
}

export const handleStepsFree250k = createSavantHandleSteps({
  defaultMaxContextLength: 250_000,
  keepRecentTokens: 16_384,
  autoCompactRatio: 0.8,
  forceCompactOffset: 15_000,
  cacheExpiryMs: 30 * 60 * 1000,
})
export const handleStepsFree400k = createSavantHandleSteps({
  defaultMaxContextLength: 400_000,
  cacheExpiryMs: 30 * 60 * 1000,
})
export const handleSteps250k = createSavantHandleSteps({
  defaultMaxContextLength: 250_000,
})
export const handleSteps400k = createSavantHandleSteps({
  defaultMaxContextLength: 400_000,
})
