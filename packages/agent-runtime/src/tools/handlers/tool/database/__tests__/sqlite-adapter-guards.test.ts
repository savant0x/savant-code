// sqlite-adapter test family — LIMIT injection + write gate.
// Sibling of the Loop 349 decomposition (shared fixtures in
// ./sqlite-adapter-test-harness).
import { describe, expect, test } from 'bun:test'

import {
  applyQueryLimits,
  DbErrorCode,
  enforceCanExecuteWrite,
  StructuredDbError,
} from '../sqlite-adapter'

// ============================================================================
// applyQueryLimits (ported ApplyQueryLimits)
// ============================================================================

describe('applyQueryLimits', () => {
  test('appends LIMIT to SELECT without one', () => {
    const { sql, limited } = applyQueryLimits('SELECT * FROM users')
    expect(limited).toBe(true)
    expect(sql).toBe('SELECT * FROM users LIMIT 1000')
  })

  test('skips when LIMIT already present (case-insensitive, whitespace-safe)', () => {
    expect(applyQueryLimits('SELECT * FROM users LIMIT 5').limited).toBe(false)
    expect(applyQueryLimits('SELECT * FROM users\nlimit 5').limited).toBe(false)
    expect(applyQueryLimits('SELECT * FROM users\n\tLIMIT\n\t10').limited).toBe(
      false,
    )
  })

  test('skips LIMIT inside string literals', () => {
    const { limited } = applyQueryLimits(
      "SELECT * FROM users WHERE name = 'LIMIT 5'",
    )
    expect(limited).toBe(true) // real LIMIT injected
  })

  test('handles trailing semicolon', () => {
    const { sql } = applyQueryLimits('SELECT * FROM users;')
    expect(sql).toBe('SELECT * FROM users LIMIT 1000')
  })

  test('does not limit non-SELECT statements', () => {
    expect(applyQueryLimits('INSERT INTO users (id) VALUES (1)').limited).toBe(
      false,
    )
    expect(applyQueryLimits('DROP TABLE users').limited).toBe(false)
  })

  test('uses configured limit', () => {
    const { sql } = applyQueryLimits('SELECT * FROM users', 50)
    expect(sql).toContain('LIMIT 50')
  })
})

// ============================================================================
// enforceCanExecuteWrite (ported CanExecuteWrite)
// ============================================================================

describe('enforceCanExecuteWrite', () => {
  test('allows SELECT without approval', () => {
    expect(() =>
      enforceCanExecuteWrite('SELECT * FROM users', false),
    ).not.toThrow()
  })

  test('rejects INSERT/UPDATE/DELETE without allowWrite', () => {
    for (const sql of [
      'INSERT INTO users (id) VALUES (1)',
      'UPDATE users SET name = ?',
      'DELETE FROM users',
    ]) {
      try {
        enforceCanExecuteWrite(sql, false)
        expect.unreachable(`should reject: ${sql}`)
      } catch (e) {
        expect(e).toBeInstanceOf(StructuredDbError)
        expect((e as StructuredDbError).code).toBe(
          DbErrorCode.WRITE_MODE_REQUIRED,
        )
      }
    }
  })

  test('allows INSERT/UPDATE/DELETE with allowWrite', () => {
    expect(() =>
      enforceCanExecuteWrite('UPDATE users SET name = ?', true),
    ).not.toThrow()
  })

  test('always blocks destructive DDL even with allowWrite', () => {
    for (const sql of [
      'DROP TABLE users',
      'TRUNCATE TABLE users',
      'ALTER TABLE users ADD COLUMN x',
      'CREATE TABLE x (id int)',
    ]) {
      try {
        enforceCanExecuteWrite(sql, true)
        expect.unreachable(`should reject: ${sql}`)
      } catch (e) {
        expect(e).toBeInstanceOf(StructuredDbError)
        expect((e as StructuredDbError).code).toBe(
          DbErrorCode.DESTRUCTIVE_DDL_BLOCKED,
        )
      }
    }
  })

  test('rejects unclassifiable SQL', () => {
    try {
      enforceCanExecuteWrite('BANANA 42', true)
      expect.unreachable('should reject')
    } catch (e) {
      expect(e).toBeInstanceOf(StructuredDbError)
      expect((e as StructuredDbError).code).toBe(DbErrorCode.UNCLASSIFIED_SQL)
    }
  })
})
