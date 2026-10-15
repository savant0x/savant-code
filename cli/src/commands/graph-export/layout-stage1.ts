import {
  CONTAINER_OVERVIEW_H,
  CONTAINER_OVERVIEW_W,
  FILE_NODE_H,
  FILE_NODE_W,
  measureBbox,
  roundCoord,
  runElk,
} from './elk-runner'

import type { GraphContainer } from './containers'
import type {
  GraphExportElement,
  GraphPosition,
} from '@savant-code/knowledge-graph'
import type { ElkExtendedEdge } from 'elkjs/lib/elk-api.js'

export interface Stage1Node {
  id: string
  width: number
  height: number
  isContainer?: boolean
}

export interface Stage1Result {
  /** Atom (container + ungrouped) positions from the Stage-1 ELK run. */
  positions: Record<string, GraphPosition>
  /**
   * FID-2026-0806-018: compact overview centers for the same atoms, from a
   * fixed-size ELK pass — container atoms use the overview atom size
   * (CONTAINER_OVERVIEW_W × CONTAINER_OVERVIEW_H) instead of child bboxes.
   */
  overviewPositions: Record<string, GraphPosition>
  /** The atoms used by both ELK passes (id + isContainer). */
  atoms: Stage1Node[]
  containerBboxes: Record<string, { width: number; height: number }>
  /**
   * Container child layouts computed while sizing the atoms (Stage-1 pass).
   * Reused for the final positions — never run ELK twice on the same children.
   */
  childPositions: Record<string, Record<string, GraphPosition>>
}

/** ELK over container atoms + ungrouped nodes. */
export async function layoutStage1(
  elements: GraphExportElement[],
  containers: GraphContainer[],
  allEdges: ElkExtendedEdge[],
): Promise<Stage1Result> {
  const inContainer = new Set(containers.flatMap((c) => c.nodeIds))

  // Ungrouped file nodes act as first-class Stage-1 atoms (the base
  // serialization contains only file nodes + edges; containers are derived).
  const ungrouped = elements.filter(
    (el) => !el.data.source && !el.data.target && !inContainer.has(el.data.id),
  )

  // Children first, so container atoms are sized by their real content AND
  // the child layouts are captured for reuse in the final composition.
  const containerBboxes: Record<string, { width: number; height: number }> = {}
  const childPositions: Record<string, Record<string, GraphPosition>> = {}
  for (const container of containers) {
    const childIds = container.nodeIds
    const childEdges = allEdges.filter(
      (e) =>
        e.sources.every((s) => childIds.includes(s)) &&
        e.targets.every((t) => childIds.includes(t)),
    )
    const childPos = await runElk(childIds, childEdges)
    childPositions[container.id] = childPos
    containerBboxes[container.id] = measureBbox(childPos)
  }

  const atoms: Stage1Node[] = [
    ...containers.map((c) => {
      const bbox = containerBboxes[c.id]
      return {
        id: c.id,
        width: Math.max(60, Math.round(bbox.width) + 40),
        height: Math.max(40, Math.round(bbox.height) + 40),
        isContainer: true,
      }
    }),
    ...ungrouped.map((el) => ({
      id: el.data.id,
      width: FILE_NODE_W,
      height: FILE_NODE_H,
    })),
  ]

  // Aggregate edges between atoms (dedupe; drop intra-atom edges).
  const atomOf = new Map<string, string>()
  for (const c of containers) for (const n of c.nodeIds) atomOf.set(n, c.id)
  for (const el of ungrouped) atomOf.set(el.data.id, el.data.id)

  const seen = new Set<string>()
  const atomEdges: ElkExtendedEdge[] = []
  for (const e of allEdges) {
    const src = atomOf.get(e.sources[0])
    const tgt = atomOf.get(e.targets[0])
    if (!src || !tgt || src === tgt) continue
    const key = src < tgt ? `${src}->${tgt}` : `${tgt}->${src}`
    if (seen.has(key)) continue
    seen.add(key)
    atomEdges.push({
      id: `atom-e${atomEdges.length}`,
      sources: [src],
      targets: [tgt],
    })
  }

  const atomPositions = await runElk(
    atoms.map((a) => a.id),
    atomEdges,
    atoms.map((a) => ({ id: a.id, width: a.width, height: a.height })),
  )

  // FID-2026-0806-018: a second deterministic ELK pass over the same atom set
  // with fixed sizes. Container atoms are sized CONTAINER_OVERVIEW_W/H (not
  // the child-derived bbox) so the collapsed overview is compact; ungrouped
  // files keep their normal size. The atom set and edges are identical to the
  // sizing pass, so the two runs produce consistent, deterministic layouts.
  const overviewIds = atoms.map((a) => a.id)
  const overviewSizes = atoms.map((a) =>
    a.isContainer
      ? {
          id: a.id,
          width: CONTAINER_OVERVIEW_W,
          height: CONTAINER_OVERVIEW_H,
        }
      : { id: a.id, width: FILE_NODE_W, height: FILE_NODE_H },
  )
  const overviewTopLeft = await runElk(overviewIds, atomEdges, overviewSizes)
  // ELK returns top-left coordinates; convert to center coordinates.
  const overviewPositions: Record<string, GraphPosition> = {}
  const sizeById = new Map(overviewSizes.map((s) => [s.id, s]))
  for (const [id, tl] of Object.entries(overviewTopLeft)) {
    const size = sizeById.get(id)
    if (!size) continue
    overviewPositions[id] = {
      x: roundCoord(tl.x + size.width / 2),
      y: roundCoord(tl.y + size.height / 2),
    }
  }

  return {
    positions: atomPositions,
    overviewPositions,
    atoms,
    containerBboxes,
    childPositions,
  }
}
