/**
 * FID-2026-0915-002 — pure report section builders, moved verbatim from
 * renderReport() in report.ts (move-only split, seam 3b: the
 * uptime/index/churn/quality table builders — the W2 index, W3 churn, and
 * W6 quality sections are wholly optional; they render only when the
 * caller supplies their rows). Each builder is pure and takes its
 * ReportInput slice.
 */
import {
  boundaryDisplay,
  boundaryRank,
  modelsCell,
  ROSTER_CAP,
} from './report-format'

import type { ReportInput } from './report'

export type ModelIndexRow = NonNullable<ReportInput['modelIndexRows']>[number]
export type ChurnData = NonNullable<ReportInput['churn']>
export type QualityRow = NonNullable<ReportInput['qualityRows']>[number]

/**
 * Candidates-by-readiness section: grouped by category, sorted by
 * readiness (verified boundary first, then models, then latency), with
 * the per-host model roster. Constant columns are suppressed
 * (blank = unchanged, — = unmeasured). Moved verbatim from renderReport
 * (split 3b, second-level seam when report.ts still measured 336).
 */
export function renderCandidatesSection(input: ReportInput): string[] {
  const lines: string[] = []
  lines.push('## Candidates by readiness')
  lines.push('')
  if (input.candidates.length === 0) {
    lines.push('_No candidates passed stage-0 this run._')
    lines.push('')
    return lines
  }
  const groups: Array<[string, string]> = [
    ['First-party free tiers', 'first-party-free'],
    ['Commercial aggregators', 'commercial-aggregator'],
  ]
  const sorted = [...input.candidates].sort((a, b) => {
    const rank = boundaryRank(a.boundary) - boundaryRank(b.boundary)
    if (rank !== 0) return rank
    const models = (b.modelsCount ?? 0) - (a.modelsCount ?? 0)
    if (models !== 0) return models
    return (
      (a.latencyMs ?? Number.MAX_SAFE_INTEGER) -
      (b.latencyMs ?? Number.MAX_SAFE_INTEGER)
    )
  })
  for (const [heading, category] of groups) {
    const rows = sorted.filter((c) => c.category === category)
    if (rows.length === 0) continue
    lines.push(`### ${heading} (${rows.length})`)
    lines.push('')
    lines.push(
      '| Host | Auth boundary | Models | Latency | Uptime (14d) | Status |',
    )
    lines.push('|---|---|---|---|---|---|')
    for (const c of rows) {
      const status =
        !c.classification || c.classification === 'unchanged'
          ? ''
          : `${c.classification}${c.downStreak > 0 ? ` (down x${c.downStreak})` : ''}`
      const uptime = c.uptime
        ? `${c.uptime.pct}% · ${c.uptime.avgMs}ms avg`
        : '—'
      lines.push(
        `| ${c.host} | ${boundaryDisplay(c.boundary)} | ${modelsCell(c)} | ${c.latencyMs !== null ? `${c.latencyMs}ms` : '—'} | ${uptime} | ${status} |`,
      )
    }
    lines.push('')
  }
  const other = sorted.filter(
    (c) => !groups.some(([, cat]) => c.category === cat),
  )
  if (other.length > 0) {
    lines.push(`### Other (${other.length})`)
    lines.push('')
    for (const c of other) {
      lines.push(
        `- ${c.host} — ${boundaryDisplay(c.boundary)} — ${c.classification}`,
      )
    }
    lines.push('')
  }
  // ----------------------------------------------------------------
  // Model availability roster — WHICH models, capped per host.
  // ----------------------------------------------------------------
  const withModels = sorted.filter((c) => (c.models?.length ?? 0) > 0)
  if (withModels.length > 0) {
    lines.push('#### Model availability')
    lines.push('')
    lines.push(
      "_Plain counts are from our own `/v1/models` probe; † counts come from the feed's free-model list (the endpoint does not expose its list unauthenticated)._",
    )
    lines.push('')
    for (const c of withModels) {
      const listed = c.models ?? []
      const probed = typeof c.modelsCount === 'number' && c.modelsCount > 0
      const countLabel = probed
        ? `${c.modelsCount} probed`
        : `${listed.length} feed-listed†`
      const shown = listed.slice(0, ROSTER_CAP)
      const tail =
        listed.length > shown.length
          ? ` … (+${listed.length - shown.length} more)`
          : ''
      lines.push(`- **${c.host}** (${countLabel}): ${shown.join(', ')}${tail}`)
    }
    lines.push('')
  }
  return lines
}

/** W2 — Model availability index section (absent when no rows). */
export function renderModelIndexSection(
  rows: ReportInput['modelIndexRows'],
): string[] {
  if (!rows || rows.length === 0) return []
  const lines: string[] = []
  lines.push('## Model availability index')
  lines.push('')
  lines.push(
    '_Which verified free hosts serve each model family. Hosts are readiness-ordered (verified boundary first, then latency)._',
  )
  lines.push('')
  for (const row of rows) {
    const tail = row.more > 0 ? ` … (+${row.more} more)` : ''
    lines.push(
      `- **${row.family}** (${row.hosts.length + row.more}): ${row.hosts.join(', ')}${tail}`,
    )
  }
  lines.push('')
  return lines
}

/** W3 — Ecosystem churn section (absent when no churn data). */
export function renderChurnSection(churn: ReportInput['churn']): string[] {
  if (!churn) return []
  const lines: string[] = []
  lines.push('## Ecosystem churn')
  lines.push('')
  lines.push(
    `- **New in the last 7 days (${churn.newLast7Days.length}):** ${churn.newLast7Days.length > 0 ? churn.newLast7Days.join(', ') : '—'}`,
  )
  lines.push(
    `- **Lapsed (72h rule, all time): ${churn.lapsedHosts.length}**${churn.lapsedHosts.length > 0 ? ` — ${churn.lapsedHosts.join(', ')}` : ''}`,
  )
  lines.push(
    `- **Median lifespan of dead hosts:** ${churn.medianLifespanDays !== null ? `${Math.round(churn.medianLifespanDays)} days` : '— (no deaths observed yet)'}`,
  )
  lines.push('')
  return lines
}

/** W6 — Quality (operator-run gauntlet) section (absent when no rows). */
export function renderQualitySection(
  qualityRows: ReportInput['qualityRows'],
): string[] {
  if (!qualityRows || qualityRows.length === 0) return []
  const lines: string[] = []
  lines.push('## Quality (operator-run gauntlet)')
  lines.push('')
  lines.push('| Host | Score | Avg latency | Run date |')
  lines.push('|---|---|---|---|')
  for (const q of qualityRows) {
    lines.push(
      `| ${q.host} | ${q.score} | ${q.latencyMs !== null ? `${q.latencyMs}ms` : '—'} | ${q.runDate} |`,
    )
  }
  lines.push('')
  return lines
}
