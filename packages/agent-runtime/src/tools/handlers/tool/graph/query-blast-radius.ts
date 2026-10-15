import { jsonToolResult } from '@savant-code/common/util/messages'
import { queryBlastRadius } from '@savant-code/knowledge-graph/queries'

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
 * query_blast_radius — every file within maxDepth hops of filePath over the
 * undirected dependency graph (cycle-safe recursive CTE, depth-capped ≤ 50,
 * row-capped via LIMIT). Read-only.
 */
export const handleQueryBlastRadius = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'query_blast_radius'>
  fileContext: { projectRoot: string }
}): Promise<{
  output: SavantCodeToolOutput<'query_blast_radius'>
}> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  await previousToolCallFinished

  const { filePath, maxDepth = 50, limit = 1000 } = toolCall.input
  const projectRoot = fileContext.projectRoot

  const db = openGraphDatabaseForProject(projectRoot)
  if (!db) {
    return { output: jsonToolResult(GRAPH_NOT_INDEXED_RESULT) }
  }

  try {
    const radius = queryBlastRadius({
      db,
      filePath: normalizeGraphPath(filePath),
      maxDepth,
      // Adapter-enforced row cap — the model can request fewer, never more.
      limit: clampGraphLimit(limit),
    })
    return {
      output: jsonToolResult({
        result: {
          filePath,
          radius,
        },
      }),
    }
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
}) satisfies SavantCodeToolHandlerFunction<'query_blast_radius'>
