/**
 * Serialize the graph database into the renderer-neutral Code Universe
 * payload (FID-2026-0807-002). Legacy `elements` are retained as a typed
 * compatibility/data-inspection view; the browser renderer consumes `universe`.
 *
 * FID-2026-0806-006: file nodes optionally carry a capped first-20-line code
 * preview (2,000 chars) so the offline export can render a sidebar preview.
 * Previews are read from disk at export time when a `projectRoot` is passed;
 * the strict metadata-only posture can be forced with
 * `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1`. Document text is unlimited by default;
 * positive caller-supplied limits remain available, while validated raster
 * images stay within explicit media budgets.
 *
 * FID-2026-0807-002: the export is precomputed at export time. The caller
 * passes positions and region/container metadata back in; the browser only
 * renders immutable coordinates and camera states. Previews are OFF by default
 * (opt in with `SAVANT_GRAPH_EXPORT_PREVIEWS=1`); the hard-off flag remains.
 *
 * Extracted from export-serializer.ts by FID-2026-0809-011 Phase A — the
 * exported contract is unchanged; types live in ./types, helpers in ./helpers.
 */
import {
  DEFAULT_DOCUMENT_IMAGE_BYTES,
  DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES,
  buildUniverse,
  positiveLimit,
  readFilePreview,
} from './helpers'

import type { EdgeType } from '../types'
import type {
  GraphExport,
  GraphExportElement,
  GraphExportOptions,
} from './types'
import type { Database } from 'bun:sqlite'
export function serializeGraphForExport(
  db: Database,
  options: GraphExportOptions = {},
): GraphExport {
  const {
    projectRoot,
    previewLines = 20,
    previewChars = 2000,
    documentLines,
    documentBytes,
    documentImageBytes = DEFAULT_DOCUMENT_IMAGE_BYTES,
    documentTotalTextBytes,
    documentTotalMediaBytes = DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES,
  } = options
  const normalizedDocumentLines = positiveLimit(documentLines)
  const normalizedDocumentBytes = positiveLimit(documentBytes)
  const normalizedDocumentTotalTextBytes = positiveLimit(documentTotalTextBytes)
  // FID-2026-0806-017: previews are OFF by default (inverted opt-in). The old
  // hard-off flag is still honored as a final gate so the strict
  // metadata-only posture is impossible to accidentally weaken.
  const previewsEnabled =
    process.env.SAVANT_GRAPH_EXPORT_PREVIEWS === '1' &&
    process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW !== '1'
  const documentsEnabled =
    options.documents === true &&
    Boolean(projectRoot) &&
    process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS !== '0' &&
    process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW !== '1'

  const fileRows = db
    .query(
      `SELECT f.id, f.path, n.cluster_id
       FROM files f
       LEFT JOIN nodes n ON n.file_id = f.id AND n.type = 'file'
       ORDER BY f.path`,
    )
    .all() as Array<{ id: number; path: string; cluster_id: number | null }>

  const symbolCount = (
    db.query(`SELECT COUNT(*) AS c FROM nodes WHERE type = 'symbol'`).get() as {
      c: number
    }
  ).c
  const edgeRows = db
    .query('SELECT source_id, target_id, type, weight FROM edges')
    .all() as Array<{
    source_id: number
    target_id: number
    type: EdgeType
    weight: number
  }>

  const clusterSet = new Set<number>()
  for (const row of fileRows) {
    if (row.cluster_id !== null) clusterSet.add(row.cluster_id)
  }

  const elements: GraphExportElement[] = []

  // FID-2026-0806-017: container atoms become compound parent nodes so the
  // browser can render them collapsed with children hidden (drill-down).
  // FID-2026-0806-018: containers carry the compact overview center as their
  // preset position plus the stable expansion anchor (both center frame).
  for (const container of options.containers ?? []) {
    elements.push({
      data: {
        id: container.id,
        label: container.label,
        type: 'container',
        container: true,
        cluster: null,
        overviewPosition: options.overviewPositions?.[container.id],
        overviewAnchor: options.overviewAnchors?.[container.id],
      },
      position: options.overviewPositions?.[container.id],
    })
  }

  for (const file of fileRows) {
    const elementId = `file-${file.id}`
    const element: GraphExportElement = {
      data: {
        id: elementId,
        label: file.path.split('/').pop() ?? file.path,
        path: file.path,
        type: 'file',
        cluster: file.cluster_id,
      },
    }
    const containerId = options.containerIds?.[elementId]
    if (containerId) {
      element.data.containerId = containerId
      // Compound parent linkage — Cytoscape renders the container atom as a
      // parent node that encloses its children (collapsed drill-down).
      element.data.parent = containerId
      // FID-2026-0806-018: children never receive an absolute preset position;
      // they stay hidden while the container is collapsed, and expansion
      // positions them at `overviewAnchor + childOffset` (no browser layout).
      element.data.childOffset =
        options.childOffsets?.[containerId]?.[elementId]
    } else if (
      options.overviewPositions &&
      options.overviewPositions[elementId]
    ) {
      // Ungrouped root file — part of the compact overview; carries its
      // overview center as the preset position.
      element.position = options.overviewPositions[elementId]
    } else if (options.positions && options.positions[elementId]) {
      element.position = options.positions[elementId]
    }
    if (projectRoot && previewsEnabled) {
      const preview = readFilePreview(
        projectRoot,
        file.path,
        previewLines,
        previewChars,
      )
      if (preview !== undefined) element.data.preview = preview
    }
    elements.push(element)
  }

  for (const edge of edgeRows) {
    elements.push({
      data: {
        id: `edge-${edge.source_id}-${edge.target_id}-${edge.type}`,
        source: `file-${edge.source_id}`,
        target: `file-${edge.target_id}`,
        label: edge.type,
        type: edge.type,
        weight: edge.weight,
      },
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    meta: {
      files: fileRows.length,
      nodes: fileRows.length + symbolCount,
      edges: edgeRows.length,
      clusters: clusterSet.size,
    },
    elements,
    universe: buildUniverse(
      fileRows,
      edgeRows,
      projectRoot,
      documentsEnabled,
      normalizedDocumentLines,
      normalizedDocumentBytes,
      documentImageBytes,
      normalizedDocumentTotalTextBytes,
      documentTotalMediaBytes,
      previewsEnabled,
      previewLines,
      previewChars,
    ),
  }
}
