/**
 * FID-2026-0914-003 — the MQ8 stable report (Stage A, step 5).
 *
 * One data-backed report at a fixed path, replaced in place every run
 * (operator ruling: "replaces the file daily so the user can pull it up and
 * look at it anytime"). Every gate decision in the audit trail carries its
 * reason — data-backed by construction. `candidates.json` carries the
 * rolling machine state (downStreak + snapshots), also replaced each run.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertWithinDev } from './typosquat'

export type ReportCandidate = {
  host: string
  category: string | null
  /** Count from OUR /v1/models probe (null/0 when the list is not exposed). */
  modelsCount: number | null
  /** Feed-listed free-model names (the feed's own offering list). */
  models?: string[]
  latencyMs: number | null
  boundary: string
  typosquat: string
  classification: string
  downStreak: number
  /** W1 stability ring summary (null when history is empty). */
  uptime?: { pct: number; avgMs: number } | null
}

export type ReportAuditRow = {
  host: string
  decision: 'rejected' | 'excluded' | 'deduped' | 'flagged'
  reason: string
}

export type ReportInput = {
  fetchedAtUtc: string
  totalRecords: number
  stage0Count: number
  candidates: ReportCandidate[]
  auditTrail: ReportAuditRow[]
  sections: {
    newHosts: string[]
    changedHosts: string[]
    lapsedHosts: string[]
    health: Array<{ host: string; verdict: string; detail: string }>
  }
  /** W2 — precomputed model-first index rows (family → capped host list). */
  modelIndexRows?: Array<{ family: string; hosts: string[]; more: number }>
  /** W3 — first-party ecosystem churn (null when state is too fresh). */
  churn?: {
    newLast7Days: string[]
    lapsedHosts: string[]
    medianLifespanDays: number | null
  } | null
  /** W6 — operator-run quality gauntlet results (absent = never run). */
  qualityRows?: Array<{
    host: string
    score: string
    latencyMs: number | null
    runDate: string
  }>
}

export const REPORT_RELATIVE_PATH = 'dev/provider-candidates/report.md'
export const STATE_RELATIVE_PATH = 'dev/provider-candidates/candidates.json'

/** Display form of an auth-boundary verdict (standing verdicts included). */
function boundaryDisplay(boundary: string): string {
  if (boundary === 'boundary-ok') return 'ok'
  if (boundary === 'open-relay-reject') return 'RELAY ✗'
  if (boundary === 'boundary-unverifiable') return 'unverified'
  if (boundary === 'not-probed-this-run' || boundary === '') return '—'
  return boundary
}

/** Sort rank: ready-to-use first, open relays last. */
function boundaryRank(boundary: string): number {
  if (boundary === 'boundary-ok') return 0
  if (boundary === 'boundary-unverifiable') return 1
  return 2
}

/** Short group label for an audit reason (the counted-group heading). */
function auditGroupLabel(row: ReportAuditRow): string | null {
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
function wrapHosts(hosts: string[], perLine = 4): string[] {
  const lines: string[] = []
  for (let i = 0; i < hosts.length; i += perLine) {
    lines.push(hosts.slice(i, i + perLine).join(', '))
  }
  return lines
}

const ROSTER_CAP = 6

/**
 * The Models column never lies: a probed count renders plain; a count from
 * the feed's free-model list carries the † marker (the endpoint hides its
 * list unauthenticated — 0 from the probe ≠ no models); nothing known = —.
 */
function modelsCell(c: ReportCandidate): string {
  const listed = c.models?.length ?? 0
  if (typeof c.modelsCount === 'number' && c.modelsCount > 0) {
    return String(c.modelsCount)
  }
  if (listed > 0) return `${listed}†`
  return '—'
}

export function renderReport(input: ReportInput): string {
  const lines: string[] = []
  lines.push('# Free-compute discovery report')
  lines.push('')
  lines.push(
    `_Generated ${input.fetchedAtUtc} · feed: ${input.totalRecords} records · pipeline: FID-2026-0914-003_`,
  )
  lines.push('')

  // ------------------------------------------------------------------
  // Executive summary — the 30-second read.
  // ------------------------------------------------------------------
  const relayRejects = input.auditTrail.filter(
    (r) => r.decision === 'rejected',
  ).length
  const boundaryOk = input.candidates.filter(
    (c) => c.boundary === 'boundary-ok',
  ).length
  const flagged = input.auditTrail.filter(
    (r) => r.decision === 'flagged',
  ).length
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|---|---|')
  lines.push(`| Feed records | ${input.totalRecords} |`)
  lines.push(
    `| Stage-0 candidates | ${input.candidates.length} (of ${input.stage0Count} passing the filter) |`,
  )
  lines.push(
    `| This run | ${input.sections.newHosts.length} new · ${input.sections.changedHosts.length} changed · ${input.sections.lapsedHosts.length} lapsed |`,
  )
  lines.push(`| Auth boundary verified ok | ${boundaryOk} |`)
  lines.push(`| Open-relay rejections | ${relayRejects} |`)
  lines.push(`| Typosquat review flags | ${flagged} |`)
  lines.push(`| Tracked pipeline providers | ${input.sections.health.length} |`)
  lines.push('')

  // ------------------------------------------------------------------
  // This run's changes — ONLY when something actually happened.
  // ------------------------------------------------------------------
  const { newHosts, changedHosts, lapsedHosts, health } = input.sections
  if (
    newHosts.length > 0 ||
    changedHosts.length > 0 ||
    lapsedHosts.length > 0
  ) {
    lines.push("## This run's changes")
    lines.push('')
    for (const [label, hosts] of [
      ['New', newHosts],
      ['Changed', changedHosts],
      ['Lapsed (72h rule)', lapsedHosts],
    ] as const) {
      if (hosts.length === 0) continue
      lines.push(`- **${label} (${hosts.length}):** ${hosts.join(', ')}`)
    }
    lines.push('')
  }

  // ------------------------------------------------------------------
  // Candidates grouped by category, sorted by readiness. Constant
  // columns are suppressed (blank = unchanged, — = unmeasured).
  // ------------------------------------------------------------------
  lines.push('## Candidates by readiness')
  lines.push('')
  if (input.candidates.length === 0) {
    lines.push('_No candidates passed stage-0 this run._')
    lines.push('')
  } else {
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
        lines.push(
          `- **${c.host}** (${countLabel}): ${shown.join(', ')}${tail}`,
        )
      }
      lines.push('')
    }
  }

  // ------------------------------------------------------------------
  // W2 — Model availability index: who serves model family X, readiness-
  // ordered. The inverse view of the candidates table.
  // ------------------------------------------------------------------
  if (input.modelIndexRows && input.modelIndexRows.length > 0) {
    lines.push('## Model availability index')
    lines.push('')
    lines.push(
      '_Which verified free hosts serve each model family. Hosts are readiness-ordered (verified boundary first, then latency)._',
    )
    lines.push('')
    for (const row of input.modelIndexRows) {
      const tail = row.more > 0 ? ` … (+${row.more} more)` : ''
      lines.push(
        `- **${row.family}** (${row.hosts.length + row.more}): ${row.hosts.join(', ')}${tail}`,
      )
    }
    lines.push('')
  }

  // ------------------------------------------------------------------
  // W3 — Ecosystem churn: first-party appearance/death data.
  // ------------------------------------------------------------------
  if (input.churn) {
    lines.push('## Ecosystem churn')
    lines.push('')
    lines.push(
      `- **New in the last 7 days (${input.churn.newLast7Days.length}):** ${input.churn.newLast7Days.length > 0 ? input.churn.newLast7Days.join(', ') : '—'}`,
    )
    lines.push(
      `- **Lapsed (72h rule, all time): ${input.churn.lapsedHosts.length}**${input.churn.lapsedHosts.length > 0 ? ` — ${input.churn.lapsedHosts.join(', ')}` : ''}`,
    )
    lines.push(
      `- **Median lifespan of dead hosts:** ${input.churn.medianLifespanDays !== null ? `${Math.round(input.churn.medianLifespanDays)} days` : '— (no deaths observed yet)'}`,
    )
    lines.push('')
  }

  // ------------------------------------------------------------------
  // W6 — Quality (operator-run): only when the gauntlet has been run.
  // ------------------------------------------------------------------
  if (input.qualityRows && input.qualityRows.length > 0) {
    lines.push('## Quality (operator-run gauntlet)')
    lines.push('')
    lines.push('| Host | Score | Avg latency | Run date |')
    lines.push('|---|---|---|---|')
    for (const q of input.qualityRows) {
      lines.push(
        `| ${q.host} | ${q.score} | ${q.latencyMs !== null ? `${q.latencyMs}ms` : '—'} | ${q.runDate} |`,
      )
    }
    lines.push('')
  }

  // ------------------------------------------------------------------
  // Audit trail: counted, grouped by reason — completeness preserved
  // (every host is still listed), without the one-bullet-per-host dump.
  // ------------------------------------------------------------------
  lines.push('## Audit trail (every gate decision, with reason)')
  lines.push('')
  if (input.auditTrail.length === 0) {
    lines.push('_No exclusions or rejections this run._')
    lines.push('')
  } else {
    const groups = new Map<string, ReportAuditRow[]>()
    const individual: ReportAuditRow[] = []
    for (const row of input.auditTrail) {
      const label = auditGroupLabel(row)
      if (label === null) {
        individual.push(row)
        continue
      }
      const bucket = groups.get(label)
      if (bucket) bucket.push(row)
      else groups.set(label, [row])
    }
    for (const [label, rows] of groups) {
      lines.push(`### ${label} — ${rows.length}`)
      lines.push('')
      for (const hostLine of wrapHosts(rows.map((r) => r.host))) {
        lines.push(`- ${hostLine}`)
      }
      lines.push('')
    }
    if (individual.length > 0) {
      lines.push(`### Flagged for review — ${individual.length}`)
      lines.push('')
      for (const row of individual) {
        lines.push(`- **${row.host}** — ${row.reason}`)
      }
      lines.push('')
    }
  }

  // ------------------------------------------------------------------
  // Health (Stage E tracking).
  // ------------------------------------------------------------------
  lines.push('## Health (tracked pipeline providers)')
  lines.push('')
  if (health.length === 0) {
    lines.push('_No pipeline-sourced providers are being health-tracked yet._')
    lines.push('')
  } else {
    lines.push('| Provider | Verdict | Detail |')
    lines.push('|---|---|---|')
    for (const h of health) {
      lines.push(`| ${h.host} | ${h.verdict} | ${h.detail} |`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(
    '_Feed text is a lead, vendor surfaces are ground truth. Additions require explicit operator approval (`/provider add <host>` for probe-passed candidates); removal: `/provider remove <id>`._',
  )
  lines.push('')
  return lines.join('\n')
}

/**
 * Replace-in-place writes (MQ8): `report.md` and `candidates.json` at their
 * stable paths. Production resolves `devRelativeDir` against the repo root
 * and the dev-dir write guard refuses anything outside `dev/`.
 * `resolveBaseDir` is injectable for tests (temp dirs) — production passes
 * nothing and gets `process.cwd()`.
 */
export function writeReportStable(
  devRelativeDir: string,
  reportMarkdown: string,
  stateJson?: string,
  resolveBaseDir: () => string = () => process.cwd(),
): { reportPath: string; statePath: string | null } {
  const normalizedDir = devRelativeDir.replaceAll('\\', '/')
  assertWithinDev(`${normalizedDir}/report.md`)
  const absoluteDir = join(resolveBaseDir(), normalizedDir)
  mkdirSync(absoluteDir, { recursive: true })
  const reportPath = join(absoluteDir, 'report.md')
  writeFileSync(reportPath, reportMarkdown, 'utf8')
  let statePath: string | null = null
  if (stateJson !== undefined) {
    statePath = join(absoluteDir, 'candidates.json')
    writeFileSync(statePath, stateJson, 'utf8')
  }
  return { reportPath, statePath }
}
