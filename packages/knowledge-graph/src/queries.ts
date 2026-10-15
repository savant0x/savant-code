import { MAX_TRAVERSAL_DEPTH } from './types'

import type { ClusterRow, NodeEdgesResult, ReachabilityResult } from './types'
import type { Database } from 'bun:sqlite'

/**
 * Read-only graph queries (FID-2026-0806-002 Phase 1/3).
 *
 * Blast radius + reachability use globally visited breadth-first frontiers.
 * Each vertex expands at most once, with depth capped at 50.
 *
 * Law 4 honesty: these are deterministic proofs *over the indexed snapshot*,
 * bounded by index freshness and parser-query coverage — not absolute.
 */

interface FileRow {
  id: number
  path: string
  hash: string
}

/** Resolve a file path to its row, or null. */
export function getFileByPath(db: Database, filePath: string): FileRow | null {
  return (
    (db
      .query('SELECT id, path, hash FROM files WHERE path = ?')
      .get(filePath) as FileRow | undefined) ?? null
  )
}

type WalkRow = { id: number; path: string; parent: number; depth: number }

/** Indexed adjacency lookup; duplicate edge kinds collapse before visiting. */
function* walkFrontiers(params: {
  db: Database
  start: number
  maxDepth: number
  directed: boolean
}): Generator<WalkRow[]> {
  const { db, start, directed } = params
  const maxDepth = Number.isFinite(params.maxDepth)
    ? Math.min(MAX_TRAVERSAL_DEPTH, Math.max(0, Math.floor(params.maxDepth)))
    : MAX_TRAVERSAL_DEPTH
  const adjacency = db.query(
    directed
      ? `SELECT DISTINCT f.id, f.path FROM edges e JOIN files f ON f.id = e.target_id
       WHERE e.source_id = ? ORDER BY f.path`
      : `SELECT DISTINCT f.id, f.path FROM files f JOIN (
         SELECT target_id AS id FROM edges WHERE source_id = ?1
         UNION SELECT source_id AS id FROM edges WHERE target_id = ?1
       ) e ON e.id = f.id ORDER BY f.path`,
  )
  const visited = new Set([start])
  let frontier = [start]
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const layer: WalkRow[] = []
    for (const parent of frontier) {
      const neighbors = adjacency.all(parent) as Array<{
        id: number
        path: string
      }>
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.id)) continue
        visited.add(neighbor.id)
        layer.push({ ...neighbor, parent, depth })
      }
    }
    layer.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    yield layer
    frontier = layer.map((row) => row.id)
  }
}

/**
 * Blast radius: every file reachable from `filePath` within `maxDepth` hops
 * over UNDIRECTED edges (both dependency and dependent directions — a change
 * propagates both ways). Cycle-safe via the path guard; depth-capped at
 * MAX_TRAVERSAL_DEPTH.
 */
export function queryBlastRadius(params: {
  db: Database
  filePath: string
  maxDepth?: number
  limit?: number
}): Array<{ path: string; depth: number }> {
  const { db, filePath, maxDepth = MAX_TRAVERSAL_DEPTH, limit = 1000 } = params
  const file = getFileByPath(db, filePath)
  if (!file) return []

  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 1000
  if (cap === 0) return []
  const result: Array<{ path: string; depth: number }> = []
  for (const layer of walkFrontiers({
    db,
    start: file.id,
    maxDepth,
    directed: false,
  })) {
    result.push(...layer.map((row) => ({ path: row.path, depth: row.depth })))
    if (result.length >= cap) break
  }
  return result.slice(0, cap)
}

/**
 * Node edges: a file's symbol nodes, cluster, and direct incoming/outgoing
 * edges with resolved paths.
 */
export function queryNodeEdges(params: {
  db: Database
  filePath: string
  limit?: number
}): NodeEdgesResult {
  const { db, filePath, limit = 500 } = params
  const file = getFileByPath(db, filePath)
  if (!file) {
    return { file: null, symbols: [], outgoing: [], incoming: [] }
  }

  const symbols = db
    .query(
      'SELECT id, name, cluster_id FROM nodes WHERE file_id = ? AND type = ? ORDER BY name LIMIT ?',
    )
    .all(file.id, 'symbol', limit) as Array<{
    id: number
    name: string
    cluster_id: number | null
  }>

  const anchor = db
    .query('SELECT cluster_id FROM nodes WHERE file_id = ? AND type = ?')
    .get(file.id, 'file') as { cluster_id: number | null } | null

  const outgoing = db
    .query(
      `SELECT f.path AS sourcePath, t.path AS targetPath, e.type, e.weight
       FROM edges e
       JOIN files f ON f.id = e.source_id
       JOIN files t ON t.id = e.target_id
       WHERE e.source_id = ?
       ORDER BY e.weight DESC, t.path ASC
       LIMIT ?`,
    )
    .all(file.id, limit) as Array<{
    sourcePath: string
    targetPath: string
    type: 'CALLS' | 'IMPORTS' | 'EXTENDS'
    weight: number
  }>

  const incoming = db
    .query(
      `SELECT f.path AS sourcePath, t.path AS targetPath, e.type, e.weight
       FROM edges e
       JOIN files f ON f.id = e.source_id
       JOIN files t ON t.id = e.target_id
       WHERE e.target_id = ?
       ORDER BY e.weight DESC, f.path ASC
       LIMIT ?`,
    )
    .all(file.id, limit) as Array<{
    sourcePath: string
    targetPath: string
    type: 'CALLS' | 'IMPORTS' | 'EXTENDS'
    weight: number
  }>

  return {
    file: {
      id: file.id,
      path: file.path,
      hash: file.hash,
      clusterId: anchor?.cluster_id ?? null,
    },
    symbols: symbols.map((s) => ({
      id: s.id,
      name: s.name,
      clusterId: s.cluster_id,
    })),
    outgoing,
    incoming,
  }
}

/** Domain clusters with sizes and representative files. */
export function queryDomainClusters(params: {
  db: Database
  limit?: number
}): ClusterRow[] {
  const { db, limit = 100 } = params

  const rows = db
    .query(
      `
    WITH clusters AS (
      SELECT cluster_id AS clusterId,
        COUNT(DISTINCT CASE WHEN type = 'file' THEN file_id END) AS fileCount,
        COUNT(*) AS nodeCount
      FROM nodes WHERE cluster_id IS NOT NULL GROUP BY cluster_id
      ORDER BY fileCount DESC, clusterId ASC LIMIT ?
    ), representatives AS (
      SELECT DISTINCT n.cluster_id, f.path FROM nodes n
      JOIN files f ON f.id = n.file_id
      JOIN clusters c ON c.clusterId = n.cluster_id WHERE n.type = 'file'
    ), ranked AS (
      SELECT cluster_id, path,
        ROW_NUMBER() OVER (PARTITION BY cluster_id ORDER BY path) AS rank
      FROM representatives
    )
    SELECT c.*, r.path FROM clusters c LEFT JOIN ranked r
      ON r.cluster_id = c.clusterId AND r.rank <= 5
    ORDER BY c.fileCount DESC, c.clusterId ASC, r.path ASC
  `,
    )
    .all(
      Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 100,
    ) as Array<{
    clusterId: number
    fileCount: number
    nodeCount: number
    path: string | null
  }>
  const clusters = new Map<number, ClusterRow>()
  for (const row of rows) {
    const cluster = clusters.get(row.clusterId) ?? {
      clusterId: row.clusterId,
      fileCount: row.fileCount,
      nodeCount: row.nodeCount,
      files: [],
    }
    if (row.path !== null) cluster.files.push(row.path)
    clusters.set(row.clusterId, cluster)
  }
  return [...clusters.values()]
}

/**
 * Directed reachability from `fromPath` to `toPath` over the dependency edges
 * (source → target). Returns the shortest directed path chain, or reachable:
 * false. Used by the harness `verify_call_reachability` path.
 */
export function queryReachability(params: {
  db: Database
  fromPath: string
  toPath: string
  maxDepth?: number
}): ReachabilityResult {
  const { db, fromPath, toPath, maxDepth = MAX_TRAVERSAL_DEPTH } = params
  const from = getFileByPath(db, fromPath)
  const to = getFileByPath(db, toPath)
  if (!from || !to) {
    return { reachable: false, depth: null, path: null }
  }
  if (from.id === to.id) {
    return { reachable: true, depth: 0, path: [fromPath] }
  }

  const discovered = new Map<number, WalkRow>()
  for (const layer of walkFrontiers({
    db,
    start: from.id,
    maxDepth,
    directed: true,
  })) {
    for (const row of layer) discovered.set(row.id, row)
    const target = discovered.get(to.id)
    if (!target) continue
    const chain: string[] = []
    let current: WalkRow | undefined = target
    while (current) {
      chain.push(current.path)
      current = discovered.get(current.parent)
    }
    return {
      reachable: true,
      depth: target.depth,
      path: [fromPath, ...chain.reverse()],
    }
  }
  return { reachable: false, depth: null, path: null }
}
