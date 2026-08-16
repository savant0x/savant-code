import path from 'path'

import { EDGE_TYPES } from './types'

import type { EdgeType } from './types'

/**
 * Graph-edge derivation helpers (FID-2026-0806-002 Phase 1). These are
 * deterministic, regex/extension-based "graph assembly" passes — they do NOT
 * re-implement tree-sitter parsing (that is code-map's job; see update.ts for
 * how parse output feeds these helpers).
 */

/**
 * Extract relative import specifiers from source text. Handles:
 * - `import x from './a'` / `import './a'`
 * - `export ... from './a'`
 * - `require('./a')`
 * Only *relative* specifiers (`./`, `../`) are returned — bare specifiers
 * (node_modules / stdlib) are external to the indexed snapshot by design.
 */
export function extractRelativeImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>()
  const importRe =
    /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g
  const requireRe = /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g

  let m: RegExpExecArray | null
  while ((m = importRe.exec(source)) !== null) {
    specifiers.add(m[1])
  }
  while ((m = requireRe.exec(source)) !== null) {
    specifiers.add(m[1])
  }
  return Array.from(specifiers)
}

/**
 * Resolve a relative specifier against a candidate file set. Tries the
 * literal path plus common extension/entrypoint resolutions, deterministically
 * (first match wins in the candidate order). Returns the resolved project path
 * (forward-slash normalized) or null.
 */
export function resolveRelativeImport(
  specifier: string,
  fromFilePath: string,
  filePaths: ReadonlySet<string>,
): string | null {
  const dir = path.posix.dirname(fromFilePath.replaceAll('\\', '/'))
  const resolved = path.posix.normalize(path.posix.join(dir, specifier))

  // Avoid escaping the project root via ../
  if (resolved.startsWith('..')) return null

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.mjs`,
    `${resolved}.cjs`,
    `${resolved}.py`,
    `${resolved}.rs`,
    `${resolved}.go`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
    `${resolved}/index.jsx`,
    `${resolved}/index.py`,
  ]
  for (const candidate of candidates) {
    if (filePaths.has(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Extract `class X extends Y` / `interface X extends Y` parent names.
 * Returns { child, parent } pairs.
 */
export function extractExtendsRelations(
  source: string,
): Array<{ child: string; parent: string }> {
  const relations: Array<{ child: string; parent: string }> = []
  const re =
    /\b(class|interface)\s+([A-Za-z_$][\w$]*)\s+extends\s+([A-Za-z_$][\w$]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    relations.push({ child: m[2], parent: m[3] })
  }
  return relations
}

/**
 * Resolve a bare symbol name to its defining file using the index, with a
 * deterministic tie-break: the shortest defining path wins; equal lengths
 * resolve lexicographically. Returns the defining file path or null.
 *
 * FID-2026-0815-009 (F-12): the caller (updateKnowledgeGraph) pre-sorts each
 * candidate list (shortest path, then lexicographic), so this is an O(1) pick
 * of the first element — no repeated per-call sort.
 */
export function resolveSymbolDefiningFile(
  symbol: string,
  symbolIndex: ReadonlyMap<string, string[]>,
): string | null {
  const candidates = symbolIndex.get(symbol)
  if (!candidates || candidates.length === 0) {
    return null
  }
  return candidates[0]
}

/**
 * True when the two file paths are in different top-level directories (the
 * cross-directory penalty trigger for Louvain edge weighting).
 */
export function isCrossDirectory(a: string, b: string): boolean {
  const dirA = path.posix.dirname(a.replaceAll('\\', '/')).split('/')[0] ?? ''
  const dirB = path.posix.dirname(b.replaceAll('\\', '/')).split('/')[0] ?? ''
  return dirA !== dirB
}

/** Aggregated edge accumulator keyed by (source, target, type). */
export type EdgeAccumulator = Map<string, { type: EdgeType; weight: number }>

export function edgeKey(
  source: string,
  target: string,
  type: EdgeType,
): string {
  return `${source}\u0000${target}\u0000${type}`
}

/**
 * Accumulate an edge weight for a (source, target, type) triple. Weights for
 * the same triple are summed (multiple call tokens / import statements between
 * the same pair strengthen the edge). Self-edges are ignored.
 */
export function accumulateEdge(
  edges: EdgeAccumulator,
  source: string,
  target: string,
  type: EdgeType,
  weight: number,
): void {
  if (source === target) return
  const key = edgeKey(source, target, type)
  const existing = edges.get(key)
  if (existing) {
    existing.weight += weight
  } else {
    edges.set(key, { type, weight })
  }
}

/**
 * Build all edges for the corpus from the per-file parse results + raw source:
 *
 * - CALLS: each call token resolves (via the symbol index) to its defining
 *   file; weight 2.0 per distinct token (FID Phase 2).
 * - IMPORTS: relative specifiers resolved against the indexed file set;
 *   weight 1.0 per distinct specifier.
 * - EXTENDS: `class X extends Y` where Y is defined in the indexed snapshot;
 *   weight 1.0 per relation.
 *
 * Cross-directory edges get CROSS_DIRECTORY_PENALTY applied (deterministic
 * structural weighting, FID Phase 2).
 */
export function buildAllEdges(params: {
  parsedFiles: ReadonlyMap<string, { identifiers: string[]; calls: string[] }>
  sources: ReadonlyMap<string, string>
  filePaths: ReadonlySet<string>
  symbolIndex: ReadonlyMap<string, string[]>
  callWeight?: number
  importWeight?: number
  extendsWeight?: number
  crossDirectoryPenalty?: number
}): EdgeAccumulator {
  const {
    parsedFiles,
    sources,
    filePaths,
    symbolIndex,
    callWeight = 2.0,
    importWeight = 1.0,
    extendsWeight = 1.0,
    crossDirectoryPenalty = 0.5,
  } = params

  const edges: EdgeAccumulator = new Map()

  for (const [filePath, parsed] of parsedFiles) {
    // CALLS from parse output.
    for (const call of parsed.calls) {
      const definingFile = resolveSymbolDefiningFile(call, symbolIndex)
      if (!definingFile) continue
      accumulateEdge(
        edges,
        filePath,
        definingFile,
        EDGE_TYPES.CALLS,
        callWeight,
      )
    }

    // IMPORTS + EXTENDS from raw source.
    const source = sources.get(filePath) ?? ''
    for (const specifier of extractRelativeImportSpecifiers(source)) {
      const resolved = resolveRelativeImport(specifier, filePath, filePaths)
      if (!resolved) continue
      accumulateEdge(
        edges,
        filePath,
        resolved,
        EDGE_TYPES.IMPORTS,
        importWeight,
      )
    }
    for (const { parent } of extractExtendsRelations(source)) {
      const definingFile = resolveSymbolDefiningFile(parent, symbolIndex)
      if (!definingFile) continue
      accumulateEdge(
        edges,
        filePath,
        definingFile,
        EDGE_TYPES.EXTENDS,
        extendsWeight,
      )
    }
  }

  // Deterministic cross-directory penalty.
  for (const [key, entry] of edges) {
    const [source, target] = key.split('\u0000')
    if (isCrossDirectory(source, target)) {
      entry.weight = entry.weight * crossDirectoryPenalty
    }
  }

  return edges
}
