import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  cacheDocsetHits,
  findCachedDocset,
  freshnessMarker,
  queryCachedDocset,
  readDocsetFreshness,
  slugifyDocsetName,
} from '../docset-cache'
import { buildDocset, setDocsetMeta } from '../docset-search'

describe('docset cache', () => {
  let originalDir: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalDir = process.env.SAVANT_CODE_DOCSET_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docset-cache-'))
    process.env.SAVANT_CODE_DOCSET_DIR = tempDir
  })

  afterEach(() => {
    if (originalDir === undefined) delete process.env.SAVANT_CODE_DOCSET_DIR
    else process.env.SAVANT_CODE_DOCSET_DIR = originalDir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Windows may hold the SQLite handle briefly; cleanup is best-effort.
    }
  })

  test('slugifies library titles to filesystem-safe names', () => {
    expect(slugifyDocsetName('React Native')).toBe('react-native')
    expect(slugifyDocsetName('  Vue.js 3  ')).toBe('vue-js-3')
    expect(slugifyDocsetName('...')).toBe('')
  })

  test('finds and queries a cached docset', () => {
    buildDocset({
      dbPath: path.join(tempDir, 'bun.sqlite'),
      entries: [
        {
          title: 'Bundler',
          url: 'docs/bundler.md',
          content: 'Bun compiles frontend code.',
        },
      ],
    })

    expect(findCachedDocset('Bun')).toBe(path.join(tempDir, 'bun.sqlite'))

    const result = queryCachedDocset({ libraryTitle: 'Bun', topic: 'bundler' })
    expect(result?.documentation).toContain('Indexed documentation for "Bun"')
    expect(result?.documentation).toContain('Bundler')
  })

  test('returns null when no docset is cached or nothing matches', () => {
    expect(findCachedDocset('NoSuchLib')).toBeNull()
    expect(queryCachedDocset({ libraryTitle: 'NoSuchLib' })).toBeNull()

    buildDocset({
      dbPath: path.join(tempDir, 'bun.sqlite'),
      entries: [{ title: 'Doc', url: 'd.md', content: 'hello world' }],
    })
    expect(queryCachedDocset({ libraryTitle: 'Bun', topic: 'zzz' })).toBeNull()
  })

  test('readDocsetFreshness reports fresh/stale by TTL and exposes version', () => {
    const dbPath = path.join(tempDir, 'bun.sqlite')
    const now = Date.parse('2026-08-19T00:00:00Z')
    buildDocset({
      dbPath,
      entries: [{ title: 'Doc', url: 'd.md', content: 'hello' }],
    })
    setDocsetMeta({
      dbPath,
      meta: {
        fetched_at: new Date(now - 2 * 86_400_000).toISOString(),
        version: '1.2.3',
      },
    })

    const fresh = readDocsetFreshness(dbPath, now)
    expect(fresh.fresh).toBe(true)
    expect(fresh.version).toBe('1.2.3')
    expect(fresh.ageDays).toBeCloseTo(2, 0)

    const stale = readDocsetFreshness(dbPath, now + 8 * 86_400_000)
    expect(stale.fresh).toBe(false)
  })

  test('a docset with no fetched_at metadata is treated as stale', () => {
    const dbPath = path.join(tempDir, 'bun.sqlite')
    buildDocset({
      dbPath,
      entries: [{ title: 'Doc', url: 'd.md', content: 'hello' }],
    })
    expect(readDocsetFreshness(dbPath).fresh).toBe(false)
  })

  test('freshnessMarker renders a cached-age + version note', () => {
    expect(
      freshnessMarker({ fresh: true, ageDays: 0.2, version: '1.0.0' }),
    ).toContain('cached today (v1.0.0)')
    expect(
      freshnessMarker({ fresh: true, ageDays: 3, version: '1.0.0' }),
    ).toContain('cached 3 days ago (v1.0.0)')
    expect(freshnessMarker({ fresh: true, ageDays: 1 })).toContain(
      'cached 1 day ago',
    )
  })

  test('cacheDocsetHits merges by URL and records freshness + version', () => {
    cacheDocsetHits({
      libraryTitle: 'Bun',
      hits: [
        { title: 'Bundler', link: 'https://bun.sh/bundler', snippet: 'bundle' },
      ],
      version: '1.2.3',
    })
    // A second call with an overlapping + a new URL merges, not wipes.
    cacheDocsetHits({
      libraryTitle: 'Bun',
      hits: [
        { title: 'Bundler', link: 'https://bun.sh/bundler', snippet: 'bundle' },
        { title: 'Test runner', link: 'https://bun.sh/test', snippet: 'test' },
      ],
      version: '1.2.3',
    })

    const dbPath = path.join(tempDir, 'bun.sqlite')
    expect(fs.existsSync(dbPath)).toBe(true)
    const freshness = readDocsetFreshness(dbPath)
    expect(freshness.fresh).toBe(true)
    expect(freshness.version).toBe('1.2.3')

    const testHits = queryCachedDocset({ libraryTitle: 'Bun', topic: 'test' })
    expect(testHits?.documentation).toContain('Test runner')
    expect(testHits?.documentation).not.toContain('Bundler')

    const bundlerHits = queryCachedDocset({
      libraryTitle: 'Bun',
      topic: 'bundler',
    })
    expect(bundlerHits?.documentation).toContain('Bundler')
    expect(bundlerHits?.documentation).not.toContain('Test runner')
  })
})
