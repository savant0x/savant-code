import { describe, expect, test } from 'bun:test'

import { getRuntimeRequire, resolveBunSqliteModule } from '../bun-sqlite'

import type { Database } from 'bun:sqlite'

// FID-2026-1013-011 Wave 2 (W2-6) — the consolidated lazy loader. These pins
// are the contract the four former copies (knowledge-graph, docset-search,
// sqlite-adapter, packages/database) relied on: a clear error before any raw
// ReferenceError/module-resolution failure escapes, a caller-supplied subject
// so the sentence still names what failed, and a successful resolution under
// the real Bun runtime.

describe('getRuntimeRequire', () => {
  test('returns the runtime require under Bun', () => {
    const requireFn = getRuntimeRequire()
    expect(typeof requireFn).toBe('function')
    // Resolving through it actually loads a builtin module.
    expect(requireFn?.('node:path')).toBeTruthy()
  })
})

describe('resolveBunSqliteModule', () => {
  test('throws the caller-worded message when no require exists (Node ESM)', () => {
    try {
      resolveBunSqliteModule({
        requireFn: null,
        subject: 'The knowledge-graph package requires the Bun runtime',
      })
      expect.unreachable('should throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        'The knowledge-graph package requires the Bun runtime: bun:sqlite is only available under Bun.',
      )
      expect((error as Error).message).not.toContain('ReferenceError')
    }
  })

  test('appends the caller hint to the unavailable message', () => {
    expect(() =>
      resolveBunSqliteModule({
        requireFn: undefined,
        subject: 'The database tools require the Bun runtime',
        unavailableHint:
          ' Run the CLI/agent with Bun (e.g. `bun run savant-code`) instead of Node.js.',
      }),
    ).toThrow(
      'The database tools require the Bun runtime: bun:sqlite is only available under Bun. Run the CLI/agent with Bun (e.g. `bun run savant-code`) instead of Node.js.',
    )
  })

  test('wraps a failed require in the caller-worded message', () => {
    try {
      resolveBunSqliteModule({
        requireFn: () => {
          throw new Error("Cannot find module 'bun:sqlite'")
        },
        subject: 'Docset search requires the Bun runtime',
        loadFailureHint: ' Run the CLI/agent with Bun instead of Node.js.',
      })
      expect.unreachable('should throw')
    } catch (error) {
      expect((error as Error).message).toBe(
        "Docset search requires the Bun runtime: failed to load bun:sqlite (Cannot find module 'bun:sqlite'). Run the CLI/agent with Bun instead of Node.js.",
      )
    }
  })

  test('returns the module resolved through an injectable require', () => {
    // The loader's return type IS the real `bun:sqlite` module shape, so the
    // stub is cast at the seam rather than widened into the signature.
    const stub = { Database: class {} } as unknown as {
      Database: typeof Database
    }
    expect(
      resolveBunSqliteModule({
        requireFn: (id) => (id === 'bun:sqlite' ? stub : undefined),
        subject: 'Test consumer requires the Bun runtime',
      }),
    ).toBe(stub)
  })

  test('resolves the real bun:sqlite constructor under Bun', () => {
    const resolved = resolveBunSqliteModule({
      requireFn: getRuntimeRequire(),
      subject: 'Test consumer requires the Bun runtime',
    })
    expect(typeof resolved.Database).toBe('function')
    const db = new resolved.Database(':memory:')
    db.exec('CREATE TABLE t (id INTEGER)')
    db.close()
  })
})
