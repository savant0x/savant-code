import { resolveQuotaState } from './provider-quota-state'

import type { ProviderQuotaResult } from './provider-quota'
import type { QuotaState } from './provider-quota-state'

export type QuotaEpisode = {
  /** The five-state truth vocabulary (FID-2026-1005-008). */
  level: QuotaState
  revision: number
  resetAt?: number
}

/**
 * Pure episode reducer over resolved quota states (FID-2026-1005-008,
 * converged design decision 3). `unknown` and `unavailable` readings are
 * display-neutral no-ops: they say nothing about the account, so they
 * neither level-down to `exhausted` nor reset anything. `exhausted` can
 * only arrive through `resolveQuotaState`'s observed-zero/at-limit fact
 * path. Hysteresis and observed-reset semantics are preserved from the
 * pre-vocabulary reducer.
 */
export function quotaEpisode(
  previous: QuotaEpisode | undefined,
  reading: ProviderQuotaResult,
  now: number,
): QuotaEpisode {
  const prior = previous ?? { level: 'unknown' as const, revision: 0 }
  const resolved = resolveQuotaState(reading)
  if (resolved.state === 'unknown' || resolved.state === 'unavailable') {
    return prior
  }
  const resetObserved =
    prior.resetAt !== undefined &&
    prior.resetAt <= now &&
    reading.status === 'ok' &&
    reading.resetAt !== undefined &&
    reading.resetAt > prior.resetAt
  const ratio =
    reading.status === 'ok' &&
    reading.limit !== undefined &&
    reading.amount !== undefined
      ? reading.amount / reading.limit
      : undefined
  const level: QuotaState =
    resolved.state === 'exhausted'
      ? 'exhausted'
      : resolved.state === 'approaching_limit'
        ? 'approaching_limit'
        : !resetObserved &&
            ratio !== undefined &&
            ratio <= 0.15 &&
            (prior.level === 'approaching_limit' || prior.level === 'exhausted')
          ? prior.level
          : 'healthy'
  return {
    level,
    revision: prior.revision + Number(level !== prior.level || resetObserved),
    resetAt: reading.status === 'ok' ? reading.resetAt : prior.resetAt,
  }
}
