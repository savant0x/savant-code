/**
 * FID-2026-1007-008 — the gauntlet's report. Pure rendering plus one
 * replace-in-place write into a dev/-scoped directory, mirroring
 * `report.ts` and `quality-core.ts`: the report is operator state under
 * `dev/`, never committed and never scheduled. Only this module touches the
 * filesystem — the engine in `identity-core.ts` / `identity-runner.ts` stays
 * pure, which the invariant pin proves.
 *
 * A tool an operator runs once and screenshots is not a testing system; the
 * report is what makes a run re-readable, comparable across dates, and
 * quotable as dated evidence (audit section 9 cites one).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertWithinDev } from './typosquat'

import type { GauntletReport, ProbeSample } from './identity-core'
import type { MatrixReport, MatrixRow } from './identity-matrix'

export interface IdentityReportMeta {
  /** ISO timestamp of the run, supplied by the caller (the CLI clock). */
  generatedAt: string
  /** Exact command, so a report is reproducible rather than anecdotal. */
  command?: string
}

const truncate = (text: string, max = 160): string =>
  text.length <= max ? text : `${text.slice(0, max)}…`

/** A markdown table cell: pipes escaped, newlines collapsed. */
const cell = (value: string): string =>
  value.replaceAll('|', '\\|').replaceAll('\n', ' ')

function sampleRow(sample: ProbeSample): string {
  const tokens =
    sample.usage === undefined
      ? '—'
      : `${sample.usage.inputTokens ?? '—'}/${sample.usage.outputTokens ?? '—'}`
  const status = sample.failure === undefined ? 'ok' : sample.failure.class
  return `| ${cell(sample.probeId)} | ${cell(status)} | ${tokens} | ${sample.latencyMs} | ${cell(truncate(sample.text))} |`
}

export function renderIdentityReport(
  report: GauntletReport,
  meta: IdentityReportMeta,
): string {
  const controls = report.controls
  const lines: string[] = []
  lines.push('# Provider identity gauntlet — report')
  lines.push('')
  lines.push(`- Generated: ${meta.generatedAt}`)
  lines.push(`- Manifest: ${report.manifestVersion}`)
  if (meta.command !== undefined) lines.push(`- Command: \`${meta.command}\``)
  lines.push(
    `- Target: \`${report.target.provider}\` / \`${report.target.requestedModel}\` at ${report.target.baseUrl}`,
  )
  lines.push(`- Verdict: **${report.verdict}**`)
  lines.push(
    `- Controls: same-model \`${controls.sameModel ?? 'not configured'}\`; different-model \`${controls.differentModel ?? 'not configured'}\``,
  )
  lines.push(
    `- Budget: ${report.attemptsUsed}/${report.budget.maxAttempts} attempts, ` +
      `${report.tokensUsed}/${report.budget.maxTotalTokens} tokens, ` +
      `${report.wallMs}/${report.budget.maxWallMs} ms` +
      (report.exhausted ? ` (exhausted: ${report.exhaustionReason})` : ''),
  )
  lines.push('')
  lines.push('## Tested claims')
  lines.push('')
  for (const claim of report.testedClaims) lines.push(`- ${claim}`)
  lines.push('')
  lines.push('## Vectors')
  lines.push('')
  lines.push('| Vector | Status | Completed | Evidence |')
  lines.push('| --- | --- | --- | --- |')
  for (const vector of report.vectors) {
    lines.push(
      `| ${vector.vector} | ${vector.status} | ${vector.completed}/${vector.probes} | ${cell(vector.evidence.join('; '))} |`,
    )
  }
  lines.push('')
  lines.push('## Raw observations (redacted)')
  lines.push('')
  lines.push('| Probe | Class | in/out tokens | ms | Response |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const sample of report.redactedSamples) lines.push(sampleRow(sample))
  lines.push('')
  lines.push('## Evidence lines')
  lines.push('')
  for (const line of report.evidence) lines.push(`- ${line}`)
  if (report.composite !== undefined) {
    lines.push('')
    lines.push(
      `## Composite (calibrated): ${report.composite.score} — components visible above, advisory only`,
    )
  }
  lines.push('')
  lines.push('## What this does not prove')
  lines.push('')
  lines.push(
    '- A `verified-for-tested-claims` verdict covers only the claims listed above,',
  )
  lines.push(
    '  at this timestamp, for this route — it is not cryptographic weight attestation.',
  )
  lines.push(
    '- `inconclusive` is a real outcome, not a failure: absent controls, an unavailable',
  )
  lines.push(
    '  endpoint, or fewer than two completed probes cannot decide identity.',
  )
  lines.push(
    '- Latency is operational data; it does not identify hardware. A tokenizer-band',
  )
  lines.push('  breach is inconsistent evidence, not proof of substitution.')
  lines.push(
    '- No numeric decision threshold is applied. This tool never blocks a user call,',
  )
  lines.push('  quarantines a model, or changes routing.')
  lines.push('')
  lines.push(
    '_Advisory only — a mismatch triggers human review and a separate FID._',
  )
  lines.push('')
  return lines.join('\n')
}

/**
 * Writes `identity-report.md` (human) and `identity-report.json` (machine) at
 * stable paths under a dev/-scoped directory. `resolveBaseDir` is injectable
 * for tests; production passes nothing and gets `process.cwd()`.
 */
export function writeIdentityReport(
  report: GauntletReport,
  meta: IdentityReportMeta,
  devRelativeDir = 'dev/provider-identity',
  resolveBaseDir: () => string = () => process.cwd(),
): { reportPath: string; statePath: string } {
  const normalizedDir = devRelativeDir.replaceAll('\\', '/')
  assertWithinDev(`${normalizedDir}/identity-report.md`)
  const absoluteDir = join(resolveBaseDir(), normalizedDir)
  mkdirSync(absoluteDir, { recursive: true })
  const reportPath = join(absoluteDir, 'identity-report.md')
  writeFileSync(reportPath, renderIdentityReport(report, meta), 'utf8')
  const statePath = join(absoluteDir, 'identity-report.json')
  writeFileSync(statePath, JSON.stringify({ ...meta, report }, null, 2), 'utf8')
  return { reportPath, statePath }
}

function matrixRow(row: MatrixRow): string {
  const served = row.servedModels.length > 0 ? row.servedModels.join(', ') : '—'
  return (
    `| \`${cell(row.model)}\` | ${row.status} | ${cell(served)} | ${row.label} | ` +
    `${row.completed}/${row.probes} | ${row.latencyMs ?? '—'} | ${cell(row.failureClass ?? '—')} |`
  )
}

/**
 * Renders the sweep across a provider's catalog. The per-model row is the unit
 * of truth: a route that is down is reported as that route being down, never as
 * the provider being down.
 */
export function renderMatrixReport(
  matrix: MatrixReport,
  meta: IdentityReportMeta,
): string {
  const lines: string[] = []
  lines.push(`# Provider identity sweep — ${matrix.provider}`)
  lines.push('')
  lines.push(`- Generated: ${meta.generatedAt}`)
  lines.push(`- Manifest: ${matrix.version}`)
  if (meta.command !== undefined) lines.push(`- Command: \`${meta.command}\``)
  lines.push(
    `- Swept **${matrix.summary.models}** routes — ok ${matrix.summary.ok}, ` +
      `unavailable ${matrix.summary.unavailable}, failed ${matrix.summary.failed}`,
  )
  lines.push(
    `- Served-label: ${matrix.summary.labelMatch} match, ` +
      `${matrix.summary.labelMismatch} mismatch (the rest unknown)`,
  )
  lines.push('')
  lines.push('## Routes')
  lines.push('')
  lines.push('| Model | Route | Served label | Label | Probes | ms | Failure |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const row of matrix.rows) lines.push(matrixRow(row))
  const flagged = matrix.rows.filter((row) => row.label === 'mismatch')
  lines.push('')
  lines.push(
    '## Flagged for review (served label does not name the requested model)',
  )
  lines.push('')
  if (flagged.length === 0) {
    lines.push('- none in this sweep')
  } else {
    for (const row of flagged) {
      lines.push(
        `- \`${cell(row.model)}\` was served as \`${cell(row.servedModels.join(', '))}\``,
      )
    }
  }
  lines.push('')
  lines.push('## Availability')
  lines.push('')
  lines.push(
    '- A `failed` route is a route, not a host: another model on the same',
  )
  lines.push('  provider can answer while this one is down.')
  lines.push(
    '- `unavailable` means a quota/credit refusal (funding), not a dead route.',
  )
  lines.push('')
  lines.push('## What this does not prove')
  lines.push('')
  lines.push(
    '- A `match` label is not proof of identity — a proxy can echo any label.',
  )
  lines.push(
    '- `mismatch` is a claim that must be explained, not a fraud verdict; a',
  )
  lines.push('  proxy, a chat template or a load-balancer can cause one.')
  lines.push(
    '- No numeric decision threshold is applied. This tool never blocks a user',
  )
  lines.push('  call, quarantines a model, or changes routing.')
  lines.push('')
  lines.push('_Advisory only — every mismatch triggers human review._')
  lines.push('')
  return lines.join('\n')
}

/** Writes `identity-matrix.md` + `.json` at stable dev/-scoped paths. */
export function writeMatrixReport(
  matrix: MatrixReport,
  meta: IdentityReportMeta,
  devRelativeDir = 'dev/provider-identity',
  resolveBaseDir: () => string = () => process.cwd(),
): { reportPath: string; statePath: string } {
  const normalizedDir = devRelativeDir.replaceAll('\\', '/')
  assertWithinDev(`${normalizedDir}/identity-matrix.md`)
  const absoluteDir = join(resolveBaseDir(), normalizedDir)
  mkdirSync(absoluteDir, { recursive: true })
  const reportPath = join(absoluteDir, 'identity-matrix.md')
  writeFileSync(reportPath, renderMatrixReport(matrix, meta), 'utf8')
  const statePath = join(absoluteDir, 'identity-matrix.json')
  writeFileSync(statePath, JSON.stringify({ ...meta, matrix }, null, 2), 'utf8')
  return { reportPath, statePath }
}
