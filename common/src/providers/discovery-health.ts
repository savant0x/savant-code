export type DatedFailureState = {
  downSinceUtc?: string
  failureObservations?: string[]
  downStreak: number
}
/** Legacy undated counters never establish elapsed failure history. */
export function observeDatedFailure(
  previous: DatedFailureState | undefined,
  status: 'down' | 'up' | 'unknown',
  now: number,
): DatedFailureState {
  if (status === 'up') return { downStreak: 0, failureObservations: [] }
  if (status === 'unknown')
    return {
      downStreak: previous?.failureObservations?.length ?? 0,
      downSinceUtc: previous?.downSinceUtc,
      failureObservations: previous?.failureObservations ?? [],
    }
  const at = new Date(now).toISOString()
  const observations = (previous?.failureObservations ?? []).filter(
    (s) => Number.isFinite(Date.parse(s)) && Date.parse(s) <= now,
  )
  if (!observations.some((s) => s.slice(0, 10) === at.slice(0, 10)))
    observations.push(at)
  return {
    downSinceUtc: observations[0] ?? at,
    failureObservations: observations.slice(-14),
    downStreak: observations.length,
  }
}
export function hasElapsedFailureWindow(
  state: DatedFailureState,
  now: number,
): boolean {
  return (
    state.downStreak >= 3 &&
    state.downSinceUtc !== undefined &&
    now - Date.parse(state.downSinceUtc) >= 72 * 3600_000
  )
}

import type { CandidateState } from './discovery-state'
export function withHealthObservation(
  previous: CandidateState | undefined,
  provider: { id: string; baseUrl: string },
  verdict: string,
  now: number,
): CandidateState {
  const failure = observeDatedFailure(
    previous,
    verdict === 'down' ? 'down' : verdict === 'healthy' ? 'up' : 'unknown',
    now,
  )
  return {
    category: null,
    fingerprint: 'h00000000',
    lastSeenUtc: new Date(now).toISOString(),
    url: provider.baseUrl,
    lastBoundary: null,
    lastProbe: null,
    ...previous,
    ...failure,
    health: verdict,
    healthObservedAt: new Date(now).toISOString(),
    removalHintId:
      verdict === 'compromised' || hasElapsedFailureWindow(failure, now)
        ? provider.id
        : undefined,
  }
}
