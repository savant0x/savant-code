#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateEmbeddedLearningSource } from './learnings-core.js'
import {
  EMBEDDED_LEARNINGS_PATH,
  collectEmbeddedProjectionIssues,
  writeEmbeddedLearningProjection,
} from './learnings-projection.js'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const embeddedPath = path.join(root, EMBEDDED_LEARNINGS_PATH)

function reportIssues(
  issues: ReturnType<typeof collectEmbeddedProjectionIssues>,
) {
  if (issues.length === 0) return
  console.error(`learnings projection: FAIL (${issues.length} issue(s))`)
  for (const issue of issues)
    console.error(`- [${issue.code}] ${issue.message}`)
  process.exitCode = 1
}

function collectCheckIssues() {
  const issues = collectEmbeddedProjectionIssues(root)
  if (!fs.existsSync(embeddedPath)) return issues
  try {
    issues.push(
      ...validateEmbeddedLearningSource(
        EMBEDDED_LEARNINGS_PATH,
        fs.readFileSync(embeddedPath, 'utf8'),
      ),
    )
  } catch {
    issues.push({
      code: 'learning.projection.read',
      message: `Unable to read ${EMBEDDED_LEARNINGS_PATH}.`,
    })
  }
  return issues
}

const args = process.argv.slice(2)
if (args.includes('--write') && args.includes('--check')) {
  console.error(
    'learnings projection: --write and --check are mutually exclusive',
  )
  process.exitCode = 1
} else if (args.includes('--write')) {
  const result = writeEmbeddedLearningProjection(root)
  if (result.issues.length > 0) reportIssues(result.issues)
  else
    console.log(
      `learnings projection: WRITE (${result.wrote ? 'projection regenerated' : 'projection already current'})`,
    )
} else {
  const issues = collectCheckIssues()
  if (issues.length > 0) reportIssues(issues)
  else
    console.log('learnings projection: PASS (boot-tier projection is current)')
}
