import fs from 'node:fs'
import path from 'node:path'

import { validateFidStepStatus } from '@savant-code/agent-runtime/echo/fid-validator'

import type { FidLedgerIssue } from './fid-ledger-types'

/**
 * Validate the `## Step Status` sections of every active and archived FID
 * (Anti-Deferral Gate, FID-2026-0817-005).
 *
 * A FID that carries a Step Status section must not declare
 * `converged`/`closed` while any step is unresolved (no
 * `operator-approved <YYYY-MM-DD>` marker). An archived `closed` FID with
 * unresolved steps is a hard failure — this is the class that made the
 * 2026-08-16 six-planning-FID incident invisible. FIDs without a Step
 * Status section are unaffected (validation is section-conditional).
 */
export function validateFidStepLedger(root: string): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  const scan = (directory: string): void => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!/^FID-\d{4}-\d{4}-\d{3}-.+\.md$/.test(entry.name)) continue
      const filePath = path.join(directory, entry.name)
      const content = fs.readFileSync(filePath, 'utf8')
      if (!content.includes('## Step Status')) continue
      const errors = validateFidStepStatus(content).filter(
        (error) => !error.startsWith('advisory:'),
      )
      for (const error of errors) {
        issues.push({
          code: 'fid.steps.unresolved',
          message: `${entry.name}: ${error}`,
        })
      }
    }
  }
  scan(path.join(root, 'dev', 'fids'))
  scan(path.join(root, 'dev', 'fids', 'archive'))
  return issues
}
