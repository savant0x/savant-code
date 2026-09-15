/**
 * FID-2026-0915-002 — report format helpers, moved verbatim from
 * report.ts (move-only split, seam 3a: `boundaryDisplay`/`boundaryRank`/
 * `auditGroupLabel`/`wrapHosts`/`ROSTER_CAP`/`modelsCell`). These were
 * module-private in report.ts; the public report surface is unchanged.
 */
import type { ReportAuditRow, ReportCandidate } from './report'

/** Display form of an auth-boundary verdict (standing verdicts included). */
export function boundaryDisplay(boundary: string): string {
  if (boundary === 'boundary-ok') return 'ok'
  if (boundary === 'open-relay-reject') return 'RELAY ✗'
  if (boundary === 'boundary-unverifiable') return 'unverified'
  if (boundary === 'not-probed-this-run' || boundary === '') return '—'
  return boundary
}

/** Sort rank: ready-to-use first, open relays last. */
export function boundaryRank(boundary: string): number {
  if (boundary === 'boundary-ok') return 0
  if (boundary === 'boundary-unverifiable') return 1
  return 2
}

/** Short group label for an audit reason (the counted-group heading). */
export function auditGroupLabel(row: ReportAuditRow): string | null {
  if (row.decision === 'flagged') return null // unique evidence — listed individually
  if (row.reason.startsWith('status=risky'))
    return 'Excluded · status=risky (MQ2 hard-exclusion)'
  if (row.reason.startsWith('status=down'))
    return 'Excluded · status=down (dead endpoint)'
  if (row.reason.startsWith('category=free-relay'))
    return 'Excluded · category=free-relay (anonymous relay class — LLMjacking)'
  if (row.reason.startsWith('open relay')) return 'Rejected · open relay'
  if (row.reason.startsWith('typosquat tier-1'))
    return 'Rejected · typosquat tier-1'
  if (row.reason.startsWith('already a built-in'))
    return 'Deduped · already a built-in provider'
  return `Excluded · ${row.decision}`
}

/** Wrap a host list across lines, max per line, comma-joined. */
export function wrapHosts(hosts: string[], perLine = 4): string[] {
  const lines: string[] = []
  for (let i = 0; i < hosts.length; i += perLine) {
    lines.push(hosts.slice(i, i + perLine).join(', '))
  }
  return lines
}

export const ROSTER_CAP = 6

/**
 * The Models column never lies: a probed count renders plain; a count from
 * the feed's free-model list carries the † marker (the endpoint hides its
 * list unauthenticated — 0 from the probe ≠ no models); nothing known = —.
 */
export function modelsCell(c: ReportCandidate): string {
  const listed = c.models?.length ?? 0
  if (typeof c.modelsCount === 'number' && c.modelsCount > 0) {
    return String(c.modelsCount)
  }
  if (listed > 0) return `${listed}†`
  return '—'
}
