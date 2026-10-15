import { describe, expect, test } from 'bun:test'

import { deriveContainers } from '../graph-export/containers'

import type { GraphExportElement } from '@savant-code/knowledge-graph'

function file(
  id: string,
  path: string,
  cluster: number | null,
): GraphExportElement {
  return { data: { id, label: id, path, cluster } }
}

function edge(source: string, target: string): GraphExportElement {
  return {
    data: { id: `e-${source}-${target}`, label: 'IMPORTS', source, target },
  }
}

describe('deriveContainers (FID-2026-0806-017)', () => {
  test('groups by first segment after the longest common prefix (folder-LCP)', () => {
    const elements = [
      file('a', 'packages/knowledge-graph/src/a.ts', 0),
      file('b', 'packages/knowledge-graph/src/b.ts', 0),
      file('c', 'packages/knowledge-graph/src/c.ts', 0),
      file('d', 'cli/src/commands/d.ts', 1),
      file('e', 'cli/src/commands/e.ts', 1),
      // Root-level file with no segment after the LCP → ungrouped
      file('f', 'README.md', 2),
    ]

    const containers = deriveContainers(elements)
    const ids = containers.map((c) => c.id)

    // LCP across all paths is empty, so buckets are the first segment:
    // packages/ and cli/ (2 buckets, both < 70% → folder strategy).
    expect(ids).toEqual(['folder:cli', 'folder:packages'])
    const packages = containers.find((c) => c.id === 'folder:packages')!
    expect(packages.label).toBe('packages/')
    expect(packages.nodeIds.sort()).toEqual(['a', 'b', 'c'])
    // README.md has no first segment after the (empty) LCP → stays ungrouped
    expect(containers.some((c) => c.nodeIds.includes('f'))).toBe(false)
  })

  test('single-child folders flatten (nothing to drill down)', () => {
    const elements = [
      file('a', 'src/a.ts', 0),
      file('b', 'src/b.ts', 0),
      file('solo', 'docs/solo.md', 1),
    ]

    const containers = deriveContainers(elements)
    const ids = containers.map((c) => c.id)

    // docs/ has one child → flattened; src/ has two → kept.
    expect(ids).toEqual(['folder:src'])
  })

  test('degenerate folder buckets (>70% in one) fall back to cluster containers', () => {
    const elements = [
      file('a', 'packages/x/src/a.ts', 0),
      file('b', 'packages/x/src/b.ts', 0),
      file('c', 'packages/x/src/c.ts', 0),
      file('d', 'packages/x/src/d.ts', 0),
      file('e', 'packages/x/src/e.ts', 0),
      file('f', 'packages/x/src/f.ts', 0),
      file('g', 'packages/x/src/g.ts', 0),
      file('h', 'packages/x/src/h.ts', 0), // 8/10 → 80% in one bucket
      file('odd1', 'odd1.ts', 3),
      file('odd2', 'odd2.ts', 3),
    ]

    const containers = deriveContainers(elements)
    const ids = containers.map((c) => c.id)

    // Folder strategy would produce one 8-node bucket (80% > 70%) → the
    // cluster fallback keys by the existing deterministic cluster ids.
    expect(ids).toContain('cluster:0')
    expect(ids).toContain('cluster:3')
    const cluster0 = containers.find((c) => c.id === 'cluster:0')!
    expect(cluster0.label).toBe('Cluster 0')
    expect(cluster0.nodeIds).toHaveLength(8)
    const cluster3 = containers.find((c) => c.id === 'cluster:3')!
    expect(cluster3.label).toBe('Cluster 3')
    expect(cluster3.nodeIds).toHaveLength(2)
    // Root files with a post-LCP segment (odd1.ts) do NOT form a folder
    // bucket in this fallback — the cluster id is the only key.
    expect(ids.some((id) => id.startsWith('folder:'))).toBe(false)
  })

  test('no path → no containers; nodes without a post-LCP segment stay ungrouped', () => {
    const elements = [
      file('n1', 'top.ts', 0),
      file('n2', 'root.js', 1),
      edge('n1', 'n2'),
    ]

    // Both files are root-level: no segment after the (empty) LCP, so no
    // folder buckets exist → degenerate (< MIN_BUCKETS) → cluster fallback,
    // but single-child clusters flatten → no containers at all.
    expect(deriveContainers(elements)).toEqual([])
  })

  test('folder strategy holds at the 70% boundary; multi-child buckets kept', () => {
    const elements = [
      file('a', 'src/a.ts', 7),
      file('b', 'src/b.ts', 7),
      file('c', 'src/c.ts', 7),
      file('d', 'lib/d.ts', 7),
      file('e', 'lib/e.ts', 7),
    ]

    // src/ holds 3/5 = 60% (under 70%) → folder strategy applies; both
    // buckets have ≥2 children so neither flattens.
    const containers = deriveContainers(elements)
    expect(containers.map((c) => c.id).sort()).toEqual([
      'folder:lib',
      'folder:src',
    ])
  })
})
