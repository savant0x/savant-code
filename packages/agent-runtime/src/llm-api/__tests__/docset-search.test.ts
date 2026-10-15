import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  buildDocset,
  buildMatchExpression,
  queryDocset,
  resolveBunSqlite,
} from '../docset-search'

describe('buildMatchExpression', () => {
  test('returns null for empty or token-less input', () => {
    expect(buildMatchExpression('')).toBeNull()
    expect(buildMatchExpression('   ')).toBeNull()
    expect(buildMatchExpression('!@#$%')).toBeNull()
    expect(buildMatchExpression('a')).toBeNull() // single char filtered
  })

  test('AND-joins quoted tokens', () => {
    expect(buildMatchExpression('bun compile')).toBe('"bun" AND "compile"')
    expect(buildMatchExpression('React 19')).toBe('"react" AND "19"')
  })

  test('strips punctuation into separate tokens', () => {
    expect(buildMatchExpression('foo.bar baz!')).toBe(
      '"foo" AND "bar" AND "baz"',
    )
    expect(buildMatchExpression('a "quoted" phrase')).toBe(
      '"quoted" AND "phrase"',
    )
  })
})

describe('docset build + query', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docset-search-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Windows may hold the SQLite handle briefly; cleanup is best-effort.
    }
  })

  test('throws a clear error when bun:sqlite is unavailable', () => {
    expect(() => resolveBunSqlite(null)).toThrow('requires the Bun runtime')
  })

  test('round-trips entries through build + query with snippets', () => {
    const dbPath = path.join(tempDir, 'bun.sqlite')
    const count = buildDocset({
      dbPath,
      entries: [
        {
          title: 'Bundler',
          url: 'docs/bundler.md',
          content: 'Bun compiles frontend code into a single bundle.',
        },
        {
          title: 'Test runner',
          url: 'docs/test.md',
          content: 'Bun has a built-in test runner for TypeScript.',
        },
        {
          title: 'Runtime',
          url: 'docs/runtime.md',
          content: 'Bun is a fast JavaScript runtime with native APIs.',
        },
      ],
    })
    expect(count).toBe(3)

    const hits = queryDocset({ dbPath, query: 'bun test runner', limit: 3 })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.map((h) => h.title)).toContain('Test runner')
    expect(hits[0].link).toBeDefined()
    expect(hits[0].snippet).toBeDefined()
  })

  test('build is idempotent — replacing the file drops stale rows', () => {
    const dbPath = path.join(tempDir, 'bun.sqlite')
    buildDocset({
      dbPath,
      entries: [{ title: 'Old', url: 'old.md', content: 'stale content' }],
    })
    buildDocset({
      dbPath,
      entries: [{ title: 'New', url: 'new.md', content: 'fresh content' }],
    })

    const hits = queryDocset({ dbPath, query: 'fresh', limit: 5 })
    expect(hits.map((h) => h.title)).toContain('New')
    expect(hits.map((h) => h.title)).not.toContain('Old')
  })

  test('returns [] for a missing database, no match, or bad query', () => {
    const missing = path.join(tempDir, 'missing.sqlite')
    expect(queryDocset({ dbPath: missing, query: 'anything' })).toEqual([])

    const dbPath = path.join(tempDir, 'bun.sqlite')
    buildDocset({
      dbPath,
      entries: [{ title: 'Doc', url: 'd.md', content: 'hello world' }],
    })
    expect(queryDocset({ dbPath, query: 'zzz-not-present' })).toEqual([])
    expect(queryDocset({ dbPath, query: '!@#' })).toEqual([])
  })
})
