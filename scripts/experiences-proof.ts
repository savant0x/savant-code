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

/**
 * FID-2026-1012-024: a receipt records the revision that actually RAN, which is
 * normally HEAD — ahead of the boundary commit that landed the fix. Requiring
 * equality would force every receipt to claim a revision the session never ran,
 * which is the synthetic evidence this probe exists to refuse. The honest rule
 * is ancestry: the boundary commit must be an ancestor of (or equal to) the run
 * that produced the receipt, so a receipt can never be manufactured for code
 * that predates its own fix.
 */
function ranAtOrAfter(
  root: string,
  boundaryCommit: string,
  runCommit: string,
): boolean {
  if (boundaryCommit === runCommit) return true
  const result = Bun.spawnSync(
    ['git', 'merge-base', '--is-ancestor', boundaryCommit, runCommit],
    { cwd: root },
  )
  return result.exitCode === 0
}

/** Unresolvable dates are NaN so chronology checks fail closed. */
function committedAt(root: string, commit: string): number {
  const result = Bun.spawnSync(['git', 'show', '-s', '--format=%cI', commit], {
    cwd: root,
  })
  return result.exitCode === 0
    ? Date.parse(result.stdout.toString().trim())
    : NaN
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
        !ranAtOrAfter(root, boundary.commit, receipt.implementationCommit)
      )
        issues.push(
          `exposure receipt disagrees with boundary: ${exposure.evidence}`,
        )
      const runCommittedAt = committedAt(root, receipt.implementationCommit)
      if (!Number.isFinite(runCommittedAt))
        issues.push(`unresolvable exposure run revision: ${exposure.evidence}`)
      else if (Date.parse(receipt.exercisedAt) < runCommittedAt)
        issues.push(
          `exposure predates its recorded run revision: ${exposure.evidence}`,
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
    const boundaryCommittedAt = committedAt(root, boundary.commit)
    if (
      !Number.isFinite(boundaryCommittedAt) ||
      Date.parse(boundary.fixedAt) < boundaryCommittedAt
    )
      issues.push(
        `boundary predates its implementation commit: ${boundary.commit}`,
      )
  }
  return issues
}
