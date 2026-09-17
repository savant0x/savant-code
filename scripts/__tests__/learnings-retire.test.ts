import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  applyRetirement,
  retireLessons,
  DEFAULT_LINE_CAP,
} from '../learnings-retire'
import {
  LEGACY_BOUNDARY,
  LEARNINGS_INSERTION_MARKER,
} from '../learnings-schema'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retire-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function entry(id: string, date: string, status: string): string {
  return [
    `## Lesson: Lesson ${id}`,
    '',
    `- **Date:** ${date}`,
    `- **Failure:** failure ${id}.`,
    '- **Evidence:** a.ts → symbol:f',
    '- **Invariant:** invariant.',
    '- **Guard:** guard.',
    '- **Verification:** v.',
    '- **Scope:** internal',
    '- **Owning FID:** FID-2026-0801-001',
    `- **Status:** ${status}`,
    `- **Canonical rule:** lesson-${id}`,
    '',
  ].join('\n')
}

describe('retireLessons (S3-C)', () => {
  test('under the cap: nothing is retired', () => {
    const content = '# LEARNINGS\n\n' + entry('a', '2026-08-01', 'active')
    const result = retireLessons(content, { cap: 1200 })
    expect(result.retired).toEqual([])
  })

  test('retires superseded/historical first, then oldest until under cap', () => {
    const content =
      '# LEARNINGS\n\n' +
      entry('superseded', '2026-08-01', 'superseded') +
      entry('historical', '2026-08-02', 'historical') +
      entry('old', '2026-06-01', 'active') +
      entry('recent', '2026-08-20', 'active')
    // Cap sized so exactly ONE entry fits: superseded + historical + oldest
    // retire first; the most recent active entry stays.
    const result = retireLessons(content, { cap: 20 })
    expect(result.retired.map((r) => r.reason)).toContain('status superseded')
    expect(result.retired.map((r) => r.reason)).toContain('status historical')
    expect(result.linesAfter).toBeLessThanOrEqual(20)
    const titles = result.retired.map((r) => r.title)
    expect(titles).not.toContain('Lesson recent') // recent stays
    expect(titles).toContain('Lesson old')
  })

  test('never deletes: retired entries are returned for archival', () => {
    const content =
      '# LEARNINGS\n\n' +
      entry('a', '2026-07-01', 'superseded') +
      entry('b', '2026-08-01', 'active')
    const result = retireLessons(content, { cap: 20 })
    expect(result.retired.length).toBe(1)
    expect(result.retired[0].title).toBe('Lesson a')
  })
})

describe('applyRetirement', () => {
  test('absent --cap falls back to the default, never NaN (FID-2026-0916-007)', () => {
    // Regression pin: the old arg parse read argv[0] when --cap was absent,
    // yielding NaN; `NaN <= NaN` is false, so every entry retired.
    const content = '# LEARNINGS\n\n' + entry('a', '2026-08-01', 'active')
    expect(() => retireLessons(content, { cap: Number.NaN })).toThrow(
      'cap must be a finite line count',
    )
    const result = retireLessons(content)
    expect(result.retired).toEqual([])
    expect(DEFAULT_LINE_CAP).toBe(1200)
  })

  test('rewrite preserves prose and markers between lessons (FID-2026-0916-007)', () => {
    // Regression pin: the old applyRetirement rebuilt the file from lesson
    // blocks alone, silently destroying the boundary + insertion markers and
    // all inter-lesson prose.
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    const prose = '## Session notes\n\nNarrative prose that must survive.\n'
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      '# LEARNINGS\n\n' +
        entry('old', '2026-06-01', 'active') +
        prose +
        LEARNINGS_INSERTION_MARKER +
        '\n\n' +
        LEGACY_BOUNDARY +
        '\n\nlegacy prose below the boundary\n',
      'utf8',
    )
    applyRetirement(root, { cap: 20 })
    const kept = fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8')
    expect(kept).toContain(LEGACY_BOUNDARY)
    expect(kept).toContain(LEARNINGS_INSERTION_MARKER)
    expect(kept).toContain('Narrative prose that must survive.')
    expect(kept).toContain('legacy prose below the boundary')
  })
  test('a retired final lesson re-emits the trailing marker instead of swallowing it (FID-2026-0916-007)', () => {
    // Regression pin: the last lesson block owns the trailing insertion marker;
    // removing that span had to re-emit the marker rather than drop it into
    // the deleted span (the removeLessonSpans marker-recovery path).
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      '# LEARNINGS\n\n' +
        LEARNINGS_INSERTION_MARKER +
        '\n\n' +
        entry('keep', '2026-08-11', 'active') +
        entry('retire', '2026-06-01', 'active') +
        LEGACY_BOUNDARY +
        '\n',
      'utf8',
    )
    const result = applyRetirement(root, { cap: 14 })
    expect(result.retired.map((r) => r.title)).toContain('Lesson retire')
    const kept = fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8')
    expect(kept).toContain(LEARNINGS_INSERTION_MARKER)
    expect(kept).toContain('Lesson keep')
    expect(kept).not.toContain('Lesson retire')
  })

  test('moves entries to the append-only archive and rewrites LEARNINGS.md', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      '# LEARNINGS\n\n' +
        entry('old', '2026-06-01', 'active') +
        entry('new', '2026-08-20', 'active'),
      'utf8',
    )
    const result = applyRetirement(root, { cap: 20 })
    expect(result.retired.length).toBe(1)
    const kept = fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8')
    expect(kept).not.toContain('Lesson old')
    expect(kept).toContain('Lesson new')
    const archive = fs.readFileSync(
      path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
      'utf8',
    )
    expect(archive).toContain('Lesson old')
  })

  test('archive is append-only across multiple runs', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      '# LEARNINGS\n\n' +
        entry('a', '2026-06-01', 'active') +
        entry('b', '2026-08-01', 'active'),
      'utf8',
    )
    applyRetirement(root, { cap: 8 })
    // Second run with a fresh entry to retire.
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      '# LEARNINGS\n\n' +
        entry('b', '2026-08-01', 'active') +
        entry('c', '2026-06-02', 'active'),
      'utf8',
    )
    applyRetirement(root, { cap: 8 })
    const archive = fs.readFileSync(
      path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
      'utf8',
    )
    expect(archive).toContain('Lesson a')
    expect(archive).toContain('Lesson c')
  })
})
