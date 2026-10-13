import fs from 'node:fs'
import path from 'node:path'

import { LEGACY_BOUNDARY } from './learnings-schema'
import { featureEvidencePath } from './lesson-feature-schema'

export const LIVE_LESSONS = 'dev/LEARNINGS.md'
export const RETIRED_LESSONS = 'dev/LEARNINGS-RETIRED.md'

export type LessonEntry = {
  title: string
  canonicalRule?: string
  guard: string
  invariant: string
  owningFids: string[]
  evidenceCount: number
  status: string
  date: string
  supersededBy?: string
}

export type LessonSpan = {
  title: string
  block: string
  line: number
  governed: boolean
  entry: LessonEntry
}

export type LessonLocation = LessonSpan & { file: string; retired: boolean }
export type LessonLocator = Map<string, LessonLocation[]>
export type LessonResolution =
  | { ok: true; locations: LessonLocation[]; replacements: string[] }
  | { ok: false; issue: string }

function fieldsOf(block: string): Map<string, string> {
  const fields = new Map<string, string>()
  let current: string | undefined
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^- \*\*([^*]+):\*\*\s*(.*)$/)
    if (match?.[1] && match[2] !== undefined) {
      current = match[1].trim()
      fields.set(current, match[2].trim())
    } else if (current && line.startsWith('  ')) {
      fields.set(current, `${fields.get(current) ?? ''} ${line.trim()}`)
    } else if (line.trim()) current = undefined
  }
  return fields
}

/** One block parser shared by retirement, reference resolution and skills. */
export function lessonSpans(content: string): LessonSpan[] {
  const headings = [...content.matchAll(/^## Lesson:\s*(.+)$/gm)]
  const boundary = content.indexOf(LEGACY_BOUNDARY)
  return headings.map((heading, index) => {
    const offset = heading.index ?? 0
    const title = heading[1]?.trim() ?? ''
    const block = content.slice(offset, headings[index + 1]?.index)
    const fields = fieldsOf(block)
    const get = (name: string): string => fields.get(name)?.trim() ?? ''
    const evidence = get('Evidence')
    const evidenceCount = evidence
      .split(/[,\n]/)
      .filter((s) => s.includes('→')).length
    return {
      title,
      block,
      line: content.slice(0, offset).split('\n').length,
      governed: boundary < 0 || offset < boundary,
      entry: {
        title,
        canonicalRule: get('Canonical rule') || undefined,
        guard: get('Guard'),
        invariant: get('Invariant'),
        owningFids: get('Owning FID')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        evidenceCount: evidenceCount || (evidence ? 1 : 0),
        status: get('Status'),
        date: get('Date'),
        supersededBy: get('Superseded by') || undefined,
      },
    }
  })
}

export function parseLessons(content: string): LessonEntry[] {
  return lessonSpans(content).map((span) => span.entry)
}

export function buildLessonLocator(
  sources: readonly { file: string; content: string; retired: boolean }[],
): LessonLocator {
  const locator: LessonLocator = new Map()
  for (const source of sources)
    for (const span of lessonSpans(source.content)) {
      const locations = locator.get(span.title) ?? []
      locations.push({ ...span, file: source.file, retired: source.retired })
      locator.set(span.title, locations)
    }
  return locator
}

/** Present unsafe sources fail closed; a not-yet-created archive is optional. */
export function readLessonLocator(root: string): LessonLocator {
  return buildLessonLocator(
    [LIVE_LESSONS, RETIRED_LESSONS].flatMap((file) => {
      if (!fs.existsSync(path.join(root, file))) return []
      return [
        {
          file,
          content: fs.readFileSync(featureEvidencePath(root, file), 'utf8'),
          retired: file === RETIRED_LESSONS,
        },
      ]
    }),
  )
}

function lessonBody(location: LessonLocation): string {
  return location.block
    .replaceAll('\r\n', '\n')
    .replace(/^<!--.*-->\s*$/gm, '')
    .replace(/^---\s*$/gm, '')
    .trim()
}

/** Supersession is explicit and bounded by the number of unique lesson titles. */
export function resolveLesson(
  locator: LessonLocator,
  title: string,
): LessonResolution {
  const seen = new Set<string>()
  const replacements: string[] = []
  let current = title
  while (true) {
    if (seen.has(current))
      return {
        ok: false,
        issue: `Supersession cycle: ${[...seen, current].join(' → ')}`,
      }
    seen.add(current)
    const locations = locator.get(current)
    if (!locations?.length)
      return {
        ok: false,
        issue: replacements.length
          ? `Missing replacement lesson: ${current} (from ${title})`
          : `Missing lesson: ${current}`,
      }
    if (new Set(locations.map(lessonBody)).size !== 1)
      return { ok: false, issue: `Ambiguous lesson: ${current}` }
    const entry = locations[0]?.entry
    if (!entry) return { ok: false, issue: `Missing lesson: ${current}` }
    if (entry.status !== 'superseded')
      return { ok: true, locations, replacements }
    if (!entry.supersededBy)
      return {
        ok: false,
        issue: `Missing replacement for superseded lesson: ${current}`,
      }
    current = entry.supersededBy
    replacements.push(current)
  }
}
