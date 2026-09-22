#!/usr/bin/env bun

/**
 * FID-2026-0919-025 — standalone scope register-completeness check.
 *
 * `validate:repository` already runs this sweep as `scope.unregistered-item`,
 * but that script can never be declared as a FID gate (it re-enters FID gate
 * execution → recursion, FID-2026-0915-004). Exposing the same authority as a
 * runnable probe lets a record prove it on its own receipt, exactly as
 * `scripts/audit-gate-env-parity.ts` and `scripts/scope-guard-check.ts` do.
 *
 * Exit 0 = every active FID and every cited task has a line in SCOPE.md.
 * Exit 1 = at least one gap, printed as `file:line: message`.
 */

import { collectRegisterCompletenessIssues } from '@savant-code/agent-runtime/echo/scope-register-completeness'

export function scopeRegisterMain(root: string = process.cwd()): number {
  const issues = collectRegisterCompletenessIssues(root)
  if (issues.length === 0) {
    console.log('scope-register PASS (0 issues)')
    return 0
  }
  console.error(`scope-register FAIL (${issues.length} issue(s))`)
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line}: ${issue.message}`)
  }
  return 1
}

if (import.meta.main) {
  // Optional root argument, so any tree can be checked from a repo cwd.
  process.exitCode = scopeRegisterMain(process.argv[2] ?? process.cwd())
}
