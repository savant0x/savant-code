/**
 * `/graph-export` command — serialize the codebase knowledge graph into a
 * self-contained, branded HTML file with an interactive Cytoscape.js canvas.
 *
 * Reuses the `/export` design system exactly: real Savant logo (base64 data
 * URI), Neon Slate tokens, Font Awesome 6.7.2 (offline), corner marks,
 * header/meta grid, toolbar, and footer. Cytoscape.js 3.30.2 is inlined (MIT),
 * so the file is fully offline — zero network requests.
 *
 * The graph itself lives at `.savant/graph.db` under the project root (built
 * by the in-process indexer on demand / after writes / via `/graph refresh`).
 * Structural metadata plus a capped first-20-line code preview per file
 * (2,000 chars; binary/oversized files skipped). FID-2026-0806-017: previews
 * are OFF by default — opt in with SAVANT_GRAPH_EXPORT_PREVIEWS=1
 * (SAVANT_GRAPH_EXPORT_NO_PREVIEW=1 remains a hard-off).
 *
 * Inline document contents (FID-2026-0807-011): enabled by default with a
 * 500-line / 50 KB per-file cap and an 8 MB total-text budget. Tune the caps
 * with SAVANT_GRAPH_EXPORT_DOCUMENT_LINES, SAVANT_GRAPH_EXPORT_DOCUMENT_BYTES,
 * SAVANT_GRAPH_EXPORT_DOCUMENT_IMAGE_BYTES, SAVANT_GRAPH_EXPORT_TOTAL_TEXT_BYTES,
 * and SAVANT_GRAPH_EXPORT_TOTAL_MEDIA_BYTES (bytes; unset = defaults).
 *
 * Usage:
 *   /graph-export             → writes to dev/exports/graph/savant-graph.html
 *                               (single-file rotation, FID-2026-0806-016)
 *   /graph-export output.html → writes to the specified path
 */

import fs from 'fs'
import path from 'path'

import { getGraphDbPath } from '@savant-code/knowledge-graph'

import { getProjectRoot } from '../project-files'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'
import { getVersion } from '../utils/version'
import { buildGraphExportHtml } from './graph-export/template'

import type { RouterParams } from './command-registry'
import type { ChatMessage } from '../types/chat'

type GraphExportProgressStage =
  | 'Preparing the graph export…'
  | 'Refreshing the project index…'
  | 'Serializing the graph…'
  | 'Laying out the universe…'
  | 'Embedding document contents…'
  | 'Compressing the offline payload…'
  | 'Assembling the HTML report…'
  | 'Writing the HTML file…'

const yieldToUi = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function createProgressMessage(
  id: string,
  stage: GraphExportProgressStage,
): ChatMessage {
  const message = getSystemMessage(`⠋ Exporting knowledge graph…

${stage}`)
  message.id = id
  return message
}

function replaceProgressMessage(
  params: RouterParams,
  progressId: string,
  content: string,
): void {
  const finalMessage = getSystemMessage(content)
  params.setMessages((prev) => {
    const hasProgress = prev.some((message) => message.id === progressId)
    return hasProgress
      ? prev.map((message) =>
          message.id === progressId ? finalMessage : message,
        )
      : [...prev, finalMessage]
  })
}

export async function handleGraphExportCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  const projectRoot = getProjectRoot()
  const dbPath = getGraphDbPath(projectRoot)

  if (!fs.existsSync(dbPath)) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        '❌ No knowledge-graph index found for this project yet. Run **/graph refresh** to build it, then retry **/graph-export**.',
      ),
    ])
    return
  }

  const product = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
  const brandName = IS_SAVANT_FREE ? 'Savant Free' : 'Savant Code'

  // Determine output path
  const argPath = args.trim()
  let outputPath: string
  if (argPath) {
    outputPath = path.isAbsolute(argPath)
      ? argPath
      : path.resolve(process.cwd(), argPath)
  } else {
    // Default: dev/exports/graph/ single-file rotation (overwrite the
    // previous export) so exports stop cluttering the project root
    // (FID-2026-0806-016, Nova export-organization request).
    outputPath = path.resolve(
      process.cwd(),
      'dev',
      'exports',
      'graph',
      'savant-graph.html',
    )
  }

  const progressId = `graph-export-${crypto.randomUUID()}`
  try {
    params.setMessages((prev) => [
      ...prev,
      createProgressMessage(progressId, 'Preparing the graph export…'),
    ])
    // Let OpenTUI/React paint the status before synchronous serialization and
    // compression begin. A microtask is insufficient for this boundary.
    await yieldToUi()

    const updateProgress = async (
      stage: GraphExportProgressStage,
    ): Promise<void> => {
      try {
        params.setMessages((prev) =>
          prev.map((message) =>
            message.id === progressId
              ? createProgressMessage(progressId, stage)
              : message,
          ),
        )
      } catch (error) {
        // Progress rendering is best-effort; never turn a UI update failure
        // into an export failure.
        void error
      }
      await yieldToUi()
    }

    const html = await buildGraphExportHtml({
      product,
      brandName,
      version: getVersion(),
      projectRoot,
      onProgress: updateProgress,
    })

    await updateProgress('Writing the HTML file…')
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(outputPath, html, 'utf8')

    const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)
    replaceProgressMessage(
      params,
      progressId,
      `✅ Exported the knowledge graph to **${outputPath}** (${sizeKb} KB)\n\nInteractive canvas: fuzzy file search, cluster color-coding, and shortest-path highlighting. Open in a browser — fully offline.`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    replaceProgressMessage(
      params,
      progressId,
      `❌ Failed to export graph: ${msg}`,
    )
  }
}
