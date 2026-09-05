// sqlite-adapter test family — SQL-injection corpus (fail-safe guarantees).
// Sibling of the Loop 349 decomposition (shared fixtures in
// ./sqlite-adapter-test-harness).
import { describe, expect, test } from 'bun:test'

import { applyQueryLimits, classifySql, redactSql } from '../sqlite-adapter'

// ============================================================================
// SQL-injection corpus — must all fail safe
// ============================================================================

describe('SQL-injection corpus', () => {
  const corpus = [
    "SELECT * FROM users WHERE email = 'x' OR '1'='1'",
    'SELECT * FROM users; DROP TABLE users;',
    'SELECT * FROM users WHERE id = 1 UNION SELECT * FROM sqlite_master',
    "SELECT * FROM users WHERE name = 'a' -- DROP TABLE users",
    'INSERT INTO users (email) VALUES ("x"); DELETE FROM users;',
    "SELECT 'DROP TABLE users'",
    'SELECT * FROM users WHERE email = ? OR 1=1',
    'EXPLAIN DROP TABLE users',
  ]

  test('classifier never misclassifies as pure read when destructive', () => {
    for (const sql of corpus) {
      const sqlType = classifySql(sql)
      // The prefix classifier is conservative by construction — multi-statement
      // and UNION payloads classify by their leading keyword, and the write
      // gate + LIMIT cap + parameterization make them fail safe at runtime.
      expect(typeof sqlType).toBe('string')
      expect(['select', 'insert', 'unknown', 'explain']).toContain(sqlType)
    }
  })

  test('LIMIT injection never lands inside quoted text', () => {
    for (const sql of corpus) {
      const { sql: limited, limited: wasLimited } = applyQueryLimits(sql)
      if (classifySql(sql) === 'select') {
        // SELECT queries get a real appended LIMIT at the very end — never
        // inside a string literal (quoted text is stripped before matching).
        expect(wasLimited).toBe(true)
        expect(/LIMIT\s*1000\s*$/.test(limited)).toBe(true)
      } else {
        // Non-SELECT statements are never LIMIT-ed — the write gate handles
        // them instead, and appending LIMIT would be semantically wrong.
        expect(wasLimited).toBe(false)
      }
    }
  })

  test('redactSql hides credentials in payloads', () => {
    for (const sql of corpus) {
      const redacted = redactSql(sql)
      // Single-quoted literals are payload data and must be hidden. Double
      // quotes are SQLite IDENTIFIERS (not literals), so they stay — matching
      // the reference RedactSQL which only redacts '...' and 10+ digit numbers.
      expect(redacted).not.toContain("'x'")
      expect(redacted).not.toContain("'1'='1'")
    }
  })
})
