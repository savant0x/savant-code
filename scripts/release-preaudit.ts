#!/usr/bin/env bun
// FID-2026-0913-004 — standalone release pre-audit.
//
//   bun run release:preaudit           # sweep + apply safe fixes (default)
//   bun run release:preaudit --check   # report only, fix nothing
//
// The same sweep runs automatically inside `release:public` before
// preflight; this entry point exists for "am I ready to release?" checks
// between attempts, and for CI.

import { repositoryRoot } from './public-release/local-state'
import { runPreAudit } from './public-release/pre-audit'
import { currentVersion } from './public-release/preflight'

function main(): number {
  const checkOnly = process.argv.includes('--check')
  const root = repositoryRoot()
  const version = currentVersion(root)
  const mode = checkOnly ? 'preview' : 'mutation'
  const { findings, fixedMessages, blocked } = runPreAudit(root, version, mode)

  const blocks = findings.filter((finding) => finding.severity === 'block')
  const autofixes = findings.filter((finding) => finding.severity === 'fixed')
  const warnings = findings.filter((finding) => finding.severity === 'warn')

  console.log(`Release pre-audit v${version} (${mode} mode)`)
  for (const message of fixedMessages) console.log(`  [fixed] ${message}`)
  for (const finding of autofixes) {
    if (checkOnly) console.log(`  [auto-fixable] ${finding.message}`)
  }
  for (const finding of warnings) console.log(`  [warn] ${finding.message}`)
  for (const finding of blocks) console.log(`  [BLOCK] ${finding.message}`)

  if (blocked) {
    console.error(
      `pre-audit: FAIL — ${blocks.length} blocking precondition(s).`,
    )
    return 1
  }
  console.log(
    `pre-audit: PASS — release preconditions clear` +
      (fixedMessages.length > 0
        ? ` (${fixedMessages.length} auto-fix(es) applied)`
        : '') +
      '.',
  )
  return 0
}

process.exitCode = main()
