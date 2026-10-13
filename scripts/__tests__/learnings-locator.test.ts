import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildLessonLocator,
  lessonSpans,
  readLessonLocator,
  resolveLesson,
  LIVE_LESSONS,
  RETIRED_LESSONS,
} from '../learnings-locator'
import { loadLessons } from '../lessons-to-skills'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function entry(title: string, status = 'active', replacement?: string): string {
  return (
    `## Lesson: ${title}\n\n- **Date:** 2026-10-13\n` +
    '- **Guard:** Preserve complete original evidence\n' +
    '- **Canonical rule:** preserve-evidence\n' +
    `- **Status:** ${status}\n` +
    (replacement ? `- **Superseded by:** ${replacement}\n` : '')
  )
}

function locator(live: string, retired = '') {
  return buildLessonLocator([
    { file: LIVE_LESSONS, content: live, retired: false },
    { file: RETIRED_LESSONS, content: retired, retired: true },
  ])
}

describe('shared lesson locator', () => {
  test('retired entries retain location, date, status, rule and heading line', () => {
    const index = locator('', `# Archive\n\n${entry('Retired lesson')}`)
    const result = resolveLesson(index, 'Retired lesson')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.issue)
    expect(result.locations[0]?.file).toBe(RETIRED_LESSONS)
    expect(result.locations[0]?.retired).toBe(true)
    expect(result.locations[0]?.line).toBe(3)
    expect(result.locations[0]?.entry.date).toBe('2026-10-13')
    expect(result.locations[0]?.entry.status).toBe('active')
    expect(result.locations[0]?.entry.canonicalRule).toBe('preserve-evidence')
    expect(resolveLesson(index, 'Absent')).toEqual({
      ok: false,
      issue: 'Missing lesson: Absent',
    })
  })

  test('identical duplicates preserve every location; conflicting bodies fail closed', () => {
    const body = entry('Same')
    const result = resolveLesson(
      locator(body, body.replaceAll('\n', '\r\n')),
      'Same',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.issue)
    expect(result.locations).toHaveLength(2)
    expect(
      resolveLesson(
        locator(body, body.replace('complete', 'different')),
        'Same',
      ),
    ).toEqual({ ok: false, issue: 'Ambiguous lesson: Same' })
  })

  test('supersession resolves chains explicitly and refuses cycles or missing replacements', () => {
    const index = locator(
      entry('New'),
      entry('Old', 'superseded', 'Middle') +
        entry('Middle', 'superseded', 'New'),
    )
    const resolved = resolveLesson(index, 'Old')
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) throw new Error(resolved.issue)
    expect(resolved.replacements).toEqual(['Middle', 'New'])
    expect(resolved.locations[0]?.entry.title).toBe('New')
    expect(
      resolveLesson(locator('', entry('Old', 'superseded', 'Missing')), 'Old'),
    ).toEqual({
      ok: false,
      issue: 'Missing replacement lesson: Missing (from Old)',
    })
    expect(
      resolveLesson(
        locator(entry('A', 'superseded', 'B') + entry('B', 'superseded', 'A')),
        'A',
      ),
    ).toEqual({ ok: false, issue: 'Supersession cycle: A → B → A' })
    expect(resolveLesson(locator(entry('Old', 'superseded')), 'Old').ok).toBe(
      false,
    )
  })

  test('parser retains byte spans and treats structural comments as boundaries', () => {
    const body =
      entry('Original') + '\n<!-- Add new entries above this line -->\n'
    const spans = lessonSpans(body)
    expect(spans[0]?.block).toBe(body)
    expect(spans[0]?.entry.status).toBe('active')
    expect(spans[0]?.entry.canonicalRule).toBe('preserve-evidence')
  })

  test('skill loading resolves both stores but never promotes retired active lessons', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'locator-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'dev'))
    fs.writeFileSync(path.join(root, LIVE_LESSONS), entry('Live'))
    fs.writeFileSync(path.join(root, RETIRED_LESSONS), entry('Retired'))
    expect(readLessonLocator(root).size).toBe(2)
    expect(loadLessons(root).map((lesson) => lesson.title)).toEqual(['Live'])
    fs.writeFileSync(
      path.join(root, RETIRED_LESSONS),
      entry('Live').replace('complete', 'conflicting'),
    )
    expect(() => loadLessons(root)).toThrow('Ambiguous lesson: Live')
  })

  test('the real candidate lesson titles resolve without modifying either ledger', () => {
    const root = path.resolve(import.meta.dir, '../..')
    const index = readLessonLocator(root)
    expect(index.size).toBeGreaterThan(37)
    expect(
      resolveLesson(
        index,
        'Files over the 100k-character tool read limit break every in-place edit path',
      ).ok,
    ).toBe(true)
  })
})
