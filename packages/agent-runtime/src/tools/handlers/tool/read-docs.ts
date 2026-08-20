import { jsonToolResult } from '@savant-code/common/util/messages'

import { readDocsSource } from '../../../llm-api/research-sources'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export const handleReadDocs = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'read_docs'>

  agentStepId: string
  clientSessionId: string
  fingerprintId: string
  logger: Logger
  repoId: string | undefined
  userId: string | undefined
  userInputId: string

  fetch: typeof globalThis.fetch
}): Promise<{
  output: SavantCodeToolOutput<'read_docs'>
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
  const { libraryTitle, topic, max_tokens, ecosystem } = toolCall.input

  const docsStartTime = Date.now()
  const docsContext = {
    toolCallId: toolCall.toolCallId,
    libraryTitle,
    topic,
    max_tokens,
    ecosystem,
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
    const source = await readDocsSource({
      libraryTitle,
      topic,
      ecosystem,
      maxTokens: max_tokens,
      logger,
      fetch,
    })

    if (source.error || typeof source.documentation !== 'string') {
      const docsDuration = Date.now() - docsStartTime
      const docMsg = `Error fetching documentation for "${libraryTitle}"${topic ? ` (topic: ${topic})` : ''}: ${source.error}`
      logger.warn(
        {
          ...docsContext,
          docsDuration,
          success: false,
          error: source.error,
        },
        'Docs source returned error',
      )
      return {
        output: jsonToolResult({
          documentation: docMsg,
          ...(source.error && { errorMessage: source.error }),
        }),
        creditsUsed,
      }
    }

    const docsDuration = Date.now() - docsStartTime
    const resultLength = source.documentation?.length || 0
    const hasResults = Boolean(
      source.documentation && source.documentation.trim(),
    )
    const estimatedTokens = Math.ceil(resultLength / 4)

    // BYOK sources use the user's own key — no SavantCode credits are charged.
    if (typeof source.creditsUsed === 'number') {
      creditsUsed = source.creditsUsed
    }

    logger.info(
      {
        ...docsContext,
        docsDuration,
        resultLength,
        estimatedTokens,
        hasResults,
        creditsUsed,
        success: true,
      },
      'Documentation request completed via research source',
    )
    return {
      output: jsonToolResult({ documentation: source.documentation }),
      creditsUsed,
    }
  } catch (error) {
    const docsDuration = Date.now() - docsStartTime
    const errMsg = `Error fetching documentation for "${libraryTitle}": ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
    logger.error(
      {
        ...docsContext,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
        docsDuration,
        success: false,
      },
      'Documentation request failed with error',
    )
    return {
      output: jsonToolResult({ documentation: errMsg, errorMessage: errMsg }),
      creditsUsed,
    }
  }
}) satisfies SavantCodeToolHandlerFunction<'read_docs'>
