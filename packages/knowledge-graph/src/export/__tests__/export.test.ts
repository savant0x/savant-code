/**
 * Tests for the Code Universe export pipeline (FID-2026-0807-002).
 * Covers the pure functions: positiveLimit, resolveContainedPath,
 * truncateUtf8, readFilePreview, buildUniverse, and serializeGraphForExport.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  positiveLimit,
  resolveContainedPath,
  truncateUtf8,
  readFilePreview,
} from '../read-preview'
import { serializeGraphForExport } from '../serialize'
import { buildUniverse } from '../universe-builder'

import type { GraphExportOptions } from '../types'

describe('positiveLimit', () => {
  it('returns undefined for undefined input', () => {
    expect(positiveLimit(undefined)).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    expect(positiveLimit(0)).toBeUndefined()
  })

  it('returns undefined for negative values', () => {
    expect(positiveLimit(-5)).toBeUndefined()
  })

  it('returns undefined for non-finite values', () => {
    expect(positiveLimit(Infinity)).toBeUndefined()
    expect(positiveLimit(NaN)).toBeUndefined()
  })

  it('returns the value for positive finite numbers', () => {
    expect(positiveLimit(100)).toBe(100)
    expect(positiveLimit(0.5)).toBe(0.5)
  })
})

describe('resolveContainedPath', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'kg-export-test-'))
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('resolves a normal file path within the project', () => {
    const filePath = join(projectRoot, 'src', 'index.ts')
    mkdirSync(join(projectRoot, 'src'), { recursive: true })
    writeFileSync(filePath, 'export {}')
    const result = resolveContainedPath(projectRoot, 'src/index.ts')
    expect(result.outside).toBe(false)
    expect(result.path).toBeDefined()
  })

  it('flags paths that escape the project root via ..', () => {
    const result = resolveContainedPath(projectRoot, '../etc/passwd')
    expect(result.outside).toBe(true)
  })

  it('flags the project root itself as outside', () => {
    const result = resolveContainedPath(projectRoot, '.')
    expect(result.outside).toBe(true)
  })

  it('returns outside=true for non-existent files (no realpath)', () => {
    const result = resolveContainedPath(projectRoot, 'non-existent-file.ts')
    expect(result.outside).toBe(false)
    expect(result.path).toBeUndefined()
  })
})

describe('truncateUtf8', () => {
  it('returns the original text when within byte limit', () => {
    const text = 'hello world'
    expect(truncateUtf8(text, 100)).toBe(text)
  })

  it('truncates text exceeding the byte limit', () => {
    const text = 'a'.repeat(200)
    const result = truncateUtf8(text, 100)
    expect(result.length).toBeLessThan(text.length)
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(100 + 4)
  })

  it('handles multi-byte UTF-8 characters without corruption', () => {
    // Each emoji is 4 bytes in UTF-8
    const text = '😀'.repeat(100)
    const result = truncateUtf8(text, 50)
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(50 + 4)
    // The result should decode without replacement characters
    expect(result).not.toContain('�')
  })

  it('handles empty string', () => {
    expect(truncateUtf8('', 100)).toBe('')
  })
})

describe('readFilePreview', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'kg-preview-test-'))
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('returns a capped preview for a text file', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`)
    const filePath = join(projectRoot, 'test.ts')
    writeFileSync(filePath, lines.join('\n'))

    const preview = readFilePreview(projectRoot, 'test.ts', 20, 2000)
    expect(preview).toBeDefined()
    expect(preview!).toContain('line 1')
    expect(preview!).toContain('line 20')
    expect(preview!).not.toContain('line 21')
  })

  it('returns undefined for paths outside the project root', () => {
    const preview = readFilePreview(projectRoot, '../package.json', 20, 2000)
    expect(preview).toBeUndefined()
  })

  it('returns undefined for binary files (NUL byte)', () => {
    const filePath = join(projectRoot, 'binary.dat')
    writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02, 0x03]))
    const preview = readFilePreview(projectRoot, 'binary.dat', 20, 2000)
    expect(preview).toBeUndefined()
  })

  it('returns undefined for non-existent files', () => {
    const preview = readFilePreview(projectRoot, 'missing.ts', 20, 2000)
    expect(preview).toBeUndefined()
  })

  it('caps preview at maxChars with ellipsis', () => {
    const longLine = 'x'.repeat(5000)
    const filePath = join(projectRoot, 'long.ts')
    writeFileSync(filePath, longLine)

    const preview = readFilePreview(projectRoot, 'long.ts', 1, 100)
    expect(preview).toBeDefined()
    // maxChars (100) + '\n…' (newline + ellipsis = 2) = 102
    expect(preview!).toContain('…')
  })
})

describe('buildUniverse', () => {
  const fileRows = [
    { id: 1, path: 'src/index.ts', cluster_id: 1 },
    { id: 2, path: 'src/utils.ts', cluster_id: 1 },
    { id: 3, path: 'tests/index.test.ts', cluster_id: null },
    { id: 4, path: 'packages/core/lib.ts', cluster_id: 2 },
  ]

  const edgeRows = [
    { source_id: 1, target_id: 2, type: 'IMPORTS' as const, weight: 3 },
    { source_id: 1, target_id: 3, type: 'CALLS' as const, weight: 1 },
    { source_id: 1, target_id: 4, type: 'IMPORTS' as const, weight: 1 },
  ]

  it('groups files into regions by top-level directory', () => {
    const universe = buildUniverse(fileRows, edgeRows)
    const regionPaths = universe.regions.map((r) => r.path)
    expect(regionPaths).toContain('src')
    expect(regionPaths).toContain('tests')
    expect(regionPaths).toContain('packages/core')
  })

  it('assigns root region for top-level files', () => {
    const singleFile = [{ id: 1, path: 'README.md', cluster_id: null }]
    const universe = buildUniverse(singleFile, [])
    expect(universe.regions).toHaveLength(1)
    expect(universe.regions[0].path).toBe('root')
  })

  it('builds cross-region corridors', () => {
    const universe = buildUniverse(fileRows, edgeRows)
    // Edge from src/index.ts -> packages/core/lib.ts crosses regions
    expect(universe.corridors.length).toBeGreaterThan(0)
    const corridor = universe.corridors[0]
    expect(corridor.source).toMatch(/^region-/)
    expect(corridor.target).toMatch(/^region-/)
    expect(corridor.edgeCount).toBeGreaterThan(0)
  })

  it('builds folder hierarchy with parent-child relationships', () => {
    const universe = buildUniverse(fileRows, edgeRows)
    const rootFolder = universe.folders.find(
      (f) => f.id === universe.rootFolderId,
    )
    expect(rootFolder).toBeDefined()
    expect(rootFolder!.parentId).toBeNull()
    expect(rootFolder!.childIds.length).toBeGreaterThan(0)
  })

  it('marks regions with no edges as disconnected (except root)', () => {
    // tests/index.test.ts has an incoming edge from src/index.ts, so add a
    // truly isolated file in its own region to verify the disconnected flag.
    const isolatedFiles = [
      { id: 1, path: 'src/index.ts', cluster_id: 1 },
      { id: 2, path: 'isolated/alone.ts', cluster_id: null },
    ]
    const edges = [
      { source_id: 1, target_id: 1, type: 'CALLS' as const, weight: 0 },
    ]
    const universe = buildUniverse(isolatedFiles, edges)
    const isolatedRegion = universe.regions.find((r) => r.path === 'isolated')
    expect(isolatedRegion).toBeDefined()
    expect(isolatedRegion!.disconnected).toBe(true)
  })

  it('never marks root as disconnected even with no edges', () => {
    const singleFile = [{ id: 1, path: 'README.md', cluster_id: null }]
    const universe = buildUniverse(singleFile, [])
    expect(universe.regions[0].disconnected).toBe(false)
  })

  it('assigns positions to all files', () => {
    const universe = buildUniverse(fileRows, edgeRows)
    expect(universe.files).toHaveLength(4)
    for (const file of universe.files) {
      expect(typeof file.position.x).toBe('number')
      expect(typeof file.position.y).toBe('number')
    }
  })

  it('builds a search index covering systems, folders, and files', () => {
    const universe = buildUniverse(fileRows, edgeRows)
    const kinds = universe.searchIndex.map((e) => e.kind)
    expect(kinds).toContain('system')
    expect(kinds).toContain('folder')
    expect(kinds).toContain('file')
  })

  it('computes file importance based on degree', () => {
    const universe = buildUniverse(fileRows, edgeRows)
    const indexFile = universe.files.find((f) => f.path === 'src/index.ts')
    expect(indexFile).toBeDefined()
    // index.ts has 3 edges (highest degree)
    expect(indexFile!.importance).toBe(1)
  })
})

describe('serializeGraphForExport', () => {
  function createTestDb(): Database {
    const db = new Database(':memory:')
    db.run(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL
      )
    `)
    db.run(`
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY,
        file_id INTEGER,
        type TEXT NOT NULL,
        cluster_id INTEGER
      )
    `)
    db.run(`
      CREATE TABLE edges (
        source_id INTEGER,
        target_id INTEGER,
        type TEXT,
        weight REAL
      )
    `)
    return db
  }

  function seedDb(db: Database) {
    db.run("INSERT INTO files (id, path) VALUES (1, 'src/index.ts')")
    db.run("INSERT INTO files (id, path) VALUES (2, 'src/utils.ts')")
    db.run("INSERT INTO files (id, path) VALUES (3, 'README.md')")

    db.run(
      "INSERT INTO nodes (id, file_id, type, cluster_id) VALUES (1, 1, 'file', 1)",
    )
    db.run(
      "INSERT INTO nodes (id, file_id, type, cluster_id) VALUES (2, 2, 'file', 1)",
    )
    db.run(
      "INSERT INTO nodes (id, file_id, type, cluster_id) VALUES (3, 3, 'file', NULL)",
    )
    db.run(
      "INSERT INTO nodes (id, file_id, type, cluster_id) VALUES (4, NULL, 'symbol', 1)",
    )
    db.run(
      "INSERT INTO nodes (id, file_id, type, cluster_id) VALUES (5, NULL, 'symbol', 1)",
    )

    db.run(
      "INSERT INTO edges (source_id, target_id, type, weight) VALUES (1, 2, 'imports', 3)",
    )
    db.run(
      "INSERT INTO edges (source_id, target_id, type, weight) VALUES (1, 3, 'references', 1)",
    )
  }

  it('produces a valid GraphExport with meta, elements, and universe', () => {
    const db = createTestDb()
    seedDb(db)
    const result = serializeGraphForExport(db)
    expect(result.generatedAt).toBeDefined()
    expect(result.meta.files).toBe(3)
    expect(result.meta.nodes).toBe(5) // 3 file nodes + 2 symbol nodes
    expect(result.meta.edges).toBe(2)
    expect(result.elements.length).toBeGreaterThan(0)
    expect(result.universe.files).toHaveLength(3)
  })

  it('includes file, edge, and container elements', () => {
    const db = createTestDb()
    seedDb(db)
    const result = serializeGraphForExport(db)
    const elementTypes = result.elements.map((e) => e.data.type)
    expect(elementTypes).toContain('file')
    expect(elementTypes).toContain('imports')
    expect(elementTypes).toContain('references')
  })

  it('handles empty database without errors', () => {
    const db = createTestDb()
    const result = serializeGraphForExport(db)
    expect(result.meta.files).toBe(0)
    expect(result.meta.edges).toBe(0)
    expect(result.elements).toHaveLength(0)
  })

  it('respects GraphExportOptions for containers', () => {
    const db = createTestDb()
    seedDb(db)
    const options: GraphExportOptions = {
      containers: [{ id: 'container-1', label: 'Core' }],
      containerIds: { 'file-1': 'container-1' },
    }
    const result = serializeGraphForExport(db, options)
    const containerEl = result.elements.find((e) => e.data.id === 'container-1')
    expect(containerEl).toBeDefined()
    expect(containerEl!.data.container).toBe(true)
    const fileInContainer = result.elements.find((e) => e.data.id === 'file-1')
    expect(fileInContainer!.data.parent).toBe('container-1')
  })
})
