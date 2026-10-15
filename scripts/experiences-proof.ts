import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  EXPERIENCES_DIR_NAME,
  EXPOSURE_DIR_NAME,
  experienceExposureReceiptSchema,
  exposureReceiptFileName,
  exposureReceiptReadablePrefix,
} from '@savant-code/common/types/experience'

import type { FixBoundary } from './experiences-recurrence'
import type {
  ExperienceExposureReceipt,
  ExposureSession,
} from '@savant-code/common/types/experience'

/** Inspection result: the issues found, plus the exposure that qualified. */
export interface BoundaryInspection {
  issues: string[]
  exposure: ExposureSession[]
}

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

/**
 * FID-2026-1012-024 Loop 11 — receipts are discovered, never listed. The store
 * is the evidence surface: a boundary cannot be declared without the sink (which
 * reads only declared boundaries) producing the exposure, so a hand-maintained
 * manifest array was the one thing no code could ever fill.
 */
function receiptFiles(root: string): string[] {
  try {
    const directory = path.join(root, EXPERIENCES_DIR_NAME, EXPOSURE_DIR_NAME)
    return fs
      .readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => path.join(directory, name))
  } catch {
    return []
  }
}

/** An unparseable file is attributable only by its readable name prefix. */
function namesBoundary(file: string, boundary: FixBoundary): boolean {
  return path
    .basename(file)
    .startsWith(exposureReceiptReadablePrefix(boundary.classKey))
}

/**
 * Inspect one declared repair boundary: its declared evidence files, the
 * receipts the store holds for it, and the boundary's own place in local
 * history. A receipt that names another boundary commit or fix time belongs to
 * that boundary — a renewed repair earns its own exposure, and an older receipt
 * can never be reused.
 */
export function inspectBoundaryEvidence(
  root: string,
  boundary: FixBoundary,
): BoundaryInspection {
  const issues: string[] = []
  const exposure: ExposureSession[] = []
  for (const evidence of [
    boundary.implementationEvidence,
    boundary.captureEvidence,
  ]) {
    if (!evidenceFile(root, evidence))
      issues.push(`missing or outside-workspace evidence: ${evidence}`)
  }
  for (const file of receiptFiles(root)) {
    const relative = path.relative(root, file)
    let receipt: ExperienceExposureReceipt
    try {
      receipt = experienceExposureReceiptSchema.parse(
        JSON.parse(fs.readFileSync(file, 'utf8')),
      )
    } catch {
      if (namesBoundary(file, boundary))
        issues.push(`invalid production exposure receipt: ${relative}`)
      continue
    }
    if (receipt.classKey !== boundary.classKey) continue
    if (
      receipt.boundaryCommit !== boundary.commit ||
      receipt.boundaryFixedAt !== boundary.fixedAt
    )
      continue
    if (path.basename(file) !== exposureReceiptFileName(receipt)) {
      issues.push(`renamed or edited exposure receipt: ${relative}`)
      continue
    }
    const runCommittedAt = committedAt(root, receipt.implementationCommit)
    if (!Number.isFinite(runCommittedAt)) {
      issues.push(`unresolvable exposure run revision: ${relative}`)
      continue
    }
    if (!ranAtOrAfter(root, boundary.commit, receipt.implementationCommit)) {
      issues.push(`exposure receipt disagrees with boundary: ${relative}`)
      continue
    }
    if (Date.parse(receipt.exercisedAt) < runCommittedAt) {
      issues.push(`exposure predates its recorded run revision: ${relative}`)
      continue
    }
    exposure.push({
      sessionId: receipt.sessionId,
      exercisedAt: receipt.exercisedAt,
      evidence: relative,
    })
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
  return { issues, exposure }
}
