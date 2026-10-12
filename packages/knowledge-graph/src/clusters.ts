import { UndirectedGraph } from 'graphology'
import louvain from 'graphology-communities-louvain'

import type { Database } from 'bun:sqlite'

/**
 * Louvain domain clustering (FID-2026-0806-002 Phase 2).
 *
 * Builds an undirected graphology graph from the file-level dependency edges
 * (edge weight already carries the deterministic weighting: CALLS 2.0,
 * IMPORTS/EXTENDS 1.0, cross-directory penalty applied at build time), runs
 * graphology-communities-louvain (MIT, verified Bun-compatible), and returns
 * the fileId → clusterId partition.
 *
 * Determinism: the 2.x API (pinned at 2.0.2) accepts a `rng` option — we
 * inject a seeded mulberry32 PRNG so the random-walk phase is fully
 * reproducible for a given graph + options, satisfying the FID's determinism
 * requirement. `resolution` is natively supported (FID's "resolution scaled
 * inversely to node count" requirement maps onto this option; callers may
 * raise it to split domains further).
 */
export type ClusterAssignments = Map<number, number>

export interface ComputeClustersParams {
  db: Database
  /** Weight threshold: edges below this are ignored. Default 0. */
  minWeight?: number
  /** When fewer files than this exist, no clustering runs. Default 2. */
  minFiles?: number
  /** Louvain resolution. Higher → more, smaller communities. Defaults to a
   *  node-count-scaled value (FID Phase 2: "resolution scaled inversely to
   *  node count") — see `defaultResolution`. */
  resolution?: number
  /** Seeded RNG for the random-walk phase. Defaults to a fixed seed (42). */
  seed?: number
}

/**
 * Default Louvain resolution, scaled inversely to node count (FID Phase 2).
 * A ~2000-node repo gets resolution ≈ 1.0 (empirically sensible domains —
 * ~400 clusters on this codebase); larger repos get lower resolution so
 * communities stay coarse and meaningful instead of fragmenting per file.
 * Clamped to [0.1, 1].
 */
export function defaultResolution(nodeCount: number): number {
  if (nodeCount <= 0) return 1
  return Math.min(1, Math.max(0.1, 2000 / nodeCount))
}

/** Deterministic seeded PRNG (mulberry32) for reproducible Louvain walks. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Build an undirected graphology graph from the edges table. */
export function buildClusteringGraph(
  db: Database,
  minWeight: number = 0,
): UndirectedGraph {
  const graph = new UndirectedGraph()

  const files = db.query('SELECT id FROM files ORDER BY id').all() as Array<{
    id: number
  }>
  for (const file of files) {
    graph.addNode(String(file.id))
  }

  const edges = db
    .query('SELECT source_id, target_id, weight FROM edges')
    .all() as Array<{ source_id: number; target_id: number; weight: number }>
  for (const edge of edges) {
    if (edge.weight < minWeight) continue
    if (!graph.hasNode(String(edge.source_id))) continue
    if (!graph.hasNode(String(edge.target_id))) continue
    try {
      graph.addEdge(String(edge.source_id), String(edge.target_id), {
        weight: edge.weight,
      })
    } catch {
      // Parallel edge (same pair, different type) — merge weights by
      // deterministic sum so CALLS(2.0) + IMPORTS/EXTENDS(1.0) combine into
      // one weighted edge. Sum is order-independent, so no ORDER BY needed.
      const existing = graph.edge(
        String(edge.source_id),
        String(edge.target_id),
      )
      if (existing !== undefined) {
        const current = graph.getEdgeAttribute(existing, 'weight')
        graph.setEdgeAttribute(
          existing,
          'weight',
          (typeof current === 'number' ? current : 0) + edge.weight,
        )
      }
    }
  }

  return graph
}

/**
 * Run the Louvain pass and return fileId → clusterId. Returns an empty map
 * when the graph has fewer than `minFiles` nodes or no edges (the louvain
 * package throws on empty graphs — guarded here).
 */
export function computeClusters(
  params: ComputeClustersParams,
): ClusterAssignments {
  const { db, minWeight = 0, minFiles = 2, seed = 42 } = params

  const graph = buildClusteringGraph(db, minWeight)
  if (graph.order < minFiles || graph.size === 0) {
    return new Map()
  }

  // FID Phase 2: when the caller does not pin a resolution, scale it
  // inversely to the number of files so domain clusters stay meaningful at
  // any repo size.
  const resolution = params.resolution ?? defaultResolution(graph.order)

  try {
    const partition = louvain(graph, {
      nodeCommunityAttribute: 'community',
      getEdgeWeight: 'weight',
      resolution,
      rng: mulberry32(seed),
    })
    const assignments: ClusterAssignments = new Map()
    for (const [nodeKey, community] of Object.entries(partition)) {
      assignments.set(Number(nodeKey), Number(community))
    }
    return assignments
  } catch {
    // Louvain may reject degenerate graphs (no edges after weighting);
    // deterministic empty result.
    return new Map()
  }
}

/**
 * Write cluster ids back to the nodes table (FID Phase 2: `cluster_id` on
 * nodes). Anchor file nodes + symbol nodes of the same file share the file's
 * cluster, so `query_domain_clusters` can report per-file clusters.
 */
export function assignClustersToNodes(params: {
  db: Database
  assignments: ClusterAssignments
}): void {
  const { db, assignments } = params
  const clearStmt = db.prepare('UPDATE nodes SET cluster_id = NULL')
  const updateStmt = db.prepare(
    'UPDATE nodes SET cluster_id = ? WHERE file_id = ?',
  )

  db.transaction(() => {
    clearStmt.run()
    for (const [fileId, clusterId] of assignments) {
      updateStmt.run(clusterId, fileId)
    }
  })()
}
