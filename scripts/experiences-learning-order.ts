import fs from 'node:fs'
import path from 'node:path'

import { inspectBoundaryEvidence } from './experiences-proof'
import {
  boundaryManifestSchema,
  inspectLedger,
  ownerManifestSchema,
  recurrenceReport,
} from './experiences-recurrence'
import { readCanonicalRuleCatalog } from './learnings-rules'

import type { HorizonState } from './experiences-recurrence'
import type { CanonicalLearningRule } from './learnings-rules'
import type { LearningIssue, StructuredLearning } from './learnings-types'
import type { ExposureSession } from '@savant-code/common/types/experience'

type RepairClass = {
  key: string
  state: HorizonState
  owner?: string
  expectedness?: string
}

/** Lesson-last ordering is a checked relation, not a declaration in prose. */
export function learningRepairOrderIssues(params: {
  entries: readonly StructuredLearning[]
  rules: readonly CanonicalLearningRule[]
  classes: readonly RepairClass[]
}): LearningIssue[] {
  const classes = new Map(params.classes.map((entry) => [entry.key, entry]))
  const issues: LearningIssue[] = []
  for (const entry of params.entries) {
    if (entry.status !== 'active') continue
    const rules = params.rules.filter(
      (rule) => rule.name === entry.canonicalRule,
    )
    for (const key of rules.flatMap((rule) => rule.failureClasses)) {
      const repair = classes.get(key)
      if (repair?.expectedness === 'expected') continue
      if (
        !repair ||
        repair.state !== 'observed' ||
        !repair.owner ||
        !entry.owningFids.some(
          (fid) => fid.match(/^FID-\d{4}-\d{4}-\d{3}/)?.[0] === repair.owner,
        )
      )
        issues.push({
          code: 'learning.repair.unproved',
          message: `${entry.title}: class ${key} needs qualified observed repair and its actual owning FID before an active lesson.`,
        })
    }
  }
  return issues
}

export function validateLearningRepairOrder(
  root: string,
  entries: readonly StructuredLearning[],
): LearningIssue[] {
  const catalog = readCanonicalRuleCatalog(root)
  if (
    !entries.some(
      (entry) =>
        entry.status === 'active' &&
        catalog.rules.some(
          (rule) =>
            rule.name === entry.canonicalRule && rule.failureClasses.length,
        ),
    )
  )
    return []
  try {
    const directory = path.join(root, 'dev/experiences')
    const ledger = inspectLedger(
      fs.readFileSync(path.join(directory, 'raw-traces.jsonl'), 'utf8'),
    )
    const owners = ownerManifestSchema.parse(
      JSON.parse(
        fs.readFileSync(path.join(directory, 'class-owners.json'), 'utf8'),
      ),
    )
    const boundaries = boundaryManifestSchema.parse(
      JSON.parse(
        fs.readFileSync(path.join(directory, 'fix-boundaries.json'), 'utf8'),
      ),
    )
    const exposures = new Map<string, readonly ExposureSession[]>()
    const unproved = new Set<string>()
    for (const boundary of boundaries.boundaries) {
      const inspection = inspectBoundaryEvidence(root, boundary)
      exposures.set(boundary.classKey, inspection.exposure)
      if (inspection.issues.length) unproved.add(boundary.classKey)
    }
    const report = recurrenceReport(
      ledger.records,
      owners,
      boundaries,
      exposures,
    )
    for (const repair of report.classes)
      if (unproved.has(repair.key)) repair.state = 'incomplete-observation'
    return [
      ...ledger.issues.map((message) => ({
        code: 'learning.repair.ledger',
        message,
      })),
      ...report.issues.map((message) => ({
        code: 'learning.repair.registry',
        message,
      })),
      ...learningRepairOrderIssues({
        entries,
        rules: catalog.rules,
        classes: report.classes,
      }),
    ]
  } catch {
    return [
      {
        code: 'learning.repair.unavailable',
        message:
          'Class repair evidence cannot be validated; active repair lessons are not eligible.',
      },
    ]
  }
}
