/** Edge kinds in the file-level dependency graph. */
export const EDGE_TYPES = {
  CALLS: 'CALLS',
  IMPORTS: 'IMPORTS',
  EXTENDS: 'EXTENDS',
} as const

export type EdgeType = (typeof EDGE_TYPES)[keyof typeof EDGE_TYPES]

/** Base weights for Louvain edge weighting (FID-2026-0806-002 Phase 2). */
export const EDGE_WEIGHTS: Record<EdgeType, number> = {
  CALLS: 2.0,
  IMPORTS: 1.0,
  EXTENDS: 1.0,
}

/** Penalty fraction applied when an edge crosses top-level directories. */
export const CROSS_DIRECTORY_PENALTY = 0.5

/** Recursive-CTE depth cap (FID-2026-0806-002: ≤ 50, cycle-safe). */
export const MAX_TRAVERSAL_DEPTH = 50

/** Node kinds. `symbol` is the default kind for code-map identifier captures. */
export const NODE_TYPES = {
  FILE: 'file',
  SYMBOL: 'symbol',
} as const

export type NodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES]

export interface FileNodeRow {
  id: number
  path: string
  hash: string
}

export interface GraphNodeRow {
  id: number
  fileId: number
  type: NodeType
  name: string
  clusterId: number | null
}

export interface GraphEdgeRow {
  sourceId: number
  targetId: number
  type: EdgeType
  weight: number
}

/** Per-file parse result (code-map surface, injectable for tests). */
export interface ParsedFile {
  /** Defined identifiers in the file. */
  identifiers: string[]
  /** Call expressions in the file (token names). */
  calls: string[]
}

export type ParseFileFn = (
  filePath: string,
  fullPath: string,
  source?: string,
) => ParsedFile | null | Promise<ParsedFile | null>

/** Summary returned by an indexing pass. */
export interface IndexStats {
  /** Files on disk at the start of the pass. */
  filesOnDisk: number
  /** Files added (new to the index). */
  filesAdded: number
  /** Files modified (hash changed, re-parsed). */
  filesModified: number
  /** Files deleted from disk (removed from the index via cascade). */
  filesDeleted: number
  /** Files unchanged (hash matched, skipped). */
  filesUnchanged: number
  /** Total symbol nodes after the pass. */
  nodeCount: number
  /** Total edges after the pass. */
  edgeCount: number
  /** Clusters assigned (0 when the graph had no edges). */
  clusterCount: number
  /** Wall-clock duration of the pass. */
  durationMs: number
}

/**
 * Result of a single node/edge query.
 *
 * NOTE: these result shapes are `type` aliases (not interfaces) deliberately:
 * object-literal types carry implicit index signatures, so the results are
 * structurally assignable to `JSONValue` and can round-trip through tool
 * output schemas without casts (interfaces would not be).
 */
export type NodeEdgesResult = {
  file: {
    id: number
    path: string
    hash: string
    clusterId: number | null
  } | null
  symbols: Array<{ id: number; name: string; clusterId: number | null }>
  outgoing: Array<{
    sourcePath: string
    targetPath: string
    type: EdgeType
    weight: number
  }>
  incoming: Array<{
    sourcePath: string
    targetPath: string
    type: EdgeType
    weight: number
  }>
}

export type ClusterRow = {
  clusterId: number
  fileCount: number
  nodeCount: number
  /** Representative files (up to 5, by path). */
  files: string[]
}

export type ReachabilityResult = {
  reachable: boolean
  depth: number | null
  /** File path chain from start to target (directed). */
  path: string[] | null
}
