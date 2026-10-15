import fs from 'fs'
import path from 'path'

import { HEADLESS_EXIT_ERROR, HEADLESS_EXIT_OK } from '../headless-run'

const FID_FILE_PATTERN = /^FID-\d{4}-\d{4}-\d{3}-.+\.md$/
const FID_ID_PATTERN = /^(FID-\d{4}-\d{4}-\d{3})-/

export type ScannedFid = { id: string; status: string }

/**
 * Scan `dev/fids/` for active (non-archived) FIDs. Returns every FID with its
 * `**Status:**` value — the completion certificate is the zero-open-FID
 * condition, never the agent's self-report.
 */
export function scanActiveFids(root: string): ScannedFid[] {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && FID_FILE_PATTERN.test(entry.name))
    .map((entry) => {
      const content = fs.readFileSync(path.join(directory, entry.name), 'utf8')
      const status =
        content.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim() ?? 'unknown'
      const id = entry.name.match(FID_ID_PATTERN)?.[1] ?? ''
      return { id, status }
    })
}

/** The open (non-closed) FID ids — the completion gate input. */
export function openFidIds(fids: readonly ScannedFid[]): string[] {
  return fids.filter((f) => f.status !== 'closed').map((f) => f.id)
}

/**
 * Exit code = the completion certification: 0 only when zero FIDs remain open
 * (the drive archived every FID through COMPLETE); any open FID is a non-zero
 * exit (a partial or terminal-blocked run).
 */
export function completionExitCode(openIds: readonly string[]): number {
  return openIds.length === 0 ? HEADLESS_EXIT_OK : HEADLESS_EXIT_ERROR
}

/** Write the completion report to `dev/exports/auto-drive-report.md`. */
export function writeCompletionReport(
  root: string,
  report: {
    goal: string
    approvalMode: 'reviewed-plan' | 'upfront-trust'
    openIds: readonly string[]
    exitCode: number
    output: string
  },
): string {
  const exportsDir = path.join(root, 'dev', 'exports')
  fs.mkdirSync(exportsDir, { recursive: true })
  const reportPath = path.join(exportsDir, 'auto-drive-report.md')
  const lines = [
    '# Auto Drive Completion Report',
    '',
    `- **Goal:** ${report.goal}`,
    `- **Approval mode:** ${report.approvalMode}`,
    `- **Exit code:** ${report.exitCode}`,
    `- **Open FIDs:** ${report.openIds.length === 0 ? 'none (certified)' : report.openIds.join(', ')}`,
    '',
    '## Final output',
    '',
    report.output || '(no final output)',
    '',
  ]
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')
  return reportPath
}
