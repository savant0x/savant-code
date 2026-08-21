import fs from 'fs'
import path from 'path'

import { buildMatchExpression, DOCSET_SCHEMA } from './docset-schema'

import type { Database } from 'bun:sqlite'

export { buildMatchExpression, DOCSET_SCHEMA }

/**
 * bun:sqlite's Database type omits `transaction()` at the declaration level,
 * but the runtime method exists (mirrors better-sqlite3's API). This helper
 * lets us call it without `as any` noise throughout the file.
 */
type TransactionCapable = Database & {
  transaction: <T extends (...args: never[]) => unknown>(
    fn: T,
  ) => (...args: Parameters<T>) => ReturnType<T>
}

/**
 * FID-2026-0819-002 step 5: keyless indexed `read_docs`.
 *
 * A Dash/DevDocs-style docset is a plain SQLite file carrying a `docs` table
 * (id, title, url, content) plus an FTS5 index over title + content. Docsets
 * are built offline (see `scripts/build-docset.ts` and `buildDocset` below),
 * cached locally, and queried with zero network and zero API key.
 *
 * This is a deliberate net-new `bun:sqlite` module — NOT a reuse of
 * `@savant-code/knowledge-graph` (a code dependency-graph engine with no
 * full-text search) and NOT `@savant-code/database` (session/domain CRUD).
 *
 * `bun:sqlite` is Bun-only, so the Database constructor is resolved lazily at
 * call time (type-only import + `require`), mirroring packages/database and
 * packages/knowledge-graph — importing this module must stay loadable under
 * Node.js.
 */

export type DocsetEntry = {
  title: string
  url?: string
  content: string
}

export type DocsetHit = {
  title?: string
  link?: string
  snippet?: string
}

/** The module-scope `require` when it exists; `undefined` under Node ESM. */
function getRuntimeRequire(): ((id: string) => unknown) | undefined {
  return typeof require === 'function' ? require : undefined
}

/**
 * Resolve the bun:sqlite Database constructor, or throw a clear error outside
 * Bun. `requireFn` is injectable for tests; pass `null` to simulate Node ESM.
 */
export function resolveBunSqlite(
  requireFn: ((id: string) => unknown) | null | undefined = getRuntimeRequire(),
): { Database: typeof Database } {
  if (typeof requireFn !== 'function') {
    throw new Error(
      'Docset search requires the Bun runtime: bun:sqlite is only available under Bun.',
    )
  }
  try {
    return requireFn('bun:sqlite') as { Database: typeof Database }
  } catch (error) {
    throw new Error(
      `Docset search requires the Bun runtime: failed to load bun:sqlite (${
        error instanceof Error ? error.message : String(error)
      }).`,
    )
  }
}

/**
 * Build (or replace) a docset SQLite file from entries. Returns the number of
 * entries written. Rebuilds are idempotent: prior docset tables are dropped
 * and recreated in place (never `rmSync` + recreate — deleting a just-closed
 * SQLite file is unreliable on Windows where the handle releases late).
 */
export function buildDocset(options: {
  dbPath: string
  entries: DocsetEntry[]
  requireFn?: ((id: string) => unknown) | null | undefined
}): number {
  const { dbPath, entries, requireFn } = options
  const { Database } = resolveBunSqlite(requireFn)

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  try {
    // Drop any prior tables so a rebuild never carries stale rows.
    db.exec('DROP TABLE IF EXISTS docs_fts; DROP TABLE IF EXISTS docs;')
    db.exec(DOCSET_SCHEMA)
    const insert = db.prepare(
      'INSERT INTO docs (title, url, content) VALUES (?, ?, ?)',
    )
    ;(db as TransactionCapable).transaction(() => {
      for (const entry of entries) {
        insert.run(entry.title, entry.url ?? null, entry.content)
      }
    })()
    // Build the external-content FTS5 index once over the bulk insert.
    db.exec("INSERT INTO docs_fts(docs_fts) VALUES('rebuild')")
    return entries.length
  } finally {
    db.close()
  }
}

/**
 * Query a docset SQLite file and return ranked hits with FTS5 snippets.
 * Returns [] (never throws) on a missing/malformed database, an unbuildable
 * MATCH expression, or zero matches — the caller degrades gracefully.
 */
export function queryDocset(options: {
  dbPath: string
  query: string
  limit?: number
  requireFn?: ((id: string) => unknown) | null | undefined
}): DocsetHit[] {
  const { dbPath, query, limit = 5, requireFn } = options
  const match = buildMatchExpression(query)
  if (!match) return []

  const { Database } = resolveBunSqlite(requireFn)
  let db: Database
  try {
    db = new Database(dbPath, { readonly: true })
  } catch {
    return []
  }

  try {
    const rows = db
      .query(
        `SELECT d.title AS title,
                d.url AS url,
                snippet(docs_fts, 1, '…', '…', '…', 16) AS snippet,
                bm25(docs_fts) AS rank
         FROM docs_fts
         JOIN docs d ON d.id = docs_fts.rowid
         WHERE docs_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(match, limit) as Array<{
      title: string | null
      url: string | null
      snippet: string | null
    }>

    return rows.map((row) => ({
      title: row.title ?? undefined,
      link: row.url ?? undefined,
      snippet: row.snippet ?? undefined,
    }))
  } catch {
    return []
  } finally {
    db.close()
  }
}

/**
 * Read every entry (title, url, content) from a docset. Used to merge new
 * discovered docs into an existing cache without losing prior entries. Returns
 * [] on a missing/malformed database.
 */
export function readDocsetEntries(options: {
  dbPath: string
  requireFn?: ((id: string) => unknown) | null | undefined
}): DocsetEntry[] {
  const { dbPath, requireFn } = options
  const { Database } = resolveBunSqlite(requireFn)
  let db: Database
  try {
    db = new Database(dbPath, { readonly: true })
  } catch {
    return []
  }

  try {
    const rows = db
      .query('SELECT title, url, content FROM docs')
      .all() as Array<{ title: string; url: string | null; content: string }>
    return rows.map((row) => ({
      title: row.title,
      url: row.url ?? undefined,
      content: row.content,
    }))
  } catch {
    return []
  } finally {
    db.close()
  }
}

/**
 * Upsert metadata key/value pairs into a docset (freshness `fetched_at` and
 * the detected `version`). Best-effort: a missing/unwritable database is
 * swallowed so a metadata write never fails the enclosing read.
 */
export function setDocsetMeta(options: {
  dbPath: string
  meta: Record<string, string>
  requireFn?: ((id: string) => unknown) | null | undefined
}): void {
  const { dbPath, meta, requireFn } = options
  const { Database } = resolveBunSqlite(requireFn)
  let db: Database
  try {
    db = new Database(dbPath)
  } catch {
    return
  }

  try {
    const upsert = db.prepare(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    )
    ;(db as TransactionCapable).transaction(() => {
      for (const [key, value] of Object.entries(meta)) {
        upsert.run(key, value)
      }
    })()
  } catch {
    // Best-effort metadata write.
  } finally {
    db.close()
  }
}

/** Read all metadata key/value pairs from a docset ({} on missing/empty). */
export function readDocsetMeta(options: {
  dbPath: string
  requireFn?: ((id: string) => unknown) | null | undefined
}): Record<string, string> {
  const { dbPath, requireFn } = options
  const { Database } = resolveBunSqlite(requireFn)
  let db: Database
  try {
    db = new Database(dbPath, { readonly: true })
  } catch {
    return {}
  }

  try {
    const rows = db.query('SELECT key, value FROM meta').all() as Array<{
      key: string
      value: string
    }>
    const out: Record<string, string> = {}
    for (const row of rows) out[row.key] = row.value
    return out
  } catch {
    return {}
  } finally {
    db.close()
  }
}
