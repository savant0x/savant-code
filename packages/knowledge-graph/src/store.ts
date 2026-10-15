import fs from 'fs'
import path from 'path'

import {
  getRuntimeRequire,
  resolveBunSqliteModule,
} from '@savant-code/common/util/bun-sqlite'

import { applyGraphSchema } from './schema'

import type { Database } from 'bun:sqlite'

/**
 * Graph database store. Follows packages/database conventions: bun:sqlite is
 * Bun-only so the constructor is resolved lazily (through
 * @savant-code/common/util/bun-sqlite, the canonical loader — FID-2026-1013-011
 * W2-6; packages/database keeps its own copy because it is a zero-dependency
 * package), the
 * connection enables WAL + foreign keys, and the schema is applied on open.
 *
 * The graph database is a distinct file (`.savant/graph.db` under the project
 * root) from the session database — different domain, different write cadence
 * (FID-2026-0806-002 Phase 1). The path can be overridden via
 * SAVANT_CODE_GRAPH_DB_PATH (used by tests / CI).
 */

/**
 * Resolve the bun:sqlite Database constructor, or throw a clear error when
 * the runtime cannot provide it. `requireFn` is injectable for tests.
 *
 * FID-2026-1013-011 W2-6: the loader itself is canonical in
 * `@savant-code/common/util/bun-sqlite`; this wrapper supplies the package's
 * own error wording and preserves the exported name and signature.
 */
export function resolveBunSqliteDatabaseModule(
  requireFn: ((id: string) => unknown) | null | undefined = getRuntimeRequire(),
): { Database: typeof Database } {
  return resolveBunSqliteModule({
    requireFn,
    subject: 'The knowledge-graph package requires the Bun runtime',
  })
}

/** Resolve the graph database path for a project root. */
export function getGraphDbPath(projectRoot: string): string {
  const override = process.env.SAVANT_CODE_GRAPH_DB_PATH
  if (override && override !== '') {
    return override
  }
  return path.join(projectRoot, '.savant', 'graph.db')
}

/**
 * Open (and initialize) the graph database for a project root. Unlike the
 * session database, a graph DB open failure is surfaced to the caller rather
 * than silently failing open to memory: the graph is an on-demand index, and a
 * silently-empty graph would be indistinguishable from a stale index.
 */
export function openGraphDatabase(projectRoot: string): Database {
  const dbPath = getGraphDbPath(projectRoot)
  const DatabaseCtor = resolveBunSqliteDatabaseModule().Database
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new DatabaseCtor(dbPath)
  applyGraphSchema(db)
  return db
}

/**
 * Returns true when a graph database file already exists on disk for the
 * project root. Used to decide whether an incremental update is cheap enough
 * to run opportunistically (e.g. post-write) without forcing a full build.
 */
export function graphDatabaseExists(projectRoot: string): boolean {
  const override = process.env.SAVANT_CODE_GRAPH_DB_PATH
  if (override && override !== '') {
    return override === ':memory:' || fs.existsSync(override)
  }
  return fs.existsSync(path.join(projectRoot, '.savant', 'graph.db'))
}

const graphOperationTails = new Map<string, Promise<void>>()

/**
 * Serialize in-process graph refresh/export operations for one project. SQLite
 * remains the source of truth for external processes; this lock prevents the
 * CLI's `/graph refresh` and `/graph-export` handlers from opening concurrent
 * write/read snapshots of the same database.
 */
export async function withGraphOperationLock<T>(
  projectRoot: string,
  operation: () => Promise<T>,
): Promise<T> {
  const configuredPath = getGraphDbPath(projectRoot)
  const key =
    configuredPath === ':memory:'
      ? configuredPath
      : path.resolve(configuredPath)
  const previous = graphOperationTails.get(key) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.then(() => current)
  graphOperationTails.set(key, queued)
  await previous
  try {
    return await operation()
  } finally {
    release()
    if (graphOperationTails.get(key) === queued) graphOperationTails.delete(key)
  }
}

/** Test isolation: clears the in-process operation lock tails that no
 *  in-flight operation is holding — process-lifetime state `bun test` shares
 *  across files (FID-2026-1007-002). */
export function resetGraphOperationTails(): void {
  graphOperationTails.clear()
}
