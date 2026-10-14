#!/usr/bin/env bun
/**
 * Class coverage (FID-2026-1012-021).
 *
 * The repository detects recurring failure classes and, until this check, could
 * leave one with no owner: the class fired, the agenda carried it, and nothing
 * in the gate noticed. A class that is *eligible* — at the repository's own
 * promotion bar, measured inside the bounded window, and not an expected
 * outcome — must be owned by a record; otherwise it is an issue named with its
 * count and its last-seen date.
 *
 * It reads `FID-2026-1012-024`'s stable class identity and owner manifest rather
 * than re-deriving either, so coverage and the recurrence probe cannot disagree
 * about what a class is.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  experienceClassIdentity,
  isExpectedClass,
  summarizeExperienceClasses,
} from '@savant-code/common/util/experience-classes'

import { inspectLedger, ownerManifestSchema } from './experiences-recurrence'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

const DAY = 86_400_000
/** The bounded eligibility window (FID-2026-1012-022 Loop 2). */
export const ELIGIBILITY_DAYS = 14
/** The repository's own promotion bar: distinct sessions, not raw hits. */
export const ELIGIBILITY_SESSIONS = 3

export interface ClassCoverageIssue {
  classKey: string
  toolName: string
  count: number
  sessions: number
  lastSeen: string
}

/**
 * Classes above the bar inside the window with no owner. Pure: the caller
 * supplies the records and the manifest, so a fixture can exercise it without
 * touching the production capture.
 */
export function findUnownedEligibleClasses(params: {
  records: readonly ExperienceRecord[]
  owners: readonly string[]
  now?: number
}): ClassCoverageIssue[] {
  const { records, owners, now = Date.now() } = params
  const owned = new Set(owners)
  const issues: ClassCoverageIssue[] = []
  for (const summary of summarizeExperienceClasses(records)) {
    if (owned.has(summary.key)) continue
    // An expected outcome (a 404 while searching, a cancellation) is correct
    // behaviour, not a defect, so it never demands an owner.
    if (isExpectedClass(summary)) continue
    const sessions = new Set(
      records
        .filter(
          (record) =>
            Date.parse(record.ts) >= now - ELIGIBILITY_DAYS * DAY &&
            experienceClassIdentity(record).key === summary.key,
        )
        .map((record) => record.sessionId),
    ).size
    if (sessions < ELIGIBILITY_SESSIONS) continue
    issues.push({
      classKey: summary.key,
      toolName: summary.toolName,
      count: summary.count,
      sessions,
      lastSeen: summary.lastSeen,
    })
  }
  return issues.sort((a, b) => b.count - a.count)
}

/** The disk-backed form the repository gate calls. */
export function collectClassCoverageIssues(
  root: string,
  now = Date.now(),
): ClassCoverageIssue[] {
  const directory = path.join(root, 'dev', 'experiences')
  const ledgerPath = path.join(directory, 'raw-traces.jsonl')
  if (!fs.existsSync(ledgerPath)) return []
  const ledger = inspectLedger(fs.readFileSync(ledgerPath, 'utf8'), now)
  const owners = ownerManifestSchema.parse(
    JSON.parse(
      fs.readFileSync(path.join(directory, 'class-owners.json'), 'utf8'),
    ),
  )
  return findUnownedEligibleClasses({
    records: ledger.records,
    owners: owners.owners.map((owner) => owner.classKey),
    now,
  })
}

/** One line per unowned eligible class, naming the count and the last sighting. */
export function formatClassCoverageIssue(issue: ClassCoverageIssue): string {
  return (
    `unowned recurring class ${issue.classKey} (${issue.toolName}, ` +
    `${issue.count} records across ${issue.sessions} sessions in the last ` +
    `${ELIGIBILITY_DAYS} days, last seen ${issue.lastSeen.slice(0, 10)}) — ` +
    'add it to dev/experiences/class-owners.json with the record that owns the fix.'
  )
}
