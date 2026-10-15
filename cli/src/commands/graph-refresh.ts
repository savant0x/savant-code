/**
 * `/graph refresh` command — run the in-process knowledge-graph indexer over
 * the project, then report the resulting index stats.
 *
 * Indexing is deterministic and incremental (sha256 hash-compare): unchanged
 * files are skipped, changed/new files are re-parsed via `packages/code-map`
 * tree-sitter, and the edge layer + Louvain clusters are rebuilt. `--full`
 * forces a complete reindex.
 *
 * The index lives at `.savant/graph.db` under the project root and is
 * consumed by the read-only graph tools (`query_blast_radius`,
 * `query_node_edges`, `query_domain_clusters`) and by `/graph-export`.
 *
 * Usage:
 *   /graph refresh      → incremental refresh
 *   /graph refresh --full → full reindex
 */

import {
  openGraphDatabase,
  updateKnowledgeGraph,
  withGraphOperationLock,
} from '@savant-code/knowledge-graph'

import { getProjectRoot } from '../project-files'
import { getSystemMessage } from '../utils/message-history'

import type { RouterParams } from './command-registry'

export async function handleGraphRefreshCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  const projectRoot = getProjectRoot()
  const fullRebuild = /--full|-f/i.test(args.trim())

  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(
      fullRebuild
        ? '🔄 Building the knowledge graph (full reindex)…'
        : '🔄 Refreshing the knowledge graph (incremental)…',
    ),
  ])

  try {
    const stats = await withGraphOperationLock(projectRoot, async () => {
      const db = openGraphDatabase(projectRoot)
      try {
        return await updateKnowledgeGraph({ projectRoot, db, fullRebuild })
      } finally {
        db.close()
      }
    })

    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `✅ Knowledge graph ${fullRebuild ? 'rebuilt' : 'refreshed'} in ${stats.durationMs}ms\n\n` +
          `- **Files:** ${stats.filesOnDisk} on disk (${stats.filesAdded} added, ${stats.filesModified} modified, ${stats.filesDeleted} deleted, ${stats.filesUnchanged} unchanged)\n` +
          `- **Graph:** ${stats.nodeCount} nodes · ${stats.edgeCount} edges · ${stats.clusterCount} clusters\n\n` +
          `Try **/graph-export** for an interactive visualization, or ask the agent to query blast radius / node edges / domain clusters.`,
      ),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(`❌ Graph refresh failed: ${msg}`),
    ])
  }
}
