import fs from 'node:fs'
import path from 'node:path'

import { parseFidStatus } from '@savant-code/agent-runtime/echo/fid-verification-enforcement'

import {
  featureArchiveSchema,
  featureEvidencePath,
} from './lesson-feature-schema'

import type { FeatureCandidate } from './lesson-feature-schema'

/**
 * FID-2026-1016-009: the active store admits open work only. Implemented
 * candidates retire here, verbatim, so the register reads as a queue while the
 * lesson-to-FID record that suppressed a duplicate proposal survives.
 */
export const FEATURE_ARCHIVE = 'dev/feature-pipeline/implemented.json'

export type ArchivedCandidate = {
  candidate: FeatureCandidate
  issues: string[]
}

export type CommitVerifier = (root: string, commit: string) => boolean

/**
 * Implementation closure needs real evidence, not a status flag: a closed record
 * carrying a `### Code Verification Evidence` section, naming the commit, which
 * must exist in local history.
 */
export function inspectImplementedProof(
  record: string,
  commit: string | undefined,
  verifyCommit: CommitVerifier,
  root: string,
): string[] {
  if (
    parseFidStatus(record) !== 'closed' ||
    !record.includes('### Code Verification Evidence') ||
    !commit ||
    !record.includes(commit) ||
    !verifyCommit(root, commit)
  )
    return ['Implementation needs a closed FID and a real recorded commit']
  return []
}

/**
 * Read the archive: missing is lawful (a repository with no implemented work),
 * unreadable or malformed is not. Entry-level checks that depend on the active
 * store (identity collision) and on the lesson catalog stay with the caller,
 * which owns both.
 */
export function readFeatureArchive(
  root: string,
  verifyCommit: CommitVerifier,
): { entries: ArchivedCandidate[]; content?: string; issues: string[] } {
  const file = path.join(root, FEATURE_ARCHIVE)
  if (!fs.existsSync(file)) return { entries: [], issues: [] }
  let content: string
  try {
    content = fs.readFileSync(
      featureEvidencePath(root, FEATURE_ARCHIVE),
      'utf8',
    )
  } catch {
    return { entries: [], issues: ['Implemented archive could not be read'] }
  }
  try {
    const archive = featureArchiveSchema.parse(JSON.parse(content))
    return {
      content,
      issues: [],
      entries: archive.features.map((candidate) => ({
        candidate,
        issues: [],
      })),
    }
  } catch {
    return {
      entries: [],
      content,
      issues: ['Implemented archive is malformed'],
    }
  }
}

/** Compact retired listing: a record, not an open queue. */
export function renderImplementedSection(
  entries: readonly ArchivedCandidate[],
  markdown: (value: string) => string,
  archiveRelPath: string,
): string[] {
  if (entries.length === 0) return []
  const lines = [
    '## Implemented (archived)',
    '',
    `Retired to \`${archiveRelPath}\`. Kept as the lesson-to-FID record; these are`,
    'closed implementations, not open work.',
    '',
  ]
  for (const { candidate, issues } of entries) {
    const owner = candidate.fid ?? 'no owning FID'
    const commit = candidate.commit ?? 'no commit'
    lines.push(
      `- ${candidate.id} ${candidate.priority} — ${markdown(candidate.title)} ` +
        `(${owner}, ${commit})${issues.length ? ' — needs-review' : ''}`,
    )
  }
  lines.push('')
  return lines
}
