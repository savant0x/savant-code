import { describe, expect, test } from 'bun:test'

import { parseStringifiedToolInput } from '../tool-call-repair'

// Desktop boot-delay root cause (2026-08-24): models keep calling
// read_files/read_subtree with `{ path }` — every sibling tool takes a
// singular path — and each rejection burned a full round-trip during the
// ECHO boot reads. The alias pass normalizes BEFORE schema validation.

describe('key-alias repairs (boot-delay fix)', () => {
  test('read_files {path} normalizes to {paths: [...]}', () => {
    const { input, parseError } = parseStringifiedToolInput(
      { path: 'dev/fids/' },
      'read_files',
    )
    expect(parseError).toBeUndefined()
    expect(input).toEqual({ paths: ['dev/fids/'] })
  })

  test('read_subtree gets the same normalization and keeps extra fields', () => {
    const { input } = parseStringifiedToolInput(
      { path: 'src', limit: 5 },
      'read_subtree',
    )
    expect(input).toEqual({ paths: ['src'], limit: 5 })
  })

  test('a genuine paths array passes through untouched', () => {
    const original = { paths: ['a.ts', 'b.ts'] }
    const { input } = parseStringifiedToolInput(original, 'read_files')
    expect(input).toBe(original)
  })

  test('list_directory keeps its singular path — not an alias target', () => {
    const { input } = parseStringifiedToolInput(
      { path: 'docs' },
      'list_directory',
    )
    expect(input).toEqual({ path: 'docs' })
  })

  test('double-encoded bare {path} objects repair through the same seam', () => {
    const encoded = JSON.stringify(JSON.stringify({ path: 'ECHO.md' }))
    const { input, parseError } = parseStringifiedToolInput(
      encoded,
      'read_files',
    )
    expect(parseError).toBeUndefined()
    expect(input).toEqual({ paths: ['ECHO.md'] })
  })
})
