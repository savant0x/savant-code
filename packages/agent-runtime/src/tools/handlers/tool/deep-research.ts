import { jsonToolResult } from '@savant-code/common/util/messages'

import {
  deriveQueries,
  runDeepResearch,
  type SearchFn,
} from './deep-research-core'
import { searchWebSource } from '../../../llm-api/research-sources'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

// Re-export the research mechanics + constants for tests and callers that
// import them from the original module path (call-graph preserved).
export {
  DEPTH_QUERY_COUNTS,
  deriveQueries,
  domainScore,
  extractOrganicHits,
  runDeepResearch,
  type DeepResearchCitation,
  type DeepResearchFinding,
  type DeepResearchOutput,
} from './deep-research-core'

/**
 * Handler: wires `runDeepResearch` to the web-search facade (the same one the
 * `web_search` tool uses). No second LLM — the facade is a mechanical search.
 */
export const handleDeepResearch = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'deep_research'>
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<{
  output: SavantCodeToolOutput<'deep_research'>
  creditsUsed: number
}> => {
  const { previousToolCallFinished, toolCall, logger, fetch } = params
  const {
    question,
    queries,
    research_depth = 'standard',
    max_sources = 10,
  } = toolCall.input

  await previousToolCallFinished

  const search: SearchFn = async (query) =>
    searchWebSource({ query, depth: 'standard', logger, fetch })

  const result = await runDeepResearch({
    question,
    queries:
      queries && queries.length > 0
        ? queries
        : deriveQueries(question, research_depth),
    maxSources: max_sources,
    search,
    logger,
  })

  const { creditsUsed, ...output } = result
  return { output: jsonToolResult(output), creditsUsed }
}) satisfies SavantCodeToolHandlerFunction<'deep_research'>
