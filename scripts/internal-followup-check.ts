import fs from 'node:fs'
import path from 'node:path'

import { inspectBoundaryEvidence } from './experiences-proof'
import {
  boundaryManifestSchema,
  evaluateClassHorizon,
  inspectLedger,
} from './experiences-recurrence'
import { readInternalFollowups } from './internal-followups'

/** Completion uses the same production proof and horizon as repair assertions. */
export function collectInternalFollowupIssues(root: string): {
  code: string
  message: string
}[] {
  const result = readInternalFollowups(root)
  const messages = [...result.issues]
  const completed = result.followups.flatMap((item) =>
    item.kind === 'observation' && item.status === 'completed'
      ? item.classes
      : [],
  )
  if (completed.length) {
    try {
      const directory = path.join(root, 'dev/experiences')
      const ledger = inspectLedger(
        fs.readFileSync(path.join(directory, 'raw-traces.jsonl'), 'utf8'),
      )
      messages.push(...ledger.issues)
      const boundaries = boundaryManifestSchema.parse(
        JSON.parse(
          fs.readFileSync(path.join(directory, 'fix-boundaries.json'), 'utf8'),
        ),
      )
      for (const entry of completed) {
        const boundary = boundaries.boundaries.find(
          (b) => b.classKey === entry.classKey,
        )
        const proof = boundary
          ? inspectBoundaryEvidence(root, boundary)
          : undefined
        const horizon = evaluateClassHorizon(
          ledger.records,
          entry.classKey,
          boundary,
          proof?.exposure ?? [],
        )
        messages.push(...(proof?.issues ?? []))
        if (horizon.state !== 'observed')
          messages.push(
            `completed observation is unproved: ${entry.classKey} (${horizon.state})`,
          )
      }
    } catch (error) {
      messages.push(`observation evidence unavailable: ${String(error)}`)
    }
  }
  return messages.map((message) => ({ code: 'tracking.internal', message }))
}

if (import.meta.main) {
  const issues = collectInternalFollowupIssues(
    path.resolve(import.meta.dir, '..'),
  )
  console.log(
    `internal followup gate: ${issues.length ? 'FAIL' : 'PASS'} (${issues.length} issues)`,
  )
  for (const issue of issues) console.error(issue.message)
  process.exitCode = issues.length ? 1 : 0
}
