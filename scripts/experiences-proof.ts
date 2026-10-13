import * as fs from 'node:fs'
import * as path from 'node:path'

import { z } from 'zod/v4'

import type { FixBoundary } from './experiences-recurrence'

const exposureReceiptSchema = z.object({
  kind: z.literal('production-tool-exposure'),
  classKey: z.string().min(1),
  sessionId: z.string().min(1),
  exercisedAt: z.iso.datetime({ offset: true }),
  implementationCommit: z.string().regex(/^[a-f0-9]{40}$/),
  captureVerified: z.literal(true),
})

function evidenceFile(root: string, evidence: string): string | undefined {
  try {
    const target = fs.realpathSync(path.resolve(root, evidence))
    const relative = path.relative(fs.realpathSync(root), target)
    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !fs.statSync(target).isFile()
    )
      return undefined
    return target
  } catch {
    return undefined
  }
}

/** Receipts bind exposure to this class, session and implemented revision. */
export function inspectBoundaryEvidence(
  root: string,
  boundary: FixBoundary,
): string[] {
  const issues: string[] = []
  for (const evidence of [
    boundary.implementationEvidence,
    boundary.captureEvidence,
  ]) {
    if (!evidenceFile(root, evidence))
      issues.push(`missing or outside-workspace evidence: ${evidence}`)
  }
  const seen = new Set<string>()
  for (const exposure of boundary.exposure) {
    const file = evidenceFile(root, exposure.evidence)
    if (!file || seen.has(file)) {
      issues.push(
        `missing, repeated or outside-workspace exposure: ${exposure.evidence}`,
      )
      continue
    }
    seen.add(file)
    try {
      const receipt = exposureReceiptSchema.parse(
        JSON.parse(fs.readFileSync(file, 'utf8')),
      )
      if (
        receipt.classKey !== boundary.classKey ||
        receipt.sessionId !== exposure.sessionId ||
        Date.parse(receipt.exercisedAt) !== Date.parse(exposure.exercisedAt) ||
        receipt.implementationCommit !== boundary.commit
      )
        issues.push(
          `exposure receipt disagrees with boundary: ${exposure.evidence}`,
        )
    } catch {
      issues.push(`invalid production exposure receipt: ${exposure.evidence}`)
    }
  }
  const commit = Bun.spawnSync(
    ['git', 'merge-base', '--is-ancestor', boundary.commit, 'HEAD'],
    { cwd: root },
  )
  if (commit.exitCode !== 0) {
    issues.push(`boundary commit is not in local history: ${boundary.commit}`)
  } else {
    const date = Bun.spawnSync(
      ['git', 'show', '-s', '--format=%cI', boundary.commit],
      { cwd: root },
    )
    const committedAt = Date.parse(date.stdout.toString().trim())
    if (
      date.exitCode !== 0 ||
      !Number.isFinite(committedAt) ||
      Date.parse(boundary.fixedAt) < committedAt
    )
      issues.push(
        `boundary predates its implementation commit: ${boundary.commit}`,
      )
  }
  return issues
}
