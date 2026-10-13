#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

export * from './learnings-core.js'

import { validateLearningArtifacts } from './learnings-artifact-check.js'
import { LEGACY_BOUNDARY, validateLearnings } from './learnings-core.js'
// FID-2026-1012-011: the pass output carries headroom, so the ceiling is
// visible while the gate is green rather than only when it fails.
import { learningsSizeSummary } from './learnings-size-policy.js'

export function readAndValidateLearnings(root: string) {
  return validateLearnings(
    fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8'),
    root,
  )
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  const learningsFile = path.join(root, 'dev', 'LEARNINGS.md')
  const learningsContent = fs.readFileSync(learningsFile, 'utf8')
  const result = validateLearningArtifacts(root, learningsContent)
  const failures = result.issues.filter((issue) => issue.severity !== 'warning')
  for (const warning of result.issues.filter(
    (issue) => issue.severity === 'warning',
  ))
    console.warn(`- [warning] ${warning.code}: ${warning.message}`)
  if (failures.length > 0) {
    console.error(`learnings: FAIL (${failures.length} issue(s))`)
    for (const entry of failures)
      console.error(`- [${entry.code}] ${entry.message}`)
    process.exitCode = 1
  } else {
    // Disambiguate the two populations so the count cannot be misread as
    // "total lessons" (FID-2026-0916-007): entries are the schema-validated
    // governed lessons; narrative lessons below the legacy boundary are
    // preserved but deliberately unvalidated.
    const boundary = learningsContent.indexOf(LEGACY_BOUNDARY)
    const below =
      boundary === -1
        ? 0
        : (learningsContent.slice(boundary).match(/^## Lesson:/gm)?.length ?? 0)
    const summary =
      below === 0
        ? `${result.entries.length} structured entries`
        : `${result.entries.length} structured entries; ${below} narrative entries below boundary — unvalidated by design`
    console.log(
      `learnings: PASS (${summary}; ${learningsSizeSummary(learningsContent)})`,
    )
  }
}
