// FID-2026-0912-002 RED pins: archive-not-purge — expired never-trusted
// drafts MOVE to `.quarantine/.archive/YYYY-MM/` with an ARCHIVED.json
// record; no deletion path exists anywhere in the expiration flow.

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { archiveRejectedDrafts } from '../lessons-to-skills'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-np-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const MS_PER_DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 8, 12, 12) // 2026-09-12T12:00Z

function makeDraft(root: string, name: string, ageDays: number): string {
  const dir = path.join(root, '.agents', 'skills', '.quarantine', name)
  fs.mkdirSync(dir, { recursive: true })
  const content = `---\nname: ${name}\nversion: 0.1.0\ndescription: d\n---\n\nBody of ${name}\n`
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8')
  const mtime = new Date(NOW - ageDays * MS_PER_DAY)
  fs.utimesSync(path.join(dir, 'SKILL.md'), mtime, mtime)
  return content
}

describe('FID-2026-0912-002: archive-not-purge', () => {
  test('expired draft MOVES to .archive/YYYY-MM/ with bytes intact', () => {
    const root = fixtureRoot()
    const original = makeDraft(root, 'old-draft', 40)

    const archived = archiveRejectedDrafts(root, { now: NOW })
    expect(archived).toEqual(['old-draft'])

    // Original quarantine entry GONE.
    expect(
      fs.existsSync(
        path.join(root, '.agents', 'skills', '.quarantine', 'old-draft'),
      ),
    ).toBe(false)

    // Landed in the archive under the mtime month (2026-08).
    const dest = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      '.archive',
      '2026-08',
      'old-draft',
    )
    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe(original)
  })

  test('ARCHIVED.json record travels with the archived draft', () => {
    const root = fixtureRoot()
    makeDraft(root, 'recorded', 35)
    archiveRejectedDrafts(root, { now: NOW })

    const recordPath = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      '.archive',
      '2026-08',
      'recorded',
      'ARCHIVED.json',
    )
    expect(fs.existsSync(recordPath)).toBe(true)
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<
      string,
      unknown
    >
    expect(record['name']).toBe('recorded')
    expect(typeof record['archivedAt']).toBe('string')
    expect(typeof record['originalMtime']).toBe('string')
  })

  test('name collision in the same month gets a numeric suffix', () => {
    const root = fixtureRoot()
    // Both ages land in the same archive month (2026-08: Aug 3 and Aug 2).
    makeDraft(root, 'collide', 40)
    archiveRejectedDrafts(root, { now: NOW })
    // A second, identically-named draft (new file, same expired age) —
    // e.g. re-drafted and expired again before the operator looked.
    makeDraft(root, 'collide', 41)
    archiveRejectedDrafts(root, { now: NOW })

    const monthDir = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      '.archive',
      '2026-08',
    )
    expect(fs.existsSync(path.join(monthDir, 'collide'))).toBe(true)
    expect(fs.existsSync(path.join(monthDir, 'collide-2'))).toBe(true)
  })

  test('fresh drafts are untouched; the archive dir itself is skipped', () => {
    const root = fixtureRoot()
    makeDraft(root, 'fresh', 2)
    // Pre-existing archive content must never be re-processed.
    const existingArchive = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      '.archive',
      '2026-07',
      'already-archived',
    )
    fs.mkdirSync(existingArchive, { recursive: true })
    fs.writeFileSync(
      path.join(existingArchive, 'SKILL.md'),
      '---\nname: already-archived\nversion: 0.1.0\ndescription: d\n---\n\nOld\n',
      'utf8',
    )

    const archived = archiveRejectedDrafts(root, { now: NOW })
    expect(archived).toEqual([])

    expect(
      fs.existsSync(
        path.join(root, '.agents', 'skills', '.quarantine', 'fresh'),
      ),
    ).toBe(true)
    // The old archive entry was NOT moved to the current month.
    expect(fs.existsSync(existingArchive)).toBe(true)
  })

  test('NO deletion: expired draft bytes always survive somewhere', () => {
    const root = fixtureRoot()
    const original = makeDraft(root, 'survivor', 90)
    archiveRejectedDrafts(root, { now: NOW })

    const archivedRoot = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      '.archive',
    )
    let found = false
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name === 'SKILL.md') {
          if (fs.readFileSync(full, 'utf8') === original) found = true
        }
      }
    }
    walk(archivedRoot)
    expect(found).toBe(true)
  })
})
