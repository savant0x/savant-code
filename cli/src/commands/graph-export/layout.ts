/**
 * Export-time layout engine (FID-2026-0806-017, source-exact ELK).
 *
 * FID-2026-0807-020: all emitted coordinates are rounded to integers (integer
 * rounding is deterministic across runs and cheaper to parse/render than
 * 1-decimal floats); `roundCoord` replaces the old 1-decimal `round1`.
 *
 * Runs the Eclipse Layout Kernel (elkjs) in Bun at export time, never in the
 * browser: Stage 1 lays out region atoms + ungrouped nodes; Stage 2 lays out
 * each region's local files, offset by the region position. The resulting
 * coordinates are embedded in the renderer-neutral Code Universe payload; the
 * browser performs no layout math and elkjs remains export-time-only — its
 * GWT bundle never ships to the client.
 *
 * ## elkjs-under-Bun (spike, 2026-08-06)
 *
 * elkjs's CJS entry (`lib/main.js`) requires the GWT-compiled
 * `elk-worker.min.js` bundle and reads `module.exports.Worker`. Under Bun that
 * interop silently returns `{}` because Bun defines a global `self` — the
 * bundle takes its *web-worker* branch (`self.onmessage = …`) and skips the
 * CJS export guard. The workaround, verified end-to-end in the spike
 * (FID Step 1): read the worker bundle text, evaluate it in a `Function`
 * scope with `self` / `document` / `window` shadowed as `undefined` (so it
 * takes the CJS branch), and hand the extracted in-process fake `Worker` to
 * elkjs via `workerFactory`. No threads, no WASM download — pure JS layout.
 *
 * Sandboxing notes (audited 2026-08-06): `vm.runInNewContext` was tried
 * first and FAILS under Bun — the GWT bootstrap reads `$wnd.goog` off the
 * host global shape, so a fresh vm context (or shadowing `process` /
 * `globalThis`) breaks layout entirely. The executed source is a pinned,
 * vendored npm dep (`elkjs` 0.12.0 exact) with a stub `require`; no
 * user-controlled data ever reaches the eval.
 *
 * The worker bootstrap lives in elk-worker.ts, the ELK invocation + constants
 * in elk-runner.ts, and the Stage-1 pass in layout-stage1.ts
 * (FID-2026-0819-005 split).
 */

import { deriveContainers } from './containers'
import { FILE_NODE_H, FILE_NODE_W, roundCoord } from './elk-runner'
import { layoutStage1 } from './layout-stage1'

import type { GraphContainer } from './containers'
import type {
  GraphExportElement,
  GraphPosition,
} from '@savant-code/knowledge-graph'
import type { ElkExtendedEdge } from 'elkjs/lib/elk-api.js'

// Re-export the worker bootstrap from the original path (public API kept).
export { getElkWorkerClass } from './elk-worker'

export interface GraphLayoutResult {
  /** Element id → precomputed position (file nodes only). */
  positions: Record<string, GraphPosition>
  /** Element id → container id (drill-down). */
  containerIds: Record<string, string>
  /** Derived containers (id + label) for the serializer to emit as atoms. */
  containers: GraphContainer[]
  /**
   * FID-2026-0806-018: compact center positions for every initially visible
   * overview element — container atoms + ungrouped root files. Computed by a
   * fixed-size ELK pass so the collapsed overview is spatially compact
   * (the Stage-1 bbox-derived positions span tens of thousands of units).
   */
  overviewPositions: Record<string, GraphPosition>
  /**
   * FID-2026-0806-018: stable expansion anchor per container — the container's
   * compact overview center (same point as its collapsed position). The browser
   * positions children at `anchor + childOffsets[c][id]` on expand so they
   * center on the container; it must never derive the anchor from the live
   * parent position (compound bounds shift when children become visible).
   */
  overviewAnchors: Record<string, GraphPosition>
  /**
   * FID-2026-0806-018: per-container child offsets in the same center frame
   * as the anchors (container id → child element id → center-frame offset).
   */
  childOffsets: Record<string, Record<string, GraphPosition>>
}

/**
 * Compute the export-time layout for the serialized elements.
 *
 * 1. Derive containers (folder-LCP with cluster fallback).
 * 2. Stage 2 first — layout each container's children so the container atom
 *    size matches its real content extent.
 * 3. Stage 1 — ELK over container atoms + ungrouped nodes.
 * 4. Compose final absolute positions: ungrouped nodes from Stage 1, children
 *    from Stage 2 offset by their container's Stage-1 origin.
 */
export async function computeGraphLayout(
  elements: GraphExportElement[],
): Promise<GraphLayoutResult> {
  const containers = deriveContainers(elements)
  const nodeIds = new Set(
    elements
      .filter((el) => !el.data.source && !el.data.target)
      .map((el) => el.data.id),
  )

  const containerOf = new Map<string, string>()
  for (const c of containers) {
    for (const nodeId of c.nodeIds) containerOf.set(nodeId, c.id)
  }
  const containerIds: Record<string, string> = Object.fromEntries(containerOf)

  const edges: ElkExtendedEdge[] = elements
    .filter((el) => el.data.source && el.data.target)
    .map((el, i) => ({
      id: `e${i}`,
      sources: [el.data.source as string],
      targets: [el.data.target as string],
    }))

  const stage1 = await layoutStage1(elements, containers, edges)
  const positions: Record<string, GraphPosition> = { ...stage1.positions }

  // Stage 2 is a pure composition: the child layouts were already computed
  // during Stage 1's atom sizing, so just offset them by the container origin.
  // (Running ELK twice on the same children would double the export wall time.)
  for (const container of containers) {
    const bbox = stage1.containerBboxes[container.id]
    if (!bbox) continue
    const children = container.nodeIds.filter((id) => nodeIds.has(id))
    if (children.length === 0) continue
    const childPositions = stage1.childPositions[container.id] ?? {}
    const origin = stage1.positions[container.id] ?? { x: 0, y: 0 }
    for (const childId of children) {
      const rel = childPositions[childId]
      if (!rel) continue
      positions[childId] = {
        x: roundCoord(origin.x + rel.x),
        y: roundCoord(origin.y + rel.y),
      }
    }
  }

  // FID-2026-0806-018: derive the compact overview + drill-down coordinate
  // contract in one consistent center frame. ELK returns top-left coordinates;
  // Sigma node positions are centers. The anchor for each container is its
  // compact overview center; every child offset is measured from the center of
  // that container's child-layout bbox, so `anchor + offset` reconstructs the
  // child layout centered on the collapsed container.
  const overviewPositions: Record<string, GraphPosition> = {}
  const overviewAnchors: Record<string, GraphPosition> = {}
  const childOffsets: Record<string, Record<string, GraphPosition>> = {}
  for (const atom of stage1.atoms) {
    const pos = stage1.overviewPositions[atom.id]
    if (pos) overviewPositions[atom.id] = pos
    if (atom.isContainer) {
      const bbox = stage1.containerBboxes[atom.id]
      const childPositions = stage1.childPositions[atom.id] ?? {}
      // The expansion anchor is the container's compact overview center so
      // expanded children center on the container atom itself (anchor + offset
      // reconstructs the child layout centered on the collapsed container).
      const anchor = pos
      if (bbox && bbox.width > 0 && bbox.height > 0 && anchor) {
        overviewAnchors[atom.id] = anchor
        const offsets: Record<string, GraphPosition> = {}
        for (const [childId, childPos] of Object.entries(childPositions)) {
          offsets[childId] = {
            x: roundCoord(childPos.x + FILE_NODE_W / 2 - bbox.width / 2),
            y: roundCoord(childPos.y + FILE_NODE_H / 2 - bbox.height / 2),
          }
        }
        childOffsets[atom.id] = offsets
      }
    }
  }

  return {
    positions,
    containerIds,
    containers,
    overviewPositions,
    overviewAnchors,
    childOffsets,
  }
}
