#!/usr/bin/env bun
/**
 * FID-2026-1016-016 (LF-005) — the production-acceptance gate.
 *
 * Exit 0 when every recorded run satisfies the acceptance contract, 1 with the
 * issues listed. `--template <runId> [sessionId]` prints an unfilled record for
 * a run (every UI surface starts unverified — the template never claims an
 * observation nobody made).
 *
 * Runnable as a FID `probe` gate and by hand; it reads records only.
 */

import path from 'node:path'

import {
  ACCEPTANCE_DIR,
  acceptanceTemplate,
  collectAcceptanceIssues,
} from './production-acceptance.js'

const root = path.resolve(import.meta.dir, '..')

if (import.meta.main) {
  const templateIndex = process.argv.indexOf('--template')
  if (templateIndex !== -1) {
    const runId = process.argv[templateIndex + 1] ?? ''
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(runId)) {
      console.error(
        'usage: bun scripts/acceptance-check.ts --template <runId> [sessionId]',
      )
      process.exitCode = 2
    } else {
      process.stdout.write(
        acceptanceTemplate(runId, process.argv[templateIndex + 2] ?? ''),
      )
    }
  } else {
    const issues = collectAcceptanceIssues(root)
    console.log(
      `acceptance: ${issues.length ? 'FAIL' : 'PASS'} (${issues.length} issues; ${ACCEPTANCE_DIR})`,
    )
    for (const issue of issues) console.error(issue)
    process.exitCode = issues.length ? 1 : 0
  }
}
