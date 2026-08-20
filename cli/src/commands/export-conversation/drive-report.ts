import fs from 'node:fs'
import path from 'node:path'

import { escapeHtml } from './format'

import type { DriveCertification } from '@savant-code/common/types/auto-drive'
import type { DriveRecord } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0818-006 step 5 + FID-2026-0818-007 step 7: the handoff report.
 *
 * `/export` gains two Auto Drive sections when a drive run is present:
 *
 * - **Run Log** (child 005) — the master FID's `## Run Log` section, the
 *   deferred presentation surface where every ladder decision is recorded.
 *   Read from disk (the FID file is ground truth; never the in-memory mirror)
 *   and rendered as an escaped list of the raw bullet lines.
 * - **Certification** (child 006) — the `drive.certification` record
 *   (`criterionResults[]` + `gaps[]`), rendered as a results table + gap list.
 *
 * Both sections are offline, self-contained, and attribution-preserving: the
 * Run Log event frames are mechanical (written by the ladder router), and the
 * criterion results carry the strategy + evidence string the audit produced.
 */

export const DRIVE_RUN_LOG_HEADING = '## Run Log'

/** The certification results table headers (strategy, criterion, verdict, evidence). */
const STRATEGY_LABELS: Record<string, string> = {
  'test-suite': 'Test suite',
  typecheck: 'Typecheck',
  'feature-grep': 'Feature grep',
  'file-existence': 'File exists',
  judgment: 'Scribe cross-check',
}

/**
 * Extract the bullet lines under a `## Run Log` heading from FID markdown.
 * Returns an empty array when the section is absent. Bullets are returned
 * verbatim (still markdown) — the renderer escapes them for HTML.
 */
export function extractRunLogLines(content: string): string[] {
  const startIndex = content.indexOf(DRIVE_RUN_LOG_HEADING)
  if (startIndex === -1) return []
  const afterHeading = content.slice(startIndex + DRIVE_RUN_LOG_HEADING.length)
  // Stop at the next `## ` / `# ` heading (Run Log is the final section, but a
  // defensive stop keeps a stray trailing section from leaking in).
  const nextSection = afterHeading.search(/\n#+\s/)
  const section =
    nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection)
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
}

/**
 * Scan `dev/fids/` for a FID whose content carries a `## Run Log` section and
 * return its file name + bullet lines. The master FID is the only FID the
 * ladder writes the Run Log to (child 005), so a single match is expected;
 * when multiple match (defensive), the first in filename order wins.
 */
export function findMasterFidRunLog(root: string): {
  fileName: string
  lines: string[]
} | null {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return null
  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return null
  }
  const files = entries
    .filter((e) => e.isFile() && /^FID-.*\.md$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const file of files) {
    const content = fs.readFileSync(path.join(directory, file.name), 'utf8')
    const lines = extractRunLogLines(content)
    if (lines.length > 0) return { fileName: file.name, lines }
  }
  return null
}

/**
 * Render the Auto Drive report section(s) into HTML. Returns an empty string
 * when there is no drive data and no Run Log — the report stays a plain
 * transcript for non-drive sessions.
 */
export function renderDriveReportHtml(params: {
  drive: DriveRecord | null
  runLog: { fileName: string; lines: string[] } | null
}): string {
  const { drive, runLog } = params
  if (!drive && !runLog) return ''

  const sections: string[] = []

  if (drive) {
    const meta: string[] = []
    meta.push(
      `<div class="dr-meta"><dt>Run ID</dt><dd>${escapeHtml(drive.driveId)}</dd></div>`,
    )
    meta.push(
      `<div class="dr-meta"><dt>Goal</dt><dd>${escapeHtml(drive.goal)}</dd></div>`,
    )
    meta.push(
      `<div class="dr-meta"><dt>Status</dt><dd>${escapeHtml(drive.status)}</dd></div>`,
    )
    if (drive.activeFid) {
      meta.push(
        `<div class="dr-meta"><dt>Active FID</dt><dd>${escapeHtml(drive.activeFid)}</dd></div>`,
      )
    }
    if (drive.expectPhase) {
      meta.push(
        `<div class="dr-meta"><dt>Phase</dt><dd>${escapeHtml(drive.expectPhase)}</dd></div>`,
      )
    }
    if (drive.acceptanceCriteria.length > 0) {
      meta.push(
        `<div class="dr-meta"><dt>Acceptance criteria</dt><dd>${drive.acceptanceCriteria.length}</dd></div>`,
      )
    }

    sections.push(
      `<section class="drive-report">\n` +
        `<h2><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> Auto Drive</h2>\n` +
        `<dl class="dr-meta-grid">\n${meta.join('\n')}\n</dl>\n` +
        renderCertificationHtml(drive.certification) +
        `\n</section>`,
    )
  }

  if (runLog && runLog.lines.length > 0) {
    const items = runLog.lines
      .map((line) => `<li>${escapeHtml(line.slice(2))}</li>`)
      .join('\n')
    sections.push(
      `<section class="drive-report">\n` +
        `<h2><i class="fa-solid fa-list-ol" aria-hidden="true"></i> Run Log</h2>\n` +
        `<p class="dr-source">Source: <span class="dr-file">${escapeHtml(runLog.fileName)}</span></p>\n` +
        `<ul class="dr-runlog">\n${items}\n</ul>\n` +
        `</section>`,
    )
  }

  return sections.join('\n')
}

/**
 * Render the certification record (child 006) as a results table + gap list.
 * Empty certification (no audit run yet) renders a single "no results" row.
 */
export function renderCertificationHtml(
  certification: DriveCertification | null | undefined,
): string {
  if (!certification) {
    return (
      `<h3>Certification</h3>\n` +
      `<p class="dr-empty">No completion-certification record — the goal-conformance audit has not run.</p>`
    )
  }

  const rows = certification.results
    .map((result) => {
      const badge =
        result.status === 'pass'
          ? 'dr-pass'
          : result.status === 'fail'
            ? 'dr-fail'
            : 'dr-gap'
      const label =
        result.status === 'pass'
          ? 'PASS'
          : result.status === 'fail'
            ? 'FAIL'
            : 'GAP'
      return (
        `<tr>\n` +
        `<td>${escapeHtml(STRATEGY_LABELS[result.strategy] ?? result.strategy)}</td>\n` +
        `<td>${escapeHtml(result.criterionId)}</td>\n` +
        `<td><span class="dr-badge ${badge}">${label}</span></td>\n` +
        `<td>${escapeHtml(result.evidence)}</td>\n` +
        `</tr>`
      )
    })
    .join('\n')

  const gapsHtml =
    certification.gaps.length > 0
      ? `<h3>Gaps</h3>\n<ul class="dr-gaps">\n${certification.gaps
          .map((gap) => `<li>${escapeHtml(gap)}</li>`)
          .join('\n')}\n</ul>`
      : `<h3>Gaps</h3>\n<p class="dr-empty">No gaps — every acceptance criterion passed.</p>`

  return (
    `<h3>Certification</h3>\n` +
    `<table class="dr-cert">\n` +
    `<thead><tr><th>Strategy</th><th>Criterion</th><th>Verdict</th><th>Evidence</th></tr></thead>\n` +
    `<tbody>\n${rows}\n</tbody>\n` +
    `</table>\n` +
    gapsHtml
  )
}
