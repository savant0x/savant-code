import { jsonToolResult } from '@savant-code/common/util/messages'
import { queryNodeEdges } from '@savant-code/knowledge-graph/queries'

import {
  clampGraphLimit,
  GRAPH_NOT_INDEXED_RESULT,
  normalizeGraphPath,
  openGraphDatabaseForProject,
} from './graph-adapter'

import type { SavantCodeToolHandlerFunction } from '../../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/**
 * query_node_edges — a file's symbol nodes, cluster assignment, and direct
 * incoming/outgoing edges (CALLS/IMPORTS/EXTENDS with weights). Read-only.
 */
export const handleQueryNodeEdges = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'query_node_edges'>
  fileContext: { projectRoot: string }
}): Promise<{
  output: SavantCodeToolOutput<'query_node_edges'>
}> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  await previousToolCallFinished

  const { filePath, limit = 500 } = toolCall.input
  const projectRoot = fileContext.projectRoot

  const db = openGraphDatabaseForProject(projectRoot)
  if (!db) {
    return { output: jsonToolResult(GRAPH_NOT_INDEXED_RESULT) }
  }

  try {
    const result = queryNodeEdges({
      db,
      filePath: normalizeGraphPath(filePath),
      // Adapter-enforced row cap — the model can request fewer, never more.
      limit: clampGraphLimit(limit),
    })
    return { output: jsonToolResult({ result }) }
  } catch (error) {
    return {
      output: jsonToolResult({
        errorMessage: error instanceof Error ? error.message : String(error),
        code: 'GRAPH_QUERY_FAILED',
      }),
    }
  } finally {
    db.close()
  }
}) satisfies SavantCodeToolHandlerFunction<'query_node_edges'>
