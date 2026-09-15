/**
 * FID-2026-0914-003 — Stage-E health verdicts.
 *
 * Pipeline-sourced (stamped) custom providers are probed by every daily
 * harvest. A provider whose auth boundary drifts to open (2xx on the
 * unauthenticated dummy) is COMPROMISED — a signal, never mere downtime
 * (LLMjacking class). Unverifiable boundaries degrade without false alarms.
 */

export type HealthVerdict = 'healthy' | 'degraded' | 'down' | 'compromised'

/** The 72h grace rule: 3 consecutive down days lapses a candidate. */
export const PROBE_LAPSED_AFTER_DAYS = 3

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
