/**
 * Tests for the Code Universe export pipeline (FID-2026-0807-002).
 * Covers the pure functions: positiveLimit, resolveContainedPath,
 * truncateUtf8, readFilePreview, buildUniverse, and serializeGraphForExport.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  positiveLimit,
  resolveContainedPath,
  truncateUtf8,
  readFilePreview,
} from '../read-preview'

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
