import {
  buildGraphExportArtifact,
  reportGraphExportProgress,
} from './build-graph-export'
import { assembleUniverseShell } from './html-sections'

import type { GraphExportProgressCallback } from './build-graph-export'

/**
 * Code Universe offline HTML report (FID-2026-0809-011 Phase B-2). This
 * module is now a thin entry point: the export pipeline lives in
 * build-graph-export.ts, the HTML shell + CSS + ambient markup live in
 * html-sections.ts / universe-css.ts, and the browser app lives in
 * universe-app-script.ts. The rendered artifact is byte-identical to the
 * pre-decomposition output (deterministic-artifact gate preserved).
 */
export async function buildGraphExportHtml(params: {
  product: string
  brandName: string
  version: string
  projectRoot: string
  onProgress?: GraphExportProgressCallback
}): Promise<string> {
  const { brandName, version, projectRoot, onProgress } = params
  const { graph, graphJson, docsPayload } = await buildGraphExportArtifact({
    projectRoot,
    onProgress,
  })
  await reportGraphExportProgress(onProgress, 'Assembling the HTML report…')
  return assembleUniverseShell({
    brandName,
    version,
    graph,
    graphJson,
    docsPayload,
  })
}
