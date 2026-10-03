import { resolveRelativeImport } from './extract'

import type { Database } from 'bun:sqlite'

/**
 * Token-driven edge derivation (FID-2026-1002-006): the exact weight,
 * resolver, and penalty contract of the previous `buildAllEdges` flow
 * (extract.ts), with the IMPORTS/EXTENDS input moved from in-memory regex
 * over raw sources to persisted per-file token rows. Only unchanged files
 * change delivery — re-read + re-regex becomes persisted-at-last-mutation.
 */

export type EdgeType = 'CALLS' | 'IMPORTS' | 'EXTENDS'
export type EdgeAccumulator = Map<string, { type: EdgeType; weight: number }>

const CALL_WEIGHT = 2.0
const IMPORT_WEIGHT = 1.0
const EXTENDS_WEIGHT = 1.0
const CROSS_DIRECTORY_PENALTY = 0.5

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
  const posix = specifier.replaceAll('\\', '/')
  const lastSlash = fromFilePath.lastIndexOf('/')
  const dir = lastSlash === -1 ? '' : fromFilePath.slice(0, lastSlash)
  const joined = dir === '' ? posix : `${dir}/${posix}`
  const segments: string[] = []
  for (const seg of joined.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      segments.pop()
      continue
    }
    segments.push(seg)
  }
  const resolved = segments.join('/')
  if (resolved.startsWith('..') || resolved === '') return null
  return resolveRelativeImport(`./${resolved}`, `./x.ts`, filePaths)
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
  const accumulate = (
    source: string,
    target: string,
    type: EdgeType,
    weight: number,
  ): void => {
    if (source === target) return
    const key = `${source}\u0000${target}\u0000${type}`
    const existing = edges.get(key)
    if (existing) existing.weight += weight
    else edges.set(key, { type, weight })
  }
  const isCrossDirectory = (a: string, b: string): boolean => {
    const dirA = a.split('/')[0] ?? ''
    const dirB = b.split('/')[0] ?? ''
    return dirA !== dirB
  }

  for (const [filePath, calls] of [...params.callsByFile].sort()) {
    for (const call of calls) {
      const definingFile = params.symbolIndex.get(call)?.[0]
      if (!definingFile) continue
      accumulate(filePath, definingFile, 'CALLS', CALL_WEIGHT)
    }
  }
  for (const [filePath, imports] of [...params.importsByFile].sort()) {
    for (const specifier of imports) {
      const resolved = resolveImportToken(specifier, filePath, params.filePaths)
      if (!resolved) continue
      accumulate(filePath, resolved, 'IMPORTS', IMPORT_WEIGHT)
    }
  }
  for (const [filePath, parents] of [...params.extendsByFile].sort()) {
    for (const parent of parents) {
      const definingFile = params.symbolIndex.get(parent)?.[0]
      if (!definingFile) continue
      accumulate(filePath, definingFile, 'EXTENDS', EXTENDS_WEIGHT)
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
