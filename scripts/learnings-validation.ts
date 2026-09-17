import fs from 'node:fs'
import path from 'node:path'

import {
  validateCanonicalRuleCatalog,
  validateStableReferences,
} from './learnings-references.js'
import {
  LEGACY_BOUNDARY,
  LEARNINGS_INSERTION_MARKER,
  parseDate,
  parseEntry,
  structuredBlocks,
} from './learnings-schema.js'

import type {
  LearningIssue,
  LearningValidationResult,
  StructuredLearning,
} from './learnings-types.js'

/** The insertion marker must sit in governed space, above the legacy
 * boundary, so that entries appended above it stay validated. The original
 * "nothing may follow the marker" rule pushed the marker to EOF — below the
 * boundary — which inverted the file and silently unvalidated every new lesson
 * (FID-2026-0916-007). */
function markerIssues(content: string): LearningIssue[] {
  const matches = [
    ...content.matchAll(
      new RegExp(
        LEARNINGS_INSERTION_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      ),
    ),
  ]
  if (matches.length !== 1)
    return [
      {
        code: 'learning.insertion-marker.count',
        message: `Expected exactly one insertion marker; found ${matches.length}.`,
      },
    ]
  const markerIndex = matches[0]?.index ?? 0
  const boundaryIndex = content.indexOf(LEGACY_BOUNDARY)
  if (boundaryIndex !== -1 && markerIndex > boundaryIndex)
    return [
      {
        code: 'learning.insertion-marker.below-boundary',
        message:
          'The insertion marker must sit above the legacy boundary so new entries land in governed space.',
      },
    ]
  // Only comments and whitespace may trail the boundary once prose is retired.
  if (boundaryIndex !== -1) {
    const afterBoundary = content
      .slice(boundaryIndex + LEGACY_BOUNDARY.length)
      .trim()
    if (afterBoundary && !afterBoundary.startsWith('<!--'))
      return [
        {
          code: 'learning.legacy-boundary.trailing-content',
          message:
            'Only comments may follow the legacy boundary; narrative prose must be retired to the archive.',
        },
      ]
  }
  return []
}
function supersessionIssues(
  entries: readonly StructuredLearning[],
): LearningIssue[] {
  const byTitle = new Map(entries.map((entry) => [entry.title, entry]))
  const issues: LearningIssue[] = []
  for (const entry of entries) {
    if (!entry.supersededBy) continue
    let current = byTitle.get(entry.supersededBy)
    const visited = new Set([entry.title])
    if (!current || current.status === 'superseded')
      issues.push({
        code: 'learning.supersession.invalid-target',
        message: `${entry.title}: replacement must be a distinct non-superseded lesson.`,
      })
    while (current?.supersededBy) {
      if (visited.has(current.title)) {
        issues.push({
          code: 'learning.supersession.cycle',
          message: `${entry.title}: supersession chain contains a cycle.`,
        })
        break
      }
      visited.add(current.title)
      current = byTitle.get(current.supersededBy)
    }
  }
  return issues
}
export function validateLearnings(
  content: string,
  root: string,
): LearningValidationResult {
  const issues: LearningIssue[] = []
  const boundaryCount = content.split(LEGACY_BOUNDARY).length - 1
  if (boundaryCount !== 1)
    issues.push({
      code: 'learning.legacy-boundary.count',
      message: `Expected exactly one legacy boundary; found ${boundaryCount}.`,
    })
  issues.push(...markerIssues(content))
  const boundary = content.indexOf(LEGACY_BOUNDARY)
  const governed = boundary < 0 ? content : content.slice(0, boundary)
  const headings = [...governed.matchAll(/^##\s+(.+)$/gm)]
  if (headings.some((heading) => !heading[1]?.startsWith('Lesson:')))
    issues.push({
      code: 'learning.structure.unstructured',
      message:
        'All governed entries above the legacy boundary must use `## Lesson:` headings.',
    })
  const firstLesson = governed.indexOf('## Lesson:')
  if (
    firstLesson > 0 &&
    governed
      .slice(0, firstLesson)
      .split(/\r?\n/)
      .some(
        (line) =>
          line.trim() &&
          !line.startsWith('# LEARNINGS') &&
          !line.startsWith('<!--'),
      )
  )
    issues.push({
      code: 'learning.structure.prose',
      message:
        'Governed content before the first lesson must contain only the title or comments.',
    })
  const parsed = structuredBlocks(content).map(({ title, block }) =>
    parseEntry(block, title),
  )
  const entries = parsed.flatMap((result) => {
    issues.push(...result.issues)
    return result.entry ? [result.entry] : []
  })
  if (!entries.length && headings.length)
    issues.push({
      code: 'learning.structure.empty',
      message:
        'Governed learning content contains no valid structured lesson records.',
    })
  if (new Set(entries.map((entry) => entry.title)).size !== entries.length)
    issues.push({
      code: 'learning.structure.duplicate-title',
      message: 'Structured lesson titles must be unique for stable references.',
    })
  for (let index = 1; index < entries.length; index += 1) {
    const previous = parseDate(entries[index - 1]?.date ?? '')
    const current = parseDate(entries[index]?.date ?? '')
    if (
      Number.isFinite(previous) &&
      Number.isFinite(current) &&
      previous < current
    )
      issues.push({
        code: 'learning.chronology.order',
        message: `${entries[index - 1]?.title} is older than the following ${entries[index]?.title}.`,
      })
  }
  return {
    entries,
    issues: [
      ...issues,
      ...supersessionIssues(entries),
      ...validateStableReferences(root, entries),
      ...validateCanonicalRuleCatalog(root, entries),
    ],
  }
}

export function validateEmbeddedLearningSource(
  sourcePath: string,
  content: string,
): LearningIssue[] {
  const issues: LearningIssue[] = []
  if (sourcePath !== 'docs/embedded-learnings.md')
    issues.push({
      code: 'learning.embedded.source',
      message: `Unexpected embedded source: ${sourcePath}.`,
    })
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(content))
    issues.push({
      code: 'learning.embedded.privacy',
      message: 'Embedded learning source contains an email address.',
    })
  if (/\b(?:ghp|gho|github_pat|npm|sk)[_-][A-Za-z0-9_-]{12,}\b/i.test(content))
    issues.push({
      code: 'learning.embedded.credential',
      message: 'Embedded learning source contains a credential-shaped token.',
    })
  if (/single[ _-]?agent/i.test(content))
    issues.push({
      code: 'learning.embedded.protocol-boundary',
      message:
        'Embedded learning source contains protocol-variant terminology.',
    })
  return issues
}

export function validateLearningFile(root: string): LearningValidationResult {
  return validateLearnings(
    fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8'),
    root,
  )
}
