/** FID-2026-1017-007: per-process environment and WAL-aware graph snapshots. */
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import '@savant-code/code-map/types'
import { applyGraphSchema } from '@savant-code/knowledge-graph/schema'
import { resolveBunSqliteDatabaseModule } from '@savant-code/knowledge-graph/store'

import type { FidWorktreeRecord } from './fid-worktree-record'

const DEFAULT_PORT = 3000
const PORT_STRIDE = 100
const MAX_PORT = 65535

/** No process.env mutation; database credentials stay in the child environment. */
export function buildFidWorktreeEnvironment(
  record: FidWorktreeRecord,
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const index = record.worktreeIndex
  if (!index || index < 1 || !Number.isSafeInteger(index))
    throw new Error('Lane has no stable execution slot')
  const basePort =
    source.PORT === undefined ? DEFAULT_PORT : Number(source.PORT)
  const port = basePort + index * PORT_STRIDE
  if (!Number.isInteger(basePort) || basePort < 1 || port > MAX_PORT) {
    throw new Error('PORT cannot be offset into the valid TCP port range')
  }
  const environment: Record<string, string> = {
    SAVANT_WORKTREE_ROOT: path.resolve(record.path),
    WORKTREE_INDEX: String(index),
    PORT: String(port),
    COMPOSE_PROJECT_NAME: `${(source.COMPOSE_PROJECT_NAME ?? 'savant').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}_wt${index}`,
    SAVANT_CODE_GRAPH_DB_PATH: path.join(record.path, '.savant', 'graph.db'),
  }
  if (source.DATABASE_URL) {
    let database: URL
    try {
      database = new URL(source.DATABASE_URL)
    } catch {
      throw new Error('DATABASE_URL cannot be isolated: unsupported URL')
    }
    if (
      [...database.searchParams.keys()].some((key) =>
        ['database', 'dbname', 'db'].includes(key.toLowerCase()),
      )
    ) {
      throw new Error(
        'DATABASE_URL cannot be isolated: query overrides the database name',
      )
    }
    if (database.protocol === 'file:') {
      environment.DATABASE_URL = pathToFileURL(
        path.join(record.path, '.savant', 'runtime.db'),
      ).href
    } else if (
      ['postgres:', 'postgresql:', 'mysql:'].includes(database.protocol) &&
      database.pathname.length > 1
    ) {
      database.pathname += `_wt${index}`
      environment.DATABASE_URL = database.href
    } else {
      throw new Error(
        'DATABASE_URL cannot be isolated: unsupported database scheme or missing database name',
      )
    }
  }
  return environment
}

/** Include committed WAL pages; copying just graph.db would lose live rows. */
export function snapshotFidWorktreeGraph(
  repoRoot: string,
  record: FidWorktreeRecord,
): void {
  const source = path.join(repoRoot, '.savant', 'graph.db')
  if (!existsSync(source)) return
  const destination = path.join(record.path, '.savant', 'graph.db')
  const { Database } = resolveBunSqliteDatabaseModule()
  const db = new Database(source, { readonly: true })
  try {
    mkdirSync(path.dirname(destination), { recursive: true })
    const snapshot = db.prepare('VACUUM INTO ?')
    try {
      snapshot.run(destination)
    } finally {
      snapshot.finalize()
    }
  } finally {
    db.close(true)
  }
}

/** Called only after ff-only has landed. A failure is a post-merge warning. */
export async function refreshMergedFidGraph(repoRoot: string): Promise<void> {
  const graphPath = path.join(repoRoot, '.savant', 'graph.db')
  if (!existsSync(graphPath)) return
  const { Database } = resolveBunSqliteDatabaseModule()
  const db = new Database(graphPath)
  try {
    applyGraphSchema(db)
    // Loading the tool registry must not initialize the indexing/parser stack.
    const { updateKnowledgeGraph } =
      await import('@savant-code/knowledge-graph/update')
    await updateKnowledgeGraph({ projectRoot: repoRoot, db })
  } finally {
    db.close()
  }
}
