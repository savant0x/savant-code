// FID-2026-0912-003 RED pins: durable pattern wiki (dev/wiki/) — mechanical
// pattern pages distilled from the dedup engine's recurrence output.
//
// Contract under test (FID-2026-0912-003):
// 1. One page per promoted recurrence at dev/wiki/patterns/<slug>.md —
//    deterministic slug from toolName + dedup key prefix.
// 2. Pages are update-only: evidence rows append when the observation
//    changes; identical re-reviews append nothing. Never auto-deleted.
// 3. Page cap: evidence rows bounded (oldest dropped, newest kept).
// 4. index.md lists pages with counts, sorted by recurrences desc.

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  appendPatternEvidence,
  buildPatternPage,
  patternSlug,
  updateWikiPattern,
  wikiIndexPath,
  wikiPatternsDir,
  wikiRootDir,
} from '../skill-wiki'

import type { WikiPatternInput } from '../skill-wiki'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-wiki-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const NOW = Date.UTC(2026, 8, 12, 12) // 2026-09-12T12:00Z
const UPDATED_AT = new Date(NOW).toISOString()

function pattern(overrides: Partial<WikiPatternInput> = {}): WikiPatternInput {
  return {
    key: 'a'.repeat(64),
    toolName: 'run_terminal_command',
    errorFirstLine: 'tsc: error TS2322: Type is not assignable',
    count: 5,
    totalCount: 7,
    firstTs: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastTs: new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('FID-2026-0912-003: slug determinism', () => {
  test('slug is deterministic, kebab-safe, and keyed', () => {
    const a = patternSlug({
      key: 'ab12'.repeat(16),
      toolName: 'run_terminal_command',
    })
    const b = patternSlug({
      key: 'ab12'.repeat(16),
      toolName: 'run_terminal_command',
    })
    expect(a).toBe(b)
    expect(a).toBe('run-terminal-command-ab12ab12ab12')
    const weird = patternSlug({
      key: 'ff'.repeat(32),
      toolName: 'Weird Tool!!',
    })
    expect(weird).toBe('weird-tool-ffffffffffff')
  })
})

describe('FID-2026-0912-003: page lifecycle', () => {
  test('updateWikiPattern creates a page with the observation data', () => {
    const root = fixtureRoot()
    const result = updateWikiPattern(root, pattern(), { now: NOW })
    expect(result).toBe('created')

    const pagePath = path.join(
      wikiPatternsDir(root),
      'run-terminal-command-aaaaaaaaaaaa.md',
    )
    expect(fs.existsSync(pagePath)).toBe(true)
    const page = fs.readFileSync(pagePath, 'utf8')
    expect(page).toContain('run_terminal_command')
    expect(page).toContain('Type is not assignable')
    expect(page).toContain('**Recurrences (14d window):** 5 (total 7)')
    // Evidence rows carry the observation DATE (readable, deterministic).
    expect(page).toContain('- 2026-09-12 — recurrences 5')
    // Exactly one evidence row on creation (dated rows only — the
    // metadata block also uses '- ' list markers, which don't count).
    expect(page.match(/^- \d{4}-\d{2}-\d{2} — /gm)?.length ?? 0).toBe(1)
  })

  test('re-review with identical data appends NO new evidence row', () => {
    const root = fixtureRoot()
    const p = pattern()
    updateWikiPattern(root, p, { now: NOW })
    const second = updateWikiPattern(root, p, {
      now: NOW + 24 * 60 * 60 * 1000,
    })
    expect(second).toBe('updated')
    const pagePath = path.join(
      wikiPatternsDir(root),
      'run-terminal-command-aaaaaaaaaaaa.md',
    )
    const page = fs.readFileSync(pagePath, 'utf8')
    expect(page.match(/^- \d{4}-\d{2}-\d{2} — /gm)?.length ?? 0).toBe(1)
  })

  test('changed observation appends an evidence row and refreshes counts', () => {
    const root = fixtureRoot()
    updateWikiPattern(root, pattern(), { now: NOW })
    const escalated = pattern({ count: 9, totalCount: 11 })
    updateWikiPattern(root, escalated, { now: NOW + 24 * 60 * 60 * 1000 })
    const pagePath = path.join(
      wikiPatternsDir(root),
      'run-terminal-command-aaaaaaaaaaaa.md',
    )
    const page = fs.readFileSync(pagePath, 'utf8')
    expect(page.match(/^- \d{4}-\d{2}-\d{2} — /gm)?.length ?? 0).toBe(2)
    expect(page).toContain('**Recurrences (14d window):** 9 (total 11)')
    expect(page).toContain('2026-09-13')
  })

  test('update never deletes the page (update-only invariant)', () => {
    const root = fixtureRoot()
    updateWikiPattern(root, pattern(), { now: NOW })
    const pagePath = path.join(
      wikiPatternsDir(root),
      'run-terminal-command-aaaaaaaaaaaa.md',
    )
    const before = fs.readFileSync(pagePath, 'utf8')
    for (let day = 1; day <= 3; day++) {
      updateWikiPattern(root, pattern({ count: 5 + day }), {
        now: NOW + day * 24 * 60 * 60 * 1000,
      })
    }
    const after = fs.readFileSync(pagePath, 'utf8')
    expect(after.startsWith(before.split('\n')[0])).toBe(true)
    expect(fs.existsSync(pagePath)).toBe(true)
  })
})

describe('FID-2026-0912-003: evidence cap', () => {
  test('buildPatternPage/append keeps at most the newest rows under the cap', () => {
    let page = buildPatternPage(pattern(), UPDATED_AT)
    // 20 escalating observations — the page must stay bounded.
    for (let day = 1; day <= 20; day++) {
      page = appendPatternEvidence(
        page,
        pattern({
          count: 5 + day,
          lastTs: new Date(NOW + day * 86400000).toISOString(),
        }),
        new Date(NOW + day * 86400000).toISOString(),
      )
    }
    const rowCount = page.match(/^- \d{4}-\d{2}-\d{2} — /gm)?.length ?? 0
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThanOrEqual(12)
    // The OLDEST rows were dropped, the newest kept.
    expect(page).toContain('- 2026-10-02 —')
    expect(page).not.toContain('- 2026-09-12 —')
  })
})

describe('FID-2026-0912-003: index', () => {
  test('index lists pages sorted by recurrences desc with links', () => {
    const root = fixtureRoot()
    updateWikiPattern(root, pattern({ count: 3 }), { now: NOW })
    updateWikiPattern(
      root,
      pattern({
        key: 'b'.repeat(64),
        toolName: 'code_search',
        count: 9,
        errorFirstLine: 'rg vanished',
      }),
      { now: NOW },
    )
    const index = fs.readFileSync(wikiIndexPath(root), 'utf8')
    expect(index).toContain('code-search-bbbbbbbbbbbb.md')
    expect(index).toContain('run-terminal-command-aaaaaaaaaaaa.md')
    const codeIdx = index.indexOf('code-search-bbbbbbbbbbbb')
    const runIdx = index.indexOf('run-terminal-command-aaaaaaaaaaaa')
    expect(codeIdx).toBeGreaterThan(-1)
    expect(runIdx).toBeGreaterThan(codeIdx) // higher count first
    // Header for the mechanical provenance.
    expect(index).toContain('FID-2026-0912-003')
  })

  test('wiki paths are rooted at dev/wiki', () => {
    expect(wikiRootDir('/repo')).toBe(path.join('/repo', 'dev', 'wiki'))
    expect(wikiPatternsDir('/repo')).toBe(
      path.join('/repo', 'dev', 'wiki', 'patterns'),
    )
    expect(wikiIndexPath('/repo')).toBe(
      path.join('/repo', 'dev', 'wiki', 'index.md'),
    )
  })
})

describe('FID-2026-0912-003: page content shape', () => {
  test('buildPatternPage renders the full observation deterministically', () => {
    const page = buildPatternPage(pattern(), UPDATED_AT)
    expect(page).toContain('# Pattern: run_terminal_command')
    expect(page).toContain('sha256:' + 'a'.repeat(64))
    expect(page).toContain('## Evidence')
    expect(page).toContain('`tsc: error TS2322: Type is not assignable`')
    expect(page.endsWith('\n')).toBe(true)
  })
})
