import {
  openGraphDatabase,
  serializeGraphForExport,
  updateKnowledgeGraph,
  withGraphOperationLock,
} from '@savant-code/knowledge-graph'

import { computeGraphLayout } from './layout'

import type { GraphExport } from '@savant-code/knowledge-graph'

/**
 * Code Universe export pipeline (FID-2026-0809-011 Phase B-2). Extracted
 * verbatim from template.ts — orchestration (lock, index refresh, serialize,
 * layout, embed, compress) is separated from the HTML shell assembly.
 * buildGraphExportArtifact returns the graph plus both escape-safe payloads;
 * template.ts fires the final 'Assembling' progress stage and renders.
 */

/**
 * Optional env-driven document-limit override for the inline document budget
 * (FID-2026-0807-011). Returns undefined when unset/invalid so the serializer
 * falls back to its defaults.
 */
function envPositiveInt(name: string): number | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export type GraphExportProgressStage =
  | 'Refreshing the project index…'
  | 'Serializing the graph…'
  | 'Laying out the universe…'
  | 'Embedding document contents…'
  | 'Compressing the offline payload…'
  | 'Assembling the HTML report…'

export type GraphExportProgressCallback = (
  stage: GraphExportProgressStage,
) => Promise<void> | void

export type GraphExportArtifact = {
  graph: GraphExport
  graphJson: string
  docsPayload: string
}

/**
 * Best-effort progress callback wrapper: rendering feedback must never abort
 * a valid export. Shared by the orchestrator and the HTML entry point
 * (FID-2026-0809-011 Phase B-2, reviewer dedup).
 */
export async function reportGraphExportProgress(
  onProgress: GraphExportProgressCallback | undefined,
  stage: GraphExportProgressStage,
): Promise<void> {
  if (!onProgress) return
  try {
    await onProgress(stage)
  } catch (error) {
    // Rendering feedback is best-effort and must never abort a valid export.
    void error
  }
}

export async function buildGraphExportArtifact(params: {
  projectRoot: string
  onProgress?: GraphExportProgressCallback
}): Promise<GraphExportArtifact> {
  const { projectRoot, onProgress } = params
  let graph: GraphExport | undefined
  await withGraphOperationLock(projectRoot, async () => {
    const db = openGraphDatabase(projectRoot)
    try {
      await reportGraphExportProgress(
        onProgress,
        'Refreshing the project index…',
      )
      await updateKnowledgeGraph({ projectRoot, db })
      await reportGraphExportProgress(onProgress, 'Serializing the graph…')
      const initial = serializeGraphForExport(db, {
        projectRoot,
        documents: false,
      })
      await reportGraphExportProgress(onProgress, 'Laying out the universe…')
      const layout = await computeGraphLayout(initial.elements)
      await reportGraphExportProgress(
        onProgress,
        'Embedding document contents…',
      )
      graph = serializeGraphForExport(db, {
        projectRoot,
        documents: true,
        documentLines: envPositiveInt('SAVANT_GRAPH_EXPORT_DOCUMENT_LINES'),
        documentBytes: envPositiveInt('SAVANT_GRAPH_EXPORT_DOCUMENT_BYTES'),
        documentImageBytes: envPositiveInt(
          'SAVANT_GRAPH_EXPORT_DOCUMENT_IMAGE_BYTES',
        ),
        documentTotalTextBytes: envPositiveInt(
          'SAVANT_GRAPH_EXPORT_TOTAL_TEXT_BYTES',
        ),
        documentTotalMediaBytes: envPositiveInt(
          'SAVANT_GRAPH_EXPORT_TOTAL_MEDIA_BYTES',
        ),
        positions: layout.positions,
        containerIds: layout.containerIds,
        containers: layout.containers,
        overviewPositions: layout.overviewPositions,
        overviewAnchors: layout.overviewAnchors,
        childOffsets: layout.childOffsets,
      })
    } finally {
      db.close()
    }
  })

  // FID-2026-0807-020 payload engineering:
  // - `elements` is the export-time layout view only — strip it before
  //   embedding so the artifact ships only the renderer-neutral `universe`.
  // - `universe.documents` (the heavy unlimited-text payload) is emitted as a
  //   separate gzip+base64 block (`savant-docs-payload`) and decompressed
  //   lazily in the browser via DecompressionStream. Older browsers without
  //   `Uint8Array.fromBase64`/`DecompressionStream` fall back to the plain
  //   JSON block so the artifact never blank-screens.
  if (!graph) throw new Error('Graph export serialization produced no graph')
  const payload = { ...graph, elements: undefined }
  const universe = { ...graph.universe, documents: undefined }
  const graphJson = JSON.stringify({ ...payload, universe })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  // The plain-mode block is raw JSON inside <script type="text/plain">, so it
  // gets the same breakout escaping as the graph block: `<` → `\u003c` (plus
  // the JS line terminators) before embedding. JSON.parse decodes the escapes
  // natively on the client, and gzip mode inherits the same normalized text.
  const documentsJson = JSON.stringify(graph.universe.documents)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  await reportGraphExportProgress(
    onProgress,
    'Compressing the offline payload…',
  )
  const docsPayload =
    process.env.SAVANT_GRAPH_EXPORT_NO_COMPRESS === '1'
      ? JSON.stringify({ mode: 'plain', payload: documentsJson })
      : JSON.stringify({
          mode: 'gzip',
          payload: Buffer.from(Bun.gzipSync(documentsJson)).toString('base64'),
        })
  return { graph, graphJson, docsPayload }
}
