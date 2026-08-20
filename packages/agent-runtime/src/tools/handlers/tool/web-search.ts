import { jsonToolResult } from '@savant-code/common/util/messages'

import { searchWebSource } from '../../../llm-api/research-sources'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export const handleWebSearch = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'web_search'>
  logger: Logger

  agentStepId: string
  clientSessionId: string
  fingerprintId: string
  repoId: string | undefined
  userInputId: string
  userId: string | undefined

  fetch: typeof globalThis.fetch
}): Promise<{
  output: SavantCodeToolOutput<'web_search'>
  creditsUsed: number
}> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentStepId,
    clientSessionId,
    fingerprintId,
    logger,
    repoId,
    userId,
    userInputId,

    fetch,
  } = params
  const { query, depth } = toolCall.input

  const searchStartTime = Date.now()
  const searchContext = {
    toolCallId: toolCall.toolCallId,
    query,
    depth,
    userId,
    agentStepId,
    clientSessionId,
    fingerprintId,
    userInputId,
    repoId,
  }

  await previousToolCallFinished

  let creditsUsed = 0

  try {
    const source = await searchWebSource({ query, depth, logger, fetch })

    if (source.error) {
      const searchDuration = Date.now() - searchStartTime
      logger.warn(
        {
          ...searchContext,
          searchDuration,
          success: false,
          error: source.error,
        },
        'Web search source returned error',
      )
      return {
        output: jsonToolResult({
          errorMessage: source.error,
        }),
        creditsUsed,
      }
    }
    const searchDuration = Date.now() - searchStartTime
    const resultLength = source.result?.length || 0
    const hasResults = Boolean(source.result && source.result.trim())

    // BYOK sources use the user's own key — no SavantCode credits are charged.
    if (typeof source.creditsUsed === 'number') {
      creditsUsed = source.creditsUsed
    }

    logger.info(
      {
        ...searchContext,
        searchDuration,
        resultLength,
        hasResults,
        creditsUsed,
        success: true,
      },
      'Search completed via research source',
    )

    return {
      output: jsonToolResult({ result: source.result ?? '' }),
      creditsUsed,
    }
  } catch (error) {
    const searchDuration = Date.now() - searchStartTime
    const errorMessage = `Error performing web search for "${query}": ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
    logger.error(
      {
        ...searchContext,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
        searchDuration,
        success: false,
      },
      'Search failed with error',
    )
    return { output: jsonToolResult({ errorMessage }), creditsUsed }
  }
}) satisfies SavantCodeToolHandlerFunction<'web_search'>
