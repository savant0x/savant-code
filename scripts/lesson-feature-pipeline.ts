import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { parseFidStatus } from '@savant-code/agent-runtime/echo/fid-verification-enforcement'

import {
  readLessonLocator,
  resolveLesson,
  RETIRED_LESSONS,
} from './learnings-locator'
import { wrapLearningMarkdown } from './learnings-markdown'
import {
  featureEvidencePath,
  featureManifestSchema,
  inspectFeatureFid,
} from './lesson-feature-schema'

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
  issues: string[]
}

type CommitVerifier = (root: string, commit: string) => boolean
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
    const retired = fs.existsSync(path.join(root, RETIRED_LESSONS))
      ? fs.readFileSync(featureEvidencePath(root, RETIRED_LESSONS), 'utf8')
      : undefined
    const catalogHash = sha256(
      retired === undefined ? catalog : `${catalog}\0${retired}`,
    )
    const locator = readLessonLocator(root)
    const ids = new Set<string>()
    const owners = new Set<string>()
    const features = manifest.features.map((candidate) => {
      const issues: string[] = []
      if (ids.has(candidate.id)) issues.push('Duplicate feature identity')
      ids.add(candidate.id)
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
      if (candidate.state === 'ready') {
        if (manifest.catalogHash !== catalogHash)
          issues.push('Lesson review is stale')
        if (candidate.basis !== 'observed-gap')
          issues.push('Readiness needs an observed gap')
      }
      for (const evidence of candidate.evidence) {
        try {
          const file = featureEvidencePath(root, evidence.path)
          if (candidate.state === 'ready' && !evidence.sha256) {
            issues.push(`Missing evidence snapshot: ${evidence.path}`)
          } else if (
            candidate.state === 'ready' &&
            evidence.sha256 &&
            sha256(fs.readFileSync(file)) !== evidence.sha256
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
          if (
            candidate.state === 'implemented' &&
            (parseFidStatus(record) !== 'closed' ||
              !record.includes('### Code Verification Evidence') ||
              !candidate.commit ||
              !record.includes(candidate.commit) ||
              !verifyCommit(root, candidate.commit))
          )
            issues.push(
              'Implementation needs a closed FID and a real recorded commit',
            )
        } catch {
          issues.push('FID owner cannot be verified')
        }
      } else if (['routed', 'implemented'].includes(candidate.state)) {
        issues.push('Routed work requires an owning FID')
      }
      if (['draft', 'ready'].includes(candidate.state) && candidate.fid) {
        issues.push('An owned candidate must be routed or implemented')
      }
      return { candidate, issues }
    })
    return {
      catalogHash,
      sourceFingerprint: sha256(`${catalogHash}\0${manifestContent}`),
      lessons: [...locator].map(([title, locations]) => ({
        title,
        governed: locations.some(
          (location) => location.governed && !location.retired,
        ),
        ...(locations.every((location) => location.retired)
          ? { retired: true }
          : {}),
        linked: manifest.features
          .filter((feature) => feature.lessons.includes(title))
          .map((feature) => feature.id),
      })),
      features,
      issues: features.flatMap((feature) =>
        feature.issues.map((issue) => `${feature.candidate.id}: ${issue}`),
      ),
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
    'Readiness is a reviewed proposal. Implementation status records closed-FID',
    'evidence; it does not claim that historical tests were rerun today.',
    '',
    `Inventory: ${review.lessons.length} headed lessons; ` +
      `${review.lessons.filter((lesson) => lesson.governed).length} schema-governed.`,
    '',
    '## Feature candidates',
    '',
  ]
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
