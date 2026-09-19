/**
 * fid-check — `fid:verify --check` scan (FID-2026-0823-009).
 *
 * FID-2026-0918-006 ceiling split: `checkAll` + `activeFidFiles` moved
 * verbatim from fid-verify.ts (FID-2026-0913-002 split discipline;
 * re-exported from fid-verify.ts so every importer is unchanged).
 */
import fs from 'node:fs'
import path from 'node:path'

import { collectContractViolations } from '@savant-code/agent-runtime/echo/fid-verification-contract-sweep'
import {
  parseVerificationGates,
  validateFidVerification,
} from '@savant-code/agent-runtime/echo/fid-verification-gates'

const root = path.resolve(import.meta.dir, '..')

export function activeFidFiles(): string[] {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^FID-.*\.md$/.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
}

/** --check: structural C1+C2 scan over all active fixed/verified FIDs (no execution). */
export function checkAll(): number {
  let failed = false
  for (const file of activeFidFiles()) {
    const content = fs.readFileSync(file, 'utf8')
    const errors = validateFidVerification(content)
    if (errors.length === 0) continue
    failed = true
    console.log(`✗ ${path.basename(file)}`)
    for (const error of errors) console.log(`    - ${error}`)
  }
  // FID-2026-0918-006: grandfathered warning tier — receipt-less documents
  // (converged/analyzed records) report promise gaps as INFO, never as
  // failures. Enumerated BEFORE the failure return so an unrelated stale
  // receipt elsewhere (a document mid-re-stamp in its own closure
  // ceremony) cannot hide grandfathered gaps from the operator: info is
  // info, in every outcome.
  let warned = 0
  for (const file of activeFidFiles()) {
    const content = fs.readFileSync(file, 'utf8')
    const { gates } = parseVerificationGates(content)
    const { warnings } = collectContractViolations(
      content,
      gates.filter((gate) => gate.kind === 'test').map((gate) => gate.arg),
    )
    for (const warning of warnings) {
      if (warned === 0) console.log('verification-contract warnings (info):')
      warned += 1
      console.log(`ℹ ${path.basename(file)}`)
      console.log(`    - ${warning}`)
    }
  }
  if (failed) {
    console.log(
      'fid:verify --check FAILED — fixed/verified FIDs missing valid receipts',
    )
    return 1
  }
  if (warned === 0) {
    console.log(
      'fid:verify --check PASS — all active fixed/verified FIDs carry valid receipts',
    )
  } else {
    console.log(
      `fid:verify --check PASS — all active fixed/verified FIDs carry valid receipts (${warned} verification-contract warning(s))`,
    )
  }
  return 0
}
