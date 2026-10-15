// sqlite-adapter test family — JSONValue coercion + SQL redaction.
// Sibling of the Loop 349 decomposition (shared fixtures in
// ./sqlite-adapter-test-harness).
import { describe, expect, test } from 'bun:test'

import {
  normalizeSqliteRow,
  normalizeSqliteValue,
  redactSql,
} from '../sqlite-adapter'

// ============================================================================
// normalizeSqliteValue / normalizeSqliteRow (JSONValue coercion)
// ============================================================================

describe('normalizeSqliteValue', () => {
  test('coerces BLOB (Uint8Array) to base64 text', () => {
    const blob = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const value = normalizeSqliteValue(blob)
    expect(value).toBe(Buffer.from(blob).toString('base64'))
    expect(typeof value).toBe('string')
  })

  test('coerces bigint to string', () => {
    const huge = 9_007_199_254_740_993n
    expect(normalizeSqliteValue(huge)).toBe('9007199254740993')
  })

  test('passes through JSON primitives unchanged', () => {
    expect(normalizeSqliteValue(null)).toBeNull()
    expect(normalizeSqliteValue('text')).toBe('text')
    expect(normalizeSqliteValue(42)).toBe(42)
    expect(normalizeSqliteValue(3.14)).toBe(3.14)
    expect(normalizeSqliteValue(true)).toBe(true)
  })

  test('defensively stringifies unknown non-JSON values', () => {
    const value = normalizeSqliteValue({ weird: true } as unknown)
    expect(typeof value).toBe('string')
  })
})

describe('normalizeSqliteRow', () => {
  test('maps every column through the value coercer', () => {
    const row = normalizeSqliteRow({
      id: 1,
      name: 'Alice',
      avatar: new Uint8Array([1, 2, 3]),
      big: 12345678901234567890n,
    })
    expect(row.id).toBe(1)
    expect(row.name).toBe('Alice')
    expect(row.avatar).toBe('AQID')
    expect(row.big).toBe('12345678901234567890')
  })
})

// ============================================================================
// redactSql (ported RedactSQL)
// ============================================================================

describe('redactSql', () => {
  test('redacts string literals and long numbers', () => {
    const redacted = redactSql(
      "SELECT * FROM users WHERE email = 'secret@example.com' AND id = 12345678901",
    )
    expect(redacted).not.toContain('secret@example.com')
    expect(redacted).not.toContain('12345678901')
    expect(redacted).toContain("'***'")
  })

  test('keeps short numbers and keywords', () => {
    const redacted = redactSql('SELECT id FROM users WHERE x = 42')
    expect(redacted).toContain('42')
    expect(redacted).toContain('SELECT')
  })
})
