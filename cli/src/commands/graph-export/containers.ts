/**
 * Container derivation for the knowledge-graph export drill-down
 * (FID-2026-0806-017).
 *
 * Mirrors the source project's `deriveContainers` strategy
 * (`resources/Understand-Anything-main/…/graph-layout-scaling-design.md` §2):
 * group file nodes by folder using a longest-common-prefix strip, falling back
 * to community containers (our existing deterministic `cluster` ids) when the
 * folder buckets degenerate. Deterministic — no randomness, no new deps.
 */

import type { GraphExportElement } from '@savant-code/knowledge-graph'

export interface GraphContainer {
  /** Stable id: `folder:<name>` or `cluster:<n>`. */
  id: string
  /** Human-readable label shown on the collapsed container node. */
  label: string
  /** Node element ids inside this container. */
  nodeIds: string[]
}

const DEGENERATE_BUCKET_FRACTION = 0.7
const MIN_BUCKETS = 2

/** Node elements only (edges have data.source/target; nodes do not). */
function fileNodes(elements: GraphExportElement[]): GraphExportElement[] {
  return elements.filter((el) => !el.data.source && !el.data.target)
}

function longestCommonPrefix(parts: string[][]): string[] {
  const first = parts[0]
  if (!first) return []
  const prefix: string[] = []
  for (let i = 0; i < first.length; i++) {
    const segment = first[i]
    if (parts.every((p) => p[i] === segment)) prefix.push(segment)
    else break
  }
  return prefix
}

/** Bucket size distribution is degenerate when one bucket holds most nodes. */
function isDegenerate(sizes: number[], total: number): boolean {
  if (sizes.length < MIN_BUCKETS) return true
  const largest = Math.max(...sizes)
  return largest / total > DEGENERATE_BUCKET_FRACTION
}

/**
 * Derive drill-down containers for the exported file nodes.
 *
 * Strategy (source §2):
 * 1. Strip the longest common path prefix across all file paths.
 * 2. Group by the first path segment after the LCP (e.g. `sdk/`, `cli/`,
 *    `packages/`). Nodes with no segment after the LCP (root files) stay
 *    ungrouped.
 * 3. If the folder buckets are degenerate (fewer than MIN_BUCKETS, or one
 *    bucket holds >70% of nodes), fall back to community containers keyed by
 *    the existing `cluster` id.
 * 4. Single-child containers flatten to top-level nodes (nothing to drill).
 */
export function deriveContainers(
  elements: GraphExportElement[],
): GraphContainer[] {
  const nodes = fileNodes(elements)
  const withPath = nodes.filter((el) => typeof el.data.path === 'string')
  const total = withPath.length
  if (total === 0) return []

  const pathParts = withPath.map((el) =>
    (el.data.path as string).split('/').filter(Boolean),
  )
  const lcp = longestCommonPrefix(pathParts)

  // Folder buckets: first segment after the LCP.
  const folderBuckets = new Map<string, GraphExportElement[]>()
  for (let i = 0; i < withPath.length; i++) {
    const rest = pathParts[i].slice(lcp.length)
    const bucketKey = rest[0]
    if (!bucketKey) continue // root-level file → ungrouped
    const list = folderBuckets.get(bucketKey) ?? []
    list.push(withPath[i])
    folderBuckets.set(bucketKey, list)
  }

  const folderSizes = [...folderBuckets.values()].map((b) => b.length)
  const groupedCount = folderSizes.reduce((a, b) => a + b, 0)

  let buckets: Map<string, GraphExportElement[]>
  let labelFor: (key: string) => string

  if (!isDegenerate(folderSizes, groupedCount)) {
    buckets = folderBuckets
    labelFor = (key) => `${key}/`
  } else {
    // Community fallback: our deterministic cluster ids (Louvain-style,
    // assigned by the indexer). No new community-detection dependency.
    buckets = new Map()
    for (const el of withPath) {
      const cluster = el.data.cluster
      const key =
        cluster === null || cluster === undefined ? 'none' : String(cluster)
      const list = buckets.get(key) ?? []
      list.push(el)
      buckets.set(key, list)
    }
    labelFor = (key) => (key === 'none' ? 'Ungrouped' : `Cluster ${key}`)
  }

  const containers: GraphContainer[] = []
  for (const [key, list] of buckets) {
    // Single-child containers flatten — nothing to drill down into.
    if (list.length < 2) continue
    const isFolder = labelFor(key).endsWith('/')
    containers.push({
      id: `${isFolder ? 'folder' : 'cluster'}:${key}`,
      label: labelFor(key),
      nodeIds: list.map((el) => el.data.id),
    })
  }

  // Deterministic order (insertion order is already deterministic here, but
  // sort by id to be explicit and stable across environments).
  containers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return containers
}
