import { assignClustersToNodes, computeClusters } from './clusters'
import { buildEdgesFromTokens, loadTokensByFile } from './edges-from-tokens'
import {
  extractExtendsRelations,
  extractRelativeImportSpecifiers,
} from './extract'
import { defaultFileHasher } from './hasher'
import { NODE_TYPES } from './types'
import {
  DEFAULT_MAX_FILE_BYTES,
  defaultParseFile,
  nodeFsAdapter,
  scanIndexState,
} from './update-scan'

import type { FileHasher } from './hasher'
import type { IndexStats, ParseFileFn } from './types'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { Database } from 'bun:sqlite'

/**
 * Codebase knowledge-graph indexer (FID-2026-0806-002 Phase 1).
 *
 * In-process, incremental, deterministic:
 * 1. Enumerate project files honoring ignore rules (project-file-tree).
 * 2. Stat-prefilter + hash-compare against the `files` table — only new or
 *    changed files are read, hashed, or parsed (FID-2026-1002-006).
 * 3. Delete rows for files no longer on disk (FK cascade prunes nodes/edges).
 * 4. Re-parse only changed/new files via code-map (`parseFile`), building
 *    symbol nodes, and persist their import/extend tokens.
 * 5. Rebuild the corpus edge set (CALLS/IMPORTS/EXTENDS) ENTIRELY from
 *    persisted per-file tokens, resolving against the current index state —
 *    no source reads for unchanged files (FID-2026-1002-006).
 * 6. Run the Louvain pass and write cluster ids back to nodes.
 *
 * The parse function is injectable so tests can stub tree-sitter; the default
 * uses code-map's tree-sitter layer. Token extraction (imports/extends) uses
 * the same regex extractors as before — only the delivery mechanism for
 * unchanged files moved from re-read + re-regex to persisted rows.
 *
 * Steps 1–4 live in `update-scan.ts` (`scanIndexState`); the DB-write phases
 * (upsert, tokens, edges, clustering) remain here (FID-2026-0819-005 Loop
 * 127).
 */

export interface UpdateGraphParams {
  projectRoot: string
  db: Database
  fs?: SavantCodeFileSystem
  hasher?: FileHasher
  /** Injectable parse fn (defaults to code-map). */
  parseFile?: ParseFileFn
  /** Size cap for a single file (bytes). Default 1MB — matches code-map. */
  maxFileBytes?: number
}

/** True when the database predates the v2 stat columns (legacy row set). */
export function needsStatBackfill(db: Database): boolean {
  const rows = db
    .query('SELECT COUNT(*) AS c, SUM(mtime_ms IS NULL) AS nulls FROM files')
    .get() as { c: number; nulls: number | null }
  return rows.c > 0 && rows.nulls === rows.c
}

/**
 * Run an incremental update pass over the project.
 *
 * When `fullRebuild` is true (used by `/graph refresh --full` and by the first
 * pass on an empty database), every file is treated as changed. A legacy v1
 * database (rows with no stat baseline) backfills with one full pass
 * automatically so the token tables populate.
 */
export async function updateKnowledgeGraph(
  params: UpdateGraphParams & { fullRebuild?: boolean },
): Promise<IndexStats> {
  const {
    projectRoot,
    db,
    fs: injectedFs,
    hasher = defaultFileHasher,
    parseFile = defaultParseFile,
    maxFileBytes = DEFAULT_MAX_FILE_BYTES,
    fullRebuild = false,
  } = params

  const start = Date.now()
  const fsImpl = injectedFs ?? nodeFsAdapter

  // FID-2026-1002-006: a legacy v1 row set (no stat baseline) cannot use the
  // stat pre-filter and must populate the token tables — force one full pass.
  const effectiveFullRebuild = fullRebuild || needsStatBackfill(db)

  // Scan phase: enumerate, stale-delete, stat-prefiltered read + hash-compare,
  // parse (steps 1–4). Only changed/new files are read or parsed.
  const scan = await scanIndexState({
    projectRoot,
    db,
    fsImpl,
    hasher,
    parseFile,
    maxFileBytes,
    fullRebuild: effectiveFullRebuild,
  })
  const { stats } = scan

  db.transaction(() => {
    const version = (db.query('PRAGMA data_version').get() as { data_version: number }).data_version
    const rows = db.query('SELECT id, path, hash, mtime_ms, bytes FROM files').all() as Array<{
      id: number; path: string; hash: string; mtime_ms: number | null; bytes: number | null
    }>
    if (version !== scan.baselineVersion || rows.length !== scan.existingByPath.size ||
        rows.some((row) => {
          const old = scan.existingByPath.get(row.path)
          return !old || old.id !== row.id || old.hash !== row.hash ||
            old.mtimeMs !== row.mtime_ms || old.bytes !== row.bytes
        })) throw new Error('Graph changed during scan; retry refresh')
    const remove = db.prepare('DELETE FROM files WHERE path = ?')
    for (const stale of scan.stalePaths) remove.run(stale)
    upsertChangedFiles({ db, scan })
    if (scan.wasFullRebuild || scan.changedPaths.length > 0 || scan.stalePaths.length > 0) {
      rebuildEdges({ db })
      assignClustersToNodes({ db, assignments: computeClusters({ db }) })
    }
  }).immediate()

  stats.nodeCount = (
    db.query('SELECT COUNT(*) AS c FROM nodes').get() as { c: number }
  ).c
  stats.edgeCount = (
    db.query('SELECT COUNT(*) AS c FROM edges').get() as { c: number }
  ).c
  // clusterCount must be the number of DISTINCT Louvain communities, not the
  // number of assigned files — `clusterAssignments.size` is the file count
  // (every file maps to exactly one cluster id), which grossly overstates the
  // domain count on real repos (e.g. 1975 reported vs 412 actual).
  stats.clusterCount = (
    db
      .query(
        'SELECT COUNT(DISTINCT cluster_id) AS c FROM nodes WHERE cluster_id IS NOT NULL',
      )
      .get() as { c: number }
  ).c
  stats.durationMs = Date.now() - start

  return stats
}

/**
 * Step 4b: upsert file rows (with the v2 stat baseline) + nodes + call/
 * import/extend tokens for every changed/new file. Prune the old subtree
 * first (single DELETE; FK cascade removes stale
 * nodes/edges/file_calls/file_imports/file_extends).
 */
function upsertChangedFiles(params: {
  db: Database
  scan: Awaited<ReturnType<typeof scanIndexState>>
}): void {
  const { db, scan } = params
  const { filePaths, sources, hashByPath, parsedFiles, existingByPath } = scan
  const effectiveFullRebuild = scan.wasFullRebuild

  const pruneStmt = db.prepare('DELETE FROM files WHERE path = ?')
  const insertFileStmt = db.prepare(
    'INSERT INTO files (path, hash, mtime_ms, bytes) VALUES (?, ?, ?, ?)',
  )
  const insertNodeStmt = db.prepare(
    'INSERT INTO nodes (file_id, type, name) VALUES (?, ?, ?)',
  )
  const insertCallStmt = db.prepare(
    'INSERT INTO file_calls (file_id, token) VALUES (?, ?)',
  )
  const insertImportStmt = db.prepare(
    'INSERT INTO file_imports (file_id, token) VALUES (?, ?)',
  )
  const insertExtendsStmt = db.prepare(
    'INSERT INTO file_extends (file_id, parent) VALUES (?, ?)',
  )

  const updateStat = db.prepare('UPDATE files SET mtime_ms = ?, bytes = ? WHERE id = ?')
  for (const filePath of filePaths) {
      const source = sources.get(filePath)
      if (source === undefined) continue
      const existing = existingByPath.get(filePath)
      // FID-2026-0815-009 (F-12): reuse the scan-loop hash (no re-hash).
      const hash = hashByPath.get(filePath) as string
      if (!effectiveFullRebuild && existing && existing.hash === hash) {
        const stat = scan.statByPath.get(filePath)
        if (stat && (stat.mtimeMs !== existing.mtimeMs || stat.size !== existing.bytes)) {
          updateStat.run(stat.mtimeMs, stat.size, existing.id)
        }
        continue // unchanged content: preserve ids/nodes/derived state
      }

      pruneStmt.run(filePath)
      const stat = scan.statByPath.get(filePath)
      const insertResult = insertFileStmt.run(
        filePath,
        hash,
        stat?.mtimeMs ?? null,
        stat?.size ?? null,
      ) as { lastInsertRowid: number }
      const fileId = Number(insertResult.lastInsertRowid)

      const parsed = parsedFiles.get(filePath)
      if (parsed) {
        for (const identifier of parsed.identifiers) {
          insertNodeStmt.run(fileId, NODE_TYPES.SYMBOL, identifier)
        }
        for (const call of parsed.calls) {
          insertCallStmt.run(fileId, call)
        }
      }
      // FID-2026-1002-006: persist the import/extend tokens for every
      // changed file — the raw-source extractors run ONCE per content
      // change, never again until the content changes.
      for (const token of extractRelativeImportSpecifiers(source)) {
        insertImportStmt.run(fileId, token)
      }
      for (const { parent } of extractExtendsRelations(source)) {
        insertExtendsStmt.run(fileId, parent)
      }
      // Anchor node so files with no symbols still appear in node queries.
      insertNodeStmt.run(fileId, NODE_TYPES.FILE, filePath)
  }
}

/**
 * Step 5: rebuild the full corpus edge set ENTIRELY from persisted tokens +
 * DB-resident knowledge (FID-2026-1002-006): no source reads.
 */
function rebuildEdges({ db }: { db: Database }): void {
  const fileRows = db.query('SELECT id, path FROM files').all() as Array<{
    id: number
    path: string
  }>
  const idByPath = new Map(fileRows.map((r) => [r.path, r.id]))
  const currentFilePaths = new Set(fileRows.map((r) => r.path))

  // Symbol index from DB (covers files parsed in previous passes too).
  const pathById = new Map(fileRows.map((r) => [r.id, r.path]))
  const nodeRows = db
    .query('SELECT file_id, name FROM nodes WHERE type = ?')
    .all(NODE_TYPES.SYMBOL) as Array<{ file_id: number; name: string }>
  const dbSymbolIndex = new Map<string, string[]>()
  for (const row of nodeRows) {
    const filePath = pathById.get(row.file_id)
    if (!filePath) continue
    const list = dbSymbolIndex.get(row.name) ?? []
    if (!list.includes(filePath)) list.push(filePath)
    dbSymbolIndex.set(row.name, list)
  }
  // FID-2026-0815-009 (F-12): pre-sort each symbol's candidate list (shortest
  // path, then lexicographic) so resolveSymbolDefiningFile is an O(1) pick.
  for (const list of dbSymbolIndex.values()) {
    list.sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
  }

  // Per-file structure tokens from DB — the incremental invariant now covers
  // ALL THREE edge layers (FID-2026-1002-006).
  const edges = buildEdgesFromTokens({
    callsByFile: loadTokensByFile(db, 'file_calls', 'token', pathById),
    importsByFile: loadTokensByFile(db, 'file_imports', 'token', pathById),
    extendsByFile: loadTokensByFile(db, 'file_extends', 'parent', pathById),
    filePaths: currentFilePaths,
    symbolIndex: dbSymbolIndex,
  })

  // Clear + rewrite edges (deterministic full rebuild of the edge layer).
  db.exec('DELETE FROM edges')
  const insertEdgeStmt = db.prepare(
    'INSERT INTO edges (source_id, target_id, type, weight) VALUES (?, ?, ?, ?)',
  )
  for (const [key, entry] of edges) {
      const [source, target] = key.split('\u0000')
      const sourceId = idByPath.get(source)
      const targetId = idByPath.get(target)
      if (sourceId === undefined || targetId === undefined) continue
      insertEdgeStmt.run(sourceId, targetId, entry.type, entry.weight)
  }
}

/**
 * Lightweight synonym for updateKnowledgeGraph used by callers that want the
 * "refresh" verb (keeps the API self-documenting).
 */
export function refreshKnowledgeGraph(
  params: UpdateGraphParams,
): Promise<IndexStats> {
  return updateKnowledgeGraph(params)
}
