import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { applyRetirement, retireLessons } from '../learnings-retire'

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
