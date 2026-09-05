// sqlite-adapter test family — module resolution + SQL classification.
// Sibling of the Loop 349 decomposition (shared fixtures in
// ./sqlite-adapter-test-harness).
import { describe, expect, test } from 'bun:test'

import {
  classifySql,
  DbErrorCode,
  openSqliteDatabase,
  resolveBunSqliteDatabaseModule,
  stripSqlCommentsAndQuotedText,
  StructuredDbError,
} from '../sqlite-adapter'

// ============================================================================
// resolveBunSqliteDatabaseModule (Node-ESM / Node-CJS edge-case hardening)
// ============================================================================

describe('resolveBunSqliteDatabaseModule', () => {
  test('throws a clear StructuredDbError when `require` is unavailable (Node ESM)', () => {
    try {
      // `null` bypasses the default parameter (which would inject Bun's real
      // `require`), simulating an environment with no require global.
      resolveBunSqliteDatabaseModule(null)
      expect.unreachable('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(StructuredDbError)
      const err = e as StructuredDbError
      expect(err.code).toBe(DbErrorCode.CONNECTION_FAILED)
      expect(err.message).toContain('Bun runtime')
      expect(err.message).toContain('bun:sqlite')
      expect(err.message).not.toContain('ReferenceError')
    }
  })

  test('wraps a failed require (Node CJS: Cannot find module) in a clear error', () => {
    try {
      resolveBunSqliteDatabaseModule(() => {
        throw new Error("Cannot find module 'bun:sqlite'")
      })
      expect.unreachable('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(StructuredDbError)
      const err = e as StructuredDbError
      expect(err.code).toBe(DbErrorCode.CONNECTION_FAILED)
      expect(err.message).toContain('Bun runtime')
      expect(err.message).toContain("Cannot find module 'bun:sqlite'")
    }
  })

  test('resolves the real bun:sqlite module when require exists (Bun)', () => {
    const mod = resolveBunSqliteDatabaseModule(require)
    expect(mod).toBeTruthy()
    expect(typeof mod.Database).toBe('function')
    // The resolved constructor actually opens a database.
    const db = new mod.Database(':memory:')
    db.exec('CREATE TABLE t (id INTEGER)')
    db.close()
  })

  test('openSqliteDatabase still works under Bun (lazy require regression)', () => {
    // The real Bun runtime has `require`, so the lazy resolution must succeed
    // end-to-end: open a DB, run a query, and confirm structured output.
    const db = openSqliteDatabase(':memory:')
    db.exec('CREATE TABLE t (id INTEGER, name TEXT)')
    db.exec("INSERT INTO t VALUES (1, 'alpha')")
    const row = db.query('SELECT id, name FROM t').get() as Record<
      string,
      unknown
    >
    expect(row.id).toBe(1)
    expect(row.name).toBe('alpha')
    db.close()
  })
})

// ============================================================================
// classifySql (ported ClassifySQL)
// ============================================================================

describe('classifySql', () => {
  test('classifies core statement types', () => {
    expect(classifySql('SELECT * FROM users')).toBe('select')
    expect(classifySql('  select id from users')).toBe('select')
    expect(classifySql('INSERT INTO users (id) VALUES (1)')).toBe('insert')
    expect(classifySql('UPDATE users SET name = ? WHERE id = 1')).toBe('update')
    expect(classifySql('DELETE FROM users WHERE id = 1')).toBe('delete')
    expect(classifySql('TRUNCATE TABLE users')).toBe('truncate')
    expect(classifySql('CREATE TABLE x (id int)')).toBe('ddl')
    expect(classifySql('ALTER TABLE x ADD COLUMN y')).toBe('ddl')
    expect(classifySql('DROP TABLE users')).toBe('ddl')
    expect(classifySql('EXPLAIN QUERY PLAN SELECT 1')).toBe('explain')
    expect(classifySql('SHOW TABLES')).toBe('show')
    expect(classifySql('SET search_path = x')).toBe('set')
  })

  test('classifies after comment stripping', () => {
    expect(classifySql('-- comment\nSELECT * FROM users')).toBe('select')
    expect(classifySql('/* c */ SELECT * FROM users')).toBe('select')
    // Comment text must not fool the classifier.
    expect(classifySql('SELECT /* DROP TABLE */ * FROM users')).toBe('select')
  })

  test('unknown for empty or garbage', () => {
    expect(classifySql('')).toBe('unknown')
    expect(classifySql('   ')).toBe('unknown')
    expect(classifySql('BANANA 42')).toBe('unknown')
  })
})

// ============================================================================
// stripSqlCommentsAndQuotedText (ported)
// ============================================================================

describe('stripSqlCommentsAndQuotedText', () => {
  test('removes line and block comments, preserves structure length', () => {
    const { searchable } = stripSqlCommentsAndQuotedText(
      'SELECT a -- x\nFROM t /* y */ WHERE b = 1',
    )
    expect(searchable).toContain('SELECT')
    expect(searchable).toContain('FROM')
    expect(searchable).toContain('WHERE')
    expect(searchable).not.toContain('x')
    expect(searchable).not.toContain('y')
  })

  test('blankets quoted strings (LIMIT inside a string is not a clause)', () => {
    const { searchable } = stripSqlCommentsAndQuotedText(
      "SELECT * FROM t WHERE name = 'LIMIT 5'",
    )
    expect(/\bLIMIT\b/.test(searchable)).toBe(false)
  })

  test('tracks trailing line comment state', () => {
    const a = stripSqlCommentsAndQuotedText('SELECT 1 -- trailing')
    expect(a.trailingLineComment).toBe(true)
    const b = stripSqlCommentsAndQuotedText('SELECT 1\n-- trailing')
    expect(b.trailingLineComment).toBe(true)
    const c = stripSqlCommentsAndQuotedText('SELECT 1')
    expect(c.trailingLineComment).toBe(false)
  })
})
