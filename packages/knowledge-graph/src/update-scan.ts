import fs from 'fs'
import path from 'path'

import {
  getAllFilePaths,
  getProjectFileTree,
} from '@savant-code/common/project-file-tree'

import type { FileHasher } from './hasher'
import type { IndexStats, ParseFileFn } from './types'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { FileTreeNode } from '@savant-code/common/util/file'
import type { Database } from 'bun:sqlite'

export const DEFAULT_MAX_FILE_BYTES = 1_000_000

/** Default parse fn backed by code-map's tree-sitter layer. */
export const defaultParseFile: ParseFileFn = async (filePath, fullPath) => {
  try {
    const { getLanguageConfig } =
      await import('@savant-code/code-map/languages')
    const { parseTokens } = await import('@savant-code/code-map/parse')
    const languageConfig = await getLanguageConfig(fullPath)
    if (!languageConfig) return null
    const readFile = (p: string): string | null => {
      try {
        return fs.readFileSync(p, 'utf8')
      } catch {
        return null
      }
    }
    const parsed = parseTokens(filePath, languageConfig, readFile)
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
      results[index] = await fn(items[index], index)
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export type IndexScanState = {
  filePaths: string[]
  sources: Map<string, string>
  hashByPath: Map<string, string>
  changedPaths: string[]
  parsedFiles: Map<string, { identifiers: string[]; calls: string[] }>
  existingByPath: Map<string, { id: number; path: string; hash: string }>
  stats: IndexStats
}

/**
 * Scan phase of the incremental update pass (steps 1–4): enumerate the
 * project, delete rows for files no longer on disk, hash-compare against the
 * existing index, and re-parse changed/new files. The DB-write phases (upsert,
 * edges, clustering) live in the parent `updateKnowledgeGraph`.
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

  // 1. Enumerate the project (ignore rules honored). The graph's own home
  // (.savant/) is always excluded — the DB must never index itself, and the
  // FID hygiene requirement keeps it out of the repository too.
  const fileTree: FileTreeNode[] = await getProjectFileTree({
    projectRoot,
    fs: fsImpl,
  })
  // Paths are normalized to forward slashes for storage and querying:
  // getProjectFileTree returns platform-native separators (backslashes on
  // Windows), but every resolver/query in this package speaks posix — and the
  // CLI tool API surface is forward-slash by convention. Normalizing here
  // keeps `files.path` and every query key in one canonical form.
  const filePaths = getAllFilePaths(fileTree)
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => !p.startsWith('.savant/'))
  const filePathSet = new Set(filePaths)

  // 2. Load the existing index state.
  const existingRows = db
    .query('SELECT id, path, hash FROM files')
    .all() as Array<{ id: number; path: string; hash: string }>
  const existingByPath = new Map(existingRows.map((r) => [r.path, r]))

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

  // 3. Delete files no longer on disk (cascade prunes nodes/edges).
  const stalePaths = existingRows
    .filter((row) => !filePathSet.has(row.path))
    .map((row) => row.path)
  if (stalePaths.length > 0) {
    const deleteStmt = db.prepare('DELETE FROM files WHERE path = ?')
    db.exec('BEGIN')
    try {
      for (const p of stalePaths) {
        deleteStmt.run(p)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    stats.filesDeleted = stalePaths.length
  }

  // 4. Hash-compare + parse changed/new files.
  const parsedFiles = new Map<
    string,
    { identifiers: string[]; calls: string[] }
  >()
  const sources = new Map<string, string>()

  const readSource = async (fullPath: string): Promise<string | null> => {
    try {
      const st = await fsImpl.stat(fullPath)
      const size = typeof st.size === 'number' ? st.size : 0
      if (size > maxFileBytes) return null
      return await fsImpl.readFile(fullPath, 'utf8')
    } catch {
      return null
    }
  }

  // FID-2026-0815-009 (F-12): parallelize the source reads (I/O) over a
  // bounded pool. `sources`/`hashByPath` are lookup-only Maps, so their
  // insertion order is irrelevant to determinism.
  const hashByPath = new Map<string, string>()
  await mapWithConcurrency(filePaths, PARSE_CONCURRENCY, async (filePath) => {
    const source = await readSource(path.join(projectRoot, filePath))
    if (source === null) return
    sources.set(filePath, source)
    hashByPath.set(filePath, hasher.hash(source))
  })

  // Ordered walk determines the changed/new set + stats (deterministic).
  const changedPaths: string[] = []
  for (const filePath of filePaths) {
    const source = sources.get(filePath)
    if (source === undefined) continue
    const hash = hashByPath.get(filePath) as string
    const existing = existingByPath.get(filePath)

    // Unchanged (and not forcing a full rebuild) → skip entirely.
    if (!fullRebuild && existing && existing.hash === hash) {
      stats.filesUnchanged++
      continue
    }

    changedPaths.push(filePath)

    if (existing && existing.hash === hash) {
      // Only reachable under fullRebuild — count as reindexed.
      stats.filesModified++
    } else if (existing) {
      stats.filesModified++
    } else {
      stats.filesAdded++
    }
  }

  // FID-2026-0815-009 (F-12): parse the changed/new files (best-effort) over
  // the bounded pool. `parsedFiles` is a lookup-only Map.
  await mapWithConcurrency(
    changedPaths,
    PARSE_CONCURRENCY,
    async (filePath) => {
      const parsed = await parseFile(filePath, path.join(projectRoot, filePath))
      if (parsed) {
        parsedFiles.set(filePath, parsed)
      }
    },
  )

  return {
    filePaths,
    sources,
    hashByPath,
    changedPaths,
    parsedFiles,
    existingByPath,
    stats,
  }
}
