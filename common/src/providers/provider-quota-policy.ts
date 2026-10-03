import type { ProviderQuotaResult } from './provider-quota'
export type QuotaEpisode = {
  level: 'unknown' | 'ok' | 'low' | 'exhausted'
  revision: number
  resetAt?: number
}
export function quotaEpisode(
  previous: QuotaEpisode | undefined,
  reading: ProviderQuotaResult,
  now: number,
): QuotaEpisode {
  const prior = previous ?? { level: 'unknown' as const, revision: 0 }
  if (reading.status !== 'ok' || reading.amount === undefined) return prior
  const resetObserved =
    prior.resetAt !== undefined &&
    prior.resetAt <= now &&
    reading.resetAt !== undefined &&
    reading.resetAt > prior.resetAt
  const ratio =
    reading.limit === undefined ? undefined : reading.amount / reading.limit
  const level =
    reading.amount === 0
      ? 'exhausted'
      : ratio !== undefined && ratio <= 0.1
        ? 'low'
        : !resetObserved &&
            ratio !== undefined &&
            ratio <= 0.15 &&
            (prior.level === 'low' || prior.level === 'exhausted')
          ? prior.level
          : 'ok'
  return {
    level,
    revision: prior.revision + Number(level !== prior.level || resetObserved),
    resetAt: reading.resetAt,
  }
}
