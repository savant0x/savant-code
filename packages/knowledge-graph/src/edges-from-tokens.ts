import { accumulateEdge, isCrossDirectory, resolveRelativeImport } from './extract'
import { CROSS_DIRECTORY_PENALTY, EDGE_WEIGHTS } from './types'

import type { EdgeAccumulator } from './extract'
import type { Database } from 'bun:sqlite'

export type { EdgeAccumulator } from './extract'
export type { EdgeType } from './types'

/**
 * Token-driven edge derivation (FID-2026-1002-006): the exact weight,
 * resolver, and penalty contract of the previous `buildAllEdges` flow
 * (extract.ts), with the IMPORTS/EXTENDS input moved from in-memory regex
 * over raw sources to persisted per-file token rows. Only unchanged files
 * change delivery — re-read + re-regex becomes persisted-at-last-mutation.
 */

/** Load one per-file token table into a path→tokens map. */
export function loadTokensByFile(
  db: Database,
  table: 'file_calls' | 'file_imports' | 'file_extends',
  column: 'token' | 'parent',
  pathById: Map<number, string>,
): Map<string, string[]> {
  const rows = db
    .query(`SELECT file_id, ${column} AS token FROM ${table}`)
    .all() as Array<{ file_id: number; token: string }>
  const byFile = new Map<string, string[]>()
  for (const row of rows) {
    const filePath = pathById.get(row.file_id)
    if (!filePath) continue
    const list = byFile.get(filePath) ?? []
    list.push(row.token)
    byFile.set(filePath, list)
  }
  return byFile
}

/**
 * Resolve one persisted relative-import token against the current path set
 * — byte-identical semantics to `extract.ts:resolveRelativeImport`, but
 * lexical-only (no fs access in the edge pass).
 */
export function resolveImportToken(
  specifier: string,
  fromFilePath: string,
  filePaths: ReadonlySet<string>,
): string | null {
  return resolveRelativeImport(specifier, fromFilePath, filePaths)
}

/**
 * Build the corpus edge set from persisted per-file tokens:
 * - CALLS: token → defining file via the sorted symbol index (w 2.0).
 * - IMPORTS: relative specifier resolved against the CURRENT path set
 *   (w 1.0) — target add/remove since the last pass re-resolves.
 * - EXTENDS: parent name → defining file via the symbol index (w 1.0).
 * - Cross-directory penalty 0.5. Self-edges ignored. Deterministic:
 *   sorted token-map iteration over a pre-sorted symbol index.
 */
export function buildEdgesFromTokens(params: {
  callsByFile: ReadonlyMap<string, string[]>
  importsByFile: ReadonlyMap<string, string[]>
  extendsByFile: ReadonlyMap<string, string[]>
  filePaths: ReadonlySet<string>
  symbolIndex: ReadonlyMap<string, string[]>
}): EdgeAccumulator {
  const edges: EdgeAccumulator = new Map()

  for (const [filePath, calls] of [...params.callsByFile].sort()) {
    for (const call of calls) {
      const definingFile = params.symbolIndex.get(call)?.[0]
      if (!definingFile) continue
      accumulateEdge(edges, filePath, definingFile, 'CALLS', EDGE_WEIGHTS.CALLS)
    }
  }
  for (const [filePath, imports] of [...params.importsByFile].sort()) {
    for (const specifier of imports) {
      const resolved = resolveImportToken(specifier, filePath, params.filePaths)
      if (!resolved) continue
      accumulateEdge(edges, filePath, resolved, 'IMPORTS', EDGE_WEIGHTS.IMPORTS)
    }
  }
  for (const [filePath, parents] of [...params.extendsByFile].sort()) {
    for (const parent of parents) {
      const definingFile = params.symbolIndex.get(parent)?.[0]
      if (!definingFile) continue
      accumulateEdge(edges, filePath, definingFile, 'EXTENDS', EDGE_WEIGHTS.EXTENDS)
    }
  }
  for (const [key, entry] of edges) {
    const [source, target] = key.split('\u0000')
    if (isCrossDirectory(source, target)) {
      entry.weight = entry.weight * CROSS_DIRECTORY_PENALTY
    }
  }
  return edges
}
