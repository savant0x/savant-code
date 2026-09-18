/**
 * FID-2026-0914-003 — Stage-E health verdicts.
 *
 * Pipeline-sourced (stamped) custom providers are probed by every daily
 * harvest. A provider whose auth boundary drifts to open (2xx on the
 * unauthenticated dummy) is COMPROMISED — a signal, never mere downtime
 * (LLMjacking class). Unverifiable boundaries degrade without false alarms.
 */

import type { CandidateState } from '@savant-code/common/providers/discovery-state'

export type HealthVerdict = 'healthy' | 'degraded' | 'down' | 'compromised'

/** The 72h grace rule: 3 consecutive down days lapses a candidate. */
export const PROBE_LAPSED_AFTER_DAYS = 3

/**
 * FID-2026-0918-002 — re-probe cadence for `boundary-unverifiable` hosts,
 * in days. Deliberately the SAME number as the 72h grace rule (one truth,
 * Law 13): a host's boundary evidence is at most 3 days stale, matching
 * the lapse window a false assumption could survive.
 */
export const UNVERIFIABLE_REPROBE_DAYS = PROBE_LAPSED_AFTER_DAYS

/**
 * The cadence gate: whether an unverifiable host's standing verdict is
 * stale enough to re-measure this run. Never-attempted and malformed
 * timestamps fail OPEN (probe now) — a conservative default that can only
 * spend an extra probe, never lose evidence.
 */
export function shouldReprobeUnverifiable(
  state: Pick<CandidateState, 'lastBoundary' | 'lastProbeAttemptUtc'>,
  nowMs: number,
): boolean {
  if (state.lastBoundary !== 'boundary-unverifiable') return false
  if (state.lastProbeAttemptUtc === undefined) return true
  const last = Date.parse(state.lastProbeAttemptUtc)
  if (Number.isNaN(last)) return true
  return nowMs - last >= UNVERIFIABLE_REPROBE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Stamp a probe attempt into a host's state (pure — returns a NEW record).
 * Called on EVERY attempted probe regardless of verdict, so the cadence
 * never re-fires early on a failed measurement.
 */
export function withProbeAttempt(
  state: CandidateState,
  nowMs: number,
): CandidateState {
  return {
    ...state,
    lastProbeAttemptUtc: new Date(nowMs).toISOString(),
  }
}

export function healthVerdict(probe: {
  reachable: boolean
  modelsCount: number
  boundary: 'boundary-ok' | 'open-relay-reject' | 'boundary-unverifiable' | null
}): HealthVerdict {
  if (probe.boundary === 'open-relay-reject') return 'compromised'
  if (!probe.reachable) return 'down'
  if (probe.boundary === 'boundary-unverifiable' || probe.modelsCount === 0) {
    return 'degraded'
  }
  return 'healthy'
}

export function healthDetail(verdict: HealthVerdict): string {
  switch (verdict) {
    case 'compromised':
      return 'auth boundary drifted OPEN (2xx on unauthenticated generation) — treat as compromised; remove via /provider remove <id> unless you can explain the change'
    case 'down':
      return 'endpoint unreachable — counts toward the 72h lapse rule'
    case 'degraded':
      return 'reachable but model list or auth boundary could not be verified this run'
    case 'healthy':
      return 'reachable, model list parses, auth boundary still requires credentials'
  }
}
