import { createHash } from 'node:crypto'
import fs from 'node:fs'

import { resolveLesson } from './learnings-locator'
import {
  FEATURE_ARCHIVE,
  inspectImplementedProof,
} from './lesson-feature-archive'
import { featureEvidencePath, inspectFeatureFid } from './lesson-feature-schema'

import type {
  ArchivedCandidate,
  CommitVerifier,
} from './lesson-feature-archive'
import type { FeatureCandidate } from './lesson-feature-schema'

/** One entry under admission: the active queue and the archive share the rules. */
export type CandidateReview = {
  candidate: FeatureCandidate
  issues: string[]
  archived: boolean
}

export type AdmissionResult = {
  features: Array<{ candidate: FeatureCandidate; issues: string[] }>
  implemented: ArchivedCandidate[]
  issues: string[]
}

export type AdmissionParams = {
  root: string
  /** Hash of the active lesson catalog, as the manifest must record it. */
  catalogHash: string
  /** The hash the store itself claims; a ready candidate is stale without it. */
  manifestCatalogHash: string
  locator: Parameters<typeof resolveLesson>[0]
  candidates: readonly CandidateReview[]
  archiveIssues: readonly string[]
  verifyCommit: CommitVerifier
}

/**
 * FID-2026-1016-009: admission decides membership as well as evidence. An
 * `implemented` entry is lawful only in the archive, an archived entry must be
 * implemented, and identity collisions between the two are refused — otherwise
 * a closed record can sit in the queue forever with every check green.
 */
export function reviewCandidates(params: AdmissionParams): AdmissionResult {
  const { root, catalogHash, manifestCatalogHash, locator, verifyCommit } =
    params
  const candidates = params.candidates.map((entry) => ({
    ...entry,
    issues: [...entry.issues],
  }))
  const activeIds = new Set(
    candidates
      .filter((entry) => !entry.archived)
      .map((entry) => entry.candidate.id),
  )
  const ids = new Set<string>()
  const owners = new Set<string>()
  for (const { candidate, issues, archived } of candidates) {
    if (ids.has(candidate.id)) {
      issues.push(
        archived && activeIds.has(candidate.id)
          ? 'Archived identity duplicates an active candidate'
          : 'Duplicate feature identity',
      )
    }
    ids.add(candidate.id)
    if (archived && candidate.state !== 'implemented')
      issues.push('Archived work must be recorded as implemented')
    if (!archived && candidate.state === 'implemented')
      issues.push(`Implemented work must be archived to ${FEATURE_ARCHIVE}`)
    if (new Set(candidate.lessons).size !== candidate.lessons.length) {
      issues.push('Duplicate lesson links')
    }
    for (const title of candidate.lessons) {
      const resolved = resolveLesson(locator, title)
      if (!resolved.ok) issues.push(resolved.issue)
      else if (resolved.replacements.length)
        issues.push(
          `Superseded lesson: ${title}; replacement: ${resolved.replacements.join(' → ')}`,
        )
    }
    if (!archived && candidate.state === 'ready') {
      if (manifestCatalogHash !== catalogHash)
        issues.push('Lesson review is stale')
      if (candidate.basis !== 'observed-gap')
        issues.push('Readiness needs an observed gap')
    }
    for (const evidence of candidate.evidence) {
      try {
        const file = featureEvidencePath(root, evidence.path)
        if (!archived && candidate.state === 'ready' && !evidence.sha256) {
          issues.push(`Missing evidence snapshot: ${evidence.path}`)
        } else if (
          !archived &&
          candidate.state === 'ready' &&
          evidence.sha256 &&
          sha256Of(fs.readFileSync(file)) !== evidence.sha256
        ) {
          issues.push(`Evidence changed: ${evidence.path}`)
        }
      } catch {
        issues.push(`Missing or unsafe evidence: ${evidence.path}`)
      }
    }
    if (candidate.fid) {
      if (owners.has(candidate.fid))
        issues.push('FID already owns another candidate')
      owners.add(candidate.fid)
      try {
        const record = inspectFeatureFid(root, candidate.fid)
        if (candidate.state === 'implemented')
          issues.push(
            ...inspectImplementedProof(
              record,
              candidate.commit,
              verifyCommit,
              root,
            ),
          )
      } catch {
        issues.push('FID owner cannot be verified')
      }
    } else if (['routed', 'implemented'].includes(candidate.state)) {
      issues.push('Routed work requires an owning FID')
    }
    if (
      !archived &&
      ['draft', 'ready'].includes(candidate.state) &&
      candidate.fid
    ) {
      issues.push('An owned candidate must be routed or implemented')
    }
  }
  return {
    features: candidates
      .filter((entry) => !entry.archived)
      .map(({ candidate, issues }) => ({ candidate, issues })),
    implemented: candidates
      .filter((entry) => entry.archived)
      .map(({ candidate, issues }) => ({ candidate, issues })),
    issues: [
      ...params.archiveIssues,
      ...candidates.flatMap((entry) =>
        entry.issues.map((issue) => `${entry.candidate.id}: ${issue}`),
      ),
    ],
  }
}

/** Local digest helper: the pipeline's exported sha256 is not a dependency here. */
function sha256Of(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}
