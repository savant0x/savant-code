import ELK from 'elkjs/lib/elk-api.js'

import { getElkWorkerClass } from './elk-worker'

import type { GraphPosition } from '@savant-code/knowledge-graph'
import type {
  ElkExtendedEdge,
  ElkNode,
  LayoutOptions,
} from 'elkjs/lib/elk-api.js'

/**
 * Mirror the source project's ELK configuration
 * (`graph-layout-scaling-design.md` §3): layered algorithm, top-down, sweep
 * crossing minimization, orthogonal edge routing, generous spacing so
 * containers read as distinct regions.
 */
export const ELK_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '60',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.padding': '[30]',
}

export const FILE_NODE_W = 40
export const FILE_NODE_H = 24

// FID-2026-0806-018: fixed container atom size for the compact overview ELK
// pass (the CSS container node size is 120 × 36 in template.ts).
export const CONTAINER_OVERVIEW_W = 120
export const CONTAINER_OVERVIEW_H = 36

export function roundCoord(n: number): number {
  return Math.round(n)
}

export function measureBbox(positions: Record<string, GraphPosition>): {
  width: number
  height: number
} {
  let maxX = 0
  let maxY = 0
  for (const pos of Object.values(positions)) {
    maxX = Math.max(maxX, pos.x + FILE_NODE_W)
    maxY = Math.max(maxY, pos.y + FILE_NODE_H)
  }
  return { width: maxX, height: maxY }
}

/** One ELK invocation over the given node ids (+ optional explicit sizes). */
export async function runElk(
  nodeIds: string[],
  edges: ElkExtendedEdge[],
  sizes?: Array<{ id: string; width: number; height: number }>,
): Promise<Record<string, GraphPosition>> {
  if (nodeIds.length === 0) return {}
  const sizeById = new Map((sizes ?? []).map((s) => [s.id, s]))
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: nodeIds.map((id) => {
      const size = sizeById.get(id) ?? {
        width: FILE_NODE_W,
        height: FILE_NODE_H,
      }
      return { id, width: size.width, height: size.height }
    }),
    edges,
  }

  const elk = await createElk()
  const laid = await elk.layout(graph)

  const positions: Record<string, GraphPosition> = {}
  for (const child of laid.children ?? []) {
    if (child.x !== undefined && child.y !== undefined) {
      positions[child.id] = { x: roundCoord(child.x), y: roundCoord(child.y) }
    }
  }
  return positions
}

async function createElk(): Promise<InstanceType<typeof ELK>> {
  const WorkerClass = await getElkWorkerClass()
  // The GWT fake worker satisfies elkjs's Worker protocol (postMessage +
  // onmessage) without any thread — cast through unknown because it does not
  // implement the full DOM Worker interface.
  return new ELK({
    workerFactory: () => new WorkerClass() as unknown as Worker,
  })
}
