import { promises as fs } from 'node:fs'

import {
  hasLiveScratchpadLease,
  withScratchpadLock,
} from './scratchpad/coordination'
import { assertPlainPath, isMissing, scratchpadPaths } from './scratchpad/paths'
import {
  deleteUnchanged,
  removeEmptyDirectories,
  scanScratchpad,
} from './scratchpad/scan'

export { acquireScratchpadLease } from './scratchpad/coordination'

const HOUR_MS = 60 * 60 * 1000
interface ScratchpadPolicy {
  retentionMs: number
  graceMs: number
  maxBytes: number
  maxFiles: number
  scanLimit: number
}
export const SCRATCHPAD_POLICY: Readonly<ScratchpadPolicy> = Object.freeze({
  retentionMs: 24 * HOUR_MS,
  graceMs: HOUR_MS,
  maxBytes: 32 * 1024 * 1024,
  maxFiles: 1000,
  scanLimit: 10000,
})

export interface ScratchpadReport {
  files: number
  bytes: number
  removedFiles: number
  removedBytes: number
  protected: boolean
  complete: boolean
  overQuota: boolean
  skippedLinks: number
  warning?: string
}

interface SweepOptions {
  clean?: boolean
  now?: number
  policy?: typeof SCRATCHPAD_POLICY
}

/** Fail-open for the application, fail-closed for deletion. */
export async function manageScratchpad(
  projectRoot: string,
  options: SweepOptions = {},
): Promise<ScratchpadReport> {
  const result: ScratchpadReport = {
    files: 0,
    bytes: 0,
    removedFiles: 0,
    removedBytes: 0,
    protected: false,
    complete: true,
    overQuota: false,
    skippedLinks: 0,
  }
  const { project, scratch } = scratchpadPaths(projectRoot)
  try {
    await assertPlainPath(project, scratch)
    await fs.access(scratch)
    return await withScratchpadLock(project, async (control) => {
      result.protected = await hasLiveScratchpadLease(control)
      await sweep(project, scratch, result, options)
      return result
    })
  } catch (error) {
    if (!isMissing(error)) {
      result.complete = false
      result.warning =
        error instanceof Error
          ? error.message
          : 'Scratchpad housekeeping failed'
    }
    return result
  }
}

async function sweep(
  project: string,
  scratch: string,
  result: ScratchpadReport,
  options: SweepOptions,
): Promise<void> {
  const policy = options.policy ?? SCRATCHPAD_POLICY
  const now = options.now ?? Date.now()
  const scan = await scanScratchpad(project, scratch, policy.scanLimit)
  result.complete = scan.complete
  result.skippedLinks = scan.skippedLinks
  result.files = scan.files.length
  result.bytes = scan.files.reduce((sum, file) => sum + file.size, 0)
  const overQuota = () =>
    result.bytes > policy.maxBytes || result.files > policy.maxFiles
  if (options.clean && !result.protected) {
    for (const file of scan.files.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
      const age = now - file.mtimeMs
      const expired = age >= policy.retentionMs
      // A partial inventory above quota already proves excess; pruning it
      // makes the next bounded scan advance through a large legacy backlog.
      const quotaEligible = overQuota() && age >= policy.graceMs
      if (!expired && !quotaEligible) continue
      if (!(await deleteUnchanged(project, file))) continue
      result.removedFiles++
      result.removedBytes += file.size
      result.files--
      result.bytes -= file.size
    }
    await removeEmptyDirectories(project, scan.directories)
  }
  result.overQuota = overQuota()
}

export function formatScratchpadReport(report: ScratchpadReport): string {
  return [
    `Scratchpad: ${report.files} files, ${report.bytes} bytes; removed ${report.removedFiles} files (${report.removedBytes} bytes).`,
    'Retention: 24 hours; idle budget: 32 MiB / 1,000 files; quota grace: 1 hour.',
    report.protected
      ? 'Live run: deletion protected.'
      : 'No live Savant run lease.',
    report.overQuota ? 'Budget exceeded; protected/recent files remain.' : '',
    !report.complete
      ? 'Inventory incomplete; quota compliance unverified.'
      : '',
    report.skippedLinks ? `${report.skippedLinks} links skipped.` : '',
    report.warning ?? '',
  ]
    .filter(Boolean)
    .join('\n')
}
