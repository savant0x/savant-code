#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

export * from './learnings-core.js'

import {
  LEGACY_BOUNDARY,
  validateEmbeddedLearningSource,
  validateLearnings,
} from './learnings-core.js'

export function readAndValidateLearnings(root: string) {
  return validateLearnings(
    fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8'),
    root,
  )
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  const learningsFile = path.join(root, 'dev', 'LEARNINGS.md')
  const result = validateLearnings(fs.readFileSync(learningsFile, 'utf8'), root)
  const sourcePath = path.join(root, 'docs', 'embedded-learnings.md')
  result.issues.push(
    ...(fs.existsSync(sourcePath)
      ? validateEmbeddedLearningSource(
          'docs/embedded-learnings.md',
          fs.readFileSync(sourcePath, 'utf8'),
        )
      : [
          {
            code: 'learning.embedded.missing',
            message: 'docs/embedded-learnings.md is missing.',
          },
        ]),
  )
  if (result.issues.length > 0) {
    console.error(`learnings: FAIL (${result.issues.length} issue(s))`)
    for (const entry of result.issues)
      console.error(`- [${entry.code}] ${entry.message}`)
    process.exitCode = 1
  } else {
    // Disambiguate the two populations so the count cannot be misread as
    // "total lessons" (FID-2026-0916-007): entries are the schema-validated
    // governed lessons; narrative lessons below the legacy boundary are
    // preserved but deliberately unvalidated.
    const boundary = fs
      .readFileSync(learningsFile, 'utf8')
      .indexOf(LEGACY_BOUNDARY)
    const below =
      boundary === -1
        ? 0
        : (fs
            .readFileSync(learningsFile, 'utf8')
            .slice(boundary)
            .match(/^## Lesson:/gm)?.length ?? 0)
    const summary =
      below === 0
        ? `${result.entries.length} structured entries`
        : `${result.entries.length} structured entries; ${below} narrative entries below boundary — unvalidated by design`
    console.log(`learnings: PASS (${summary})`)
  }
}
