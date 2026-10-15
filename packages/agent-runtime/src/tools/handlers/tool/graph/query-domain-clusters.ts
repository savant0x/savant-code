import { jsonToolResult } from '@savant-code/common/util/messages'
import { queryDomainClusters } from '@savant-code/knowledge-graph/queries'

import {
  clampGraphLimit,
  GRAPH_NOT_INDEXED_RESULT,
  openGraphDatabaseForProject,
} from './graph-adapter'

import type { SavantCodeToolHandlerFunction } from '../../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/**
 * query_domain_clusters — Louvain domain clusters over the indexed snapshot,
 * ordered by file count descending, each with size + representative files.
 * Read-only.
 */
export const handleQueryDomainClusters = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'query_domain_clusters'>
  fileContext: { projectRoot: string }
}): Promise<{
  output: SavantCodeToolOutput<'query_domain_clusters'>
}> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  await previousToolCallFinished

  const { limit = 100 } = toolCall.input
  const projectRoot = fileContext.projectRoot

  const db = openGraphDatabaseForProject(projectRoot)
  if (!db) {
    return { output: jsonToolResult(GRAPH_NOT_INDEXED_RESULT) }
  }

  try {
    const clusters = queryDomainClusters({
      db,
      // Adapter-enforced row cap — the model can request fewer, never more.
      limit: clampGraphLimit(limit),
    })
    return { output: jsonToolResult({ result: { clusters } }) }
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
}) satisfies SavantCodeToolHandlerFunction<'query_domain_clusters'>
