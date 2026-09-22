#!/usr/bin/env bun

/**
 * FID-2026-0919-024 — standalone scope-disposition check.
 *
 * `validate:repository` already runs this sweep as `scope.prohibited-disposition`,
 * but that script can never be declared as a FID gate (it re-enters FID gate
 * execution → recursion, FID-2026-0915-004). Exposing the same authority as a
 * runnable probe lets a record prove it on its own receipt, exactly as
 * `scripts/audit-gate-env-parity.ts` does.
 *
 * Exit 0 = no prohibited disposition token in any scope surface.
 * Exit 1 = at least one, printed as `file:line: message`.
 */

import { collectScopeDispositionIssues } from '@savant-code/agent-runtime/echo/scope-disposition-guard'

export function scopeGuardMain(root: string = process.cwd()): number {
  const issues = collectScopeDispositionIssues(root)
  if (issues.length === 0) {
    console.log('scope-guard PASS (0 issues)')
    return 0
  }
  console.error(`scope-guard FAIL (${issues.length} issue(s))`)
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line}: ${issue.message}`)
  }
  return 1
}

if (import.meta.main) {
  // Optional root argument, so any tree can be checked from a repo cwd.
  process.exitCode = scopeGuardMain(process.argv[2] ?? process.cwd())
}
