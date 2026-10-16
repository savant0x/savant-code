import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { readLessonLocator, RETIRED_LESSONS } from './learnings-locator'
import { wrapLearningMarkdown } from './learnings-markdown'
import { reviewCandidates } from './lesson-feature-admission'
import {
  FEATURE_ARCHIVE,
  readFeatureArchive,
  renderImplementedSection,
} from './lesson-feature-archive'
import {
  featureEvidencePath,
  featureManifestSchema,
} from './lesson-feature-schema'

import type { CandidateReview } from './lesson-feature-admission'
import type {
  ArchivedCandidate,
  CommitVerifier,
} from './lesson-feature-archive'
import type { FeatureCandidate } from './lesson-feature-schema'

export const FEATURE_STORE = 'dev/feature-pipeline/candidates.json'
export const FEATURE_REPORT = 'dev/feature-pipeline/report.md'
export const sha256 = (value: string | Buffer): string =>
  crypto.createHash('sha256').update(value).digest('hex')

export type FeatureReview = {
  catalogHash: string
  sourceFingerprint: string
  lessons: Array<{
    title: string
    governed: boolean
    linked: string[]
    retired?: boolean
  }>
  features: Array<{ candidate: FeatureCandidate; issues: string[] }>
  implemented: ArchivedCandidate[]
  issues: string[]
}

const verifyGitCommit: CommitVerifier = (root, commit) =>
  Bun.spawnSync(['git', 'cat-file', '-e', `${commit}^{commit}`], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  }).exitCode === 0

/** Read-only admission. Readiness is explicit; no status is inferred or mutated. */
export function reviewFeaturePipeline(
  root: string,
  verifyCommit: CommitVerifier = verifyGitCommit,
): FeatureReview {
  const empty: FeatureReview = {
    catalogHash: '',
    sourceFingerprint: '',
    lessons: [],
    features: [],
    implemented: [],
    issues: [],
  }
  if (!fs.existsSync(path.join(root, FEATURE_STORE))) return empty
  try {
    const catalog = fs.readFileSync(
      featureEvidencePath(root, 'dev/LEARNINGS.md'),
      'utf8',
    )
    const manifestContent = fs.readFileSync(
      featureEvidencePath(root, FEATURE_STORE),
      'utf8',
    )
    const manifest = featureManifestSchema.parse(JSON.parse(manifestContent))
    const archive = readFeatureArchive(root, verifyCommit)
    const retired = fs.existsSync(path.join(root, RETIRED_LESSONS))
      ? fs.readFileSync(featureEvidencePath(root, RETIRED_LESSONS), 'utf8')
      : undefined
    const catalogHash = sha256(
      retired === undefined ? catalog : `${catalog}\0${retired}`,
    )
    const locator = readLessonLocator(root)
    const candidates: CandidateReview[] = [
      ...manifest.features.map((candidate) => ({
        candidate,
        issues: [],
        archived: false,
      })),
      ...archive.entries.map(({ candidate, issues }) => ({
        candidate,
        issues: [...issues],
        archived: true,
      })),
    ]
    const admission = reviewCandidates({
      root,
      catalogHash,
      manifestCatalogHash: manifest.catalogHash,
      locator,
      candidates,
      archiveIssues: archive.issues,
      verifyCommit,
    })
    const allFeatures = candidates.map((entry) => entry.candidate)
    return {
      catalogHash,
      // The archive is part of the evidence the report describes, so editing it
      // invalidates the generated report exactly as the store does.
      sourceFingerprint: sha256(
        `${catalogHash}\0${manifestContent}\0${archive.content ?? ''}`,
      ),
      lessons: [...locator].map(([title, locations]) => ({
        title,
        governed: locations.some(
          (location) => location.governed && !location.retired,
        ),
        ...(locations.every((location) => location.retired)
          ? { retired: true }
          : {}),
        linked: allFeatures
          .filter((feature) => feature.lessons.includes(title))
          .map((feature) => feature.id),
      })),
      features: admission.features,
      implemented: admission.implemented,
      issues: admission.issues,
    }
  } catch {
    return {
      ...empty,
      issues: ['Feature store or lesson catalog could not be validated'],
    }
  }
}

/** Existing SessionEnd calls this; invalid stores never disable its other work. */
export function featureRoutingNotes(root: string): string[] {
  const review = reviewFeaturePipeline(root)
  if (review.issues.length)
    return [
      `FEATURE-REVIEW: ${review.issues.length} admission issue(s); run bun run lessons:features --check.`,
    ]
  return review.features
    .filter((feature) => feature.candidate.state === 'ready')
    .sort(
      (a, b) =>
        a.candidate.priority.localeCompare(b.candidate.priority) ||
        a.candidate.id.localeCompare(b.candidate.id),
    )
    .slice(0, 3)
    .map(
      ({ candidate }) =>
        `FEATURE-READY: ${candidate.id} ${candidate.priority} — ${candidate.title}. Converge a FID before implementation.`,
    )
}

function markdown(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function renderFeatureReport(review: FeatureReview): string {
  const lines = [
    '# Lesson feature pipeline',
    '',
    `Source fingerprint: ${review.sourceFingerprint || 'unavailable'}.`,
    '',
    'Readiness is a reviewed proposal. The candidates section holds open work only;',
    'implemented records retire to the archive and its section is evidence, not a',
    'queue. Implementation status does not claim that historical tests were rerun',
    'today.',
    '',
    `Inventory: ${review.lessons.length} headed lessons; ` +
      `${review.lessons.filter((lesson) => lesson.governed).length} schema-governed.`,
    '',
    '## Feature candidates',
    '',
  ]
  if (review.features.length === 0) lines.push('_No open candidates._', '')
  for (const { candidate, issues } of review.features) {
    lines.push(
      `### ${candidate.id}: ${markdown(candidate.title)}`,
      '',
      `${candidate.priority}; ${issues.length ? 'needs-review' : candidate.state}; ${candidate.basis}.`,
      '',
      markdown(candidate.gap),
      '',
      'Acceptance:',
      '',
    )
    for (const criterion of candidate.acceptance)
      lines.push(`- ${markdown(criterion)}`)
    lines.push('', `Owning FID: ${candidate.fid ?? 'not routed'}.`, '')
    for (const issue of issues)
      lines.push(`- Admission issue: ${markdown(issue)}`)
    if (issues.length) lines.push('')
  }
  lines.push(
    ...renderImplementedSection(review.implemented, markdown, FEATURE_ARCHIVE),
  )
  lines.push(
    '## Complete lesson inventory',
    '',
    'Unlinked lessons retain their documented guards. No current defect is inferred',
    'from their presence. Historical entries require current-source review.',
    '',
  )
  for (const lesson of review.lessons)
    lines.push(
      `- ${markdown(lesson.title)} — ${lesson.retired ? 'retired' : lesson.governed ? 'governed' : 'historical'}; ` +
        `${lesson.linked.join(', ') || 'no new candidate'}.`,
    )
  if (review.issues.length)
    lines.push(
      '',
      '## Admission issues',
      '',
      ...review.issues.map((issue) => `- ${markdown(issue)}`),
    )
  return wrapLearningMarkdown(lines)
}

/** Publication is deterministic on red too; admission remains the caller's exit decision. */
export function writeFeatureReport(root: string, review: FeatureReview): void {
  const destination = path.join(root, FEATURE_REPORT)
  if (fs.existsSync(destination)) featureEvidencePath(root, FEATURE_REPORT)
  fs.writeFileSync(destination, renderFeatureReport(review), 'utf8')
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  const args = process.argv.slice(2)
  if (args.some((arg) => !['--check', '--write'].includes(arg))) {
    throw new Error('Usage: bun run lessons:features [--check | --write]')
  }
  const review = reviewFeaturePipeline(root)
  if (!fs.existsSync(path.join(root, FEATURE_STORE))) {
    throw new Error('Feature store is missing')
  }
  const report = renderFeatureReport(review)
  if (args.includes('--write')) writeFeatureReport(root, review)
  console.log(
    args.includes('--check')
      ? `lesson-features: ${review.issues.length ? 'FAIL' : 'PASS'} (${review.lessons.length} lessons, ${review.features.length} candidates)`
      : report,
  )
  if (args.includes('--check') && review.issues.length) {
    console.error(review.issues.slice(0, 20).join('\n'))
  }
  process.exitCode = review.issues.length ? 1 : 0
}
