import fs from 'fs'
import path from 'path'

import {
  getAllFilePaths,
  getProjectFileTree,
} from '@savant-code/common/project-file-tree'

import { planChanges, statAll } from './index-path-plan'

import type { FileHasher } from './hasher'
import type { ExistingRow, PlannedChanges } from './index-path-plan'
import type { IndexStats, ParseFileFn } from './types'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { FileTreeNode } from '@savant-code/common/util/file'
import type { Database } from 'bun:sqlite'

export const DEFAULT_MAX_FILE_BYTES = 1_000_000

/** Default parse fn backed by code-map's tree-sitter layer. */
export const defaultParseFile: ParseFileFn = async (_filePath, fullPath, source) => {
  try {
    const { getLanguageConfig } =
      await import('@savant-code/code-map/languages')
    const { parseTokens } = await import('@savant-code/code-map/parse')
    const languageConfig = await getLanguageConfig(fullPath)
    if (!languageConfig) return null
    const parsed = parseTokens(fullPath, languageConfig,
      source === undefined ? undefined : () => source)
    return { identifiers: parsed.identifiers, calls: parsed.calls }
  } catch {
    // Parsing is best-effort: graph assembly (imports/extends) still works.
    return null
  }
}

/** The node:fs adapter used when no `fs` is injected. */
export const nodeFsAdapter: SavantCodeFileSystem = fs.promises

/** FID-2026-0815-009 (F-12): bounded fan-out for the source reads + parses. */
export const PARSE_CONCURRENCY = 6

/**
 * Runs `fn` over `items` with bounded concurrency, preserving result order.
 * The cursor increment is atomic on the single-threaded event loop, so each
 * item is processed exactly once.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index]!, index)
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export type IndexScanState = {
  filePaths: string[]
  stalePaths: string[]
  baselineVersion: number
  /** FID-2026-1002-006: only NEW or CHANGED files' content is materialized;
   *  unchanged-baseline files are never read. */
  sources: Map<string, string>
  hashByPath: Map<string, string>
  changedPaths: string[]
  parsedFiles: Map<string, { identifiers: string[]; calls: string[] }>
  existingByPath: Map<string, ExistingRow>
  /** True when the DB predates the v2 stat columns (legacy row set) — the
   *  caller must backfill with one full pass. */
  needsBackfill: boolean
  /** Live stat per enumerated path (the v2 read-skip baseline input). */
  statByPath: Map<string, { mtimeMs: number; size: number }>
  /** The `fullRebuild` flag the scan actually ran under (the caller may
   *  force it for a legacy backfill). */
  wasFullRebuild: boolean
  stats: IndexStats
}

/**
 * Scan phase of the incremental update pass (steps 1–4): enumerate the
 * project, delete rows for files no longer on disk, decide the changed set
 * with a stat pre-filter + sha256 truth (FID-2026-1002-006), and re-parse
 * changed/new files only. The DB-write phases (upsert, tokens, edges,
 * clustering) live in the parent `updateKnowledgeGraph`.
 */
export async function scanIndexState(params: {
  projectRoot: string
  db: Database
  fsImpl: SavantCodeFileSystem
  hasher: FileHasher
  parseFile: ParseFileFn
  maxFileBytes: number
  fullRebuild: boolean
}): Promise<IndexScanState> {
  const {
    projectRoot,
    db,
    fsImpl,
    hasher,
    parseFile,
    maxFileBytes,
    fullRebuild,
  } = params

  const baselineVersion = (db.query('PRAGMA data_version').get() as { data_version: number }).data_version
  let complete = false
  // 1. Enumerate the project (ignore rules honored). The graph's own home
  // (.savant/) is always excluded — the DB must never index itself, and the
  // FID hygiene requirement keeps it out of the repository too.
  const fileTree: FileTreeNode[] = await getProjectFileTree({
    projectRoot,
    fs: fsImpl,
    onScanComplete: (value) => { complete = value },
  })
  if (!complete) throw new Error('Graph refresh requires complete project enumeration')
  // Paths are normalized to forward slashes for storage and querying:
  // getProjectFileTree returns platform-native separators (backslashes on
  // Windows), but every resolver/query in this package speaks posix — and the
  // CLI tool API surface is forward-slash by convention. Normalizing here
  // keeps `files.path` and every query key in one canonical form.
  const filePaths = getAllFilePaths(fileTree)
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => !p.startsWith('.savant/'))
  const filePathSet = new Set(filePaths)

  // 2. Load the existing index state — including the v2 stat baseline
  // (mtimeMs + bytes) that decides which files can skip their content read
  // entirely (FID-2026-1002-006).
  const existingRows = db
    .query('SELECT id, path, hash, mtime_ms, bytes FROM files')
    .all() as Array<{
    id: number
    path: string
    hash: string
    mtime_ms: number | null
    bytes: number | null
  }>
  const existingByPath = new Map(
    existingRows.map((r) => [
      r.path,
      {
        id: r.id,
        path: r.path,
        hash: r.hash,
        mtimeMs: r.mtime_ms,
        bytes: r.bytes,
      },
    ]),
  )
  // A legacy v1 row set has NULL stat values — no baseline to compare
  // against, so every indexed file must be re-read once (backfill).
  const needsBackfill =
    existingRows.length > 0 && existingRows.every((r) => r.mtime_ms == null)

  const stats: IndexStats = {
    filesOnDisk: filePaths.length,
    filesAdded: 0,
    filesModified: 0,
    filesDeleted: 0,
    filesUnchanged: 0,
    nodeCount: 0,
    edgeCount: 0,
    clusterCount: 0,
    durationMs: 0,
  }

  // 3. Delete files no longer on disk (cascade prunes nodes/edges/tokens).
  const stalePaths = existingRows
    .filter((row) => !filePathSet.has(row.path))
    .map((row) => row.path)
  stats.filesDeleted = stalePaths.length

  // 4. Stat pre-filter, bounded reads, and the deterministic change walk
  // (planning logic lives in index-path-plan.ts, FID-2026-1002-006).
  const statByPath = await statAll(
    filePaths,
    projectRoot,
    fsImpl,
    PARSE_CONCURRENCY,
  )

  if (statByPath.size !== filePaths.length) throw new Error('Graph source stat failed; retry refresh')
  const readSource = async (filePath: string): Promise<string | null> => {
    const fullPath = path.join(projectRoot, filePath)
    try {
      const st = await fsImpl.stat(fullPath)
      const size = typeof st.size === 'number' ? st.size : 0
      if (size > maxFileBytes) return null
      const source = await fsImpl.readFile(fullPath, 'utf8')
      const after = await fsImpl.stat(fullPath)
      const baseline = statByPath.get(filePath)
      if (!baseline || st.size !== baseline.size || st.mtimeMs !== baseline.mtimeMs ||
          after.size !== st.size || after.mtimeMs !== st.mtimeMs ||
          Buffer.byteLength(source, 'utf8') > maxFileBytes) {
        throw new Error('Graph source changed while being read')
      }
      return source
    } catch {
      throw new Error('Graph source could not be read consistently; retry refresh')
    }
  }

  const sources = new Map<string, string>()
  const hashByPath = new Map<string, string>()
  const plan: PlannedChanges = planChanges({
    filePaths,
    existingByPath,
    statByPath,
    hashByPath,
    sources,
    fullRebuild,
    legacyRowSet: needsBackfill,
  })

  // Bounded content reads for ONLY the planned read targets.
  await mapWithConcurrency(
    plan.readTargets,
    PARSE_CONCURRENCY,
    async (filePath) => {
      const source = await readSource(filePath)
      if (source === null) return
      sources.set(filePath, source)
      hashByPath.set(filePath, hasher.hash(source))
    },
  )

  // Re-plan with the actual read results (read failures drop out; the
  // changed-set walk and stats derive from real content evidence).
  const finalPlan = planChanges({
    filePaths,
    existingByPath,
    statByPath,
    hashByPath,
    sources,
    fullRebuild,
    legacyRowSet: needsBackfill,
  })

  const parsedFiles = new Map<
    string,
    { identifiers: string[]; calls: string[] }
  >()
  await mapWithConcurrency(
    finalPlan.changedPaths,
    PARSE_CONCURRENCY,
    async (filePath) => {
      const parsed = await parseFile(filePath, path.join(projectRoot, filePath), sources.get(filePath))
      if (parsed) {
        parsedFiles.set(filePath, parsed)
      }
    },
  )

  return {
    filePaths,
    stalePaths,
    baselineVersion,
    sources,
    hashByPath,
    changedPaths: finalPlan.changedPaths,
    parsedFiles,
    existingByPath,
    needsBackfill,
    statByPath,
    wasFullRebuild: fullRebuild,
    stats: {
      ...stats,
      ...finalPlan.statusCounts,
    },
  }
}
