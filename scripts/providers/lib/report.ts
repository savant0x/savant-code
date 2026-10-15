/**
 * FID-2026-0914-003 — the MQ8 stable report (Stage A, step 5).
 *
 * One data-backed report at a fixed path, replaced in place every run
 * (operator ruling: "replaces the file daily so the user can pull it up and
 * look at it anytime"). Every gate decision in the audit trail carries its
 * reason — data-backed by construction. `candidates.json` carries the
 * rolling machine state (downStreak + snapshots), also replaced each run.
 *
 * FID-2026-0915-002: format helpers moved to `report-format.ts` (seam 3a)
 * and the optional W2/W3/W6 section builders to `report-sections.ts`
 * (seam 3b). The public surface is unchanged; renderReport delegates the
 * optional sections.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { auditGroupLabel, wrapHosts } from './report-format'
import {
  renderCandidatesSection,
  renderChurnSection,
  renderModelIndexSection,
  renderQualitySection,
} from './report-sections'
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
  // FID-2026-0916-001 (MQ2): the previously-silent classes, now counted
  // in the executive summary.
  const SILENT_PREFIXES = [
    'unconfirmed category',
    'category=monitor-directory',
    'category=free-product',
    'no probe data',
    'feed probe reports',
  ] as const
  const silentClasses = input.auditTrail.filter((r) =>
    SILENT_PREFIXES.some((p) => r.reason.startsWith(p)),
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
  lines.push(`| Silent-class exclusions (now audited) | ${silentClasses} |`)
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
  // Candidates by readiness + roster — moved verbatim to
  // report-sections.ts (second-level seam when this file still measured
  // 336 lines).
  // ------------------------------------------------------------------
  lines.push(...renderCandidatesSection(input))

  // ------------------------------------------------------------------
  // Optional sections (W2 index, W3 churn, W6 quality) — moved verbatim
  // to report-sections.ts; each renders only when its rows are present.
  // ------------------------------------------------------------------
  lines.push(...renderModelIndexSection(input.modelIndexRows))
  lines.push(...renderChurnSection(input.churn))
  lines.push(...renderQualitySection(input.qualityRows))

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
